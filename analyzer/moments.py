"""Usulan "momen" otomatis pada klip maestro: awal jeda panjang dan puncak gerak tangan.

Ini hanya USULAN berstatus draf. Maestro yang memilih mana yang bermakna, menamainya dengan kata sendiri
dan menjelaskan "kenapa" (pengetahuan yang tersirat dibuat tersurat). Pemain tidak melihat momen yang belum disahkan.
"""
import numpy as np

LONG_PAUSE_S = 0.8


def propose(pauses, speeds, max_pauses=10, max_peaks=8, min_gap_s=1.5):
    """pauses: [[mulai, lama],...]; speeds: [(t, kecepatan),...]. Mengembalikan daftar momen terurut waktu."""
    out = []
    long_p = sorted([p for p in pauses if p[1] >= LONG_PAUSE_S], key=lambda p: -p[1])[:max_pauses]
    for start, dur in long_p:
        out.append({"t": round(float(start), 2), "kind": "jeda", "dur": round(float(dur), 2), "strength": None})
    if speeds is not None and len(speeds) >= 8:
        from scipy.signal import find_peaks
        tt = np.array([t for t, _ in speeds], dtype=float)
        sv = np.array([s for _, s in speeds], dtype=float)
        k = np.ones(3) / 3.0
        sm = np.convolve(sv, k, mode="same")
        dt = float(np.median(np.diff(tt))) if len(tt) > 1 else 0.2
        pk, _ = find_peaks(sm, height=float(np.percentile(sm, 75)), distance=max(1, int(min_gap_s / max(dt, 1e-3))))
        order = sorted(pk, key=lambda i: -sm[i])[:max_peaks]
        top = float(sm.max()) or 1.0
        for i in order:
            out.append({"t": round(float(tt[i]), 2), "kind": "gerak", "dur": None, "strength": round(float(sm[i] / top), 2)})
    out.sort(key=lambda m: m["t"])
    return out
