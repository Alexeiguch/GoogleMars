"""Cliente mínimo para la Meteomatics Weather API.

Estructura de una consulta:
    https://api.meteomatics.com/<fechas>/<parametros>/<ubicacion>/<formato>?<opcionales>

Las credenciales se leen de .env (METEOMATICS_USER / METEOMATICS_PASSWORD).
Límite del plan del hackathon: 1.000 consultas al día.
"""

from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone

import requests
from dotenv import load_dotenv

BASE_URL = "https://api.meteomatics.com"

load_dotenv()


def _auth() -> tuple[str, str]:
    user = os.getenv("METEOMATICS_USER")
    password = os.getenv("METEOMATICS_PASSWORD")
    if not user or not password:
        raise RuntimeError(
            "Faltan credenciales: copia .env.example como .env y rellena "
            "METEOMATICS_USER y METEOMATICS_PASSWORD."
        )
    return user, password


def _fmt(dt: datetime) -> str:
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def time_range(start: datetime, end: datetime | None = None, step: str = "PT1H") -> str:
    """Construye el segmento de fechas. Sin `end` devuelve un instante único.

    `step` usa formato ISO 8601: PT1H (1 hora), PT15M, P1D (1 día)...
    """
    if end is None:
        return _fmt(start)
    return f"{_fmt(start)}--{_fmt(end)}:{step}"


def get_raw(dates: str, parameters: list[str] | str, location: str, fmt: str = "json",
            timeout: float = 60, **optionals) -> requests.Response:
    """Llamada genérica. Úsala para cualquier formato (json, csv, png, netcdf...)."""
    params = ",".join(parameters) if isinstance(parameters, list) else parameters
    url = f"{BASE_URL}/{dates}/{params}/{location}/{fmt}"
    resp = requests.get(url, auth=_auth(), params=optionals or None, timeout=timeout)
    if resp.status_code != 200:
        raise RuntimeError(f"Meteomatics {resp.status_code}: {resp.text[:500]}\nURL: {url}")
    return resp


def point_timeseries(lat: float, lon: float, parameters: list[str],
                     start: datetime, end: datetime | None = None,
                     step: str = "PT1H") -> dict[str, list[tuple[str, float]]]:
    """Serie temporal en un punto. Devuelve {parametro: [(fecha, valor), ...]}."""
    resp = get_raw(time_range(start, end, step), parameters, f"{lat},{lon}", "json")
    out: dict[str, list[tuple[str, float]]] = {}
    for item in resp.json()["data"]:
        dates = item["coordinates"][0]["dates"]
        out[item["parameter"]] = [(d["date"], d["value"]) for d in dates]
    return out


def usage_stats() -> dict:
    """Consultas usadas y límites de la cuenta (no consume cuota)."""
    resp = requests.get(f"{BASE_URL}/user_stats_json", auth=_auth(), timeout=30)
    resp.raise_for_status()
    return resp.json()


if __name__ == "__main__":
    # Prueba rápida: temperatura, lluvia y viento en las próximas 24 h (Berlín, como en la doc).
    now = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    data = point_timeseries(
        52.520551, 13.461804,
        ["t_2m:C", "precip_1h:mm", "wind_speed_10m:ms"],
        start=now, end=now + timedelta(hours=24), step="PT3H",
    )
    for param, series in data.items():
        print(f"\n{param}")
        for date, value in series:
            print(f"  {date}  {value}")

    try:
        print("\nUso de la cuenta:", usage_stats())
    except Exception as exc:  # el endpoint de estadísticas es opcional
        print("\n(No se pudieron leer las estadísticas de uso:", exc, ")")
