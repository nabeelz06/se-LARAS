import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
DATA = os.path.join(ROOT, "evaluation", "data")
RESULTS = os.path.join(ROOT, "evaluation", "results.json")
CALIB = os.path.join(ROOT, "evaluation", "calibration.json")


def have(name):
    return os.path.exists(os.path.join(DATA, name))
