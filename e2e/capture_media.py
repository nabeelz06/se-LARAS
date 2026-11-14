"""Tangkap layar dan rekam penelusuran singkat se-LARAS dari aplikasi yang BENAR-BENAR berjalan.

Bukan bagian dari uji (tidak dipanggil run_all.py). Dipakai untuk docs/img/ dan docs/media/.
SEMUA isi gambar adalah DATA CONTOH SINTETIS: klip penari kartun buatan tim + suara LJSpeech (domain publik di AS).
Tidak ada rekaman Ludruk, tidak ada maestro asli, tidak ada pelajar asli.

Pemakaian:  python3 e2e/capture_media.py [--shots] [--video] [--png]    (tanpa argumen: gambar WebP dan video)
Syarat:     npm ci, playwright + chromium, Pillow, ffmpeg (untuk video).
"""
import argparse
import io
import re
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from PIL import Image  # noqa: E402
from playwright.sync_api import sync_playwright  # noqa: E402

import common  # noqa: E402
from common import ROOT, login, poll  # noqa: E402

IMG = ROOT / 'docs' / 'img'
MEDIA = ROOT / 'docs' / 'media'
FIXTURE = ROOT / 'seed' / 'fixtures' / 'murid_uji.mp4'
FONT = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_SERIF = '/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf'
VERSION = '0.3.0'


def prepare(pw, base):
    """Satu latihan pelajar dari klip contoh + penanda nyebeng, supaya halaman hasil dan kemajuan berisi."""
    b = pw.chromium.launch()
    try:
        ctx = b.new_context()
        login(ctx, base, 'murid')
        r = ctx.request.post(base + '/api/units/1/attempts', multipart={
            'file': {'name': 'murid_uji.mp4', 'mimeType': 'video/mp4', 'buffer': FIXTURE.read_bytes()},
            'consent_confirmed': 'true', 'share_with_maestro': 'true'})
        assert r.ok, f'unggah latihan gagal: {r.status} {r.text()[:200]}'
        aid = r.json()['id']
        r = ctx.request.post(base + '/api/units/1/progress', data={'step': 'nyebeng'})
        assert r.ok, f'tandai nyebeng gagal: {r.status} {r.text()[:200]}'

        def done():
            a = ctx.request.get(f'{base}/api/attempts/{aid}').json()['attempt']
            return a if a['status'] in ('done', 'failed') else None
        a = poll(done, timeout=240, every=2, what='analisis latihan contoh')
        assert a['status'] == 'done', f"analisis gagal: {a.get('error')}"
        return aid
    finally:
        b.close()


# (berkas, rute, peran, skema, halaman penuh)
DESKTOP = [
    ('01-beranda', '/', None, 'light', True),
    ('02-beranda-gelap', '/', None, 'dark', False),
    ('03-unit-daftar', '/unit', None, 'light', False),
    ('04-unit-detail', '/unit/1', 'murid', 'light', True),
    ('05-hasil-perbandingan', '/latihan/{aid}', 'murid', 'light', True),
    ('06-studio-latihan', '/unit/1/latihan', 'murid', 'light', False),
    ('07-kamus', '/kamus', None, 'light', False),
    ('08-kemajuan', '/kemajuan', 'murid', 'light', False),
    ('09-maestro-kelola', '/maestro/1', 'maestro', 'light', True),
    ('10-jejak', '/jejak', None, 'light', False),
    ('11-tentang', '/tentang', None, 'light', True),
]
MOBILE = [
    ('m1-beranda', '/', None, 'light'),
    ('m2-unit-detail', '/unit/1', 'murid', 'light'),
    ('m3-hasil-gelap', '/latihan/{aid}', 'murid', 'dark'),
]


def reveal_all(page):
    """Gulir seperti pengguna agar bagian bawah halaman muncul (gerak masuk memakai IntersectionObserver)."""
    y = 0
    while y < page.evaluate('document.documentElement.scrollHeight'):
        page.evaluate('(y) => window.scrollTo({ top: y, behavior: "instant" })', y)
        page.wait_for_timeout(130)
        y += 500
    page.evaluate('window.scrollTo({ top: 0, behavior: "instant" })')
    page.wait_for_timeout(1000)


def save(png_bytes, out_base, png):
    """WebP (kecil, untuk README) atau PNG (untuk slide/dokumen)."""
    im = Image.open(io.BytesIO(png_bytes)).convert('RGB')
    out = out_base.with_suffix('.png' if png else '.webp')
    im.save(out, **({'optimize': True} if png else {'format': 'WEBP', 'quality': 90, 'method': 6}))
    return out


