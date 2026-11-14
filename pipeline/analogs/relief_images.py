"""Imágenes de relieve para comparar cada sitio de la Tierra con su referencia de la Luna o Marte,
con la regla de escala de PLAN_v2 §3: en cada comparación, la Tierra y la Luna o Marte con la MISMA
ventana y el MISMO píxel, y el píxel nunca más fino que el dato más grueso de los dos.

| Nivel | Luna ↔ Tierra                 | Marte ↔ Tierra                                    |
|-------|-------------------------------|---------------------------------------------------|
| L0    | 30 km a 120 m (GLO-90)        | 30 km a 200 m (GLO-90)                            |
| L1    | 10 km a 120 m (GLO-90)        | 10 km a 200 m (GLO-90)                            |
| L2    | 5 km a 60 m (GLO-30)          | 2 km a 30 m (GLO-30 frente al parche HiRISE)      |

Luna: LOLA 40 m de Barker et al. 2023 en el polo sur (dem_io.sample_moon) y SLDEM2015 (59 m) fuera del polo. Marte L0/L1: blend HRSC+MOLA 200 m
(dem_io.sample_mars). Marte L2: parche HiRISE del visor (public/terrain/<id>.f32, 100×100 a 20 m,
fila 0 = norte) remuestreado a 30 m (67 px). Tierra: dem_io.sample_earth. Mismo sombreado para
todos (sol desde el noroeste a 45°, gradiente con el píxel real). Las imágenes pequeñas
(50–83 px) se guardan tal cual; la app las escala.

Nombres (nuevos; no pisan los de v1, ref_<id>.png y e_<lat>_<lon>.png):
  ref_<id>_<nivel>.png                      referencia (nivel L0|L1|L2; en Marte L2, id = parche HiRISE)
  e_<lat:.4f>_<lon:.4f>_<nivel>_<px>m.png   ventana terrestre centrada en (lat, lon); px = 120|200|60|30

Entrada: un results.json v2 (PLAN_v2 §6). Se lee a la defensiva; lo que falta se salta:
  references                   referencias L0 {id, body, lat, lon}: se generan todas a L0.
  reference_points             referencias L1/L2 [id, body, level, group, lat, lon, usable],
                               o registros {id, body, level, lat, lon} (lista o dict por id).
                               Si falta un id, se busca en data/references_v2.json y, como último
                               recurso, en otro nivel (mismo centro, ventana del nivel pedido).
  bodies[b].sites, .twins[ref] sitios L0 {lat, lon, best_ref} (en twins, best_ref = la clave).
  bodies[b].fine.sites / .twins[ref] / .final
                               sitios {lat, lon, level ("L1"|"L2"|1|2), best_ref}. Ventana L2 elegida:
                               subdict "l2" | "L2" | "window" | "l2_window" | "window_l2" |
                               "best_window" con {lat, lon[, best_ref]}; o "levels": {"L1": {...},
                               "L2": {...}}. En Marte L2 el best_ref es un parche HiRISE (también
                               se aceptan "best_patch", "best_hirise" o "hirise").

Ejecutar desde pipeline/ (después de rank):
  python -m analogs.relief_images [--results RUTA] [--out DIR] [--threads N] [--dry-run]
Por defecto lee ../src/data/results.json y escribe en ../public/relieve/ (Vite lo sirve en
/relieve/). Solo crea las que faltan. Hilos ≤ 6.
"""

from __future__ import annotations

import argparse
import json
import math
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

from . import dem_io
from .references import MARS_DEM, MARS_R, MOON_DEM, MOON_R
from .terrain import sample_planet_dem

ROOT = Path(__file__).resolve().parent.parent       # pipeline/
PROJECT = ROOT.parent
RESULTS = PROJECT / "src" / "data" / "results.json"
REFS_V2 = ROOT / "data" / "references_v2.json"
TERRAIN = PROJECT / "public" / "terrain"
IMG = PROJECT / "public" / "relieve"
MAX_THREADS = 6

# (cuerpo, nivel) -> (ventana en km, píxel en m); la Tierra usa la misma pareja.
SCALES = {("moon", "L0"): (30.0, 120.0), ("mars", "L0"): (30.0, 200.0),
          ("moon", "L1"): (10.0, 120.0), ("mars", "L1"): (10.0, 200.0),
          ("moon", "L2"): (5.0, 60.0), ("mars", "L2"): (2.0, 30.0)}
EARTH_COLLECTION = {"L0": "cop-dem-glo-90", "L1": "cop-dem-glo-90", "L2": "cop-dem-glo-30"}
HIRISE_N, HIRISE_CELL = 100, 20.0                     # parches del visor (patches.GRID, CELL)
MAX_NAN = 0.5                                         # más huecos que esto: no se dibuja

