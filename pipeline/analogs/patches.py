"""Candidatos terrestres de todo el mundo para el visor 3D (parches de 2 × 2 km a 20 m).

Une el escaneo global (earth_scan: relieve + cobertura a 30 km) con el visor:

1. Elige regiones de todo el planeta con suelo desnudo (roca/arena) o hielo,
   repartidas por tipo de relieve para que haya llanuras, dunas, cañones y montañas.
2. En cada región baja Copernicus DEM GLO-30 y ESA WorldCover, corta parches de
   2 × 2 km (100 × 100 celdas de 20 m, fila 0 = norte) y mide lo mismo que el visor.
3. Calcula superficie (WorldCover) y clima (Meteomatics) para esos parches y para
   los sitios curados de EE.UU. que ya tenía el catálogo.
4. Para cada sitio de Marte elige los mejores parches globales con la misma fórmula
   que usa el visor (src/data.ts) y escribe solo esos en public/terrain/ y en
   src/data/catalog.json.

Ejecutar desde pipeline/ (después de earth_scan):
    python -m analogs.patches          (con el python del entorno virtual)
Opciones:  --no-climate (no gasta consultas)   --regions N (prueba rápida)
Con cualquiera de las dos opciones el resultado va a data/prueba/ (catalog.json y terrain/)
y NO se toca la app (src/data/catalog.json ni public/terrain/).
Coste en Meteomatics de una ejecución completa: 1 consulta por cada 10 puntos que no estén
en la caché (un punto por región + uno por sitio curado).
"""

from __future__ import annotations

import json
import math
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import planetary_computer
import rasterio
import requests
from pystac_client import Client
from scipy import ndimage

from .climate import climate_scores, fetch
from .rank import haversine_km, known_name
from .terrain import _aeqd_inverse

PIPELINE = Path(__file__).resolve().parent.parent
PROJECT = PIPELINE.parent
DATA = PIPELINE / "data"
CACHE = DATA / "patches"
PLACES = DATA / "places.json"
CATALOG = PROJECT / "src" / "data" / "catalog.json"
TERRAIN_DIR = PROJECT / "public" / "terrain"
TEST_DIR = DATA / "prueba"            # salida de las pruebas (--no-climate / --regions)
STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"

EARTH_R = 6_371_008.8
GRID, CELL = 100, 20.0                 # igual que el visor
PATCHES_PER_SIDE = 7                   # región de 14 × 14 km -> 49 parches
DRY_BINS, DRY_PER_BIN = 8, 12          # regiones de suelo desnudo, repartidas por relieve
ICE_BINS, ICE_PER_BIN = 4, 6           # regiones de hielo
REGION_SPACING_KM = 300
TOP_PER_MARS = 3                       # parches globales guardados por sitio de Marte

# Pesos: mismos que rank.py y que src/data.ts
W_TERRAIN, W_SURFACE, W_CLIMATE = 0.5, 0.25, 0.25
MARS_CLIMATE_W = {"cold": 0.35, "dry": 0.35, "swing": 0.3}
ICE_CATEGORY = "Ice & polar terrain"

WC_CLASSES = {10: "vegetation", 20: "vegetation", 30: "vegetation", 40: "vegetation", 50: "built",
              60: "bare", 70: "snow_ice", 80: "water", 90: "vegetation", 95: "vegetation",
              100: "moss_lichen"}
COVER_KEYS = ["bare", "snow_ice", "moss_lichen", "vegetation", "water", "built"]

_client: Client | None = None


def client() -> Client:
    global _client
    if _client is None:
        _client = Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)
    return _client


# ---------------------------------------------------------------- lectura de rásteres

def local_grid(lat: float, lon: float, n: int, px: float):
    """(lat, lon) de una malla n × n de `px` m centrada en el punto, fila 0 = norte."""
    off = (np.arange(n) - (n - 1) / 2) * px
    east, north = np.meshgrid(off, -off)
    return _aeqd_inverse(lat, lon, east, north, EARTH_R)


