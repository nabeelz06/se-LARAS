#!/usr/bin/env python3
"""Analisis klip latihan se-LARAS v2.

Pemakaian: analyze.py <berkas> [both|audio|video] [--track N] [--ref berkas_acuan] [--max-seconds N]

Keluaran JSON ke stdout. Semua angka bersifat DESKRIPTIF: tidak ada skor mutu dan tidak ada klaim
"benar/salah". Rekaman buruk menghasilkan peringatan, bukan angka yang dibuat-buat.
Komponen: Silero VAD v6.2 (suara), YOLOX-S (deteksi orang) + pelacak IoU, BlazePose GHUM full (pose),
DTW pada MFCC (penyejajaran terhadap acuan maestro).
"""
import argparse
import json
import os
import sys
import time

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import numpy as np  # noqa: E402

MAX_SECONDS = 150.0
POSE_FPS = 5.0
DET_FPS = 2.5
MAX_SIDE = 960


def engine_info():
    info = {"suara": "Silero VAD v6.2 (ONNX)", "orang": "YOLOX-S (ONNX)", "pose": "BlazePose GHUM full (TFLite)", "sejajar": "DTW pada MFCC (librosa)"}
    try:
        import onnxruntime
        import librosa
        import cv2
        info["versi"] = {"onnxruntime": onnxruntime.__version__, "librosa": librosa.__version__, "opencv": cv2.__version__, "numpy": np.__version__}
    except Exception:  # noqa: BLE001
        pass
    return info


def iter_frames(path, sample_fps, max_seconds, max_side=MAX_SIDE):
    """Hasilkan (t, bingkai_BGR) tiap ~1/sample_fps detik. Tahan terhadap metadata durasi yang rusak (rekaman peramban)."""
    import cv2
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        return
    fps = cap.get(cv2.CAP_PROP_FPS)
    if not fps or not np.isfinite(fps) or fps < 1 or fps > 240:
        fps = 25.0
    step = max(1, int(round(fps / sample_fps)))
    i = 0
    try:
        while True:
            if not cap.grab():
                break
            t = i / fps
            if t > max_seconds:
                break
            if i % step == 0:
                ok, fr = cap.retrieve()
                if ok and fr is not None:
                    h, w = fr.shape[:2]
                    sc = max_side / float(max(h, w))
                    if sc < 1:
                        fr = cv2.resize(fr, None, fx=sc, fy=sc, interpolation=cv2.INTER_AREA)
                    yield t, fr, fps / step
            i += 1
    finally:
        cap.release()


def detect_pass(path, max_seconds):
    from detect import PersonDetector, IouTracker
    det = PersonDetector()
    trk = IouTracker()
    counts, size = [], None
    for t, fr, _ in iter_frames(path, DET_FPS, max_seconds):
        h, w = fr.shape[:2]
        size = (w, h)
        boxes = det(fr)
        counts.append(len(boxes))
        trk.update(t, boxes)
    if size is None:
        return None
    tracks = trk.summary(size[0], size[1])
    return {"tracks": tracks, "frames": len(counts), "count_median": float(np.median(counts)) if counts else 0.0, "size": size}


def pose_pass(path, track, max_seconds):
    """Pose pada ~POSE_FPS. track: daftar kotak [t,x1,y1,x2,y2,skor] ternormalisasi, atau None (cadangan tanpa detektor)."""
    from posecore import PoseTracker, LandmarkFilter
    from detect import box_at
    tracker = PoseTracker()
    filt = LandmarkFilter()
    ts, pts_list, size, eff = [], [], None, POSE_FPS
    for t, fr, eff in iter_frames(path, POSE_FPS, max_seconds):
        h, w = fr.shape[:2]
        size = (w, h)
        if track is None:
            p = tracker.process(fr)
        else:
            b = box_at(track, t)
            bpx = None if b is None else [b[0] * w, b[1] * h, b[2] * w, b[3] * h]
            p = tracker.process_box(fr, bpx)
        if p is not None:
            p = filt.apply(p, t, tracker.last_size)
        else:
            filt.reset()
        ts.append(t)
        pts_list.append(None if p is None else np.column_stack([p[:, 0] / w, p[:, 1] / h, p[:, 2]]).astype(np.float32))
    return ts, pts_list, size, eff


