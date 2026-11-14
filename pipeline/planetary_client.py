"""Cliente mínimo para Microsoft Planetary Computer (catálogo STAC).

No necesita cuenta: las URLs de los datos se firman automáticamente con
`planetary_computer.sign_inplace`. Si algún día te limitan la velocidad,
puedes pedir una clave gratuita y ponerla en .env como PC_SDK_SUBSCRIPTION_KEY.

Conceptos:
- Colección: un dataset (p. ej. "sentinel-2-l2a", "landsat-c2-l2", "esa-worldcover").
- Item: una escena concreta (un lugar + una fecha).
- Asset: un archivo dentro del item (p. ej. la banda B04 = rojo).
Catálogo para explorar: https://planetarycomputer.microsoft.com/catalog
"""

from __future__ import annotations

import numpy as np
import planetary_computer
import pystac
import rasterio
from dotenv import load_dotenv
from pystac_client import Client
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"

load_dotenv()  # carga PC_SDK_SUBSCRIPTION_KEY si existe (opcional)

_catalog: Client | None = None


def catalog() -> Client:
    global _catalog
    if _catalog is None:
        _catalog = Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)
    return _catalog


def list_collections(text: str = "") -> list[tuple[str, str]]:
    """Lista (id, título) de colecciones; filtra por texto si se indica."""
    text = text.lower()
    return [
        (c.id, c.title or "")
        for c in catalog().get_collections()
        if text in c.id.lower() or text in (c.title or "").lower()
    ]


def search(collection: str, bbox: list[float], datetime: str,
           query: dict | None = None, max_items: int = 10,
           sortby: str | None = None) -> list[pystac.Item]:
    """Busca escenas.

    bbox: [lon_min, lat_min, lon_max, lat_max]
    datetime: "2026-09-01/2026-11-14" o "2026-10-01"
    query: filtros, p. ej. {"eo:cloud_cover": {"lt": 20}}
    sortby: p. ej. "-properties.datetime" (más reciente primero)
    """
    kwargs = dict(collections=[collection], bbox=bbox, datetime=datetime,
                  query=query, max_items=max_items)
    if sortby:
        kwargs["sortby"] = sortby
    return list(catalog().search(**kwargs).items())


def read_asset(item: pystac.Item, asset: str, bbox: list[float] | None = None,
               max_size: int | None = None) -> tuple[np.ndarray, dict]:
    """Lee un asset raster (Cloud-Optimized GeoTIFF) recortado a bbox (lon/lat).

    Solo descarga la parte necesaria del archivo, no la escena entera.
    max_size: reduce la resolución para que el lado mayor no pase de N píxeles.
    Devuelve (array 2D, metadatos).
    """
    href = item.assets[asset].href
    with rasterio.open(href) as src:
        window = None
        if bbox is not None:
            bounds = transform_bounds("EPSG:4326", src.crs, *bbox)
            window = from_bounds(*bounds, transform=src.transform).round_offsets().round_lengths()
        h = int(window.height) if window else src.height
        w = int(window.width) if window else src.width
        out_shape = None
        if max_size and max(h, w) > max_size:
            scale = max_size / max(h, w)
            out_shape = (max(1, int(h * scale)), max(1, int(w * scale)))
        data = src.read(1, window=window, out_shape=out_shape)
        meta = {"crs": str(src.crs), "nodata": src.nodata, "dtype": str(data.dtype),
                "window": window}
    return data, meta


if __name__ == "__main__":
    # Prueba: NDVI (vegetación) de la escena Sentinel-2 más reciente y con pocas nubes sobre Berlín.
    bbox = [13.35, 52.48, 13.45, 52.54]

    print("Colecciones con 'sentinel':")
    for cid, title in list_collections("sentinel"):
        print(f"  {cid:30s} {title}")

    items = search("sentinel-2-l2a", bbox, "2026-08-01/2026-11-14",
                   query={"eo:cloud_cover": {"lt": 20}}, max_items=5,
                   sortby="-properties.datetime")
    print(f"\n{len(items)} escenas encontradas:")
    for it in items:
        print(f"  {it.id}  {it.datetime:%Y-%m-%d}  nubes={it.properties['eo:cloud_cover']:.1f}%")

    if items:
        item = items[0]
        red, _ = read_asset(item, "B04", bbox)
        nir, meta = read_asset(item, "B08", bbox)
        red, nir = red.astype("float32"), nir.astype("float32")
        valid = (red + nir) > 0
        ndvi = np.where(valid, (nir - red) / np.where(valid, nir + red, 1), np.nan)
        print(f"\nEscena {item.id}: recorte {ndvi.shape[1]}x{ndvi.shape[0]} px, CRS {meta['crs']}")
        print(f"NDVI medio = {np.nanmean(ndvi):.3f}  (min {np.nanmin(ndvi):.2f}, max {np.nanmax(ndvi):.2f})")
