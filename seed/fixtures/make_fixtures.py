#!/usr/bin/env python3
"""Buat ulang klip contoh (fixture) se-LARAS: `maestro_uji.mp4` dan `murid_uji.mp4`.

TIDAK ADA foto atau rekaman orang nyata di klip ini.
- Gambar: penari "boneka" yang digambar dengan kode (OpenCV) untuk se-LARAS: kapsul anggota badan, udeng, rompi, sampur.
  Detektor orang YOLOX (dilatih pada foto) tidak mengenali gambar kartun; analisis memakai jalur cadangan dan
  menampilkan peringatan itu. Itu perilaku yang benar untuk gambar kartun, bukan kegagalan klip.
- Suara: LJSpeech `LJ001-0001` (satu penutur; dinyatakan domain publik di AS oleh pengumpulnya, https://keithito.com/LJ-Speech-Dataset/)
  dengan keheningan digital disisipkan pada detik 2,5 / 5,9 / 8,0 (klip "maestro": 3 x 1,1 dtk; klip "murid": 3 x 0,35 dtk).

Pemakaian (butuh numpy, scipy, soundfile, opencv, ffmpeg; data suara dari analyzer/evaluation/fetch_data.py):
    python3 seed/fixtures/make_fixtures.py [--out DIREKTORI] [--wav analyzer/evaluation/data/LJ001-0001.wav]
"""
import argparse
import math
import os
import subprocess
import tempfile

import cv2
import numpy as np
import soundfile as sf
from scipy.signal import resample_poly

W, H, FPS, SECONDS, SR = 480, 360, 25, 20, 16000
INSERT_AT_S = (2.5, 5.9, 8.0)           # detik pada suara sumber
CLIPS = {                                # nama: (panjang jeda sisipan, kecepatan gerak Hz, amplitudo)
    "maestro_uji.mp4": (1.1, 0.30, 0.75),
    "murid_uji.mp4": (0.35, 0.60, 1.0),
}


# ---------------------------------------------------------------- gambar
def _lerp(a, b, t):
    return a + (b - a) * t


def _background():
    ys = np.linspace(0, 1, H)[:, None]
    xs = np.linspace(0, 1, W)[None, :]
    fold = 0.5 + 0.5 * np.sin(xs * 2 * math.pi * 7.0)
    base = np.array([60, 28, 110], np.float32)               # BGR: marun tua (tirai)
    img = (base[None, None, :] * (0.55 + 0.45 * fold[..., None]) * (1.05 - 0.45 * ys[..., None])).astype(np.uint8)
    fl = int(H * 0.86)
    img[fl:, :, :] = (np.array([40, 70, 105], np.float32) * (0.6 + 0.4 * np.linspace(0, 1, H - fl)[:, None, None])).astype(np.uint8)
    yy, xx = np.mgrid[0:H, 0:W]
    spot = np.exp(-(((xx - W / 2) / 190.0) ** 2 + ((yy - H * 0.45) / 220.0) ** 2))
    return np.clip(img.astype(np.float32) * (0.75 + 0.45 * spot[..., None]), 0, 255).astype(np.uint8)


_BG = None


def _capsule(img, p, q, r0, r1, col, hi=None):
    n = 14
    for i in range(n + 1):
        t = i / n
        cv2.circle(img, (int(_lerp(p[0], q[0], t)), int(_lerp(p[1], q[1], t))), int(round(_lerp(r0, r1, t))), col, -1, cv2.LINE_AA)
    if hi is not None:
        d = np.array(q, np.float32) - np.array(p, np.float32)
        nrm = np.array([-d[1], d[0]], np.float32)
        nrm /= (np.linalg.norm(nrm) + 1e-6)
        off = nrm * (-0.35 * r0)
        cv2.line(img, (int(p[0] + off[0]), int(p[1] + off[1])), (int(q[0] + off[0]), int(q[1] + off[1])), hi, max(1, int(r0 * 0.5)), cv2.LINE_AA)


def _angles(t, speed, amp):
    w = 2 * math.pi * speed
    up = amp * (0.55 + 0.45 * math.sin(w * t))
    return dict(
        sway=4.0 * math.sin(w * 0.5 * t),
        r_upper=math.radians(25 + 70 * up),
        r_fore=math.radians(10 + 60 * (0.5 + 0.5 * math.sin(w * t + 1.2)) * amp),
        l_upper=math.radians(18 + 8 * math.sin(w * 0.5 * t + 0.6) * amp),
        l_fore=math.radians(8 + 10 * (0.5 + 0.5 * math.sin(w * 0.5 * t)) * amp),
        knee=math.radians(3 + 4 * math.sin(w * 0.5 * t)))


