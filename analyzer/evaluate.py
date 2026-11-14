#!/usr/bin/env python3
"""Evaluasi terukur mesin analisis se-LARAS pada data publik (bukan data Ludruk; datanya belum ada).

Yang diuji dan cara mengujinya:
  pause   : jeda yang DISISIPKAN dengan panjang diketahui pada rekaman bicara sungguhan, dengan derau putih dan
            merah muda pada beberapa SNR. Membandingkan Silero VAD (setelan bawaan dan hasil penalaan) dengan
            pemisah energi cara lama. Penalaan hanya memakai himpunan latih; angka yang dilaporkan dari himpunan uji.
  dtw     : rasio tempo dan jalur penyejajaran pada rekaman yang diregangkan waktunya (kebenaran diketahui) serta
            pemisahan isi-sama vs isi-berbeda untuk menetapkan ambang keandalan.
  vision  : deteksi orang pada gambar uji, kewajaran pose, lantai kebisingan ukuran gerak tangan (gambar diam
            dengan goyangan kamera 1–3 piksel), dan statistik jejak pada video pejalan kaki.
  tempo   : kecepatan (kali waktu nyata).
Hasil ditulis ke evaluation/results.json. Jalankan: python3 evaluate.py all [--quick]
"""
import argparse
import itertools
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402

import align as alignmod  # noqa: E402
import audiocore  # noqa: E402
import vad as vadmod  # noqa: E402
from evaluation.fetch_data import DATA, fetch  # noqa: E402

SR = 16000
OUT = os.path.join(HERE, "evaluation", "results.json")
SET_A = ["jfk.wav", "LJ001-0001.wav"]            # himpunan latih penalaan
SET_B = ["sample.wav", "silero_test.wav"]         # himpunan uji (penutur dan rekaman berbeda dari A)
LENGTHS = [0.3, 0.5, 0.8, 1.2, 2.0]
SNRS = [None, 20, 10, 5]
NOISES = ["putih", "merah_muda"]


def load(name, max_s=None):
    import librosa
    y, _ = librosa.load(os.path.join(DATA, name), sr=SR, mono=True)
    return np.ascontiguousarray(y[: int(max_s * SR)] if max_s else y, dtype=np.float32)


def noise_like(n, kind, rng):
    w = rng.standard_normal(n).astype(np.float32)
    if kind == "putih":
        return w
    spec = np.fft.rfft(w)
    f = np.fft.rfftfreq(n)
    f[0] = f[1]
    pink = np.fft.irfft(spec / np.sqrt(f * n), n).astype(np.float32)
    return pink / (np.std(pink) + 1e-9)


def add_noise(y, snr_db, kind, rng, ref_rms):
    if snr_db is None:
        return y
    n = noise_like(len(y), kind, rng)
    return (y + n * (ref_rms / (10 ** (snr_db / 20.0)))).astype(np.float32)


def speech_rms(y, segs):
    parts = [y[int(s * SR): int(e * SR)] for s, e in segs]
    z = np.concatenate(parts) if parts else y
    return float(np.sqrt(np.mean(z ** 2)) + 1e-9)


