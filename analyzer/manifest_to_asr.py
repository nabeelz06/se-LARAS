#!/usr/bin/env python3
"""Mengubah paket ekspor korpus se-LARAS menjadi manifes ujaran (satu baris = satu segmen) untuk ASR.

Mata rantainya:  node scripts/export-dataset.js --out ekspor --media
                 -> python3 manifest_to_asr.py ekspor/manifest.jsonl keluaran/
                 -> python3 make_splits.py keluaran/asr_manifest.jsonl splits/
                 -> (latih di luar se-LARAS) -> python3 asr_eval.py rujukan.jsonl hipotesis.jsonl

Yang diambil hanya SEGMEN YANG DISAHKAN maestro (itulah isi manifest). Tiap segmen dipotong dari klip asli
menjadi WAV 16 kHz mono. Batas akhir segmen:
  - `end` yang ditetapkan maestro dipakai apa adanya (end_basis = "ditetapkan");
  - bila kosong, segmen DILEWATI, kecuali --derive-end: akhirnya diturunkan dari awal segmen berikutnya (atau
    akhir klip) dan ditandai end_basis = "turunan". Batas turunan kasar (bisa memuat jeda/ucapan lain): jangan
    dipakai untuk menghitung WER uji tanpa pemeriksaan manual.
Segmen tanpa teks, lebih pendek dari --min-seconds, atau lebih panjang dari --max-seconds dilewati dan dihitung.

Penutur: secara bawaan `speaker` = `speaker_key` paket ekspor (m<id akun maestro>), yaitu AKUN pengunggah, bukan orang yang
tampil. Bila satu akun mengunggah beberapa penampil (atau satu penampil memakai beberapa akun), pembagian menurut penutur
akan bocor. Beri pemetaan penutur sebenarnya dengan --speaker-map berkas.json: {"unit:12": "penampil-A", "m3": "penampil-B"}
(kunci unit menang atas kunci speaker_key). Pemetaan itu dibuat manusia dari lembar izin; sistem tidak menebaknya.

Skrip ini TIDAK melatih apa pun dan tidak menyertakan data bawaan: tanpa korpus yang disahkan, hasilnya kosong.
"""
import argparse
import json
import os
import subprocess
import sys


def _safe_join(base, rel):
    p = os.path.realpath(os.path.join(base, rel))
    if os.path.commonpath([os.path.realpath(base), p]) != os.path.realpath(base):
        raise ValueError(f"Jalur media di luar paket ekspor: {rel}")
    return p


def _slice(ffmpeg, src, start, dur, dst):
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    cmd = [ffmpeg, "-v", "error", "-y", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", src, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", dst]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise RuntimeError(f"ffmpeg gagal memotong {os.path.basename(src)} @{start:.2f}s: {(r.stderr or '').strip().splitlines()[-1:] or r.returncode}")


def load_speaker_map(path):
    with open(path, encoding="utf-8") as f:
        m = json.load(f)
    if not isinstance(m, dict) or not all(isinstance(k, str) and isinstance(v, str) and v.strip() for k, v in m.items()):
        raise ValueError("--speaker-map harus berupa objek JSON {kunci: label penutur (teks tak kosong)}")
    return {k: v.strip() for k, v in m.items()}


def _speaker(it, speaker_map):
    """(label, dipetakan?) untuk sebuah unit; kunci `unit:<id>` menang atas `speaker_key`."""
    if speaker_map:
        for k in (f"unit:{it.get('unit_id')}", it.get("speaker_key")):
            if k in speaker_map:
                return speaker_map[k], True
    return it["speaker_key"], False