def shots(pw, base, aid, png=False, only=None):
    IMG.mkdir(parents=True, exist_ok=True)
    b = pw.chromium.launch()
    made = []
    try:
        for kind, rows in (('desktop', DESKTOP), ('ponsel', MOBILE)):
            for row in rows:
                name, route, role, scheme = row[:4]
                if only and name not in only:
                    continue
                full = row[4] if kind == 'desktop' else False
                vp = {'width': 1360, 'height': 900} if kind == 'desktop' else {'width': 390, 'height': 844}
                ctx = b.new_context(viewport=vp, color_scheme=scheme, device_scale_factor=1 if kind == 'desktop' else 2)
                if role:
                    login(ctx, base, role)
                page = ctx.new_page()
                page.goto(f"{base}/#{route.format(aid=aid)}")
                page.wait_for_load_state('networkidle')
                page.wait_for_timeout(2200)
                if full:
                    reveal_all(page)
                made.append(save(page.screenshot(full_page=full), IMG / name, png))
                ctx.close()
    finally:
        b.close()
    return made


CURSOR_JS = """
(() => {
  if (window.__cur) return;
  const d = document.createElement('div');
  d.style.cssText = 'position:fixed;left:-50px;top:-50px;width:22px;height:22px;margin:-11px 0 0 -11px;border-radius:50%;'
    + 'background:rgba(217,163,47,.38);border:2px solid #d9a32f;box-shadow:0 0 0 2px rgba(18,10,9,.55);pointer-events:none;z-index:2147483647';
  const add = () => document.documentElement.appendChild(d);
  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', add) : add();
  addEventListener('mousemove', (e) => { d.style.left = e.clientX + 'px'; d.style.top = e.clientY + 'px'; }, true);
  window.__cur = d;
})();
"""
SCROLL_JS = """([y, ms]) => new Promise((res) => {
  const y0 = window.scrollY, t0 = performance.now();
  const ease = (t) => (t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  (function step(now) {
    const t = Math.min(1, (now - t0) / ms);
    window.scrollTo({ top: y0 + (y - y0) * ease(t), behavior: 'instant' });
    t < 1 ? requestAnimationFrame(step) : res();
  })(t0);
})"""


def scroll_to(page, y, ms=1800):
    page.evaluate(SCROLL_JS, [y, ms])


def page_height(page):
    return page.evaluate('document.documentElement.scrollHeight - window.innerHeight')


def read_down(page, parts=3, ms=2200, dwell=900):
    """Gulir pelan ke bawah dalam beberapa tahap, lalu kembali ke atas."""
    h = max(0, page_height(page))
    for i in range(1, parts + 1):
        scroll_to(page, h * i / parts, ms)
        page.wait_for_timeout(dwell)
    scroll_to(page, 0, 1200)
    page.wait_for_timeout(500)


def click(page, loc, steps=28):
    loc.scroll_into_view_if_needed()
    bb = loc.bounding_box()
    page.mouse.move(bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2, steps=steps)
    page.wait_for_timeout(280)
    loc.click()


def go(page, base, route, dwell=2200):
    page.goto(f'{base}/#{route}')
    page.wait_for_load_state('networkidle')
    page.wait_for_timeout(dwell)


def record(pw, base, aid, tmp):
    vids = []
    b = pw.chromium.launch()
    try:
        for role in ('murid', 'maestro'):
            ctx = b.new_context(viewport={'width': 1280, 'height': 720}, record_video_dir=str(tmp),
                                record_video_size={'width': 1280, 'height': 720}, color_scheme='light', bypass_csp=True)
            ctx.add_init_script(CURSOR_JS)
            login(ctx, base, role)
            page = ctx.new_page()
            page.mouse.move(640, 360)
            if role == 'murid':
                go(page, base, '/', 2800)
                read_down(page, 4, 2000, 700)
                for label in ('ID', 'SBY', 'SBY+ID'):  # tiga mode bahasa
                    click(page, page.locator('header .seg button').filter(has_text=common.rx(f'^{re.escape(label)}$')).first, 18)
                    page.wait_for_timeout(1100)
                click(page, page.locator('header').get_by_role('link', name=common.rx('Unit Latihan')).first)
                page.wait_for_timeout(2300)
                click(page, page.locator('main a[href^="#/unit/"]').first)
                page.wait_for_timeout(2400)
                read_down(page, 3, 2200, 800)
                go(page, base, f'/latihan/{aid}', 2600)
                read_down(page, 4, 2300, 1000)
                click(page, page.locator('header').get_by_role('link', name=common.rx('Kamus')).first)
                page.wait_for_timeout(2400)
                read_down(page, 2, 2000, 700)
                click(page, page.locator('header').get_by_role('link', name=common.rx('Kemajuan')).first)
                page.wait_for_timeout(3200)
            else:
                go(page, base, '/maestro', 2800)
                read_down(page, 2, 1800, 600)
                go(page, base, '/maestro/1', 2600)
                read_down(page, 4, 2200, 900)
                go(page, base, '/jejak', 2400)
                read_down(page, 2, 1800, 600)
            video = page.video
            page.close()
            ctx.close()  # rekaman baru utuh setelah konteks ditutup
            vids.append(Path(video.path()))
    finally:
        b.close()
    return vids


