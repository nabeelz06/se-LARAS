#!/usr/bin/env python3
"""Unduh data evaluasi publik (suara dan gambar/video) ke evaluation/data/ dan periksa sha256.

Berkas TIDAK ikut dibagikan bersama kode: hak ciptanya milik pihak lain. Skrip ini hanya mengambilnya dari
repositori asal (lihat data_registry.json). Perlu akses ke raw.githubusercontent.com.
"""
import hashlib
import json
import os
import sys
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, "data")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(names=None, verbose=True):
    with open(os.path.join(HERE, "data_registry.json"), encoding="utf-8") as f:
        reg = json.load(f)
    os.makedirs(DATA, exist_ok=True)
    ok = True
    for name, e in reg.items():
        if names and name not in names:
            continue
        dst = os.path.join(DATA, name)
        if not (os.path.exists(dst) and sha256(dst) == e["sha256"]):
            try:
                urllib.request.urlretrieve(e["url"], dst)
            except Exception as ex:  # noqa: BLE001
                print(f"GAGAL {name}: {ex}", file=sys.stderr)
                ok = False
                continue
            if sha256(dst) != e["sha256"]:
                print(f"SHA256 BERBEDA {name}", file=sys.stderr)
                ok = False
                continue
        if verbose:
            print(f"ok {name} ({e['note']})")
    return ok


if __name__ == "__main__":
    sys.exit(0 if fetch(sys.argv[1:] or None) else 1)
