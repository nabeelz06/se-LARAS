// Cara kerja dan batasan, apa adanya: yang sudah ada, yang belum, dan yang masih perlu dipastikan.
import { h, icon, fmtDate } from '../core/dom.js';
import { GET } from '../core/api.js';
import { S } from '../core/state.js';
import { L, LB } from '../core/i18n.js';
import { badge, notice } from '../core/ui.js';
import { pageHead } from '../comp/pagehead.js';

const sec = (id, eyebrow, title, ...kids) => h('section', { class: 'stack reveal', 'aria-labelledby': id, style: { '--gap': '1.1rem' } }, h('div', { class: 'sechead sechead--left' }, h('p', { class: 'eyebrow' }, eyebrow), h('h2', { id }, title)), ...kids);

export async function render() {
  const [a, m] = await Promise.all([GET('/api/about'), GET('/api/metrics').catch(() => ({ metrics: [], calibration: {} }))]);
  const hn = a.honest || {};
  const status = (ok, yes, no) => (ok ? badge(yes, 'ok', 'check') : badge(no, 'warn', 'alert'));

  const how = [
    [L('Maestro ngunggah klip', 'Maestro mengunggah klip'), L('Klip demonstrasi lan izin tertulis saka sing tampil. Izin dicatet nang buku jejak.', 'Klip demonstrasi dan izin tertulis dari yang tampil. Izin dicatat di buku jejak.'), 'upload'],
    [L('Analisis otomatis (draf)', 'Analisis otomatis (draf)'), L('Server ngukur swara, jeda, lan obahan awak. Usulan momen mung draf.', 'Server mengukur suara, jeda, dan gerak tubuh. Usulan momen hanya draf.'), 'wave'],
    [L('Maestro nyahno', 'Maestro mengesahkan'), L('Maestro nulis "kenapa", milih ukuran lan toleransi, terus nyahno. Sing durung disahno ora ketok nang pemain.', 'Maestro menulis "kenapa", memilih ukuran dan toleransi, lalu mengesahkan. Yang belum disahkan tidak tampil bagi pemain.'), 'shield'],
    [L('Pemain Nyebeng, Tedean, Ngelmu', 'Pemain Nyebeng, Tedean, Ngelmu'), L('Ngamati contone, nyoba dewe, dibandingno karo ukuran maestro, terus mangerteni alasane.', 'Mengamati contoh, mencoba sendiri, dibandingkan dengan ukuran maestro, lalu memahami alasannya.'), 'body'],
  ];
  const real = [
    [!hn.trained_on_ludruk_data, L('AI ora dilatih nganggo data Ludruk', 'AI tidak dilatih dengan data Ludruk'), L('Model sing dipakai model umum (pretrained). Ora enek klaim "AI Ludruk".', 'Model yang dipakai adalah model umum (pretrained). Tidak ada klaim "AI Ludruk".'), L('Bener', 'Benar'), L('Ana', 'Ada')],
    [!hn.asr_model_included, L('Ora enek model pengenal ujaran Suroboyoan', 'Tidak ada model pengenal ujaran Suroboyoan'), L('Transkrip ditulis maestro. Pengenal ujaran opsional isok dipasang, hasile mung draf.', 'Transkrip ditulis maestro. Pengenal ujaran opsional dapat dipasang, hasilnya hanya draf.'), L('Bener', 'Benar'), L('Ana', 'Ada')],
    [false, L('Dataset Ludruk', 'Dataset Ludruk'), hn.ludruk_dataset || '', L('Ana', 'Ada'), L('Durung ana', 'Belum ada')],
    [false, L('Evaluasi', 'Evaluasi'), hn.evaluation || '', L('Ana', 'Ada'), L('Terbatas', 'Terbatas')],
    [false, L('Tulisan Suroboyoan', 'Teks Suroboyoan'), hn.suroboyoan_text || '', L('Disahno', 'Disahkan'), L('Draf', 'Draf')],
  ];
  const engines = [[L('Swara lan ujaran', 'Suara dan ujaran'), a.engines && a.engines.speech, L('Nemtokno bagian ngomong lan mandeg.', 'Menentukan bagian bicara dan jeda.'), 'mic'], [L('Wong nang video', 'Orang di video'), a.engines && a.engines.people, L('Nggoleki lan nglacak wong supaya sing diukur bener.', 'Mencari dan melacak orang agar yang diukur tepat.'), 'users'],
    [L('Obahan awak', 'Gerak tubuh'), a.engines && a.engines.pose, L('Maca titik-titik awak saka saben bingkai.', 'Membaca titik-titik tubuh dari tiap bingkai.'), 'body'], [L('Penyejajaran irama', 'Penyejajaran irama'), a.engines && a.engines.alignment, L('Nyejajarno irama latihan karo maestro.', 'Menyejajarkan irama latihan dengan maestro.'), 'loop']];
  const verifyList = [
    L('Tulisan Suroboyoan nang antarmuka iki: draf tim, durung dibaca penutur asli.', 'Teks Suroboyoan di antarmuka ini: draf tim, belum dibaca penutur asli.'),
    L('Jalur Nyebeng–Tedean–Ngelmu: rancangan tim, durung disahno maestro.', 'Jalur Nyebeng–Tedean–Ngelmu: rancangan tim, belum disahkan maestro.'),
    L('Entri kamus saka pustaka: durung disahno maestro (ana labele).', 'Entri kamus dari pustaka: belum disahkan maestro (ada labelnya).'),
    L('Tulisan aksara Jawa nang logo lan bilah atas: perlu dicek ahli aksara.', 'Tulisan aksara Jawa pada logo dan bilah atas: perlu diperiksa ahli aksara.'),
    L('Unit "conto uji" digawe tim kanggo mbuktekno alur; isine dudu konten maestro.', 'Unit "contoh uji" dibuat tim untuk membuktikan alur; isinya bukan konten maestro.'),
    L('Ukuran tempo ucap lan rentang nada iku perkiraan, ora ukuran langsung.', 'Ukuran tempo ucap dan rentang nada adalah perkiraan, bukan ukuran langsung.'),
    L('Makna jeneng "se-LARAS" nang basa Jawa lan cara nulise nganggo aksara Jawa: durung dicek penutur asli.', 'Makna nama "se-LARAS" dalam bahasa Jawa dan penulisannya dengan aksara Jawa: belum diperiksa penutur asli.'),
    L('Klip peragaan digawe saka bahan sintetis; lisensi bahan dasare isih diverifikasi (delok daftar nang docs/).', 'Klip peragaan dibuat dari bahan sintetis; lisensi bahan dasarnya masih diverifikasi (lihat daftar di docs/).'),
  ];

  const nameSec = sec('ab-name', L('Jeneng', 'Nama'), LB('Soko ngendi jeneng se-LARAS', 'Dari mana nama se-LARAS'),
    h('div', { class: 'grid grid--2' },
      h('article', { class: 'card stack', style: { '--gap': '.5rem' } }, h('h3', null, icon('heart'), L('Selaras', 'Selaras')),
        h('p', null, L('"Selaras" tegese cocok, sejalan. Sing diselarasno: klip maestro, analisis, ngelmu sing disahno, lan latihane pemain.', '"Selaras" berarti serasi dan sejalan. Yang diselaraskan: klip maestro, analisis, pengetahuan yang disahkan, dan latihan pemain.'))),
      h('article', { class: 'card stack', style: { '--gap': '.5rem' } }, h('h3', null, icon('sliders'), L('Laras', 'Laras')),
        h('p', null, L('Nang karawitan, "laras" iku sistem tangga nada gamelan (slendro lan pelog).', 'Dalam karawitan, "laras" adalah sistem tangga nada gamelan (slendro dan pelog).')),
        h('p', { class: 'hint' }, L('Sumber: Wikipedia (id), "Gamelan".', 'Sumber: Wikipedia (id), "Gamelan".'))),
      h('article', { class: 'card stack grid--span', style: { '--gap': '.5rem' } }, h('h3', null, icon('layers'), L('Singkatan', 'Singkatan')),
        h('p', null, h('strong', null, 'LARAS'), ' = Living Arts Repository, Analysis, and Skills-transfer.'),
        h('p', { class: 'hint' }, L('Singkatan iki dipilih tim sak durunge jeneng Jawane dicek penutur asli.', 'Singkatan ini dipilih tim sebelum makna Jawanya diperiksa penutur asli.')))));

  const creditSec = sec('ab-credit', L('Kredit', 'Kredit'), LB('Gambar lan aset', 'Gambar dan aset'),
    h('ul', { class: 'ticks' },
      h('li', null, L('Ilustrasi, tirai panggung, penari rangka, lan motif kain (kawung, parang, ceplok, truntum) digambar dhewe dadi SVG nggo se-LARAS. Motife pola tradisional sing digambar ulang, dudu salinan karya tertentu.', 'Ilustrasi, tirai panggung, penari rangka, dan motif kain (kawung, parang, ceplok, truntum) digambar sendiri sebagai SVG untuk se-LARAS. Motifnya pola tradisional yang digambar ulang, bukan salinan karya tertentu.')),
      h('li', null, L('Ora enek foto saka internet sing dibundel. Foto penampil nyata mung entuk dipasang nek ana izin tertulis lan hak cipta fotografere cetho; tim isok nambah fotone dhewe lan nyantumno kredite.', 'Tidak ada foto dari internet yang dibundel. Foto penampil nyata hanya boleh dipasang bila ada izin tertulis dan hak cipta fotografernya jelas; tim dapat menambahkan fotonya sendiri beserta kreditnya.')),
      h('li', null, L('Huruf: Fraunces, Plus Jakarta Sans, lan Noto Sans Javanese, dihosting dhewe.', 'Huruf: Fraunces, Plus Jakarta Sans, dan Noto Sans Javanese, dihosting sendiri.'))));

  return h('div', null,
    pageHead({ eyebrow: L('Cara kerja lan watese', 'Cara kerja dan batasnya'), title: LB('se-LARAS, apa anane', 'se-LARAS, apa adanya'), lead: LB('Apa sing wis ana, apa sing durung, lan apa sing isih kudu dipastekno. Ditulis terang, supaya ora enek sing kleru dikira.', 'Apa yang sudah ada, apa yang belum, dan apa yang masih perlu dipastikan. Ditulis terang, agar tidak ada yang keliru dikira.'), kind: 'kawung' }),
    h('div', { class: 'wrap pad stack', style: { '--gap': '3rem' } },
      sec('ab-how', L('Alur', 'Alur'), LB('Cara kerjane', 'Cara kerjanya'), h('ol', { class: 'how' }, how.map(([t, d, ic], i) => h('li', { class: 'how__step' }, h('span', { class: 'how__n tnum' }, i + 1), h('span', { class: 'how__ic' }, icon(ic)), h('div', null, h('h3', null, t), h('p', null, d)))))),
      nameSec,
      sec('ab-real', L('Apa anane', 'Apa adanya'), LB('Sing ana lan sing durung', 'Yang ada dan yang belum'), h('div', { class: 'grid grid--2' }, real.map(([ok, t, d, yes, no]) => h('article', { class: 'card stack', style: { '--gap': '.5rem' } }, h('div', { class: 'real__head' }, h('h3', null, t), status(ok, yes, no)), d ? h('p', null, d) : null)))),
      sec('ab-eng', L('Mesin analisis', 'Mesin analisis'), LB('Sing dipakai nganalisis', 'Yang dipakai menganalisis'), h('div', { class: 'grid grid--2' }, engines.map(([t, name, d, ic]) => h('article', { class: 'card eng' }, h('span', { class: 'eng__ic' }, icon(ic)), h('div', null, h('h3', null, t), h('p', { class: 'mono' }, name || '–'), h('p', { class: 'hint' }, d))))),
        notice(L('Kabeh mesin mlaku nang server dhewe, ora ngirim rekaman nang layanan njaba. Angka-angkane deskriptif; ora enek skor mutu.', 'Semua mesin berjalan di server sendiri, tanpa mengirim rekaman ke layanan luar. Angkanya deskriptif; tidak ada skor mutu.'), 'info', 'shield')),
      m.metrics.length ? sec('ab-met', L('Ukuran', 'Ukuran'), LB('Ukuran sing isok dipilih maestro', 'Ukuran yang dapat dipilih maestro'),
        h('ul', { class: 'metrics' }, m.metrics.map((x) => h('li', null, h('strong', null, S.lang === 'id' ? x.id : x.sby), S.lang === 'dua' ? h('small', { class: 'bi__sub' }, x.id) : null, h('span', { class: 'hint' }, `${x.unit}${x.src.includes('pose') ? ` · ${L('saka video', 'dari video')}` : ' · ' + L('saka swara', 'dari suara')}`), x.proxy ? badge(L('Perkiraan', 'Perkiraan'), 'warn') : null))),
        h('p', { class: 'hint' }, L('Angka ambang (lantai) diukur saka data publik non-Ludruk, bukan saka Ludruk.', 'Angka ambang (lantai) diukur dari data publik non-Ludruk, bukan dari Ludruk.'))) : null,
      sec('ab-priv', L('Data lan privasi', 'Data dan privasi'), LB('Data pemain', 'Data pemain'), h('ul', { class: 'ticks' },
        h('li', null, L('Rekaman mung dikirim sak wise sampeyan setuju, lan isok dibusak kapan wae.', 'Rekaman baru dikirim setelah Anda setuju, dan dapat dihapus kapan saja.')),
        h('li', null, L(`Rekaman latihan kebusak otomatis sak wise ${a.retention_days} dino.`, `Rekaman latihan terhapus otomatis setelah ${a.retention_days} hari.`)),
        h('li', null, L('Pamer marang maestro mung nek sampeyan mbagekno dewe.', 'Berbagi ke maestro hanya bila Anda membagikannya sendiri.')),
        h('li', null, L(`Klip maksimal ${a.max_clip_seconds} detik; ora enek skor, ora enek peringkat pemain.`, `Klip maksimal ${a.max_clip_seconds} detik; tidak ada skor, tidak ada peringkat pemain.`)),
        h('li', null, L('Data akun isok diundhuh lan akun isok dibusak nang kaca Akun.', 'Data akun dapat diunduh dan akun dapat dihapus di halaman Akun.')))),
      creditSec,
      sec('ab-ver', L('Perlu dipastekno', 'Perlu dipastikan'), LB('Sing isih kudu dicek', 'Yang masih perlu diperiksa'), h('ul', { class: 'plain plain--warn' }, verifyList.map((x) => h('li', null, x))),
        h('p', { class: 'hint' }, `${L('Versi', 'Versi')} ${a.version} · ${L('digawe wiwit', 'dibangun mulai')} ${fmtDate(a.first_build)}. ${a.reused ? L(`Modul ${a.reused.parts.join(', ')} dipakai ulang saka ${a.reused.name} (digawe ${fmtDate(a.reused.built)}).`, `Modul ${a.reused.parts.join(', ')} dipakai ulang dari ${a.reused.name} (dibuat ${fmtDate(a.reused.built)}).`) : ''}`))));
}
