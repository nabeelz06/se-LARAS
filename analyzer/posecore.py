"""Estimasi pose satu orang, CPU saja, model BlazePose GHUM "full" (MediaPipe, Apache-2.0).

Dua jalur masuk:
  process_box(frame, box)  -> ROI dari kotak orang (YOLOX) yang dipilih maestro/otomatis. Jalur utama.
  process(frame)           -> cadangan tanpa detektor orang: kandidat ROI (HOG, seluruh bingkai, 0,66 bingkai).
Batasan yang diakui: orang kecil di bingkai, tubuh tertutup, atau gerak sangat cepat menurunkan mutu.
Bingkai yang gagal dihitung sebagai gagal, bukan ditebak.
"""
import os

import cv2
import numpy as np
from ai_edge_litert.interpreter import Interpreter

MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "pose_landmark_full.tflite")
N_LM = 33
L_SH, R_SH, L_WR, R_WR, L_HIP, R_HIP, L_AN, R_AN, NOSE = 11, 12, 15, 16, 23, 24, 27, 28, 0
MIN_SCORE = 0.45


def _sig(x):
    return 1.0 / (1.0 + np.exp(-x))


class LandmarkFilter:
    """Filter One Euro per landmark (min_cutoff 0,05; beta 80; d_cutoff 1,0 — nilai bawaan penyaring landmark pose MediaPipe).

    Nilai diskalakan dengan ukuran ROI agar beta berlaku relatif terhadap ukuran tubuh. Menekan kegoyahan model
    saat orang diam tanpa meredam gerak cepat. Penyaring di-reset bila ada celah waktu (bingkai hilang).
    """

    def __init__(self, min_cutoff=0.05, beta=80.0, d_cutoff=1.0, max_gap=0.6):
        self.min_cutoff, self.beta, self.d_cutoff, self.max_gap = min_cutoff, beta, d_cutoff, max_gap
        self.reset()

    def reset(self):
        self.t = None
        self.x = None
        self.dx = None

    @staticmethod
    def _alpha(te, cutoff):
        tau = 1.0 / (2.0 * np.pi * cutoff)
        return 1.0 / (1.0 + tau / te)

    def apply(self, pts, t, scale):
        """pts: (33,3) piksel; mengembalikan salinan dengan x,y tersaring."""
        xy = pts[:, :2] / max(scale, 1.0)
        if self.t is None or t - self.t > self.max_gap or t <= self.t:
            self.t, self.x, self.dx = t, xy.copy(), np.zeros_like(xy)
            return pts
        te = t - self.t
        dx = (xy - self.x) / te
        a_d = self._alpha(te, self.d_cutoff)
        self.dx = a_d * dx + (1 - a_d) * self.dx
        cutoff = self.min_cutoff + self.beta * np.abs(self.dx)
        a = self._alpha(te, cutoff)
        self.x = a * xy + (1 - a) * self.x
        self.t = t
        out = pts.copy()
        out[:, :2] = self.x * max(scale, 1.0)
        return out