L2_KEYS = ("l2", "L2", "window", "l2_window", "window_l2", "best_window")
HIRISE_KEYS = ("best_patch", "best_hirise", "hirise")


def ref_name(rid: str, level: str) -> str:
    return f"ref_{rid}_{level}.png"


def earth_name(lat: float, lon: float, level: str, px: float) -> str:
    return f"e_{lat:.4f}_{lon:.4f}_{level}_{px:.0f}m.png"


# ---------------------------------------------------------------- sombreado

def hillshade(z: np.ndarray, px: float, azimuth: float = 315, altitude: float = 45) -> np.ndarray:
    gy, gx = np.gradient(z, px)          # filas crecen hacia el sur
    dz_de, dz_dn = gx, -gy
    a, h = math.radians(azimuth), math.radians(altitude)
    light = np.array([math.sin(a) * math.cos(h), math.cos(a) * math.cos(h), math.sin(h)])
    nx, ny, nz = -dz_de, -dz_dn, np.ones_like(z)
    norm = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    return np.clip((nx * light[0] + ny * light[1] + nz * light[2]) / norm, 0, 1)


def render(z: np.ndarray, px: float, path: Path) -> bool:
    """Guarda el relieve sombreado de z (malla de `px` m) en `path`; False si casi no hay dato."""
    nan = np.isnan(z)
    if nan.mean() > MAX_NAN:
        return False
    if nan.any():
        idx = ndimage.distance_transform_edt(nan, return_distances=False, return_indices=True)
        z = z[tuple(idx)]
    z = z.astype("float64")
    hs = hillshade(z, px)
    lo, hi = np.percentile(z, [2, 98])
    elev = np.clip((z - lo) / max(hi - lo, 1), 0, 1)
    v = 0.78 * hs + 0.22 * elev
    img = (np.clip(v, 0, 1) * 255).astype("uint8")
    tmp = path.with_name(path.stem + ".tmp.png")
    Image.fromarray(img, mode="L").save(tmp, optimize=True)
    tmp.replace(path)
    return True


# ---------------------------------------------------------------- lectura

def sample_hirise(pid: str, window_km: float = 2.0, px: float = 30.0) -> np.ndarray | None:
    """Parche HiRISE del visor (100×100 a 20 m) remuestreado a `px` m como dem_io: media de
    sup×sup subpuntos bilineales. Devuelve None si no existe el .f32."""
    path = TERRAIN / f"{pid}.f32"
    if not path.exists():
        return None
    g = np.fromfile(path, "<f4")
    if g.size != HIRISE_N ** 2:
        return None
    g = g.reshape(HIRISE_N, HIRISE_N).astype("float64")
    n = int(round(window_km * 1000 / px))
    sup = max(1, math.ceil(px / HIRISE_CELL - 1e-6))
    m = n * sup
    off = (np.arange(m) - (m - 1) / 2) * (px / sup)            # m desde el centro
    idx = off / HIRISE_CELL + (HIRISE_N - 1) / 2               # fila/columna de la malla de 20 m
    rr, cc = np.meshgrid(idx, idx, indexing="ij")              # fila 0 = norte, como el .f32
    v = ndimage.map_coordinates(g, [rr, cc], order=1, mode="nearest")
    return v.reshape(n, sup, n, sup).mean(axis=(1, 3)).astype("float32")


def sample_ref(body: str, level: str, rid: str, lat: float | None, lon: float | None) -> np.ndarray | None:
    win, px = SCALES[(body, level)]
    if body == "moon":
        # Polo sur (80–90°S): LOLA PGDA 40 m. Fuera del polo (60°S–60°N): SLDEM2015 (59 m).
        if lat > -60:
            return dem_io.sample_moon_sldem(lat, lon, win, px)
        return dem_io.sample_moon(lat, lon, win, px)
    if level == "L2":
        return sample_hirise(rid, win, px)
    return dem_io.sample_mars(lat, lon, win, px, source="blend")


def sample_earth_level(body: str, level: str, lat: float, lon: float) -> np.ndarray:
    win, px = SCALES[(body, level)]
    return dem_io.sample_earth(lat, lon, win, px, collection=EARTH_COLLECTION[level])


# ---------------------------------------------------------------- lectura del results.json

def _level(v) -> str | None:
    s = str(v).upper().lstrip("L") if v is not None else ""
    return f"L{s}" if s in ("0", "1", "2") else None


def _latlon(d) -> tuple[float, float] | None:
    if isinstance(d, dict) and isinstance(d.get("lat"), (int, float)) and isinstance(d.get("lon"), (int, float)):
        return float(d["lat"]), float(d["lon"])
    return None


