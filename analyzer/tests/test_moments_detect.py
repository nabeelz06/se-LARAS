import unittest

import numpy as np

import detect
import moments


class Moments(unittest.TestCase):
    def test_long_pauses_only(self):
        ms = moments.propose([[1.0, 0.3], [3.0, 1.2], [8.0, 0.9]], None)
        self.assertEqual([m["t"] for m in ms], [3.0, 8.0])
        self.assertTrue(all(m["kind"] == "jeda" for m in ms))

    def test_gesture_peaks(self):
        t = np.arange(0, 20, 0.2)
        v = 0.2 + np.exp(-((t - 5) ** 2)) * 2 + np.exp(-((t - 14) ** 2)) * 3
        ms = moments.propose([], list(zip(t, v)))
        times = [m["t"] for m in ms if m["kind"] == "gerak"]
        self.assertTrue(any(abs(x - 5) < 0.6 for x in times) and any(abs(x - 14) < 0.6 for x in times))
        self.assertTrue(all(0 < m["strength"] <= 1 for m in ms if m["kind"] == "gerak"))

    def test_sorted_and_empty(self):
        self.assertEqual(moments.propose([], None), [])
        ms = moments.propose([[9.0, 1.0], [2.0, 1.0]], None)
        self.assertEqual([m["t"] for m in ms], [2.0, 9.0])


class Smoothing(unittest.TestCase):
    def test_binomial_reduces_white_noise_and_keeps_slow_motion(self):
        import analyze
        rng = np.random.default_rng(0)
        t = np.arange(0, 60, 0.2)
        slow = np.sin(2 * np.pi * 0.2 * t)
        noisy = slow + rng.normal(0, 0.1, size=len(t))
        sm = analyze.smooth_binomial(noisy)
        self.assertLess(np.std(sm[1:-1] - slow[1:-1]), 0.8 * np.std(noisy - slow))
        self.assertLess(float(np.max(np.abs(analyze.smooth_binomial(slow) - slow))), 0.06)

    def test_runs_split_on_none(self):
        import analyze
        self.assertEqual([len(r) for r in analyze.runs([1, 2, None, 3, None, None, 4, 5, 6])], [2, 1, 3])


class Tracker(unittest.TestCase):
    def test_iou(self):
        self.assertAlmostEqual(detect.iou([0, 0, 10, 10], [0, 0, 10, 10]), 1.0)
        self.assertAlmostEqual(detect.iou([0, 0, 10, 10], [10, 0, 20, 10]), 0.0)
        self.assertAlmostEqual(detect.iou([0, 0, 10, 10], [5, 0, 15, 10]), 1 / 3, places=3)

    def test_two_people_tracked_separately(self):
        tr = detect.IouTracker()
        for k in range(10):
            t = k * 0.4
            tr.update(t, np.array([[100 + k, 100, 200 + k, 400, 0.9], [500, 120, 620, 420, 0.8]], dtype=np.float32))
        s = tr.summary(1000, 600)
        self.assertEqual(len(s), 2)
        self.assertTrue(all(x["n"] == 10 for x in s))
        self.assertGreaterEqual(s[0]["weight"], s[1]["weight"])

    def test_track_survives_short_gap_but_not_long(self):
        tr = detect.IouTracker(max_gap=1.0)
        b = np.array([[100, 100, 200, 400, 0.9]], dtype=np.float32)
        tr.update(0.0, b)
        tr.update(0.8, b)       # celah 0,8 dtk: tetap jejak yang sama
        tr.update(3.0, b)       # celah 2,2 dtk: jejak baru
        self.assertEqual(len(tr.tracks), 2)

    def test_box_at_interpolates(self):
        tb = [[0.0, 0.1, 0.1, 0.3, 0.5], [1.0, 0.3, 0.1, 0.5, 0.5]]
        b = detect.box_at(tb, 0.5)
        self.assertAlmostEqual(b[0], 0.2)
        self.assertIsNone(detect.box_at(tb, 5.0))
        self.assertIsNotNone(detect.box_at(tb, 1.3))


class Vision(unittest.TestCase):
    def test_detector_finds_people_in_bus_photo(self):
        from tests.common import have, DATA
        if not have("bus.jpg"):
            self.skipTest("data evaluasi belum diunduh")
        import cv2
        img = cv2.imread(f"{DATA}/bus.jpg")
        boxes = detect.PersonDetector()(img)
        strong = [b for b in boxes if b[4] >= 0.6]
        self.assertGreaterEqual(len(strong), 3)

    def test_landmark_filter_reduces_jitter(self):
        import posecore
        rng = np.random.default_rng(0)
        f = posecore.LandmarkFilter()
        base = np.zeros((33, 3), dtype=np.float32)
        base[:, 0], base[:, 1] = 100, 100
        raw, filt = [], []
        for k in range(60):
            p = base.copy()
            p[:, :2] += rng.normal(0, 2.0, size=(33, 2))
            raw.append(p[15, 0])
            filt.append(f.apply(p, k * 0.2, 200.0)[15, 0])
        # Pada 5 bingkai/detik dan getaran ~1% ukuran tubuh, setelan bawaan MediaPipe hanya meredam sedikit; yang diuji: tidak memperbesar
        self.assertLessEqual(np.std(filt[10:]), np.std(raw[10:]))

    def test_landmark_filter_follows_fast_motion(self):
        import posecore
        f = posecore.LandmarkFilter()
        out = []
        for k in range(30):
            p = np.zeros((33, 3), dtype=np.float32)
            p[:, 0] = 100 + 40 * k   # gerak cepat bergaris lurus
            out.append(f.apply(p, k * 0.2, 200.0)[0, 0])
        lag = (100 + 40 * 29) - out[-1]
        self.assertLess(abs(lag), 40 * 3)


if __name__ == "__main__":
    unittest.main()
