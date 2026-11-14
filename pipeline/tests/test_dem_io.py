import io
import unittest
from types import SimpleNamespace
from unittest.mock import MagicMock, patch

import numpy as np
from rasterio.errors import RasterioIOError
from rasterio.transform import from_origin
from rasterio.windows import Window

from analogs import dem_io


def fake_response(status, content_range, body):
    response = MagicMock()
    response.status_code = status
    response.headers = {"Content-Range": content_range}
    response.iter_content.side_effect = lambda size: iter(lambda: body.read(size), b"")
    response.__enter__.return_value = response
    return response


class MarsRangeTests(unittest.TestCase):
    def test_does_not_read_full_response_when_range_is_ignored(self):
        body = MagicMock()
        response = fake_response(200, "", body)
        session = SimpleNamespace(get=MagicMock(return_value=response))
        with patch.object(dem_io._tls, "s", session, create=True):
            with self.assertRaisesRegex(OSError, "HTTP 200"):
                dem_io._http_range("https://example.test/dem.tif", 10, 13, tries=1)
        body.read.assert_not_called()
        self.assertTrue(session.get.call_args.kwargs["stream"])

    def test_checks_returned_range_and_payload_length(self):
        cases = [
            ("bytes 11-14/100", b"abcd", None),
            ("bytes 10-13/100", b"abc", None),
            ("bytes 10-13/100", b"abcde", None),
            ("bytes 10-13/100", b"abcd", b"abcd"),
        ]
        for content_range, data, expected in cases:
            with self.subTest(content_range=content_range, data=data):
                response = fake_response(206, content_range, io.BytesIO(data))
                session = SimpleNamespace(get=MagicMock(return_value=response))
                with patch.object(dem_io._tls, "s", session, create=True):
                    if expected is None:
                        with self.assertRaises(OSError):
                            dem_io._http_range("https://example.test/dem.tif", 10, 13, tries=1)
                    else:
                        self.assertEqual(dem_io._http_range("https://example.test/dem.tif", 10, 13, tries=1), expected)


class CogReadTests(unittest.TestCase):
    def test_recomputes_window_and_shape_on_retry(self):
        src = MagicMock()
        src.__enter__.return_value = src
        src.read.side_effect = [RasterioIOError("interrupted"), np.zeros((2, 3))]
        src.window_transform.return_value = from_origin(0, 0, 1, 1)
        windows = [Window(0, 0, 12, 8), Window(2, 1, 6, 4)]
        window = MagicMock(side_effect=windows)
        shape = MagicMock(side_effect=[(4, 6), (2, 3)])

        with (
            patch.object(dem_io.planetary_computer, "sign", side_effect=lambda href: href),
            patch.object(dem_io.rasterio, "open", return_value=src),
            patch.object(dem_io.time, "sleep"),
        ):
            arr, transform, _, _ = dem_io._read_cog("dem.tif", window=window, out_shape=shape)

        self.assertEqual(window.call_count, 2)
        self.assertEqual(shape.call_count, 2)
        self.assertEqual(src.read.call_args.kwargs["window"], windows[-1])
        self.assertEqual(arr.shape, (2, 3))
        self.assertEqual((transform.a, transform.e), (2, -2))


if __name__ == "__main__":
    unittest.main()
