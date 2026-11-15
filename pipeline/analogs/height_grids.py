"""Cuadrículas de ALTURA (no sombreado) de 30 km para comparar en 3D cada referencia con sus gemelos.

Misma regla de escala que el resto del pipeline: la Tierra y la Luna o Marte con la misma ventana y el
mismo píxel, no más fino que el dato más grueso de la pareja. Con 300 m vale para todas las parejas:
LOLA PGDA 40 m (polo sur), SLDEM2015 59 m (Luna fuera del polo), HRSC+MOLA 200 m (Marte; las
referencias solo MOLA, 463 m, no puntúan y no se exportan) y Copernicus GLO-90 90 m (Tierra).

Formato (lo lee src/globos.ts):
- 100 × 100 float32 little-endian, metros, fila 0 = norte, columna 0 = oeste (malla local azimutal
  equidistante centrada en el punto, como las imágenes de relieve). Sin NaN: los huecos se rellenan con
  el vecino más cercano; si faltan más de MAX_NAN, la cuadrícula no se exporta.
- public/terrain/l0/ref_<id>.f32 y public/terrain/l0/e_<lat:.4f>_<lon:.4f>.f32 (mismo centro que las
  PNG de relieve L0).
- public/terrain/l0/index.json: window_km, grid, cell_m, refs, earth, pairs y sources, para que la app
  sepa qué existe sin pedir archivos que den 404.

Qué se exporta: la ventana terrestre de cada gemelo de bodies.moon.twins y bodies.mars.twins, la
referencia contra la que se compara (best_ref), y además toda referencia L0 de tipo "sitio" o
"region_centro" con usable != false.

Ejecutar desde pipeline/ (después de rank):  python -m analogs.height_grids [--results RUTA] [--out DIR]
Solo genera los archivos que faltan.
"""

from __future__ import annotations

import argparse
import json
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
from scipy import ndimage

from . import dem_io

PIPE = Path(__file__).resolve().parent.parent
PROJECT = PIPE.parent
RESULTS = PROJECT / "src" / "data" / "results.json"
OUT = PROJECT / "public" / "terrain" / "l0"
WINDOW_KM, GRID = 30.0, 100
CELL_M = WINDOW_KM * 1000 / GRID          # 300 m
MAX_NAN = 0.1
SOURCES = {"moon_pole": "LOLA LDEM_80S_40MPP_ADJ, 40 m (NASA PGDA, Barker et al. 2023)",
           "moon": "SLDEM2015, 59 m (LOLA + Kaguya TC)",
           "mars": "HRSC+MOLA blend v2, 200 m (USGS)",
           "earth": "Copernicus DEM GLO-90, 90 m"}


def earth_key(lat: float, lon: float) -> str:
    return f"{lat:.4f}_{lon:.4f}"


def _fill(z: np.ndarray | None) -> np.ndarray | None:
    """Rellena NaN con el vecino más cercano; None si faltan más de MAX_NAN."""
    if z is None or z.shape != (GRID, GRID) or np.isnan(z).mean() > MAX_NAN:
        return None
    if np.isnan(z).any():
        idx = ndimage.distance_transform_edt(np.isnan(z), return_distances=False, return_indices=True)
        z = z[tuple(idx)]
    return z.astype("<f4")


def sample_ref(r: dict) -> np.ndarray:
    if r["body"] == "moon":
        if r["lat"] <= -60:
            return dem_io.sample_moon(r["lat"], r["lon"], WINDOW_KM, CELL_M)
        return dem_io.sample_moon_sldem(r["lat"], r["lon"], WINDOW_KM, CELL_M)
    return dem_io.sample_mars(r["lat"], r["lon"], WINDOW_KM, CELL_M, source="blend")


def sample_earth(lat: float, lon: float) -> np.ndarray:
    return dem_io.sample_earth(lat, lon, WINDOW_KM, CELL_M, collection="cop-dem-glo-90")


