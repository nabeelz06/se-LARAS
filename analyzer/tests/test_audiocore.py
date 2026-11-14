import json
import os
import subprocess
import sys
import tempfile
import unittest

import numpy as np

from tests.common import have, DATA, ROOT
import audiocore

SR = 16000


class Pauses(unittest.TestCase):
    def test_pauses_from_gaps(self):
        segs = [[0.0, 1.0], [1.1, 2.0], [2.5, 3.0], [4.0, 5.0]]
        p = audiocore.pauses_from(segs)
        self.assertEqual([round(d, 2) for _, d in p], [0.5, 1.0])  # celah 0,1 di bawah ambang 0,25
        self.assertEqual(round(p[0][0], 2), 2.0)

    def test_no_pause_for_single_segment(self):
        self.assertEqual(audiocore.pauses_from([[0.5, 3.0]]), [])


class Snr(unittest.TestCase):
    def sig(self, snr_db, n=6):
        rng = np.random.default_rng(3)
        t = np.arange(SR * n) / SR
        sp = 0.3 * np.sin(2 * np.pi * 220 * t)  # "ujaran" stasioner
        segs = [[0.0, 2.0], [4.0, 6.0]]
        mask = np.zeros(len(t), bool)
        for s, e in segs:
            mask[int(s * SR): int(e * SR)] = True
        y = np.where(mask, sp, 0.0)
        noise_rms = np.sqrt(np.mean(sp[mask] ** 2)) / (10 ** (snr_db / 20))
        return (y + rng.standard_normal(len(t)) * noise_rms).astype(np.float32), segs

    def test_estimate_close_to_nominal(self):
        for snr in (5, 15, 30):
            y, segs = self.sig(snr)
            est = audiocore.snr_estimate(y, segs)
            self.assertAlmostEqual(est, snr, delta=2.0)

    def test_none_without_background(self):
        y, _ = self.sig(20, n=4)
        self.assertIsNone(audiocore.snr_estimate(y, [[0.0, 3.9]]))


@unittest.skipUnless(have("jfk.wav"), "data evaluasi belum diunduh")
class Metrics(unittest.TestCase):
    def test_metrics_on_real_speech(self):
        m, w, segs, y = audiocore.audio_metrics(f"{DATA}/jfk.wav", 150)
        self.assertIsNotNone(m)
        self.assertEqual(m["engine"], "silero-vad")
        self.assertGreater(m["speech_ratio"], 0.5)
        self.assertLess(m["speech_ratio"], 1.0)
        self.assertGreaterEqual(m["pause_count"], 1)
        self.assertEqual(len(m["pauses"]), m["pause_count"])
        self.assertAlmostEqual(m["span_s"], segs[-1][1] - segs[0][0], delta=0.01)
        self.assertTrue(all(isinstance(x, float) for x in (m["pause_mean_s"], m["speech_ratio"])))

    def test_silence_and_short_inputs(self):
        import soundfile as sf
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "z.wav")
            sf.write(p, np.zeros(SR * 3, dtype=np.float32), SR)
            m, w, _, _ = audiocore.audio_metrics(p, 150)
            self.assertIsNone(m)
            self.assertIn("audio_senyap", w)
            p2 = os.path.join(td, "s.wav")
            sf.write(p2, (np.random.default_rng(1).standard_normal(SR // 2) * 0.1).astype(np.float32), SR)
            m2, w2, _, _ = audiocore.audio_metrics(p2, 150)
            self.assertIsNone(m2)
            self.assertIn("audio_terlalu_pendek", w2)

    def test_noise_only_gives_no_speech(self):
        import soundfile as sf
        with tempfile.TemporaryDirectory() as td:
            p = os.path.join(td, "n.wav")
            sf.write(p, (np.random.default_rng(1).standard_normal(SR * 6) * 0.05).astype(np.float32), SR)
            m, w, _, _ = audiocore.audio_metrics(p, 150)
            self.assertIsNone(m)
            self.assertIn("tidak_ada_ujaran_terdeteksi", w)


@unittest.skipUnless(have("jfk.wav"), "data evaluasi belum diunduh")
class Cli(unittest.TestCase):
    def test_cli_contract(self):
        r = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "analyze.py"), f"{DATA}/jfk.wav", "audio"], capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0, r.stderr[-400:])
        j = json.loads(r.stdout)
        self.assertEqual(j["version"], 2)
        for k in ("engine", "audio", "pose", "persons", "moments", "alignment", "warnings", "timings"):
            self.assertIn(k, j)
        self.assertIsNone(j["pose"])
        self.assertIsInstance(j["warnings"], list)
        self.assertIn("speech_segments", j["audio"])

    def test_cli_alignment_against_itself(self):
        r = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "analyze.py"), f"{DATA}/jfk.wav", "audio", "--ref", f"{DATA}/jfk.wav"],
                           capture_output=True, text=True, timeout=120)
        self.assertEqual(r.returncode, 0, r.stderr[-400:])
        a = json.loads(r.stdout)["alignment"]
        self.assertIsNotNone(a)
        self.assertTrue(a["reliable"])
        self.assertAlmostEqual(a["tempo_ratio"], 1.0, delta=0.01)
        self.assertLess(a["cost"], 0.05)

    def test_cli_rejects_missing_file(self):
        r = subprocess.run([sys.executable, "-I", os.path.join(ROOT, "analyze.py"), "/tmp/tidak-ada.wav", "audio"], capture_output=True, text=True, timeout=60)
        j = json.loads(r.stdout)
        self.assertIn("tanpa_audio", j["warnings"])


if __name__ == "__main__":
    unittest.main()