def sample(collection: str, asset: str, la: np.ndarray, lo: np.ndarray, order: int,
           query: dict | None = None) -> np.ndarray:
    """Muestrea una colección de Planetary Computer en los puntos dados (NaN si no hay datos)."""
    bbox = [float(lo.min()), float(la.min()), float(lo.max()), float(la.max())]
    items = list(client().search(collections=[collection], bbox=bbox, query=query).items())
    out = np.full(la.shape, np.nan, dtype="float32")
    env = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="4", GDAL_HTTP_RETRY_DELAY="2")
    for item in items:
        with rasterio.Env(**env), rasterio.open(item.assets[asset].href) as src:
            cols, rows = ~src.transform * (lo, la)
            cols, rows = cols - 0.5, rows - 0.5   # centro de píxel
            inside = (cols >= -0.5) & (cols <= src.width - 0.5) & (rows >= -0.5) & (rows <= src.height - 0.5)
            inside &= np.isnan(out)
            if not inside.any():
                continue
            r0 = max(int(np.floor(rows[inside].min())) - 1, 0)
            r1 = min(int(np.ceil(rows[inside].max())) + 2, src.height)
            c0 = max(int(np.floor(cols[inside].min())) - 1, 0)
            c1 = min(int(np.ceil(cols[inside].max())) + 2, src.width)
            arr = src.read(1, window=((r0, r1), (c0, c1))).astype("float32")
            if src.nodata is not None:
                arr[arr == src.nodata] = np.nan
        vals = ndimage.map_coordinates(arr, [rows[inside] - r0, cols[inside] - c0],
                                       order=order, mode="nearest", cval=np.nan)
        out[inside] = vals
    return out


def read_dem(la, lo):
    return sample("cop-dem-glo-30", "data", la, lo, order=1)


def read_cover(la, lo):
    return sample("esa-worldcover", "map", la, lo, order=0,
                  query={"esa_worldcover:product_version": {"eq": "2.0.0"}})


# ---------------------------------------------------------------- medidas (igual que el visor)

def patch_metrics(z: np.ndarray, land: np.ndarray | None = None) -> dict[str, float]:
    """Medidas del visor, opcionalmente limitadas a celdas terrestres."""
    elevation = z.astype("float64")
    y, x = np.gradient(elevation, CELL)
    slope = np.rad2deg(np.arctan(np.hypot(x, y)))[1:-1, 1:-1]
    if land is not None:
        # Una pendiente necesita el centro y los cuatro vecinos del gradiente.
        stencil = land[1:-1, 1:-1] & land[:-2, 1:-1] & land[2:, 1:-1] & land[1:-1, :-2] & land[1:-1, 2:]
        slope = slope[stencil]
        elevation = elevation[land]
    median_slope, steep_slope = np.percentile(slope, [50, 90])
    low, median_elevation, high = np.percentile(elevation, [5, 50, 95])
    return dict(medianSlope=float(median_slope), steepSlope=float(steep_slope),
                medianElevation=float(median_elevation), relief=float(high - low))


def cover_fractions(classes: np.ndarray, lat: float) -> dict[str, float] | None:
    valid = np.isfinite(classes) & (classes > 0)
    if valid.mean() < 0.5:
        # ESA WorldCover no cubre la Antártida: allí suponemos hielo con algo de roca.
        return {"bare": 0.1, "snow_ice": 0.9, "moss_lichen": 0.0, "vegetation": 0.0,
                "water": 0.0, "built": 0.0, "assumed": True} if lat < -60 else None
    c = classes[valid].astype(int)
    out = {k: 0.0 for k in COVER_KEYS}
    for code, name in WC_CLASSES.items():
        out[name] += float((c == code).mean())
    return {k: round(v, 3) for k, v in out.items()}


# ---------------------------------------------------------------- puntuación (igual que src/data.ts)

TERRAIN_KEYS = ("medianSlope", "steepSlope", "relief")


def terrain_similarity(a: dict, b: dict) -> float:
    d = 0.0
    for k in TERRAIN_KEYS:
        total = a[k] + b[k]
        d += 0 if total == 0 else abs(a[k] - b[k]) / total
    return 1 - d / len(TERRAIN_KEYS)


