"""Lectura de DEM de la Luna, Marte y la Tierra en una malla local común.

Todas las funciones sample_* devuelven una malla n×n float32 en metros, con
n = round(window_km*1000/px), en proyección azimutal equidistante centrada en (lat, lon)
(terrain._aeqd_inverse), fila 0 = norte y NaN donde no hay dato. Cada punto es la media
de sup×sup subpuntos interpolados (bilineal) a ≤ el píxel nativo del dato.

- Luna: LOLA ajustado de Barker et al. 2023 (PGDA, 80–90°S, 40 m, estereográfica polar sur)
  y su capa EFFRES (resolución efectiva). Se descargan una vez a data/cache/moon/.
- Marte: blend HRSC+MOLA 200 m y MOLA 463 m del USGS (GeoTIFF sin comprimir, una fila por
  strip). El mismo lector sirve para la Luna fuera del polo (SLDEM2015, 59 m, 60°S–60°N).
  Se leen por rangos de bytes solo las columnas necesarias; los recortes leídos se
  guardan en data/cache/mars/ y se reutilizan.
- Tierra: Copernicus GLO-90 / GLO-30 y ESA WorldCover 2021 (Planetary Computer).
  Índice de tiles GLO-90 en data/cache/glo90_index.json; WorldCover a ~120 m por tile de 3°
  en data/cache/wc120/.

Como mucho MAX_PER_SERVER (8) lecturas simultáneas por servidor (PGDA, USGS, Planetary Computer),
y 4 para WorldCover.

Ejecutar desde pipeline/:
  python -m analogs.dem_io --moon-cache     # descarga la caché de la Luna (~1,7 GB, una vez)
  python -m analogs.dem_io --selftest       # comprobaciones de los tres cuerpos (4 hilos)
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
import threading
import time
from collections import OrderedDict
from contextlib import ExitStack
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import numpy as np
import planetary_computer
import rasterio
import requests
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.warp import transform as warp_transform
from rasterio.windows import Window
from scipy import ndimage

from .earth_scan import COVER_CLASSES, GDAL_ENV, STAC_URL, client
from .terrain import _aeqd_inverse

PIPE = Path(__file__).resolve().parent.parent
CACHE = PIPE / "data" / "cache"

MOON_R = 1_737_400.0
MOON_DEM_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_40MPP_ADJ.TIF"
MOON_EFFRES_URL = "https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_40MPP_ADJ_EFFRES.TIF"
MOON_SIZES = {MOON_DEM_URL: 716_299_920, MOON_EFFRES_URL: 1_000_954_193}
MOON_PX = 40.0

MARS_R = 3_396_190.0
MARS_BLEND_URL = "https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif"
MARS_MOLA_URL = "https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_DEM_mosaic_global_463m.tif"
# Luna fuera del polo: SLDEM2015 (LOLA + estéreo Kaguya TC, GSFC/JAXA), 60°S–60°N, 512 px/grado (59,2 m),
# mismo formato que los de Marte (int16 sin comprimir, una fila por strip): se lee con el mismo lector por rangos.
MOON_SLDEM_URL = "https://planetarymaps.usgs.gov/mosaic/LolaKaguya_Topo/Lunar_LRO_LOLAKaguya_DEMmerge_60N60S_512ppd.tif"
MARS_SOURCES = {"blend": MARS_BLEND_URL, "mola": MARS_MOLA_URL, "sldem": MOON_SLDEM_URL}
SOURCE_R = {"blend": MARS_R, "mola": MARS_R, "sldem": MOON_R}   # radio de la esfera de cada fuente
MARS_MARGIN_KM = 10.0     # margen del recorte guardado alrededor de la ventana pedida

EARTH_R = 6_371_008.8     # radio medio de la Tierra (esfera)
EARTH_NATIVE = {"cop-dem-glo-90": 90.0, "cop-dem-glo-30": 30.0}
WC_FACTOR = 12            # WorldCover 10 m -> 120 m
WC_QUERY = {"esa_worldcover:product_version": {"eq": "2.0.0"}}

GDAL_HTTP = dict(GDAL_ENV, GDAL_HTTP_TIMEOUT="30", GDAL_HTTP_CONNECTTIMEOUT="15",
                 GDAL_HTTP_RETRY_CODES="429,500,502,503,504")

# ---------------------------------------------------------------- concurrencia

MAX_PER_SERVER = 8
_SEM: dict[str, threading.BoundedSemaphore] = {}
_POOLS: dict[str, ThreadPoolExecutor] = {}
_LOCK = threading.Lock()


def set_max_per_server(k: int) -> None:
    """Cambia el límite de lecturas simultáneas por servidor (≤ 8). Llamar antes de leer."""
    global MAX_PER_SERVER
    with _LOCK:
        MAX_PER_SERVER = max(1, min(8, int(k)))
        _SEM.clear()
        _POOLS.clear()


def _sem(server: str) -> threading.BoundedSemaphore:
    with _LOCK:
        if server not in _SEM:
            k = min(4, MAX_PER_SERVER) if server == "wc" else MAX_PER_SERVER
            _SEM[server] = threading.BoundedSemaphore(k)
        return _SEM[server]


def _pool(server: str) -> ThreadPoolExecutor:
    """Pool de hilos de E/S por servidor (solo tareas hoja: no lanzan otras tareas)."""
    with _LOCK:
        if server not in _POOLS:
            k = min(4, MAX_PER_SERVER) if server == "wc" else MAX_PER_SERVER
            _POOLS[server] = ThreadPoolExecutor(k, thread_name_prefix=f"dem_io_{server}")
        return _POOLS[server]


class _Lru:
    """Caché LRU en memoria; si dos hilos piden la misma clave, solo uno la carga."""

    def __init__(self, size: int):
        self.size, self.data, self.busy = size, OrderedDict(), {}
        self.lock = threading.Lock()

    def get(self, key, loader):
        while True:
            with self.lock:
                if key in self.data:
                    self.data.move_to_end(key)
                    return self.data[key]
                ev = self.busy.get(key)
                if ev is None:
                    ev = self.busy[key] = threading.Event()
                    break
            ev.wait()
        try:
            val = loader()
            with self.lock:
                self.data[key] = val
                while len(self.data) > self.size:
                    self.data.popitem(last=False)
            return val
        finally:
            with self.lock:
                self.busy.pop(key, None)
            ev.set()


# ---------------------------------------------------------------- malla local

def _grid(lat: float, lon: float, window_km: float, px: float, sup: int, radius: float):
    """Malla (n·sup)² de la proyección azimutal local -> (n, lat, lon)."""
    n = int(round(window_km * 1000 / px))
    m = n * sup
    off = (np.arange(m) - (m - 1) / 2) * (px / sup)
    east, north = np.meshgrid(off, -off)
    la, lo = _aeqd_inverse(lat, lon, east, north, radius)
    return n, la, lo


def _block_mean(v: np.ndarray, n: int, sup: int) -> np.ndarray:
    """Media por bloques sup×sup; NaN si menos de la mitad del bloque tiene dato."""
    if sup == 1:
        return v.reshape(n, n).astype("float32")
    b = v.reshape(n, sup, n, sup)
    ok = ~np.isnan(b)
    cnt = ok.sum(axis=(1, 3))
    s = np.where(ok, b, 0).sum(axis=(1, 3))
    with np.errstate(invalid="ignore", divide="ignore"):
        out = s / cnt
    out[cnt < sup * sup / 2] = np.nan
    return out.astype("float32")


def _interp_local(src, rows: np.ndarray, cols: np.ndarray, order: int = 1) -> np.ndarray:
    """Interpola un raster local en (fila, columna) de centro de píxel; lee solo la ventana."""
    r0 = int(np.floor(np.nanmin(rows))) - 1
    r1 = int(np.ceil(np.nanmax(rows))) + 2
    c0 = int(np.floor(np.nanmin(cols))) - 1
    c1 = int(np.ceil(np.nanmax(cols))) + 2
    arr = np.full((r1 - r0, c1 - c0), np.nan, dtype="float32")
    rr0, rr1 = max(r0, 0), min(r1, src.height)
    cc0, cc1 = max(c0, 0), min(c1, src.width)
    if rr1 > rr0 and cc1 > cc0:
        a = src.read(1, window=Window(cc0, rr0, cc1 - cc0, rr1 - rr0)).astype("float32")
        if src.nodata is not None and not np.isnan(src.nodata):
            a[a == src.nodata] = np.nan
        a = a * src.scales[0] + src.offsets[0]
        arr[rr0 - r0:rr1 - r0, cc0 - c0:cc1 - c0] = a
    return ndimage.map_coordinates(arr, [rows - r0, cols - c0], order=order, mode="constant", cval=np.nan)


# ---------------------------------------------------------------- Luna

def _download(url: str, dest: Path, size: int) -> None:
    """Descarga en streaming, reanudable con Range, sin sesión persistente (PGDA da 403 si se reutiliza)."""
    part = dest.with_name(dest.name + ".part")
    lock = dest.with_name(dest.name + ".lock")
    while True:  # otro proceso puede estar descargando el mismo archivo
        try:
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.close(fd)
            break
        except FileExistsError:
            if dest.exists() and dest.stat().st_size == size:
                return
            if time.time() - lock.stat().st_mtime > 180:  # cerrojo abandonado
                lock.unlink(missing_ok=True)
                continue
            time.sleep(5)
    try:
        if dest.exists() and dest.stat().st_size == size:
            return
        fails = 0
        t0, last = time.time(), 0.0
        while True:
            have = part.stat().st_size if part.exists() else 0
            if have == size:
                break
            if have > size:
                part.unlink()
                have = 0
            try:
                hdr = {"Range": f"bytes={have}-"} if have else {}
                with requests.get(url, headers=hdr, stream=True, timeout=60) as r:
                    if r.status_code == 200 and have:
                        have = 0  # el servidor ignoró el Range: empieza de cero
                    elif r.status_code not in (200, 206):
                        raise IOError(f"HTTP {r.status_code}")
                    with open(part, "ab" if have else "wb") as f:
                        for chunk in r.iter_content(1 << 20):
                            f.write(chunk)
                            have += len(chunk)
                            if time.time() - last > 15:
                                last = time.time()
                                os.utime(lock)
                                print(f"  {dest.name}: {have / 1e6:7.0f} / {size / 1e6:.0f} MB "
                                      f"({have / 1e6 / max(time.time() - t0, 1e-3):.1f} MB/s)", flush=True)
                fails = 0
            except (requests.RequestException, IOError) as exc:
                fails += 1
                if fails > 8:
                    raise
                print(f"  {dest.name}: error {exc!r}, reintento {fails}", flush=True)
                time.sleep(3 * fails)
        if part.stat().st_size != size:
            raise IOError(f"{dest.name}: tamaño {part.stat().st_size} != {size}")
        os.replace(part, dest)
    finally:
        lock.unlink(missing_ok=True)


def ensure_moon_cache() -> tuple[Path, Path]:
    """Descarga (una vez) el LDEM de 40 m y su EFFRES a data/cache/moon/ -> (dem, effres)."""
    d = CACHE / "moon"
    d.mkdir(parents=True, exist_ok=True)
    paths = []
    for url in (MOON_DEM_URL, MOON_EFFRES_URL):
        dest = d / url.rsplit("/", 1)[1]
        if not (dest.exists() and dest.stat().st_size == MOON_SIZES[url]):
            print(f"descargando {url}", flush=True)
            _download(url, dest, MOON_SIZES[url])
        paths.append(dest)
    return paths[0], paths[1]


def _moon_rowcol(src, la: np.ndarray, lo: np.ndarray):
    """lat/lon lunares -> fila/columna (centro de píxel) del archivo, con PROJ."""
    p = src.crs.to_dict()
    r = p.get("R") or p.get("a") or MOON_R
    geo = CRS.from_proj4(f"+proj=longlat +R={r} +no_defs")
    xs, ys = warp_transform(geo, src.crs, lo.ravel(), la.ravel())
    cols, rows = ~src.transform * (np.asarray(xs), np.asarray(ys))
    return rows - 0.5, cols - 0.5


def sample_moon(lat: float, lon: float, window_km: float, px: float, sup: int | None = None) -> np.ndarray:
    """Ventana local de la Luna (LOLA 40 m de Barker et al. 2023) a `px` m."""
    dem, _ = ensure_moon_cache()
    sup = sup or max(1, math.ceil(px / MOON_PX))
    n, la, lo = _grid(lat, lon, window_km, px, sup, MOON_R)
    with rasterio.open(dem) as src:
        rows, cols = _moon_rowcol(src, la, lo)
        v = _interp_local(src, rows, cols, order=1)
    return _block_mean(v, n, sup)


def moon_effres(lat: float, lon: float, window_km: float) -> dict[str, float]:
    """Percentiles 50 y 90 de la resolución efectiva dentro de la ventana; NaN = sin dato.
    Unidades: el archivo no las declara (sin `units`; GMT "blockmean", rango 2,6–1034,6); son metros
    por inferencia (el paper la define como diámetro en m y la mediana sale de 16–50 m)."""
    _, eff = ensure_moon_cache()
    n, la, lo = _grid(lat, lon, window_km, MOON_PX, 1, MOON_R)
    with rasterio.open(eff) as src:
        rows, cols = _moon_rowcol(src, la, lo)
        v = _interp_local(src, rows, cols, order=0)
    v = v[np.isfinite(v)]
    if v.size == 0:
        return {"p50": float("nan"), "p90": float("nan")}
    p50, p90 = np.percentile(v, [50, 90])
    return {"p50": round(float(p50), 1), "p90": round(float(p90), 1)}


# ---------------------------------------------------------------- Marte

_tls = threading.local()


def _http_range(url: str, a: int, b: int, tries: int = 6) -> bytes:
    """Bytes [a, b] de `url` (servidor del USGS), con reintentos."""
    s = getattr(_tls, "s", None)
    if s is None:
        s = _tls.s = requests.Session()
    err = "sin intentos"
    for k in range(tries):
        try:
            with _sem("usgs"):
                with s.get(url, headers={"Range": f"bytes={a}-{b}", "Accept-Encoding": "identity"},
                           stream=True, timeout=60) as r:
                    content_range = r.headers.get("Content-Range", "")
                    if r.status_code == 206 and content_range.startswith(f"bytes {a}-{b}/"):
                        size = b - a + 1
                        data = bytearray()
                        for chunk in r.iter_content(min(size + 1, 64 * 1024)):
                            data.extend(chunk)
                            if len(data) > size:
                                break
                        if len(data) == size:
                            return bytes(data)
                        err = f"tamaño de rango incorrecto ({len(data)} B; se esperaban {size})"
                    else:
                        err = f"HTTP {r.status_code}, Content-Range: {content_range}"
        except requests.RequestException as exc:
            err = repr(exc)
        if k + 1 < tries:
            time.sleep(1.5 * (k + 1))
    raise IOError(f"rango {a}-{b} de {url}: {err}")


_MARS_META: dict[str, dict] = {}


def _mars_meta(source: str) -> dict:
    """Geometría del GeoTIFF y offset del primer strip (verificando que los strips son contiguos)."""
    if source in _MARS_META:
        return _MARS_META[source]
    d = CACHE / "mars"
    d.mkdir(parents=True, exist_ok=True)
    path = d / f"{source}_meta.json"
    url = MARS_SOURCES[source]
    if path.exists():
        m = json.loads(path.read_text(encoding="utf-8"))
    else:
        with rasterio.Env(**GDAL_HTTP), _sem("usgs"), rasterio.open(url) as src:
            assert src.dtypes[0] == "int16" and src.block_shapes[0] == (1, src.width), "se esperaba int16, 1 fila por strip"
            W, H = src.width, src.height
            offs = {r: int(src.get_tag_item(f"BLOCK_OFFSET_0_{r}", "TIFF", bidx=1)) for r in (0, 1, H // 2, H - 1)}
            sizes = {int(src.get_tag_item(f"BLOCK_SIZE_0_{r}", "TIFF", bidx=1)) for r in (0, H - 1)}
            base = offs[0]
            if any(o != base + r * W * 2 for r, o in offs.items()) or sizes != {W * 2}:
                raise RuntimeError(f"{source}: strips no contiguos {offs} {sizes}")
            m = dict(url=url, W=W, H=H, transform=list(src.transform)[:6], crs=src.crs.to_wkt(),
                     geographic=bool(src.crs.is_geographic), nodata=src.nodata,
                     scale=src.scales[0], offset=src.offsets[0], base=base)
        m["byteorder"] = "<" if _http_range(url, 0, 1) == b"II" else ">"
        tr = m["transform"]
        m["px_m"] = abs(tr[4]) * (math.pi * SOURCE_R[source] / 180 if m["geographic"] else 1.0)
        tmp = path.with_suffix(f".{os.getpid()}_{threading.get_ident()}.tmp")
        tmp.write_text(json.dumps(m, indent=1), encoding="utf-8")
        os.replace(tmp, path)
    m["R"] = SOURCE_R[source]
    _MARS_META[source] = m
    return m


def _mars_rowcol(m: dict, la: np.ndarray, lo: np.ndarray, lon_c: float):
    """lat/lon -> fila/columna (centro de píxel); columnas desenvueltas cerca de la del centro."""
    a, _, c, _, e, f = m["transform"]
    k = 1.0 if m["geographic"] else math.pi * m["R"] / 180
    cols = (lo * k - c) / a - 0.5
    rows = (la * k - f) / e - 0.5
    cc = (lon_c * k - c) / a - 0.5
    W = m["W"]
    cols = cols + W * np.round((cc - cols) / W)
    return rows, cols


def _read_mars_crop(m: dict, r0: int, nr: int, c0: int, nc: int) -> np.ndarray:
    """Filas r0..r0+nr y columnas c0..c0+nc (módulo W) en int16, una petición por fila (≤ 8 a la vez)."""
    W, url, base = m["W"], m["url"], m["base"]
    dt = np.dtype(m["byteorder"] + "i2")
    out = np.empty((nr, nc), dtype=dt)
    full = nc >= W
    if full:  # filas completas: varias por petición
        k = 16

        def job(i):
            q = min(k, nr - i)
            a = base + (r0 + i) * W * 2
            out[i:i + q] = np.frombuffer(_http_range(url, a, a + q * W * 2 - 1), dtype=dt).reshape(q, W)
        starts = range(0, nr, k)
    else:
        segs, c, left, dst = [], c0 % W, nc, 0
        while left > 0:
            take = min(left, W - c)
            segs.append((c, take, dst))
            dst, left, c = dst + take, left - take, 0

        def job(i):
            for c, take, d in segs:
                a = base + ((r0 + i) * W + c) * 2
                out[i, d:d + take] = np.frombuffer(_http_range(url, a, a + take * 2 - 1), dtype=dt)
        starts = range(nr)
    list(_pool("usgs").map(job, starts))
    return out.astype("<i2")


_MARS_CROPS = _Lru(12)
_MARS_INDEX_LOCK = threading.Lock()


def _mars_crops(source: str) -> list[dict]:
    return [json.loads(p.read_text(encoding="utf-8")) for p in (CACHE / "mars").glob(f"{source}_crop_*.json")]


def _find_crop(m: dict, source: str, r0: int, r1: int, c0: int, c1: int):
    """Recorte guardado que contiene filas r0..r1 y columnas c0..c1 -> (info, desplazamiento de columna)."""
    W = m["W"]
    for info in _mars_crops(source):
        if not (info["r0"] <= max(r0, 0) and min(r1, m["H"]) <= info["r0"] + info["nr"]):
            continue
        if info["nc"] >= W:
            return info, None
        for shift in (0, W, -W):
            if info["c0"] <= c0 + shift and c1 + shift <= info["c0"] + info["nc"]:
                return info, shift
    return None, None


def _mars_values(source: str, la: np.ndarray, lo: np.ndarray, lat: float, lon: float, window_km: float):
    """Valores bilineales del DEM de Marte en (la, lo), usando o creando un recorte en caché."""
    m = _mars_meta(source)
    W, H = m["W"], m["H"]
    rows, cols = _mars_rowcol(m, la, lo, lon)
    r0, r1 = int(np.floor(rows.min())) - 1, int(np.ceil(rows.max())) + 2
    c0, c1 = int(np.floor(cols.min())) - 1, int(np.ceil(cols.max())) + 2
    with _MARS_INDEX_LOCK:
        info, shift = _find_crop(m, source, r0, r1, c0, c1)
    if info is None:
        # recorte con margen: malla gruesa (~1 km) de la ventana + MARS_MARGIN_KM por lado
        wk = window_km + 2 * MARS_MARGIN_KM
        _, gla, glo = _grid(lat, lon, wk, wk * 1000 / 101, 1, m["R"])
        grows, gcols = _mars_rowcol(m, gla, glo, lon)
        pad = int(math.ceil(1500 / m["px_m"]))
        mr0 = max(min(r0, int(np.floor(grows.min())) - pad), 0)
        mr1 = min(max(r1, int(np.ceil(grows.max())) + pad), H)
        mc0 = min(c0, int(np.floor(gcols.min())) - pad)
        mc1 = max(c1, int(np.ceil(gcols.max())) + pad)
        if mc1 - mc0 > W / 2:
            mc0, mc1 = 0, W
        arr = _read_mars_crop(m, mr0, mr1 - mr0, mc0, mc1 - mc0)
        info = dict(source=source, r0=mr0, nr=mr1 - mr0, c0=mc0, nc=mc1 - mc0,
                    lat=lat, lon=lon, window_km=window_km, margin_km=MARS_MARGIN_KM)
        stem = f"{source}_crop_r{mr0}_c{mc0}_{mr1 - mr0}x{mc1 - mc0}"
        info["file"] = stem + ".npy"
        d = CACHE / "mars"
        tmp = d / f"{stem}.{os.getpid()}_{threading.get_ident()}.tmp.npy"
        np.save(tmp, arr)
        os.replace(tmp, d / info["file"])
        tmp = tmp.with_suffix(".json")
        tmp.write_text(json.dumps(info), encoding="utf-8")
        os.replace(tmp, d / (stem + ".json"))
        _MARS_CROPS.get(info["file"], lambda: arr)
        shift = None if info["nc"] >= W else 0
    raw = _MARS_CROPS.get(info["file"], lambda: np.load(CACHE / "mars" / info["file"]))
    a = raw.astype("float32")
    if m["nodata"] is not None:
        a[raw == m["nodata"]] = np.nan
    a = a * m["scale"] + m["offset"]
    rr = rows - info["r0"]
    if shift is None:  # recorte de ancho completo: envuelve columnas
        a = np.concatenate([a[:, -2:], a, a[:, :3]], axis=1)
        cc = np.mod(cols, W) + 2
    else:
        cc = cols + shift - info["c0"]
    return ndimage.map_coordinates(a, [rr, cc], order=1, mode="constant", cval=np.nan)


def sample_mars(lat: float, lon: float, window_km: float, px: float, sup: int | None = None,
                source: str = "blend") -> np.ndarray:
    """Ventana local de Marte a `px` m: source="blend" (HRSC+MOLA 200 m) o "mola" (463 m)."""
    m = _mars_meta(source)
    sup = sup or max(1, math.ceil(px / m["px_m"] - 1e-6))
    n, la, lo = _grid(lat, lon, window_km, px, sup, m["R"])
    v = _mars_values(source, la.ravel(), lo.ravel(), lat, lon, window_km)
    return _block_mean(v, n, sup)


def sample_moon_sldem(lat: float, lon: float, window_km: float, px: float, sup: int | None = None) -> np.ndarray:
    """Ventana local de la Luna fuera del polo (60°S–60°N) a `px` m con SLDEM2015 (59,2 m)."""
    if abs(lat) > 59:
        raise ValueError(f"SLDEM2015 solo cubre 60°S–60°N (lat {lat})")
    return sample_mars(lat, lon, window_km, px, sup, source="sldem")


def _hf(z: np.ndarray, sigma_px: float) -> float:
    z = np.where(np.isnan(z), np.nanmean(z), z)
    return float((z - ndimage.gaussian_filter(z, sigma_px))[6:-6, 6:-6].std())


def hrsc_check(lat: float, lon: float, window_km: float = 40) -> dict:
    """¿Tiene el blend detalle HRSC aquí o es solo MOLA? (umbrales medidos en la fase A:
    Jezero, Gale y Meridiani = HRSC; InSight y Zhurong = solo MOLA; NO verificado con una
    fuente sobre la cobertura real del blend)."""
    px = _mars_meta("blend")["px_m"]
    zb = sample_mars(lat, lon, window_km, px, sup=1, source="blend")
    zm = sample_mars(lat, lon, window_km, px, sup=1, source="mola")  # MOLA interpolado a la misma malla
    s = 400 / px
    hm = _hf(zm, s)
    r400 = _hf(zb, s) / hm if hm > 0 else float("inf")
    d = (zb - zm)[6:-6, 6:-6]
    d = d[np.isfinite(d)]
    eq1m = float((np.abs(d - np.median(d)) < 1).mean()) if d.size else float("nan")
    if r400 >= 1.35 and eq1m < 0.15:
        clase = "hrsc"
    elif r400 < 1.15 or eq1m > 0.25:
        clase = "solo_mola"
    else:
        clase = "dudoso"
    return {"R400": round(float(r400), 3), "eq1m": round(eq1m, 3), "clase": clase}


# ---------------------------------------------------------------- Tierra

def _parse_cop_id(item_id: str) -> tuple[int, int]:
    """'Copernicus_DSM_COG_30_N23_00_E010_00_DEM' -> (23, 10)."""
    m = re.search(r"_([NS])(\d+)_00_([EW])(\d+)_00", item_id)
    lat0 = int(m.group(2)) * (1 if m.group(1) == "N" else -1)
    lon0 = int(m.group(4)) * (1 if m.group(3) == "E" else -1)
    return lat0, lon0


def tile_key(lat: float, lon: float) -> str:
    """Clave del tile de 1° que contiene el punto, p. ej. 'N23E010' o 'S01W072'."""
    lat0, lon0 = math.floor(lat), math.floor((lon + 180) % 360 - 180)
    return f"{'N' if lat0 >= 0 else 'S'}{abs(lat0):02d}{'E' if lon0 >= 0 else 'W'}{abs(lon0):03d}"


_GLO90: dict[str, dict] | None = None
_GLO90_LOCK = threading.Lock()


def _glo90_items() -> dict[str, dict]:
    global _GLO90
    with _GLO90_LOCK:
        if _GLO90 is None:
            _GLO90 = {it["key"]: it for it in _load_glo90_index()}
        return _GLO90


def glo90_index() -> list[dict]:
    """Todos los tiles de cop-dem-glo-90 (id, key, bbox, lat0, lon0, href sin firmar),
    guardados una vez en data/cache/glo90_index.json."""
    return list(_glo90_items().values())


def _load_glo90_index() -> list[dict]:
    path = CACHE / "glo90_index.json"
    if path.exists():
        items = json.loads(path.read_text(encoding="utf-8"))
    else:
        from pystac_client import Client
        t = time.time()
        with _sem("pc"):
            search = Client.open(STAC_URL).search(collections=["cop-dem-glo-90"], limit=1000)
            items = []
            for it in search.items_as_dicts():
                lat0, lon0 = _parse_cop_id(it["id"])
                bb = it["bbox"]
                assert (lat0, lon0) == (math.floor(bb[1] + 0.5), math.floor(bb[0] + 0.5)), it["id"]
                items.append({"id": it["id"], "key": tile_key(lat0 + 0.5, lon0 + 0.5),
                              "bbox": [round(x, 6) for x in bb], "lat0": lat0, "lon0": lon0,
                              "href": it["assets"]["data"]["href"].split("?")[0]})
        CACHE.mkdir(parents=True, exist_ok=True)
        tmp = path.with_suffix(f".{os.getpid()}.tmp")
        tmp.write_text(json.dumps(items), encoding="utf-8")
        os.replace(tmp, path)
        print(f"índice GLO-90: {len(items)} tiles en {time.time() - t:.0f} s", flush=True)
    return items


def _read_cog(href: str, window=None, out_shape=None, resampling=Resampling.nearest, server="pc"):
    """Lee la banda 1 de un COG del Planetary Computer (firma, semáforo, reintentos)
    -> (array, transform, nodata, bounds). `window` y `out_shape` pueden ser funciones del dataset."""
    for k in range(4):
        try:
            with ExitStack() as st:
                if server == "wc":
                    st.enter_context(_sem("wc"))
                st.enter_context(_sem("pc"))
                st.enter_context(rasterio.Env(**GDAL_HTTP))
                with rasterio.open(planetary_computer.sign(href)) as src:
                    win = window(src) if callable(window) else window
                    shape = out_shape(src) if callable(out_shape) else out_shape
                    arr = src.read(1, window=win, out_shape=shape, resampling=resampling)
                    tr = src.window_transform(win) if win is not None else src.transform
                    if shape is not None:
                        h, w = shape
                        sh = (win.height, win.width) if win is not None else (src.height, src.width)
                        tr = tr @ tr.scale(sh[1] / w, sh[0] / h)
                    return arr, tr, src.nodata, src.bounds
        except rasterio.errors.RasterioIOError as exc:
            if k == 3:
                raise
            print(f"  reintento {k + 1} {href.rsplit('/', 1)[-1]}: {exc}", flush=True)
            time.sleep(3 * (k + 1))


_GLO90_TILES = _Lru(64)


def read_glo90_tile(key_or_item):
    """Tile GLO-90 entero (un único bloque COG) -> (z float32 con NaN, transform), o None si no
    existe (océano). Acepta la clave ('N23E010'), una entrada de glo90_index() o un pystac.Item."""
    if isinstance(key_or_item, str):
        it = _glo90_items().get(key_or_item)
        if it is None:
            return None
        key, href = it["key"], it["href"]
    elif isinstance(key_or_item, dict):
        key, href = key_or_item["key"], key_or_item["href"]
    else:
        lat0, lon0 = _parse_cop_id(key_or_item.id)
        key, href = tile_key(lat0 + 0.5, lon0 + 0.5), key_or_item.assets["data"].href.split("?")[0]

    def load():
        arr, tr, nod, _ = _read_cog(href)
        arr = arr.astype("float32")
        if nod is not None:
            arr[arr == nod] = np.nan
        return arr, tr
    return _GLO90_TILES.get(key, load)


_GLO30_ITEMS: dict[str, str | None] = {}


def _glo30_href(key: str, lat0: int, lon0: int) -> str | None:
    if key not in _GLO30_ITEMS:
        bbox = [lon0 + 0.4, lat0 + 0.4, lon0 + 0.6, lat0 + 0.6]
        with _sem("pc"):
            items = [it for it in client().search(collections=["cop-dem-glo-30"], bbox=bbox).items()
                     if _parse_cop_id(it.id) == (lat0, lon0)]
        _GLO30_ITEMS[key] = items[0].assets["data"].href.split("?")[0] if items else None
    return _GLO30_ITEMS[key]


def _glo30_values(key: str, lat0: int, lon0: int, la: np.ndarray, lo: np.ndarray) -> np.ndarray:
    href = _glo30_href(key, lat0, lon0)
    if href is None:
        return np.full(la.shape, np.nan, dtype="float32")
    def win(src):  # ventana del COG que cubre los puntos (se leen solo sus bloques de 1024²)
        cols, rows = ~src.transform * (lo, la)
        r0, r1 = max(int(np.floor(rows.min())) - 2, 0), min(int(np.ceil(rows.max())) + 2, src.height)
        c0, c1 = max(int(np.floor(cols.min())) - 2, 0), min(int(np.ceil(cols.max())) + 2, src.width)
        return Window(c0, r0, c1 - c0, r1 - r0)
    arr, tr, nod, _ = _read_cog(href, window=win)
    arr = arr.astype("float32")
    if nod is not None:
        arr[arr == nod] = np.nan
    cols, rows = ~tr * (lo, la)
    return ndimage.map_coordinates(arr, [rows - 0.5, cols - 0.5], order=1, mode="nearest")


def sample_earth(lat: float, lon: float, window_km: float, px: float,
                 collection: str = "cop-dem-glo-90", sup: int | None = None) -> np.ndarray:
    """Ventana local de la Tierra (Copernicus GLO-90 o GLO-30) a `px` m."""
    native = EARTH_NATIVE[collection]
    sup = sup or max(1, math.ceil(px / native - 1e-6))
    n, la, lo = _grid(lat, lon, window_km, px, sup, EARTH_R)
    la, lo = la.ravel(), lo.ravel()
    lat0s, lon0s = np.floor(la).astype(int), np.floor(lo).astype(int)
    groups: dict[tuple[int, int], np.ndarray] = {}
    for t in set(zip(lat0s.tolist(), lon0s.tolist())):
        groups[t] = np.flatnonzero((lat0s == t[0]) & (lon0s == t[1]))
    v = np.full(la.shape, np.nan, dtype="float32")

    def job(t):
        idx = groups[t]
        key = tile_key(t[0] + 0.5, t[1] + 0.5)
        if collection == "cop-dem-glo-30":
            return idx, _glo30_values(key, t[0], t[1], la[idx], lo[idx])
        tile = read_glo90_tile(key)
        if tile is None:
            return idx, None
        arr, tr = tile
        cols, rows = ~tr * (lo[idx], la[idx])
        return idx, ndimage.map_coordinates(arr, [rows - 0.5, cols - 0.5], order=1, mode="nearest")
    if collection == "cop-dem-glo-90":
        _glo90_items()
    for idx, vals in _pool("pc").map(job, list(groups)):
        if vals is not None:
            v[idx] = vals
    return _block_mean(v, n, sup)


_WC_TILES = _Lru(16)


def _wc_tile(lat3: int, lon3: int):
    """Tile WorldCover de 3°×3° a ~120 m (moda), en disco en data/cache/wc120/ -> (clases, bounds) o None."""
    key = f"{'N' if lat3 >= 0 else 'S'}{abs(lat3):02d}{'E' if lon3 >= 0 else 'W'}{abs(lon3):03d}"

    def load():
        d = CACHE / "wc120"
        path = d / f"{key}.npz"
        if path.exists():
            z = np.load(path)
            return (z["cls"], tuple(z["bounds"])) if z["cls"].size else None
        d.mkdir(parents=True, exist_ok=True)
        bbox = [lon3 + 1.4, lat3 + 1.4, lon3 + 1.6, lat3 + 1.6]
        with _sem("pc"):
            items = list(client().search(collections=["esa-worldcover"], bbox=bbox, query=WC_QUERY).items())
        items = [it for it in items if it.id.endswith(f"_{key}")] or items
        if not items:
            cls, bounds = np.zeros((0, 0), dtype="uint8"), (0, 0, 0, 0)
        else:
            href = items[0].assets["map"].href.split("?")[0]
            arr, _, nod, b = _read_cog(href, out_shape=lambda src: (src.height // WC_FACTOR, src.width // WC_FACTOR),
                                       resampling=Resampling.mode, server="wc")
            cls, bounds = arr.astype("uint8"), (b.left, b.bottom, b.right, b.top)
        tmp = d / f"{key}.{os.getpid()}_{threading.get_ident()}.tmp.npz"
        np.savez_compressed(tmp, cls=cls, bounds=np.array(bounds, dtype="float64"))
        os.replace(tmp, path)
        return (cls, bounds) if cls.size else None
    return _WC_TILES.get(key, load)


def worldcover_classes(lat_arr, lon_arr) -> np.ndarray:
    """Clase ESA WorldCover 2021 (0 = sin dato) a ~120 m en cada punto (vecino más próximo)."""
    la = np.asarray(lat_arr, dtype="float64")
    lo = (np.asarray(lon_arr, dtype="float64") + 180) % 360 - 180
    out = np.zeros(la.shape, dtype="uint8")
    k3 = (np.floor(la / 3).astype(int) * 3, np.floor(lo / 3).astype(int) * 3)
    keys = sorted(set(zip(k3[0].ravel().tolist(), k3[1].ravel().tolist())))

    def job(t):
        return t, _wc_tile(*t)
    for (lat3, lon3), tile in _pool("wc").map(job, keys):
        if tile is None:
            continue
        cls, (left, bottom, right, top) = tile
        m = (k3[0] == lat3) & (k3[1] == lon3)
        h, w = cls.shape
        r = np.clip(((top - la[m]) / (top - bottom) * h).astype(int), 0, h - 1)
        c = np.clip(((lo[m] - left) / (right - left) * w).astype(int), 0, w - 1)
        out[m] = cls[r, c]
    return out


def earth_cover(lat: float, lon: float, window_km: float, px: float) -> dict | None:
    """Fracciones de cada clase de WorldCover (nombres de earth_scan.COVER_CLASSES) sobre los
    píxeles con dato, muestreando a ~120 m; None si más del 50 % de la ventana no tiene dato."""
    sub = max(1, int(round(px / (10 * WC_FACTOR))))
    _, la, lo = _grid(lat, lon, window_km, px, sub, EARTH_R)
    cls = worldcover_classes(la, lo)
    ok = cls > 0
    if ok.mean() < 0.5:
        return None
    v = cls[ok]
    return {name: round(float((v == k).mean()), 4) for k, name in COVER_CLASSES.items()}


# ---------------------------------------------------------------- autoprueba

def _fmt(d: dict | None) -> str:
    if d is None:
        return "None"
    return " ".join(f"{k}={v:.4g}" if isinstance(v, float) else f"{k}={v}" for k, v in d.items())


def _cmp(name: str, a: dict | None, b: dict | None) -> None:
    print(f"  {name}")
    if a is None or b is None:
        print(f"    a={a}\n    b={b}")
        return
    for k in a:
        if k in b and b[k] is not None:
            print(f"    {k:11s} {a[k]:10.4g} {b[k]:10.4g}")


def selftest() -> None:
    from .references import MOON_DEM
    from .terrain import sample_planet_dem, shape_features, terrain_features

    set_max_per_server(4)
    t0 = time.time()

    def feats(z, px):
        f = terrain_features(z, px)
        s = shape_features(z, px)
        return None if f is None else {**f, **(s or {})}

    print("== Luna: PGDA 40 m frente a LOLA 118 m global (30 km a 400 m)")
    ensure_moon_cache()
    with rasterio.open(CACHE / "moon" / MOON_DEM_URL.rsplit("/", 1)[1]) as src:
        print(f"  CRS: {src.crs.to_proj4()} | {src.width}x{src.height} px de {src.res[0]:.1f} m | "
              f"nodata={src.nodata} | escala={src.scales[0]} offset={src.offsets[0]} | unidades={src.units}")
    with rasterio.open(CACHE / "moon" / MOON_EFFRES_URL.rsplit("/", 1)[1]) as src:
        print(f"  EFFRES: {src.dtypes[0]} nodata={src.nodata} unidades={src.units} desc={src.descriptions} "
              f"tags={ {k: v[:80] for k, v in src.tags().items()} }")
    for name, lat, lon in [("Shackleton", -89.67, 129.78), ("Malapert", -85.98, -1.67), ("Haworth", -86.7, -23.7)]:
        t = time.time()
        zp = sample_moon(lat, lon, 30, 400)
        tp = time.time() - t
        cpath = CACHE / "moon" / f"lola118_check_{lat:+.2f}_{lon:+.2f}.npy"
        t = time.time()
        if cpath.exists():
            zl = np.load(cpath)
        else:
            zl = sample_planet_dem(MOON_DEM, MOON_R, lat, lon, 30, 400)
            np.save(cpath, zl)
        tl = time.time() - t
        d = zp - zl
        print(f"  {name} ({lat}, {lon}): media PGDA {np.nanmean(zp):8.1f} m  LOLA118 {np.nanmean(zl):8.1f} m  "
              f"dif media {np.nanmean(d):6.1f} m  std dif {np.nanstd(d):6.1f} m  corr {np.corrcoef(zp.ravel(), zl.ravel())[0, 1]:.4f}  "
              f"NaN {np.isnan(zp).mean():.3f}  ({tp:.1f} s / {tl:.1f} s)")
        _cmp("rasgos PGDA | LOLA118", feats(zp, 400), feats(zl, 400))

    print("== Luna: EFFRES (m) en ventanas de 10 km")
    for name, lat, lon in [("Shackleton", -89.67, 129.78), ("Malapert", -85.98, -1.67),
                           ("Haworth", -86.7, -23.7), ("Peak near Cabeus B", -83.6, -68.8)]:
        print(f"  {name:20s} {moon_effres(lat, lon, 10)}")

    print("== Marte: Jezero (18.4446, 77.4509), blend a 30 km / 400 m frente a references.json (v1)")
    ref = {r["id"]: r for r in json.loads((PIPE / "data" / "references.json").read_text(encoding="utf-8"))}
    t = time.time()
    zj = sample_mars(18.4446, 77.4509, 30, 400)
    t1 = time.time() - t
    t = time.time()
    sample_mars(18.4446, 77.4509, 10, 200)  # debe salir de la caché de recortes
    print(f"  lectura {t1:.1f} s, segunda (10 km a 200 m, caché) {time.time() - t:.2f} s, media {np.nanmean(zj):.1f} m")
    _cmp("rasgos nuevos | v1", feats(zj, 400), ref["jezero"]["features"])
    for name, lat, lon in [("Jezero", 18.4446, 77.4509), ("InSight", 4.5024, 135.6234)]:
        t = time.time()
        print(f"  hrsc_check {name}: {hrsc_check(lat, lon)} ({time.time() - t:.1f} s)")

    print("== Tierra: ventana del escaneo (band_+23), 30 km / 400 m")
    band = json.loads((PIPE / "data" / "earth" / "band_+23.json").read_text(encoding="utf-8"))
    w = max((x for x in band if x["cover"] is not None), key=lambda x: x["features"]["relief"])
    print(f"  ventana ({w['lat']}, {w['lon']}), elev_mean guardada {w['elev_mean']:.1f} m")
    t = time.time()
    ze = sample_earth(w["lat"], w["lon"], 30, 400)
    print(f"  GLO-90: {time.time() - t:.1f} s, media {np.nanmean(ze):.1f} m, NaN {np.isnan(ze).mean():.3f}")
    _cmp("rasgos nuevos | escaneo", feats(ze, 400), w["features"])
    t = time.time()
    _cmp("earth_cover | cover del escaneo", earth_cover(w["lat"], w["lon"], 30, 400), w["cover"])
    print(f"  ({time.time() - t:.1f} s)")
    t = time.time()
    z30 = sample_earth(w["lat"], w["lon"], 2, 30, collection="cop-dem-glo-30")
    z90 = sample_earth(w["lat"], w["lon"], 2, 30)
    print(f"  GLO-30 2 km / 30 m: {time.time() - t:.1f} s, media {np.nanmean(z30):.1f} m (GLO-90 a la misma malla "
          f"{np.nanmean(z90):.1f} m), std dif {np.nanstd(z30 - z90):.1f} m")
    print(f"  rasgos GLO-30: {_fmt(feats(z30, 30))}")
    print(f"autoprueba en {time.time() - t0:.0f} s")


if __name__ == "__main__":
    if "--moon-cache" in sys.argv:
        print(ensure_moon_cache())
    if "--selftest" in sys.argv:
        selftest()
