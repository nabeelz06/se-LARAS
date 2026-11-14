#!/usr/bin/env python3
"""Bangun zip rilis se-LARAS dan (dengan --verify) ujilah dari ekstrak bersih.

Pakai, dari akar proyek:
    python3 scripts/package.py [--out BERKAS.zip] [--verify]

Bawaan --out: ../dist/se-LARAS-v<versi>.zip (di luar proyek, supaya zip tidak memuat dirinya sendiri).

Tidak ikut: node_modules, data, public.old, e2e/out, analyzer/evaluation/data (diunduh ulang oleh fetch_data.py),
cache Python, berkas rahasia/basis data lokal (.env, *.db, *.log). Ikut: model (analyzer/models), docs/img, docs/media,
seed/fixtures.

--verify: ekstrak ke direktori sementara BARU, lalu di sana jalankan `npm ci`, `npm run check:ui`, `npm test`, dan
`python3 -I analyzer/verify_models.py`. Pemeriksaan ini menangkap berkas yang lupa ikut dan ketergantungan diam-diam pada
node_modules/ lokal; dialah yang menemukan masalah `npm ci` + better-sqlite3 (lihat .npmrc). Tidak menjalankan tes Python
maupun e2e (jalankan sendiri di ekstraknya bila perlu). Butuh Node 22 dan akses ke registry npm.
"""
import argparse
import fnmatch
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FOLDER = "se-laras"  # nama folder akar di dalam zip

EXC_PATHS = {"node_modules", "data", "public.old", "e2e/out", "analyzer/evaluation/data"}
EXC_NAMES = {"__pycache__", ".pytest_cache", ".mypy_cache", ".DS_Store", ".git"}
EXC_FILE_GLOBS = (".env", ".env.*", "*.db", "*.db-wal", "*.db-shm", "*.log", "*.pyc", "*.pyo")
KEEP_FILES = {".env.example"}  # pengecualian dari .env.*


def excluded_file(name: str) -> bool:
    if name in KEEP_FILES:
        return False
    return name in EXC_NAMES or any(fnmatch.fnmatch(name, g) for g in EXC_FILE_GLOBS)


def collect(src: Path) -> list[str]:
    files: list[str] = []
    for dirpath, dirnames, filenames in os.walk(src):
        rel_dir = Path(dirpath).relative_to(src).as_posix()
        rel_dir = "" if rel_dir == "." else rel_dir
        dirnames[:] = sorted(
            d for d in dirnames
            if d not in EXC_NAMES and (f"{rel_dir}/{d}" if rel_dir else d) not in EXC_PATHS
        )
        for f in sorted(filenames):
            if not excluded_file(f):
                files.append(f"{rel_dir}/{f}" if rel_dir else f)
    return files


def build(out: Path) -> list[str]:
    files = collect(ROOT)
    out.parent.mkdir(parents=True, exist_ok=True)
    if out.exists():
        out.unlink()
    raw = 0
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel in files:
            p = ROOT / rel
            st = p.stat()
            zi = zipfile.ZipInfo.from_file(p, arcname=f"{FOLDER}/{rel}")
            zi.external_attr = (stat.S_IMODE(st.st_mode) | stat.S_IFREG) << 16
            z.writestr(zi, p.read_bytes(), compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            raw += st.st_size
    print(f"{out}\n  {len(files)} berkas, mentah {raw / 1e6:.1f} MB, zip {out.stat().st_size / 1e6:.1f} MB")
    return files


def run(cmd: list[str], cwd: Path, env: dict[str, str]) -> None:
    print(f"$ {' '.join(cmd)}   [{cwd.name}]", flush=True)
    r = subprocess.run(cmd, cwd=cwd, env=env, text=True, capture_output=True)
    tail = "\n".join((r.stdout + r.stderr).strip().splitlines()[-5:])
    print("  " + tail.replace("\n", "\n  "), flush=True)
    if r.returncode != 0:
        raise SystemExit(f"GAGAL (kode {r.returncode}): {' '.join(cmd)}")


def verify(zip_path: Path) -> None:
    npm = shutil.which("npm")
    if not npm:
        raise SystemExit("npm tidak ditemukan; --verify butuh Node 22 + npm")
    env = dict(os.environ)
    env.setdefault("SESSION_SECRET", "paket-uji-0123456789abcdef")
    tmp = Path(tempfile.mkdtemp(prefix="selaras-verify-"))
    try:
        with zipfile.ZipFile(zip_path) as z:
            z.extractall(tmp)
        proj = tmp / FOLDER
        print(f"ekstrak bersih di {proj}")
        run([npm, "ci", "--no-audit", "--no-fund"], proj, env)
        run([npm, "run", "check:ui"], proj, env)
        run([npm, "test"], proj, env)
        run([sys.executable, "-I", "analyzer/verify_models.py"], proj, env)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)
    print("LULUS: pasang bersih, check:ui, tes Node, dan keutuhan model dari zip yang sama dengan yang dikirim")


def main() -> None:
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--out", type=Path, help="berkas zip keluaran")
    ap.add_argument("--verify", action="store_true", help="ekstrak ke direktori baru lalu uji")
    a = ap.parse_args()
    version = json.loads((ROOT / "package.json").read_text("utf-8"))["version"]
    out = (a.out or ROOT.parent / "dist" / f"se-LARAS-v{version}.zip").resolve()
    build(out)
    if a.verify:
        verify(out)


if __name__ == "__main__":
    main()