def convert(manifest_path, out_dir, derive_end=False, min_s=0.5, max_s=30.0, ffmpeg="ffmpeg", speaker_map=None):
    base = os.path.dirname(os.path.abspath(manifest_path))
    rows, stats = [], {"unit": 0, "unit_dipetakan": 0, "segmen_sah": 0, "dilewati": {"tanpa_teks": 0, "tanpa_batas_akhir": 0, "terlalu_pendek": 0, "terlalu_panjang": 0}}
    with open(manifest_path, encoding="utf-8") as f:
        items = [json.loads(line) for line in f if line.strip()]
    for it in items:
        mf = it.get("media_file")
        if not mf:
            raise ValueError(f"Unit {it.get('unit_id')} tidak punya media_file: ekspor dibuat tanpa --media.")
        src = _safe_join(base, mf)
        if not os.path.exists(src):
            raise ValueError(f"Berkas media tidak ada: {mf}")
        stats["unit"] += 1
        spk, mapped = _speaker(it, speaker_map)
        stats["unit_dipetakan"] += int(mapped)
        segs = sorted(it.get("segments") or [], key=lambda s: (s.get("start") or 0))
        for i, s in enumerate(segs):
            stats["segmen_sah"] += 1
            text = (s.get("text_sby") or "").strip()
            start = float(s.get("start") or 0)
            if not text:
                stats["dilewati"]["tanpa_teks"] += 1
                continue
            end, basis = s.get("end"), "ditetapkan"
            if end is None:
                if not derive_end:
                    stats["dilewati"]["tanpa_batas_akhir"] += 1
                    continue
                nxt = segs[i + 1].get("start") if i + 1 < len(segs) else None
                end = nxt if nxt is not None else it.get("duration_s")
                basis = "turunan"
            if end is None or end <= start:
                stats["dilewati"]["tanpa_batas_akhir"] += 1
                continue
            dur = float(end) - start
            if dur < min_s:
                stats["dilewati"]["terlalu_pendek"] += 1
                continue
            if dur > max_s:
                stats["dilewati"]["terlalu_panjang"] += 1
                continue
            rel = os.path.join("wav", f"unit_{it['unit_id']}_s{i + 1:03d}.wav")
            _slice(ffmpeg, src, start, dur, os.path.join(out_dir, rel))
            rows.append({"audio": rel, "text": text, "text_id": (s.get("text_id") or "").strip(), "speaker": spk, "duration_s": round(dur, 3),
                         "unit_id": it["unit_id"], "start": round(start, 3), "end": round(float(end), 3), "end_basis": basis})
    os.makedirs(out_dir, exist_ok=True)
    with open(os.path.join(out_dir, "asr_manifest.jsonl"), "w", encoding="utf-8") as f:
        for r in rows:
            f.write(json.dumps(r, ensure_ascii=False) + "\n")
    stats["segmen_keluar"] = len(rows)
    stats["penutur"] = len({r["speaker"] for r in rows})
    stats["jam"] = round(sum(r["duration_s"] for r in rows) / 3600, 3)
    return rows, stats


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("manifest", help="manifest.jsonl dari paket ekspor (dengan --media)")
    ap.add_argument("out_dir")
    ap.add_argument("--derive-end", action="store_true", help="turunkan batas akhir dari awal segmen berikutnya bila maestro tidak menetapkannya (kasar)")
    ap.add_argument("--min-seconds", type=float, default=0.5)
    ap.add_argument("--max-seconds", type=float, default=30.0)
    ap.add_argument("--ffmpeg", default=os.environ.get("FFMPEG", "ffmpeg"))
    ap.add_argument("--speaker-map", help="JSON {\"unit:<id>\" atau speaker_key: label penutur sebenarnya}; tanpa ini penutur = akun pengunggah")
    a = ap.parse_args(argv)
    try:
        smap = load_speaker_map(a.speaker_map) if a.speaker_map else None
        _, st = convert(a.manifest, a.out_dir, a.derive_end, a.min_seconds, a.max_seconds, a.ffmpeg, smap)
    except (ValueError, RuntimeError) as e:
        print(f"[galat] {e}", file=sys.stderr)
        return 2
    d = st["dilewati"]
    print(f"{st['segmen_keluar']} ujaran dari {st['unit']} unit, {st['penutur']} penutur, {st['jam']} jam -> {os.path.join(a.out_dir, 'asr_manifest.jsonl')}")
    print(f"Dilewati: {d['tanpa_teks']} tanpa teks, {d['tanpa_batas_akhir']} tanpa batas akhir, {d['terlalu_pendek']} terlalu pendek, {d['terlalu_panjang']} terlalu panjang")
    if st["segmen_keluar"] == 0:
        print("Tidak ada ujaran: belum ada segmen yang disahkan, atau semuanya dilewati.")
    if st["segmen_keluar"] and not a.speaker_map:
        print("Catatan: penutur = akun pengunggah, bukan orang yang tampil. Bila satu akun memuat beberapa penampil, beri --speaker-map sebelum membagi.")
    elif st["segmen_keluar"] and st["unit_dipetakan"] < st["unit"]:
        print(f"Catatan: {st['unit'] - st['unit_dipetakan']} dari {st['unit']} unit tidak ada di --speaker-map; penuturnya tetap akun pengunggah.")
    if st["segmen_keluar"] and st["penutur"] < 5:
        print(f"Catatan: hanya {st['penutur']} penutur. make_splits.py menolak membagi di bawah 5 penutur (agar suara penutur yang sama tidak bocor ke data uji).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
