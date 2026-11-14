"""Relieve del polo sur de la Luna para el globo 3D (página «Globos 3D»).

La imagen global de la Luna es equirectangular: en el polo se estira y se ve borrosa,
justo donde están los 6 sitios de Artemis III. Este script hace una imagen cuadrada en
proyección azimutal equidistante centrada en el polo sur, desde 78°S hasta el polo,
con el DEM LOLA de 118 m y el mismo sombreado que analogs.relief_images.

Ejecutar desde pipeline/:  python -m analogs.moon_pole
Escribe ../public/imagery/moon_south_pole.jpg (≈240 m por píxel).

Geometría (la misma que usa src/globos.ts para colocar la imagen):
  rho = distancia al polo en grados (90 + lat), x = rho·sin(lon), y = rho·cos(lon)
  columna 0 → x = -EDGE_DEG, fila 0 (arriba) → y = +EDGE_DEG
"""

from __future__ import annotations

import math
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.windows import Window
from scipy import ndimage

from .references import MOON_DEM, MOON_R
from .relief_images import hillshade

EDGE_DEG = 12.0          # la imagen llega hasta 78°S (src/globos.ts usa el mismo valor)
SIZE = 3072              # píxeles por lado
ROW_STEP = 2             # una de cada dos filas del DEM (237 m)
COL_STEP = 4             # en longitud sobra resolución cerca del polo
THREADS = 16

PROJECT = Path(__file__).resolve().parent.parent.parent
OUT = PROJECT / "public" / "imagery" / "moon_south_pole.jpg"
GLOBAL_IMAGE = PROJECT / "public" / "imagery" / "moon.jpg"


def read_polar_rows() -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Filas del DEM entre 90°S - EDGE_DEG y el polo -> (z [m], lat de cada fila, lon de cada columna)."""
    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="4", GDAL_HTTP_RETRY_DELAY="2"):
        with rasterio.open(MOON_DEM) as src:
            t = src.transform
            m_per_deg = math.pi * MOON_R / 180
            first = int(((t.f - (-90 + EDGE_DEG + 0.1) * m_per_deg)) / -t.e)
            rows = list(range(first, src.height, ROW_STEP))
            scale = src.scales[0]
            width = src.width
            lon = (t.c + (np.arange(0, width, COL_STEP) + 0.5) * t.a) / m_per_deg
            lat = (t.f + (np.array(rows) + 0.5) * t.e) / m_per_deg

    def read(row: int) -> np.ndarray:
        # Cada hilo abre su propio dataset (GDAL no es seguro entre hilos con el mismo handle).
        with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR", GDAL_HTTP_MAX_RETRY="4", GDAL_HTTP_RETRY_DELAY="2"):
            with rasterio.open(MOON_DEM) as src:
                line = src.read(1, window=Window(0, row, width, 1))[0]
        return line[::COL_STEP].astype("float32") * scale

    print(f"Leyendo {len(rows)} filas del DEM LOLA ({lat.max():.2f}° a {lat.min():.2f}°)…")
    start = time.time()
    with ThreadPoolExecutor(THREADS) as pool:
        out = []
        for i, line in enumerate(pool.map(read, rows), 1):
            out.append(line)
            if i % 200 == 0:
                print(f"  {i}/{len(rows)} filas, {time.time() - start:.0f} s")
    return np.stack(out), lat, lon


def to_polar(z: np.ndarray, lat: np.ndarray, lon: np.ndarray) -> np.ndarray:
    """Remuestrea la malla lat/lon a la imagen azimutal equidistante del polo sur."""
    c = (np.arange(SIZE) + 0.5) / SIZE * 2 - 1
    x, y = np.meshgrid(c * EDGE_DEG, -c * EDGE_DEG)
    rho = np.hypot(x, y)
    plat = -90 + rho
    plon = np.degrees(np.arctan2(x, y))
    # Índices fraccionarios en la malla de origen; se repite la primera columna al final para el antimeridiano.
    zz = np.concatenate([z, z[:, :1]], axis=1)
    row = (plat - lat[0]) / (lat[1] - lat[0])
    col = (plon - lon[0]) / (lon[1] - lon[0])
    col = np.mod(col, z.shape[1])
    out = ndimage.map_coordinates(zz, [row, col], order=1, mode="nearest")
    out[rho > EDGE_DEG] = np.nan
    return out


def photo_tone() -> float:
    """Brillo medio de la imagen global de la Luna entre 78°S y 80°S, para que el empalme no se note."""
    img = np.asarray(Image.open(GLOBAL_IMAGE).convert("L"), dtype="float32") / 255
    h = img.shape[0]
    r0, r1 = int((90 + 78) / 180 * h), int((90 + 80) / 180 * h)
    return float(img[r0:r1].mean())


def main() -> None:
    z, lat, lon = read_polar_rows()
    polar = to_polar(z, lat, lon)
    px = 2 * EDGE_DEG * math.pi * MOON_R / 180 / SIZE
    fill = np.isnan(polar)
    if fill.any():
        idx = ndimage.distance_transform_edt(fill, return_distances=False, return_indices=True)
        polar = polar[tuple(idx)]
    hs = hillshade(polar, px=px)
    lo, hi = np.percentile(polar, [2, 98])
    v = 0.78 * hs + 0.22 * np.clip((polar - lo) / max(hi - lo, 1), 0, 1)
    c = (np.arange(SIZE) + 0.5) / SIZE * 2 - 1
    rho = np.hypot(*np.meshgrid(c * EDGE_DEG, c * EDGE_DEG))
    ring = (rho > EDGE_DEG - 2) & (rho <= EDGE_DEG)
    v = v * (photo_tone() / float(v[ring].mean()))
    OUT.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray((np.clip(v, 0, 1) * 255).astype("uint8"), mode="L").save(OUT, quality=88, optimize=True)
    print(f"Escrito {OUT} ({SIZE}×{SIZE}, {px:.0f} m por píxel, {OUT.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
