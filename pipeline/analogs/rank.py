"""Ranking de análogos terrestres de la Luna (polo sur) y Marte, de grueso a fino (PLAN_v2.md §5–6).

Puntuación por dimensión (0–1), para poder decir QUÉ se parece y QUÉ no:
  - terreno:    similitud de rasgos de relieve (percentiles terrestres) con la referencia más parecida
  - superficie: fracción de suelo desnudo (roca/arena) o hielo, sin vegetación (ESA WorldCover)
  - clima:      frío, seco y con gran oscilación térmica diaria (Meteomatics ERA5, año 2025)
Total = 0.5·terreno + 0.25·superficie + 0.25·clima; preselección = terreno^0.6 · superficie^0.4.

Niveles (ventana y píxel iguales en la Tierra y en el otro cuerpo; references.SCALES):
  L0  130.535 ventanas de 30 km a 400 m (earth_scan) frente a las referencias L0 usables.
      Gemelos por clave: Luna = cada región (centro + teselas), cada sitio y "malla_polar";
      Marte = cada sitio. Validación con las referencias v1 (antes) y v2 (después).
      -> data/fine_tiles.json: tiles GLO-90 de 1° para fine_scan --level 1, con 1.500 de control.
  L1  (si hay <fine>/l1/*.json) 10 km a 120 m (Luna) / 200 m (Marte). Percentiles con las ventanas
      de control. Terreno T = sqrt(T1(e, r) · T0(padre(e), padre(r))). Se prueban los rasgos de forma.
      -> data/fine_l2_blocks.json: 60 mejores por cuerpo (con gemelos) + 150 de control.
  L2  (si hay <fine>/l2/*.json) Luna 5 km a 60 m frente a las referencias L2 de la región;
      Marte 2 km a 30 m frente a los parches HiRISE. Terreno final = media geométrica de T0, T1, T2.
El clima solo se pide para lo que se muestra (sitios L0, gemelos L0 y L1, finalistas).

Ejecutar desde pipeline/ (después de earth_scan, references y, si los hay, fine_scan):
    python -m analogs.rank --no-climate     -> data/prueba/results.json (clima ficticio; no toca la app)
    python -m analogs.rank --climate-budget N   -> ../src/data/results.json (aborta si hacen falta
                                                   más de N consultas nuevas; por defecto 0)
Opciones: --fine-dir DIR (l1/ y l2/; por defecto data/fine), --sel-dir DIR (dónde escribir
fine_tiles.json y fine_l2_blocks.json; por defecto data/, o la carpeta de --fine-dir si se da),
--salida RUTA (results.json), --refs RUTA, --literatura RUTA (por defecto analogs/literature_v2.json).
El clima se guarda en caché (data/climate_ecmwf-era5.json): solo se piden los puntos nuevos.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
import time
import types
from collections import Counter, defaultdict
from pathlib import Path

import numpy as np
from scipy.spatial import cKDTree

from .dem_io import glo90_index, tile_key
from .reference_sites import MARS_SITES, MOON_NONPOLAR_SITES, MOON_REGIONS, MOON_SITES
from .references import SCALES
from .terrain import FEATURES, SHAPE_FEATURES, feature_labels

ROOT = Path(__file__).resolve().parent.parent       # pipeline/
DATA = ROOT / "data"
APP_RESULTS = ROOT.parent / "src" / "data" / "results.json"
TEST_RESULTS = DATA / "prueba" / "results.json"
REFS_V2 = DATA / "references_v2.json"
REFS_V1 = DATA / "references.json"
REFS_BEFORE = DATA / "backup_v1" / "references.json"
FINE_DIR = DATA / "fine"
LITERATURE = Path(__file__).resolve().parent / "literature_v2.json"
EARTH_R_KM = 6371.0

LOG_FEATURES = {"relief", "rough_1km"}
W_TERRAIN, W_SURFACE, W_CLIMATE = 0.5, 0.25, 0.25
CLIMATE_W = {"moon": {"cold": 0.5, "dry": 0.25, "swing": 0.25},
             "mars": {"cold": 0.35, "dry": 0.35, "swing": 0.3}}
SHORTLIST, TOP_N, NMS_KM = 40, 20, 150
TWINS_PER_REF, TWIN_NMS_KM = 3, 300
TERRAIN_SIGMA = 0.08  # diferencia media de percentiles a la que la similitud cae a 1/e
VALID_KM = 50         # mejor ventana a menos de esta distancia de cada análogo de validación

# Selección L1 (fine_tiles.json) y L2 (fine_l2_blocks.json)
SEL_TOP, SEL_TOP_NMS = 300, 50
SEL_KEY, SEL_KEY_NMS = 5, 100
N_CONTROL_TILES, SEED = 1500, 2026
L2_TOP, L2_NMS, N_CONTROL_BLOCKS = 60, 20, 150
PARENT_MAX_KM = 30    # ventana L0 "padre" de una ventana fina: la más cercana a menos de 30 km
L1_MATCH_KM = 7       # bloque L2 -> ventana L1 de la que salió (mismo centro; paso L1 = 10 km)
SHAPE_MAX_DROP = 10   # puntos de percentil que puede perder un análogo al añadir la forma
MB_PER_TILE = 3.2     # coste medido de un tile GLO-90 (PLAN_v2 §5)

# Análogos ya conocidos: (nombre, lat, lon, radio_km, usar_en_validación).
# Los de validación se fijaron ANTES de ver resultados; los demás se añadieron
# tras revisar la bibliografía de los candidatos, para no venderlos como "nuevos".
KNOWN_ANALOGS = [
    ("Desierto de Atacama (Yungay)", -24.08, -70.00, 150, True),
    ("Cráter Haughton, isla Devon", 75.38, -89.68, 150, True),
    ("Valle de la Muerte", 36.50, -117.10, 150, True),
    ("Valles Secos de McMurdo", -77.50, 161.80, 150, True),
    ("Askja, Islandia", 65.03, -16.75, 150, True),
    ("Mauna Kea, Hawái", 19.82, -155.47, 150, True),
    ("Bockfjorden, Svalbard", 79.40, 13.40, 150, True),
    ("MDRS, Utah", 38.41, -110.79, 150, True),
    ("Meteor Crater, Arizona", 35.03, -111.02, 150, True),
    ("Río Tinto, España", 37.70, -6.55, 150, True),
    ("Lanzarote", 29.00, -13.70, 150, True),
    ("Pilbara, Australia", -21.20, 119.40, 150, True),
    # añadidos tras revisar la bibliografía
    ("Cuenca de Qaidam, China (análogo de Marte publicado)", 38.30, 92.50, 300, False),
    ("Desierto de Lut, Irán (yardangs y TARs, análogo de Marte)", 30.50, 59.00, 250, False),
    ("Emi Koussi, Tibesti (análogo de Elysium Mons)", 19.80, 18.55, 150, False),
    ("Ladakh / Tso Kar, India (estación análoga Luna/Marte)", 33.30, 77.98, 200, False),
    ("Puna de Atacama (análogo de Marte y astrobiología)", -26.50, -68.20, 250, False),
]
VALIDATION = [a for a in KNOWN_ANALOGS if a[4]]

# Historias destacadas v2 (elegidas a mano tras ver el ranking v2 y la revisión bibliográfica).
# "ref" es una clave de gemelos; si no existe se avisa y se quita. Las cifras salen de
# results.json v2 (14/11/2026); si cambian las referencias o los datos, hay que revisarlas.
# Las historias v1 de Jezero (otra ventana de Qaidam) y de Ustyurt/Elysium se retiraron: Elysium
# (InSight) es una zona "solo MOLA" que ya no puntúa a 400 m.
FEATURED = [
    {
        "body": "moon", "ref": "malla_polar", "lat": 33.7698, "lon": 84.39181, "tag": "nuevo",
        "title": "Changtang (Tíbet occidental, ~4.800 m), gemelo de las llanuras del polo sur lunar",
        "story": ("A 10 km, esta ventana del altiplano de Changtang (condado de Gêrzê, Ngari) tiene casi la misma "
                  "distribución de pendientes que una ventana de la malla polar a 86,4°S (pendiente típica 2,9° frente "
                  "a 3,1°; p90 8,7° frente a 9,9°; 72 % llano frente a 68 %; relieve 234 m frente a 261 m). La "
                  "similitud se mantiene a 30 km (98/100) y a 5 km (90/100, frente a una tesela de la región Haworth "
                  "de Artemis III). Es suelo desnudo al 100 %, con una media de −2,2 °C y mínimas de −27 °C (ERA5, "
                  "2025): un lugar para ensayar movilidad y aterrizaje en las llanuras entre cráteres del polo sur, "
                  "con frío y a gran altitud. Tras 8 búsquedas en inglés y chino no encontramos estudios que lo usen "
                  "como análogo; los análogos tibetanos publicados están en la cuenca de Qaidam, a más de 600 km. "
                  "Dónde falla: aquí el relieve lo modelan el hielo y el agua, no los impactos, y caen 333 mm al año."),
    },
    {
        "body": "moon", "ref": "shackleton", "lat": -29.4982, "lon": -69.5145, "tag": "nuevo",
        "title": "Alta cordillera de San Juan (Argentina, ~4.200 m), gemela del cráter Shackleton",
        "story": ("Una ventana de 30 km en el departamento de Iglesia (San Juan) tiene casi la misma pendiente que "
                  "el cráter Shackleton medido con el DEM LOLA de 40 m (pendiente típica 14,6° frente a 14,0°; 48 % "
                  "del terreno por encima de 15° frente a 47 %), con un 98 % de roca desnuda, media de −6,2 °C y "
                  "mínimas de −39 °C. Sirve para probar rovers y aterrizajes en laderas empinadas como las de las "
                  "crestas iluminadas del polo sur. Dónde falla: Shackleton es más profundo (relieve 3.781 m frente a "
                  "2.027 m) y sus pendientes extremas son mayores (p90 31° frente a 25°). En una búsqueda breve (inglés "
                  "y español) no encontramos estudios que usen esta zona como análogo; los análogos andinos publicados "
                  "están en la Puna y en Atacama, a más de 300 km."),
    },
    {
        "body": "mars", "ref": "ez_jezero_syrtis_isidis", "lat": 38.14027, "lon": 91.44283, "tag": "validación",
        "title": "Cuenca de Qaidam (China), gemela de la zona de exploración de Jezero",
        "story": ("Sin decírselo, el método encontró la cuenca de Qaidam (~3.250 m) como el mejor gemelo de la zona de "
                  "exploración humana Jezero–Syrtis–Isidis, con terreno parecido a las tres escalas: 96/100 a 30 km, "
                  "99/100 a 10 km y 96/100 a 2 km frente a un parche HiRISE de un delta invertido (pendiente típica "
                  "5,2° frente a 4,5°; relieve 93 m frente a 102 m). Qaidam ya está publicada como análogo de Marte "
                  "(antiguo lago evaporado, frío y seco, con yardangs y sales): que el método la redescubra sin "
                  "saberlo es una prueba de que funciona."),
    },
    {
        "body": "mars", "ref": "spirit_gusev", "lat": 22.67986, "lon": 11.84114, "tag": "nuevo",
        "title": "Meseta de Djado (Níger), gemela de las llanuras del cráter Gusev",
        "story": ("Es el n.º 1 del ranking final de Marte. A 10 km se parece mucho a una ventana de las llanuras de "
                  "Gusev donde aterrizó Spirit (pendiente típica 2,3° frente a 2,3°; p90 8,1° frente a 8,5°; 77 % llano "
                  "frente a 78 %; relieve 187 m frente a 179 m: 100/100), y también a 30 km (98/100) y a 2 km (93/100 "
                  "frente a un parche HiRISE de Utopia Planitia de la misma categoría). Es roca desnuda casi sin lluvia "
                  "(4 mm en 2025). En una búsqueda breve (inglés y francés) no encontramos estudios que lo usen como "
                  "análogo; hay trabajos regionales sobre el Teneré que no sitúan su zona aquí. Dónde falla: es "
                  "caluroso (media de 23,7 °C), al contrario que Marte."),
    },
]

LEVELS = {
    "L0": {"moon": {"ref_data": "LOLA LDEM_80S_40MPP_ADJ (PGDA, Barker et al. 2023): píxel 40 m, "
                                "resolución efectiva 16–50 m según la latitud",
                    "earth_data": "Copernicus GLO-90 (90 m)", "coarsest": "Tierra a 400 m (escaneo global)"},
           "mars": {"ref_data": "Blend HRSC+MOLA v2: 200 m donde hay HRSC; 463 m o peor donde solo hay MOLA "
                                "(esas referencias no puntúan a 400 m)",
                    "earth_data": "Copernicus GLO-90 (90 m)", "coarsest": "Tierra a 400 m (las referencias solo MOLA, 463 m, no puntúan)"}},
    "L1": {"moon": {"ref_data": "LOLA PGDA 40 m (EFFRES ~30–50 m)", "earth_data": "Copernicus GLO-90 (90 m)",
                    "coarsest": "LOLA ~30–50 m y GLO-90 90 m -> píxel 120 m"},
           "mars": {"ref_data": "Blend HRSC+MOLA v2, solo teselas con HRSC (200 m)",
                    "earth_data": "Copernicus GLO-90 (90 m)", "coarsest": "HRSC 200 m"}},
    "L2": {"moon": {"ref_data": "LOLA PGDA 40 m; solo teselas con EFFRES p50 ≤ 60 m",
                    "earth_data": "Copernicus GLO-30 (30 m)", "coarsest": "LOLA 30–50 m -> píxel 60 m"},
           "mars": {"ref_data": "116 parches HiRISE DTM (~1–2 m) del visor, 100×100 a 20 m, remuestreados a 30 m",
                    "earth_data": "Copernicus GLO-30 (30 m)", "coarsest": "GLO-30 30 m"}},
}


# ---------------------------------------------------------------- utilidades

def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi, dlmb = p2 - p1, np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return EARTH_R_KM * 2 * np.arcsin(np.sqrt(a))


def unit_xyz(lat, lon) -> np.ndarray:
    la, lo = np.radians(np.asarray(lat, float)), np.radians(np.asarray(lon, float))
    return np.column_stack([np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)])


def chord_to_km(c):
    return EARTH_R_KM * 2 * np.arcsin(np.clip(np.asarray(c) / 2, 0, 1))


def nms(score: np.ndarray, lats: np.ndarray, lons: np.ndarray, k: int, km: float,
        cand: np.ndarray | None = None, seed: list[int] | None = None) -> list[int]:
    """Supresión de vecinos: los k mejores índices separados al menos `km` (los de `seed` van primero)."""
    chosen = list(seed or [])
    order = np.argsort(-score, kind="stable") if cand is None else cand[np.argsort(-score[cand], kind="stable")]
    for i in order:
        if len(chosen) >= k:
            break
        if not np.isfinite(score[i]):
            continue
        if chosen and haversine_km(lats[i], lons[i], lats[chosen], lons[chosen]).min() < km:
            continue
        chosen.append(int(i))
    return chosen


def vec(f: dict | None, keys: list[str]) -> list[float]:
    if f is None:
        return [math.nan] * len(keys)
    out = []
    for k in keys:
        v = f.get(k)
        v = math.nan if v is None else float(v)
        out.append(math.log1p(v) if k in LOG_FEATURES and v == v else v)
    return out


class Percentiles:
    """Pasa cada rasgo a su percentil dentro de una población terrestre (0 = el más bajo, 1 = el más alto).
    Igual que la v1: rango medio (lo + hi) / 2 / n. Los NaN se ignoran y dan NaN."""

    def __init__(self, X: np.ndarray):
        self.cols = [np.sort(c[np.isfinite(c)]) for c in X.T]

    def __call__(self, M: np.ndarray) -> np.ndarray:
        Q = np.full(M.shape, np.nan)
        for j, s in enumerate(self.cols):
            ok = np.isfinite(M[:, j])
            if len(s) and ok.any():
                lo = np.searchsorted(s, M[ok, j], side="left")
                hi = np.searchsorted(s, M[ok, j], side="right")
                Q[ok, j] = (lo + hi) / 2 / len(s)
        return Q


def similarity(QA: np.ndarray, QB: np.ndarray, chunk: int = 20000) -> np.ndarray:
    """exp(-(rms/σ)²) entre cada fila de QA y de QB (rms de la diferencia de percentiles sobre los
    rasgos que tienen las dos; 0 si no comparten ninguno). Por productos de matrices, en trozos."""
    MB = np.isfinite(QB).astype(float)
    B0 = np.where(MB > 0, QB, 0.0)
    out = np.empty((len(QA), len(QB)), dtype="float32")
    for a in range(0, len(QA), chunk):
        A = QA[a:a + chunk]
        MA = np.isfinite(A).astype(float)
        A0 = np.where(MA > 0, A, 0.0)
        ss = (A0 ** 2) @ MB.T + MA @ (B0 ** 2).T - 2 * A0 @ B0.T
        cnt = MA @ MB.T
        with np.errstate(invalid="ignore", divide="ignore"):
            rms = np.sqrt(np.maximum(ss, 0) / cnt)
        s = np.exp(-(rms / TERRAIN_SIGMA) ** 2)
        out[a:a + chunk] = np.where(cnt > 0, s, 0.0)
    return out


def surface_score(site: dict) -> tuple[float, bool]:
    c = site.get("cover")
    if c is None:  # sin WorldCover: solo lo suponemos en la Antártida (hielo/roca)
        return (0.6, True) if site["lat"] < -60 else (0.0, True)  # 0.6 = mismo peso que hielo/nieve
    return min(1.0, c["bare"] + 0.6 * c["snow_ice"] + 0.3 * c["moss_lichen"]), False


def _r(v, d=3):
    return None if v is None or not np.isfinite(v) else round(float(v), d)


# ---------------------------------------------------------------- datos

def load_earth() -> list[dict]:
    sites = []
    for f in sorted((DATA / "earth").glob("band_*.json")):
        sites.extend(json.loads(f.read_text(encoding="utf-8")))
    return sites


def load_refs(path: Path | None) -> tuple[list[dict], str]:
    """references_v2.json (o la ruta dada); si no existe, la v1 convertida a L0 usable."""
    p = path or (REFS_V2 if REFS_V2.exists() else REFS_V1)
    refs = json.loads(p.read_text(encoding="utf-8"))
    if refs and "level" not in refs[0]:
        print(f"AVISO: {p.name} es v1; se usa como L0 (sin L1/L2)")
        for r in refs:
            r.update(level="L0", kind="sitio", group=r["id"], region=None, parent=None, usable=True)
        return refs, "v1"
    return refs, "v2"


def twin_key(r: dict) -> str:
    """Clave de gemelos de una referencia: región, sitio o malla_polar (Luna); sitio (Marte)."""
    if r["body"] == "moon":
        if r.get("group") == "malla_polar":
            return "malla_polar"
        if r.get("kind") == "sitio_tesela":  # teselas de 10 km de un sitio fuera del polo
            return r.get("parent") or r["id"].rsplit("_t", 1)[0]
        if r.get("kind") == "sitio" or not r.get("region"):
            return r["id"]
        return r["region"]
    if r.get("kind") == "hirise":
        return r.get("parent") or r["id"]
    if r["level"] == "L0":
        return r["id"]
    return r.get("parent") or r["id"].rsplit("_t", 1)[0]


def group_info(refs: list[dict]) -> dict:
    names = {r["id"]: (r["name"], "region") for r in MOON_REGIONS}
    names.update({s["id"]: (s["name"], "sitio") for s in MOON_SITES})
    names.update({s["id"]: (s["name"], "sitio") for s in MARS_SITES})
    names.update({s["id"]: (s["name"], "fuera_del_polo") for s in MOON_NONPOLAR_SITES})
    names["malla_polar"] = ("Malla polar de 84–90°S (generada, no es un sitio publicado)", "malla")
    # Nobile Rim 1 comparte mosaico LROC (centro y límites) con Mons Mouton: se puntúan juntas.
    names["mons_mouton"] = ("Mons Mouton y Nobile Rim 1 (comparten mosaico LROC)", "region")
    out: dict[str, dict] = {}
    for r in refs:
        if not r.get("usable", True) or r.get("features") is None or r.get("kind") == "hirise":
            continue
        k = twin_key(r)
        name, kind = names.get(k, (r["name"], r.get("kind", "sitio")))
        g = out.setdefault(k, {"name": name, "body": r["body"], "kind": kind, "n_refs": 0,
                               "n_refs_levels": {"L0": 0, "L1": 0, "L2": 0}})
        g["n_refs_levels"][r["level"]] += 1
        if r.get("twin_only"):  # solo gemelos: no entra en el ranking ni en la validación
            g["twin_only"] = True
        if r["level"] == "L0":
            g["n_refs"] += 1
    return out


def load_literature(path: Path) -> list[dict]:
    if not path.exists():
        return []
    lit = json.loads(path.read_text(encoding="utf-8"))
    print(f"Bibliografía: {len(lit)} entradas de {path.name} ({dict(Counter(x.get('status') for x in lit))})")
    return lit


def literature_for(lit: list[dict], lat: float, lon: float) -> dict | None:
    best = None
    for x in lit:
        d = float(haversine_km(lat, lon, x["lat"], x["lon"]))
        if d < x.get("radius_km", 0) and (best is None or d < best[0]):
            best = (d, x)
    if best is None:
        return None
    return {**best[1], "km": round(best[0], 1)}


def known_name(lat: float, lon: float, lit: list[dict] | None = None) -> str | None:
    """Nombre del análogo conocido más cercano si está dentro de su radio (o de la bibliografía)."""
    best = None
    for name, la, lo, radius, _ in KNOWN_ANALOGS:
        d = float(haversine_km(lat, lon, la, lo))
        if d < radius and (best is None or d < best[1]):
            best = (name, d)
    if best:
        return best[0]
    le = literature_for(lit or [], lat, lon)
    if le and le.get("status") == "ya_estudiado":
        return le.get("name") or le.get("note") or "Estudiado como análogo (bibliografía)"
    if lat < -60:
        return "Antártida (muy estudiada como análogo)"
    return None


def load_fine(fine_dir: Path, level: int, selection: Path | None = None) -> list:
    """Ventanas L1 (todas las de l1/) o bloques L2. En L2, si se da el archivo de selección, solo
    se cargan los bloques seleccionados cuya posición coincide (los archivos de selecciones anteriores
    se ignoran)."""
    files = sorted((fine_dir / f"l{level}").glob("*.json"))
    sel = None
    if level == 2 and selection is not None and selection.exists():
        sel = {b["id"]: b for b in json.loads(selection.read_text(encoding="utf-8"))["blocks"]}
    out, skipped = [], 0
    for f in files:
        d = json.loads(f.read_text(encoding="utf-8"))
        if level == 1:
            out.extend(d)
            continue
        b = sel.get(f.stem) if sel is not None else None
        if sel is not None and (b is None or abs(b["lat"] - d["lat"]) > 1e-6 or abs(b["lon"] - d["lon"]) > 1e-6):
            skipped += 1
            continue
        out.append(d)
    if skipped:
        print(f"  L2: {skipped} archivos fuera de la selección actual (se ignoran)")
    return out


# ---------------------------------------------------------------- L0

def v1_validation(earth: list[dict], refs_v1: list[dict], S_surface: np.ndarray, lats, lons) -> dict:
    """Validación con el método v1 idéntico (mismas operaciones que rank.py v1)."""
    def v(f):
        return np.array([math.log1p(f[k]) if k in LOG_FEATURES else f[k] for k in FEATURES])

    X = np.array([v(s["features"]) for s in earth])
    R = np.array([v(r["features"]) for r in refs_v1])
    Xs = np.sort(X, axis=0)
    n = len(X)

    def to_q(M):
        Q = np.empty_like(M)
        for j in range(M.shape[1]):
            lo = np.searchsorted(Xs[:, j], M[:, j], side="left")
            hi = np.searchsorted(Xs[:, j], M[:, j], side="right")
            Q[:, j] = (lo + hi) / 2 / n
        return Q

    QX, QR = to_q(X), to_q(R)
    rms = np.sqrt(((QX[:, None, :] - QR[None, :, :]) ** 2).mean(axis=2))
    S_terrain = np.exp(-(rms / TERRAIN_SIGMA) ** 2)
    out = {}
    for body in ("moon", "mars"):
        idx = [i for i, r in enumerate(refs_v1) if r["body"] == body]
        pre = S_terrain[:, idx].max(axis=1) ** 0.6 * S_surface ** 0.4
        out[body] = validate(pre, lats, lons, None)
    return out


def validate(pre: np.ndarray, lats, lons, control: np.ndarray | None) -> dict[str, float | None]:
    """Percentil de la mejor ventana a < VALID_KM de cada análogo (entre todas, o entre las de control)."""
    ref = pre if control is None else pre[control]
    out = {}
    for name, la, lo, _, _ in VALIDATION:
        near = np.where(haversine_km(la, lo, lats, lons) < VALID_KM)[0]
        near = near[np.isfinite(pre[near])]
        if control is not None:  # L1: puntuación 0 = sin padre L0 (p. ej. islas como Lanzarote): no cuenta
            near = near[pre[near] > 0]
        if len(near) == 0 or len(ref) == 0:
            out[name] = None
            continue
        j = near[pre[near].argmax()]
        out[name] = round(float((ref < pre[j]).mean() * 100), 1)
    return out


def validate_fair(pre: np.ndarray, lats, lons, control: np.ndarray, n_max: int = 20000) -> dict[str, float | None]:
    """Percentil fino "justo": la mejor ventana a < VALID_KM del análogo frente a la MEJOR ventana a
    < VALID_KM de cada punto de control (y no frente a ventanas sueltas). En L1 hay ~75 ventanas en
    50 km, así que comparar su máximo con valores sueltos infla el percentil. Los puntos de control
    junto al borde de su tile tienen algo menos de vecinos escaneados: el sesgo que queda es pequeño."""
    from scipy.spatial import cKDTree
    la, lo = np.radians(np.asarray(lats, float)), np.radians(np.asarray(lons, float))
    xyz = np.c_[np.cos(la) * np.cos(lo), np.cos(la) * np.sin(lo), np.sin(la)]
    ok = np.isfinite(pre)
    idx_ok = np.where(ok)[0]
    tree = cKDTree(xyz[ok])
    ctrl = np.where(control & ok)[0]
    if len(ctrl) > n_max:  # submuestra fija para que sea rápido
        ctrl = np.sort(np.random.default_rng(2026).choice(ctrl, n_max, replace=False))
    chord = 2 * math.sin(VALID_KM / 6371.0 / 2)
    M = np.array([pre[idx_ok[nb]].max() for nb in tree.query_ball_point(xyz[ctrl], chord)])
    out = {}
    for name, a_la, a_lo, _, _ in VALIDATION:
        near = np.where(haversine_km(a_la, a_lo, lats, lons) < VALID_KM)[0]
        near = near[np.isfinite(pre[near]) & (pre[near] > 0)]
        out[name] = round(float((M < pre[near].max()).mean() * 100), 1) if len(near) and len(M) else None
    return out


def score_l0(body: str, refs0: list[dict], QX: np.ndarray, pct: Percentiles) -> dict:
    QR = pct(np.array([vec(r["features"], FEATURES) for r in refs0]))
    S = similarity(QX, QR)
    keys = [twin_key(r) for r in refs0]
    groups = defaultdict(list)
    for j, k in enumerate(keys):
        groups[k].append(j)
    return {"refs": refs0, "S": S, "QR": QR, "keys": keys, "groups": dict(groups),
            "col": {r["id"]: j for j, r in enumerate(refs0)}}


# ---------------------------------------------------------------- L1 y L2

def l1_terrain(L: dict, QE: np.ndarray, pe: np.ndarray, S0: np.ndarray, chunk: int = 4000) -> dict:
    """T(e, r) = sqrt(T1 · T0(padre(e), padre(r))) (0 si falta un padre: sin dos escalas no hay terreno multiescala), reducido por ventana:
    máximo y su referencia, T0 y T1 de esa pareja y máximo por clave de gemelos."""
    QR, pcol, gcols = L["QR"], L["pcol"], L["gcols"]
    rank = L.get("rank")  # referencias que entran en el máximo general (None = todas)
    n, K = len(QE), len(gcols)
    best = np.zeros(n, "float32")
    arg = np.zeros(n, int)
    t0b = np.full(n, np.nan, "float32")
    t1b = np.zeros(n, "float32")
    by_key = np.zeros((n, K), "float32")
    has_r = pcol >= 0
    for a in range(0, n, chunk):
        T1 = similarity(QE[a:a + chunk], QR)
        p = pe[a:a + chunk]
        T0 = np.full(T1.shape, np.nan, "float32")
        okw = p >= 0
        if okw.any() and has_r.any():
            sub = S0[p[okw]][:, pcol[has_r]]
            blk = T0[okw]
            blk[:, has_r] = sub
            T0[okw] = blk
        T = np.where(np.isfinite(T0), np.sqrt(T1 * np.nan_to_num(T0)), 0.0)  # sin padre en algún nivel: no puntúa
        j = (T if rank is None else np.where(rank[None, :], T, -1.0)).argmax(axis=1)
        rows = np.arange(len(T))
        best[a:a + chunk], arg[a:a + chunk] = T[rows, j], j
        t0b[a:a + chunk], t1b[a:a + chunk] = T0[rows, j], T1[rows, j]
        for g, cols in enumerate(gcols):
            by_key[a:a + chunk, g] = T[:, cols].max(axis=1)
    return {"T": best, "arg": arg, "T0": t0b, "T1": t1b, "by_key": by_key}


def build_l1(body: str, refs: list[dict], L0: dict, feats: list[str]) -> dict | None:
    refs1 = [r for r in refs if r["body"] == body and r["level"] == "L1" and r.get("usable") and r.get("features")]
    if not refs1:
        return None
    pcol = np.array([L0["col"].get(r.get("parent"), -1) for r in refs1])
    keys = [twin_key(r) for r in refs1]
    kl = sorted(set(keys), key=keys.index)
    gcols = [np.array([j for j, k in enumerate(keys) if k == g]) for g in kl]
    rank = np.array([not r.get("twin_only") for r in refs1])
    twin_only_keys = {k for k, r in zip(keys, refs1) if r.get("twin_only")}
    return {"refs": refs1, "pcol": pcol, "keys": keys, "key_list": kl, "gcols": gcols, "rank": rank,
            "twin_only_keys": twin_only_keys,
            "R": np.array([vec({**r["features"], **(r.get("shape") or {})}, feats) for r in refs1])}


# ---------------------------------------------------------------- clima

def climate_module(offline: bool):
    """Importa analogs.climate. Sin red (--no-climate) se sustituye el cliente de Meteomatics por uno
    que falla, para no cargar credenciales ni gastar consultas por error."""
    if offline and "meteomatics_client" not in sys.modules:
        stub = types.ModuleType("meteomatics_client")

        def get_raw(*a, **k):
            raise RuntimeError("--no-climate: no se consulta Meteomatics")
        stub.get_raw = get_raw
        sys.modules["meteomatics_client"] = stub
    from . import climate
    return climate


def get_climate(points: list[tuple[float, float]], offline: bool, budget: int) -> dict:
    climate = climate_module(offline)
    pts = list(dict.fromkeys((round(la, 4), round(lo, 4)) for la, lo in points))
    if offline:  # pruebas rápidas sin gastar consultas
        dummy = {"t_mean": 15, "t_min": 0, "t_max": 30, "diurnal_range": 0, "precip_year": 1000, "wind_mean": 0}
        return {climate._key(la, lo): dummy for la, lo in pts}
    cache = json.loads(climate.CACHE.read_text(encoding="utf-8")) if climate.CACHE.exists() else {}
    new = [p for p in pts if climate._key(*p) not in cache]
    queries = math.ceil(len(new) / climate.BATCH)
    print(f"\nClima: {len(pts)} puntos, {len(pts) - len(new)} en caché, {len(new)} nuevos -> {queries} consultas "
          f"(presupuesto {budget})")
    if queries > budget:
        sys.exit(f"ABORTADO: harían falta {queries} consultas a Meteomatics ({len(new)} puntos nuevos en lotes de "
                 f"{climate.BATCH}) y el presupuesto es {budget}. Sube --climate-budget o usa --no-climate.")
    return climate.fetch(pts)


# ---------------------------------------------------------------- niveles

def earth_l0() -> types.SimpleNamespace:
    """Ventanas L0 de la Tierra con sus percentiles, superficie y un árbol para buscar la más cercana."""
    rows = load_earth()
    lat = np.array([s["lat"] for s in rows])
    lon = np.array([s["lon"] for s in rows])
    surf = np.array([surface_score(s) for s in rows])
    X = np.array([vec(s["features"], FEATURES) for s in rows])
    pct = Percentiles(X)
    return types.SimpleNamespace(rows=rows, lat=lat, lon=lon, surf=surf[:, 0], assumed=surf[:, 1].astype(bool),
                                 pct=pct, Q=pct(X), tree=cKDTree(unit_xyz(lat, lon)))


def run_l0(refs: list[dict], E) -> dict[str, dict]:
    L0 = {}
    for body in ("moon", "mars"):
        refs0 = [r for r in refs if r["body"] == body and r["level"] == "L0" and r.get("usable")
                 and r.get("features")]
        B = score_l0(body, refs0, E.Q, E.pct)
        S = B["S"]
        # El ranking, el mapa de calor y la validación usan solo las referencias que puntúan; las de
        # "solo gemelos" (Luna fuera del polo) solo cuentan para sus propios gemelos.
        rc = np.array([j for j, r in enumerate(refs0) if not r.get("twin_only")])
        B["rank_cols"] = rc
        B["t"], B["best"] = S[:, rc].max(axis=1), rc[S[:, rc].argmax(axis=1)]
        B["pre"] = B["t"] ** 0.6 * E.surf ** 0.4
        B["key_max"] = {k: S[:, cols].max(axis=1) for k, cols in B["groups"].items()}
        # gemelos por clave: los mejores lugares de la Tierra para CADA clave de referencias
        B["twin_idx"] = {k: nms(tk ** 0.6 * E.surf ** 0.4, E.lat, E.lon, TWINS_PER_REF, TWIN_NMS_KM)
                         for k, tk in B["key_max"].items()}
        # preselección con supresión de vecinos (para no listar 20 ventanas del mismo desierto)
        B["chosen"] = nms(B["pre"], E.lat, E.lon, SHORTLIST, NMS_KM)
        L0[body] = B
        print(f"L0 {body}: {len(refs0)} referencias usables en {len(B['groups'])} claves de gemelos"
              f" ({len(refs0) - len(rc)} solo para gemelos)")
    return L0


def select_tiles(L0: dict, E, version: str, dest: Path) -> None:
    """Tiles GLO-90 para L1: (a) top por cuerpo, (b) top por clave, (c) validación, (d) control."""
    index_keys = {it["key"] for it in glo90_index()}
    wkeys = np.array([tile_key(la, lo) for la, lo in zip(E.lat, E.lon)])
    tiles: dict[str, dict] = {}

    def add(key: str, reason: str, control: bool = False) -> bool:
        if key not in index_keys:
            return False
        t = tiles.setdefault(key, {"key": key, "control": False, "reasons": []})
        t["control"] = t["control"] or control
        if reason not in t["reasons"]:
            t["reasons"].append(reason)
        return True

    count: Counter = Counter()
    for body, B in L0.items():
        for i in nms(B["pre"], E.lat, E.lon, SEL_TOP, SEL_TOP_NMS):
            add(wkeys[i], f"top{SEL_TOP}_{body}")
            count[f"(a) top {SEL_TOP} {body}"] += 1
        for k, tk in B["key_max"].items():
            for i in nms(tk ** 0.6 * E.surf ** 0.4, E.lat, E.lon, SEL_KEY, SEL_KEY_NMS):
                add(wkeys[i], f"gemelo_{body}:{k}")
                count[f"(b) top {SEL_KEY} por clave {body}"] += 1
    for name, la, lo, _, _ in VALIDATION:
        near = np.where(haversine_km(la, lo, E.lat, E.lon) < VALID_KM)[0]
        for i in near:
            add(wkeys[i], f"validacion:{name}")
        count["(c) ventanas de validación"] += len(near)
        # además el tile del propio punto (Lanzarote no tiene ventana L0 a <50 km)
        count["(c) tile del punto de validación"] += add(tile_key(la, lo), f"validacion:{name}")
    n_cand = len(tiles)
    cnt = Counter(k for k in wkeys if k in index_keys)       # ventanas de tierra por tile
    ck = sorted(cnt)
    w = np.array([cnt[k] for k in ck], float)
    rng = np.random.default_rng(SEED)
    for c in rng.choice(len(ck), size=min(N_CONTROL_TILES, len(ck)), replace=False, p=w / w.sum()):
        add(ck[c], "control", control=True)
    tl = sorted(tiles.values(), key=lambda t: t["key"])
    n_ctrl = sum(t["control"] for t in tl)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps({"created_by": "rank", "created": time.strftime("%Y-%m-%d %H:%M"), "seed": SEED,
                                "references": version, "n_tiles": len(tl), "n_control": n_ctrl, "tiles": tl},
                               ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n== Selección L1: {len(tl)} tiles GLO-90 -> {dest}")
    print(f"  candidatos {n_cand}; control {n_ctrl} (de ellos {sum(t['control'] and len(t['reasons']) > 1 for t in tl)}"
          f" también candidatos); solo control {len(tl) - n_cand}")
    for k, v in count.items():
        print(f"  {k}: {v}")
    print(f"  tiles por motivo: {dict(Counter(r.split(':')[0] for t in tl for r in t['reasons']))}")
    print(f"  coste estimado L1: ~{len(tl) * MB_PER_TILE / 1000:.1f} GB ({MB_PER_TILE} MB por tile)")


def _l1_body(body: str, W: list[dict], refs: list[dict], B0: dict, E) -> dict | None:
    """Puntuación L1 de un cuerpo con 6 y con 9 rasgos; devuelve la variante adoptada."""
    lat = np.array([w["lat"] for w in W])
    lon = np.array([w["lon"] for w in W])
    control = np.array([bool(w.get("control")) for w in W])
    pop = control if control.any() else np.ones(len(W), bool)
    if not control.any():
        print(f"  AVISO {body}: no hay ventanas de control; percentiles con todas las ventanas")
    d, pe = E.tree.query(unit_xyz(lat, lon))
    pe = np.where(chord_to_km(d) < PARENT_MAX_KM, pe, -1)
    surf = np.array([surface_score(w) for w in W])
    res = {}
    for name, feats in (("6", FEATURES), ("9", FEATURES + SHAPE_FEATURES)):
        L = build_l1(body, refs, B0, feats)
        if L is None:
            return None
        XE = np.array([vec({**w[body]["features"], **(w[body].get("shape") or {})}, feats) for w in W])
        pct = Percentiles(XE[pop])
        L["QR"] = pct(L["R"])
        QE = pct(XE)
        r = l1_terrain(L, QE, pe, B0["S"])
        r.update(QE=QE, L=L, feats=feats, pre=r["T"] ** 0.6 * surf[:, 0] ** 0.4)
        r["valid"] = validate(r["pre"], lat, lon, pop)
        r["valid_fair"] = validate_fair(r["pre"], lat, lon, pop)
        res[name] = r
    # rasgos de forma: se adoptan si la media no baja y ningún análogo baja más de SHAPE_MAX_DROP
    v6, v9 = res["6"]["valid_fair"], res["9"]["valid_fair"]  # decide con el percentil justo
    common = [n for n in v6 if v6[n] is not None and v9[n] is not None]
    m6 = float(np.mean([v6[n] for n in common])) if common else None
    m9 = float(np.mean([v9[n] for n in common])) if common else None
    worst = min((v9[n] - v6[n] for n in common), default=None)
    ok = bool(common) and m9 >= m6 and worst >= -SHAPE_MAX_DROP
    dec = {"adopted": ok, "n_analogs": len(common), "mean_6": _r(m6, 1), "mean_9": _r(m9, 1),
           "worst_change": _r(worst, 1), "per_analog": {n: {"6": v6[n], "9": v9[n]} for n in common},
           "rule": f"media no baja y ningún análogo baja más de {SHAPE_MAX_DROP} puntos"}
    if not common:
        dec["note"] = "sin análogos de validación con ventanas L1: no se adoptan"
    r = res["9" if ok else "6"]
    r.update(W=W, lat=lat, lon=lon, control=control, pe=pe, pe_km=chord_to_km(d), surf=surf, decision=dec)
    L = r["L"]
    r["twin_idx"] = {k: nms(r["by_key"][:, g] ** 0.6 * surf[:, 0] ** 0.4, lat, lon, TWINS_PER_REF, TWIN_NMS_KM)
                     for g, k in enumerate(L["key_list"])}
    r["top"] = nms(r["pre"], lat, lon, TOP_N, NMS_KM)
    print(f"  {body}: {len(W)} ventanas ({control.sum()} de control), {len(L['refs'])} referencias L1 en "
          f"{len(L['key_list'])} claves; sin padre L0: {int((pe < 0).sum())} ventanas y "
          f"{int((L['pcol'] < 0).sum())} referencias (esas parejas no puntúan)")
    print(f"  {body}: rasgos de forma -> media de percentiles 6 rasgos {dec['mean_6']} / 9 rasgos {dec['mean_9']} "
          f"(peor cambio {dec['worst_change']}, {dec['n_analogs']} análogos): "
          f"{'SE ADOPTAN' if ok else 'no se adoptan'}")
    return r


def run_l1(l1: list[dict], refs: list[dict], L0: dict, E) -> dict[str, dict]:
    F1 = {}
    for body in ("moon", "mars"):
        W = [w for w in l1 if w.get(body) and w[body].get("features")]
        r = _l1_body(body, W, refs, L0[body], E) if W else None
        if r is not None:
            F1[body] = r
        elif W:
            print(f"  {body}: sin referencias L1 usables")
    return F1


def select_blocks(F1: dict, dest: Path) -> None:
    """Bloques L2: las L2_TOP mejores ventanas L1 por cuerpo (empezando por el mejor gemelo fino de cada
    clave) con supresión de vecinos a L2_NMS km, más N_CONTROL_BLOCKS ventanas L1 de control al azar."""
    blocks: dict[tuple[float, float], dict] = {}
    for body, r in F1.items():
        seed: list[int] = []
        skip = r["L"].get("twin_only_keys", set())  # L2 solo tiene referencias del polo sur
        for key, idx in r["twin_idx"].items():
            if key in skip:
                continue
            if idx and (not seed or haversine_km(r["lat"][idx[0]], r["lon"][idx[0]], r["lat"][seed],
                                                 r["lon"][seed]).min() >= L2_NMS):
                seed.append(idx[0])
        if len(seed) > L2_TOP:
            print(f"  AVISO {body}: {len(seed)} gemelos finos (más que {L2_TOP}); se mantienen todos")
        for n, i in enumerate(nms(r["pre"], r["lat"], r["lon"], max(L2_TOP, len(seed)), L2_NMS, seed=seed)):
            key = (round(float(r["lat"][i]), 5), round(float(r["lon"][i]), 5))
            b = blocks.setdefault(key, {"lat": key[0], "lon": key[1], "control": False, "body": body,
                                        "tile": r["W"][i].get("tile"), "reasons": []})
            if b["body"] != body:
                b["body"] = "both"
            b["reasons"].append(f"{'gemelo_fino' if n < len(seed) else 'top_L1'}_{body}:{r['L']['keys'][r['arg'][i]]}")
    n_cand = len(blocks)
    ctrl = {}  # ventanas L1 de control (las mismas para los dos cuerpos)
    for r in F1.values():
        for i in np.where(r["control"])[0]:
            ctrl.setdefault((round(float(r["lat"][i]), 5), round(float(r["lon"][i]), 5)), r["W"][i].get("tile"))
    ck = sorted(ctrl)
    rng = np.random.default_rng(SEED)
    for c in (rng.choice(len(ck), size=min(N_CONTROL_BLOCKS, len(ck)), replace=False) if ck else []):
        key = ck[c]
        b = blocks.setdefault(key, {"lat": key[0], "lon": key[1], "control": True, "body": "both",
                                    "tile": ctrl[key], "reasons": []})
        b["control"], b["body"] = True, "both"
        b["reasons"].append("control")
    bl = sorted(blocks.values(), key=lambda b: (b["reasons"] == ["control"], -b["lat"], b["lon"]))
    for n, b in enumerate(bl):
        # id según la posición (no según el orden): así un archivo L2 ya escaneado nunca se confunde
        # con otro bloque si la selección cambia
        # (solo letras, cifras, "_" y ".": fine_scan usa el id tal cual como nombre de archivo)
        ns, ew = ("n" if b["lat"] >= 0 else "s"), ("e" if b["lon"] >= 0 else "w")
        b["id"] = (f"{'control' if b['reasons'] == ['control'] else 'cand'}_"
                   f"{ns}{abs(b['lat']):07.3f}_{ew}{abs(b['lon']):08.3f}")
    bl = [{"id": b["id"], **{k: v for k, v in b.items() if k != "id"}} for b in bl]
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps({"created_by": "rank", "created": time.strftime("%Y-%m-%d %H:%M"), "seed": SEED,
                                "shape_features_adopted": {b: r["decision"]["adopted"] for b, r in F1.items()},
                                "blocks": bl}, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"\n== Selección L2: {len(bl)} bloques -> {dest} (candidatos {n_cand}, control "
          f"{sum(b['control'] for b in bl)}, por cuerpo {dict(Counter(b['body'] for b in bl))})")


def _l2_refs(body: str, rid1: str | None, refs2: list[dict], refs_by_id: dict) -> tuple[list[int], str]:
    """Referencias L2 con las que se compara un bloque según la mejor referencia L1 de su ventana:
    Luna, las de la misma región; Marte, los parches HiRISE del sitio o, si no, de su categoría."""
    every = list(range(len(refs2)))
    if not rid1:
        return every, "todas"
    r1 = refs_by_id[rid1]
    if body == "moon":
        s = [j for j, r in enumerate(refs2) if r1.get("region") and r.get("region") == r1["region"]]
        return (s, f"region:{r1['region']}") if s else (every, "todas")
    site = twin_key(r1)
    s = [j for j, r in enumerate(refs2) if r.get("parent") == site]
    if s:
        return s, f"parent:{site}"
    cat = (refs_by_id.get(site) or {}).get("hirise_category")
    s = [j for j, r in enumerate(refs2) if cat and r.get("group") == cat]
    return (s, f"categoria:{cat}") if s else (every, "todas")


def run_l2(l2: list[dict], refs: list[dict], refs_by_id: dict, F1: dict, L0: dict, E) -> dict[str, dict]:
    F2 = {}
    for body in ("moon", "mars"):
        BL = [dict(b, wins=[w for w in b.get(body) or [] if w.get("features")]) for b in l2]
        BL = [b for b in BL if b["wins"]]
        refs2 = [r for r in refs if r["body"] == body and r["level"] == "L2" and r.get("usable") and r.get("features")]
        if not BL or not refs2:
            continue
        feats = F1[body]["feats"] if body in F1 else FEATURES   # misma decisión de forma que en L1

        def fv(d):
            return vec({**d["features"], **(d.get("shape") or {})}, feats)
        has_ctrl = any(b.get("control") for b in BL)
        if not has_ctrl:
            print(f"  AVISO {body}: no hay bloques de control; percentiles con todas las ventanas L2")
        pct = Percentiles(np.array([fv(w) for b in BL if b.get("control") or not has_ctrl for w in b["wins"]]))
        QR = pct(np.array([fv(r) for r in refs2]))
        F = F1.get(body)
        tree1 = cKDTree(unit_xyz(F["lat"], F["lon"])) if F else None
        rows = []
        for b in BL:
            xyz = unit_xyz([b["lat"]], [b["lon"]])
            i1 = None
            if tree1 is not None:
                d1, j1 = tree1.query(xyz)
                i1 = int(j1[0]) if chord_to_km(d1[0]) < L1_MATCH_KM else None
            if i1 is not None:  # el bloque sale de una ventana L1: T0 y T1 de su mejor pareja
                rid1 = F["L"]["refs"][F["arg"][i1]]["id"]
                t0, t1 = float(F["T0"][i1]), float(F["T1"][i1])
            else:               # sin ventana L1: T0 = la mejor similitud de la ventana L0 más cercana
                rid1, t1 = None, math.nan
                d0, j0 = E.tree.query(xyz)
                t0 = float(L0[body]["t"][j0[0]]) if chord_to_km(d0[0]) < PARENT_MAX_KM else math.nan
            sub, scope = _l2_refs(body, rid1, refs2, refs_by_id)
            T2 = similarity(pct(np.array([fv(w) for w in b["wins"]])), QR[sub])
            wi, rj = np.unravel_index(int(T2.argmax()), T2.shape)
            t2 = float(T2[wi, rj])
            avail = [x for x in (t0, t1, t2) if np.isfinite(x)]
            tf = float(np.prod(avail) ** (1 / len(avail)))      # media geométrica de los niveles disponibles
            s, assumed = surface_score(b["wins"][wi])
            r2 = refs2[sub[rj]]
            rows.append({"block": b["block"], "lat": b["lat"], "lon": b["lon"], "control": bool(b.get("control")),
                         "i1": i1, "best_ref_L1": rid1, "T0": t0, "T1": t1, "T2": t2, "T": tf, "S": s,
                         "assumed": assumed, "pre": tf ** 0.6 * s ** 0.4, "win": b["wins"][wi],
                         "best_ref_L2": r2["id"], "hirise": r2.get("catalog_id"), "l2_scope": scope,
                         "n_wins": len(b["wins"])})
        pre = np.array([x["pre"] for x in rows])
        cm = np.array([x["control"] for x in rows])
        for x in rows:
            x["pct_control"] = round(float(((pre[cm] if cm.any() else pre) < x["pre"]).mean() * 100), 1)
        lat, lon = np.array([x["lat"] for x in rows]), np.array([x["lon"] for x in rows])
        F2[body] = {"rows": rows, "lat": lat, "lon": lon, "pre": pre, "final_idx": nms(pre, lat, lon, TOP_N, NMS_KM)}
        print(f"  {body}: {len(rows)} bloques ({int(cm.sum())} de control), {len(refs2)} referencias L2; "
              f"comparación: {dict(Counter(x['l2_scope'].split(':')[0] for x in rows))}")
    return F2


# ---------------------------------------------------------------- resultados

def climate_points(L0: dict, F1: dict, F2: dict, E) -> list[tuple[float, float]]:
    """Lo que se muestra: preselección y gemelos L0, gemelos L1 y finalistas (L2, o el top L1 si no hay L2)."""
    pts = []
    for body, B in L0.items():
        for i in set(B["chosen"]) | {i for v in B["twin_idx"].values() for i in v}:
            pts.append((float(E.lat[i]), float(E.lon[i])))
        if body in F1:
            r = F1[body]
            fi = {i for v in r["twin_idx"].values() for i in v} | (set() if body in F2 else set(r["top"]))
            pts += [(float(r["lat"][i]), float(r["lon"][i])) for i in fi]
        if body in F2:
            pts += [(float(F2[body]["lat"][i]), float(F2[body]["lon"][i]))
                    for i in list(F2[body]["final_idx"]) + list(F2[body].get("new_idx", []))]
    return pts


NEW_MIN_PRE = 0.6  # mínimo de terreno^0,6 · superficie^0,4 para entrar en el top de nuevos


def pick_new(F2: dict, lit: list) -> None:
    """Top de candidatos NO conocidos: los mejores bloques L2 que no están cerca de un análogo conocido
    ni constan como ya estudiados en la bibliografía (el reto valora sobre todo análogos nuevos)."""
    for body, f in F2.items():
        cand = np.array([i for i in range(len(f["pre"])) if f["pre"][i] >= NEW_MIN_PRE
                         and known_name(float(f["lat"][i]), float(f["lon"][i]), lit) is None], int)
        f["new_idx"] = nms(f["pre"], f["lat"], f["lon"], TOP_N, NMS_KM, cand=cand) if len(cand) else []


def build_sites(L0: dict, F1: dict, F2: dict, E, refs_by_id: dict, clim: dict, climate_scores, lit: list) -> dict:
    """bodies[b] = {sites, twins, heat, fine: {sites, twins, final}} con los sitios listos para la app."""

    def finish(body: str, d: dict, t: float, s: float, assumed: bool) -> dict:
        c = clim.get(f"{d['lat']:.4f},{d['lon']:.4f}")
        cs = climate_scores(c) if c is not None else None
        c_score = sum(CLIMATE_W[body][k] * v for k, v in cs.items()) if cs else None
        d["score"] = round(W_TERRAIN * t + W_SURFACE * s + W_CLIMATE * c_score, 4) if cs else None
        d["pre"] = round(float(t ** 0.6 * s ** 0.4), 4)
        d["scores"].update(terrain=round(float(t), 3), surface=round(float(s), 3),
                           climate=None if cs is None else round(float(c_score), 3))
        d["climate_parts"] = None if cs is None else {k: round(v, 3) for k, v in cs.items()}
        d["climate"] = None if c is None else {k: round(v, 2) for k, v in c.items()}
        d["surface_assumed"] = bool(assumed)
        d["known_analog"] = known_name(d["lat"], d["lon"], lit)
        d["literature"] = literature_for(lit, d["lat"], d["lon"])
        return d

    def site_l0(body: str, i: int, j: int, key: str | None = None) -> dict:
        B = L0[body]
        t = float(B["S"][i, j])
        d = {"lat": float(E.lat[i]), "lon": float(E.lon[i]), "elev_mean": E.rows[i]["elev_mean"], "level": "L0",
             "best_ref": B["refs"][j]["id"], "twin_key": key or B["keys"][j],
             "scores": {"terrain_L0": round(t, 3), "terrain_L1": None, "terrain_L2": None},
             "terrain_by_group": {k: round(float(v[i]), 3) for k, v in B["key_max"].items()},
             "features": E.rows[i]["features"], "cover": E.rows[i]["cover"]}
        return finish(body, d, t, float(E.surf[i]), bool(E.assumed[i]))

    def site_l1(body: str, i: int, g: int | None = None) -> dict:
        r, L = F1[body], F1[body]["L"]
        if g is None:
            j, t, t0, t1 = int(r["arg"][i]), float(r["T"][i]), float(r["T0"][i]), float(r["T1"][i])
        else:  # gemelo de la clave g: la mejor pareja con las referencias de esa clave
            cols = L["gcols"][g]
            sub = l1_terrain({**L, "QR": L["QR"][cols], "pcol": L["pcol"][cols], "gcols": [np.arange(len(cols))],
                              "rank": None},
                             r["QE"][i:i + 1], r["pe"][i:i + 1], L0[body]["S"])
            j, t, t0, t1 = int(cols[sub["arg"][0]]), float(sub["T"][0]), float(sub["T0"][0]), float(sub["T1"][0])
        w, ref, pe = r["W"][i], L["refs"][j], int(r["pe"][i])
        ll = {"lat": float(r["lat"][i]), "lon": float(r["lon"][i])}
        d = {**ll, "elev_mean": w.get("elev_mean"), "tile": w.get("tile"), "control": bool(w.get("control")),
             "level": "L1", "best_ref": ref["id"], "best_ref_L0": ref.get("parent"), "best_ref_L1": ref["id"],
             "best_ref_L2": None, "twin_key": L["keys"][j],
             "scores": {"terrain_L0": _r(t0), "terrain_L1": _r(t1), "terrain_L2": None},
             "parent_L0": None if pe < 0 else {"lat": float(E.lat[pe]), "lon": float(E.lon[pe]),
                                                "km": round(float(r["pe_km"][i]), 1)},
             "levels": {"L1": {**ll, "best_ref": ref["id"]}},
             "features": w[body]["features"], "shape": w[body].get("shape"), "cover": w.get("cover")}
        if pe >= 0:  # ventana L0 (30 km) del escaneo que contiene a esta, para comparar también a esa escala
            d["levels"]["L0"] = {**{k: d["parent_L0"][k] for k in ("lat", "lon")}, "best_ref": ref.get("parent")}
        return finish(body, d, t, float(r["surf"][i, 0]), bool(r["surf"][i, 1]))

    def site_l2(body: str, x: dict) -> dict:
        bw, r1 = x["win"], x["best_ref_L1"]
        l2 = {"lat": bw["lat"], "lon": bw["lon"], "best_ref": x["best_ref_L2"]}
        if x.get("hirise"):
            l2["hirise"] = x["hirise"]  # id del parche (public/terrain/<id>.f32)
        d = {"lat": x["lat"], "lon": x["lon"], "block": x["block"], "control": x["control"], "level": "L2",
             "elev_mean": bw.get("elev_mean"), "best_ref": r1 or x["best_ref_L2"], "best_ref_L1": r1,
             "best_ref_L2": x["best_ref_L2"], "twin_key": twin_key(refs_by_id[r1]) if r1 else None,
             "l2_scope": x["l2_scope"], "pct_control": x["pct_control"], "n_windows_L2": x["n_wins"],
             "scores": {"terrain_L0": _r(x["T0"]), "terrain_L1": _r(x["T1"]), "terrain_L2": _r(x["T2"])},
             "levels": {"L2": l2}, "l2": l2,
             "features": bw["features"], "shape": bw.get("shape"), "cover": bw.get("cover")}
        if x["i1"] is not None:
            F = F1[body]
            d["levels"]["L1"] = {"lat": float(F["lat"][x["i1"]]), "lon": float(F["lon"][x["i1"]]), "best_ref": r1}
            pe = int(F["pe"][x["i1"]])
            if pe >= 0:
                d["parent_L0"] = {"lat": float(E.lat[pe]), "lon": float(E.lon[pe])}
                d["best_ref_L0"] = refs_by_id[r1].get("parent") if r1 else None
                d["levels"]["L0"] = {**d["parent_L0"], "best_ref": d["best_ref_L0"]}
        return finish(body, d, x["T"], x["S"], x["assumed"])

    def order(s):
        return -(s["score"] if s["score"] is not None else s["pre"])

    bodies = {}
    for body, B in L0.items():
        thr = np.percentile(B["pre"], 97)  # mapa de calor: el 3 % mejor de todo el planeta
        heat = [[round(float(E.lat[i]), 2), round(float(E.lon[i]), 2), round(float(B["pre"][i]), 3)]
                for i in np.where(B["pre"] >= thr)[0]]
        sites = sorted((site_l0(body, i, int(B["best"][i])) for i in B["chosen"]), key=order)[:TOP_N]
        twins = {}
        for k, idx in B["twin_idx"].items():
            cols = B["groups"][k]
            twins[k] = sorted((site_l0(body, i, cols[int(B["S"][i, cols].argmax())], k) for i in idx), key=order)
        fine = {"sites": [], "twins": {}, "final": []}
        if body in F1:
            r = F1[body]
            fine["sites"] = sorted((site_l1(body, i) for i in r["top"]), key=lambda s: -s["pre"])  # sin clima
            fine["twins"] = {k: sorted((site_l1(body, i, g) for i in r["twin_idx"][k]), key=order)
                             for g, k in enumerate(r["L"]["key_list"])}
        if body in F2:
            fine["final"] = sorted((site_l2(body, F2[body]["rows"][i]) for i in F2[body]["final_idx"]), key=order)
            # top de candidatos no conocidos (pueden estar también en "final")
            fine["final_new"] = sorted((site_l2(body, F2[body]["rows"][i]) for i in F2[body].get("new_idx", [])),
                                       key=order)
        bodies[body] = {"sites": sites, "twins": twins, "heat": heat, "fine": fine}
    return bodies


# Sensibilidad a los pesos: los pesos 0,5/0,25/0,25 son una elección; se prueban todas las combinaciones
# de esta rejilla (terreno 0,35–0,7; superficie 0,1–0,35; clima = el resto, al menos 0,1).
SENS_TERRAIN = (0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7)
SENS_SURFACE = (0.1, 0.15, 0.2, 0.25, 0.3, 0.35)
SENS_TOP = 10


def weight_sensitivity(bodies: dict) -> dict:
    """Para cada finalista (ranking final y top de nuevos): en qué fracción de las combinaciones de pesos
    sigue en el top 10 de su lista y su mejor y peor puesto. Se guarda en el sitio como "robust"."""
    combos = [(wt, ws, round(1 - wt - ws, 3)) for wt in SENS_TERRAIN for ws in SENS_SURFACE if 1 - wt - ws >= 0.1 - 1e-9]
    info = {"n_combos": len(combos), "terrain": list(SENS_TERRAIN), "surface": list(SENS_SURFACE), "top": SENS_TOP}
    for body, B in bodies.items():
        fine = B.get("fine") or {}
        for key in ("final", "final_new"):
            lst = fine.get(key) or []
            if not lst:
                continue
            sc = np.array([[x["scores"]["terrain"], x["scores"]["surface"], x["scores"]["climate"] or 0.0] for x in lst])
            ranks = []
            for wt, ws, wc in combos:
                tot = sc @ np.array([wt, ws, wc])
                ranks.append(np.argsort(np.argsort(-tot, kind="stable"), kind="stable") + 1)
            R = np.array(ranks)                  # combos × sitios
            for j, x in enumerate(lst):
                x.setdefault("robust", {})[key] = {"top10_frac": round(float((R[:, j] <= SENS_TOP).mean()), 3),
                                                   "best": int(R[:, j].min()), "worst": int(R[:, j].max())}
    print(f"\n== Sensibilidad a los pesos: {len(combos)} combinaciones (terreno {SENS_TERRAIN[0]}–{SENS_TERRAIN[-1]}, "
          f"superficie {SENS_SURFACE[0]}–{SENS_SURFACE[-1]}, clima ≥ 0,1)")
    for body, B in bodies.items():
        for key in ("final", "final_new"):
            for x in ((B.get("fine") or {}).get(key) or [])[:10]:
                r = x["robust"][key]
                print(f"  {body:4s} {key:9s} {x['lat']:8.3f} {x['lon']:9.3f} top10 {r['top10_frac']:5.0%} "
                      f"puesto {r['best']}–{r['worst']}  {x.get('known_analog') or 'NUEVO'}")
    return info


def print_sites(bodies: dict) -> None:
    def line(s, key=""):
        sc = s["scores"]
        lv = " ".join(f"T{n}={sc[f'terrain_L{n}']}" for n in (0, 1, 2) if sc.get(f"terrain_L{n}") is not None)
        score = f"{s['score']:.3f}" if s["score"] is not None else "  —  "
        return (f"{key[:28]:28s} {score} pre={s['pre']:.3f} {s['lat']:8.3f} {s['lon']:9.3f} "
                f"ref={s['best_ref'][:30]:30s} {lv} S={sc['surface']:.2f} "
                f"C={sc['climate'] if sc['climate'] is not None else '—'}  {s['known_analog'] or 'NUEVO'}")
    for body, Bo in bodies.items():
        print(f"\n== GEMELOS L0 {body.upper()} ==")
        for k, tw in Bo["twins"].items():
            for s in tw:
                print(line(s, k))
        print(f"\n== TOP L0 {body.upper()} ==")
        for s in Bo["sites"]:
            print(line(s))
        for lab, lst in (("TOP L1", Bo["fine"]["sites"]), ("FINAL L2", Bo["fine"]["final"])):
            if lst:
                print(f"\n== {lab} {body.upper()} ==")
                for s in lst:
                    print(line(s))
        if Bo["fine"]["twins"]:
            print(f"\n== GEMELOS L1 {body.upper()} ==")
            for k, tw in Bo["fine"]["twins"].items():
                for s in tw:
                    print(line(s, k))


def validation_table(before: dict, after: dict, fine: dict, fine_fair: dict | None = None) -> tuple[list, list]:
    fine_fair = fine_fair or {}
    print("\n== Validación (percentil de la mejor ventana a <50 km; L0 entre todas las ventanas, "
          "fino L1 entre las de control; 'L1 justo' frente a la mejor ventana a <50 km de cada punto de control)")
    print(f"  {'cuerpo':6s} {'análogo':32s} {'antes':>6s} {'después':>8s} {'delta':>6s} {'fino L1':>8s} {'L1 justo':>9s}")

    def f(x):
        return f"{x:6.1f}" if x is not None else "     —"
    ok, missing = [], []
    for body in ("moon", "mars"):
        for name, la, lo, _, _ in VALIDATION:
            b0 = (before.get(body) or {}).get(name)
            a0 = after[body].get(name)
            f0 = (fine.get(body) or {}).get(name)
            ff = (fine_fair.get(body) or {}).get(name)
            delta = round(a0 - b0, 1) if a0 is not None and b0 is not None else None
            v = {"body": body, "name": name, "lat": la, "lon": lo, "percentile": a0,
                 "before": b0, "after": a0, "delta": delta, "fine": f0, "fine_fair": ff}
            if a0 is None:  # la app espera un número en "percentile"
                v["note"] = f"sin ventana a <{VALID_KM} km"
            (ok if a0 is not None else missing).append(v)
            print(f"  {body:6s} {name[:32]:32s} {f(b0)} {f(a0):>8s} "
                  f"{(f'{delta:+6.1f}' if delta is not None else f(None))} {f(f0):>8s} {f(ff):>9s}"
                  f"{'   sin ventana a <50 km' if a0 is None else ''}")
        vals = [x for x in ok if x["body"] == body]
        if vals and before:
            print(f"  {body:6s} media de {len(vals)}: antes {np.mean([x['before'] for x in vals]):.1f}, "
                  f"después {np.mean([x['after'] for x in vals]):.1f}")
    return ok, missing


def check_featured(bodies: dict) -> list[dict]:
    out = []
    for f in FEATURED:
        tw = bodies[f["body"]]["twins"].get(f["ref"])
        if tw is None:
            print(f"AVISO: historia destacada '{f['title']}': no existe la clave de gemelos '{f['ref']}'; se quita")
            continue
        fine = bodies[f["body"]].get("fine") or {}
        pool = list(tw) + list(fine.get("final") or []) + list(fine.get("sites") or []) +             [x for v in (fine.get("twins") or {}).values() for x in v]
        dmin = min(float(haversine_km(f["lat"], f["lon"], s["lat"], s["lon"])) for s in pool)
        if dmin > 30:  # la app busca el sitio de la historia a < 30 km (ranking final, gemelos finos y L0)
            print(f"AVISO: historia destacada '{f['ref']}': ningún sitio a <30 km de su punto (el más cercano "
                  f"a {dmin:.0f} km); la app no la mostrará")
        out.append(f)
    return out


# ---------------------------------------------------------------- principal

def main(argv=None) -> None:
    ap = argparse.ArgumentParser(description="Ranking de análogos (L0 → L1 → L2).")
    ap.add_argument("--no-climate", action="store_true", help="clima ficticio -> data/prueba/results.json")
    ap.add_argument("--climate-budget", type=int, default=0, help="máximo de consultas nuevas a Meteomatics")
    ap.add_argument("--fine-dir", type=Path, default=None, help="carpeta con l1/ y l2/ (por defecto data/fine)")
    ap.add_argument("--sel-dir", type=Path, default=None, help="dónde escribir fine_tiles.json y fine_l2_blocks.json")
    ap.add_argument("--salida", type=Path, default=None, help="ruta del results.json")
    ap.add_argument("--refs", type=Path, default=None, help="referencias (por defecto data/references_v2.json)")
    ap.add_argument("--literatura", type=Path, default=LITERATURE, help="bibliografía (si existe)")
    a = ap.parse_args(argv)
    fine_dir = a.fine_dir or FINE_DIR
    sel_dir = a.sel_dir or a.fine_dir or DATA
    t_start = time.time()

    refs, version = load_refs(a.refs)
    refs_by_id = {r["id"]: r for r in refs}
    lit = load_literature(a.literatura)
    E = earth_l0()
    print(f"{len(E.rows)} ventanas terrestres; referencias {version}: {len(refs)} "
          f"({sum(bool(r.get('usable')) for r in refs)} usables)")

    L0 = run_l0(refs, E)
    before = {}
    if REFS_BEFORE.exists():
        before = v1_validation(E.rows, json.loads(REFS_BEFORE.read_text(encoding="utf-8")), E.surf, E.lat, E.lon)
    else:
        print(f"AVISO: no existe {REFS_BEFORE}; sin validación 'antes'")
    after = {b: validate(B["pre"], E.lat, E.lon, None) for b, B in L0.items()}
    select_tiles(L0, E, version, sel_dir / "fine_tiles.json")

    l1 = load_fine(fine_dir, 1)
    F1 = {}
    if l1:
        print(f"\n== L1: {len(l1)} ventanas de {fine_dir / 'l1'}")
        F1 = run_l1(l1, refs, L0, E)
        if F1:
            select_blocks(F1, sel_dir / "fine_l2_blocks.json")
    l2 = load_fine(fine_dir, 2, sel_dir / "fine_l2_blocks.json")
    F2 = {}
    if l2:
        print(f"\n== L2: {len(l2)} bloques de {fine_dir / 'l2'}")
        F2 = run_l2(l2, refs, refs_by_id, F1, L0, E)

    pick_new(F2, lit)
    clim = get_climate(climate_points(L0, F1, F2, E), a.no_climate, a.climate_budget)
    bodies = build_sites(L0, F1, F2, E, refs_by_id, clim, climate_module(a.no_climate).climate_scores, lit)
    sens = weight_sensitivity(bodies)
    print_sites(bodies)
    valid, missing = validation_table(before, after, {b: r["valid"] for b, r in F1.items()},
                                      {b: r.get("valid_fair") for b, r in F1.items()})

    groups = group_info(refs)
    out_refs = [{**r, "note": r.get("note") or r.get("source_note") or ""} for r in refs if r["level"] == "L0"]
    for k, g in groups.items():  # claves sin referencia propia (malla_polar): entrada de grupo para la app
        if g["n_refs"] and k not in refs_by_id:
            out_refs.append({"id": k, "body": g["body"], "level": "L0", "kind": "grupo", "name": g["name"],
                             "note": f"Grupo de {g['n_refs']} referencias L0 (ver reference_points).",
                             "features": None, "usable": True, "group_only": True})
    # Referencias L1/L2 que aparecen como mejor pareja de algún sitio mostrado: la app las necesita para
    # la tabla de rasgos de cada escala (references solo lleva las L0, que son las que se dibujan en los globos).
    used = set()
    for B in bodies.values():
        pools = [B["sites"], *B["twins"].values()]
        fine = B.get("fine") or {}
        pools += [fine.get("sites") or [], fine.get("final") or [], *(fine.get("twins") or {}).values()]
        for lst in pools:
            for x in lst:
                used.update(v.get("best_ref") for v in (x.get("levels") or {}).values())
                used.update((x.get("best_ref_L1"), x.get("best_ref_L2")))
    keep = ("id", "body", "level", "group", "region", "name", "lat", "lon", "kind", "parent", "window_km", "px_m",
            "source_url", "source_note", "coord_quality", "features", "shape", "quality", "usable", "usable_note")
    refs_fine = [{k: r.get(k) for k in keep} for r in refs if r["level"] != "L0" and r["id"] in used]
    out = {"version": 2, "references_version": version, "references": out_refs, "references_fine": refs_fine,
           "feature_labels": {k: feature_labels(SCALES[("moon", "L0")][1])[k] for k in FEATURES},
           "bodies": bodies, "validation": valid, "validation_no_window": missing,
           "ref_quantiles": {r["id"]: dict(zip(FEATURES, map(float, B["QR"][j])))
                             for B in L0.values() for j, r in enumerate(B["refs"])},
           "featured": check_featured(bodies), "groups": groups,
           "levels": {lv: {b: {**LEVELS[lv][b], "window_km": SCALES[(b, lv)][0], "px_m": SCALES[(b, lv)][1],
                               "feature_labels": feature_labels(SCALES[(b, lv)][1])} for b in ("moon", "mars")}
                      for lv in ("L0", "L1", "L2")},
           "reference_points": [[r["id"], r["body"], r["level"], r.get("group"), r["lat"], r["lon"],
                                 bool(r.get("usable"))] for r in refs],
           "shape_features_adopted": {b: r["decision"] for b, r in F1.items()},
           "weight_sensitivity": sens,
           "weights": {"terrain": W_TERRAIN, "surface": W_SURFACE, "climate": W_CLIMATE},
           "n_windows": len(E.rows), "n_fine": {"L1": len(l1), "L2": len(l2)}}

    # Con clima ficticio no se sobrescriben los resultados reales de la app.
    dest = a.salida or (TEST_RESULTS if a.no_climate else APP_RESULTS)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False, allow_nan=False, default=_json_default), encoding="utf-8")
    print(f"\nGuardado {dest} ({dest.stat().st_size / 1e6:.1f} MB) en {time.time() - t_start:.0f} s")


def _json_default(o):
    if isinstance(o, np.generic):
        return o.item()
    raise TypeError(f"no serializable: {type(o)}")


if __name__ == "__main__":
    main()
