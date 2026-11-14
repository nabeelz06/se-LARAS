// Ruang maestro: unit milik sendiri, dan formulir unggah klip demonstrasi beserta izin tertulis dari semua yang tampil di klip.
import { h, icon } from '../core/dom.js';
import { GET, upload } from '../core/api.js';
import { S } from '../core/state.js';
import { L, LB, LC } from '../core/i18n.js';
import { notice, empty, field, check, form, toast, progressBar } from '../core/ui.js';
import { go, onLeave } from '../core/router.js';
import { pageHead } from '../comp/pagehead.js';
import { unitCard } from '../comp/unitcard.js';

const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

function flowStrip() {
  const steps = [
    ['upload', L('Unggah klip + izin', 'Unggah klip + izin'), L('Klip demonstrasi lan izin tertulis saka sing tampil.', 'Klip demonstrasi dan izin tertulis dari yang tampil.')],
    ['caption', L('Tulis transkrip lan momen', 'Tulis transkrip dan momen'), L('Isi takarir Suroboyoan–Indonesia, lan "kenek opo" nang saben momen.', 'Isi takarir Suroboyoan–Indonesia, dan "kenapa" pada tiap momen.')],
    ['sliders', L('Tentokno ukuran', 'Tentukan ukuran'), L('Pilih ukuran sing ngewakili caramu, karo toleransine.', 'Pilih ukuran yang mewakili caramu, beserta toleransinya.')],
    ['shield', L('Sahno', 'Sahkan'), L('Sak wise disahno, unit ketok nang pemain.', 'Setelah disahkan, unit tampil bagi pemain.')],
  ];
  return h('ol', { class: 'flow', 'aria-label': L('Alur maestro', 'Alur maestro') }, steps.map(([ic, t, d]) => h('li', { class: 'flow__step' }, h('span', { class: 'flow__ic' }, icon(ic)), h('div', null, h('strong', null, t), h('small', null, d)))));
}

