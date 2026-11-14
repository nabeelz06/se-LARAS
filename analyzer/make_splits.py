#!/usr/bin/env python3
"""Pemisah latih/dev/uji yang TIDAK bocor antar-penutur, untuk manifes data ucapan.

Aturan: satu penutur hanya muncul di satu bagian. Penugasan ditentukan oleh hash penutur (tetap dari run ke run,
tidak bergantung urutan berkas). Menolak bila penutur terlalu sedikit untuk dibagi tiga: lebih baik gagal daripada
melaporkan angka uji dari penutur yang sudah dilihat model.

Manifes JSONL: {"audio": "...", "text": "...", "speaker": "...", "duration_s": 3.2}
Pemakaian: python3 make_splits.py manifes.jsonl keluaran_dir [--dev 0.1 --test 0.1 --seed 1]
"""
import argparse
import hashlib
import json
import os
import sys


def _h(speaker, seed):
    return int(hashlib.sha256(f"{seed}:{speaker}".encode()).hexdigest()[:12], 16) / float(16 ** 12)


def split_speakers(speakers, dev=0.1, test=0.1, seed=1):
    sp = sorted(set(speakers))
    if len(sp) < 5:
        raise ValueError(f"Hanya {len(sp)} penutur; butuh minimal 5 agar tiap bagian punya penutur sendiri.")
    ranked = sorted(sp, key=lambda s: _h(s, seed))
    n_test = max(1, round(len(sp) * test))
    n_dev = max(1, round(len(sp) * dev))
    return {"test": set(ranked[:n_test]), "dev": set(ranked[n_test:n_test + n_dev]), "train": set(ranked[n_test + n_dev:])}


def make_splits(rows, dev=0.1, test=0.1, seed=1):
    parts = split_speakers([r["speaker"] for r in rows], dev, test, seed)
    out = {k: [] for k in parts}
    for r in rows:
        for k, spk in parts.items():
            if r["speaker"] in spk:
                out[k].append(r)
                break
    return out, parts


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument("manifest")
    ap.add_argument("outdir")
    ap.add_argument("--dev", type=float, default=0.1)
    ap.add_argument("--test", type=float, default=0.1)
    ap.add_argument("--seed", type=int, default=1)
    a = ap.parse_args(argv)
    with open(a.manifest, encoding="utf-8") as f:
        rows = [json.loads(line) for line in f if line.strip()]
    out, parts = make_splits(rows, a.dev, a.test, a.seed)
    os.makedirs(a.outdir, exist_ok=True)
    stats = {}
    for k, rs in out.items():
        with open(os.path.join(a.outdir, f"{k}.jsonl"), "w", encoding="utf-8") as f:
            for r in rs:
                f.write(json.dumps(r, ensure_ascii=False) + "\n")
        stats[k] = {"klip": len(rs), "penutur": len(parts[k]), "jam": round(sum(r.get("duration_s", 0) for r in rs) / 3600.0, 3)}
    with open(os.path.join(a.outdir, "ringkasan.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, indent=1)
    print(json.dumps(stats, indent=1))
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except ValueError as e:
        print("GAGAL:", e, file=sys.stderr)
        sys.exit(2)
