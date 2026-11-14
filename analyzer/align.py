"""Penyejajaran waktu klip pelajar terhadap klip acuan maestro dengan Dynamic Time Warping (DTW) pada MFCC.

Keluaran: rasio tempo global (kemiringan jalur penyejajaran di bagian dalam klip; >1 = pelajar lebih lambat),
rasio durasi ujaran awal-akhir (`span_ratio`, hanya pembanding), variasi tempo lokal, dan jalur penyejajaran yang
dipakai antarmuka untuk menyinkronkan "bayangan maestro" pada klip pelajar.
Catatan yang diakui: penyejajaran paling bermakna bila isi/naskah kedua klip sama. Untuk isi berbeda,
jalur tetap terbentuk tetapi tidak bermakna; `kemiripan` (biaya rata-rata) dipakai sebagai penanda.
"""
import numpy as np

SR = 16000
# Ambang biaya rata-rata (jarak kosinus per langkah) di atas mana penyejajaran dianggap tidak andal.
# Ditentukan dari evaluasi: isi sama (peregangan waktu) vs isi berbeda (lihat docs/EVALUASI.md).
COST_RELIABLE_MAX = 0.58  # sama dengan 'ambang_biaya_dipilih_dari_latih' di evaluation/results.json (diuji oleh test_calibration)
# Klip yang lebih pendek dari ini (lama ujaran awal-akhir) tidak disejajarkan: rasio tempo pada klip ~2 detik terbukti meleset
# sampai 30-45% pada uji (evaluasi dtw), dan klip pendek juga memberi peringatan klip_pendek.
MIN_SPAN_S = 4.0
# Rasio tempo diambil dari kemiringan jalur di BAGIAN DALAM klip, bukan dari rasio durasi awal-akhir ujaran. Alasannya: titik
# awal/akhir ujaran berasal dari VAD, dan satu segmen liar atau hilang di tepi (batuk, napas, ujung terpotong) menggeser rasio
# durasi sampai ~17% pada evaluasi (klip latih sample.wav[0-12s]) sambil tetap berbiaya rendah ("andal"). Jalur di bagian dalam
# tidak terpengaruh tepi. Lebar tepi yang dibuang dipilih pada himpunan LATIH saja (docs/EVALUASI.md): 0, 10, 15, 20, 25%
# dari rentang jalur dicoba; 15% memberi galat maksimum terkecil pada kasus andal.
TEMPO_EDGE_FRAC = 0.15
TEMPO_EDGE_MIN_S = 0.5


def mfcc_feats(y, hop):
    import librosa
    mf = librosa.feature.mfcc(y=y, sr=SR, n_mfcc=14, n_fft=1024, hop_length=hop, n_mels=40, fmin=60, fmax=7600)[1:13]
    return (mf - mf.mean(axis=1, keepdims=True)) / (mf.std(axis=1, keepdims=True) + 1e-6)


def _trim(y, segs, pad=0.25):
    s = max(0.0, segs[0][0] - pad)
    e = min(len(y) / SR, segs[-1][1] + pad)
    return y[int(s * SR): int(e * SR)], s, e


def interior_slope(tr, ta, edge_frac=None):
    """Kemiringan ta(tr) dengan regresi linear pada bagian dalam jalur (tepi dibuang). None bila jalur terlalu pendek."""
    lo, hi = float(tr[0]), float(tr[-1])
    m = max(TEMPO_EDGE_MIN_S, (TEMPO_EDGE_FRAC if edge_frac is None else edge_frac) * (hi - lo))
    if hi - lo < 2 * m + 1.0:
        return None
    grid = np.linspace(lo + m, hi - m, 60)
    return float(np.polyfit(grid, np.interp(grid, tr, ta), 1)[0])


def align(y_ref, segs_ref, y_att, segs_att, max_points=120, keep_full_path=False):
    """Kembalikan dict penyejajaran atau (None, kode_peringatan). `keep_full_path` menambahkan jalur beresolusi penuh (`_tr`, `_ta`,
    array numpy, bukan JSON) hanya untuk evaluasi."""
    import librosa
    if not segs_ref or not segs_att:
        return None, "tanpa_ujaran_untuk_sejajar"
    ref, r0, r1 = _trim(y_ref, segs_ref)
    att, a0, a1 = _trim(y_att, segs_att)
    span_ref = segs_ref[-1][1] - segs_ref[0][0]
    span_att = segs_att[-1][1] - segs_att[0][0]
    if span_ref < MIN_SPAN_S or span_att < MIN_SPAN_S:
        return None, "klip_terlalu_pendek_untuk_sejajar"
    longest = max(len(ref), len(att)) / SR
    hop = 512 if longest <= 90 else 1024
    fr, fa = mfcc_feats(ref, hop), mfcc_feats(att, hop)
    D, wp = librosa.sequence.dtw(X=fr, Y=fa, metric="cosine")
    wp = wp[::-1]
    cost = float(D[-1, -1] / len(wp))
    tr = r0 + wp[:, 0] * hop / SR
    ta = a0 + wp[:, 1] * hop / SR
    # tempo global: kemiringan jalur di bagian dalam; rasio durasi awal-akhir ujaran hanya dicatat sebagai pembanding
    span_ratio = span_att / span_ref if span_ref > 0 else None
    ratio = interior_slope(tr, ta)
    if ratio is None:
        ratio = span_ratio
    # tempo lokal: kemiringan ta(tr) per jendela 2 detik pada sumbu acuan
    grid = np.arange(tr[0], tr[-1] - 2.0, 1.0)
    local = []
    if len(grid) >= 3:
        ta_i = np.interp(np.concatenate([grid, grid + 2.0]), tr, ta)
        local = (ta_i[len(grid):] - ta_i[:len(grid)]) / 2.0
    idx = np.unique(np.linspace(0, len(wp) - 1, min(max_points, len(wp))).astype(int))
    out = {
        "tempo_ratio": round(float(ratio), 3) if ratio else None,
        "span_ratio": round(float(span_ratio), 3) if span_ratio else None,
        "local_tempo_min": round(float(np.min(local)), 2) if len(local) else None,
        "local_tempo_max": round(float(np.max(local)), 2) if len(local) else None,
        "local_tempo_std": round(float(np.std(local)), 3) if len(local) else None,
        "cost": round(cost, 3),
        "reliable": bool(cost <= COST_RELIABLE_MAX),
        "hop_s": round(hop / SR, 3),
        "path": [[round(float(tr[i]), 2), round(float(ta[i]), 2)] for i in idx],
    }
    if keep_full_path:
        out["_tr"], out["_ta"] = tr, ta
    return out, None
