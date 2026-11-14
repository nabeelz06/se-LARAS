"""Alur pelajar: rekam lewat kamera (kamera palsu Chromium) -> gerbang persetujuan -> kirim -> hasil analisis."""
import re

from common import FAKE_MEDIA, Watch, login, poll, shot


def run(pw, base):
    b = pw.chromium.launch(args=FAKE_MEDIA)
    try:
        ctx = b.new_context(viewport={'width': 1360, 'height': 900}, permissions=['camera', 'microphone'])
        login(ctx, base, 'murid')
        page = ctx.new_page()
        watch = Watch(page, 'pelajar')
        page.goto(base + '/#/unit/1/latihan')
        page.get_by_role('button', name=re.compile('Bukak kamera')).click()
        page.get_by_role('button', name=re.compile('Wiwit ngrekam')).wait_for(timeout=15000)
        page.get_by_role('button', name=re.compile('Wiwit ngrekam')).click()
        page.wait_for_timeout(5500)  # hitung mundur + rekaman beberapa detik
        shot(page, 'pelajar_1_rekam')
        page.locator('.rec__actions').get_by_role('button', name=re.compile('^Mandeg')).click()
        send = page.get_by_role('button', name=re.compile('Kirim lan analisis'))
        send.wait_for(timeout=15000)
        # gerbang persetujuan: tidak boleh terkirim sebelum dicentang
        assert send.is_disabled(), 'tombol kirim harus nonaktif sebelum persetujuan dicentang'
        page.locator('input[name=consent_confirmed]').check()
        assert send.is_enabled(), 'tombol kirim harus aktif setelah persetujuan'
        shot(page, 'pelajar_2_siap_kirim', full_page=True)
        send.click()
        page.wait_for_url(re.compile(r'#/latihan/\d+'), timeout=30000)
        aid = re.search(r'#/latihan/(\d+)', page.url).group(1)

        def finished():
            a = ctx.request.get(f'{base}/api/attempts/{aid}').json()['attempt']
            return a if a['status'] in ('done', 'failed') else None
        a = poll(finished, timeout=240, every=2, what='analisis latihan pelajar')
        assert a['status'] == 'done', f"analisis latihan gagal: {a.get('error')}"
        page.reload()
        page.locator('main').get_by_text(re.compile('Rampung')).first.wait_for(timeout=20000)
        shot(page, 'pelajar_3_hasil', full_page=True)
        text = page.locator('main').inner_text()
        assert 'Gagal' not in text, 'halaman hasil menampilkan status Gagal'
        watch.assert_clean()
        return {'attempt_id': aid}
    finally:
        b.close()
