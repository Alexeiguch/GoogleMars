"""Rasgos de terreno comparables entre la Tierra, la Luna y Marte.

Todo se mide igual en los tres cuerpos: una ventana cuadrada de WINDOW_KM
remuestreada a PIXEL_M metros, y sobre ella pendientes, rugosidad y relieve.
"""

from __future__ import annotations

import math

import numpy as np
import rasterio
from rasterio.windows import Window
from scipy import ndimage

PIXEL_M = 400.0      # resolución común de análisis
WINDOW_KM = 30.0     # tamaño de cada ventana (sitio)

FEATURES = ["slope_p50", "slope_p90", "frac_flat", "frac_steep", "relief", "rough_1km"]

FEATURE_LABELS = {
    "slope_p50": "Pendiente típica (°)",
    "slope_p90": "Pendiente alta, p90 (°)",
    "frac_flat": "Fracción llana <5°",
    "frac_steep": "Fracción empinada >15°",
    "relief": "Relieve local p5–p95 (m)",
    "rough_1km": "Rugosidad a ~1 km (m)",
}


def terrain_features(z: np.ndarray, px: float = PIXEL_M) -> dict[str, float] | None:
    """z: elevaciones en metros sobre una malla cuadrada de `px` metros."""
    if z is None or np.isnan(z).mean() > 0.1:
        return None
    if np.isnan(z).any():  # rellena huecos pequeños con el vecino más cercano
        idx = ndimage.distance_transform_edt(np.isnan(z), return_distances=False, return_indices=True)
        z = z[tuple(idx)]
    gy, gx = np.gradient(z, px)
    slope = np.degrees(np.arctan(np.hypot(gx, gy)))[1:-1, 1:-1]
    resid = (z - ndimage.gaussian_filter(z, sigma=2.5))[3:-3, 3:-3]  # ~1 km
    p5, p95 = np.percentile(z, [5, 95])
    return {
        "slope_p50": float(np.median(slope)),
        "slope_p90": float(np.percentile(slope, 90)),
        "frac_flat": float((slope < 5).mean()),
        "frac_steep": float((slope > 15).mean()),
        "relief": float(p95 - p5),
        "rough_1km": float(resid.std()),
    }


def rough_scale_m(px: float = PIXEL_M) -> float:
    """Escala real de "rough_1km": el filtro usa sigma = 2,5 px, así que mide a 2,5·px metros."""
    return 2.5 * px


def rough_label(px: float = PIXEL_M) -> str:
    """Etiqueta de "rough_1km" con su escala real a este píxel (p. ej. 120 m -> "~300 m")."""
    s = rough_scale_m(px)
    esc = f"{s / 1000:.1f}".replace(".", ",").replace(",0", "") + " km" if s >= 1000 else f"{s:.0f} m"
    return f"Rugosidad a ~{esc} (m)"


def feature_labels(px: float = PIXEL_M) -> dict[str, str]:
    """FEATURE_LABELS + SHAPE_LABELS con la escala real de la rugosidad a este píxel."""
    return {**FEATURE_LABELS, "rough_1km": rough_label(px), **SHAPE_LABELS}


# Rasgos de forma (opcionales; no los usa el escaneo L0). Solo dependen de z y px.
SHAPE_FEATURES = ["curv_p90", "pit_frac", "hypso"]

SHAPE_LABELS = {
    "curv_p90": "Curvatura alta, p90 de |laplaciano| (1/m)",
    "pit_frac": "Fracción en depresiones cerradas",
    "hypso": "Integral hipsométrica",
}


def _fill_nan(z: np.ndarray) -> np.ndarray:
    if np.isnan(z).any():  # como terrain_features: vecino más cercano
        idx = ndimage.distance_transform_edt(np.isnan(z), return_distances=False, return_indices=True)
        z = z[tuple(idx)]
    return z


def fill_depressions(z: np.ndarray) -> np.ndarray:
    """Relleno de depresiones por reconstrucción morfológica (erosión geodésica desde el borde):
    cada celda sube hasta el nivel más bajo por el que el agua saldría por el borde de la ventana."""
    f = np.full(z.shape, np.inf)
    f[0, :], f[-1, :], f[:, 0], f[:, -1] = z[0, :], z[-1, :], z[:, 0], z[:, -1]
    for _ in range(4 * z.size):  # tope de seguridad; converge en mucho menos
        g = np.maximum(z, ndimage.grey_erosion(f, size=(3, 3), mode="nearest"))
        if np.array_equal(g, f):
            break
        f = g
    return f


