"""Package Mars elevation grids for the browser route planner.

Source: MGS-M-MOLA-5-MEGDR-L3-V1.0, MEGT90N000EB.IMG (median topography).
https://pds-geosciences.wustl.edu/mgs/mgs-m-mola-5-megdr-l3-v1/mgsl_300x/meg016/megt90n000eb.img

Provide the matching PDS image as a local input. The output is a 2880 × 1440
grid at 8 pixels/degree. Its northwest corner is 90°N, 0°E. Coordinates
refer to cell centers and rows are ordered north to south.

Optional Jezero source: USGS Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif.
https://planetarymaps.usgs.gov/mosaic/Mars/HRSC_MOLA_Blend/Mars_HRSC_MOLA_BlendDEM_Global_200mp_v2.tif
Save bytes 4471973036–4586135615 (inclusive) of the GeoTIFF and provide
them as --jezero-strips. The crop retains the original pixel centers.
"""
import argparse
import gzip
import hashlib
from pathlib import Path

import numpy as np

SOURCE_SHA256 = "d18d9b9ab8c5516d02e157dd2cde0f1d0d160c21940e953ba22391269a545e7b"
JEZERO_SOURCE_SHA256 = "874f20bf825df003ed08d4763c82b45a01298e108c1fd74e3bea258f4b9a2c6f"
OUTPUT = Path(__file__).resolve().parents[1] / "public/terrain"
USGS_WIDTH = 106694
JEZERO_ROWS = 535
JEZERO_COLUMNS = slice(76019, 76583)


def save_grid(filename: str, elevation: np.ndarray):
    # Store the first elevation in each row, then differences from the previous column.
    deltas = elevation.astype("<i2", copy=True)
    np.subtract(elevation[:, 1:], elevation[:, :-1], out=deltas[:, 1:])
    (OUTPUT / filename).write_bytes(gzip.compress(deltas.tobytes(), compresslevel=9, mtime=0))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("image", type=Path, help="NASA PDS MEGT90N000EB.IMG")
    parser.add_argument("--jezero-strips", type=Path, help="USGS HRSC/MOLA source TIFF bytes 4471973036–4586135615")
    args = parser.parse_args()

    source = args.image.read_bytes()
    if hashlib.sha256(source).hexdigest() != SOURCE_SHA256:
        parser.error("expected the unmodified NASA PDS MEGT90N000EB.IMG product")

    topography = np.frombuffer(source, dtype=">i2").reshape(1440, 2, 2880, 2)
    block_sums = topography.sum(axis=(1, 3), dtype=np.int32)
    elevation = np.rint(block_sums / 4).astype("<i2")
    save_grid("path-mars-mola-8ppd.i16.gz", elevation)

    if args.jezero_strips:
        with args.jezero_strips.open("rb") as file:
            if hashlib.file_digest(file, "sha256").hexdigest() != JEZERO_SOURCE_SHA256:
                parser.error("expected bytes 4471973036–4586135615 of the unmodified USGS GeoTIFF")
        source_rows = np.memmap(args.jezero_strips, dtype="<i2", mode="r", shape=(JEZERO_ROWS, USGS_WIDTH))
        jezero = source_rows[:, JEZERO_COLUMNS]
        if np.any(jezero == -32768):
            parser.error("unexpected missing elevation in the Jezero grid")
        save_grid("path-mars-jezero.i16.gz", jezero)


if __name__ == "__main__":
    main()