def encode(vids, out):
    """Kartu judul + dua rekaman, dengan keterangan tetap di bawah: ini data contoh sintetis."""
    MEDIA.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='laras-vid-') as d:
        d = Path(d)
        (d / 't1.txt').write_text('se-LARAS', encoding='utf-8')
        (d / 't2.txt').write_text(f'Penelusuran singkat prototipe v{VERSION}', encoding='utf-8')
        (d / 't3.txt').write_text('Semua isi layar adalah DATA CONTOH SINTETIS: penari kartun buatan tim + suara LJSpeech.', encoding='utf-8')
        (d / 't4.txt').write_text('Bukan rekaman Ludruk. Tidak ada maestro, pelajar, atau teks Suroboyoan yang sudah disahkan.', encoding='utf-8')
        (d / 'cap.txt').write_text(f'se-LARAS v{VERSION}  |  data contoh sintetis, bukan rekaman Ludruk', encoding='utf-8')

        def dt(txt, size, y, color, font=FONT):
            return (f"drawtext=fontfile={font}:textfile={d / txt}:fontcolor={color}:fontsize={size}:x=(w-text_w)/2:y={y}")
        title = ','.join([dt('t1.txt', 96, 215, '0xd9a32f', FONT_SERIF), dt('t2.txt', 34, 335, '0xf6efdf'),
                          dt('t3.txt', 24, 430, '0xf6efdf'), dt('t4.txt', 24, 470, '0xf6efdf')])
        cap = (f"drawbox=x=0:y=ih-42:w=iw:h=42:color=0x120a09@0.72:t=fill,"
               f"drawtext=fontfile={FONT}:textfile={d / 'cap.txt'}:fontcolor=0xf6efdf:fontsize=20:x=(w-text_w)/2:y=h-31")
        norm = 'scale=1280:720:flags=lanczos,setsar=1,fps=25,format=yuv420p'
        fc = (f"[0:v]{title}[t];[1:v]{norm}[a];[2:v]{norm}[b];"
              f"[a][b]concat=n=2:v=1:a=0[tour];[tour]{cap}[tc];[t][tc]concat=n=2:v=1:a=0[v]")
        cmd = ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=0x120a09:s=1280x720:r=25:d=5',
               '-i', str(vids[0]), '-i', str(vids[1]), '-filter_complex', fc, '-map', '[v]',
               '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', str(out)]
        subprocess.run(cmd, check=True, timeout=900)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--shots', action='store_true')
    ap.add_argument('--video', action='store_true')
    ap.add_argument('--only', nargs='*', help='hanya gambar bernama ini (tanpa ekstensi)')
    ap.add_argument('--png', action='store_true', help='tulis PNG (untuk slide/dokumen) alih-alih WebP')
    args = ap.parse_args()
    do_shots = args.shots or not args.video
    do_video = args.video or not args.shots
    with common.server() as base, sync_playwright() as pw:
        aid = prepare(pw, base)
        print('latihan contoh:', aid)
        if do_shots:
            for p in shots(pw, base, aid, args.png, set(args.only or [])):
                print('gambar', p.relative_to(ROOT), p.stat().st_size // 1024, 'KB')
        if do_video:
            with tempfile.TemporaryDirectory(prefix='laras-rec-') as tmp:
                vids = record(pw, base, aid, tmp)
                out = MEDIA / 'penelusuran-se-laras.mp4'
                encode(vids, out)
                print('video', out.relative_to(ROOT), out.stat().st_size // 1024, 'KB')


if __name__ == '__main__':
    main()
