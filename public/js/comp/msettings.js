// Pengaturan unit untuk maestro: keterangan, izin tercatat, hasil analisis klip, penampil utama, latihan yang dibagikan, dan penarikan unit.
import { h, icon, mmss, num, fmtDate, fmtDateTime } from '../core/dom.js';
import { POST, PATCH } from '../core/api.js';
import { go } from '../core/router.js';
import { L } from '../core/i18n.js';
import { badge, notice, field, form, toast } from '../core/ui.js';
import { STATUS } from '../core/i18n.js';
import { personPicker } from './personpick.js';
import { warnText } from '../core/warnings.js';
import { mbtn, fdObj } from './mkit.js';

const sec = (id, ic, title, ...kids) => h('section', { class: 'msec', 'aria-labelledby': id }, h('h3', { id, class: 'msec__h' }, icon(ic), title), ...kids);
const REOPEN = () => L('Unit iki wis disahno. Ngganti keterangan, akses, utowo panggunaan data bakal mbalekno unit nang draf nganti disahno maneh.', 'Unit ini sudah disahkan. Mengubah keterangan, akses, atau penggunaan data akan mengembalikan unit ke draf sampai disahkan lagi.');

function metaForm(ctx) {
  const { u, reload } = ctx;
  const f = form([
    h('div', { class: 'cols-2' }, field(L('Judul (Suroboyoan)', 'Judul (Suroboyoan)'), 'title_sby', { required: true, maxlength: 120, value: u.title_sby }), field(L('Judul (Indonesia)', 'Judul (Indonesia)'), 'title_id', { required: true, maxlength: 120, value: u.title_id })),
    field(L('Ketrampilan sing diperagakno', 'Keterampilan yang diperagakan'), 'skill', { maxlength: 120, value: u.skill }),
    h('div', { class: 'cols-2' }, field(L('Catetan (Suroboyoan)', 'Catatan (Suroboyoan)'), 'notes_sby', { type: 'textarea', rows: 3, maxlength: 2000, value: u.notes_sby }), field(L('Catetan (Indonesia)', 'Catatan (Indonesia)'), 'notes_id', { type: 'textarea', rows: 3, maxlength: 2000, value: u.notes_id })),
    h('div', { class: 'cols-2' },
      field(L('Sapa sing isok ndelok', 'Siapa yang dapat melihat'), 'access', { options: [['login', L('Sing wis mlebu', 'Yang sudah masuk')], ['public', L('Umum (terbuka)', 'Umum (terbuka)')]], value: u.access }),
      field(L('Panggunaan data', 'Penggunaan data'), 'data_use', { options: [['tidak', L('Mung nang se-LARAS', 'Hanya di se-LARAS')], ['riset', L('Oleh dipakai riset (korpus Ludruk)', 'Boleh dipakai riset (korpus Ludruk)')]], value: u.data_use || 'tidak',
        hint: L('Isok diganti kapan wae, tapi salinan sing wis diekspor ora isok ditarik.', 'Dapat diubah kapan saja, tetapi salinan yang sudah diekspor tidak dapat ditarik.') }))],
  async (fdata) => {
    const o = fdObj(fdata), body = {};
    for (const k of ['title_sby', 'title_id', 'skill', 'notes_sby', 'notes_id', 'access', 'data_use']) if ((o[k] || '') !== (u[k] || (k === 'data_use' ? 'tidak' : ''))) body[k] = (o[k] || '').trim();
    if (!Object.keys(body).length) { toast(L('Ora enek sing diganti', 'Tidak ada yang diubah')); return; }
    await PATCH(`/api/units/${u.id}`, body);
    toast(L('Keterangan disimpen', 'Keterangan disimpan'));
    await reload();
  }, { submit: L('Simpen keterangan', 'Simpan keterangan'), ic: 'check' });
  return sec('ms-meta', 'edit', L('Keterangan unit', 'Keterangan unit'), u.status === 'validated' ? notice(REOPEN(), 'warn') : null, f);
}

