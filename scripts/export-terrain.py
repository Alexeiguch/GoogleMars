"""Export the two 20 m elevation crops prepared from the source rasters."""
import argparse
import json
from pathlib import Path

import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("crop_directory", type=Path, help="Directory with all four prepared .npy elevation grids")
args = parser.parse_args()
output = Path(__file__).resolve().parents[1] / "src/data/terrain.json"

sites = {
    "jezero": {
        "planet": "Mars",
        "name": "Western Jezero",
        "latitude": 18.47,
        "longitude": 77.36,
        "source": "HiRISE · NASA/JPL/USGS",
        "sourceUrl": "https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic",
    },
    "hanaupah": {
        "planet": "Earth",
        "name": "Hanaupah Canyon fan",
        "latitude": 36.223,
        "longitude": -116.91,
    },
    "trail": {
        "planet": "Earth",
        "name": "Trail Canyon fan",
        "latitude": 36.30920,
        "longitude": -116.96927,
    },
    "death-valley-canyon": {
        "planet": "Earth",
        "name": "Death Valley Canyon fan",
        "latitude": 36.25,
        "longitude": -116.916667,
    },
}

for key, site in sites.items():
    site["id"] = key
    if site["planet"] == "Earth":
        site["source"] = "3DEP · USGS"
        site["sourceUrl"] = "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer"
    elevation = np.load(args.crop_directory / f"{key}.npy", allow_pickle=False)
    if elevation.shape != (100, 100) or not np.isfinite(elevation).all():
        raise ValueError(f"{key}: expected a complete 100 × 100 elevation grid")
    site["elevation"] = elevation.round(3).ravel().tolist()

output.write_text(json.dumps({"gridSize": 100, "cellSize": 20, "sites": list(sites.values())},
                             separators=(",", ":")) + "\n")