function uploadCard() {
  const a = S.about || {}, maxS = a.max_clip_seconds || 150, maxMb = a.max_upload_mb || 60;
  const fileField = field(L('Klip demonstrasi', 'Klip demonstrasi'), 'file', { type: 'file', required: true, accept: 'video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/ogg,audio/webm',
    hint: L(`Video (mp4/webm/mov) utowo swara (mp3/m4a/wav/ogg). Maksimal ${maxS} detik lan ${maxMb} MB.`, `Video (mp4/webm/mov) atau suara (mp3/m4a/wav/ogg). Maksimal ${maxS} detik dan ${maxMb} MB.`) });
  const fileInput = fileField.querySelector('input');
  fileInput.addEventListener('change', () => { const f = fileInput.files[0]; if (f && f.size > maxMb * 1048576) { fileInput.value = ''; toast(L(`Berkase luwih saka ${maxMb} MB.`, `Berkas lebih dari ${maxMb} MB.`), 'err'); } });
  const bar = progressBar(L('Ngunggah', 'Mengunggah'));
  let sending = null;
  onLeave(() => { if (sending) sending.abort(); });
  const consent = h('fieldset', { class: 'fieldset fieldset--consent' },
    h('legend', null, icon('shield'), L('Izin tertulis', 'Izin tertulis')),
    notice(L('se-LARAS ora nampa berkas izine. Simpen dewe berkase; se-LARAS mung nyatet jeneng pemberi izin, tanggal, lan lingkupe nang buku jejak. Jeneng pemberi izin ketok nang kaca unit.', 'se-LARAS tidak menerima berkas izinnya. Simpan sendiri berkasnya; se-LARAS hanya mencatat nama pemberi izin, tanggal, dan lingkupnya di buku jejak. Nama pemberi izin tampil di halaman unit.'), 'info', 'scroll'),
    field(L('Sapa sing nggawe izin (sing tampil nang klip)', 'Pihak yang memberi izin (yang tampil di klip)'), 'consent_holder', { required: true, maxlength: 160 }),
    h('div', { class: 'cols-2' },
      field(L('Tanggal izin', 'Tanggal izin'), 'consent_date', { type: 'date', required: true, value: todayWib(), max: todayWib() }),
      field(L('Lingkup izin (opsional)', 'Lingkup izin (opsional)'), 'consent_scope', { maxlength: 500, hint: L('Contone: dipakai nang se-LARAS kanggo latihan, ora kanggo dodolan.', 'Contoh: dipakai di se-LARAS untuk latihan, bukan untuk dijual.') })),
    check(LC('Aku wis nyekel izin tertulis saka kabeh wong sing tampil nang klip iki (lan saka wali nek umure ngisor 18 tahun) kanggo nyimpen lan nampilno klip iki nang se-LARAS.', 'Saya telah memegang izin tertulis dari semua orang yang tampil di klip ini (dan dari wali bila berusia di bawah 18 tahun) untuk menyimpan dan menampilkan klip ini di se-LARAS.'), 'consent_confirmed', { required: true }));
  const f = form([
    fileField,
    h('div', { class: 'cols-2' }, field(L('Judul (Suroboyoan)', 'Judul (Suroboyoan)'), 'title_sby', { required: true, maxlength: 120 }), field(L('Judul (Indonesia)', 'Judul (Indonesia)'), 'title_id', { required: true, maxlength: 120 })),
    field(L('Ketrampilan sing diperagakno', 'Keterampilan yang diperagakan'), 'skill', { maxlength: 120, hint: L('Contone: mandeg sak durunge guyonan, obahan tangan pas ngremo.', 'Contoh: jeda sebelum lelucon, gerak tangan saat ngremo.') }),
    h('div', { class: 'cols-2' }, field(L('Catetan (Suroboyoan)', 'Catatan (Suroboyoan)'), 'notes_sby', { type: 'textarea', rows: 3, maxlength: 2000 }), field(L('Catetan (Indonesia)', 'Catatan (Indonesia)'), 'notes_id', { type: 'textarea', rows: 3, maxlength: 2000 })),
    consent,
    h('fieldset', { class: 'fieldset' }, h('legend', null, icon('lock'), L('Akses lan panggunaan data', 'Akses dan penggunaan data')),
      h('div', { class: 'cols-2' },
        field(L('Sapa sing isok ndelok', 'Siapa yang dapat melihat'), 'access', { options: [['login', L('Sing wis mlebu', 'Yang sudah masuk')], ['public', L('Umum (terbuka)', 'Umum (terbuka)')]], value: 'login' }),
        field(L('Panggunaan data', 'Penggunaan data'), 'data_use', { options: [['tidak', L('Mung nang se-LARAS', 'Hanya di se-LARAS')], ['riset', L('Oleh dipakai riset (korpus Ludruk)', 'Boleh dipakai riset (korpus Ludruk)')]], value: 'tidak',
          hint: L('"Riset": klip sing wis disahno isok mlebu korpus sing diekspor admin. Isok diganti kapan wae, tapi salinan sing wis diekspor ora isok ditarik.', '"Riset": klip yang sudah disahkan dapat masuk korpus yang diekspor admin. Dapat diubah kapan saja, tetapi salinan yang sudah diekspor tidak dapat ditarik.') }))),
    bar,
  ], async (fd) => {
    bar.hidden = false; bar.set(0);
    sending = upload('/api/units', fd, (p) => bar.set(p));
    try { const r = await sending.promise; sending = null; toast(L('Klip wis terunggah. Analisis lagi mlaku…', 'Klip terunggah. Analisis sedang berjalan…')); go(`/maestro/${r.id}`); }
    catch (e) { sending = null; bar.hidden = true; throw e; }
  }, { submit: L('Unggah lan analisis', 'Unggah dan analisis'), ic: 'upload' });
  return h('section', { class: 'card upload', id: 'unggah', 'aria-labelledby': 'up-h' },
    h('div', { class: 'stack', style: { '--gap': '1.1rem' } },
      h('div', null, h('h2', { id: 'up-h', class: 'h-sm' }, icon('upload'), L('Unggah unit anyar', 'Unggah unit baru')), h('p', { class: 'hint' }, L('Siji unit = siji klip demonstrasi. Transkrip, momen, lan ukuran diisi sak wise unggah.', 'Satu unit = satu klip demonstrasi. Transkrip, momen, dan ukuran diisi setelah unggah.'))), f,
      h('p', { class: 'hint' }, L('Klip diproses nang server iki thok, ora dikirim nang layanan njaba.', 'Klip diproses di server ini saja, tidak dikirim ke layanan luar.'))),
    tipsAside(maxS));
}

