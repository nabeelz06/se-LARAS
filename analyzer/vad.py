"""Deteksi ujaran dengan Silero VAD (rilis v6.2; ONNX, lisensi MIT; asal dan checksum di models/MODELS.json).

Model memproses potongan 512 sampel (32 md) pada 16 kHz dengan konteks 64 sampel dan keadaan rekuren.
Keluarannya satu peluang ujaran per potongan. Segmentasi memakai ambang berhisteresis; nilai
bawaan di bawah ditentukan lewat evaluasi (analyzer/evaluate.py, hasil di docs/EVALUASI.md).
"""
import os

import numpy as np

MODEL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "models", "silero_vad.onnx")
SR = 16000
WIN = 512
CTX = 64
FRAME_S = WIN / SR

# Setelan resmi Silero (acuan pembanding di evaluasi).
SILERO_RESMI = {"threshold": 0.5, "neg_margin": 0.15, "min_speech_ms": 250, "min_silence_ms": 100, "pad_ms": 30}

# Nilai bawaan se-LARAS = hasil penalaan pada himpunan LATIH evaluasi (python3 evaluate.py pause). Test unit
# memastikan nilai ini sama dengan evaluation/results.json, jadi tidak bisa diam-diam menyimpang dari bukti.
# Sinyal dinormalisasi tingkatnya sebelum VAD (level_normalize); tanpa itu ambang 0,8 membuat ujaran sangat pelan hilang.
DEFAULTS = {"threshold": 0.8, "neg_margin": 0.15, "min_speech_ms": 250, "min_silence_ms": 100, "pad_ms": 15}


def level_normalize(y, target_peak=0.5, max_gain_db=40.0):
    """Skala sinyal agar persentil ke-99,5 dari |y| mencapai target_peak. Penguatan dibatasi (+40 dB) agar rekaman yang
    nyaris hening tidak diubah menjadi desis keras. Persentil (bukan puncak mutlak) agar satu letupan tak menentukan skala."""
    y = np.asarray(y, dtype=np.float32)
    if y.size == 0:
        return y
    p = float(np.percentile(np.abs(y), 99.5))
    g = min(target_peak / max(p, 1e-5), 10 ** (max_gain_db / 20.0))
    return (y * g).astype(np.float32)


class SileroVAD:
    def __init__(self, model_path=MODEL):
        import onnxruntime as ort
        so = ort.SessionOptions()
        so.inter_op_num_threads = 1
        so.intra_op_num_threads = 1
        self.sess = ort.InferenceSession(model_path, sess_options=so, providers=["CPUExecutionProvider"])
        self.sr = np.array(SR, dtype=np.int64)

    def probs(self, y, normalize=True):
        """y: float32 mono 16 kHz. Mengembalikan peluang ujaran per 32 md.

        normalize=True menyamakan tingkat sinyal dulu (lihat level_normalize) supaya hasil tak bergantung pada
        seberapa pelan rekaman; evaluasi di docs/EVALUASI.md mengukur pengaruhnya.
        """
        y = np.asarray(y, dtype=np.float32)
        if normalize:
            y = level_normalize(y)
        pad = (-len(y)) % WIN
        if pad:
            y = np.concatenate([y, np.zeros(pad, dtype=np.float32)])
        state = np.zeros((2, 1, 128), dtype=np.float32)
        ctx = np.zeros((1, CTX), dtype=np.float32)
        out = np.empty(len(y) // WIN, dtype=np.float32)
        for k, i in enumerate(range(0, len(y), WIN)):
            x = np.concatenate([ctx, y[None, i:i + WIN]], axis=1)
            o, state = self.sess.run(None, {"input": x, "state": state, "sr": self.sr})
            ctx = x[:, -CTX:]
            out[k] = o[0, 0]
        return out


def segments(probs, total_s=None, threshold=None, neg_margin=None, min_speech_ms=None, min_silence_ms=None, pad_ms=None):
    """Ubah peluang menjadi daftar [mulai, akhir] detik. Histeresis: masuk di >= threshold, bertahan di >= threshold-neg_margin."""
    p = {**DEFAULTS}
    for k, v in (("threshold", threshold), ("neg_margin", neg_margin), ("min_speech_ms", min_speech_ms),
                 ("min_silence_ms", min_silence_ms), ("pad_ms", pad_ms)):
        if v is not None:
            p[k] = v
    neg = max(p["threshold"] - p["neg_margin"], 0.01)
    min_sil = p["min_silence_ms"] / 1000.0
    raw = []
    start = None
    last = None
    for i, pr in enumerate(probs):
        if start is None:
            if pr >= p["threshold"]:
                start, last = i, i
        else:
            if pr >= neg:
                last = i
            elif (i - last) * FRAME_S >= min_sil:
                raw.append((start, last + 1))
                start = None
    if start is not None:
        raw.append((start, last + 1))
    pad = p["pad_ms"] / 1000.0
    end_t = total_s if total_s is not None else len(probs) * FRAME_S
    segs = []
    for a, b in raw:
        s, e = a * FRAME_S, b * FRAME_S
        if e - s < p["min_speech_ms"] / 1000.0:
            continue
        s, e = max(0.0, s - pad), min(end_t, e + pad)
        if segs and s <= segs[-1][1]:
            segs[-1][1] = max(segs[-1][1], e)
        else:
            segs.append([s, e])
    return segs


def energy_segments(y, sr=SR, top_db=32, hop=256, merge_gap=0.15, min_len=0.08):
    """Pembanding sederhana (cara lama, v0.1): pemisah berbasis energi dari librosa. Dipakai pada evaluasi."""
    import librosa
    iv = librosa.effects.split(y, top_db=top_db, frame_length=1024, hop_length=hop)
    segs = []
    for a, b in iv:
        s, e = a / sr, b / sr
        if segs and s - segs[-1][1] < merge_gap:
            segs[-1][1] = e
        else:
            segs.append([s, e])
    return [s for s in segs if s[1] - s[0] >= min_len]
