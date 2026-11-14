"""Ranking de análogos terrestres de la Luna (polo sur) y Marte.

Puntuación por dimensión (0–1), para poder decir QUÉ se parece y QUÉ no:
  - terreno:   similitud de pendientes, rugosidad y relieve con el sitio de referencia más parecido
  - superficie: fracción de suelo desnudo (roca/arena) o hielo, sin vegetación (ESA WorldCover)
  - clima:     frío, seco y con gran oscilación térmica diaria (Meteomatics, año 2025)
Total = 0.5·terreno + 0.25·superficie + 0.25·clima.

Ejecutar desde pipeline/ (después de earth_scan y references):
    python -m analogs.rank                 -> ../src/data/results.json (lo lee la vista Luna/Marte)
    python -m analogs.rank --no-climate    -> data/prueba/results.json (prueba: clima ficticio,
                                              no gasta consultas y no toca la app)
El clima se guarda en caché (data/climate_ecmwf-era5.json): solo se piden los puntos nuevos.
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

from .climate import climate_scores, fetch
from .terrain import FEATURE_LABELS, FEATURES

ROOT = Path(__file__).resolve().parent.parent       # pipeline/
DATA = ROOT / "data"
APP_RESULTS = ROOT.parent / "src" / "data" / "results.json"
TEST_RESULTS = DATA / "prueba" / "results.json"

LOG_FEATURES = {"relief", "rough_1km"}
W_TERRAIN, W_SURFACE, W_CLIMATE = 0.5, 0.25, 0.25
CLIMATE_W = {"moon": {"cold": 0.5, "dry": 0.25, "swing": 0.25},
             "mars": {"cold": 0.35, "dry": 0.35, "swing": 0.3}}
SHORTLIST, TOP_N, NMS_KM = 40, 20, 150
TWINS_PER_REF, TWIN_NMS_KM = 3, 300
TERRAIN_SIGMA = 0.08  # diferencia media de percentiles a la que la similitud cae a 1/e

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


def haversine_km(lat1, lon1, lat2, lon2):
    p1, p2 = np.radians(lat1), np.radians(lat2)
    dphi, dlmb = p2 - p1, np.radians(np.asarray(lon2) - np.asarray(lon1))
    a = np.sin(dphi / 2) ** 2 + np.cos(p1) * np.cos(p2) * np.sin(dlmb / 2) ** 2
    return 6371 * 2 * np.arcsin(np.sqrt(a))


# Historias destacadas (elegidas a mano tras ver el ranking y revisar la bibliografía).
FEATURED = [
    {
        "body": "moon", "ref": "shackleton", "lat": -29.4982, "lon": -69.5145, "tag": "nuevo",
        "title": "Alta cordillera de los Andes (~29,5°S), gemela del borde de Shackleton",
        "story": ("Una ventana de 30 km a ~4.200 m en la frontera Chile–Argentina tiene casi la misma "
                  "distribución de pendientes que el borde del cráter Shackleton (pendiente típica 14,6° frente a 14,1°; "
                  "48 % del terreno por encima de 15° frente a 47 %), con un 98 % de roca desnuda y una media anual "
                  "de −6 °C. Sirve para probar movilidad de rovers y aterrizaje en laderas empinadas como las de las "
                  "crestas iluminadas del polo sur lunar. No hemos encontrado estudios que la usen como análogo lunar; "
                  "los Andes sí se estudian como análogo de Marte, sobre todo más al norte (Puna, Atacama)."),
    },
    {
        "body": "mars", "ref": "jezero", "lat": 37.5018, "lon": 95.7353, "tag": "validación",
        "title": "Cuenca de Qaidam (Tíbet, China), gemela de Jezero",
        "story": ("Sin decírselo, el método encontró la cuenca de Qaidam como el mejor gemelo del cráter Jezero "
                  "(pendiente típica 1,7° frente a 1,8°; relieve 721 m frente a 831 m; rugosidad 29 m frente a 30 m). "
                  "Qaidam ya está propuesta en la literatura científica como análogo de Marte: antiguo lago "
                  "evaporado a ~3.400 m, frío, seco, con mucha radiación UV, yardangs, sales y playas. Que el método "
                  "la redescubra solo con datos globales es una buena prueba de que funciona."),
    },
    {
        "body": "mars", "ref": "elysium", "lat": 42.1349, "lon": 55.7927, "tag": "nuevo",
        "title": "Meseta de Ustyurt (Uzbekistán), gemela fría de Elysium Planitia",
        "story": ("Las llanuras del Sahara son las más parecidas a Elysium y Utopia, pero son cálidas. Ustyurt "
                  "tiene el mismo terreno (pendiente típica 0,22° frente a 0,25°; relieve 74 m frente a 74 m), "
                  "un 100 % de suelo desnudo y además inviernos duros (mínima de −18 °C en 2025 según ERA5). "
                  "Una llanura muy plana, seca y fría es un buen sitio para ensayar aterrizajes, navegación sobre "
                  "terreno sin referencias y operaciones en frío. No hemos encontrado estudios científicos que la "
                  "propongan como análogo de Marte; solo comparaciones turísticas."),
    },
]


def known_name(lat: float, lon: float) -> str | None:
    """Nombre del análogo conocido más cercano si está dentro de su radio."""
    best = None
    for name, la, lo, radius, _ in KNOWN_ANALOGS:
        d = float(haversine_km(lat, lon, la, lo))
        if d < radius and (best is None or d < best[1]):
            best = (name, d)
    if best:
        return best[0]
    if lat < -60:
        return "Antártida (muy estudiada como análogo)"
    return None


def load_earth() -> list[dict]:
    sites = []
    for f in sorted((DATA / "earth").glob("band_*.json")):
        sites.extend(json.loads(f.read_text(encoding="utf-8")))
    return sites


def surface_score(site: dict) -> tuple[float, bool]:
    c = site["cover"]
    if c is None:  # sin WorldCover: solo lo suponemos en la Antártida (hielo/roca)
        return (0.6, True) if site["lat"] < -60 else (0.0, True)  # 0.6 = mismo peso que hielo/nieve
    return min(1.0, c["bare"] + 0.6 * c["snow_ice"] + 0.3 * c["moss_lichen"]), False


def main() -> None:
    refs = json.loads((DATA / "references.json").read_text(encoding="utf-8"))
    earth = load_earth()
    print(f"{len(earth)} ventanas terrestres, {len(refs)} referencias")

    def vec(f):
        return np.array([math.log1p(f[k]) if k in LOG_FEATURES else f[k] for k in FEATURES])

    X = np.array([vec(s["features"]) for s in earth])
    R = np.array([vec(r["features"]) for r in refs])
    # Cada rasgo se pasa a su percentil dentro de la Tierra (0 = el más bajo, 1 = el más alto).
    # Así la Luna, más abrupta que casi toda la Tierra, se compara con lo más abrupto de aquí.
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
    ref_quantiles = {r["id"]: dict(zip(FEATURES, map(float, QR[i]))) for i, r in enumerate(refs)}
    surf = np.array([surface_score(s) for s in earth])
    S_surface, surf_assumed = surf[:, 0], surf[:, 1].astype(bool)
    lats = np.array([s["lat"] for s in earth])
    lons = np.array([s["lon"] for s in earth])

    out = {"references": refs, "feature_labels": FEATURE_LABELS, "bodies": {}, "validation": [],
           "ref_quantiles": ref_quantiles, "featured": FEATURED,
           "weights": {"terrain": W_TERRAIN, "surface": W_SURFACE, "climate": W_CLIMATE},
           "n_windows": len(earth)}

    for body in ("moon", "mars"):
        idx_refs = [i for i, r in enumerate(refs) if r["body"] == body]
        st = S_terrain[:, idx_refs]
        best_ref = np.array(idx_refs)[st.argmax(axis=1)]
        t_score = st.max(axis=1)
        pre = t_score ** 0.6 * S_surface ** 0.4

        # mapa de calor: el 3 % mejor de todo el planeta
        thr = np.percentile(pre, 97)
        heat = [[round(float(lats[i]), 2), round(float(lons[i]), 2), round(float(pre[i]), 3)]
                for i in np.where(pre >= thr)[0]]

        # preselección con supresión de vecinos (para no listar 20 ventanas del mismo desierto)
        order = np.argsort(-pre)
        chosen: list[int] = []
        for i in order:
            if len(chosen) >= SHORTLIST:
                break
            if chosen and haversine_km(lats[i], lons[i], lats[chosen], lons[chosen]).min() < NMS_KM:
                continue
            chosen.append(int(i))

        # gemelos por sitio: los mejores lugares de la Tierra para CADA referencia
        twin_idx: dict[int, list[int]] = {}
        for j in idx_refs:
            pj = S_terrain[:, j] ** 0.6 * S_surface ** 0.4
            pick: list[int] = []
            for i in np.argsort(-pj):
                if len(pick) >= TWINS_PER_REF:
                    break
                if pick and haversine_km(lats[i], lons[i], lats[pick], lons[pick]).min() < TWIN_NMS_KM:
                    continue
                pick.append(int(i))
            twin_idx[j] = pick

        all_idx = sorted(set(chosen) | {i for v in twin_idx.values() for i in v})
        pts = [(float(lats[i]), float(lons[i])) for i in all_idx]
        if "--no-climate" in sys.argv:  # pruebas rápidas sin gastar consultas
            dummy = {"t_mean": 15, "t_min": 0, "t_max": 30, "diurnal_range": 0, "precip_year": 1000, "wind_mean": 0}
            clim = {f"{la:.4f},{lo:.4f}": dummy for la, lo in pts}
        else:
            clim = fetch(pts)

        def make_site(i: int, j: int) -> dict:
            """Sitio terrestre i comparado con la referencia j."""
            c = clim[f"{lats[i]:.4f},{lons[i]:.4f}"]
            cs = climate_scores(c)
            c_score = sum(CLIMATE_W[body][k] * v for k, v in cs.items())
            t = float(S_terrain[i, j])
            total = W_TERRAIN * t + W_SURFACE * S_surface[i] + W_CLIMATE * c_score
            return {
                "lat": float(lats[i]), "lon": float(lons[i]), "elev_mean": earth[i]["elev_mean"],
                "score": round(float(total), 4),
                "scores": {"terrain": round(t, 3), "surface": round(float(S_surface[i]), 3),
                           "climate": round(float(c_score), 3)},
                "climate_parts": {k: round(v, 3) for k, v in cs.items()},
                "climate": {k: round(v, 2) for k, v in c.items()},
                "best_ref": refs[j]["id"],
                "terrain_by_ref": {refs[k]["id"]: round(float(S_terrain[i, k]), 3) for k in idx_refs},
                "features": earth[i]["features"], "cover": earth[i]["cover"],
                "surface_assumed": bool(surf_assumed[i]),
                "known_analog": known_name(float(lats[i]), float(lons[i])),
            }

        sites = sorted((make_site(i, int(best_ref[i])) for i in chosen), key=lambda s: -s["score"])
        twins = {refs[j]["id"]: sorted((make_site(i, j) for i in twin_idx[j]), key=lambda s: -s["score"])
                 for j in idx_refs}
        out["bodies"][body] = {"sites": sites[:TOP_N], "twins": twins, "heat": heat}
        print(f"\n== GEMELOS {body.upper()} ==")
        for rid, tw in twins.items():
            for s in tw:
                print(f"{rid:11s} {s['score']:.3f} {s['lat']:8.3f} {s['lon']:9.3f} T={s['scores']['terrain']:.2f} "
                      f"S={s['scores']['surface']:.2f} C={s['scores']['climate']:.2f} Tm={s['climate']['t_mean']:6.1f} "
                      f"P={s['climate']['precip_year']:6.0f}  {s['known_analog'] or 'NUEVO'}")
        print(f"\n== {body.upper()} ==")
        for s in sites[:TOP_N]:
            print(f"{s['score']:.3f}  {s['lat']:8.3f} {s['lon']:9.3f}  ref={s['best_ref']:11s} "
                  f"T={s['scores']['terrain']:.2f} S={s['scores']['surface']:.2f} C={s['scores']['climate']:.2f}"
                  f"  {s['known_analog'] or 'NUEVO'}")

        # validación: ¿en qué percentil caen los análogos conocidos?
        for name, la, lo, _, validate in KNOWN_ANALOGS:
            if not validate:
                continue
            d = haversine_km(la, lo, lats, lons)
            near = np.where(d < 50)[0]
            if len(near) == 0:
                continue
            j = near[pre[near].argmax()]
            pct = float((pre < pre[j]).mean() * 100)
            out["validation"].append({"body": body, "name": name, "lat": la, "lon": lo,
                                      "percentile": round(pct, 1)})
    print("\nValidación (percentil global de la mejor ventana a <50 km):")
    for v in out["validation"]:
        print(f"  {v['body']:5s} {v['name']:32s} {v['percentile']:5.1f}")

    # Con clima ficticio no se sobrescriben los resultados reales de la app.
    dest = TEST_RESULTS if "--no-climate" in sys.argv else APP_RESULTS
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(out, ensure_ascii=False), encoding="utf-8")
    print(f"\nGuardado {dest}")


if __name__ == "__main__":
    main()