/** Saran merekam agar analisis gerak dan jeda bisa bekerja; ini panduan teknis, bukan penilaian seni. */
function tipsAside(maxS) {
  const tips = [
    ['body', L('Awak kudu ketok kabeh', 'Seluruh badan harus terlihat'), L('Siji penampil utama nang tengah gambar, saka sirah tekan sikil. Pengukur gerak ora iso moco bagian sing kepotong.', 'Satu penampil utama di tengah gambar, dari kepala sampai kaki. Pengukur gerak tidak dapat membaca bagian yang terpotong.')],
    ['camera', L('Kamera meneng', 'Kamera diam'), L('Disandarno utowo nganggo tripod, mode lanskap. Kamera sing goyang ngowahi ukuran gerak.', 'Disandarkan atau pakai tripod, mode lanskap. Kamera yang bergoyang mengubah ukuran gerak.')],
    ['sun', L('Padhang saka ngarep', 'Terang dari depan'), L('Hindari mbelakangi cahya. Latar sing ora rame luwih gampang diwaca.', 'Hindari membelakangi cahaya. Latar yang tidak ramai lebih mudah dibaca.')],
    ['clock', L(`Cekak: ngisor ${maxS} detik`, `Singkat: di bawah ${maxS} detik`), L('Siji klip = siji keterampilan. Luwih apik 20–90 detik.', 'Satu klip = satu keterampilan. Lebih baik 20–90 detik.')],
    ['volume', L('Swara cetho', 'Suara jelas'), L('Nek ana ucapan, ojo ketutup gamelan. Iki mbantu transkrip.', 'Jika ada ucapan, jangan tertutup gamelan. Ini membantu transkrip.')],
  ];
  return h('aside', { class: 'upload__tips', 'aria-label': L('Saran ngrekam', 'Saran merekam') },
    h('h3', null, icon('camera'), L('Saran ngrekam', 'Saran merekam')),
    h('ul', { class: 'tips' }, tips.map(([ic, t, d]) => h('li', null, h('span', { class: 'tips__ic', 'aria-hidden': 'true' }, icon(ic)), h('div', null, h('strong', null, t), h('p', null, d))))),
    h('p', { class: 'hint' }, L('Hasil analisis iku perkiraan kasar saka gambar, dudu penilaian seni. Sampeyan sing nemtokno opo sing penting.', 'Hasil analisis adalah perkiraan kasar dari gambar, bukan penilaian seni. Andalah yang menentukan apa yang penting.')));
}

export async function render() {
  const { units } = await GET('/api/units?mine=1');
  const formCard = uploadCard();
  const toForm = () => { formCard.scrollIntoView({ behavior: 'smooth', block: 'start' }); const i = formCard.querySelector('input[type=file]'); if (i) setTimeout(() => i.focus({ preventScroll: true }), 400); };
  const drafts = units.filter((u) => u.status === 'draft').length;
  return h('div', null,
    pageHead({ eyebrow: L('Maestro', 'Maestro'), title: LB('Ruang maestro', 'Ruang maestro'), lead: LB('Nggawe unit latihan saka klipmu, nulis alasane, nemtokno ukuran, banjur nyahno.', 'Membuat unit latihan dari klipmu, menulis alasannya, menetapkan ukuran, lalu mengesahkan.'), kind: 'parang',
      actions: [h('button', { type: 'button', class: 'btn btn--gold', onclick: toForm }, icon('upload'), L('Unggah unit anyar', 'Unggah unit baru'))] }),
    h('div', { class: 'wrap pad stack', style: { '--gap': '2.2rem' } },
      flowStrip(),
      h('section', { class: 'stack', 'aria-labelledby': 'mu-h' }, h('div', { class: 'row row--between' }, h('h2', { id: 'mu-h' }, L('Unit sampeyan', 'Unit Anda')), units.length ? h('span', { class: 'muted', role: 'status' }, `${units.length} unit${drafts ? ` · ${drafts} ${L('durung disahno', 'belum disahkan')}` : ''}`) : null),
        units.length ? h('div', { class: 'grid grid--cards' }, units.map((u) => unitCard(u, { manage: true }))) : empty(L('Durung enek unit', 'Belum ada unit'), L('Wiwiti saka unggah klip demonstrasi nang ngisor.', 'Mulailah dengan mengunggah klip demonstrasi di bawah.'), icon('stage', { size: 56 }))),
      formCard));
}
