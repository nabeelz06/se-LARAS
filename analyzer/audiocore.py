"""Ukuran deskriptif dari suara: jeda, tempo ucap (perkiraan), rentang tinggi-rendah suara, rentang nada.

Tidak ada skor mutu. Rekaman buruk menghasilkan peringatan, bukan angka yang dibuat-buat.
"""
import os
import subprocess
import tempfile

import numpy as np

import vad as vadmod

SR = 16000
MIN_PAUSE_S = 0.25
LONG_PAUSE_S = 0.8
# Di bawah perkiraan SNR ini jeda mulai meleset pada uji sisipan (evaluasi: 'jeda', derau 10 dB dan 5 dB).
NOISY_SNR_DB = 10.0

_VAD = None


def get_vad():
    global _VAD
    if _VAD is None:
        _VAD = vadmod.SileroVAD()
    return _VAD


def load_audio(path, max_seconds):
    """Dekode ke mono 16 kHz lewat ffmpeg. Mengembalikan (y, None) atau (None, kode_peringatan)."""
    with tempfile.TemporaryDirectory() as td:
        wav = os.path.join(td, "a.wav")
        r = subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-t", str(max_seconds), "-vn", "-ac", "1", "-ar", str(SR), wav],
                           capture_output=True)
        if r.returncode != 0 or not os.path.exists(wav) or os.path.getsize(wav) < 1000:
            return None, "tanpa_audio"
        import soundfile as sf
        y, sr = sf.read(wav, dtype="float32")
    if y.ndim > 1:
        y = y.mean(axis=1)
    return np.ascontiguousarray(y), None


# Id mesin ucapan. Versi model TIDAK ditulis di sini: asal, versi, dan checksum ada di models/MODELS.json (dijaga tes).
VAD_ENGINE = "silero-vad"


def speech_segments(y, vad_params=None, use_vad=True):
    """Segmen ujaran [mulai, akhir]. Bila model VAD gagal dimuat, jatuh ke pemisah energi dan mengembalikan engine='energi'."""
    if use_vad:
        try:
            pr = get_vad().probs(y)
            return vadmod.segments(pr, total_s=len(y) / SR, **(vad_params or {})), VAD_ENGINE
        except Exception:  # noqa: BLE001 - model hilang atau onnxruntime tak ada
            pass
    return vadmod.energy_segments(y), "energi"


def pauses_from(segs, min_pause=MIN_PAUSE_S):
    """Jeda = celah antar-segmen ujaran sepanjang >= min_pause (tepi awal dan akhir klip tidak dihitung)."""
    out = []
    for i in range(len(segs) - 1):
        g = segs[i + 1][0] - segs[i][1]
        if g >= min_pause:
            out.append((segs[i][1], g))
    return out


def snr_estimate(y, segs, min_each_s=1.0):
    """Perkiraan SNR (dB): daya bingkai ujaran dikurangi daya latar, dibanding daya latar (bingkai di luar ujaran).
    None bila tak ada cukup latar (ujaran tanpa jeda) atau ujaran. Perkiraan kasar; ketelitiannya diukur di evaluate.py (bagian snr)."""
    mask = np.zeros(len(y), dtype=bool)
    for s, e in segs:
        mask[int(s * SR): int(e * SR)] = True
    sp, ns = y[mask], y[~mask]
    if len(sp) < min_each_s * SR or len(ns) < min_each_s * SR:
        return None
    ps, pn = float(np.mean(sp ** 2)), float(np.mean(ns ** 2))
    if pn < 1e-12:
        return 60.0
    return float(min(60.0, 10 * np.log10(max(ps - pn, 1e-12) / pn)))