def runs(frames):
    """Pecah daftar bingkai (None = putus) menjadi rangkaian bingkai berurutan."""
    cur, out = [], []
    for f in frames:
        if f is None:
            if cur:
                out.append(cur)
            cur = []
        else:
            cur.append(f)
    if cur:
        out.append(cur)
    return out


def smooth_binomial(x):
    """Penghalus [1/4, 1/2, 1/4] sepanjang sumbu waktu (sumbu 0), tanpa pergeseran fase; ujung dibiarkan. Offline, jadi boleh non-kausal."""
    x = np.asarray(x, dtype=np.float64)
    if len(x) < 3:
        return x
    y = x.copy()
    y[1:-1] = 0.25 * x[:-2] + 0.5 * x[1:-1] + 0.25 * x[2:]
    return y


def pose_metrics(path, segs, track_id, max_seconds, persons_out):
    from posecore import L_SH, R_SH, L_WR, R_WR, L_HIP, R_HIP
    t0 = time.time()
    persons = None
    try:
        persons = detect_pass(path, max_seconds)
    except Exception as e:  # noqa: BLE001
        persons_out["error"] = f"{type(e).__name__}: {e}"
    if persons is None and "error" not in persons_out:
        return None, ["video_tak_terbuka"], [], None
    warnings = []
    track = None
    if persons and persons["tracks"]:
        tr = persons["tracks"]
        sel = next((x for x in tr if x["id"] == track_id), None) if track_id else None
        if track_id and sel is None:
            warnings.append("jejak_pilihan_tak_ada")
        sel = sel or tr[0]
        track = sel["boxes"]
        persons_out.update({"tracks": tr, "selected": sel["id"], "count_median": persons["count_median"], "frames": persons["frames"]})
        if persons["count_median"] >= 2:
            warnings.append("banyak_orang_terdeteksi")
    else:
        persons_out.update({"tracks": [], "selected": None, "count_median": 0.0, "frames": (persons or {}).get("frames", 0)})
        warnings.append("orang_tak_terdeteksi_pakai_cadangan")
    t1 = time.time()
    ts, pts_list, size, eff = pose_pass(path, track, max_seconds)
    t2 = time.time()
    tried = len(ts)
    if tried == 0:
        return None, warnings + ["tanpa_video"], [], None
    det = [p is not None for p in pts_list]
    rate = sum(det) / len(det)
    if rate < 0.6:
        warnings.append("pose_sulit_dideteksi")
    base = {"frames_analyzed": tried, "frames_detected": int(sum(det)), "detection_rate": round(rate, 3), "sample_fps": round(eff, 2),
            "person_id": persons_out.get("selected"), "timing_s": {"orang": round(t1 - t0, 1), "pose": round(t2 - t1, 1)}}
    if sum(det) < 8:
        return base, warnings + ["pose_tak_cukup"], [], None
    w, h = size
    wh = np.array([w, h], dtype=np.float32)

    def torso(p):
        if min(p[[L_SH, R_SH, L_HIP, R_HIP], 2]) < 0.5:
            return None
        sh = (p[L_SH, :2] + p[R_SH, :2]) / 2 * wh
        hp = (p[L_HIP, :2] + p[R_HIP, :2]) / 2 * wh
        return float(np.linalg.norm(sh - hp)), sh, hp

    speeds, lean = [], []
    # Kumpulkan per bingkai: waktu, panjang torso, posisi dan keyakinan kedua pergelangan. Bingkai tanpa torso andal memutus rangkaian.
    frames = []
    for t, p in zip(ts, pts_list):
        tr_ = torso(p) if p is not None else None
        if tr_ is None or tr_[0] < 10:
            frames.append(None)
            continue
        L, sh, hp = tr_
        v = hp - sh
        lean.append(float(np.degrees(np.arctan2(abs(v[0]), abs(v[1]) + 1e-6))))
        frames.append((t, L, np.array([p[L_WR, :2] * wh, p[R_WR, :2] * wh]), np.array([p[L_WR, 2], p[R_WR, 2]])))
    for run in runs(frames):
        pos = smooth_binomial(np.stack([f[2] for f in run]))   # (n, 2 tangan, 2) -> penghalusan zero-phase 3 titik
        for i in range(1, len(run)):
            (t0_, L0, _, v0), (t1_, L1, _, v1) = run[i - 1], run[i]
            dt = t1_ - t0_
            if dt <= 0:
                continue
            Lm = 0.5 * (L0 + L1)
            sp = [float(np.linalg.norm(pos[i, k] - pos[i - 1, k])) / Lm / dt for k in range(2) if v0[k] > 0.4 and v1[k] > 0.4]
            if sp:
                speeds.append((t1_, max(sp)))
    m = dict(base)
    if len(speeds) >= 5:
        sv = np.array([s for _, s in speeds])
        m["wrist_speed_mean"] = round(float(np.mean(sv)), 3)
        m["wrist_speed_p90"] = round(float(np.percentile(sv, 90)), 3)
    if len(lean) >= 5:
        m["torso_lean_mean_deg"] = round(float(np.mean(lean)), 2)
        m["torso_lean_std_deg"] = round(float(np.std(lean)), 2)
    if len(speeds) >= 8 and segs:
        from scipy.signal import find_peaks
        tt = np.array([t for t, _ in speeds])
        sv = np.array([s for _, s in speeds])
        pk, _ = find_peaks(sv, height=np.percentile(sv, 70))
        pt = tt[pk]
        lags = []
        for s, _e in segs:
            if len(pt):
                j = int(np.argmin(np.abs(pt - s)))
                if abs(pt[j] - s) <= 1.0:
                    lags.append(float(pt[j] - s))
        if len(lags) >= 4:
            m["gesture_speech_lag_s"] = round(float(np.median(lags)), 3)
            m["gesture_speech_pairs"] = len(lags)
    timeline, last = [], -1.0
    for t, p in zip(ts, pts_list):
        if p is None or t - last < 0.19:
            continue
        last = t
        timeline.append({"t": round(float(t), 2), "lm": np.round(p, 3).tolist()})
    m["timeline"] = timeline
    return m, warnings, speeds, (w, h)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("mode", nargs="?", default="both", choices=["both", "audio", "video"])
    ap.add_argument("--track", type=int, default=None)
    ap.add_argument("--ref", default=None)
    ap.add_argument("--max-seconds", type=float, default=MAX_SECONDS)
    a = ap.parse_args()
    out = {"version": 2, "engine": engine_info(), "audio": None, "pose": None, "persons": None, "moments": [], "alignment": None, "warnings": []}
    T0 = time.time()
    timings = {}
    try:
        import audiocore
        t = time.time()
        am, wa, segs, y = audiocore.audio_metrics(a.path, a.max_seconds)
        timings["suara_s"] = round(time.time() - t, 1)
        out["audio"] = am
        out["warnings"] += wa
        pauses = (am or {}).get("pauses", [])
        speeds = []
        if a.mode in ("both", "video"):
            persons_out = {}
            t = time.time()
            pm, wp, speeds, _ = pose_metrics(a.path, segs, a.track, a.max_seconds, persons_out)
            timings["video_s"] = round(time.time() - t, 1)
            out["pose"] = pm
            out["persons"] = persons_out or None
            out["warnings"] += wp
        if a.ref and y is not None and segs:
            try:
                import align
                from audiocore import audio_metrics as _am
                t = time.time()
                ym, _w, segs_ref, y_ref = _am(a.ref, a.max_seconds, with_pitch=False)
                if y_ref is None or not segs_ref:
                    out["warnings"].append("acuan_tanpa_suara_untuk_sejajar")
                else:
                    res, why = align.align(y_ref, segs_ref, y, segs)
                    out["alignment"] = res
                    if why:
                        out["warnings"].append(why)
                    elif res and not res["reliable"]:
                        out["warnings"].append("penyejajaran_tak_andal")
                timings["sejajar_s"] = round(time.time() - t, 1)
            except Exception as e:  # noqa: BLE001
                out["warnings"].append("penyejajaran_gagal")
                out["alignment_error"] = f"{type(e).__name__}: {e}"
        from moments import propose
        out["moments"] = propose(pauses, speeds)
    except Exception as e:  # noqa: BLE001
        out["error"] = f"{type(e).__name__}: {e}"
    if out["audio"] is None and (out["pose"] is None or "wrist_speed_mean" not in (out["pose"] or {})):
        out["warnings"].append("tidak_ada_ukuran_andal")
    timings["total_s"] = round(time.time() - T0, 1)
    out["timings"] = timings
    print(json.dumps(out))


if __name__ == "__main__":
    main()
