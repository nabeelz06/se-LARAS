#!/usr/bin/env python3
"""Memeriksa model bawaan terhadap models/MODELS.json (ukuran + sha256, dan keberadaan berkas lisensi).

  python3 verify_models.py            # offline: periksa berkas di models/
  python3 verify_models.py --online   # juga unduh ulang dari URL tercatat dan bandingkan hash (butuh jaringan)

Keluar 0 bila semua cocok, 1 bila ada yang tidak. Tujuannya mencegah model berganti diam-diam: angka evaluasi hanya
berlaku untuk berkas yang tercatat.
"""
import hashlib
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(HERE, "models")


def load():
    with open(os.path.join(MODELS, "MODELS.json"), encoding="utf-8") as f:
        return {k: v for k, v in json.load(f).items() if not k.startswith("_")}


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def verify(online=False, models_dir=MODELS):
    """Daftar (nama, ok, keterangan)."""
    out = []
    reg = load()
    for name, e in reg.items():
        p = os.path.join(models_dir, name)
        if not os.path.exists(p):
            out.append((name, False, "berkas tidak ada"))
            continue
        if os.path.getsize(p) != e["ukuran"]:
            out.append((name, False, f"ukuran {os.path.getsize(p)} != {e['ukuran']}"))
            continue
        if sha256_file(p) != e["sha256"]:
            out.append((name, False, "sha256 tidak cocok dengan MODELS.json"))
            continue
        if not os.path.exists(os.path.join(models_dir, e["berkas_lisensi"])):
            out.append((name, False, f"berkas lisensi {e['berkas_lisensi']} tidak ada"))
            continue
        if online:
            try:
                with urllib.request.urlopen(e["url"], timeout=120) as r:
                    h = hashlib.sha256(r.read()).hexdigest()
            except Exception as ex:  # noqa: BLE001
                out.append((name, False, f"unduh ulang gagal: {ex}"))
                continue
            if h != e["sha256"]:
                out.append((name, False, "unduhan dari URL tercatat berbeda dari berkas bawaan"))
                continue
        out.append((name, True, "cocok" + (" (termasuk unduh ulang)" if online else "")))
    for f in sorted(os.listdir(models_dir)):
        if f.endswith((".onnx", ".tflite")) and f not in reg:
            out.append((f, False, "model tidak terdaftar di MODELS.json"))
    return out


def main(argv=None):
    online = "--online" in (argv if argv is not None else sys.argv[1:])
    res = verify(online=online)
    for name, ok, why in res:
        print(("OK    " if ok else "GAGAL ") + f"{name}: {why}")
    return 0 if all(ok for _, ok, _ in res) else 1


if __name__ == "__main__":
    sys.exit(main())