function consentSec(ctx) {
  const { u } = ctx, c = u.consent || {};
  return sec('ms-consent', 'shield', L('Izin tertulis (kacek diganti)', 'Izin tertulis (tidak dapat diubah)'),
    h('dl', { class: 'dl' }, h('dt', null, L('Sing diizini (tampil nang klip)', 'Pemberi izin (tampil di klip)')), h('dd', null, c.holder || '–'), h('dt', null, L('Tanggal izin', 'Tanggal izin')), h('dd', null, c.date ? fmtDate(c.date) : '–'),
      c.scope ? [h('dt', null, L('Lingkup', 'Lingkup')), h('dd', null, c.scope)] : null),
    h('p', { class: 'hint' }, L('Izin dicatet nang buku jejak pas unggah, dadi ora isok disunting. Nek enek sing salah, tarik unit iki lan unggah ulang karo izin sing bener. se-LARAS ora nyimpen berkas izine; simpenen dewe.', 'Izin dicatat di buku jejak saat unggah, sehingga tidak dapat disunting. Jika ada yang salah, tarik unit ini dan unggah ulang dengan izin yang benar. se-LARAS tidak menyimpan berkas izinnya; simpan sendiri.')));
}

function analysisSec(ctx) {
  const { d, u, reload } = ctx, a = d.analysis, running = u.analysis_status === 'pending' || u.analysis_status === 'running';
  const rows = [];
  if (u.duration_s) rows.push([L('Dowo klip', 'Panjang klip'), mmss(u.duration_s)]);
  if (a && a.audio) {
    const au = a.audio;
    if (au.speech_ratio != null) rows.push([L('Porsi ngomong', 'Porsi bicara'), `${num(au.speech_ratio * 100, 0)}%`]);
    if (au.pause_count != null) rows.push([L('Jeda kedeteksi', 'Jeda terdeteksi'), String(au.pause_count)]);
    if (au.snr_est_db != null) rows.push([L('Rasio swara:rame (kiro-kiro)', 'Rasio suara:derau (perkiraan)'), `${num(au.snr_est_db, 1)} dB`]);
  }
  if (a && a.pose) rows.push([L('Bingkai awak kedeteksi', 'Bingkai tubuh terdeteksi'), a.pose.detection_rate != null ? `${num(a.pose.detection_rate * 100, 0)}%` : '–']);
  if (a && a.persons) rows.push([L('Wong nang video', 'Orang di video'), String(a.persons.count_median)]);
  if (a && a.engine) rows.push([L('Mesin', 'Mesin'), [a.engine.suara, a.engine.orang, a.engine.pose].filter(Boolean).join(' · ')]);
  const warns = (a && a.warnings) || [];
  return sec('ms-analysis', 'chart', L('Asil analisis klip', 'Hasil analisis klip'),
    h('div', { class: 'chips' }, badge(STATUS[u.analysis_status] ? STATUS[u.analysis_status]() : u.analysis_status, u.analysis_status === 'done' ? 'ok' : u.analysis_status === 'failed' ? 'danger' : 'info'),
      u.media_status === 'running' ? badge(L('Nyiapno salinan puter', 'Menyiapkan salinan putar'), 'info') : u.media_status === 'failed' ? badge(L('Salinan puter gagal (klip asli tetep dimuter)', 'Salinan putar gagal (klip asli tetap diputar)'), 'warn') : null),
    u.analysis_status === 'failed' && u.analysis_error ? notice(u.analysis_error, 'danger') : null,
    rows.length ? h('dl', { class: 'dl dl--tight' }, rows.flatMap(([k, v]) => [h('dt', null, k), h('dd', { class: 'tnum' }, v)])) : null,
    warns.length ? h('ul', { class: 'warnlist' }, warns.map((w) => h('li', null, icon('alert', { cls: 'icon--sm' }), warnText(w)))) : null,
    h('div', { class: 'actions' }, mbtn(L('Analisis ulang', 'Analisis ulang'), async () => { await POST(`/api/units/${u.id}/reanalyze`); toast(L('Analisis ulang diwiwiti', 'Analisis ulang dimulai')); await reload(); },
      { ic: 'refresh', disabled: running, confirmTitle: L('Analisis ulang', 'Analisis ulang'), confirm: u.status === 'validated' ? L('Angka acuan bisa rada obah. Unit tetep disahno, tapi cek maneh ukurane sak wise rampung.', 'Angka acuan bisa sedikit berubah. Unit tetap disahkan, tetapi periksa lagi ukurannya setelah selesai.') : null })),
    h('p', { class: 'hint' }, L('Analisis mlaku nang server iki thok. Kabeh angka iku deskriptif, dudu penilaian.', 'Analisis berjalan di server ini saja. Semua angka bersifat deskriptif, bukan penilaian.')));
}