def plan(res: dict) -> tuple[dict[str, dict], dict[str, tuple[float, float]], list[dict]]:
    """(referencias por id, ventanas terrestres por clave, parejas gemelo–referencia)."""
    refs = {r["id"]: r for r in res["references"]
            if not r.get("group_only") and r.get("lat") is not None and r.get("lon") is not None}
    want_refs: dict[str, dict] = {}
    earth: dict[str, tuple[float, float]] = {}
    pairs = []
    for body in ("moon", "mars"):
        for key, twins in (res["bodies"][body].get("twins") or {}).items():
            for k, s in enumerate(twins):
                ek = earth_key(s["lat"], s["lon"])
                earth[ek] = (s["lat"], s["lon"])
                rid = s.get("best_ref")
                if rid in refs and refs[rid].get("usable") is not False:
                    want_refs[rid] = refs[rid]
                pairs.append({"body": body, "twin_key": key, "rank": k + 1, "earth": ek, "ref": rid,
                              "score": s.get("score")})
    for r in refs.values():
        if r.get("kind") in ("sitio", "region_centro") and r.get("usable") is not False:
            want_refs[r["id"]] = r
    return want_refs, earth, pairs


def main() -> None:
    ap = argparse.ArgumentParser(description="Cuadrículas de altura de 30 km a 300 m para el 3D.")
    ap.add_argument("--results", type=Path, default=RESULTS)
    ap.add_argument("--out", type=Path, default=OUT)
    ap.add_argument("--threads", type=int, default=6, help="ventanas terrestres en paralelo (≤ 8)")
    a = ap.parse_args()
    res = json.loads(a.results.read_text(encoding="utf-8"))
    refs, earth, pairs = plan(res)
    a.out.mkdir(parents=True, exist_ok=True)
    t0 = time.time()
    print(f"{len(refs)} referencias y {len(earth)} ventanas terrestres ({len(pairs)} parejas)", flush=True)

    done_refs, failed = [], []
    for i, (rid, r) in enumerate(sorted(refs.items())):
        p = a.out / f"ref_{rid}.f32"
        if not p.exists():
            z = _fill(sample_ref(r))
            if z is None:
                failed.append(f"ref {rid}: más del {MAX_NAN:.0%} sin dato")
                continue
            z.tofile(p)
        done_refs.append(rid)
        print(f"  ref {i + 1}/{len(refs)} {rid}", flush=True)

    def job(item):
        ek, (lat, lon) = item
        p = a.out / f"e_{ek}.f32"
        if p.exists():
            return ek, True
        z = _fill(sample_earth(lat, lon))
        if z is None:
            return ek, False
        z.tofile(p)
        return ek, True

    done_earth = []
    with ThreadPoolExecutor(min(a.threads, 8)) as ex:
        for n, (ek, ok) in enumerate(ex.map(job, sorted(earth.items())), 1):
            (done_earth if ok else failed).append(ek if ok else f"tierra {ek}: más del {MAX_NAN:.0%} sin dato")
            if n % 20 == 0 or n == len(earth):
                print(f"  tierra {n}/{len(earth)} ({time.time() - t0:.0f} s)", flush=True)

    have_e, have_r = set(done_earth), set(done_refs)
    index = {"window_km": WINDOW_KM, "grid": GRID, "cell_m": CELL_M, "dtype": "float32 little-endian",
             "orientation": "fila 0 = norte, columna 0 = oeste; metros",
             "refs": sorted(have_r), "earth": sorted(have_e),
             "pairs": [p for p in pairs if p["earth"] in have_e and p["ref"] in have_r],
             "sources": SOURCES}
    (a.out / "index.json").write_text(json.dumps(index, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"Hecho en {time.time() - t0:.0f} s: {len(have_r)} referencias, {len(have_e)} ventanas terrestres, "
          f"{len(index['pairs'])} parejas. Fallos: {len(failed)}", flush=True)
    for f in failed:
        print("  FALLO", f)


if __name__ == "__main__":
    main()
