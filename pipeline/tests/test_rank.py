import json
import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
from types import SimpleNamespace

import numpy as np

from analogs import rank


class FineSelectionTests(unittest.TestCase):
    def test_l1_uses_current_selection_and_control_label(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "l1").mkdir()
            for key in ("N23E010", "N23E011"):
                (root / "l1" / f"{key}.json").write_text(json.dumps([{"tile": key, "control": False}]))
            selection = root / "tiles.json"
            selection.write_text(json.dumps({"tiles": [{"key": "N23E010", "control": True}]}))

            self.assertEqual(rank.load_fine(root, 1, selection), [{"tile": "N23E010", "control": True}])

    def test_l2_reuses_a_previous_block_only_if_its_metadata_matches(self):
        with TemporaryDirectory() as tmp:
            root = Path(tmp)
            folder = root / "l2"
            folder.mkdir()
            block = {"id": "block_23.50000_10.50000_moon_0", "lat": 23.5, "lon": 10.5,
                     "body": "moon", "control": False}
            selection = root / "blocks.json"
            selection.write_text(json.dumps({"blocks": [block]}))
            older_id = "cand_n023.500_e0010.500"
            older = folder / f"{older_id}.json"
            cached = {**{k: v for k, v in block.items() if k != "id"}, "block": older_id}
            older.write_text(json.dumps({**cached, "body": "mars"}))
            self.assertEqual(rank.load_fine(root, 2, selection), [])
            older.write_text(json.dumps(cached))
            self.assertEqual(rank.load_fine(root, 2, selection), [{**cached, "block": block["id"]}])


class LunarTwinTests(unittest.TestCase):
    def test_nonpolar_reference_does_not_change_global_lunar_scores(self):
        def features(value):
            return dict.fromkeys(rank.FEATURES, value)

        def reference(ref_id, body, value, *, twin_only=False):
            return {"id": ref_id, "body": body, "level": "L0", "kind": "sitio", "usable": True,
                    "twin_only": twin_only, "features": features(value)}

        vectors = np.array([rank.vec(features(value), rank.FEATURES) for value in (1, 2, 3)])
        pct = rank.Percentiles(vectors)
        earth = SimpleNamespace(pct=pct, Q=pct(vectors), surf=np.ones(3), lat=np.array([0, 10, 20]), lon=np.zeros(3))
        refs = [reference("south_pole", "moon", 1), reference("mars_site", "mars", 2)]
        original = rank.run_l0(refs, earth)["moon"]
        expanded = rank.run_l0([*refs, reference("apollo", "moon", 3, twin_only=True)], earth)["moon"]

        np.testing.assert_array_equal(original["t"], expanded["t"])
        self.assertEqual(expanded["twin_idx"]["apollo"][0], 2)