function personsSec(ctx) {
  const { u, persons, reload } = ctx;
  if (!persons || !persons.tracks || persons.tracks.length < 2 || !u.is_video) return null;
  return sec('ms-persons', 'users', L('Penampil utama', 'Penampil utama'), personPicker({
    persons, duration: u.duration_s, framePath: `/api/units/${u.id}/frame`, id: 'mpick', title: L('Sapa sing diukur?', 'Siapa yang diukur?'),
    intro: L('Ono luwih saka siji wong nang video. Pilih wong sing obahane dadi acuan; ukuran obahan mung ngetutno wong iku.', 'Ada lebih dari satu orang di video. Pilih orang yang geraknya menjadi acuan; ukuran gerak hanya mengikuti orang itu.'),
    hint: L('Pilihan iki mulai analisis ulang. Nek unit wis disahno, unit bali nang draf.', 'Pilihan ini memulai analisis ulang. Jika unit sudah disahkan, unit kembali ke draf.'),
    alt: L('Bingkai saka klip acuan', 'Bingkai dari klip acuan'), onChoose: async (tid) => { await POST(`/api/units/${u.id}/performer`, { track_id: tid }); await reload(); },
  }));
}

function attemptsSec(ctx) {
  const days = (ctx.about && ctx.about.retention_days) || 30, list = ctx.attempts || [];
  return sec('ms-att', 'users', L('Latihan sing dibagekno pelajar', 'Latihan yang dibagikan pelajar'),
    list.length ? h('ul', { class: 'attlist' }, list.map((a) => h('li', null, h('a', { href: `#/latihan/${a.id}` }, icon('video', { cls: 'icon--sm' }), a.learner), h('span', { class: 'muted' }, fmtDateTime(a.created_at)), badge(STATUS[a.status] ? STATUS[a.status]() : a.status, a.status === 'done' ? 'ok' : a.status === 'failed' ? 'danger' : 'info'))))
      : h('p', { class: 'muted' }, L(`Durung enek pelajar sing mbagekno latihane. Pelajar milih dewe, lan rekamane otomatis kebusak sak wise ${days} dino.`, `Belum ada pelajar yang membagikan latihannya. Pelajar memilih sendiri, dan rekamannya otomatis terhapus setelah ${days} hari.`)));
}

function dangerSec(ctx) {
  const { u } = ctx;
  return h('section', { class: 'msec msec--danger', 'aria-labelledby': 'ms-danger' }, h('h3', { id: 'ms-danger', class: 'msec__h' }, icon('alert'), L('Tarik unit', 'Tarik unit')),
    h('p', null, L('Narik unit mbusak klip, salinan puter, lan hasil analisise saka server, lan unit ora ketok maneh nang pelajar. Catetan nang buku jejak (tanggal lan hash) tetep ono lan ora isok dibusak.', 'Menarik unit menghapus klip, salinan putar, dan hasil analisisnya dari server, dan unit tidak tampak lagi bagi pelajar. Catatan di buku jejak (tanggal dan hash) tetap ada dan tidak dapat dihapus.')),
    mbtn(L('Tarik unit iki', 'Tarik unit ini'), async () => { await POST(`/api/units/${u.id}/withdraw`); toast(L('Unit ditarik. Klip wis dibusak.', 'Unit ditarik. Klip sudah dihapus.')); go('/maestro'); },
      { cls: 'btn btn--danger', ic: 'trash', danger: true, requireText: 'TARIK', confirmTitle: L('Tarik unit iki?', 'Tarik unit ini?'),
        confirm: L('Klip lan analisise bakal dibusak permanen. Iki ora isok dibatalno. Kanggo nerusno, ketik TARIK.', 'Klip dan analisisnya akan dihapus permanen. Ini tidak dapat dibatalkan. Untuk melanjutkan, ketik TARIK.') }));
}

export function settingsPanel(ctx) {
  return h('div', { class: 'stack mpanel msecs', style: { '--gap': '1.6rem' } }, metaForm(ctx), consentSec(ctx), analysisSec(ctx), personsSec(ctx), attemptsSec(ctx), dangerSec(ctx));
}
