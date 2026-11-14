"""Alur maestro dari awal sampai akhir: unggah berizin -> analisis -> transkrip -> momen -> ukuran -> pengesahan -> tampil bagi pelajar."""
import re

from common import ROOT, Watch, login, poll, shot

CLIP = ROOT / 'seed' / 'fixtures' / 'maestro_uji.mp4'


def run(pw, base):
    b = pw.chromium.launch()
    try:
        ctx = b.new_context(viewport={'width': 1360, 'height': 900})
        ctx.add_init_script("try{localStorage.setItem('laras_bahasa','id')}catch(e){}")
        login(ctx, base, 'maestro')
        page = ctx.new_page()
        watch = Watch(page, 'maestro')
        page.goto(base + '/#/maestro')
        page.locator('input[name=file]').wait_for()

        # 1. unggah: tombol unggah tidak boleh jalan tanpa izin tertulis
        page.locator('input[name=file]').set_input_files(str(CLIP))
        page.fill('input[name=title_sby]', 'Uji e2e: mandeg lan obah')
        page.fill('input[name=title_id]', 'Uji e2e: berhenti dan bergerak')
        page.fill('input[name=skill]', 'jeda dan gestur')
        page.fill('input[name=consent_holder]', 'Pihak uji (bukan orang nyata)')
        page.locator('input[name=consent_confirmed]').check()
        shot(page, 'maestro_1_unggah')
        page.get_by_role('button', name=re.compile('Unggah dan analisis')).click()
        page.wait_for_url(re.compile(r'#/maestro/\d+'), timeout=60000)
        uid = re.search(r'#/maestro/(\d+)', page.url).group(1)

        # 2. analisis nyata (analyzer Python) harus selesai
        def analysed():
            j = ctx.request.get(f'{base}/api/units/{uid}').json()['unit']
            return j if j['analysis_status'] in ('done', 'failed') else None
        unit = poll(analysed, timeout=240, every=2, what='analisis klip')
        assert unit['analysis_status'] == 'done', f"analisis gagal: {unit.get('analysis_error')}"
        page.reload()
        page.get_by_role('tab', name=re.compile('^Transkrip')).wait_for()
        shot(page, 'maestro_2_draf', full_page=True)

        # 3. transkrip: tempel banyak -> 3 segmen
        page.get_by_role('button', name=re.compile('Tempel banyak')).first.click()
        dlg = page.locator('dialog[open]')
        dlg.locator('textarea').fill('0:01 | Cak, kate nandi? | Mas, mau ke mana?\n0:05 | Aku kate nyang pasar. | Aku mau ke pasar.\n0:09-0:12 | Ayo bareng, ojok suwi. | Ayo bersama, jangan lama.')
        dlg.get_by_role('button', name=re.compile('Tambahkan semua')).click()
        rows = lambda: page.locator('[role=tabpanel]:not([hidden]) .mrow').count()  # semua panel tab ada di DOM; hitung yang aktif saja
        poll(lambda: rows() == 3, timeout=15, every=.3, what='3 baris transkrip')

        # 4. momen beserta alasannya
        page.get_by_role('tab', name=re.compile('^Momen')).click()
        n_momen = rows()  # analisis sudah mengusulkan momen draf otomatis; momen kita menambah satu
        page.get_by_role('button', name=re.compile('^Tambah momen')).first.click()
        dlg = page.locator('dialog[open]')
        dlg.get_by_label(re.compile(r'Waktu \(detik\)')).fill('9.5')
        dlg.get_by_label('Judul (Suroboyoan)').fill('Mandeg sakdurunge ngomong')
        dlg.get_by_label('Judul (Indonesia)').fill('Berhenti sebelum bicara')
        dlg.get_by_label(re.compile(r'Kenapa\? \(Indonesia\)')).fill('Jeda memberi penonton waktu menunggu kalimat berikutnya.')
        dlg.get_by_role('button', name=re.compile('^Simpan')).click()
        poll(lambda: rows() == n_momen + 1, timeout=15, every=.3, what='momen baru muncul di daftar')

        # 5. ukuran: hanya ukuran yang tersedia pada klip ini yang bisa dipilih
        page.get_by_role('tab', name=re.compile('^Ukuran')).click()
        boxes = page.locator('.rdim input[type=checkbox]:not([disabled])')
        boxes.first.wait_for()
        assert boxes.count() >= 1, 'tidak ada ukuran yang tersedia'
        for i in range(min(2, boxes.count())):
            boxes.nth(i).check()
        for el in page.locator('.rdim.is-on input[type=text], .rdim.is-on textarea').all():
            if el.input_value() == '':
                el.fill('Uji')
        page.get_by_role('button', name=re.compile('Simpan ukuran')).click()
        page.wait_for_timeout(800)

        # 6. sahkan segmen dan momen (dialog konfirmasi), lalu sahkan unit lewat gerbang kesiapan
        for tab in ('Transkrip', 'Momen'):
            page.get_by_role('tab', name=re.compile('^' + tab)).click()
            sah = page.get_by_role('button', name=re.compile(r'^Sahkan \d+ yang siap'))
            if sah.count():
                sah.first.click()
                page.locator('dialog[open] button.btn--primary').click()
                page.wait_for_timeout(800)
        shot(page, 'maestro_3_siap', full_page=True)
        ready_btn = page.locator('.ready button.btn--primary').first
        poll(lambda: ready_btn.is_enabled(), timeout=15, every=.5, what='tombol "Sahkan unit" aktif (gerbang kesiapan terpenuhi)')
        ready_btn.click()
        page.locator('dialog[open] button.btn--primary').click()
        j = poll(lambda: (lambda u: u if u['status'] == 'validated' else None)(ctx.request.get(f'{base}/api/units/{uid}').json()['unit']),
                 timeout=20, every=.5, what='status unit = validated')
        assert j['status'] == 'validated'

        # 7. pelajar kini melihat unit itu beserta transkrip yang disahkan
        lctx = b.new_context(viewport={'width': 1360, 'height': 900})
        lctx.add_init_script("try{localStorage.setItem('laras_bahasa','id')}catch(e){}")
        login(lctx, base, 'murid')
        lp = lctx.new_page()
        lwatch = Watch(lp, 'pelajar melihat unit')
        lp.goto(f'{base}/#/unit/{uid}')
        lp.get_by_text('Mas, mau ke mana?').first.wait_for(timeout=15000)  # bahasa antarmuka = Indonesia: terjemahan yang tampil
        shot(lp, 'maestro_4_tampil_pelajar', full_page=True)
        data = lctx.request.get(f'{base}/api/units/{uid}').json()
        assert len(data['segments']) == 3, 'pelajar harus melihat 3 segmen yang disahkan'
        assert any(m.get('title_id') == 'Berhenti sebelum bicara' for m in data['markers']), 'momen yang disahkan harus tampil bagi pelajar'
        assert all(m['status'] == 'validated' for m in data['markers']), 'momen yang belum disahkan (termasuk usulan otomatis) tidak boleh tampil bagi pelajar'
        lwatch.assert_clean()
        watch.assert_clean()
        return {'unit_id': uid}
    finally:
        b.close()
