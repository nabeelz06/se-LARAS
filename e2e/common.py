"""Pembantu uji ujung-ke-ujung se-LARAS: server sementara berdata bersih, login akun contoh, pemantau galat peramban."""
import os
import re
import shutil
import socket
import subprocess
import tempfile
import time
import urllib.request
from contextlib import contextmanager
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = Path(__file__).resolve().parent / 'out'
PASSWORD = 'contoh-uji-123'
EMAIL = {
    'murid': 'murid-contoh@laras.invalid',
    'maestro': 'maestro-contoh@laras.invalid',
    'admin': 'admin-contoh@laras.invalid',
}
FAKE_MEDIA = ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream']


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


@contextmanager
def server():
    """Jalankan seed + server pada direktori data baru; hapus semuanya setelah selesai."""
    data = tempfile.mkdtemp(prefix='laras-e2e-')
    port = free_port()
    env = {**os.environ, 'DATA_DIR': data, 'PORT': str(port), 'AUTH_LIMIT': '1000', 'LARAS_DEMO': '1',
           'SESSION_SECRET': os.environ.get('SESSION_SECRET') or 'e2e-secret-0123456789abcdef'}
    env.pop('NODE_ENV', None)
    subprocess.run(['node', 'src/seed.js'], cwd=ROOT, env=env, check=True, capture_output=True, timeout=600)
    log = open(Path(data) / 'server.log', 'w')
    proc = subprocess.Popen(['node', 'src/server.js'], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    base = f'http://127.0.0.1:{port}'
    try:
        for _ in range(80):
            try:
                urllib.request.urlopen(base + '/healthz', timeout=1)
                break
            except Exception:
                if proc.poll() is not None:
                    raise RuntimeError('server berhenti saat start:\n' + (Path(data) / 'server.log').read_text(errors='replace')[-1500:])
                time.sleep(0.5)
        else:
            raise RuntimeError('server tidak menjawab /healthz')
        yield base
    finally:
        proc.terminate()
        try:
            proc.wait(10)
        except subprocess.TimeoutExpired:
            proc.kill()
        log.close()
        shutil.rmtree(data, ignore_errors=True)


def login(ctx, base, role):
    r = ctx.request.post(base + '/api/auth/login', data={'email': EMAIL[role], 'password': PASSWORD})
    assert r.ok, f'login {role} gagal: {r.status}'


class Watch:
    """Kumpulkan galat konsol, galat halaman, respons 5xx, dan permintaan gagal (selain pembatalan media yang wajar)."""

    def __init__(self, page, label=''):
        self.errors = []
        self.label = label
        page.on('console', lambda m: self.errors.append(f'konsol[{m.type}] {m.text}') if m.type == 'error' else None)
        page.on('pageerror', lambda e: self.errors.append(f'pageerror {e}'))
        page.on('response', lambda r: self.errors.append(f'HTTP {r.status} {r.url}') if r.status >= 500 else None)
        page.on('requestfailed', lambda r: self.errors.append(f'gagal {r.url} {r.failure}') if 'ERR_ABORTED' not in str(r.failure) else None)

    def assert_clean(self):
        assert not self.errors, f'{self.label} galat peramban: ' + ' | '.join(self.errors[:5])


def poll(fn, timeout=120, every=1.0, what='kondisi'):
    end = time.time() + timeout
    last = None
    while time.time() < end:
        last = fn()
        if last:
            return last
        time.sleep(every)
    raise AssertionError(f'batas waktu menunggu {what}')


def shot(page, name, **kw):
    OUT.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(OUT / f'{name}.png'), **kw)


def rx(s):
    return re.compile(s)