def surface_score(cover: dict | None, category: str) -> float:
    if cover is None:
        return 0.0
    if category == ICE_CATEGORY:
        return min(1.0, cover["snow_ice"] + 0.6 * cover["bare"] + 0.3 * cover["moss_lichen"])
    return min(1.0, cover["bare"] + 0.6 * cover["snow_ice"] + 0.3 * cover["moss_lichen"])


def climate_score(parts: dict | None) -> float:
    return 0.0 if parts is None else sum(MARS_CLIMATE_W[k] * parts[k] for k in MARS_CLIMATE_W)


def total_score(mars: dict, earth: dict) -> float:
    return (W_TERRAIN * terrain_similarity(mars["metrics"], earth["metrics"])
            + W_SURFACE * surface_score(earth.get("cover"), mars["category"])
            + W_CLIMATE * climate_score(earth.get("climateParts")))


# ---------------------------------------------------------------- 1. regiones

def load_windows() -> list[dict]:
    out = []
    for f in sorted((DATA / "earth").glob("band_*.json")):
        out.extend(json.loads(f.read_text(encoding="utf-8")))
    return out


def pick_regions(windows: list[dict]) -> list[dict]:
    dry, ice = [], []
    for w in windows:
        c = w["cover"]
        if c is None:
            if w["lat"] < -60:
                ice.append((1.0, w))
            continue
        if c["bare"] >= 0.8:
            dry.append((c["bare"], w))
        elif c["snow_ice"] >= 0.5:
            ice.append((c["snow_ice"], w))

    chosen: list[dict] = []
    rng = np.random.default_rng(23)

    def take(pool, bins, per_bin, kind):
        relief = np.log1p([w["features"]["relief"] for _, w in pool])
        edges = np.quantile(relief, np.linspace(0, 1, bins + 1))
        for b in range(bins):
            members = [(s, w) for (s, w), r in zip(pool, relief)
                       if edges[b] <= r <= edges[b + 1]]
            # Muchas ventanas empatan con suelo 100 % desnudo: desempata al azar (semilla fija)
            # para no quedarnos solo con la primera banda de latitud del Sahara.
            rng.shuffle(members)
            members.sort(key=lambda sw: -round(sw[0], 1))
            n = 0
            for _, w in members:
                if n >= per_bin:
                    break
                if chosen and haversine_km(w["lat"], w["lon"], [c["lat"] for c in chosen],
                                           [c["lon"] for c in chosen]).min() < REGION_SPACING_KM:
                    continue
                chosen.append({"lat": w["lat"], "lon": w["lon"], "kind": kind, "bin": b})
                n += 1

    take(dry, DRY_BINS, DRY_PER_BIN, "dry")
    take(ice, ICE_BINS, ICE_PER_BIN, "ice")
    for i, r in enumerate(chosen):
        r["id"] = f"g{i:03d}"
    return chosen


# ---------------------------------------------------------------- 2. parches por región