class PoseTracker:
    def __init__(self, min_presence=0.5, threads=2):
        self.it = Interpreter(model_path=MODEL, num_threads=threads)
        self.it.allocate_tensors()
        self.inp = self.it.get_input_details()[0]["index"]
        outs = {d["name"] + str(d["shape"].tolist()): d["index"] for d in self.it.get_output_details()}
        self.o_lm = [i for k, i in outs.items() if k.endswith("[1, 195]")][0]
        self.o_flag = [i for k, i in outs.items() if k.endswith("[1, 1]")][0]
        self._hog = None
        self.roi = None
        self.last_size = 256.0
        self.min_presence = min_presence

    def reset(self):
        self.roi = None

    @property
    def hog(self):
        if self._hog is None:
            if not hasattr(cv2, "HOGDescriptor"):
                raise RuntimeError(
                    "OpenCV yang termuat tidak memiliki cv2.HOGDescriptor (dipakai jalur cadangan). Pasang dependensi dari "
                    "analyzer/requirements.txt (opencv-contrib-python-headless) di lingkungan bersih; jangan campur varian opencv-*."
                )
            self._hog = cv2.HOGDescriptor()
            self._hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
        return self._hog

    # ---- inferensi satu ROI persegi (cx, cy, sisi) dalam piksel bingkai ----
    def _infer(self, frame, roi):
        cx, cy, size = roi
        self.last_size = float(size)
        scale = 256.0 / size
        M = np.array([[scale, 0, 128 - cx * scale], [0, scale, 128 - cy * scale]], dtype=np.float32)
        crop = cv2.warpAffine(frame, M, (256, 256), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_CONSTANT)
        rgb = cv2.cvtColor(crop, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
        self.it.set_tensor(self.inp, rgb[None])
        self.it.invoke()
        flag = float(_sig(self.it.get_tensor(self.o_flag)[0][0]))
        raw = self.it.get_tensor(self.o_lm)[0].reshape(-1, 5)[:N_LM]
        if flag < self.min_presence:
            return None, flag
        pts = np.zeros((N_LM, 3), dtype=np.float32)
        pts[:, 0] = (raw[:, 0] - 128) / scale + cx
        pts[:, 1] = (raw[:, 1] - 128) / scale + cy
        pts[:, 2] = _sig(raw[:, 3])  # keterlihatan
        return pts, flag

    @staticmethod
    def _score(pts, flag):
        return float(flag) * float(pts[[L_SH, R_SH, L_HIP, R_HIP, NOSE], 2].mean())

    def _track(self, pts):
        vis = pts[:, 2] > 0.5
        xs, ys = pts[vis, 0], pts[vis, 1]
        cx, cy = (xs.min() + xs.max()) / 2, (ys.min() + ys.max()) / 2
        size = max(xs.max() - xs.min(), ys.max() - ys.min()) * 1.45
        self.roi = (cx, cy, max(size, 64.0))
        return pts

    # ---- jalur utama: ROI dari kotak orang ----
    @staticmethod
    def roi_from_box(box_px):
        x1, y1, x2, y2 = box_px
        return ((x1 + x2) / 2, (y1 + y2) / 2, max(x2 - x1, y2 - y1) * 1.25)

    def process_box(self, frame, box_px):
        """box_px: x1,y1,x2,y2 piksel (atau None bila deteksi hilang; pakai ROI jejak landmark sebelumnya)."""
        cands = []
        if self.roi is not None:
            cands.append(self.roi)
        if box_px is not None:
            cands.append(self.roi_from_box(box_px))
        for roi in cands:
            pts, flag = self._infer(frame, roi)
            if pts is None or self._score(pts, flag) < MIN_SCORE:
                continue
            if box_px is not None:  # kerangka harus masih berada di sekitar kotak orang yang dipilih
                x1, y1, x2, y2 = box_px
                mx, my = 0.25 * (x2 - x1), 0.25 * (y2 - y1)
                vis = pts[:, 2] > 0.5
                if vis.any():
                    cx, cy = float(pts[vis, 0].mean()), float(pts[vis, 1].mean())
                    if not (x1 - mx <= cx <= x2 + mx and y1 - my <= cy <= y2 + my):
                        continue
            return self._track(pts)
        self.roi = None
        return None

    # ---- cadangan tanpa detektor orang ----
    def _detect_roi(self, frame):
        h, w = frame.shape[:2]
        s = 640.0 / max(h, w) if max(h, w) > 640 else 1.0
        small = cv2.resize(frame, None, fx=s, fy=s) if s != 1.0 else frame
        rects, weights = self.hog.detectMultiScale(small, winStride=(8, 8), padding=(8, 8), scale=1.05)
        if len(rects) == 0:
            return None
        i = int(np.argmax([r[2] * r[3] * max(float(wt), 0.01) for r, wt in zip(rects, np.ravel(weights))]))
        x, y, rw, rh = [v / s for v in rects[i]]
        return (x + rw / 2, y + rh / 2, max(rw, rh) * 1.35)

    def _candidates(self, frame):
        h, w = frame.shape[:2]
        out = []
        hr = self._detect_roi(frame)
        if hr is not None:
            out.append(hr)
        m = float(max(h, w))
        out.append((w / 2, h / 2, m))
        out.append((w / 2, h / 2, m * 0.66))
        return out

    def process(self, frame):
        """Kembalikan array (33,3) = x,y piksel bingkai dan keterlihatan, atau None."""
        if self.roi is not None:
            pts, flag = self._infer(frame, self.roi)
            if pts is not None and self._score(pts, flag) > MIN_SCORE:
                return self._track(pts)
            self.roi = None
        best, best_s = None, 0.0
        for roi in self._candidates(frame):
            pts, flag = self._infer(frame, roi)
            if pts is None:
                continue
            sc = self._score(pts, flag)
            if sc > best_s:
                best, best_s = pts, sc
        if best is None or best_s < MIN_SCORE:
            return None
        return self._track(best)
