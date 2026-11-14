"""Angka di kode harus sama dengan bukti terukur. Jika ada yang menyimpang, tes ini gagal: jalankan ulang evaluate.py all."""
import json
import unittest

from tests.common import CALIB, RESULTS  # noqa: F401
import align
import vad


class Calibration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(RESULTS) as f:
            cls.res = json.load(f)
        with open(CALIB) as f:
            cls.cal = json.load(f)

    def test_vad_defaults_equal_tuned(self):
        self.assertEqual(vad.DEFAULTS, self.res["jeda"]["setelan_hasil_penalaan"])
        self.assertEqual(vad.DEFAULTS, self.cal["vad"])

    def test_alignment_threshold_equal_evaluated(self):
        self.assertEqual(align.COST_RELIABLE_MAX, self.res["dtw"]["ambang_biaya_dipilih_dari_latih"])
        self.assertEqual(align.COST_RELIABLE_MAX, self.cal["ambang_biaya_penyejajaran"])

    def test_results_not_quick_mode(self):
        self.assertFalse(self.res.get("quick"), "results.json berasal dari --quick; jalankan evaluate.py all")

    def test_claims_hold_on_heldout(self):
        j = self.res["jeda"]["uji"]
        tuned = j["silero_penalaan_ringkas"]
        old = j["energi_cara_lama_ringkas"]
        self.assertGreater(tuned["recall_rata2"], old["recall_rata2"] + 0.5)
        # jeda >= 0,5 dtk terdeteksi hampir selalu pada klip bersih
        clean = [r for r in j["silero_penalaan"] if r["derau"] == "tanpa"][0]
        self.assertEqual(clean["recall_per_panjang"]["0.5"], 1.0)
        d = self.res["dtw"]
        self.assertEqual(d["uji_dengan_ambang"]["isi_sama_dinilai_andal"], 1.0)
        self.assertEqual(d["uji_dengan_ambang"]["isi_beda_dinilai_tak_andal"], 1.0)

    def test_tempo_estimator_equals_evaluated(self):
        pt = self.res["dtw"]["penaksir_tempo"]
        self.assertEqual(round(align.TEMPO_EDGE_FRAC * 100), pt["tepi_dibuang_persen"])
        self.assertEqual(align.TEMPO_EDGE_MIN_S, pt["tepi_minimum_detik"])
        # lebar tepi di kode harus sama dengan yang terbaik pada himpunan LATIH (aturan pemilihan dicatat di results.json)
        self.assertEqual(align.TEMPO_EDGE_FRAC, pt["tepi_terbaik_pada_latih"])

    def test_tempo_error_claims_hold(self):
        d = self.res["dtw"]
        new = d["galat_rasio_pada_yang_dinilai_andal"]
        old = d["galat_rasio_durasi_lama_pada_yang_dinilai_andal"]
        for part in ("latih", "uji"):
            self.assertLess(new[part]["maks"], 5.0, f"galat rasio tempo maksimum ({part}) melewati batas yang boleh diklaim")
            self.assertLess(new[part]["maks"], old[part]["maks"], f"penaksir tempo baru tidak lebih baik dari rasio durasi lama ({part})")

    def test_floors_cover_all_metrics(self):
        for k in ("pause_mean_s", "long_pauses_per_min", "onset_rate_per_s", "speech_ratio", "dynamic_range_db", "pitch_range_st",
                  "wrist_speed_mean", "torso_lean_std_deg", "gesture_speech_lag_s"):
            self.assertIn(k, self.cal["lantai"])
            self.assertGreater(self.cal["lantai"][k], 0)


if __name__ == "__main__":
    unittest.main()
