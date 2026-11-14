"""Escaneo fino de la Tierra (niveles L1 y L2), por partes y reanudable.

L1 (`--level 1`): lee data/fine_tiles.json (lo escribe rank) y, para cada tile GLO-90 de 1°,
  lo descarga entero una vez (dem_io.read_glo90_tile) y lo corta en ventanas de 10 km en una
  malla alineada dentro del tile (floor(alto_km/10) filas × floor(ancho_km/10) columnas, centradas).
  Cada ventana se muestrea en malla local azimutal a 120 m (Luna) y 200 m (Marte) desde el array
  en memoria. Salida: <out>/l1/<tile>.json (lista de ventanas; [] si el tile es océano).
L2 (`--level 2`): lee data/fine_l2_blocks.json y, por bloque, lee GLO-30 una vez (12 km a 30 m,
  dem_io.sample_earth) y corta: Luna 5 km a 60 m (media 2×2 de 30 m) con paso 2,5 km (3×3 centros)
  y Marte 2 km a 30 m con paso 1 km (9×9 centros de −4 a +4 km). Salida: <out>/l2/<id>.json.

En cada ventana: terrain_features y shape_features al píxel de su nivel, elev_mean y cover
(fracciones de ESA WorldCover 2021 sobre los puntos con dato; None si > 50 % sin dato).
WorldCover se lee de la caché de dem_io a ~120 m, también en L2 (más grueso que el píxel de L2).
Se descartan las ventanas de océano o sin dato como en earth_scan.scan_band: NaN > 10 %,
ceros > 30 % o agua de WorldCover > 50 %.

Lecturas en hilos (≤ 8 a la vez por servidor, WorldCover ≤ 4, lo limita dem_io); el cálculo de
rasgos va a procesos aparte (--procs) porque con hilos lo frena el GIL. Los archivos ya escritos
se saltan, así que se puede cortar y relanzar, o repartir con --part/--of en varios procesos.
Los MB son aproximados: suma de los rangos que GDAL dice descargar (CPL_DEBUG), sin STAC ni TLS.

Ejecutar desde pipeline/:
  python -m analogs.fine_scan --level 1 [--tiles-file RUTA] [--out DIR] [--part i --of N] [--limit K]
                              [--threads 8] [--procs 6]
  python -m analogs.fine_scan --level 2 [--blocks-file RUTA] [--out DIR] [...igual]
Registro: <out>/../fine_scan_l1.log y fine_scan_l2.log (con --out por defecto, data/fine_scan_l*.log).
"""

from __future__ import annotations

import argparse
import importlib
import json
import logging
import math
import os
import re
import sys
import threading
import time
from concurrent.futures import ProcessPoolExecutor, ThreadPoolExecutor
from pathlib import Path

os.environ.setdefault("CPL_DEBUG", "ON")  # GDAL anuncia cada rango que descarga: así se cuentan los MB

import numpy as np
from scipy import ndimage

from . import dem_io
from .dem_io import EARTH_R, _block_mean, _grid
from .earth_scan import COVER_CLASSES
from .terrain import _aeqd_inverse, shape_features, terrain_features

DATA = Path(__file__).resolve().parent.parent / "data"
TILES_FILE = DATA / "fine_tiles.json"
BLOCKS_FILE = DATA / "fine_l2_blocks.json"
OUT_DIR = DATA / "fine"

KM_DEG = math.pi * EARTH_R / 180 / 1000     # km por grado de latitud en la esfera (111,195)
L1_KM = 10.0
L1_PX = {"moon": 120.0, "mars": 200.0}
L2_BLOCK_KM, L2_PX_READ = 12.0, 30.0
L2 = {"moon": dict(km=5.0, px=60.0, step_km=2.5, half=1),    # 3×3 centros: −2,5, 0, +2,5 km
      "mars": dict(km=2.0, px=30.0, step_km=1.0, half=4)}    # 9×9 centros: −4 … +4 km
COVER_PX = 120.0                                              # malla de WorldCover en L1


# ---------------------------------------------------------------- utilidades

def _r(v: float) -> float:
    return float(f"{v:.5g}")  # 5 cifras significativas (curv_p90 es del orden de 1e-4)


def _rd(d: dict | None) -> dict | None:
    return None if d is None else {k: _r(v) for k, v in d.items()}


