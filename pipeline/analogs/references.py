"""Referencias v2 de la Luna y Marte en tres niveles de escala y sus rasgos de terreno.

Sitios, regiones y mallas: analogs/reference_sites.py (cada uno con su fuente). Lectura de DEM:
analogs/dem_io.py. Escalas (PLAN_v2.md §3): cada nivel usa la misma ventana y el mismo píxel
que la Tierra en ese nivel.

| Nivel | Luna                                   | Marte                                      |
|-------|----------------------------------------|--------------------------------------------|
| L0    | 30 km a 400 m: centros de regiones,    | 30 km a 400 m: los 43 sitios (blend        |
|       | teselas de 30 km de las regiones de    | HRSC+MOLA) con hrsc_check a 40 km          |
|       | > 40 km, sitios y malla polar de 30 km |                                            |
| L1    | 10 km a 120 m: teselas de 10 km de     | 10 km a 200 m: 3×3 teselas de 10 km de los |
|       | cada región + malla polar de 10 km     | sitios que no son "solo_mola"              |
| L2    | 5 km a 60 m: teselas de 5 km (20 km    | 2 km a 30 m: los 116 parches HiRISE del    |
|       | centrales) de las regiones de 2024     | visor (src/data/catalog.json)              |

Luna: LOLA 40 m de Barker et al. 2023 (caché local) y su capa EFFRES; una ventana no es usable si
la mediana de la resolución efectiva es peor que el píxel del nivel. Marte: usable=False en L1 si
la tesela es "solo_mola" (a 200 m sería más fina que el dato).
Los rasgos de forma (terrain.SHAPE_FEATURES) se calculan en L1 y L2.

Cada ventana calculada se guarda en data/cache/refs_v2/ y se reutiliza (se puede interrumpir y
reanudar). data/references.json (v1) no se toca.

Ejecutar desde pipeline/:
  python -m analogs.references                       # todo -> data/references_v2.json
  python -m analogs.references --solo luna --limite 5 --salida <ruta>   # prueba
Opciones: --solo luna|marte|hirise (repetible), --limite N (primeras N ventanas por cuerpo y
nivel), --hilos K (lecturas simultáneas por servidor, ≤ 8), --salida RUTA.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import threading
import time
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np

from . import dem_io
from .reference_sites import (MARS_R_KM, MARS_SITES, MOON_NONPOLAR_SITES, MOON_R_KM, MOON_REGIONS, MOON_SITES,
                              haversine_km, mars_site_tiles, moon_polar_grid, moon_site_tiles, region_tiles,
                              regions_containing)
from .terrain import FEATURES, SHAPE_FEATURES, shape_features, terrain_features

# Constantes de la v1 (las usan relief_images, moon_pole y la autoprueba de dem_io).
MOON_DEM = "https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif"
MOON_R = 1_737_400.0
MARS_DEM = "https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif"
MARS_R = 3_396_190.0

PIPE = Path(__file__).resolve().parent.parent
DATA = PIPE / "data"
OUT = DATA / "references_v2.json"
CACHE = DATA / "cache" / "refs_v2"
CATALOG = PIPE.parent / "src" / "data" / "catalog.json"
TERRAIN = PIPE.parent / "public" / "terrain"

# (ventana km, píxel m) por cuerpo y nivel
SCALES = {("moon", "L0"): (30, 400), ("moon", "L1"): (10, 120), ("moon", "L2"): (5, 60),
          ("mars", "L0"): (30, 400), ("mars", "L1"): (10, 200), ("mars", "L2"): (2, 30)}
BIG_REGION_KM = 40        # regiones mayores: también teselas de 30 km en L0
L2_MAX_EXTENT_KM = 20     # L2 de la Luna: solo el cuadrado central de 20 km de cada región
PARENT_KM = 32            # padre L0 de una ventana L1/L2: el centro L0 más cercano a < 32 km (malla L0 de 30 km: hasta ~21 km dentro y algo más en el borde de 84°S)
HIRISE_PARENT_KM = 100    # padre de un parche HiRISE: sitio de Marte a < 100 km
HIRISE_N, HIRISE_PX = 100, 20.0
MOON_THREADS = 4          # la Luna se lee del disco: no cuenta para el límite por servidor
CACHE_VERSION = 1

GRID_NOTE = ("malla regular generada en la azimutal polar sur (reference_sites.moon_polar_grid); "
             "no es un sitio publicado")


# ---------------------------------------------------------------- utilidades

def _clean(v):
    """Redondea a 5 cifras significativas y cambia NaN/inf por None (JSON válido)."""
    if isinstance(v, dict):
        return {k: _clean(x) for k, x in v.items()}
    if isinstance(v, (list, tuple)):
        return [_clean(x) for x in v]
    if isinstance(v, (float, np.floating)):
        v = float(v)
        return float(f"{v:.5g}") if math.isfinite(v) else None
    if isinstance(v, np.integer):
        return int(v)
    return v


def _cache_path(spec: dict) -> Path:
    return CACHE / f"{spec['body']}_{spec['level']}_{spec['id']}.json"


def _cache_key(spec: dict) -> list:
    return [CACHE_VERSION, spec["lat"], spec["lon"], spec["window_km"], spec["px_m"]]


def _cached(spec: dict) -> dict | None:
    p = _cache_path(spec)
    if not p.exists():
        return None
    try:
        d = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return d["values"] if d.get("key") == _cache_key(spec) else None


def _save(spec: dict, values: dict) -> None:
    p = _cache_path(spec)
    p.parent.mkdir(parents=True, exist_ok=True)
    tmp = p.with_name(f"{p.stem}.{os.getpid()}_{threading.get_ident()}.tmp")
    tmp.write_text(json.dumps({"key": _cache_key(spec), "values": _clean(values)}, ensure_ascii=False),
                   encoding="utf-8")
    os.replace(tmp, p)


def _spec(body: str, level: str, rid: str, group: str, region, name: str, lat: float, lon: float,
          kind: str, source_url, source_note: str, coord_quality: str, **extra) -> dict:
    w, px = SCALES[(body, level)]
    return dict(id=rid, body=body, level=level, group=group, region=region, name=name,
                lat=round(float(lat), 6), lon=round(float(lon), 6), kind=kind, parent=None,
                window_km=w, px_m=px, source_url=source_url, source_note=source_note,
                coord_quality=coord_quality, **extra)


def _feats(z: np.ndarray, px: float, shape: bool) -> dict:
    f = terrain_features(z, px)
    s = shape_features(z, px) if shape else None
    return {"features": f, "shape": s, "elev_mean": float(np.nanmean(z)) if np.isfinite(z).any() else None,
            "nan_frac": float(np.isnan(z).mean())}


# ---------------------------------------------------------------- Luna

def _region_tile_spec(level: str, r: dict, t: dict, k: int, spacing: float) -> dict:
    nota = (f"{t['source']} (tesela {k}, {t['east_km']:+.1f} km E, {t['north_km']:+.1f} km N del centro de "
            f"la región). Hereda la fuente de la región {r['id']}: {r['source_note']}")
    return _spec("moon", level, t["id"], r["group"], r["id"], f"{r['name']} · tesela {k} de {spacing:g} km",
                 t["lat"], t["lon"], "region_tesela", r["source_url"], nota, r["coord_quality"])


def _grid_spec(level: str, p: dict) -> dict:
    regs = ", ".join(p["regions"]) if p["regions"] else "ninguna"
    nota = f"{p['source']}: {GRID_NOTE}. Regiones que contienen el punto: {regs}."
    return _spec("moon", level, p["id"], "malla_polar", p["region"],
                 f"Malla polar {p['spacing_km']:g} km ({p['x_km']:+.0f}, {p['y_km']:+.0f} km)",
                 p["lat"], p["lon"], "malla", None, nota, "malla_generada")


def moon_specs() -> list[dict]:
    """Todas las ventanas de la Luna (L0, L1, L2) sin calcular."""
    out = []
    # L0: centros de región, teselas de 30 km de las regiones grandes, sitios y malla de 30 km
    for r in MOON_REGIONS:
        out.append(_spec("moon", "L0", r["id"], r["group"], r["id"], r["name"], r["lat"], r["lon"],
                         "region_centro", r["source_url"], r["source_note"], r["coord_quality"]))
        if r["bounds"] and r["extent_km"] > BIG_REGION_KM:
            for k, t in enumerate(region_tiles(r, 30)):
                out.append(_region_tile_spec("L0", r, t, k, 30))
    for s in MOON_SITES:
        if s.get("same_as_region"):  # mismo punto que una región: ya está como region_centro
            continue
        regs = regions_containing(s["lat"], s["lon"])
        out.append(_spec("moon", "L0", s["id"], s["group"], regs[0] if regs else None, s["name"],
                         s["lat"], s["lon"], "sitio", s["source_url"], s["source_note"], s["coord_quality"]))
    out += [_grid_spec("L0", p) for p in moon_polar_grid(30)]
    # L1: teselas de 10 km de todas las regiones + malla de 10 km
    for r in MOON_REGIONS:
        out += [_region_tile_spec("L1", r, t, k, 10) for k, t in enumerate(region_tiles(r, 10))]
    out += [_grid_spec("L1", p) for p in moon_polar_grid(10)]
    # L2: teselas de 5 km de los 20 km centrales de las regiones de 2024
    for r in MOON_REGIONS:
        if r["group"] == "artemis_2024":
            ts = region_tiles(r, 5, max_extent_km=L2_MAX_EXTENT_KM)
            out += [_region_tile_spec("L2", r, t, k, 5) for k, t in enumerate(ts)]
    return out


def moon_values(spec: dict) -> dict:
    w, px = spec["window_km"], spec["px_m"]
    z = dem_io.sample_moon(spec["lat"], spec["lon"], w, px)
    v = _feats(z, px, spec["level"] != "L0")
    eff = dem_io.moon_effres(spec["lat"], spec["lon"], w)
    v["quality"] = {"effres_p50": eff["p50"], "effres_p90": eff["p90"]}
    return v


def moon_usable(spec: dict, v: dict) -> tuple[bool, str]:
    notas = []
    if v["features"] is None:
        return False, f"más del 10 % de la ventana sin dato ({v['nan_frac']:.0%})"
    q, px = v["quality"], spec["px_m"]
    p50, p90 = q["effres_p50"], q["effres_p90"]
    if p50 is None:
        return False, "sin dato de resolución efectiva (EFFRES)"
    ok = p50 <= px
    if not ok:
        notas.append(f"resolución efectiva LOLA p50 = {p50:g} m, peor que el píxel de {px:g} m")
    elif p90 is not None and p90 > px:
        notas.append(f"p90 de la resolución efectiva ({p90:g} m) peor que el píxel ({px:g} m) en parte de la ventana")
    cq = spec["coord_quality"]
    if "no_verificada" in cq or cq.startswith("punto_") or cq.startswith("lat_gsfc"):
        notas.append(f"posición no verificada ({cq})")
    return ok, "; ".join(notas)


# ---------------------------------------------------------------- Luna fuera del polo (SLDEM2015)
# Solo gemelos (twin_only): no entran en el ranking ni en la validación del polo sur. L0 (30 km a 400 m)
# y L1 (3×3 teselas de 10 km a 120 m); SLDEM2015 tiene 59 m reales (LOLA + estéreo Kaguya TC).

def _np_spec(level: str, s: dict, t: dict | None = None, k: int | None = None) -> dict:
    extra = dict(subgroup=s["subgroup"], dem="sldem", twin_only=True)
    if t is None:
        return _spec("moon", level, s["id"], s["group"], None, s["name"], s["lat"], s["lon"], "sitio",
                     s["source_url"], s["source_note"], s["coord_quality"], **extra)
    nota = (f"{t['source']} ({t['east_km']:+.0f} km E, {t['north_km']:+.0f} km N del sitio). "
            f"Hereda la fuente del sitio {s['id']}: {s['source_note']}")
    return _spec("moon", level, t["id"], s["group"], None, f"{s['name']} · tesela {k}", t["lat"], t["lon"],
                 "sitio_tesela", s["source_url"], nota, "derivada_de_sitio", **extra)


def sldem_values(spec: dict) -> dict:
    w, px = spec["window_km"], spec["px_m"]
    z = dem_io.sample_moon_sldem(spec["lat"], spec["lon"], w, px)
    v = _feats(z, px, spec["level"] != "L0")
    v["quality"] = {"dem": "SLDEM2015 (LOLA + Kaguya TC)", "dem_px_m": 59.2}
    return v


def compute_moon_np(log) -> tuple[list[dict], dict[str, dict]]:
    """Por sitio (cada lectura usa hasta MAX_PER_SERVER hilos al USGS); las teselas salen del mismo recorte."""
    specs, res, t0 = [], {}, time.time()
    for i, s in enumerate(MOON_NONPOLAR_SITES):
        t = time.time()
        sp = _np_spec("L0", s)
        res[sp["id"]] = _run(sp, sldem_values)
        specs.append(sp)
        for k, tt in enumerate(moon_site_tiles(s, 10, 3)):
            ts = _np_spec("L1", s, tt, k)
            res[ts["id"]] = _run(ts, sldem_values)
            specs.append(ts)
        log(f"  Luna fuera del polo {i + 1:2d}/{len(MOON_NONPOLAR_SITES)} {s['id']:28s} "
            f"({time.time() - t:.1f} s; total {time.time() - t0:.0f} s)")
    return specs, res


# ---------------------------------------------------------------- Marte

def _mars_site_spec(s: dict) -> dict:
    return _spec("mars", "L0", s["id"], s["group"], None, s["name"], s["lat"], s["lon"], "sitio",
                 s["source_url"], s["source_note"], "verificada_en_fuente" if s["verified"] else "no_verificada",
                 hirise_category=s["hirise_category"])


def _mars_tile_spec(s: dict, t: dict, k: int) -> dict:
    nota = (f"{t['source']} ({t['east_km']:+.0f} km E, {t['north_km']:+.0f} km N del sitio). "
            f"Hereda la fuente del sitio {s['id']}: {s['source_note']}")
    return _spec("mars", "L1", t["id"], s["group"], None, f"{s['name']} · tesela {k}", t["lat"], t["lon"],
                 "sitio_tesela", s["source_url"], nota, "derivada_de_sitio", hirise_category=s["hirise_category"])


def mars_values(spec: dict) -> dict:
    w, px = spec["window_km"], spec["px_m"]
    z = dem_io.sample_mars(spec["lat"], spec["lon"], w, px, source="blend")
    v = _feats(z, px, spec["level"] != "L0")
    # L0: cobertura a 40 km (umbral calibrado así); L1: en la propia ventana de 10 km (sale de la caché)
    v["quality"] = dem_io.hrsc_check(spec["lat"], spec["lon"], window_km=40 if spec["level"] == "L0" else w)
    return v


def mars_usable(spec: dict, v: dict, site_q: dict | None = None) -> tuple[bool, str]:
    if v["features"] is None:
        return False, f"más del 10 % de la ventana sin dato ({v['nan_frac']:.0%})"
    q = v["quality"]
    clase, desc = q["clase"], f"R400 = {q['R400']}, eq1m = {q['eq1m']}"
    extra = f"; sitio: {site_q['clase']}" if site_q else ""
    if spec["level"] == "L0":
        if clase == "solo_mola":
            # El blend aquí solo tiene MOLA (463 m, interpolado entre trazas): compararlo a 400 m
            # aparenta una precisión que no tiene (estas zonas salen artificialmente lisas y llenaban
            # el ranking de llanuras). Se conserva como referencia descrita, pero no puntúa.
            return False, (f"solo MOLA según hrsc_check a 40 km ({desc}): 463 m o peor, más grueso que el píxel "
                           "de 400 m; no se puntúa en L0 ni se tesela en L1")
        if clase == "dudoso":
            return True, f"cobertura HRSC dudosa según hrsc_check a 40 km ({desc})"
        return True, ""
    if clase == "solo_mola":
        return False, f"tesela solo MOLA según hrsc_check a 10 km ({desc}{extra}): el dato es más grueso que 200 m"
    if clase == "dudoso":
        return True, f"cobertura HRSC dudosa en la tesela ({desc}{extra})"
    return True, ""


# ---------------------------------------------------------------- HiRISE (Marte L2)

def _area_matrix(n_in: int, n_out: int) -> np.ndarray:
    """Matriz (n_out × n_in) de media de áreas en 1D: cada celda de salida promedia las de entrada
    que solapa, ponderadas por la longitud solapada."""
    step = n_in / n_out
    a = np.zeros((n_out, n_in))
    for i in range(n_out):
        x0, x1 = i * step, (i + 1) * step
        for j in range(int(math.floor(x0)), min(int(math.ceil(x1)), n_in)):
            a[i, j] = min(x1, j + 1) - max(x0, j)
    return a / a.sum(axis=1, keepdims=True)


def hirise_specs() -> list[dict]:
    cat = [c for c in json.loads(CATALOG.read_text(encoding="utf-8")) if c["planet"] == "Mars"]
    out = []
    for c in cat:
        nota = (f"Parche HiRISE del visor 3D (src/data/catalog.json, id '{c['id']}', categoría '{c['category']}'): "
                f"100×100 celdas a 20 m (public/terrain/{c['id']}.f32), remuestreado a 30 m por media de áreas. "
                f"Fuente del parche: {c['source']}" + (f"; DTM: {c['raster']}" if c.get("raster") else "") + ".")
        out.append(_spec("mars", "L2", f"hirise_{c['id']}", c["category"], None, c["name"], c["latitude"],
                         c["longitude"], "hirise", c["sourceUrl"], nota, "centro_parche_catalogo",
                         catalog_id=c["id"]))
    return out


def hirise_values(spec: dict) -> dict:
    path = TERRAIN / f"{spec['catalog_id']}.f32"
    z = np.fromfile(path, dtype="<f4")
    if z.size != HIRISE_N * HIRISE_N:
        raise ValueError(f"{path.name}: {z.size} valores, se esperaban {HIRISE_N ** 2}")
    z = z.reshape(HIRISE_N, HIRISE_N).astype("float64")
    w_m = HIRISE_N * HIRISE_PX                       # 2000 m
    n = int(round(w_m / spec["px_m"]))               # 67, como la malla de la Tierra en L2
    a = _area_matrix(HIRISE_N, n)
    z30 = (a @ z @ a.T).astype("float32")
    v = _feats(z30, w_m / n, True)                   # píxel real 2000/67 = 29,85 m
    v["quality"] = None
    return v


# ---------------------------------------------------------------- cálculo

def _run(spec: dict, fn) -> dict:
    v = _cached(spec)
    if v is None:
        v = fn(spec)
        _save(spec, v)
        v = _clean(v)
    return v


def compute_moon(specs: list[dict], log) -> dict[str, dict]:
    dem_io.ensure_moon_cache()
    res, t0, done = {}, time.time(), 0
    with ThreadPoolExecutor(MOON_THREADS) as ex:
        for spec, v in zip(specs, ex.map(lambda s: _run(s, moon_values), specs)):
            res[spec["id"]] = v
            done += 1
            if done % 200 == 0 or done == len(specs):
                log(f"  Luna: {done}/{len(specs)} ventanas ({time.time() - t0:.0f} s)")
    return res


def compute_mars(sites: list[dict], limit: int | None, log) -> tuple[list[dict], dict[str, dict]]:
    """Marte en serie por sitio (cada lectura ya usa hasta MAX_PER_SERVER hilos): L0 y, si el sitio
    no es solo_mola, sus 9 teselas L1, que salen del mismo recorte."""
    specs, res, t0, n1 = [], {}, time.time(), 0
    for i, s in enumerate(sites):
        t = time.time()
        sp = _mars_site_spec(s)
        v = res[sp["id"]] = _run(sp, mars_values)
        specs.append(sp)
        q = v["quality"]
        tiles = []
        if q["clase"] != "solo_mola" and (limit is None or n1 < limit):
            for k, tt in enumerate(mars_site_tiles(s, 10, 3)):
                ts = _mars_tile_spec(s, tt, k)
                ts["site_quality"] = q
                res[ts["id"]] = _run(ts, mars_values)
                tiles.append(ts)
            n1 += len(tiles)
        specs += tiles
        log(f"  Marte {i + 1:2d}/{len(sites)} {s['id']:44s} {q['clase']:9s} R400={q['R400']} eq1m={q['eq1m']} "
            f"L1={len(tiles)} ({time.time() - t:.1f} s; total {time.time() - t0:.0f} s)")
    return specs, res


def _assign_parents(refs: list[dict]) -> None:
    l0 = defaultdict(list)
    for r in refs:
        if r["level"] == "L0":
            l0[r["body"]].append(r)
    for r in refs:
        if r["level"] == "L0":
            continue
        if r["kind"] == "hirise":
            cands, lim = [c for c in l0["mars"] if c["kind"] == "sitio"], HIRISE_PARENT_KM
        else:
            cands, lim = l0[r["body"]], PARENT_KM
        rad = MOON_R_KM if r["body"] == "moon" else MARS_R_KM
        best = min(((haversine_km(r["lat"], r["lon"], c["lat"], c["lon"], rad), c["id"]) for c in cands),
                   default=(math.inf, None))
        if best[0] < lim:
            r["parent"] = best[1]
            r["parent_km"] = round(best[0], 2)


def _finish(spec: dict, v: dict) -> dict:
    if spec.get("dem") == "sldem":
        usable = v["features"] is not None
        note = ("SLDEM2015 (59 m). Solo gemelos: no entra en el ranking ni en la validación del polo sur"
                if usable else f"más del 10 % de la ventana sin dato ({v['nan_frac']:.0%})")
    elif spec["body"] == "moon":
        usable, note = moon_usable(spec, v)
    elif spec["kind"] == "hirise":
        usable = v["features"] is not None
        note = "" if usable else "parche con más del 10 % sin dato"
    else:
        usable, note = mars_usable(spec, v, spec.get("site_quality"))
    r = {k: x for k, x in spec.items() if k != "site_quality"}
    r["features"] = None if v["features"] is None else {k: v["features"][k] for k in FEATURES}
    r["shape"] = None if v["shape"] is None else {k: v["shape"][k] for k in SHAPE_FEATURES}
    r["quality"] = v["quality"]
    r["elev_mean"] = v["elev_mean"]
    r["usable"] = bool(usable)
    r["usable_note"] = note
    return r


def _summary(refs: list[dict], log) -> None:
    log("\n== Resumen por cuerpo, nivel y grupo (usables / total)")
    tab = defaultdict(lambda: [0, 0])
    for r in refs:
        for key in ((r["body"], r["level"], r["group"]), (r["body"], r["level"], "TOTAL")):
            tab[key][0] += r["usable"]
            tab[key][1] += 1
    for (b, lv, g), (u, n) in sorted(tab.items(), key=lambda kv: (kv[0][0], kv[0][1], kv[0][2] == "TOTAL", kv[0][2])):
        log(f"  {b:4s} {lv} {g:28s} {u:5d} / {n:5d}")
    log(f"  TOTAL: {sum(r['usable'] for r in refs)} usables de {len(refs)}")
    lv1 = Counter(r["kind"] for r in refs if r["body"] == "moon")
    log(f"  Luna por tipo: {dict(lv1)}")

    bad = [r for r in refs if not r["usable"]]
    if bad:
        log("\n== Descartadas (usable = False)")
        by = defaultdict(list)
        for r in bad:
            by[(r["body"], r["level"], r["region"] or r["group"])].append(r)
        for (b, lv, g), rs in sorted(by.items()):
            ej = rs[0]["usable_note"]
            log(f"  {b} {lv} {g:28s} {len(rs):4d}  p. ej. {rs[0]['id']}: {ej}")
    l2 = [r for r in refs if r["body"] == "moon" and r["level"] == "L2"]
    if l2:
        log(f"\n== Luna L2 (5 km a 60 m): {sum(not r['usable'] for r in l2)} de {len(l2)} descartadas por EFFRES p50 > 60 m")
        by = defaultdict(list)
        for r in l2:
            by[r["region"]].append(r)
        for g, rs in sorted(by.items()):
            p50 = [r["quality"]["effres_p50"] for r in rs if r["quality"]["effres_p50"] is not None]
            rango = f"{min(p50):.1f}–{max(p50):.1f} m" if p50 else "sin dato"
            log(f"  {g:24s} {sum(r['usable'] for r in rs):3d} / {len(rs):3d} usables; EFFRES p50 {rango}")

    m0 = [r for r in refs if r["body"] == "mars" and r["level"] == "L0"]
    if m0:
        log("\n== Marte: cobertura HRSC (hrsc_check a 40 km; umbrales de la fase A, NO verificados con un mapa de cobertura)")
        log(f"  {'sitio':46s} {'grupo':14s} {'R400':>6s} {'eq1m':>6s} clase      L1 usables")
        l1 = defaultdict(list)
        for r in refs:
            if r["body"] == "mars" and r["level"] == "L1":
                l1[r["id"].rsplit("_t", 1)[0]].append(r)
        for r in m0:
            q, ts = r["quality"], l1.get(r["id"], [])
            log(f"  {r['id']:46s} {r['group']:14s} {q['R400']!s:>6s} {q['eq1m']!s:>6s} {q['clase']:10s} "
                f"{sum(t['usable'] for t in ts)}/{len(ts)}")
        log(f"  clases L0: {dict(Counter(r['quality']['clase'] for r in m0))}")
        t1 = [r for r in refs if r["body"] == "mars" and r["level"] == "L1"]
        log(f"  clases de las teselas L1 (a 10 km): {dict(Counter(r['quality']['clase'] for r in t1))}")
    par = Counter((r["body"], r["level"], r["parent"] is not None) for r in refs if r["level"] != "L0")
    log("\n== Con padre L0: " + ", ".join(f"{b} {lv}: {par[(b, lv, True)]}/{par[(b, lv, True)] + par[(b, lv, False)]}"
                                          for b, lv in sorted({(k[0], k[1]) for k in par})))


def main() -> None:
    ap = argparse.ArgumentParser(description="Referencias v2 de la Luna y Marte (L0, L1, L2).")
    ap.add_argument("--solo", action="append", choices=["luna", "luna_np", "marte", "hirise"],
                    help="calcula solo esta parte (repetible); por defecto, todo")
    ap.add_argument("--limite", type=int, default=None, help="prueba: primeras N ventanas por cuerpo y nivel")
    ap.add_argument("--hilos", type=int, default=8, help="lecturas simultáneas por servidor (≤ 8)")
    ap.add_argument("--salida", type=Path, default=OUT)
    args = ap.parse_args()
    partes = set(args.solo or ["luna", "luna_np", "marte", "hirise"])
    if args.salida.resolve() == (DATA / "references.json").resolve():
        raise SystemExit("data/references.json es la v1 y no se sobrescribe")
    dem_io.set_max_per_server(args.hilos)
    t0 = time.time()

    def log(msg: str) -> None:
        print(msg, flush=True)

    def lim(specs):
        if args.limite is None:
            return specs
        n, out = Counter(), []
        for s in specs:
            if n[(s["body"], s["level"])] < args.limite:
                n[(s["body"], s["level"])] += 1
                out.append(s)
        return out

    specs, vals, times = [], {}, {}
    if "luna" in partes:
        t = time.time()
        ms = lim(moon_specs())
        log(f"Luna: {len(ms)} ventanas ({dict(Counter(s['level'] for s in ms))})")
        vals.update(compute_moon(ms, log))
        specs += ms
        times["luna"] = time.time() - t
    if "luna_np" in partes:
        t = time.time()
        log(f"Luna fuera del polo: {len(MOON_NONPOLAR_SITES)} sitios (L0 y L1) con SLDEM2015")
        ns, nv = compute_moon_np(log)
        specs += ns
        vals.update(nv)
        times["luna_np"] = time.time() - t
    if "marte" in partes:
        t = time.time()
        sites = MARS_SITES[:args.limite] if args.limite else MARS_SITES
        log(f"Marte: {len(sites)} sitios (L0 y L1), {dem_io.MAX_PER_SERVER} lecturas simultáneas al USGS")
        ss, vv = compute_mars(sites, args.limite, log)
        specs += ss
        vals.update(vv)
        times["marte"] = time.time() - t
    if "hirise" in partes:
        t = time.time()
        hs = lim(hirise_specs())
        for s in hs:
            vals[s["id"]] = _run(s, hirise_values)
        log(f"HiRISE: {len(hs)} parches ({time.time() - t:.1f} s)")
        specs += hs
        times["hirise"] = time.time() - t

    ids = Counter((s["body"], s["level"], s["id"]) for s in specs)
    dup = [k for k, n in ids.items() if n > 1]
    if dup:
        raise RuntimeError(f"ids repetidos: {dup[:5]}")
    refs = [_finish(s, vals[s["id"]]) for s in specs]
    _assign_parents(refs)
    # posiciones idénticas (p. ej. regiones que comparten mosaico LROC): se avisa en usable_note
    pos = defaultdict(list)
    for r in refs:
        pos[(r["body"], r["level"], r["lat"], r["lon"])].append(r["id"])
    for r in refs:
        otros = [i for i in pos[(r["body"], r["level"], r["lat"], r["lon"])] if i != r["id"]]
        if otros:
            r["usable_note"] = "; ".join(x for x in (r["usable_note"], f"misma posición que {', '.join(otros)}") if x)
            # Solo puntúa la primera de las que coinciden, para que esa posición no cuente dos veces
            # (Nobile Rim 1 y Mons Mouton comparten mosaico LROC, centro y límites).
            if r["id"] != pos[(r["body"], r["level"], r["lat"], r["lon"])][0] and r["usable"]:
                r["usable"] = False
                r["usable_note"] += "; duplicada: no se puntúa (cuenta la primera)"

    args.salida.parent.mkdir(parents=True, exist_ok=True)
    tmp = args.salida.with_name(args.salida.name + ".tmp")
    tmp.write_text(json.dumps(_clean(refs), ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, args.salida)
    _summary(refs, log)
    log(f"\nTiempos: " + ", ".join(f"{k} {v:.0f} s" for k, v in times.items()) + f"; total {time.time() - t0:.0f} s")
    log(f"Escrito {args.salida} ({len(refs)} referencias, {args.salida.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