def pitch_range(y, segs):
    """Rentang nada 10–90 persentil (semitone) pada bingkai bersuara di dalam ujaran. Perkiraan; iringan ramai mengganggu."""
    import librosa
    y8 = librosa.resample(y, orig_sr=SR, target_sr=8000)
    hop = 160
    f0, voiced, _ = librosa.pyin(y8, fmin=65, fmax=500, sr=8000, frame_length=512, hop_length=hop, n_thresholds=50, resolution=0.2)
    t = np.arange(len(f0)) * hop / 8000.0
    in_sp = np.zeros(len(t), dtype=bool)
    for s, e in segs:
        in_sp |= (t >= s) & (t <= e)
    ok = voiced & in_sp & np.isfinite(f0)
    if ok.sum() < 40:
        return None, int(ok.sum())
    st = 12.0 * np.log2(f0[ok] / 55.0)
    return float(np.percentile(st, 90) - np.percentile(st, 10)), int(ok.sum())


def audio_metrics(path, max_seconds, vad_params=None, with_pitch=True):
    """Kembalikan (metrics, warnings, segs, y). metrics None bila audio tak memadai."""
    import librosa
    y, w = load_audio(path, max_seconds)
    if y is None:
        return None, [w], [], None
    dur = len(y) / SR
    if dur < 1.0:
        return None, ["audio_terlalu_pendek"], [], y
    if float(np.max(np.abs(y))) < 1e-4:
        return None, ["audio_senyap"], [], y
    segs, engine = speech_segments(y, vad_params)
    warnings = []
    if engine != VAD_ENGINE:
        warnings.append("vad_cadangan_energi")
    if not segs:
        return None, warnings + ["tidak_ada_ujaran_terdeteksi"], [], y
    voiced = sum(e - s for s, e in segs)
    span = segs[-1][1] - segs[0][0]
    pauses = pauses_from(segs)
    pdur = [d for _, d in pauses]
    hop = 256
    onsets = librosa.onset.onset_detect(y=y, sr=SR, hop_length=hop, units="time", backtrack=False)
    in_speech = [t for t in onsets if any(s - 0.02 <= t <= e for s, e in segs)]
    rms = librosa.feature.rms(y=y, frame_length=1024, hop_length=hop)[0]
    db = 20 * np.log10(np.maximum(rms, 1e-6))
    mask = np.zeros_like(db, dtype=bool)
    for s, e in segs:
        mask[int(s * SR / hop): int(e * SR / hop) + 1] = True
    dyn = float(np.percentile(db[mask], 95) - np.percentile(db[mask], 10)) if mask.sum() > 10 else None
    snr = snr_estimate(y, segs)
    m = {
        "duration_s": round(dur, 2),
        "engine": engine,
        "snr_est_db": round(snr, 1) if snr is not None else None,
        "span_s": round(span, 2),
        "speech_ratio": round(voiced / span, 3) if span > 0 else None,
        "pause_count": len(pdur),
        "pause_mean_s": round(float(np.mean(pdur)), 3) if pdur else 0.0,
        "pause_max_s": round(float(np.max(pdur)), 3) if pdur else 0.0,
        "long_pauses_per_min": round(sum(1 for p in pdur if p >= LONG_PAUSE_S) / (span / 60.0), 2) if span >= 5 else None,
        "onset_rate_per_s": round(len(in_speech) / voiced, 3) if voiced > 1 else None,
        "dynamic_range_db": round(dyn, 1) if dyn is not None else None,
        "speech_segments": [[round(float(s), 2), round(float(e), 2)] for s, e in segs],
        "speech_onsets_s": [round(float(s[0]), 2) for s in segs],
        "pauses": [[round(float(a), 2), round(float(d), 2)] for a, d in pauses],
    }
    if with_pitch:
        try:
            pr, nv = pitch_range(y, segs)
        except Exception:  # noqa: BLE001
            pr, nv = None, 0
        m["pitch_range_st"] = round(pr, 1) if pr is not None else None
        m["voiced_frames"] = nv
        if pr is None:
            warnings.append("nada_tak_cukup")
    if snr is not None and snr < NOISY_SNR_DB:
        warnings.append("derau_tinggi")
    if dur < 5:
        warnings.append("klip_pendek")
    if m["speech_ratio"] is not None and m["speech_ratio"] < 0.15:
        warnings.append("ujaran_sedikit")
    return m, warnings, segs, y
