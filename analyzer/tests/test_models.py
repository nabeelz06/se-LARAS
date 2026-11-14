import json
import os
import unittest

import analyze
import verify_models

from .common import ROOT


class ModelProvenance(unittest.TestCase):
    def test_bundled_models_match_registry(self):
        bad = [(n, why) for n, ok, why in verify_models.verify() if not ok]
        self.assertEqual(bad, [], "model bawaan berbeda dari models/MODELS.json (diganti diam-diam?)")

    def test_registry_has_pinned_urls_and_licenses(self):
        for name, e in verify_models.load().items():
            self.assertTrue(e["url"].startswith("https://"), name)
            self.assertNotIn("/master/", e["url"], f"{name}: URL harus dipatok pada tag/rilis, bukan cabang yang bergerak")
            self.assertRegex(e["sha256"], r"^[0-9a-f]{64}$")
            self.assertIn(e["lisensi"], {"MIT", "Apache-2.0"})

    def test_displayed_engine_labels_do_not_drift_from_registry(self):
        # Pernah salah: label menulis "Silero VAD v5" padahal berkasnya rilis v6.2. Versi di label harus sama dengan registri.
        reg = verify_models.load()
        ver = reg["silero_vad.onnx"]["versi"].split()[0]
        self.assertIn(ver, analyze.engine_info()["suara"])

    def test_evaluation_was_run_on_the_registered_models(self):
        # Angka evaluasi hanya berlaku untuk berkas model yang dipakai saat mengukur. results.json mencatat hash-nya
        # (blok "lingkungan"); kalau model diganti tanpa mengulang evaluasi, tes ini gagal.
        with open(os.path.join(ROOT, "evaluation", "results.json"), encoding="utf-8") as f:
            res = json.load(f)
        self.assertIn("lingkungan", res, "results.json lama: ulangi `python3 -I evaluate.py all`")
        used = res["lingkungan"]["model_sha256"]
        reg = verify_models.load()
        self.assertEqual(set(used), set(reg))
        for name, e in reg.items():
            self.assertEqual(used[name], e["sha256"], f"{name}: evaluasi dijalankan pada berkas berbeda dari yang terdaftar")

    def test_calibration_matches_results_timestamp(self):
        # calibration.json dan results.json berasal dari satu proses evaluasi (satu cap waktu), bukan campuran dua proses.
        with open(os.path.join(ROOT, "evaluation", "results.json"), encoding="utf-8") as f:
            res = json.load(f)
        with open(os.path.join(ROOT, "evaluation", "calibration.json"), encoding="utf-8") as f:
            cal = json.load(f)
        self.assertEqual(res["dibuat"], cal["dibuat"])


if __name__ == "__main__":
    unittest.main()