def _entries(obj, hint: str | None = None):
    """Recorre listas y dicts (p. ej. twins: {ref: [sitios]}) -> (sitio, clave de referencia)."""
    if isinstance(obj, list):
        for x in obj:
            yield from _entries(x, hint)
    elif isinstance(obj, dict):
        if _latlon(obj):
            yield obj, hint
        else:
            for k, v in obj.items():
                if isinstance(v, (list, dict)):
                    yield from _entries(v, k)


def _ref_index(res: dict) -> dict[tuple[str, str], dict]:
    """(id, nivel) -> {id, body, level, lat, lon}: references (L0), reference_points y references_v2.json."""
    idx: dict[tuple[str, str], dict] = {}

    def add(r, default_level):
        if not isinstance(r, dict) or not r.get("id") or not _latlon(r):
            return
        lv = _level(r.get("level")) or default_level
        idx.setdefault((r["id"], lv), {"id": r["id"], "body": r.get("body"), "level": lv,
                                       "lat": float(r["lat"]), "lon": float(r["lon"])})
    for r in res.get("references") or []:
        add(r, "L0")
    pts = res.get("reference_points") or []
    if isinstance(pts, dict):
        pts = [dict(v, id=v.get("id", k)) for k, v in pts.items() if isinstance(v, dict)]
    for r in pts:
        if isinstance(r, list) and len(r) >= 6:
            rid, body, level, _, lat, lon = r[:6]
            r = dict(id=rid, body=body, level=level, lat=lat, lon=lon)
        add(r, "L1")
    if REFS_V2.exists():
        try:
            for r in json.loads(REFS_V2.read_text(encoding="utf-8")):
                add(r, "L0")
        except (ValueError, TypeError) as exc:
            print(f"aviso: no se pudo leer {REFS_V2.name}: {exc}", flush=True)
    return idx


def _find_ref(idx: dict, rid: str, level: str, body: str) -> dict | None:
    r = idx.get((rid, level))
    if r is None:  # mismo centro en otro nivel
        r = next((idx[(rid, lv)] for lv in ("L1", "L0", "L2") if (rid, lv) in idx), None)
    if r is None or (r.get("body") and r["body"] != body):
        return None
    return r


def _fine_windows(site: dict, hint: str | None):
    """Ventanas (nivel, lat, lon, best_ref, parche HiRISE) de un sitio del nivel fino."""
    ref = site.get("best_ref") or hint
    hir = next((site[k] for k in HIRISE_KEYS if isinstance(site.get(k), str)), None)
    levels = site.get("levels")
    if isinstance(levels, dict):
        for k, sub in levels.items():
            lv, ll = _level(k), _latlon(sub)
            if lv and ll:
                yield lv, *ll, sub.get("best_ref") or ref, next(
                    (sub[h] for h in HIRISE_KEYS if isinstance(sub.get(h), str)), hir)
    lv = _level(site.get("level"))
    if lv is None:
        return
    ll = _latlon(site)
    if lv == "L2":
        sub = next((site[k] for k in L2_KEYS if _latlon(site.get(k))), None)
        if sub is not None:
            yield "L2", *_latlon(sub), sub.get("best_ref") or ref, next(
                (sub[h] for h in HIRISE_KEYS if isinstance(sub.get(h), str)), hir)
            return
    yield lv, *ll, ref, hir


