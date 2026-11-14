"""Build offline regional elevation grids used by Path Planner.

Requires numpy, Pillow, and rasterio. The catalog supplies region centers and names.
Mapzen Terrarium elevation tiles: https://registry.opendata.aws/terrain-tiles/
Natural Earth land and lake masks: https://www.naturalearthdata.com/downloads/50m-physical-vectors/
"""
from concurrent.futures import ThreadPoolExecutor
from functools import lru_cache
from pathlib import Path
from urllib.request import urlopen
import argparse
import gzip
import io
import json
import math

import numpy as np
from PIL import Image
from rasterio.features import rasterize
from rasterio.transform import from_origin

ROOT = Path(__file__).resolve().parents[1]
TILES = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium'
VECTORS = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson'
RADIUS_M = 6_371_000
REGION_SEED_IDS = ('hanaupah', 'algodones', 'canyonlands', 'east-rift', 'great-sand', 'kennicott',
                   'meteor', 'south-fork', 'craters-moon', 'white-sands')
REGION_COUNT = 38
GRID_SPECS = ((256, 1000, 8), (160, 250, 10))  # width, spacing in meters, source zoom
NO_LAND = -32768


def download(url, cache, key):
    path = cache / key
    if path.exists():
        return path.read_bytes()
    for attempt in range(3):
        try:
            with urlopen(url, timeout=20) as response:
                data = response.read()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
            return data
        except OSError:
            if attempt == 2:
                raise


@lru_cache(maxsize=96)
def tile(z, y, x, cache):
    raw = download(f'{TILES}/{z}/{x}/{y}.png', cache, f'tiles/{z}/{x}/{y}.png')
    with Image.open(io.BytesIO(raw)) as image:
        rgb = np.asarray(image.convert('RGB'), dtype='float32')
    return rgb[:, :, 0] * 256 + rgb[:, :, 1] + rgb[:, :, 2] / 256 - 32768


def local_coordinates(lat0, lon0, size, spacing):
    axis = (np.arange(size) - (size - 1) / 2) * spacing
    east, north = np.meshgrid(axis, -axis)
    phi, lam = np.radians([lat0, lon0])
    rho = np.hypot(east, north)
    distance = rho / RADIUS_M
    lat = np.arcsin(np.cos(distance) * math.sin(phi) + north * np.sin(distance) * math.cos(phi) / rho)
    lon = lam + np.arctan2(east * np.sin(distance),
                           rho * math.cos(phi) * np.cos(distance) - north * math.sin(phi) * np.sin(distance))
    return np.degrees(lat), (np.degrees(lon) + 180) % 360 - 180


def terrarium(lat, lon, zoom, cache):
    side = 256 << zoom
    x = ((lon + 180) / 360 * side - 0.5) % side
    mercator = np.arcsinh(np.tan(np.radians(lat)))
    y = np.clip((1 - mercator / np.pi) * 0.5 * side - 0.5, 0, side - 1)
    col, row = np.floor(x).astype('int32'), np.floor(y).astype('int32')
    fx, fy = x - col, y - row
    result = np.zeros(lat.shape, dtype='float64')
    for drow, dcol, weight in ((0, 0, (1 - fx)*(1 - fy)), (0, 1, fx*(1 - fy)),
                                (1, 0, (1 - fx)*fy), (1, 1, fx*fy)):
        ix, iy = (col + dcol) % side, np.minimum(side - 1, row + drow)
        tx, ty = ix // 256, iy // 256
        for tile_x, tile_y in np.unique(np.column_stack((tx.ravel(), ty.ravel())), axis=0):
            mask = (tx == tile_x) & (ty == tile_y)
            values = tile(zoom, int(tile_y), int(tile_x), cache)
            result[mask] += values[iy[mask] % 256, ix[mask] % 256] * weight[mask]
    return np.rint(result).astype('<i2')


def raster_mask(cache):
    # The polygons are rasterized at 0.01° once to avoid repeatedly clipping coastlines.
    combined = []
    for name, value in [('ne_50m_land', 1), ('ne_50m_lakes', 0)]:
        data = json.loads(download(f'{VECTORS}/{name}.geojson', cache, f'{name}.geojson'))
        combined.extend((item['geometry'], value) for item in data['features'])
    return rasterize(combined, out_shape=(18000, 36000), dtype='uint8', transform=from_origin(-180, 90, .01, .01))


def region_sites(sites):
    def unit(site):
        lat, lon = np.radians([site['latitude'], site['longitude']])
        return np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])

    earth = [s for s in sites if s['planet'] == 'Earth' and abs(s['latitude']) <= 82]
    selected = [s for key in REGION_SEED_IDS for s in earth if s['id'] == key]
    eligible = [s for s in earth if s.get('origin') == 'global']
    vectors = np.array([unit(s) for s in eligible])
    while eligible and len(selected) < REGION_COUNT:
        selected.append(eligible.pop(int(np.argmin(np.max(vectors @ np.array([unit(s) for s in selected]).T, axis=1)))))
        vectors = np.array([unit(s) for s in eligible])
    return selected


def export(site, land, cache):
    result = bytearray()
    for size, spacing, zoom in GRID_SPECS:
        lat, lon = local_coordinates(site['latitude'], site['longitude'], size, spacing)
        values = terrarium(lat, lon, zoom, cache)
        row = np.floor((90 - lat) * 100).astype('int32')
        col = np.floor((180 + lon) * 100).astype('int32')
        values[land[row, col] == 0] = NO_LAND
        values[:, 1:] -= values[:, :-1].copy()
        result.extend(values.tobytes())
    print(site['id'], flush=True)
    return gzip.compress(result, compresslevel=7, mtime=0)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('cache', type=Path, help='Folder for cached source tiles')
    parser.add_argument('--workers', type=int, default=8)
    args = parser.parse_args()
    sites = region_sites(json.loads((ROOT / 'src/data/catalog.json').read_text()))
    land = raster_mask(args.cache)
    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        # Generate each gzip stream before publishing the index of available regions.
        for site, data in zip(sites, pool.map(lambda site: export(site, land, args.cache), sites)):
            (ROOT / 'public/terrain' / f"path-earth-{site['id']}.i16.gz").write_bytes(data)
    (ROOT / 'src/data/path-earth.json').write_text(json.dumps([s['id'] for s in sites], indent=2) + '\n')


if __name__ == '__main__':
    main()