def _write_json(path: Path, obj) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_name(f"{path.name}.{os.getpid()}_{threading.get_ident()}.tmp")
    tmp.write_text(json.dumps(obj, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, path)


def _parse_key(key: str) -> tuple[int, int]:
    """'N23E010' -> (23, 10); 'S01W072' -> (-1, -72)."""
    m = re.fullmatch(r"([NS])(\d{2})([EW])(\d{3})", key)
    if m is None:
        raise ValueError(f"clave de tile no válida: {key!r}")
    return (int(m[2]) * (1 if m[1] == "N" else -1), int(m[4]) * (1 if m[3] == "E" else -1))


def _safe_id(s: str) -> str:
    return re.sub(r"[^A-Za-z0-9_.-]", "_", str(s))


class _Red(logging.Handler):
    """Suma los bytes de los mensajes 'VSICURL: Downloading a-b' que GDAL envía al logging de rasterio."""
    RANGO = re.compile(r"(\d+)-(\d+)")

    def __init__(self):
        super().__init__(logging.DEBUG)
        self.bytes, self.peticiones = 0, 0
        self.lk = threading.Lock()

    def emit(self, record):
        msg = record.getMessage()
        if "VSICURL: Downloading" not in msg:
            return
        n = sum(int(b) - int(a) + 1 for a, b in self.RANGO.findall(msg.split("(http")[0]))
        with self.lk:
            self.bytes += n
            self.peticiones += 1

    def mb(self) -> float:
        return self.bytes / 1e6


RED = _Red()


class _Registro:
    """Escribe en consola y en el archivo de registro (añadiendo)."""

    def __init__(self, path: Path):
        self.path, self.lk = path, threading.Lock()
        path.parent.mkdir(parents=True, exist_ok=True)

    def __call__(self, msg: str) -> None:
        line = f"{time.strftime('%Y-%m-%d %H:%M:%S')} {msg}"
        with self.lk:
            print(line, flush=True)
            with open(self.path, "a", encoding="utf-8") as f:
                f.write(line + "\n")


def _ocean(z: np.ndarray) -> bool:
    return bool(np.isnan(z).mean() > 0.1 or (z == 0).mean() > 0.3)


def _cover(cls: np.ndarray) -> tuple[dict | None, bool]:
    """Fracciones de WorldCover sobre los puntos con dato -> (cover o None, ¿es agua > 50 %?)."""
    ok = cls > 0
    if ok.mean() < 0.5:
        return None, False
    v = cls[ok]
    fr = {name: round(float((v == k).mean()), 4) for k, name in COVER_CLASSES.items()}
    return fr, fr["water"] > 0.5


def _body(z: np.ndarray, px: float) -> dict | None:
    f = terrain_features(z, px)
    if f is None:
        return None
    return {"features": _rd(f), "shape": _rd(shape_features(z, px))}


# ---------------------------------------------------------------- L1

def l1_centers(key: str) -> list[tuple[float, float]]:
    """Centros (lat, lon) de las ventanas de 10 km dentro del tile: filas = floor(alto_km/10) y, en
    cada fila, columnas = floor(ancho_km/10) con el ancho medido en el borde más cercano al polo
    (así la ventana cabe entera en el tile). Paso en longitud = 10 km a la latitud de la fila."""
    lat0, lon0 = _parse_key(key)
    nrow = int(KM_DEG // L1_KM)
    dlat = L1_KM / KM_DEG
    out = []
    for i in range(nrow):
        la = lat0 + 0.5 + ((nrow - 1) / 2 - i) * dlat     # fila 0 = norte
        edge = min(abs(la) + dlat / 2, 89.999)
        ncol = int(KM_DEG * math.cos(math.radians(edge)) // L1_KM)
        if ncol < 1:
            continue
        dlon = L1_KM / (KM_DEG * math.cos(math.radians(la)))
        for j in range(ncol):
            out.append((la, lon0 + 0.5 + (j - (ncol - 1) / 2) * dlon))
    return out


def _row_grid(lat: float, lon: float, km: float, px: float, sup: int, cache: dict):
    """Como dem_io._grid, pero calcula la proyección una vez por (latitud, píxel): en la esfera, la malla
    de una ventana desplazada en longitud es la misma con la longitud desplazada."""
    k = (lat, km, px, sup)
    if k not in cache:
        cache[k] = _grid(lat, 0.0, km, px, sup, EARTH_R)
    n, la, lo = cache[k]
    return n, la, lo + lon


def _sample_tile(arr: np.ndarray, tr, lat: float, lon: float, px: float, cache: dict) -> np.ndarray:
    """Ventana local de L1_KM a `px` m desde el tile en memoria (como dem_io.sample_earth)."""
    sup = max(1, math.ceil(px / dem_io.EARTH_NATIVE["cop-dem-glo-90"] - 1e-6))
    n, la, lo = _row_grid(lat, lon, L1_KM, px, sup, cache)
    cols, rows = ~tr * (lo.ravel(), la.ravel())
    v = ndimage.map_coordinates(arr, [rows - 0.5, cols - 0.5], order=1, mode="nearest")
    return _block_mean(v, n, sup)


def _l1_compute(key: str, control: bool, arr: np.ndarray, tr, centers: list, cls: list) -> list[dict]:
    """Rasgos de todas las ventanas de un tile (se ejecuta en un proceso aparte)."""
    res, cache = [], {}
    for (lat, lon), c in zip(centers, cls):
        z = _sample_tile(arr, tr, lat, lon, L1_PX["moon"], cache)
        if _ocean(z):
            continue
        cover, agua = _cover(c) if c is not None else (None, False)
        if agua:
            continue
        moon = _body(z, L1_PX["moon"])
        if moon is None:
            continue
        mars = _body(_sample_tile(arr, tr, lat, lon, L1_PX["mars"], cache), L1_PX["mars"])
        res.append({"lat": round(lat, 5), "lon": round(lon, 5), "tile": key, "control": control,
                    "elev_mean": round(float(np.nanmean(z)), 1), "moon": moon, "mars": mars, "cover": cover})
    return res


def _load_tiles(path: Path) -> list[dict]:
    """Tiles únicos del archivo; si una clave se repite, control = alguno, razones unidas."""
    d = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, dict] = {}
    for t in d["tiles"]:
        _parse_key(t["key"])
        o = out.setdefault(t["key"], {"key": t["key"], "control": False, "reasons": []})
        o["control"] = o["control"] or bool(t.get("control"))
        o["reasons"] += [r for r in t.get("reasons", []) if r not in o["reasons"]]
    return sorted(out.values(), key=lambda t: t["key"])


# ---------------------------------------------------------------- L2

def _l2_cut(z: np.ndarray, e_km: float, n_km: float, m: int) -> tuple[np.ndarray, float, float]:
    """Corta m×m píxeles de la malla del bloque (30 m, centro entre píxeles) lo más centrados posible
    en (e_km, n_km) -> (ventana, este y norte reales del centro en m)."""
    N = z.shape[0]
    mid = (N - 1) / 2
    c0 = int(round(e_km * 1000 / L2_PX_READ + mid - (m - 1) / 2))
    r0 = int(round(mid - n_km * 1000 / L2_PX_READ - (m - 1) / 2))
    c0, r0 = min(max(c0, 0), N - m), min(max(r0, 0), N - m)
    e = (c0 + (m - 1) / 2 - mid) * L2_PX_READ
    n = -(r0 + (m - 1) / 2 - mid) * L2_PX_READ
    return z[r0:r0 + m, c0:c0 + m], e, n


def l2_windows(lat: float, lon: float, body: str) -> list[dict]:
    """Ventanas L2 de un cuerpo: offsets en la malla del bloque y centro real (lat, lon)."""
    p = L2[body]
    n_out = int(round(p["km"] * 1000 / p["px"]))
    sup = int(round(p["px"] / L2_PX_READ))
    out = []
    ks = range(-p["half"], p["half"] + 1)
    for i in ks[::-1]:            # de norte a sur
        for j in ks:              # de oeste a este
            out.append(dict(e_km=j * p["step_km"], n_km=i * p["step_km"], m=n_out * sup, n=n_out, sup=sup))
    N = int(round(L2_BLOCK_KM * 1000 / L2_PX_READ))
    dummy = np.zeros((N, N), dtype="float32")
    for w in out:
        _, e, n = _l2_cut(dummy, w["e_km"], w["n_km"], w["m"])
        la, lo = _aeqd_inverse(lat, lon, np.array([e]), np.array([n]), EARTH_R)
        w["lat"], w["lon"] = float(la[0]), float(lo[0])
    return out


def _l2_compute(block: dict, z: np.ndarray, wins: dict, cls: dict) -> dict:
    """Rasgos de las ventanas L2 de un bloque (se ejecuta en un proceso aparte)."""
    out = {"block": block["id"], "lat": block["lat"], "lon": block["lon"], "control": block["control"],
           "body": block["body"], "moon": [], "mars": []}
    for body, ws in wins.items():
        px = L2[body]["px"]
        for w, c in zip(ws, cls[body]):
            zw, _, _ = _l2_cut(z, w["e_km"], w["n_km"], w["m"])
            if w["sup"] > 1:
                zw = _block_mean(zw, w["n"], w["sup"])
            if _ocean(zw):
                continue
            cover, agua = _cover(c)
            if agua:
                continue
            b = _body(zw, px)
            if b is None:
                continue
            out[body].append({"lat": round(w["lat"], 5), "lon": round(w["lon"], 5), **b, "cover": cover,
                              "elev_mean": round(float(np.nanmean(zw)), 1)})
    return out


def _load_blocks(path: Path) -> list[dict]:
    d = json.loads(path.read_text(encoding="utf-8"))
    out, seen = [], set()
    for b in d["blocks"]:
        if b["body"] not in ("moon", "mars", "both"):
            raise ValueError(f"bloque {b['id']}: body {b['body']!r} no válido")
        fid = _safe_id(b["id"])
        if fid in seen:
            raise ValueError(f"id de bloque repetido: {b['id']!r}")
        seen.add(fid)
        out.append({"id": b["id"], "file": fid, "lat": float(b["lat"]), "lon": float(b["lon"]),
                    "control": bool(b.get("control")), "body": b["body"], "reasons": b.get("reasons", [])})
    return out


# ---------------------------------------------------------------- ejecución

def run(level: int, items_file: Path, out: Path, part: int = 1, of: int = 1, limit: int | None = None,
        threads: int = 8, procs: int = 6, log_path: Path | None = None) -> int:
    """Procesa los tiles (L1) o bloques (L2) pendientes. Devuelve el número de fallos."""
    lg = logging.getLogger("rasterio")
    lg.setLevel(logging.DEBUG)
    if RED not in lg.handlers:
        lg.addHandler(RED)
    dem_io.set_max_per_server(threads)
    sub = out / f"l{level}"
    log = _Registro(log_path or out.parent / f"fine_scan_l{level}.log")

    items = _load_tiles(items_file) if level == 1 else _load_blocks(items_file)
    name = (lambda it: it["key"]) if level == 1 else (lambda it: it["file"])
    mine = items[part - 1::of]
    todo = [it for it in mine if not (sub / f"{name(it)}.json").exists()]
    if limit is not None:
        todo = todo[:limit]
    log(f"== L{level} {items_file} -> {sub} | {len(items)} en el archivo, parte {part}/{of}: {len(mine)}, "
        f"pendientes {len(todo)} | hilos {threads}, procesos {procs}")
    if not todo:
        return 0

    me = importlib.import_module("analogs.fine_scan")  # funciones con nombre importable para los procesos
    cpu = ProcessPoolExecutor(procs) if procs > 0 else None
    lk = threading.Lock()
    st = dict(hechos=0, ventanas=0, fallos=0, t0=time.time(), mb0=RED.mb())

    def compute(fn, *a):
        return cpu.submit(fn, *a).result() if cpu else fn(*a)

    def job_l1(t):
        key, t0 = t["key"], time.time()
        tile = dem_io.read_glo90_tile(key)
        t_dem = time.time() - t0
        if tile is None:
            return [], dict(t_dem=t_dem, nota="sin tile GLO-90 (océano)")
        arr, tr = tile
        centers = l1_centers(key)
        t1 = time.time()
        cls = [None] * len(centers)
        if centers:
            cache = {}
            grids = [_row_grid(la, lo, L1_KM, COVER_PX, 1, cache)[1:] for la, lo in centers]
            allc = dem_io.worldcover_classes(np.concatenate([g[0].ravel() for g in grids]),
                                             np.concatenate([g[1].ravel() for g in grids]))
            k = grids[0][0].size
            cls = [allc[i * k:(i + 1) * k] for i in range(len(centers))]
        t_wc = time.time() - t1
        t2 = time.time()
        res = compute(me._l1_compute, key, t["control"], arr, tr, centers, cls)
        return res, dict(t_dem=t_dem, t_wc=t_wc, t_cpu=time.time() - t2, malla=len(centers))

    def job_l2(b):
        t0 = time.time()
        z = dem_io.sample_earth(b["lat"], b["lon"], L2_BLOCK_KM, L2_PX_READ, collection="cop-dem-glo-30")
        t_dem = time.time() - t0
        bodies = ["moon", "mars"] if b["body"] == "both" else [b["body"]]
        wins = {body: l2_windows(b["lat"], b["lon"], body) for body in bodies}
        t1 = time.time()
        grids = {body: [_grid(w["lat"], w["lon"], L2[body]["km"], L2[body]["px"], 1, EARTH_R)[1:] for w in ws]
                 for body, ws in wins.items()}
        flat = [g for body in bodies for g in grids[body]]
        allc = dem_io.worldcover_classes(np.concatenate([g[0].ravel() for g in flat]),
                                         np.concatenate([g[1].ravel() for g in flat]))
        cls, i = {}, 0
        for body in bodies:
            cls[body] = []
            for g in grids[body]:
                cls[body].append(allc[i:i + g[0].size])
                i += g[0].size
        t_wc = time.time() - t1
        t2 = time.time()
        res = compute(me._l2_compute, b, z, wins, cls)
        return res, dict(t_dem=t_dem, t_wc=t_wc, t_cpu=time.time() - t2, nan=round(float(np.isnan(z).mean()), 3))

    def job(it):
        nm, t0 = name(it), time.time()
        try:
            res, info = job_l1(it) if level == 1 else job_l2(it)
        except Exception as exc:  # noqa: BLE001 (red u otro fallo: se registra y se sigue; se reintenta al relanzar)
            with lk:
                st["fallos"] += 1
            log(f"{nm}: ERROR {exc!r} (no se escribe; se reintentará al relanzar)")
            return
        _write_json(sub / f"{nm}.json", res)
        nv = len(res) if level == 1 else len(res["moon"]) + len(res["mars"])
        with lk:
            st["hechos"] += 1
            st["ventanas"] += nv
            h, v = st["hechos"], st["ventanas"]
        dt, mb = time.time() - st["t0"], RED.mb() - st["mb0"]
        eta = dt / h * (len(todo) - h)
        det = " ".join(f"{k}={v:.1f}s" if isinstance(v, float) and k.startswith("t_") else f"{k}={v}"
                       for k, v in info.items())
        log(f"{nm}: {nv} ventanas en {time.time() - t0:.1f}s ({det}) | {h}/{len(todo)} hechos, "
            f"{v} ventanas, {mb:.0f} MB, {dt:.0f}s, {mb / max(dt, 1e-3):.1f} MB/s, quedan ~{eta / 60:.1f} min")

    try:
        with ThreadPoolExecutor(threads + max(procs, 0)) as ex:  # las lecturas las limita dem_io a `threads`
            list(ex.map(job, todo))
    finally:
        if cpu:
            cpu.shutdown()
    dt, mb, h = time.time() - st["t0"], RED.mb() - st["mb0"], max(st["hechos"], 1)
    unidad = "tile" if level == 1 else "bloque"
    log(f"FIN L{level}: {st['hechos']} hechos, {st['fallos']} fallos, {st['ventanas']} ventanas, "
        f"{dt:.0f}s ({dt / h:.2f} s/{unidad}), {mb:.0f} MB ({mb / h:.2f} MB/{unidad}), {RED.peticiones} peticiones")
    return st["fallos"]


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Escaneo fino de la Tierra (L1: GLO-90, L2: GLO-30).")
    ap.add_argument("--level", type=int, choices=(1, 2), required=True)
    ap.add_argument("--tiles-file", type=Path, default=TILES_FILE, help="L1: archivo de tiles GLO-90")
    ap.add_argument("--blocks-file", type=Path, default=BLOCKS_FILE, help="L2: archivo de bloques GLO-30")
    ap.add_argument("--out", type=Path, default=OUT_DIR, help="carpeta de salida (se crean l1/ y l2/)")
    ap.add_argument("--part", type=int, default=1, help="parte i (de 1 a N), con --of N")
    ap.add_argument("--of", type=int, default=1)
    ap.add_argument("--limit", type=int, default=None, help="como mucho K tiles/bloques en esta ejecución")
    ap.add_argument("--threads", type=int, default=8, help="lecturas simultáneas por servidor (≤ 8)")
    ap.add_argument("--procs", type=int, default=max(1, min(6, (os.cpu_count() or 2) - 2)),
                    help="procesos para los rasgos (0 = en los hilos)")
    ap.add_argument("--log", type=Path, default=None, help="archivo de registro")
    a = ap.parse_args(argv)
    if not 1 <= a.part <= a.of:
        ap.error("--part debe ir de 1 a --of")
    if not 1 <= a.threads <= 8:
        ap.error("--threads debe ir de 1 a 8 (límite por servidor)")
    src = a.tiles_file if a.level == 1 else a.blocks_file
    if not src.exists():
        ap.error(f"no existe {src}; indica el archivo de entrada (ver README.md)")
    return 1 if run(a.level, src, a.out, a.part, a.of, a.limit, a.threads, a.procs, a.log) else 0


if __name__ == "__main__":
    sys.exit(main())
