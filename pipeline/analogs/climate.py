"""Clima de un año (Meteomatics) para los sitios candidatos.

Una sola petición trae muchos puntos a la vez (separados por "+"), así que
gasta muy pocas consultas de las 1.000 diarias (lotes de 10 puntos = 1 consulta).
Se guarda en data/climate_ecmwf-era5.json y solo se piden los puntos que no estén ya.
(data/climate.json es la caché antigua del modelo "mix"; ya no se usa.)
"""

from __future__ import annotations

import json
from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from meteomatics_client import get_raw

MODEL = "ecmwf-era5"
CACHE = Path(__file__).resolve().parent.parent / "data" / f"climate_{MODEL}.json"
PARAMS = ["t_min_2m_24h:C", "t_max_2m_24h:C", "precip_24h:mm", "wind_speed_10m:ms"]
YEAR = 2025
BATCH = 10


def _key(lat: float, lon: float) -> str:
    return f"{lat:.4f},{lon:.4f}"


def fetch(points: list[tuple[float, float]]) -> dict[str, dict]:
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    todo = [p for p in points if _key(*p) not in cache]
    dates = (f"{datetime(YEAR, 1, 1, tzinfo=timezone.utc):%Y-%m-%dT%H:%M:%SZ}--"
             f"{datetime(YEAR, 12, 31, tzinfo=timezone.utc):%Y-%m-%dT%H:%M:%SZ}:P1D")
    for i in range(0, len(todo), BATCH):
        chunk = todo[i:i + BATCH]
        loc = "+".join(f"{lat:.4f},{lon:.4f}" for lat, lon in chunk)
        # ERA5: el modelo por defecto ("mix") daba lluvias irreales en zonas áridas
        # (p. ej. 1.181 mm/año en la Puna frente a 195 mm/año con ERA5).
        data = get_raw(dates, PARAMS, loc, "json", timeout=240, model=MODEL).json()["data"]
        series = {}
        for item in data:
            for coord in item["coordinates"]:
                k = _key(coord["lat"], coord["lon"])
                series.setdefault(k, {})[item["parameter"]] = [d["value"] for d in coord["dates"]]
        for (lat, lon) in chunk:
            s = series.get(_key(lat, lon))
            if s is None:  # Meteomatics puede redondear coordenadas: busca la más cercana
                k = min(series, key=lambda kk: abs(float(kk.split(",")[0]) - lat) + abs(float(kk.split(",")[1]) - lon))
                s = series[k]
            tmin, tmax = np.array(s[PARAMS[0]], float), np.array(s[PARAMS[1]], float)
            cache[_key(lat, lon)] = {
                "t_mean": float(np.mean((tmin + tmax) / 2)),
                "t_min": float(tmin.min()),
                "t_max": float(tmax.max()),
                "diurnal_range": float(np.mean(tmax - tmin)),
                "precip_year": float(np.sum(s[PARAMS[2]])),
                "wind_mean": float(np.mean(s[PARAMS[3]])),
            }
        print(f"clima: {min(i + BATCH, len(todo))}/{len(todo)} sitios", flush=True)
        CACHE.write_text(json.dumps(cache, indent=1), encoding="utf-8")
    return {_key(*p): cache[_key(*p)] for p in points}


def climate_scores(c: dict) -> dict[str, float]:
    """Qué tan 'extremo' es el clima, de 0 a 1, en la dirección de la Luna/Marte.
    Ningún lugar de la Tierra llega a sus valores reales (Marte ~ -60 °C de media;
    polo sur lunar < -200 °C en zonas en sombra), así que esto mide cercanía relativa."""
    cold = float(np.clip((15 - c["t_mean"]) / 65, 0, 1))                      # 15 °C -> 0 ; -50 °C -> 1
    dry = float(np.clip(1 - np.log10(c["precip_year"] + 1) / 3, 0, 1))          # 0 mm -> 1 ; 1000 mm -> 0
    swing = float(np.clip(c["diurnal_range"] / 25, 0, 1))                     # 25 °C de oscilación -> 1
    return {"cold": cold, "dry": dry, "swing": swing}
