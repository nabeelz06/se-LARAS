import unittest

import numpy as np

from tests.common import have, DATA  # noqa: F401
import vad


class Segmentation(unittest.TestCase):
    def probs(self, spec):
        # spec: [(durasi_detik, peluang)]
        return np.concatenate([np.full(int(round(d / vad.FRAME_S)), p, dtype=np.float32) for d, p in spec])

    def test_basic_segment(self):
        p = self.probs([(1.0, 0.0), (2.0, 0.95), (1.0, 0.0)])
        segs = vad.segments(p, total_s=len(p) * vad.FRAME_S, threshold=0.5, neg_margin=0.15, min_speech_ms=250, min_silence_ms=100, pad_ms=0)
        self.assertEqual(len(segs), 1)
        self.assertAlmostEqual(segs[0][0], 1.0, delta=0.07)
        self.assertAlmostEqual(segs[0][1], 3.0, delta=0.07)

    def test_hysteresis_keeps_dip_above_exit_threshold(self):
        # turun ke 0.6 (di atas 0.8-0.15=0.65? tidak) -> pakai 0.7 di atas keluar 0.65: satu segmen
        p = self.probs([(0.5, 0.0), (1.0, 0.95), (0.4, 0.7), (1.0, 0.95), (0.5, 0.0)])
        segs = vad.segments(p, total_s=len(p) * vad.FRAME_S, threshold=0.8, neg_margin=0.15, min_speech_ms=250, min_silence_ms=100, pad_ms=0)
        self.assertEqual(len(segs), 1)

    def test_short_blip_dropped(self):
        p = self.probs([(1.0, 0.0), (0.1, 0.95), (1.0, 0.0)])
        self.assertEqual(vad.segments(p, total_s=len(p) * vad.FRAME_S, **{**vad.DEFAULTS, "min_speech_ms": 250}), [])

    def test_gap_shorter_than_min_silence_is_merged(self):
        p = self.probs([(0.3, 0.0), (1.0, 0.95), (0.06, 0.0), (1.0, 0.95), (0.3, 0.0)])
        segs = vad.segments(p, total_s=len(p) * vad.FRAME_S, threshold=0.5, neg_margin=0.15, min_speech_ms=250, min_silence_ms=100, pad_ms=0)
        self.assertEqual(len(segs), 1)

    def test_long_gap_splits(self):
        p = self.probs([(0.3, 0.0), (1.0, 0.95), (0.5, 0.0), (1.0, 0.95), (0.3, 0.0)])
        segs = vad.segments(p, total_s=len(p) * vad.FRAME_S, **vad.DEFAULTS)
        self.assertEqual(len(segs), 2)
        self.assertGreater(segs[1][0] - segs[0][1], 0.4)

    def test_segments_are_within_clip_and_ordered(self):
        p = self.probs([(0.0, 0.0), (2.0, 0.99), (0.4, 0.0), (1.0, 0.99), (0.02, 0.0)])
        total = len(p) * vad.FRAME_S
        segs = vad.segments(p, total_s=total, **vad.DEFAULTS)
        for s, e in segs:
            self.assertGreaterEqual(s, 0.0)
            self.assertLessEqual(e, total + 1e-6)
            self.assertLess(s, e)
        self.assertEqual(segs, sorted(segs))


class Level(unittest.TestCase):
    def test_normalize_target_and_cap(self):
        rng = np.random.default_rng(0)
        y = (rng.standard_normal(16000 * 3) * 0.01).astype(np.float32)
        z = vad.level_normalize(y)
        self.assertAlmostEqual(float(np.percentile(np.abs(z), 99.5)), 0.5, delta=0.02)
        quiet = (y * 1e-4).astype(np.float32)  # perlu > 40 dB: penguatan dibatasi
        zq = vad.level_normalize(quiet)
        gain = float(np.std(zq) / np.std(quiet))
        self.assertAlmostEqual(20 * np.log10(gain), 40.0, delta=0.5)

    def test_normalize_empty(self):
        self.assertEqual(len(vad.level_normalize(np.zeros(0, dtype=np.float32))), 0)

    def test_loud_signal_is_attenuated_not_clipped(self):
        y = np.clip(np.random.default_rng(1).standard_normal(16000) * 2.0, -1, 1).astype(np.float32)
        z = vad.level_normalize(y)
        self.assertLessEqual(float(np.percentile(np.abs(z), 99.5)), 0.52)
        self.assertLessEqual(float(np.max(np.abs(z))), 1.0)


@unittest.skipUnless(have("jfk.wav"), "data evaluasi belum diunduh (python3 evaluation/fetch_data.py)")
class Model(unittest.TestCase):
    def test_speech_vs_noise(self):
        import audiocore
        y = audiocore.load_audio(f"{DATA}/jfk.wav", 20)[0]
        v = audiocore.get_vad()
        segs = vad.segments(v.probs(y), len(y) / 16000, **vad.DEFAULTS)
        self.assertGreaterEqual(len(segs), 2)
        noise = np.random.default_rng(2).standard_normal(16000 * 5).astype(np.float32) * 0.1
        self.assertEqual(vad.segments(v.probs(noise), 5.0, **vad.DEFAULTS), [])

    def test_gain_invariance(self):
        import audiocore
        y = audiocore.load_audio(f"{DATA}/jfk.wav", 20)[0]
        v = audiocore.get_vad()
        a = vad.segments(v.probs(y), len(y) / 16000, **vad.DEFAULTS)
        b = vad.segments(v.probs((y * 0.01).astype(np.float32)), len(y) / 16000, **vad.DEFAULTS)
        self.assertEqual(len(a), len(b))
        for (s1, e1), (s2, e2) in zip(a, b):
            self.assertAlmostEqual(s1, s2, delta=0.1)
            self.assertAlmostEqual(e1, e2, delta=0.1)


if __name__ == "__main__":
    unittest.main()
