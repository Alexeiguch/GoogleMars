"""Escaneo global de la Tierra: rasgos de terreno + cobertura del suelo por ventana.

- Relieve: Copernicus DEM GLO-90 (Planetary Computer, colección "cop-dem-glo-90").
- Cobertura: ESA WorldCover 2021 10 m ("esa-worldcover"), para saber si el
  terreno está desnudo (roca/arena) o cubierto de hielo/nieve, y no de bosque o cultivos.

Se procesa por bandas de 1° de latitud; cada banda se guarda en data/earth/
para poder reanudar si se corta.

Ejecutar todo:      .venv\\Scripts\\python.exe -m analogs.earth_scan
Una sola banda:     .venv\\Scripts\\python.exe -m analogs.earth_scan -24
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
from pystac_client import Client
from rasterio.enums import Resampling
from rasterio.windows import from_bounds

from .terrain import PIXEL_M, WINDOW_KM, terrain_features

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
OUT_DIR = Path(__file__).resolve().parent.parent / "data" / "earth"
ROWS_PER_DEG = int(round(111_320 / PIXEL_M))          # 278 filas = 1° de latitud
WIN = int(round(WINDOW_KM * 1000 / PIXEL_M))           # 75 px = 30 km
COVER_CLASSES = {10: "tree", 20: "shrub", 30: "grass", 40: "crop", 50: "built",
                 60: "bare", 70: "snow_ice", 80: "water", 90: "wetland", 95: "mangrove",
                 100: "moss_lichen"}

GDAL_ENV = dict(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MULTIPLEX="YES",
                GDAL_HTTP_MAX_RETRY="4", GDAL_HTTP_RETRY_DELAY="2", VSI_CACHE="TRUE")

_client = None


def client() -> Client:
    global _client
    if _client is None:
        _client = Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)
    return _client


def _read_into(href: str, bounds, out_shape, resampling) -> np.ndarray | None:
    with rasterio.Env(**GDAL_ENV):
        with rasterio.open(href) as src:
            win = from_bounds(*bounds, transform=src.transform)
            arr = src.read(1, window=win, out_shape=out_shape, resampling=resampling,
                           boundless=True, fill_value=src.nodata if src.nodata is not None else 0)
            nod = src.nodata
    arr = arr.astype("float32")
    if nod is not None:
        arr[arr == nod] = np.nan
    return arr


def scan_band(lat0: int, workers: int = 8) -> list[dict]:
    lat1 = lat0 + 1
    phi = math.radians(lat0 + 0.5)
    cols_per_deg = max(2, int(round(ROWS_PER_DEG * math.cos(phi))))
    width = 360 * cols_per_deg
    dem = np.full((ROWS_PER_DEG, width), np.nan, dtype="float32")
    cover = np.zeros((ROWS_PER_DEG, width), dtype="uint8")

    bbox = [-180, lat0 + 0.001, 180, lat1 - 0.001]
    dem_items = list(client().search(collections=["cop-dem-glo-90"], bbox=bbox).items())
    if not dem_items:
        return []
    wc_items = list(client().search(collections=["esa-worldcover"], bbox=bbox,
                                    query={"esa_worldcover:product_version": {"eq": "2.0.0"}}).items())

    def dem_job(item):
        lon0 = int(math.floor(item.bbox[0] + 0.5))
        c = (lon0 + 180) * cols_per_deg
        arr = _read_into(item.assets["data"].href, (lon0, lat0, lon0 + 1, lat1),
                         (ROWS_PER_DEG, cols_per_deg), Resampling.average)
        return c, arr

    def wc_job(item):
        x0, _, x1, _ = item.bbox
        lon0, lon1 = int(round(x0)), int(round(x1))
        c = (lon0 + 180) * cols_per_deg
        arr = _read_into(item.assets["map"].href, (lon0, lat0, lon1, lat1),
                         (ROWS_PER_DEG, (lon1 - lon0) * cols_per_deg), Resampling.mode)
        return c, arr

    with ThreadPoolExecutor(workers) as ex:
        for c, arr in ex.map(dem_job, dem_items):
            dem[:, c:c + arr.shape[1]] = arr[:, : width - c]
        for c, arr in ex.map(wc_job, wc_items):
            cover[:, c:c + arr.shape[1]] = np.nan_to_num(arr[:, : width - c]).astype("uint8")

    have_cover = len(wc_items) > 0
    results = []
    row_starts = [0, (ROWS_PER_DEG - WIN) // 2, ROWS_PER_DEG - WIN]
    for r in row_starts:
        for c in range(0, width - WIN + 1, WIN):
            z = dem[r:r + WIN, c:c + WIN]
            if np.isnan(z).mean() > 0.1 or (z == 0).mean() > 0.3:
                continue  # océano o sin datos
            cv = cover[r:r + WIN, c:c + WIN]
            fr = {name: float((cv == k).mean()) for k, name in COVER_CLASSES.items()}
            if have_cover and (cv > 0).mean() > 0.5 and fr["water"] > 0.5:
                continue
            feats = terrain_features(z)
            if feats is None:
                continue
            lat = lat1 - (r + WIN / 2) / ROWS_PER_DEG
            lon = -180 + (c + WIN / 2) / cols_per_deg
            results.append({
                "lat": round(lat, 4), "lon": round(lon, 4),
                "elev_mean": float(np.nanmean(z)),
                "features": {k: round(v, 4) for k, v in feats.items()},
                "cover": {k: round(v, 3) for k, v in fr.items()} if have_cover and (cv > 0).mean() > 0.5 else None,
            })
    return results


def run(bands: list[int], parallel_bands: int = 3) -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    todo = [b for b in bands if not (OUT_DIR / f"band_{b:+03d}.json").exists()]
    print(f"{len(todo)} bandas por procesar", flush=True)

    def job(b):
        t = time.time()
        for attempt in range(3):
            try:
                res = scan_band(b)
                break
            except Exception as exc:  # reintenta errores de red
                print(f"banda {b}: error {exc!r}, reintento {attempt + 1}", flush=True)
                time.sleep(5)
        else:
            return
        (OUT_DIR / f"band_{b:+03d}.json").write_text(json.dumps(res), encoding="utf-8")
        print(f"banda {b:+03d}: {len(res):5d} ventanas en {time.time() - t:5.1f}s", flush=True)

    with ThreadPoolExecutor(parallel_bands) as ex:
        list(ex.map(job, todo))


if __name__ == "__main__":
    if len(sys.argv) > 1:
        bands = [int(a) for a in sys.argv[1:]]
    else:
        bands = list(range(-90, 90))
    run(bands)
