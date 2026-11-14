"""Export 100 × 100 grids and their comparison metrics for the browser catalog."""
import argparse
import json
from pathlib import Path

import numpy as np

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("crop_directory", type=Path)
args = parser.parse_args()
base = args.crop_directory
project = Path(__file__).resolve().parents[1]
data_dir = project / "public/terrain"
data_dir.mkdir(parents=True, exist_ok=True)

legacy = json.loads((project / "src/data/terrain.json").read_text())
sites = []
for site in legacy["sites"]:
    elevation = np.array(site.pop("elevation")).reshape(100, 100)
    site["category"] = "Valleys & fans" if site["planet"] == "Mars" else "Earth"
    sites.append((site, elevation))
for directory in ("mars-crops", "earth-crops"):
    for metadata in sorted((base / directory).glob("*.json")):
        site = json.loads(metadata.read_text())
        sites.append((site, np.load(metadata.with_suffix(".npy"), allow_pickle=False)))

earth_groups = {
    "Dunes": "mesquite eureka kelso dumont algodones great-sand white-sands coral-pink",
    "Impact terrain": "meteor upheaval",
    "Valleys & fans": "hanaupah trail death-valley-canyon goosenecks canyonlands furnace grapevine green",
    "Volcanic terrain": "amboy ubelhebe sunset sp pisgah carrizozo craters-moon kanaio east-rift",
    "Ice & polar terrain": "mendenhall ruth kennicott",
    "Ridges & layered terrain": "south-fork bentonite painted canyonlands goosenecks",
}
for site, _ in sites:
    if site["planet"] == "Earth":
        site["category"] = "Earth"
        site["groups"] = [group for group, ids in earth_groups.items() if site["id"] in ids.split()]

catalog = []
for site, source in sites:
    grid = np.asarray(source, dtype="<f4")
    if grid.shape != (100, 100) or not np.isfinite(grid).all():
        raise ValueError(f"{site['id']}: invalid elevation grid")
    y, x = np.gradient(grid.astype("float64"), 20)
    slope = np.rad2deg(np.arctan(np.hypot(x, y)))[1:-1, 1:-1]
    median_slope, steep_slope = np.percentile(slope, [50, 90])
    low, median_elevation, high = np.percentile(grid.astype("float64"), [5, 50, 95])
    site["metrics"] = dict(medianSlope=median_slope, steepSlope=steep_slope,
                           medianElevation=median_elevation, relief=high-low)
    grid.tofile(data_dir / f"{site['id']}.f32")
    catalog.append(site)

assert len({site["id"] for site in catalog}) == len(catalog)
(project / "src/data/catalog.json").write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + "\n")
print({planet: sum(site["planet"] == planet for site in catalog) for planet in ("Mars", "Earth")})
