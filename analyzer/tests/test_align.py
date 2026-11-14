import unittest

import numpy as np

from tests.common import have, DATA
import align
import audiocore

SR = 16000


def synth(seconds=8.0, seed=0, scale=1.0):
    """Sinyal 'bersuku' sintetis: potongan nada berganti-ganti dengan celah hening; cukup untuk menguji penyejajaran struktural.
    `scale` memanjangkan semua durasi tanpa mengubah urutan nada (isi sama, tempo berbeda)."""
    rng = np.random.default_rng(seed)
    out, segs, t, u = [], [], 0.0, 0.0   # u = waktu tanpa skala; menentukan jumlah segmen supaya isi tetap sama
    while u < seconds:
        d = float(rng.uniform(0.4, 0.8))
        f = float(rng.uniform(150, 500))
        x = np.arange(int(d * scale * SR)) / SR
        out.append((0.3 * np.sin(2 * np.pi * f * x) * np.hanning(len(x))).astype(np.float32))
        segs.append([t, t + d * scale])
        t += d * scale
        u += d
        g = float(rng.uniform(0.15, 0.3))
        out.append(np.zeros(int(g * scale * SR), dtype=np.float32))
        t += g * scale
        u += g
    return np.concatenate(out), segs


class AlignUnit(unittest.TestCase):
    def test_rejects_short_spans(self):
        y, segs = synth(3.0)
        self.assertEqual(align.align(y, [[0.0, 2.0]], y, [[0.0, 2.0]])[1], "klip_terlalu_pendek_untuk_sejajar")

    def test_rejects_missing_speech(self):
        y, segs = synth()
        self.assertEqual(align.align(y, [], y, segs)[1], "tanpa_ujaran_untuk_sejajar")

    def test_self_alignment(self):
        y, segs = synth(9.0)
        out, w = align.align(y, segs, y, segs)
        self.assertIsNone(w)
        self.assertAlmostEqual(out["tempo_ratio"], 1.0, places=3)
        self.assertLess(out["cost"], 0.01)
        self.assertTrue(out["reliable"])
        path = np.array(out["path"])
        self.assertLess(float(np.max(np.abs(path[:, 0] - path[:, 1]))), 0.1)

    def test_path_is_monotonic_and_bounded(self):
        y, segs = synth(9.0)
        out, _ = align.align(y, segs, y, segs)
        path = np.array(out["path"])
        self.assertTrue(np.all(np.diff(path[:, 0]) >= 0) and np.all(np.diff(path[:, 1]) >= 0))
        self.assertLessEqual(len(path), 120)

    def test_tempo_ratio_follows_stretch(self):
        y, segs = synth(9.0, seed=3)
        for s_ in (0.8, 1.25, 1.5):
            ya, sa = synth(9.0, seed=3, scale=s_)
            out, w = align.align(y, segs, ya, sa)
            self.assertIsNone(w)
            self.assertAlmostEqual(out["tempo_ratio"], s_, delta=0.03 * s_, msg=f"peregangan {s_}: {out['tempo_ratio']}")

    def test_tempo_ratio_ignores_stray_edge_segments(self):
        """Regresi: segmen liar di tepi klip (batuk, napas, ujung terpotong yang ikut terdeteksi VAD) menggeser rasio durasi
        awal-akhir sampai ~17% pada evaluasi sambil tetap berbiaya rendah. Rasio tempo dari jalur bagian dalam tak boleh ikut."""
        y, segs = synth(9.0, seed=3)
        s_ = 1.25
        ya, sa = synth(9.0, seed=3, scale=s_)
        rng = np.random.default_rng(9)
        burst = (0.2 * rng.standard_normal(int(0.35 * SR))).astype(np.float32)
        gap = np.zeros(int(0.8 * SR), dtype=np.float32)
        y2 = np.concatenate([burst, gap, ya, gap, burst])
        off = 0.35 + 0.8
        end = off + len(ya) / SR + 0.8
        sa2 = [[0.0, 0.35]] + [[a + off, b + off] for a, b in sa] + [[end, end + 0.35]]
        out, w = align.align(y, segs, y2, sa2)
        self.assertIsNone(w)
        span_err = abs(out["span_ratio"] - s_) / s_
        path_err = abs(out["tempo_ratio"] - s_) / s_
        self.assertGreater(span_err, 0.08, "uji tak bermakna: rasio durasi seharusnya terseret segmen liar")
        self.assertLess(path_err, 0.03, f"tempo {out['tempo_ratio']} vs {s_}; durasi {out['span_ratio']}")

    def test_interior_slope_needs_enough_path(self):
        t = np.linspace(0.0, 1.5, 50)
        self.assertIsNone(align.interior_slope(t, 1.2 * t))
        t = np.linspace(0.0, 6.0, 200)
        self.assertAlmostEqual(align.interior_slope(t, 1.2 * t + 0.4), 1.2, places=6)

    def test_threshold_ordering(self):
        self.assertGreater(align.COST_RELIABLE_MAX, 0.3)
        self.assertLess(align.COST_RELIABLE_MAX, 0.7)


@unittest.skipUnless(have("jfk.wav") and have("silero_test.wav"), "data evaluasi belum diunduh")
class AlignReal(unittest.TestCase):
    def test_different_content_is_flagged(self):
        a = audiocore.load_audio(f"{DATA}/jfk.wav", 12)[0]
        b = audiocore.load_audio(f"{DATA}/silero_test.wav", 12)[0]
        out, w = align.align(a, audiocore.speech_segments(a)[0], b, audiocore.speech_segments(b)[0])
        self.assertIsNone(w)
        self.assertFalse(out["reliable"])
        self.assertGreater(out["cost"], align.COST_RELIABLE_MAX)


if __name__ == "__main__":
    unittest.main()