def draw_dancer(t, speed, amp, cx=240, top=14, height=328):
    global _BG
    if _BG is None:
        _BG = _background()
    img = _BG.copy()
    u = height / 7.7                                          # tinggi kepala
    p = _angles(t, speed, amp)
    sx = p["sway"]
    head = (cx + sx * 0.4, top + 0.55 * u)
    neck = (cx + sx * 0.5, top + 1.25 * u)
    sy = top + 1.65 * u
    shw = 1.05 * u
    sR, sL = (cx + sx * 0.6 - shw, sy), (cx + sx * 0.6 + shw, sy)
    hy = top + 3.9 * u
    hR, hL = (cx + sx * 0.2 - 0.52 * u, hy), (cx + sx * 0.2 + 0.52 * u, hy)

    def end(a, length, ang, outward):
        return (a[0] + outward * length * math.sin(ang), a[1] + length * math.cos(ang))

    skin, skin_hi = (96, 140, 196), (130, 175, 225)
    shirt, shirt_hi = (45, 30, 150), (80, 60, 190)
    vest, pants, pants_hi, gold = (28, 28, 34), (30, 30, 36), (62, 62, 70), (60, 170, 215)

    kR = end(hR, 1.85 * u, p["knee"] + math.radians(2), -1); aR = end(kR, 1.7 * u, -math.radians(1), -1)
    kL = end(hL, 1.85 * u, p["knee"] + math.radians(2), 1); aL = end(kL, 1.7 * u, -math.radians(1), 1)
    for h, k, a in ((hR, kR, aR), (hL, kL, aL)):
        _capsule(img, h, k, 0.46 * u, 0.34 * u, pants, pants_hi)
        _capsule(img, k, a, 0.34 * u, 0.24 * u, pants, pants_hi)
        cv2.ellipse(img, (int(a[0]), int(a[1] + 0.12 * u)), (int(0.42 * u), int(0.17 * u)), 0, 0, 360, (20, 20, 24), -1, cv2.LINE_AA)
    body = np.array([[sR[0] - 0.1 * u, sy + 0.5 * u], [sL[0] + 0.1 * u, sy + 0.5 * u], [hL[0] + 0.62 * u, hy + 0.9 * u], [hR[0] - 0.62 * u, hy + 0.9 * u]], np.int32)
    cv2.fillPoly(img, [body], shirt, cv2.LINE_AA)
    mid_hip = ((hR[0] + hL[0]) / 2, hy + 0.5 * u)
    cv2.line(img, (int(neck[0]), int(neck[1])), (int(mid_hip[0]), int(mid_hip[1])), shirt_hi, int(0.5 * u), cv2.LINE_AA)
    v1 = np.array([[sR[0] + 0.2 * u, sy + 0.15 * u], [(sR[0] + sL[0]) / 2 - 0.1 * u, sy + 0.1 * u], [mid_hip[0] - 0.15 * u, hy + 0.7 * u], [hR[0] - 0.2 * u, hy + 0.7 * u]], np.int32)
    v2 = np.array([[sL[0] - 0.2 * u, sy + 0.15 * u], [(sR[0] + sL[0]) / 2 + 0.1 * u, sy + 0.1 * u], [mid_hip[0] + 0.15 * u, hy + 0.7 * u], [hL[0] + 0.2 * u, hy + 0.7 * u]], np.int32)
    cv2.fillPoly(img, [v1, v2], vest, cv2.LINE_AA)
    cv2.line(img, (int(hR[0] - 0.55 * u), int(hy + 0.1 * u)), (int(hL[0] + 0.55 * u), int(hy + 0.1 * u)), gold, int(0.32 * u), cv2.LINE_AA)
    _capsule(img, (neck[0], neck[1] - 0.25 * u), (neck[0], sy + 0.05 * u), 0.32 * u, 0.38 * u, skin, skin_hi)
    cv2.ellipse(img, (int(head[0]), int(head[1])), (int(0.42 * u), int(0.56 * u)), 0, 0, 360, skin, -1, cv2.LINE_AA)
    cv2.ellipse(img, (int(head[0] - 0.12 * u), int(head[1] - 0.05 * u)), (int(0.16 * u), int(0.30 * u)), 0, 0, 360, skin_hi, -1, cv2.LINE_AA)
    cv2.ellipse(img, (int(head[0]), int(head[1] - 0.22 * u)), (int(0.47 * u), int(0.36 * u)), 0, 180, 360, (30, 30, 170), -1, cv2.LINE_AA)   # udeng
    cv2.line(img, (int(head[0] - 0.46 * u), int(head[1] - 0.22 * u)), (int(head[0] + 0.46 * u), int(head[1] - 0.22 * u)), vest, int(0.12 * u), cv2.LINE_AA)
    for sg in (-1, 1):
        cv2.circle(img, (int(head[0] + sg * 0.17 * u), int(head[1] + 0.04 * u)), max(1, int(0.045 * u)), (20, 20, 30), -1, cv2.LINE_AA)
    cv2.ellipse(img, (int(head[0]), int(head[1] + 0.27 * u)), (int(0.12 * u), int(0.05 * u)), 0, 10, 170, (40, 40, 120), 1, cv2.LINE_AA)
    eR = end(sR, 1.4 * u, p["r_upper"], -1); wR = end(eR, 1.2 * u, p["r_upper"] + p["r_fore"], -1)
    eL = end(sL, 1.4 * u, p["l_upper"], 1); wL = end(eL, 1.2 * u, p["l_upper"] + p["l_fore"], 1)
    for s, e, w in ((sR, eR, wR), (sL, eL, wL)):
        _capsule(img, s, e, 0.36 * u, 0.3 * u, shirt, shirt_hi)
        _capsule(img, e, w, 0.28 * u, 0.2 * u, skin, skin_hi)
        cv2.circle(img, (int(w[0]), int(w[1])), int(0.24 * u), skin, -1, cv2.LINE_AA)
    cv2.line(img, (int(wR[0]), int(wR[1])), (int(wR[0] - 0.4 * u), int(wR[1] + 1.6 * u)), gold, int(0.22 * u), cv2.LINE_AA)   # sampur
    return img