def process_region(region: dict) -> dict | None:
    cache = CACHE / f"{region['id']}.npz"
    meta_file = cache.with_suffix(".json")
    if meta_file.exists():
        return json.loads(meta_file.read_text(encoding="utf-8"))
    n = GRID * PATCHES_PER_SIDE
    la, lo = local_grid(region["lat"], region["lon"], n, CELL)
    for attempt in range(3):
        try:
            dem = read_dem(la, lo)
            cov = read_cover(la, lo)
            break
        except Exception as exc:  # errores de red
            print(f"{region['id']}: {exc!r}, reintento {attempt + 1}", flush=True)
            time.sleep(5)
    else:
        return None

    grids, patches = [], []
    for i in range(PATCHES_PER_SIDE):
        for j in range(PATCHES_PER_SIDE):
            sl = np.s_[i * GRID:(i + 1) * GRID, j * GRID:(j + 1) * GRID]
            z = dem[sl]
            if not np.isfinite(z).all():
                continue
            gy, gx = np.gradient(z, CELL)
            if (np.hypot(gx, gy) == 0).mean() > 0.3:   # agua aplanada en el DEM
                continue
            plat, plon = float(la[sl][GRID // 2, GRID // 2]), float(lo[sl][GRID // 2, GRID // 2])
            cover = cover_fractions(cov[sl], plat)
            if cover is None or cover["water"] > 0.1 or cover["built"] > 0.05:
                continue
            patches.append({"key": f"{i}{j}", "lat": round(plat, 5), "lon": round(plon, 5),
                            "metrics": patch_metrics(z), "cover": cover, "index": len(grids)})
            grids.append(z.astype("<f4"))
    CACHE.mkdir(parents=True, exist_ok=True)
    np.savez_compressed(cache, grids=np.array(grids) if grids else np.zeros((0, GRID, GRID), "<f4"))
    meta = {**region, "patches": patches}
    meta_file.write_text(json.dumps(meta), encoding="utf-8")
    return meta


# ---------------------------------------------------------------- nombres de lugar

def place_name(lat: float, lon: float, cache: dict) -> str:
    key = f"{lat:.2f},{lon:.2f}"
    if key not in cache:
        time.sleep(1.1)  # política de uso de Nominatim: 1 consulta por segundo
        try:
            r = requests.get("https://nominatim.openstreetmap.org/reverse",
                             params={"format": "jsonv2", "lat": lat, "lon": lon, "zoom": 8,
                                     "accept-language": "en"},
                             headers={"User-Agent": "terrain-analogs-hackathon/0.1"}, timeout=30)
            a = r.json().get("address", {}) if r.ok else {}
        except requests.RequestException:
            a = {}
        local = a.get("county") or a.get("state_district") or a.get("state") or a.get("region")
        country = a.get("country")
        if lat < -60 and not country:
            country = "Antarctica"
        cache[key] = ", ".join(p for p in (local, country) if p) or ""
        PLACES.write_text(json.dumps(cache, ensure_ascii=False, indent=1), encoding="utf-8")
    return cache[key]


def known_analog(lat: float, lon: float) -> str | None:
    """Mismo criterio que rank.py: radio propio de cada análogo conocido (+ Antártida)."""
    return known_name(lat, lon)


def climate_fields(c: dict) -> tuple[dict, dict]:
    parts = climate_scores(c)
    return ({k: round(c[k], 1) for k in ("t_mean", "t_min", "t_max", "diurnal_range", "precip_year")},
            {k: round(v, 3) for k, v in parts.items()})


# ---------------------------------------------------------------- principal

def main() -> None:
    args = sys.argv[1:]
    no_climate = "--no-climate" in args
    limit = int(args[args.index("--regions") + 1]) if "--regions" in args else None
    test = no_climate or limit is not None
    catalog_out = TEST_DIR / "catalog.json" if test else CATALOG
    terrain_out = TEST_DIR / "terrain" if test else TERRAIN_DIR
    terrain_out.mkdir(parents=True, exist_ok=True)
    if test:
        print(f"Modo prueba: la salida va a {TEST_DIR} (la app no se toca)", flush=True)

    catalog = [s for s in json.loads(CATALOG.read_text(encoding="utf-8")) if s.get("origin") != "global"]
    mars = [s for s in catalog if s["planet"] == "Mars"]
    curated = [s for s in catalog if s["planet"] == "Earth"]

    regions = pick_regions(load_windows())
    if limit:
        regions = regions[:limit]
    print(f"{len(regions)} regiones ({sum(r['kind'] == 'ice' for r in regions)} de hielo)", flush=True)

    done = 0

    def job(r):
        nonlocal done
        meta = process_region(r)
        done += 1
        if meta:
            print(f"[{done}/{len(regions)}] {r['id']} {r['lat']:8.3f} {r['lon']:9.3f}: "
                  f"{len(meta['patches'])} parches", flush=True)
        return meta

    with ThreadPoolExecutor(6) as ex:
        metas = [m for m in ex.map(job, regions) if m and m["patches"]]

    # Sitios curados: cobertura del parche de 2 km (se reutiliza si ya está en el catálogo)
    for s in curated:
        if "cover" not in s:
            la, lo = local_grid(s["latitude"], s["longitude"], GRID, CELL)
            s["cover"] = cover_fractions(read_cover(la, lo), s["latitude"])
        s["origin"] = "curated"

    # Clima: un punto por región + uno por sitio curado
    points = [(m["lat"], m["lon"]) for m in metas] + [(s["latitude"], s["longitude"]) for s in curated]
    if no_climate:
        clim = {}
    else:
        clim = fetch(points)
    key = lambda la, lo: f"{la:.4f},{lo:.4f}"
    for m in metas:
        c = clim.get(key(m["lat"], m["lon"]))
        m["climate"], m["climateParts"] = climate_fields(c) if c else (None, None)
    for s in curated:
        c = clim.get(key(s["latitude"], s["longitude"]))
        s["climate"], s["climateParts"] = climate_fields(c) if c else (None, None)

    pool = [{**p, "region": m["id"], "climate": m["climate"], "climateParts": m["climateParts"]}
            for m in metas for p in m["patches"]]
    print(f"{len(pool)} parches globales", flush=True)

    # Mejores parches globales por sitio de Marte (uno por región)
    selected: dict[str, dict] = {}
    for site in mars:
        scored = sorted(pool, key=lambda p: -total_score(site, p))
        regions_used = set()
        for p in scored:
            if p["region"] in regions_used:
                continue
            regions_used.add(p["region"])
            selected[f"{p['region']}-{p['key']}"] = p
            if len(regions_used) >= TOP_PER_MARS:
                break
    print(f"{len(selected)} parches globales elegidos para {len(mars)} sitios de Marte", flush=True)

    # Exporta
    for old in terrain_out.glob("g[0-9][0-9][0-9]-*.f32"):
        old.unlink()
    places = json.loads(PLACES.read_text(encoding="utf-8")) if PLACES.exists() else {}
    grids_cache: dict[str, np.ndarray] = {}
    out = list(catalog)
    for sid, p in sorted(selected.items()):
        if p["region"] not in grids_cache:
            grids_cache[p["region"]] = np.load(CACHE / f"{p['region']}.npz")["grids"]
        grids_cache[p["region"]][p["index"]].astype("<f4").tofile(terrain_out / f"{sid}.f32")
        place = place_name(p["lat"], p["lon"], places)
        coords = f"{abs(p['lat']):.1f}°{'S' if p['lat'] < 0 else 'N'} {abs(p['lon']):.1f}°{'W' if p['lon'] < 0 else 'E'}"
        if "," not in place:  # solo país (p. ej. "Antarctica"): añade coordenadas para distinguirlos
            place = f"{place} · {coords}" if place else coords
        out.append({
            "id": sid, "planet": "Earth", "origin": "global",
            "name": place,
            "latitude": p["lat"], "longitude": p["lon"],
            "source": "Copernicus DEM GLO-30 · ESA",
            "sourceUrl": "https://planetarycomputer.microsoft.com/dataset/cop-dem-glo-30",
            "category": "Earth", "groups": [],
            "metrics": p["metrics"], "cover": p["cover"],
            "climate": p["climate"], "climateParts": p["climateParts"],
            "knownAnalog": known_analog(p["lat"], p["lon"]),
        })
    for s in curated:
        s["knownAnalog"] = known_analog(s["latitude"], s["longitude"])

    assert len({s["id"] for s in out}) == len(out)
    catalog_out.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Catálogo: {len(mars)} Marte, {len(curated)} curados, {len(selected)} globales -> {catalog_out}")

    # Resumen: ¿cuántos sitios de Marte tienen como mejor candidato uno global?
    wins = 0
    for site in mars:
        eligible = [s for s in out if s["planet"] == "Earth" and
                    (s["origin"] == "global" or site["category"] in s.get("groups", []))]
        best = max(eligible, key=lambda e: total_score(site, e))
        wins += best["origin"] == "global"
    print(f"Mejor candidato global en {wins}/{len(mars)} sitios de Marte")


if __name__ == "__main__":
    main()
