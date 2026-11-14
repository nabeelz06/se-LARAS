"""Deteksi banyak orang (YOLOX-S, ONNX, Apache-2.0) dan pelacak sederhana berbasis IoU.

Panggung Ludruk biasanya berisi beberapa pemain; maestro memilih satu jejak (track) sebagai tokoh
yang dianalisis. Detektor ini hanya mencari kotak orang. Kelas lain diabaikan.
Praproses mengikuti implementasi resmi YOLOX: BGR 0–255 tanpa normalisasi, letterbox pengisi 114.
"""
import os

import cv2
import numpy as np

MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "yolox_s.onnx")
INPUT = 640
STRIDES = (8, 16, 32)


def _grids(size=INPUT):
    gs, ss = [], []
    for s in STRIDES:
        n = size // s
        yv, xv = np.meshgrid(np.arange(n), np.arange(n), indexing="ij")
        gs.append(np.stack([xv, yv], axis=-1).reshape(-1, 2))
        ss.append(np.full((n * n, 1), s))
    return np.concatenate(gs).astype(np.float32), np.concatenate(ss).astype(np.float32)


class PersonDetector:
    def __init__(self, model_path=MODEL, score=0.40, nms_iou=0.45, threads=2):
        import onnxruntime as ort
        so = ort.SessionOptions()
        so.intra_op_num_threads = threads
        so.inter_op_num_threads = 1
        self.sess = ort.InferenceSession(model_path, sess_options=so, providers=["CPUExecutionProvider"])
        self.inp = self.sess.get_inputs()[0].name
        self.grid, self.stride = _grids()
        self.score = score
        self.nms_iou = nms_iou

    def __call__(self, frame_bgr):
        """Kembalikan array (n,5): x1,y1,x2,y2,skor dalam piksel bingkai asli, hanya kelas orang."""
        h, w = frame_bgr.shape[:2]
        r = min(INPUT / h, INPUT / w)
        nh, nw = int(round(h * r)), int(round(w * r))
        img = cv2.resize(frame_bgr, (nw, nh), interpolation=cv2.INTER_LINEAR)
        canvas = np.full((INPUT, INPUT, 3), 114, dtype=np.uint8)
        canvas[:nh, :nw] = img
        x = canvas.transpose(2, 0, 1)[None].astype(np.float32)
        out = self.sess.run(None, {self.inp: x})[0][0]  # (8400, 85)
        xy = (out[:, :2] + self.grid) * self.stride
        wh = np.exp(out[:, 2:4]) * self.stride
        score = out[:, 4] * out[:, 5]  # objektivitas * peluang kelas "orang" (indeks 0)
        keep = score >= self.score
        if not keep.any():
            return np.zeros((0, 5), dtype=np.float32)
        xy, wh, sc = xy[keep], wh[keep], score[keep]
        boxes = np.concatenate([xy - wh / 2, xy + wh / 2], axis=1) / r
        boxes[:, [0, 2]] = boxes[:, [0, 2]].clip(0, w)
        boxes[:, [1, 3]] = boxes[:, [1, 3]].clip(0, h)
        xywh = [[float(b[0]), float(b[1]), float(b[2] - b[0]), float(b[3] - b[1])] for b in boxes]
        idx = cv2.dnn.NMSBoxes(xywh, [float(s) for s in sc], self.score, self.nms_iou)
        idx = np.array(idx).reshape(-1).astype(int)
        return np.concatenate([boxes[idx], sc[idx, None]], axis=1).astype(np.float32)


def iou(a, b):
    ix1, iy1, ix2, iy2 = max(a[0], b[0]), max(a[1], b[1]), min(a[2], b[2]), min(a[3], b[3])
    iw, ih = max(0.0, ix2 - ix1), max(0.0, iy2 - iy1)
    inter = iw * ih
    ua = (a[2] - a[0]) * (a[3] - a[1]) + (b[2] - b[0]) * (b[3] - b[1]) - inter
    return inter / ua if ua > 0 else 0.0


class IouTracker:
    """Pelacak serakah berbasis IoU dan jarak pusat. Jejak bertahan max_gap detik tanpa deteksi."""

    def __init__(self, max_gap=1.6, min_iou=0.20):
        self.max_gap = max_gap
        self.min_iou = min_iou
        self.tracks = []
        self._next = 1

    def update(self, t, boxes):
        pairs = []
        for ti, tr in enumerate(self.tracks):
            if t - tr["last_t"] > self.max_gap:
                continue
            lb = tr["boxes"][-1][1:5]
            ch = max(lb[3] - lb[1], 1.0)
            lc = ((lb[0] + lb[2]) / 2, (lb[1] + lb[3]) / 2)
            for bi, b in enumerate(boxes):
                ov = iou(lb, b[:4])
                bc = ((b[0] + b[2]) / 2, (b[1] + b[3]) / 2)
                dist = np.hypot(bc[0] - lc[0], bc[1] - lc[1]) / ch
                if ov >= self.min_iou or dist < 0.35:
                    pairs.append((ov - 0.3 * dist, ti, bi))
        pairs.sort(reverse=True)
        used_t, used_b = set(), set()
        for _, ti, bi in pairs:
            if ti in used_t or bi in used_b:
                continue
            used_t.add(ti)
            used_b.add(bi)
            tr = self.tracks[ti]
            tr["boxes"].append([t, *[float(v) for v in boxes[bi][:4]], float(boxes[bi][4])])
            tr["last_t"] = t
        for bi, b in enumerate(boxes):
            if bi in used_b:
                continue
            self.tracks.append({"id": self._next, "last_t": t, "boxes": [[t, *[float(v) for v in b[:4]], float(b[4])]]})
            self._next += 1

    def summary(self, w, h, min_hits=3):
        """Ringkas jejak (koordinat dinormalisasi 0–1). Jejak sangat pendek dibuang."""
        out = []
        for tr in self.tracks:
            if len(tr["boxes"]) < min_hits:
                continue
            b = np.array(tr["boxes"], dtype=np.float64)
            area = ((b[:, 3] - b[:, 1]) * (b[:, 4] - b[:, 2])) / float(w * h)
            out.append({
                "id": tr["id"], "n": int(len(b)), "first_t": round(float(b[0, 0]), 2), "last_t": round(float(b[-1, 0]), 2),
                "mean_area": round(float(area.mean()), 4), "weight": round(float(area.sum()), 4),
                "boxes": [[round(float(r[0]), 2), round(float(r[1] / w), 3), round(float(r[2] / h), 3), round(float(r[3] / w), 3), round(float(r[4] / h), 3)] for r in b],
            })
        out.sort(key=lambda x: -x["weight"])
        return out


def box_at(track_boxes, t, max_dt=0.8):
    """Kotak (x1,y1,x2,y2 normalisasi) pada waktu t: interpolasi linear antar deteksi terdekat; None bila terlalu jauh."""
    if not track_boxes:
        return None
    ts = [b[0] for b in track_boxes]
    if t <= ts[0]:
        return track_boxes[0][1:5] if ts[0] - t <= max_dt else None
    if t >= ts[-1]:
        return track_boxes[-1][1:5] if t - ts[-1] <= max_dt else None
    lo = int(np.searchsorted(ts, t))
    a, b = track_boxes[lo - 1], track_boxes[lo]
    if b[0] - a[0] > 2 * max_dt:
        near = a if t - a[0] <= b[0] - t else b
        return near[1:5] if abs(near[0] - t) <= max_dt else None
    f = (t - a[0]) / (b[0] - a[0]) if b[0] > a[0] else 0.0
    return [a[i] + f * (b[i] - a[i]) for i in range(1, 5)]