def insert_silences(y, segs, rng, n_ins):
    """Sisipkan keheningan digital pada titik di dalam ujaran (>=0,5 dtk dari tepi segmen). Mengembalikan (y2, gt, peta_waktu)."""
    cand = []
    for a, b in segs:
        if b - a > 1.4:
            for t in rng.uniform(a + 0.5, b - 0.5, size=max(1, int((b - a) // 2.5))):
                cand.append(float(t))
    rng.shuffle(cand)
    chosen = []
    for t in cand:
        if all(abs(t - c) >= 3.0 for c in chosen):
            chosen.append(t)
        if len(chosen) >= n_ins:
            break
    chosen.sort()
    out, gt, prev, shift = [], [], 0, 0.0
    for t in chosen:
        L = float(rng.choice(LENGTHS))
        i = int(t * SR)
        out += [y[prev:i], np.zeros(int(L * SR), dtype=np.float32)]
        gt.append((t + shift, L))
        shift += L
        prev = i
    out.append(y[prev:])
    ins = [(t, L) for t, (_, L) in zip(chosen, gt)]

    def remap(t):
        return t + sum(L for ti, L in ins if ti < t)

    return np.concatenate(out), gt, remap


def score(segs, gt, natural):
    pauses = audiocore.pauses_from(segs)
    tp, errs, used, per_len = 0, [], set(), {}
    for t, L in gt:
        best = None
        for k, (ps, pd) in enumerate(pauses):
            if k in used:
                continue
            ov = min(ps + pd, t + L) - max(ps, t)
            if ov >= 0.5 * L and (best is None or ov > best[0]):
                best = (ov, k, pd)
        cur = per_len.setdefault(round(L, 1), [0, 0])
        cur[1] += 1
        if best:
            used.add(best[1])
            tp += 1
            errs.append(abs(best[2] - L))
            cur[0] += 1
    extra = 0
    for k, (ps, pd) in enumerate(pauses):
        if k in used:
            continue
        if any(min(ps + pd, nt + nd) - max(ps, nt) > 0 for nt, nd in natural):
            continue
        extra += 1
    return tp, len(gt), errs, extra, per_len


def build_cases(names, seeds, vad):
    """Daftar kasus: tiap kasus punya sinyal ber-derau, kebenaran, jeda alami (peta), dan peluang VAD (dihitung sekali)."""
    cases = []
    for name in names:
        y0 = load(name)
        probs0 = vad.probs(y0)
        segs0 = vadmod.segments(probs0, len(y0) / SR, **vadmod.SILERO_RESMI)  # fixed: cases must not depend on the tuned defaults
        rms0 = speech_rms(y0, segs0)
        n_ins = max(2, int(len(y0) / SR // 6))
        for seed in seeds:
            rng = np.random.default_rng(1000 + seed)
            y1, gt, remap = insert_silences(y0, segs0, rng, n_ins)
            for kind in NOISES:
                for snr in SNRS:
                    if snr is None and kind != NOISES[0]:
                        continue
                    y2 = add_noise(y1, snr, kind, np.random.default_rng(seed * 7 + 1), rms0)
                    cases.append({"clip": name, "seed": seed, "noise": "tanpa" if snr is None else kind, "snr": snr, "y": y2, "gt": gt, "remap": remap,
                                  "dur": len(y2) / SR, "probs": vad.probs(y2), "clean_probs": probs0, "clean_y": y0})
    return cases


def natural_pauses(case, segfn):
    """Jeda alami pada klip bersih menurut mesin yang sama, dipetakan ke garis waktu klip yang disisipi."""
    return [(case["remap"](ps), pd) for ps, pd in audiocore.pauses_from(segfn(case["clean_y"], case["clean_probs"]))]


def eval_engine(cases, segfn):
    agg = {}
    for c in cases:
        segs = segfn(c["y"], c["probs"])
        nat = natural_pauses(c, segfn)
        tp, n, errs, extra, per_len = score(segs, c["gt"], nat)
        key = (c["noise"], c["snr"])
        a = agg.setdefault(key, {"tp": 0, "n": 0, "errs": [], "extra": 0, "min": 0.0, "len": {}})
        a["tp"] += tp
        a["n"] += n
        a["errs"] += errs
        a["extra"] += extra
        a["min"] += c["dur"] / 60.0
        for L, (h, m) in per_len.items():
            cur = a["len"].setdefault(L, [0, 0])
            cur[0] += h
            cur[1] += m
    rows = []
    for (noise, snr), a in sorted(agg.items(), key=lambda kv: (kv[0][0], -1 if kv[0][1] is None else -kv[0][1])):
        rows.append({"derau": noise, "snr_db": snr, "recall": round(a["tp"] / max(a["n"], 1), 3), "n_sisipan": a["n"],
                     "recall_per_panjang": {str(L): round(h / max(m, 1), 2) for L, (h, m) in sorted(a["len"].items())},
                     "galat_lama_detik": round(float(np.mean(a["errs"])), 3) if a["errs"] else None,
                     "jeda_ekstra_per_menit": round(a["extra"] / max(a["min"], 1e-9), 2)})
    return rows


def objective(rows):
    rec = np.mean([r["recall"] for r in rows])
    ext = np.mean([r["jeda_ekstra_per_menit"] for r in rows])
    return float(rec - 0.1 * ext), float(rec), float(ext)


def _frames(segs, n):
    f = np.zeros(n, dtype=bool)
    for s, e in segs:
        f[int(s / vadmod.FRAME_S): int(np.ceil(e / vadmod.FRAME_S))] = True
    return f


def low_level_sensitivity(vad, tuned):
    """Persentase bingkai ujaran (acuan: setelan resmi Silero pada klip asli, tanpa normalisasi) yang tetap terdeteksi saat
    volume diturunkan secara digital, per ambang, dengan dan tanpa normalisasi tingkat. Juga mencatat tingkat ujaran
    absolut tiap klip (dBFS) agar 'gain' bisa dibaca sebagai tingkat rekaman. Yang diuji hanya penurunan gain (bukan SNR rendah)."""
    ths = [0.5, 0.6, 0.7, 0.8]
    gains = [0, -10, -20, -30, -40]
    names = ["jfk.wav", "LJ001-0001.wav", "sample.wav", "silero_test.wav"]
    variants = {"dengan_normalisasi": True, "tanpa_normalisasi": False}
    acc = {v: {th: {g: [] for g in gains} for th in ths} for v in variants}
    fa = {v: {th: {g: [] for g in gains} for th in ths} for v in variants}
    per_clip = {v: [] for v in variants}
    levels = {}
    for name in names:
        y = load(name, 45)
        p0 = vad.probs(y, normalize=False)
        ref_segs = vadmod.segments(p0, len(y) / SR, **vadmod.SILERO_RESMI)
        ref = _frames(ref_segs, len(p0))
        levels[name] = round(20 * np.log10(speech_rms(y, ref_segs)), 1)
        for g in gains:
            ys = (y * 10 ** (g / 20)).astype(np.float32)
            for vname, flag in variants.items():
                pr = vad.probs(ys, normalize=flag)
                for th in ths:
                    pred = _frames(vadmod.segments(pr, len(y) / SR, **{**tuned, "threshold": th}), len(pr))
                    r = float((pred & ref).sum() / max(ref.sum(), 1))
                    acc[vname][th][g].append(r)
                    fa[vname][th][g].append(float((pred & ~ref).sum() / max((~ref).sum(), 1)))
                    if th == tuned["threshold"]:
                        per_clip[vname].append({"klip": name, "gain_db": g, "tingkat_ujaran_dbfs": round(levels[name] + g, 1), "recall": round(r, 2)})
    return {
        "klip": names, "tingkat_ujaran_klip_dbfs": levels,
        "acuan": "setelan resmi Silero pada klip tanpa pelemahan dan tanpa normalisasi",
        "recall_bingkai_ujaran_rata2": {v: {str(th): {str(g): round(float(np.mean(acc[v][th][g])), 2) for g in gains} for th in ths} for v in variants},
        "alarm_palsu_bingkai_rata2": {v: {str(th): {str(g): round(float(np.mean(fa[v][th][g])), 3) for g in gains} for th in ths} for v in variants},
        "per_klip_setelan_bawaan": per_clip,
    }


VOICES = [0.85, 1.2]          # pengubahan warna suara (resampling) untuk menguji ketahanan VAD pada suara lain
VOICE_MIN_RECALL = 0.95        # batas keterimaan penalaan: rata-rata recall bingkai ujaran pada suara diubah (himpunan latih)


def build_voice_cases(names, vad):
    cases = []
    for name in names:
        y = load(name, 45)
        p0 = vad.probs(y)
        for r in VOICES:
            yv = voice_shift(y, r)[: len(y)]
            pr = vad.probs(yv)
            ref = _frames(vadmod.segments(p0[: len(pr)], len(yv) / SR, **vadmod.SILERO_RESMI), len(pr))
            cases.append({"klip": name, "r": r, "probs": pr, "ref": ref, "dur": len(yv) / SR})
    return cases


def voice_recall(cases, params):
    vals = []
    for c in cases:
        pred = _frames(vadmod.segments(c["probs"], c["dur"], **params), len(c["probs"]))
        vals.append(float((pred & c["ref"]).sum() / max(c["ref"].sum(), 1)))
    return float(np.mean(vals)), float(np.min(vals))


def run_pause(quick=False):
    t0 = time.time()
    vad = audiocore.get_vad()
    seeds_a = range(2 if quick else 4)
    seeds_b = range(2 if quick else 4)
    A = build_cases(SET_A, seeds_a, vad)
    B = build_cases(SET_B, seeds_b, vad)

    def silero(params):
        return lambda y, probs: vadmod.segments(probs, len(y) / SR, **params)

    def energi(y, probs):
        return vadmod.energy_segments(y)

    # min_silence_ms dibatasi <= 250 (= MIN_PAUSE_S) agar tidak membuang jeda sah 0,25-0,35 detik secara diam-diam
    grid = {"threshold": [0.5, 0.6, 0.7, 0.8], "neg_margin": [0.05, 0.1, 0.15, 0.2], "min_silence_ms": [100, 150, 200, 250],
            "pad_ms": [0, 15, 30], "min_speech_ms": [100, 150, 250]}
    keys = list(grid)
    tried = 0
    scored = []
    if quick:
        grid = {"threshold": [0.4, 0.5, 0.6], "neg_margin": [0.15, 0.25], "min_silence_ms": [100, 150], "pad_ms": [30], "min_speech_ms": [150]}
        keys = list(grid)
    VA = build_voice_cases(SET_A, vad)
    VB = build_voice_cases(SET_B, vad)
    for combo in itertools.product(*[grid[k] for k in keys]):
        params = dict(zip(keys, combo))
        rows = eval_engine(A, silero(params))
        j, rec, ext = objective(rows)
        vm, _ = voice_recall(VA, params)
        tried += 1
        scored.append((j, params, rec, ext, vm))
    # Tahap 1 (tujuan awal) hanya melihat jeda sisipan. Setelah ditemukan bahwa ambang 0,8 kehilangan ujaran pada suara yang
    # diubah, ditambahkan syarat keterimaan: recall bingkai ujaran pada suara diubah >= VOICE_MIN_RECALL (himpunan latih).
    # Ini keputusan sesudah melihat data, dan dicatat apa adanya.
    admissible = [s_ for s_ in scored if s_[4] >= VOICE_MIN_RECALL] or scored
    anchor = {"threshold": (0.5, 0.1), "neg_margin": (0.15, 0.05), "min_silence_ms": (100, 50), "pad_ms": (30, 15), "min_speech_ms": (250, 50)}
    top = max(s_[0] for s_ in admissible)
    near = [s_ for s_ in admissible if s_[0] >= top - 0.01]
    dist = lambda p: sum(abs(p[k] - anchor[k][0]) / anchor[k][1] for k in anchor)  # noqa: E731
    best = min(near, key=lambda s_: dist(s_[1]))
    tuned = best[1]
    top_unconstrained = max(s_[0] for s_ in scored)
    # Tabel kompromi: pilihan terbaik per ambang (tanpa syarat) dengan hasil uji-tahan dan ketahanan suara
    tradeoff = []
    for th in sorted({s_[1]["threshold"] for s_ in scored}):
        c = max((s_ for s_ in scored if s_[1]["threshold"] == th), key=lambda s_: s_[0])
        rows_b = eval_engine(B, silero(c[1]))
        _, rec_b, ext_b = objective(rows_b)
        vm_a, vmin_a = voice_recall(VA, c[1])
        vm_b, vmin_b = voice_recall(VB, c[1])
        tradeoff.append({"threshold": th, "setelan": c[1], "tujuan_latih": round(c[0], 3), "uji_recall_jeda": round(rec_b, 3),
                         "uji_jeda_ekstra_per_menit": round(ext_b, 2), "suara_diubah_recall_latih": round(vm_a, 3),
                         "suara_diubah_recall_uji": round(vm_b, 3), "suara_diubah_recall_uji_min": round(vmin_b, 2)})
    res = {
        "klip_latih": SET_A, "klip_uji": SET_B, "panjang_sisipan_detik": LENGTHS, "kombinasi_dicoba": tried,
        "fungsi_tujuan": "recall rata-rata - 0,1 x jeda_ekstra_per_menit rata-rata (himpunan latih)",
        "setelan_hasil_penalaan": tuned, "setelan_bawaan_kode": vadmod.DEFAULTS, "setelan_resmi_silero": vadmod.SILERO_RESMI,
        "aturan_pemilihan": "dari kandidat yang recall bingkai ujaran pada suara-diubah >= %.2f (himpunan latih): tujuan terbaik; bila selisih <= 0,01 pilih yang terdekat dengan bawaan resmi Silero (0,5 / 0,15 / 250 md / 100 md / 30 md)" % VOICE_MIN_RECALL,
        "kandidat_setara": len(near), "tujuan_terbaik": round(top, 3), "tujuan_terbaik_tanpa_syarat": round(top_unconstrained, 3),
        "kompromi_per_ambang": tradeoff, "suara_diubah_rasio": VOICES, "syarat_recall_suara_diubah": VOICE_MIN_RECALL,
        "suara_diubah_recall_penalaan": {"latih": round(voice_recall(VA, tuned)[0], 3), "uji": round(voice_recall(VB, tuned)[0], 3), "uji_min": round(voice_recall(VB, tuned)[1], 2)},
        "latih_dengan_penalaan": eval_engine(A, silero(tuned)),
        "uji": {
            "silero_penalaan": eval_engine(B, silero(tuned)),
            "silero_resmi": eval_engine(B, silero(vadmod.SILERO_RESMI)),
            "energi_cara_lama": eval_engine(B, energi),
        },
        "kepekaan_ujaran_pelan": low_level_sensitivity(vad, tuned),
        "detik": round(time.time() - t0, 1),
    }
    for k in ("silero_penalaan", "silero_resmi", "energi_cara_lama"):
        j, rec, ext = objective(res["uji"][k])
        res["uji"][k + "_ringkas"] = {"recall_rata2": round(rec, 3), "jeda_ekstra_per_menit_rata2": round(ext, 2)}
    return res


def run_snr():
    """Ketelitian perkiraan SNR: klip bicara + derau pada SNR nominal (terhadap RMS ujaran klip bersih)."""
    vad = audiocore.get_vad()
    rows = []
    for name in SET_A + SET_B:
        y0 = load(name, 45)
        segs0 = vadmod.segments(vad.probs(y0), len(y0) / SR, **vadmod.SILERO_RESMI)
        rms0 = speech_rms(y0, segs0)
        for kind in NOISES:
            for snr in (None, 30, 20, 10, 5, 0):
                if snr is None and kind != NOISES[0]:
                    continue
                y = add_noise(y0, snr, kind, np.random.default_rng(11), rms0)
                segs = audiocore.speech_segments(y)[0]
                est = audiocore.snr_estimate(y, segs)
                rows.append({"klip": name, "derau": "tanpa" if snr is None else kind, "snr_nominal_db": snr,
                             "snr_perkiraan_db": None if est is None else round(est, 1)})
    d = [r["snr_perkiraan_db"] - r["snr_nominal_db"] for r in rows if r["snr_nominal_db"] is not None and r["snr_perkiraan_db"] is not None]
    return {"baris": rows, "galat_median_db": round(float(np.median(d)), 1), "galat_abs_p90_db": round(float(np.percentile(np.abs(d), 90)), 1),
            "catatan": "klip asli sudah punya derau sendiri, jadi SNR sebenarnya sedikit di bawah nominal pada SNR tinggi"}


def stretch(y, s):
    """Regangkan waktu dengan ffmpeg atempo (WSOLA; lebih alami untuk ucapan daripada phase vocoder). s>1 = lebih lambat."""
    import subprocess
    import tempfile
    import soundfile as sf
    with tempfile.TemporaryDirectory() as td:
        a, b = os.path.join(td, "a.wav"), os.path.join(td, "b.wav")
        sf.write(a, y, SR)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a, "-filter:a", f"atempo={1.0 / s:.5f}", b], check=True)
        z, _ = sf.read(b, dtype="float32")
    return np.ascontiguousarray(z)


def voice_shift(y, r):
    """Ubah warna suara tanpa mengubah isi dan durasi: asetrate mengubah tinggi nada DAN formant (mirip penutur lain), atempo memulihkan durasi.
    Pendekatan kasar untuk 'penutur berbeda' karena data paralel lintas-penutur tidak tersedia."""
    import subprocess
    import tempfile
    import soundfile as sf
    with tempfile.TemporaryDirectory() as td:
        a, b = os.path.join(td, "a.wav"), os.path.join(td, "b.wav")
        sf.write(a, y, SR)
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", a, "-filter:a", f"asetrate={SR * r:.2f},aresample={SR},atempo={1.0 / r:.5f}", b], check=True)
        z, _ = sf.read(b, dtype="float32")
    return np.ascontiguousarray(z)


def align_pair(yr, ya, full=False):
    sr_, sa_ = audiocore.speech_segments(yr)[0], audiocore.speech_segments(ya)[0]
    return alignmod.align(yr, sr_, ya, sa_, keep_full_path=full)[0], sr_, sa_


EDGE_SWEEP = [0.0, 0.05, 0.10, 0.15, 0.20, 0.25]   # lebar tepi jalur yang dibuang saat menaksir rasio tempo (fraksi rentang)


def run_dtw(quick=False):
    t0 = time.time()
    # Klip latih: jfk, LJ001-0001, sample.wav[0-12 dtk]; klip uji: tiga potongan 12 dtk dari silero_test.wav (rekaman dan penutur lain).
    # Klip pendek (< 4 dtk) tidak dipakai: penyejajar menolaknya (align.MIN_SPAN_S).
    ysamp, ysil = load("sample.wav"), load("silero_test.wav")
    clips_tr = {"jfk.wav": load("jfk.wav"), "LJ001-0001.wav": load("LJ001-0001.wav"), "sample.wav[0-12s]": ysamp[: 12 * SR]}
    clips_te = {"silero_test.wav[0-12s]": ysil[: 12 * SR], "silero_test.wav[24-36s]": ysil[24 * SR: 36 * SR], "silero_test.wav[48-60s]": ysil[48 * SR: 60 * SR]}
    factors = [0.8, 1.25] if quick else [0.8, 0.9, 1.1, 1.25, 1.5]
    voices = [None, 1.2] if quick else [None, 0.85, 1.2]
    rng = np.random.default_rng(5)

    def same_content(clips):
        rows = []
        for name, y in clips.items():
            segs_y = audiocore.speech_segments(y)[0]
            r_rms = speech_rms(y, segs_y)
            for s in factors:
              for vr in voices:
                yv = y if vr is None else voice_shift(y, vr)
                for noisy in ((False, True) if vr is None else (False,)):
                    ya = stretch(yv, s)
                    if noisy:
                        ya = add_noise(ya, 10, "putih", rng, r_rms)
                    out, _, _ = align_pair(y, ya, full=True)
                    if out is None:
                        continue
                    slopes = {str(f): alignmod.interior_slope(out["_tr"], out["_ta"], f) for f in EDGE_SWEEP}
                    path = np.array(out["path"])
                    m = (path[:, 0] > 0.5) & (path[:, 0] < path[:, 0].max() - 0.5)
                    perr = np.abs(path[m, 1] - s * path[m, 0]) if m.any() else np.array([np.nan])
                    rows.append({"klip": name, "regang": s, "suara_rasio": vr, "derau_10dB": noisy, "rasio_tempo": out["tempo_ratio"],
                                 "galat_rasio_persen": round(abs(out["tempo_ratio"] - s) / s * 100, 1),
                                 "galat_rasio_durasi_persen": round(abs(out["span_ratio"] - s) / s * 100, 1),
                                 "galat_rasio_per_tepi_persen": {f: (None if v is None else round(abs(v - s) / s * 100, 2)) for f, v in slopes.items()},
                                 "galat_jalur_median_detik": round(float(np.nanmedian(perr)), 2),
                                 "galat_jalur_p90_detik": round(float(np.nanpercentile(perr, 90)), 2), "biaya": out["cost"]})
        return rows

    def different_content(clips):
        rows = []
        names = list(clips)
        for a, b in itertools.permutations(names, 2):
            ya, yb = clips[a], clips[b]
            out, _, _ = align_pair(ya, yb)
            if out:
                rows.append({"acuan": a, "pelajar": b, "biaya": out["cost"]})
        return rows

    same_tr, diff_tr = same_content(clips_tr), different_content(clips_tr)
    same_te, diff_te = same_content(clips_te), different_content(clips_te)
    cs, cd = np.array([r["biaya"] for r in same_tr]), np.array([r["biaya"] for r in diff_tr])
    best = (0.0, None)
    for thr in np.linspace(min(cs.min(), cd.min()), max(cs.max(), cd.max()), 200):
        bal = 0.5 * (np.mean(cs <= thr) + np.mean(cd > thr))
        if bal > best[0]:
            best = (bal, float(thr))
    thr = round(best[1], 2)
    cs_te, cd_te = np.array([r["biaya"] for r in same_te]), np.array([r["biaya"] for r in diff_te])

    def summ(rows, k):
        v = [r[k] for r in rows]
        return {"median": round(float(np.median(v)), 3), "p90": round(float(np.percentile(v, 90)), 3), "maks": round(float(np.max(v)), 3)}

    def cost_summary(rows):
        v = np.array([r["biaya"] for r in rows])
        return {"n": len(rows), "biaya": {"min": round(float(v.min()), 3), "median": round(float(np.median(v)), 3), "maks": round(float(v.max()), 3)},
                "galat_rasio_persen": summ(rows, "galat_rasio_persen")}

    def edge_sweep(rows):
        out_ = {}
        for f in EDGE_SWEEP:
            v = [r["galat_rasio_per_tepi_persen"][str(f)] for r in rows if r["biaya"] <= thr and r["galat_rasio_per_tepi_persen"][str(f)] is not None]
            out_[str(f)] = {"n": len(v), "median": round(float(np.median(v)), 2), "p90": round(float(np.percentile(v, 90)), 2), "maks": round(float(np.max(v)), 2)}
        return out_

    sweep_tr, sweep_te = edge_sweep(same_tr), edge_sweep(same_te)
    best_edge = min(EDGE_SWEEP, key=lambda f: (sweep_tr[str(f)]["maks"], sweep_tr[str(f)]["p90"]))
    voice_tr = [r for r in same_tr if r["suara_rasio"] is not None]
    voice_te = [r for r in same_te if r["suara_rasio"] is not None]
    plain_tr = [r for r in same_tr if r["suara_rasio"] is None]
    plain_te = [r for r in same_te if r["suara_rasio"] is None]
    return {
        "regangan": factors, "rasio_warna_suara": [v for v in voices if v],
        "catatan": "isi-sama = klip yang sama diregangkan waktunya (+derau 10 dB, atau warna suara diubah lewat resampling); BUKAN penutur berbeda sungguhan",
        "isi_sama_tanpa_ubah_suara": {"latih": cost_summary(plain_tr), "uji": cost_summary(plain_te)},
        "isi_sama_suara_diubah": {"latih": cost_summary(voice_tr), "uji": cost_summary(voice_te)},
        "isi_sama_latih": {"n": len(same_tr), "galat_rasio_persen": summ(same_tr, "galat_rasio_persen"), "galat_jalur_median_detik": summ(same_tr, "galat_jalur_median_detik"),
                           "biaya": {"min": round(float(cs.min()), 3), "median": round(float(np.median(cs)), 3), "maks": round(float(cs.max()), 3)}},
        "isi_beda_latih": {"n": len(diff_tr), "biaya": {"min": round(float(cd.min()), 3), "median": round(float(np.median(cd)), 3), "maks": round(float(cd.max()), 3)}},
        "isi_sama_uji": {"n": len(same_te), "galat_rasio_persen": summ(same_te, "galat_rasio_persen"), "galat_jalur_median_detik": summ(same_te, "galat_jalur_median_detik"),
                         "biaya": {"min": round(float(cs_te.min()), 3), "median": round(float(np.median(cs_te)), 3), "maks": round(float(cs_te.max()), 3)}},
        "isi_beda_uji": {"n": len(diff_te), "biaya": {"min": round(float(cd_te.min()), 3), "median": round(float(np.median(cd_te)), 3), "maks": round(float(cd_te.max()), 3)}},
        "ambang_biaya_dipilih_dari_latih": thr, "akurasi_seimbang_latih": round(best[0], 3),
        "galat_rasio_pada_yang_dinilai_andal": {
            "latih": summ([r for r in same_tr if r["biaya"] <= thr], "galat_rasio_persen"),
            "uji": summ([r for r in same_te if r["biaya"] <= thr], "galat_rasio_persen"),
            "n_latih": sum(1 for r in same_tr if r["biaya"] <= thr), "n_uji": sum(1 for r in same_te if r["biaya"] <= thr)},
        "uji_dengan_ambang": {"isi_sama_dinilai_andal": round(float(np.mean(cs_te <= thr)), 3), "isi_beda_dinilai_tak_andal": round(float(np.mean(cd_te > thr)), 3)},
        "penaksir_tempo": {"cara": "kemiringan jalur penyejajaran di bagian dalam (regresi linear)", "tepi_dibuang_persen": round(alignmod.TEMPO_EDGE_FRAC * 100), "tepi_minimum_detik": alignmod.TEMPO_EDGE_MIN_S,
                           "pembanding_lama": "rasio durasi ujaran awal-akhir (VAD); dipertahankan sebagai span_ratio, tidak dipakai sebagai tempo",
                           "penyapuan_tepi_pada_kasus_andal": {"latih": sweep_tr, "uji": sweep_te},
                           "tepi_terbaik_pada_latih": best_edge,
                           "aturan_pemilihan": "galat maksimum terkecil pada kasus andal himpunan LATIH; seri: p90 terkecil. Himpunan uji hanya dilaporkan."},
        "galat_rasio_durasi_lama_pada_yang_dinilai_andal": {
            "latih": summ([r for r in same_tr if r["biaya"] <= thr], "galat_rasio_durasi_persen"),
            "uji": summ([r for r in same_te if r["biaya"] <= thr], "galat_rasio_durasi_persen")},
        "ambang_di_kode": alignmod.COST_RELIABLE_MAX, "detik": round(time.time() - t0, 1),
    }


def run_vision(quick=False):
    import cv2
    from detect import PersonDetector
    from posecore import PoseTracker, L_SH, R_SH, L_HIP, R_HIP, NOSE
    t0 = time.time()
    det = PersonDetector()
    img = cv2.imread(os.path.join(DATA, "bus.jpg"))
    boxes = det(img)
    pt = PoseTracker()
    per = []
    for b in boxes:
        p = pt.process_box(img, [float(v) for v in b[:4]])
        pt.reset()
        if p is None:
            per.append({"kotak": [round(float(v)) for v in b[:4]], "skor": round(float(b[4]), 2), "pose": None})
            continue
        ok = bool(p[NOSE, 1] < min(p[L_SH, 1], p[R_SH, 1]) < max(p[L_HIP, 1], p[R_HIP, 1]) and p[[L_SH, R_SH, L_HIP, R_HIP], 2].min() > 0.5)
        per.append({"kotak": [round(float(v)) for v in b[:4]], "skor": round(float(b[4]), 2), "pose": "wajar" if ok else "kurang_wajar"})
    # lantai kebisingan: gambar diam + goyangan kamera
    floors = []
    import tempfile
    import subprocess
    from analyze import pose_metrics
    rng = np.random.default_rng(3)
    big = sorted([b for b in boxes if (b[3] - b[1]) > 300], key=lambda b: -(b[2] - b[0]) * (b[3] - b[1]))[:3]
    for bi, b in enumerate(big[: 1 if quick else 3]):
        x1, y1, x2, y2 = [int(v) for v in b[:4]]
        pad = 60
        crop = img[max(0, y1 - pad): y2 + pad, max(0, x1 - pad): x2 + pad].copy()
        h, w = crop.shape[:2]
        with tempfile.TemporaryDirectory() as td:
            raw = os.path.join(td, "s.mp4")
            vw = cv2.VideoWriter(raw, cv2.VideoWriter_fourcc(*"mp4v"), 25, (w, h))
            for _ in range(25 * 12):
                M = np.float32([[1, 0, rng.uniform(-2, 2)], [0, 1, rng.uniform(-2, 2)]])
                fr = cv2.warpAffine(crop, M, (w, h), borderMode=cv2.BORDER_REPLICATE)
                fr = np.clip(fr.astype(np.float32) + rng.normal(0, 3, fr.shape), 0, 255).astype(np.uint8)
                vw.write(fr)
            vw.release()
            out = {}
            m, warns, speeds, _ = pose_metrics(raw, [], None, 30, out)
        floors.append({"orang": bi, "kecepatan_tangan_rata2": (m or {}).get("wrist_speed_mean"), "variasi_miring_derajat": (m or {}).get("torso_lean_std_deg"),
                       "bingkai_terdeteksi": (m or {}).get("detection_rate"), "peringatan": warns})
    vt = {}
    from analyze import pose_metrics as pm
    out = {}
    tt = time.time()
    m, warns, speeds, _ = pm(os.path.join(DATA, "vtest.avi"), [], None, 40 if quick else 60, out)
    vt = {"detik_video": 40 if quick else 60, "orang_median_per_bingkai": out.get("count_median"), "jumlah_jejak": len(out.get("tracks", [])),
          "jejak_terpilih": out.get("selected"), "tingkat_deteksi_pose": (m or {}).get("detection_rate"), "peringatan": warns,
          "xRT": round((time.time() - tt) / (40.0 if quick else 60.0), 2)}
    return {"bus_jpg": {"jumlah_orang_terdeteksi": int(len(boxes)), "acuan_pembacaan_manual": 4, "per_orang": per},
            "lantai_kebisingan_gambar_diam_goyang_1_3px": floors, "vtest_avi": vt, "detik": round(time.time() - t0, 1)}


def run_pitch():
    import librosa
    y = load("LJ001-0001.wav")
    segs = audiocore.speech_segments(y)[0]
    base_r, nv = audiocore.pitch_range(y, segs)
    rows = []
    for st in (-4, 4):
        y2 = librosa.effects.pitch_shift(y, sr=SR, n_steps=st).astype(np.float32)
        s2 = audiocore.speech_segments(y2)[0]
        r2, nv2 = audiocore.pitch_range(y2, s2)
        rows.append({"geser_semiton": st, "rentang_asli": round(base_r, 2), "rentang_setelah": round(r2, 2) if r2 else None})
    return {"keterangan": "rentang nada (p90-p10, semiton) semestinya hampir tidak berubah saat seluruh nada digeser; ini uji kewajaran, bukan akurasi mutlak", "hasil": rows}


def run_stability():
    """Kepekaan tiap ukuran suara terhadap gangguan yang BUKAN perbedaan penampilan: gain 0,5x/2x, derau 20 dB, derau 10 dB.
    Dilaporkan per kelompok gangguan; 'lantai_disarankan' = maks(p90 gain, p90 derau 20 dB) dibulatkan ke atas (2 angka bermakna)."""
    names = ["jfk.wav", "LJ001-0001.wav", "sample.wav", "silero_test.wav"]
    keys = ["pause_mean_s", "long_pauses_per_min", "onset_rate_per_s", "speech_ratio", "dynamic_range_db", "pitch_range_st"]
    import soundfile as sf
    import tempfile
    groups = ("gain", "derau_20dB", "derau_10dB")
    deltas = {g: {k: [] for k in keys} for g in groups}
    rng = np.random.default_rng(11)
    for n in names:
        y = load(n, 45)
        with tempfile.TemporaryDirectory() as td:
            p0 = os.path.join(td, "0.wav")
            sf.write(p0, y, SR)
            base, _, segs, _ = audiocore.audio_metrics(p0, 150)
            rms = speech_rms(y, segs)
            variants = [("gain", "gain0.5", y * 0.5), ("gain", "gain2", np.clip(y * 2.0, -1, 1))]
            for snr, g in ((20, "derau_20dB"), (10, "derau_10dB")):
                for kind in NOISES:
                    variants.append((g, f"{kind}{snr}", add_noise(y, snr, kind, rng, rms)))
            for grp, tag, v in variants:
                pv = os.path.join(td, tag + ".wav")
                sf.write(pv, v.astype(np.float32), SR)
                m, _, _, _ = audiocore.audio_metrics(pv, 150)
                if not m:
                    continue
                for k in keys:
                    if base.get(k) is not None and m.get(k) is not None:
                        deltas[grp][k].append(abs(m[k] - base[k]))
    p90 = {g: {k: round(float(np.percentile(v, 90)), 3) for k, v in deltas[g].items() if v} for g in groups}
    mx = {g: {k: round(float(np.max(v)), 3) for k, v in deltas[g].items() if v} for g in groups}
    floor = {k: ceil2(max(p90["gain"].get(k, 0), p90["derau_20dB"].get(k, 0))) for k in keys}
    fragile = [k for k in keys if p90["derau_10dB"].get(k, 0) > 2 * max(floor[k], 1e-9)]
    return {"klip": names, "kelompok_gangguan": list(groups), "selisih_mutlak_p90": p90, "selisih_mutlak_maks": mx,
            "n_per_kelompok": {g: {k: len(v) for k, v in deltas[g].items()} for g in groups},
            "lantai_disarankan": floor, "rapuh_terhadap_derau_10dB": fragile,
            "aturan": "lantai = maks(p90 gain, p90 derau 20 dB), 2 angka bermakna ke atas; rapuh bila p90 derau 10 dB > 2 x lantai"}


def ceil2(x):
    """Bulatkan ke atas pada 2 angka bermakna."""
    import math
    if x <= 0:
        return 0.0
    mag = 10 ** math.floor(math.log10(x))
    return round(math.ceil(round(x / mag * 10, 6)) / 10 * mag, 6)


def write_calibration(res, path):
    """Tulis kalibrasi yang dipakai kode (evaluation/calibration.json) langsung dari hasil terukur; tidak ada angka salin-tempel."""
    st, vi, dt, jd = res.get("stabilitas"), res.get("visi"), res.get("dtw"), res.get("jeda")
    if not (st and vi and dt and jd):
        return False
    jit = vi["lantai_kebisingan_gambar_diam_goyang_1_3px"]
    wrist = float(np.median([p["kecepatan_tangan_rata2"] for p in jit]))
    torso = max(p["variasi_miring_derajat"] for p in jit)
    cal = {
        "dibuat": res.get("dibuat"),
        "sumber": "evaluation/results.json (dibuat oleh evaluate.py all)",
        "lantai": {
            **st["lantai_disarankan"],
            "wrist_speed_mean": ceil2(wrist),          # median kecepatan tangan pada gambar diam yang digoyang (sisa getaran pose)
            "torso_lean_std_deg": ceil2(torso),        # maks variasi miring pada gambar diam yang digoyang
            "gesture_speech_lag_s": 0.2,               # resolusi waktu pose (5 fps); batas prinsip, bukan hasil ukur
        },
        "rapuh_terhadap_derau": st["rapuh_terhadap_derau_10dB"],
        "ambang_biaya_penyejajaran": dt["ambang_biaya_dipilih_dari_latih"],
        "vad": jd["setelan_hasil_penalaan"],
    }
    with open(path, "w", encoding="utf-8") as f:
        json.dump(cal, f, indent=1, ensure_ascii=False)
    return True


def run_tempo():
    import subprocess
    t0 = time.time()
    y = load("silero_test.wav")
    tmp = os.path.join(DATA, "silero_test.wav")
    t = time.time()
    audiocore.audio_metrics(tmp, 150)
    a_s = time.time() - t
    return {"audio_60_detik": {"detik": round(a_s, 1), "xRT": round(a_s / 60.0, 3)}}


def environment():
    """Model dan pustaka yang dipakai menghasilkan angka ini. Hash model dicocokkan dengan models/MODELS.json oleh tes."""
    import platform
    from importlib import metadata

    import verify_models
    out = {"python": platform.python_version(), "model_sha256": {n: verify_models.sha256_file(os.path.join(verify_models.MODELS, n)) for n in verify_models.load()}}
    for pkg in ("numpy", "scipy", "librosa", "soundfile", "onnxruntime", "opencv-python-headless", "ai-edge-litert"):
        try:
            out[pkg] = metadata.version(pkg)
        except metadata.PackageNotFoundError:
            out[pkg] = None
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("what", nargs="?", default="all", choices=["all", "pause", "snr", "dtw", "vision", "pitch", "stability", "tempo"])
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("--out", default=OUT)
    a = ap.parse_args()
    if not fetch(verbose=False):
        print("Data evaluasi tidak lengkap (jaringan?).", file=sys.stderr)
        sys.exit(2)
    res = {}
    if os.path.exists(a.out) and a.what != "all":
        with open(a.out, encoding="utf-8") as f:
            res = json.load(f)
    for name, fn in (("jeda", run_pause), ("snr", lambda q: run_snr()), ("dtw", run_dtw), ("visi", run_vision), ("nada", lambda q: run_pitch()), ("stabilitas", lambda q: run_stability()), ("tempo", lambda q: run_tempo())):
        key = {"jeda": "pause", "snr": "snr", "dtw": "dtw", "visi": "vision", "nada": "pitch", "stabilitas": "stability", "tempo": "tempo"}[name]
        if a.what in ("all", key):
            print(f"== {name} ...", flush=True)
            res[name] = fn(a.quick)
    res["dibuat"] = time.strftime("%Y-%m-%d %H:%M:%S")
    res["quick"] = bool(a.quick)
    if a.what == "all":
        res["lingkungan"] = environment()
    else:
        print("Catatan: hasil sebagian digabung ke berkas lama; blok 'lingkungan' tidak diperbarui.", file=sys.stderr)
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    with open(a.out, "w", encoding="utf-8") as f:
        json.dump(res, f, indent=1, ensure_ascii=False)
    print("tersimpan:", a.out)
    if write_calibration(res, os.path.join(os.path.dirname(a.out), "calibration.json")):
        print("kalibrasi:", os.path.join(os.path.dirname(a.out), "calibration.json"))


if __name__ == "__main__":
    main()
