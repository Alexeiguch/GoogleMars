r"""Regenera el parche de Ulysses Colles y las medidas de los pares NASA.

Desde pipeline/:
    python -m analogs.nasa_terrain DTEED_008262_1855_042652_1855_A01.IMG \
        Copernicus_DSM_COG_10_N37_00_E029_00_DEM.tif ESA_WorldCover_10m_2021_v200_N36E027_Map.tif

El IMG se descarga de la ficha HiRISE en ULYSSES_SOURCE. Los GeoTIFF son los
tiles N37E029 de Copernicus DEM GLO-30 y N36E027 de WorldCover 2021 v200.
Se usan ventanas cuadradas de 2 km con celdas de 20 m y fila 0 al norte.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from tempfile import NamedTemporaryFile

import numpy as np
import rasterio
from rasterio.crs import CRS
from rasterio.enums import Resampling
from rasterio.transform import from_origin
from rasterio.warp import reproject

from .patches import CELL, GRID, cover_fractions, patch_metrics, terrain_similarity, total_score

PROJECT = Path(__file__).resolve().parents[2]
CATALOG_PATH = PROJECT / "src/data/catalog.json"
MEASURES_PATH = PROJECT / "src/data/nasa-terrain.json"
TERRAIN_DIR = PROJECT / "public/terrain"
ULYSSES_ID = "ulysses-colles"
ULYSSES_SOURCE = "https://www.uahirise.org/dtm/dtm.php?ID=PSP_008262_1855"
ULYSSES_PRODUCT = "https://hirise-pds.lpl.arizona.edu/PDS/DTM/PSP/ORB_008200_008299/PSP_008262_1855_ESP_042652_1855/DTEED_008262_1855_042652_1855_A01.IMG"
MARS_DATUM = "+R=3396036.8126024"  # Radio local del producto HiRISE.
EARTH_DATUM = "+datum=WGS84"
# Cono meridional en el DEM HiRISE. La ilustración de NASA muestra el campo volcánico.
ULYSSES_CENTER = (5.563, -122.968)
# Afloramiento de paleodelta, figura 4 del informe NASA de Garczynski (2020).
SALDA_CENTER = (37.524336, 29.637971)
WINDOW_M = GRID * CELL


def sample_window(path: Path, center: tuple[float, float], datum: str, method: Resampling) -> np.ndarray:
    lat, lon = center
    projection = CRS.from_proj4(f"+proj=aeqd +lat_0={lat} +lon_0={lon} {datum} +units=m +no_defs")
    result = np.full((GRID, GRID), np.nan, dtype="<f4")
    with rasterio.open(path) as raster:
        reproject(
            rasterio.band(raster, 1), result,
            dst_crs=projection,
            dst_transform=from_origin(-WINDOW_M / 2, WINDOW_M / 2, CELL, CELL),
            dst_nodata=np.nan,
            resampling=method,
        )
    if not np.isfinite(result).all():
        raise ValueError(f"La ventana de {lat}, {lon} contiene celdas sin datos en {path}")
    return result


def eligible_earth(catalog: list[dict], target: dict) -> list[dict]:
    return [
        site for site in catalog if site["planet"] == "Earth"
        and (site["origin"] == "global" or target["category"] in site.get("groups", []))
    ]


def measurement(site: dict) -> dict:
    return {
        "lat": site["latitude"],
        "lon": site["longitude"],
        **{key: round(site["metrics"][key], 4) for key in ("medianSlope", "steepSlope", "relief")},
    }


def comparison(earth: dict, target: dict) -> dict:
    return {
        "earth": measurement(earth),
        "target": measurement(target),
        "windowKm": WINDOW_M / 1000,
        "cellSizeM": CELL,
        "terrainSimilarity": round(terrain_similarity(earth["metrics"], target["metrics"]), 6),
    }


def write_atomic(path: Path, data: bytes) -> None:
    with NamedTemporaryFile(dir=path.parent, delete=False) as out:
        temp = Path(out.name)
        try:
            out.write(data)
            out.close()
            temp.replace(path)
        finally:
            temp.unlink(missing_ok=True)


def json_bytes(data: object) -> bytes:
    return (json.dumps(data, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("ulysses", type=Path, help="DTM HiRISE DTEED_008262_1855_042652_1855_A01.IMG")
    parser.add_argument("salda_dem", type=Path, help="Copernicus DEM GLO-30 N37E029")
    parser.add_argument("salda_cover", type=Path, help="ESA WorldCover 2021 v200 N36E027")
    args = parser.parse_args()

    catalog = json.loads(CATALOG_PATH.read_text())
    by_id = {site["id"]: site for site in catalog}
    sunset, jezero = by_id["sunset"], by_id["jezero"]

    ulysses_dem = sample_window(args.ulysses, ULYSSES_CENTER, MARS_DATUM, Resampling.average)
    ulysses = {
        "id": ULYSSES_ID,
        "name": "Ulysses Colles",
        "planet": "Mars",
        "category": "Volcanic terrain",
        "latitude": ULYSSES_CENTER[0],
        "longitude": ULYSSES_CENTER[1],
        "source": "HiRISE · NASA/JPL/UArizona",
        "sourceUrl": ULYSSES_SOURCE,
        "raster": ULYSSES_PRODUCT,
        "metrics": patch_metrics(ulysses_dem),
    }

    salda_dem = sample_window(args.salda_dem, SALDA_CENTER, EARTH_DATUM, Resampling.bilinear)
    classes = sample_window(args.salda_cover, SALDA_CENTER, EARTH_DATUM, Resampling.nearest)
    land = (classes > 0) & (classes != 80)
    cover = cover_fractions(classes, SALDA_CENTER[0])
    if cover is None:
        raise ValueError("Falta cobertura WorldCover en Salda")
    salda = {
        "latitude": SALDA_CENTER[0],
        "longitude": SALDA_CENTER[1],
        "metrics": patch_metrics(salda_dem, land),
        "cover": cover,
    }
    # La fórmula y los candidatos del visor se mantienen. Acotar el clima
    # a su máximo demuestra si Salda podría superar al mejor sin inventar ERA5.
    maximum = total_score(jezero, {**salda, "climateParts": dict(cold=1, dry=1, swing=1)})
    best = max(total_score(jezero, site) for site in eligible_earth(catalog, jezero))
    volcanic_scores = sorted(
        eligible_earth(catalog, ulysses), key=lambda site: -total_score(ulysses, site)
    )
    measures = {
        "lake-salda-jezero": {
            **comparison(salda, jezero),
            "earthLandFraction": round(float(land.mean()), 6),
            "maximumTotalScore": round(maximum, 6),
            "existingBestTotalScore": round(best, 6),
        },
        "sunset-ulysses": {
            **comparison(sunset, ulysses),
            "rankedScore": round(total_score(ulysses, sunset), 6),
            "rankedPosition": 1 + volcanic_scores.index(sunset),
            "existingBestTotalScore": round(total_score(ulysses, volcanic_scores[0]), 6),
            "earthCatalogId": sunset["id"],
            "targetCatalogId": ULYSSES_ID,
        },
    }

    catalog = [site for site in catalog if site["id"] != ULYSSES_ID]
    first_earth = next(i for i, site in enumerate(catalog) if site["planet"] == "Earth")
    catalog.insert(first_earth, ulysses)
    catalog_data, measures_data = json_bytes(catalog), json_bytes(measures)
    write_atomic(TERRAIN_DIR / f"{ULYSSES_ID}.f32", ulysses_dem.tobytes())
    write_atomic(CATALOG_PATH, catalog_data)
    write_atomic(MEASURES_PATH, measures_data)


if __name__ == "__main__":
    main()
