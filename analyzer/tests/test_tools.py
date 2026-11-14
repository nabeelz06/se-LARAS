import json
import os
import tempfile
import unittest

import asr_eval
import make_splits


class Wer(unittest.TestCase):
    def test_known_values(self):
        w, o = asr_eval.wer("the cat sat on the mat", "the cat sit on mat")
        self.assertEqual((o["sub"], o["del"], o["ins"]), (1, 1, 0))
        self.assertAlmostEqual(w, 2 / 6)
        self.assertEqual(asr_eval.wer("a b c", "a b c")[0], 0.0)
        self.assertEqual(asr_eval.wer("a b c", "")[0], 1.0)

    def test_insertions_can_exceed_one(self):
        self.assertGreater(asr_eval.wer("a", "a b c")[0], 1.0)

    def test_normalization(self):
        self.assertEqual(asr_eval.normalize("  Arek-arek Suroboyo, Rek!  "), "arek arek suroboyo rek")
        self.assertEqual(asr_eval.wer("Ora ngerti", "ora  ngerti.")[0], 0.0)

    def test_cer(self):
        c, o = asr_eval.cer("kucing", "kucink")
        self.assertAlmostEqual(c, 1 / 6)

    def test_corpus_level_is_weighted_not_averaged(self):
        s = asr_eval.corpus_scores([("a b c d", "a b c d"), ("x", "y")])
        self.assertAlmostEqual(s["WER"], 1 / 5)

    def test_cli_roundtrip(self):
        with tempfile.TemporaryDirectory() as td:
            r, h = os.path.join(td, "r.jsonl"), os.path.join(td, "h.jsonl")
            with open(r, "w", encoding="utf-8") as f:
                f.write(json.dumps({"audio": "k1", "text": "aku lungo"}) + "\n" + json.dumps({"audio": "k2", "text": "kowe teko"}) + "\n")
            with open(h, "w", encoding="utf-8") as f:
                f.write(json.dumps({"audio": "k1", "text": "aku lungo"}) + "\n")
            self.assertEqual(asr_eval.main([r, h]), 0)


class Splits(unittest.TestCase):
    def rows(self, n_spk=20, per=4):
        return [{"audio": f"s{s}_{k}", "text": "x", "speaker": f"s{s}", "duration_s": 3.0} for s in range(n_spk) for k in range(per)]

    def test_speaker_disjoint_and_complete(self):
        out, parts = make_splits.make_splits(self.rows())
        sets = {k: {r["speaker"] for r in v} for k, v in out.items()}
        self.assertFalse(sets["train"] & sets["dev"] or sets["train"] & sets["test"] or sets["dev"] & sets["test"])
        self.assertEqual(sum(len(v) for v in out.values()), 80)
        self.assertTrue(all(sets[k] for k in sets))

    def test_deterministic_and_order_independent(self):
        a, _ = make_splits.make_splits(self.rows())
        b, _ = make_splits.make_splits(list(reversed(self.rows())))
        self.assertEqual({k: sorted(r["audio"] for r in v) for k, v in a.items()}, {k: sorted(r["audio"] for r in v) for k, v in b.items()})

    def test_refuses_too_few_speakers(self):
        with self.assertRaises(ValueError):
            make_splits.make_splits(self.rows(n_spk=3))


if __name__ == "__main__":
    unittest.main()