def shape_features(z: np.ndarray, px: float = PIXEL_M) -> dict[str, float] | None:
    """Curvatura, fracción en hoyos cerrados e integral hipsométrica de una malla de `px` m."""
    if z is None or np.isnan(z).mean() > 0.1:
        return None
    z = _fill_nan(z).astype("float64")
    lap = ndimage.laplace(ndimage.gaussian_filter(z, sigma=1.0)) / px ** 2   # 1/m
    depth = fill_depressions(z) - z
    lo, hi = float(z.min()), float(z.max())
    return {
        "curv_p90": float(np.percentile(np.abs(lap[2:-2, 2:-2]), 90)),
        "pit_frac": float((depth > px * math.tan(math.radians(1.0))).mean()),
        "hypso": float((z.mean() - lo) / (hi - lo)) if hi > lo else 0.5,  # llano del todo: 0,5
    }


def _aeqd_inverse(lat0: float, lon0: float, east: np.ndarray, north: np.ndarray, radius: float):
    """Proyección azimutal equidistante inversa sobre una esfera -> (lat, lon) en grados."""
    phi0, lam0 = math.radians(lat0), math.radians(lon0)
    rho = np.hypot(east, north)
    c = rho / radius
    with np.errstate(invalid="ignore", divide="ignore"):
        lat = np.arcsin(np.cos(c) * math.sin(phi0) + np.where(rho > 0, north * np.sin(c) * math.cos(phi0) / rho, 0))
    lon = lam0 + np.arctan2(east * np.sin(c), rho * math.cos(phi0) * np.cos(c) - north * math.sin(phi0) * np.sin(c))
    return np.degrees(lat), (np.degrees(lon) + 180) % 360 - 180


def sample_planet_dem(url: str, radius: float, lat0: float, lon0: float,
                      window_km: float = WINDOW_KM, px: float = PIXEL_M, sup: int = 4) -> np.ndarray:
    """Lee un DEM global (Luna/Marte, cilíndrico) y devuelve una ventana local
    centrada en (lat0, lon0) a `px` m, sin distorsión aunque esté cerca del polo."""
    n = int(round(window_km * 1000 / px))
    step = px / sup
    off = (np.arange(n * sup) - (n * sup - 1) / 2) * step
    east, north = np.meshgrid(off, -off)
    lat, lon = _aeqd_inverse(lat0, lon0, east, north, radius)

    with rasterio.Env(GDAL_DISABLE_READDIR_ON_OPEN="EMPTY_DIR"):
        with rasterio.open(url) as src:
            left, bottom, right, top = src.bounds
            if src.crs.is_geographic:
                xs, ys = lon.copy(), lat
                span = 360.0
            else:  # cilíndrico en metros
                xs, ys = np.radians(lon) * radius, np.radians(lat) * radius
                span = 2 * math.pi * radius
            xs = np.where(xs < left, xs + span, xs)
            xs = np.where(xs >= right, xs - span, xs)
            inv = ~src.transform
            cols, rows = inv * (xs, ys)
            r0 = max(int(np.floor(rows.min())) - 2, 0)
            r1 = min(int(np.ceil(rows.max())) + 3, src.height)
            c0, c1 = int(np.floor(cols.min())) - 2, int(np.ceil(cols.max())) + 3
            full = (c1 - c0) > src.width * 0.5 or c0 < 0 or c1 > src.width
            if full:
                c0, c1 = 0, src.width
            arr = src.read(1, window=Window(c0, r0, c1 - c0, r1 - r0)).astype("float32")
            nod = src.nodata
            scale, offset = src.scales[0], src.offsets[0]
    if nod is not None:
        arr[arr == nod] = np.nan
    arr = arr * scale + offset
    if full:  # para interpolar a través del meridiano de cambio
        arr = np.concatenate([arr, arr[:, :2]], axis=1)
    vals = ndimage.map_coordinates(arr, [rows - r0, cols - c0], order=1, mode="nearest")
    return vals.reshape(n, sup, n, sup).mean(axis=(1, 3))
