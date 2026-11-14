#!/usr/bin/env python3
"""Pengukur WER/CER untuk hasil pengenalan ujaran. Berdiri sendiri (tanpa pustaka luar).

Dipakai bila kelak ada korpus transkripsi Suroboyoan yang disahkan penutur asli: bandingkan hasil mesin dengan transkrip
rujukan, lalu laporkan WER (kata) dan CER (huruf) beserta rincian substitusi/hapus/sisip. TIDAK ada angka WER dari
se-LARAS saat ini: belum ada korpus Ludruk/Suroboyoan dan tidak ada model ASR yang dilatih (lihat docs/DATASET_DAN_PELATIHAN.md).

Berkas: JSONL, satu objek per baris.
  rujukan : {"audio": "id-klip", "text": "..."}
  hipotesis: {"audio": "id-klip", "text": "..."}
Pemakaian: python3 asr_eval.py rujukan.jsonl hipotesis.jsonl [--json]
"""
import argparse
import json
import re
import sys
import unicodedata


def normalize(text):
    """Huruf kecil, tanda baca dibuang (apostrof di dalam kata dipertahankan: 'ora'-'ra' tetap beda), spasi dirapikan."""
    t = unicodedata.normalize("NFKC", text or "").lower()
    t = re.sub(r"[^\w\s']", " ", t, flags=re.UNICODE)
    t = re.sub(r"(^|\s)'+|'+(\s|$)", " ", t)
    return re.sub(r"\s+", " ", t).strip()


def edit_ops(ref, hyp):
    """Jarak sunting Levenshtein antar-urutan beserta rincian (sub, del, ins). ref dan hyp: list token."""
    n, m = len(ref), len(hyp)
    d = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        d[i][0] = i
    for j in range(1, m + 1):
        d[0][j] = j
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            c = 0 if ref[i - 1] == hyp[j - 1] else 1
            d[i][j] = min(d[i - 1][j - 1] + c, d[i - 1][j] + 1, d[i][j - 1] + 1)
    i, j, s, dl, ins = n, m, 0, 0, 0
    while i > 0 or j > 0:
        if i > 0 and j > 0 and d[i][j] == d[i - 1][j - 1] + (0 if ref[i - 1] == hyp[j - 1] else 1):
            s += 0 if ref[i - 1] == hyp[j - 1] else 1
            i, j = i - 1, j - 1
        elif i > 0 and d[i][j] == d[i - 1][j] + 1:
            dl += 1
            i -= 1
        else:
            ins += 1
            j -= 1
    return {"sub": s, "del": dl, "ins": ins, "dist": d[n][m], "n_ref": n}


def wer(ref, hyp):
    r, h = normalize(ref).split(), normalize(hyp).split()
    o = edit_ops(r, h)
    return (o["dist"] / o["n_ref"]) if o["n_ref"] else (0.0 if not h else float(len(h))), o


def cer(ref, hyp):
    r, h = list(normalize(ref).replace(" ", "_")), list(normalize(hyp).replace(" ", "_"))
    o = edit_ops(r, h)
    return (o["dist"] / o["n_ref"]) if o["n_ref"] else (0.0 if not h else float(len(h))), o


def corpus_scores(pairs):
    """pairs: [(rujukan, hipotesis)]. WER/CER tingkat korpus = total kesalahan / total token rujukan (bukan rata-rata per kalimat)."""
    tw = {"sub": 0, "del": 0, "ins": 0, "dist": 0, "n_ref": 0}
    tc = {"sub": 0, "del": 0, "ins": 0, "dist": 0, "n_ref": 0}
    for r, h in pairs:
        for tot, fn in ((tw, wer), (tc, cer)):
            o = fn(r, h)[1]
            for k in tot:
                tot[k] += o[k]
    return {"WER": round(tw["dist"] / tw["n_ref"], 4) if tw["n_ref"] else None, "CER": round(tc["dist"] / tc["n_ref"], 4) if tc["n_ref"] else None,
            "kata": tw, "huruf": tc, "n_kalimat": len(pairs)}


def read_jsonl(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("rujukan")
    ap.add_argument("hipotesis")
    ap.add_argument("--json", action="store_true")
    a = ap.parse_args(argv)
    ref = {r["audio"]: r["text"] for r in read_jsonl(a.rujukan)}
    hyp = {r["audio"]: r["text"] for r in read_jsonl(a.hipotesis)}
    missing = sorted(set(ref) - set(hyp))
    pairs = [(ref[k], hyp.get(k, "")) for k in ref]
    res = corpus_scores(pairs)
    res["tanpa_hipotesis"] = missing
    if a.json:
        print(json.dumps(res, ensure_ascii=False, indent=1))
    else:
        print(f"WER {res['WER']:.1%}  CER {res['CER']:.1%}  ({res['n_kalimat']} kalimat; {len(missing)} tanpa hipotesis)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
