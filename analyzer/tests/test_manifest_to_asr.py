import json
import os
import shutil
import tempfile
import unittest
import wave

import numpy as np

import make_splits
import manifest_to_asr as m2a

HAVE_FFMPEG = shutil.which("ffmpeg") is not None


def write_wav(path, seconds=10.0, sr=16000):
    t = np.arange(int(seconds * sr)) / sr
    x = (0.2 * np.sin(2 * np.pi * 220 * t) * 32767).astype("<i2")
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(x.tobytes())


def dur(path):
    with wave.open(path, "rb") as w:
        return w.getnframes() / w.getframerate(), w.getframerate(), w.getnchannels()


def package(td, media_file="media/unit_1.wav", segments=None):
    os.makedirs(os.path.join(td, "media"), exist_ok=True)
    write_wav(os.path.join(td, "media", "unit_1.wav"))
    segs = segments if segments is not None else [
        {"start": 0.5, "end": 3.0, "text_sby": "Cak, awakmu iku", "text_id": "Mas, kamu itu"},
        {"start": 4.0, "end": None, "text_sby": "Ayo budhal", "text_id": "Ayo berangkat"},
        {"start": 6.0, "end": 6.2, "text_sby": "kependekan", "text_id": ""},
        {"start": 7.0, "end": 8.0, "text_sby": "   ", "text_id": ""},
    ]
    row = {"unit_id": 1, "speaker_key": "m1", "duration_s": 10.0, "media_file": media_file, "segments": segs}
    p = os.path.join(td, "manifest.jsonl")
    with open(p, "w", encoding="utf-8") as f:
        f.write(json.dumps(row, ensure_ascii=False) + "\n")
    return p


