"""Jalankan semua uji ujung-ke-ujung pada server sementara. Pemakaian: python3 e2e/run_all.py [maestro] [pelajar] [halaman]"""
import sys
import time
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from playwright.sync_api import sync_playwright  # noqa: E402

import common  # noqa: E402
import flow_learner  # noqa: E402
import flow_maestro  # noqa: E402
import flow_pages  # noqa: E402

FLOWS = [('maestro', flow_maestro), ('pelajar', flow_learner), ('halaman', flow_pages)]


def main():
    only = set(sys.argv[1:])
    rows = []
    with common.server() as base, sync_playwright() as pw:
        print('server uji:', base)
        for name, mod in FLOWS:
            if only and name not in only:
                continue
            t0 = time.time()
            try:
                info = mod.run(pw, base)
                rows.append((name, 'LULUS', time.time() - t0, str(info or '')))
            except Exception as e:  # noqa: BLE001 - laporkan semua jenis kegagalan
                traceback.print_exc()
                rows.append((name, 'GAGAL', time.time() - t0, str(e).splitlines()[0][:200] if str(e) else type(e).__name__))
    print('\n=== hasil e2e ===')
    for name, st, dt, info in rows:
        print(f'{st:6} {name:9} {dt:6.1f} dtk  {info}')
    if any(r[1] != 'LULUS' for r in rows):
        sys.exit(1)


if __name__ == '__main__':
    main()