# ---------------------------------------------------------------- suara
def build_audio(wav_path, gap_s):
    y, sr = sf.read(wav_path)
    if y.ndim > 1:
        y = y.mean(axis=1)
    y = resample_poly(y, SR, sr)
    parts, prev = [], 0
    for at in INSERT_AT_S:
        k = int(round(at * SR))
        parts += [y[prev:k], np.zeros(int(round(gap_s * SR)))]
        prev = k
    parts.append(y[prev:])
    out = np.concatenate(parts)
    total = SR * SECONDS
    return (np.pad(out, (0, max(0, total - len(out))))[:total]).astype(np.float32)


def build_clip(path, wav_path, gap_s, speed, amp, ffmpeg="ffmpeg"):
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "a.wav")
        sf.write(wav, build_audio(wav_path, gap_s), SR, subtype="PCM_16")
        cmd = [ffmpeg, "-v", "error", "-y", "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", wav,
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "96k", "-t", str(SECONDS),
               "-movflags", "+faststart", path]
        pr = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        for i in range(FPS * SECONDS):
            pr.stdin.write(draw_dancer(i / FPS, speed, amp).tobytes())
        pr.stdin.close()
        if pr.wait() != 0:
            raise RuntimeError("ffmpeg gagal")


def main():
    here = os.path.dirname(os.path.abspath(__file__))
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--out", default=here)
    ap.add_argument("--wav", default=os.path.join(here, "..", "..", "analyzer", "evaluation", "data", "LJ001-0001.wav"))
    ap.add_argument("--ffmpeg", default="ffmpeg")
    a = ap.parse_args()
    if not os.path.exists(a.wav):
        raise SystemExit(f"Suara sumber tidak ada: {a.wav}. Jalankan python3 analyzer/evaluation/fetch_data.py")
    os.makedirs(a.out, exist_ok=True)
    for name, (gap, speed, amp) in CLIPS.items():
        build_clip(os.path.join(a.out, name), a.wav, gap, speed, amp, a.ffmpeg)
        print("ok", os.path.join(a.out, name))


if __name__ == "__main__":
    main()