@unittest.skipUnless(HAVE_FFMPEG, "ffmpeg tidak ada")
class ManifestToAsr(unittest.TestCase):
    def test_default_keeps_only_explicit_ends_and_cuts_16k_mono(self):
        with tempfile.TemporaryDirectory() as td, tempfile.TemporaryDirectory() as out:
            rows, st = m2a.convert(package(td), out)
            self.assertEqual(len(rows), 1)
            r = rows[0]
            self.assertEqual((r["text"], r["speaker"], r["end_basis"]), ("Cak, awakmu iku", "m1", "ditetapkan"))
            d, sr, ch = dur(os.path.join(out, r["audio"]))
            self.assertAlmostEqual(d, 2.5, delta=0.05)
            self.assertEqual((sr, ch), (16000, 1))
            self.assertEqual(st["dilewati"], {"tanpa_teks": 1, "tanpa_batas_akhir": 1, "terlalu_pendek": 1, "terlalu_panjang": 0})
            # berkas keluaran terbaca apa adanya oleh make_splits (kunci audio/text/speaker/duration_s)
            self.assertTrue({"audio", "text", "speaker", "duration_s"} <= set(r))

    def test_derive_end_marks_basis_and_uses_next_start(self):
        with tempfile.TemporaryDirectory() as td, tempfile.TemporaryDirectory() as out:
            rows, _ = m2a.convert(package(td), out, derive_end=True)
            by = {r["text"]: r for r in rows}
            self.assertEqual(set(by), {"Cak, awakmu iku", "Ayo budhal"})
            self.assertEqual(by["Ayo budhal"]["end_basis"], "turunan")
            self.assertAlmostEqual(by["Ayo budhal"]["end"], 6.0, places=3)  # awal segmen berikutnya

    def test_max_seconds_filter(self):
        with tempfile.TemporaryDirectory() as td, tempfile.TemporaryDirectory() as out:
            segs = [{"start": 0.0, "end": 9.0, "text_sby": "panjang", "text_id": ""}]
            rows, st = m2a.convert(package(td, segments=segs), out, max_s=5.0)
            self.assertEqual(rows, [])
            self.assertEqual(st["dilewati"]["terlalu_panjang"], 1)

    def test_inverted_or_missing_end_is_skipped_not_crashed(self):
        with tempfile.TemporaryDirectory() as td, tempfile.TemporaryDirectory() as out:
            segs = [{"start": 5.0, "end": 4.0, "text_sby": "terbalik", "text_id": ""}, {"start": 8.0, "end": None, "text_sby": "tanpa akhir", "text_id": ""}]
            p = package(td, segments=segs)
            with open(p, encoding="utf-8") as f:
                row = json.loads(f.read())
            row["duration_s"] = None  # tak ada akhir klip untuk menurunkan batas akhir
            with open(p, "w", encoding="utf-8") as f:
                f.write(json.dumps(row))
            rows, st = m2a.convert(p, out, derive_end=True)
            self.assertEqual(rows, [])
            self.assertEqual(st["dilewati"]["tanpa_batas_akhir"], 2)

    def test_speaker_map_overrides_account_speaker_unit_key_first(self):
        # Satu akun maestro (m1) bisa mengunggah beberapa penampil: pemetaan manual memisahkan mereka sebelum pembagian.
        with tempfile.TemporaryDirectory() as td, tempfile.TemporaryDirectory() as out:
            p = package(td)
            with open(p, encoding="utf-8") as f:
                row = json.loads(f.read())
            row2 = dict(row, unit_id=2)
            with open(p, "w", encoding="utf-8") as f:
                f.write(json.dumps(row) + "\n" + json.dumps(row2) + "\n")
            rows, st = m2a.convert(p, out, speaker_map={"m1": "penampil-A", "unit:2": "penampil-B"})
            self.assertEqual({(r["unit_id"], r["speaker"]) for r in rows}, {(1, "penampil-A"), (2, "penampil-B")})
            self.assertEqual((st["unit"], st["unit_dipetakan"], st["penutur"]), (2, 2, 2))
            # tanpa pemetaan kedua unit jatuh ke akun pengunggah yang sama (satu 'penutur')
            rows0, st0 = m2a.convert(p, out)
            self.assertEqual({r["speaker"] for r in rows0}, {"m1"})
            self.assertEqual(st0["unit_dipetakan"], 0)

    def test_speaker_map_file_is_validated(self):
        with tempfile.TemporaryDirectory() as td:
            bad = os.path.join(td, "bad.json")
            for content in ('["a"]', '{"unit:1": 5}', '{"unit:1": "  "}'):
                with open(bad, "w", encoding="utf-8") as f:
                    f.write(content)
                with self.assertRaises(ValueError, msg=content):
                    m2a.load_speaker_map(bad)
            good = os.path.join(td, "good.json")
            with open(good, "w", encoding="utf-8") as f:
                f.write('{"unit:1": " Cak A "}')
            self.assertEqual(m2a.load_speaker_map(good), {"unit:1": "Cak A"})

    def test_export_without_media_is_refused_clearly(self):
        with tempfile.TemporaryDirectory() as td, tempfile.TemporaryDirectory() as out:
            with self.assertRaisesRegex(ValueError, "tanpa --media"):
                m2a.convert(package(td, media_file=None), out)

    def test_path_traversal_in_media_file_is_refused(self):
        with tempfile.TemporaryDirectory() as td, tempfile.TemporaryDirectory() as out:
            with self.assertRaisesRegex(ValueError, "di luar paket"):
                m2a.convert(package(td, media_file="../../etc/passwd"), out)

    def test_empty_corpus_gives_empty_manifest_and_warns_not_invents(self):
        with tempfile.TemporaryDirectory() as td, tempfile.TemporaryDirectory() as out:
            p = os.path.join(td, "manifest.jsonl")
            open(p, "w").close()
            rows, st = m2a.convert(p, out)
            self.assertEqual((rows, st["segmen_keluar"], st["penutur"]), ([], 0, 0))
            self.assertEqual(m2a.main([p, out]), 0)

    def test_few_speakers_still_refused_by_splitter(self):
        with tempfile.TemporaryDirectory() as td, tempfile.TemporaryDirectory() as out:
            rows, _ = m2a.convert(package(td), out)
            with self.assertRaises(ValueError):
                make_splits.make_splits(rows)


if __name__ == "__main__":
    unittest.main()
