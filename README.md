# Terrain Analogs

A local viewer for exploring 116 Mars terrain patches and comparing them with 32 Earth candidates.

```sh
npm ci
npm run dev
```

Run `npm run build` to type-check and produce a static build in `dist/`.

Click a pin or choose a site from the Mars picker. The Earth globe turns to the top-ranked candidate and the viewer loads both 3D terrain patches. Drag either terrain to rotate the shared camera. Scroll to zoom, or focus the canvas and use the arrow keys and plus/minus. Both meshes use the same horizontal and vertical scales. **Slope** uses shared angle bands. **Relief** shows height relative to each patch’s median.

## Data and ranking

Mars terrain comes from the [USGS HiRISE DTM catalog](https://stac.astrogeology.usgs.gov/docs/data/mars/hirise_dtms/) and the [USGS HiRISE Jezero mosaic](https://www.usgs.gov/data/mars-2020-terrain-relative-navigation-hirise-dtm-mosaic). The US-based Earth patches come from the [USGS 3DEP elevation service](https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer). Each patch covers 2 × 2 km with 100 × 100 cells at 20 m spacing. The first row faces north.

Mars terrain categories follow the HiRISE observation descriptions. Earth candidates were selected and assigned to terrain categories by hand. Within the matching category, the distance averages the normalized differences in median slope, 90th-percentile slope, and elevation span between the 5th and 95th percentiles. For each metric, normalization divides the absolute difference by the sum of both values. The viewer compares local topography. The score gives no estimate of geological equivalence or mission suitability.

Globe imagery comes from the [Viking MDIM 2.1 Mars mosaic](https://commons.wikimedia.org/wiki/File:Mars_Viking_MDIM21_ClrMosaic_1km.jpg) and [NASA Blue Marble, July 2004](https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/).

## Adding terrain

The viewer loads site metadata from `src/data/catalog.json` and fetches elevation grids on demand from `public/terrain/<id>.f32`. The catalog records the source dataset and raster URL where available.

To export prepared crops with NumPy installed, run `python3 scripts/export-catalog.py <crop-directory>`. The input directory has `mars-crops/` and `earth-crops/` subdirectories. Each crop is a 100 × 100 NumPy array paired with a same-stem JSON file containing its site metadata. The exporter includes the four original patches from `src/data/terrain.json`, computes metrics, assigns Earth groups from the site ID lists in the script, and writes the catalog and little-endian elevation grids.