def plan_jobs(res: dict, out: Path, legacy: bool = False) -> tuple[list[dict], list[str]]:
    """Lista de imágenes a generar (sin las que ya existen) y avisos."""
    idx = _ref_index(res)
    jobs: dict[str, dict] = {}
    warn: list[str] = []

    def want_ref(body, level, rid):
        name = f"ref_{rid}.png" if legacy else ref_name(rid, level)
        if name in jobs:
            return
        if body == "mars" and level == "L2":
            patch = rid.removeprefix("hirise_")
            if not (TERRAIN / f"{patch}.f32").exists():
                warn.append(f"Marte L2: no hay parche HiRISE {rid}.f32")
                return
            jobs[name] = dict(kind="ref", body=body, level=level, id=patch, lat=None, lon=None, name=name)
            return
        r = _find_ref(idx, rid, level, body)
        if r is None:
            warn.append(f"referencia {rid} ({body} {level}) sin coordenadas en el results.json")
            return
        jobs[name] = dict(kind="ref", body=body, level=level, id=rid, lat=r["lat"], lon=r["lon"], name=name)

    def want_site(body, level, lat, lon, rid):
        if (body, level) not in SCALES:
            return
        px = SCALES[(body, level)][1]
        name = f"e_{lat:.4f}_{lon:.4f}.png" if legacy else earth_name(lat, lon, level, px)
        jobs.setdefault(name, dict(kind="earth", body=body, level=level, lat=lat, lon=lon, name=name))
        if rid:
            want_ref(body, level, rid)
        else:
            warn.append(f"sitio ({lat:.4f}, {lon:.4f}) {body} {level} sin best_ref")

    for r in res.get("references") or []:
        if isinstance(r, dict) and r.get("id") and r.get("body") in ("moon", "mars") and _latlon(r):
            want_ref(r["body"], "L0", r["id"])

    for body, B in (res.get("bodies") or {}).items():
        if body not in ("moon", "mars") or not isinstance(B, dict):
            continue
        for key in ("sites", "twins"):
            for s, hint in _entries(B.get(key)):
                want_site(body, "L0", *_latlon(s), s.get("best_ref") or hint)
        fine = B.get("fine")
        if legacy or not isinstance(fine, dict):
            continue
        for key in ("sites", "twins", "final"):
            for s, hint in _entries(fine.get(key)):
                for lv, lat, lon, rid, hir in _fine_windows(s, hint):
                    if body == "mars" and lv == "L2":
                        rid = hir or rid
                    want_site(body, lv, lat, lon, rid)

    todo = [j for j in jobs.values() if not (out / j["name"]).exists()]
    return todo, sorted(set(warn))


# ---------------------------------------------------------------- principal

def run_job(j: dict, out: Path, legacy: bool = False) -> tuple[dict, str, float]:
    t = time.time()
    try:
        if legacy:
            px = 100
            if j["kind"] == "ref":
                url, radius = (MOON_DEM, MOON_R) if j["body"] == "moon" else (MARS_DEM, MARS_R)
                z = sample_planet_dem(url, radius, j["lat"], j["lon"], window_km=30, px=px, sup=1)
            else:
                z = dem_io.sample_earth(j["lat"], j["lon"], 30, px)
        else:
            px = SCALES[(j["body"], j["level"])][1]
            if j["kind"] == "ref":
                z = sample_ref(j["body"], j["level"], j["id"], j["lat"], j["lon"])
            else:
                z = sample_earth_level(j["body"], j["level"], j["lat"], j["lon"])
        if z is None:
            msg = "sin dato"
        elif render(z, px, out / j["name"]):
            msg = f"{z.shape[0]}×{z.shape[1]} px, NaN {np.isnan(z).mean():.3f}"
        else:
            msg = f"sin dato (NaN {np.isnan(z).mean():.2f})"
    except Exception as exc:  # una imagen fallida no para las demás
        msg = f"ERROR {exc!r}"
    return j, msg, time.time() - t


def main() -> None:
    ap = argparse.ArgumentParser(description="Imágenes de relieve a la misma escala (v2).")
    ap.add_argument("--results", type=Path, default=RESULTS)
    ap.add_argument("--out", type=Path, default=IMG)
    ap.add_argument("--threads", type=int, default=MAX_THREADS)
    ap.add_argument("--dry-run", action="store_true", help="solo lista lo que falta")
    ap.add_argument("--legacy", action="store_true", help="genera los PNG de 30 km usados por el mapa publicado")
    a = ap.parse_args()
    threads = max(1, min(MAX_THREADS, a.threads))
    dem_io.set_max_per_server(threads)

    res = json.loads(a.results.read_text(encoding="utf-8"))
    a.out.mkdir(parents=True, exist_ok=True)
    todo, warn = plan_jobs(res, a.out, a.legacy)
    for w in warn:
        print("aviso:", w, flush=True)
    print(f"{len(todo)} imágenes por generar en {a.out} ({threads} hilos)", flush=True)
    if a.dry_run:
        for j in todo:
            print(" ", j["name"], flush=True)
        return

    # Primero las referencias L0 de Marte: su recorte en caché (30 km + 10 km de margen) cubre
    # luego las teselas L1 del mismo sitio y evita leer dos veces la misma zona del USGS.
    first = [j for j in todo if j["kind"] == "ref" and j["body"] == "mars" and j["level"] == "L0"]
    rest = [j for j in todo if j not in first]
    t0, fails, k = time.time(), 0, 0
    with ThreadPoolExecutor(threads) as ex:
        for phase in (first, rest):
            for j, msg, dt in ex.map(lambda j: run_job(j, a.out, a.legacy), phase):
                k += 1
                fails += not msg[0].isdigit()
                print(f"{k}/{len(todo)} {j['name']}: {msg} ({dt:.1f} s)", flush=True)
    print(f"hecho en {time.time() - t0:.0f} s; {fails} sin imagen", flush=True)


if __name__ == "__main__":
    main()
