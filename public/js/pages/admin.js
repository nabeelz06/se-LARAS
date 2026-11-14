// Ruang admin: kesehatan sistem, pengguna, korpus riset, dan buku jejak. Tidak pernah menampilkan isi rekaman atau transkrip.
import { h, icon, fmtDateTime, bytes } from '../core/dom.js';
import { GET, PATCH, POST } from '../core/api.js';
import { S } from '../core/state.js';
import { L, LB } from '../core/i18n.js';
import { badge, notice, empty, modal, toast, copyText } from '../core/ui.js';
import { pageHead } from '../comp/pagehead.js';
import { mbtn } from '../comp/mkit.js';
import { onLeave } from '../core/router.js';

const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
const n0 = (o, k) => (o && o[k]) || 0;
const nf = (v) => new Intl.NumberFormat('id-ID').format(v);

const ROLE = { learner: () => L('Pemain', 'Pemain'), maestro: () => 'Maestro', admin: () => 'Admin' };
const ROLE_KIND = { learner: '', maestro: 'gold', admin: 'accent' };

function tile({ ic, label, value, sub, kind = '' }) {
  return h('li', { class: ['atile', kind ? `atile--${kind}` : ''] },
    h('span', { class: 'atile__ic', 'aria-hidden': 'true' }, icon(ic)),
    h('div', { class: 'atile__b' }, h('span', { class: 'atile__l' }, label), h('strong', { class: 'atile__v' }, value), sub ? h('span', { class: 'atile__s' }, sub) : null));
}

function tiles(o) {
  const att = o.attempts || {};
  const failed = n0(o.analysis, 'failed') + n0(o.media, 'failed');
  const led = o.ledger || {};
  return h('ul', { class: 'atiles', 'aria-label': L('Ringkasan sistem', 'Ringkasan sistem') },
    tile({ ic: 'users', label: L('Pengguna', 'Pengguna'), value: nf(sum(o.users)),
      sub: `${nf(n0(o.users, 'learner'))} ${L('pemain', 'pemain')} · ${nf(n0(o.users, 'maestro'))} maestro · ${nf(n0(o.users, 'admin'))} admin` }),
    tile({ ic: 'stage', label: L('Unit latihan', 'Unit latihan'), value: nf(sum(o.units)),
      sub: `${nf(n0(o.units, 'validated'))} ${L('disahno', 'disahkan')} · ${nf(n0(o.units, 'draft'))} draf · ${nf(n0(o.units, 'withdrawn'))} ${L('ditarik', 'ditarik')}${o.units_demo ? ` · ${nf(o.units_demo)} ${L('peragaan', 'peragaan')}` : ''}` }),
    tile({ ic: 'wave', label: L('Analisis klip', 'Analisis klip'), value: `${nf(n0(o.analysis, 'done'))}/${nf(sum(o.analysis))}`,
      sub: failed ? `${nf(failed)} ${L('gagal', 'gagal')}` : `${nf(n0(o.analysis, 'pending') + n0(o.analysis, 'running'))} ${L('nunggu/jalan', 'menunggu/berjalan')}`, kind: failed ? 'bad' : '' }),
    tile({ ic: 'mic', label: L('Latihan pemain', 'Latihan pemain'), value: nf(sum(att)),
      sub: `${nf(n0(att, 'done'))} ${L('rampung', 'selesai')} · ${nf(n0(att, 'failed'))} ${L('gagal', 'gagal')}`, kind: n0(att, 'failed') ? 'warn' : '' }),
    tile({ ic: 'layers', label: L('Panyimpenan', 'Penyimpanan'), value: bytes(o.disk ? o.disk.bytes : 0), sub: `${nf(o.disk ? o.disk.files : 0)} ${L('berkas', 'berkas')}` }),
    tile({ ic: 'scroll', label: L('Buku jejak', 'Buku jejak'), value: led.ok ? L('Utuh', 'Utuh') : L('Putus', 'Putus'),
      sub: led.ok ? `${nf(led.count)} ${L('entri', 'entri')}` : `${L('nang entri', 'pada entri')} #${led.broken_at}`, kind: led.ok ? 'ok' : 'bad' }));
}

function healthSec(o) {
  const row = (label, obj, keys) => h('tr', null, h('th', { scope: 'row' }, label), keys.map(([k]) => h('td', { class: ['num', n0(obj, k) && k === 'failed' ? 'is-bad' : ''] }, nf(n0(obj, k)))));
  const keys = [['pending', L('Nunggu', 'Menunggu')], ['running', L('Mlaku', 'Berjalan')], ['done', L('Rampung', 'Selesai')], ['failed', L('Gagal', 'Gagal')]];
  const table = h('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': L('Status analisis dan media', 'Status analisis dan media') }, h('table', { class: 'table table--compact' },
    h('caption', { class: 'sr' }, L('Status pemrosesan klip', 'Status pemrosesan klip')),
    h('thead', null, h('tr', null, h('th', { scope: 'col' }, L('Proses', 'Proses')), keys.map(([, t]) => h('th', { scope: 'col', class: 'num' }, t)))),
    h('tbody', null,
      row(L('Analisis klip maestro', 'Analisis klip maestro'), o.analysis, keys),
      row(L('Salinan putar', 'Salinan putar'), o.media, keys),
      row(L('Analisis latihan pemain', 'Analisis latihan pemain'), o.attempts, keys))));
  const fails = o.failures || [];
  return h('section', { class: 'card stack', 'aria-labelledby': 'ad-health', style: { '--gap': '.9rem' } },
    h('h2', { id: 'ad-health', class: 'h-sm' }, icon('wave'), L('Kesehatan proses', 'Kesehatan proses')), table,
    fails.length
      ? h('div', { class: 'stack', style: { '--gap': '.5rem' } }, h('h3', { class: 'h-xs' }, L('Unit sing analisise gagal', 'Unit yang analisisnya gagal')),
        h('ul', { class: 'faillist' }, fails.map((f) => h('li', null, h('a', { href: `#/maestro/${f.id}` }, `${L('Unit', 'Unit')} #${f.id}`), h('code', null, f.error || L('(ora enek keterangan)', '(tanpa keterangan)'))))))
      : notice(L('Ora enek analisis klip sing gagal.', 'Tidak ada analisis klip yang gagal.'), 'ok', 'check'));
}

function ledgerSec(o) {
  const led = o.ledger || {};
  return h('section', { class: 'card stack', 'aria-labelledby': 'ad-led', style: { '--gap': '.9rem' } },
    h('h2', { id: 'ad-led', class: 'h-sm' }, icon('scroll'), L('Buku jejak', 'Buku jejak')),
    led.ok
      ? notice(L(`Rantai hash utuh: ${nf(led.count)} entri, ora enek sing diubah utowo dibusak.`, `Rantai hash utuh: ${nf(led.count)} entri, tidak ada yang diubah atau dihapus.`), 'ok', 'shield')
      : notice(L(`Rantai putus nang entri #${led.broken_at} (${led.reason}). Periksa cadangan basis data.`, `Rantai putus pada entri #${led.broken_at} (${led.reason}). Periksa cadangan basis data.`), 'danger', 'alert'),
    led.head ? h('p', { class: 'hint' }, L('Hash ujung rantai: ', 'Hash ujung rantai: '), h('code', { class: 'hashcode' }, led.head)) : null,
    h('p', { class: 'hint' }, L('Rantai ini cuma nuduhno ora enek entri sing diubah diam-diam. Iki dudu tanda tangan digital maestro, lan ora nggantekno arsip izin tertulis.', 'Rantai ini hanya menunjukkan tidak ada entri yang diubah diam-diam. Ini bukan tanda tangan digital maestro, dan tidak menggantikan arsip izin tertulis.')),
    h('div', { class: 'row' }, h('a', { class: 'btn btn--line btn--sm', href: '#/jejak' }, icon('scroll'), L('Delok buku jejak', 'Lihat buku jejak'))));
}

async function usersSec() {
  const { users } = await GET('/api/users');
  const me = S.user ? S.user.id : null;
  const body = h('tbody');
  const paint = (list) => {
    body.replaceChildren(...list.map((u) => {
      const sel = h('select', { class: 'select select--sm', 'aria-label': `${L('Peran', 'Peran')} ${u.name}`, disabled: u.id === me, title: u.id === me ? L('Peran dhewe ora bisa diganti saka kene', 'Peran sendiri tidak dapat diubah dari sini') : null },
        ['learner', 'maestro', 'admin'].map((r) => h('option', { value: r, selected: r === u.role }, ROLE[r]())));
      sel.addEventListener('change', async () => {
        const to = sel.value, from = u.role;
        sel.disabled = true;
        try { await PATCH(`/api/users/${u.id}/role`, { role: to }); u.role = to; toast(L(`Peran ${u.name} dadi ${ROLE[to]()}.`, `Peran ${u.name} menjadi ${ROLE[to]()}.`)); }
        catch (e) { sel.value = from; toast(e.message, 'err'); } finally { sel.disabled = false; }
      });
      return h('tr', null, h('th', { scope: 'row' }, h('span', { class: 'uname' }, u.name), u.id === me ? badge(L('sampeyan', 'Anda'), 'accent') : null),
        h('td', { class: 'mono' }, u.email), h('td', null, sel), h('td', { class: 'nowrap' }, fmtDateTime(u.created_at)));
    }));
  };
  paint(users);
  const q = h('input', { class: 'input input--sm', type: 'search', placeholder: L('Goleki jeneng utowo email…', 'Cari nama atau email…'), 'aria-label': L('Goleki pengguna', 'Cari pengguna') });
  q.addEventListener('input', () => { const t = q.value.trim().toLowerCase(); paint(t ? users.filter((u) => u.name.toLowerCase().includes(t) || u.email.toLowerCase().includes(t)) : users); });
  return h('section', { class: 'card stack', 'aria-labelledby': 'ad-users', style: { '--gap': '.9rem' } },
    h('h2', { id: 'ad-users', class: 'h-sm' }, icon('users'), L('Pengguna', 'Pengguna'), h('span', { class: 'mcount' }, users.length)),
    notice(L('Maestro bisa unggah unit lan nyahno. Admin bisa ngatur peran lan delok ringkasan iki, ananging ora bisa nyahno unit kanggo maestro. Ganti peran dicatet nang buku jejak.', 'Maestro dapat mengunggah dan mengesahkan unit. Admin dapat mengatur peran dan melihat ringkasan ini. Perubahan peran dicatat di buku jejak.'), 'info', 'key'),
    h('div', { class: 'row row--end' }, q),
    h('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': L('Daftar pengguna', 'Daftar pengguna') }, h('table', { class: 'table table--compact table--users' },
      h('caption', { class: 'sr' }, L('Daftar pengguna', 'Daftar pengguna')),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, L('Jeneng', 'Nama')), h('th', { scope: 'col' }, 'Email'), h('th', { scope: 'col' }, L('Peran', 'Peran')), h('th', { scope: 'col' }, L('Daftar', 'Terdaftar')))),
      body)));
}

function datasetSec(o, ds) {
  const t = ds.totals || {};
  const showCard = async () => {
    const res = await fetch('/api/admin/datacard', { credentials: 'same-origin' });
    if (!res.ok) throw new Error(L('Gagal njupuk kartu data', 'Gagal mengambil kartu data'));
    const md = await res.text();
    modal({ title: L('Kartu data (datacard)', 'Kartu data (datacard)'), wide: true,
      body: h('div', { class: 'stack', style: { '--gap': '.8rem' } }, h('pre', { class: 'datacard', tabindex: '0' }, md),
        h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn btn--line btn--sm', onclick: () => copyText(md) }, icon('copy'), L('Salin', 'Salin')))),
      actions: [{ label: L('Tutup', 'Tutup'), value: true, cls: 'btn--primary' }] });
  };
  const empty0 = !t.units;
  return h('section', { class: 'card stack', 'aria-labelledby': 'ad-ds', style: { '--gap': '.9rem' } },
    h('h2', { id: 'ad-ds', class: 'h-sm' }, icon('layers'), L('Korpus riset', 'Korpus riset')),
    h('dl', { class: 'dl dl--tight dl--cols' },
      [[L('Unit', 'Unit'), nf(t.units || 0)], [L('Maestro beda', 'Maestro berbeda'), nf(t.speakers || 0)], [L('Durasi', 'Durasi'), t.hours ? `${String(t.hours).replace('.', ',')} ${L('jam', 'jam')}` : '0'],
        [L('Segmen sah', 'Segmen sah'), nf(t.segments || 0)], [L('Kata Suroboyoan', 'Kata Suroboyoan'), nf(t.words_sby || 0)], [L('Momen sah', 'Momen sah'), nf(t.markers || 0)]]
        .map(([k, v]) => h('div', null, h('dt', null, k), h('dd', null, v)))),
    empty0
      ? notice(L('Korpus iki kosong. Durung enek klip sing disahno maestro lan ditandai entuk dienggo riset. se-LARAS ora nggawa data Ludruk bawaan.', 'Korpus ini kosong. Belum ada klip yang disahkan maestro dan ditandai boleh dipakai riset. se-LARAS tidak membawa data Ludruk bawaan.'), 'warn', 'alert')
      : notice(L('Mung klip sing disahno, entuk dienggo riset, dudu data peragaan, lan berkase isih cocok hash-e sing melu. Rekaman latihan pemain ora tau melu.', 'Hanya klip yang disahkan, boleh dipakai riset, bukan data peragaan, dan berkasnya masih cocok hash-nya yang ikut. Rekaman latihan pemain tidak pernah ikut.'), 'info', 'shield'),
    (ds.skipped || []).length ? notice(`${L('Dilewati amergo integritas', 'Dilewati karena integritas')}: ${ds.skipped.map((s) => `${L('unit', 'unit')} ${s.unit_id} (${s.alasan})`).join('; ')}`, 'warn', 'alert') : null,
    (ds.units || []).length ? h('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': L('Unit dalam korpus data', 'Unit dalam korpus data') }, h('table', { class: 'table table--compact' },
      h('caption', { class: 'sr' }, L('Unit sing melu korpus', 'Unit yang ikut korpus')),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, L('Unit', 'Unit')), h('th', { scope: 'col' }, L('Penutur', 'Penutur')), h('th', { scope: 'col', class: 'num' }, L('Detik', 'Detik')), h('th', { scope: 'col', class: 'num' }, L('Segmen', 'Segmen')), h('th', { scope: 'col', class: 'num' }, L('Momen', 'Momen')))),
      h('tbody', null, ds.units.map((u) => h('tr', null, h('th', { scope: 'row' }, h('a', { href: `#/unit/${u.unit_id}` }, u.title_id || `#${u.unit_id}`)), h('td', { class: 'mono' }, u.speaker_key), h('td', { class: 'num' }, nf(Math.round(u.duration_s || 0))), h('td', { class: 'num' }, nf(u.segments)), h('td', { class: 'num' }, nf(u.markers))))))) : null,
    h('p', { class: 'hint' }, `${L('Riset sing diizinke', 'Berkas yang berizin riset')}: ${nf(o.data_use_riset || 0)} ${L('unit', 'unit')}. ${L('Isi korpus durung cukup kanggo nglatih model; delok kartu data kanggo cathetan jujur.', 'Isi korpus belum cukup untuk melatih model; lihat kartu data untuk catatan jujur.')}`),
    h('div', { class: 'row' }, mbtn(L('Delok kartu data', 'Lihat kartu data'), showCard, { ic: 'book', cls: 'btn btn--line btn--sm' })));
}

function maintSec(reload) {
  return h('section', { class: 'card stack', 'aria-labelledby': 'ad-mt', style: { '--gap': '.9rem' } },
    h('h2', { id: 'ad-mt', class: 'h-sm' }, icon('settings'), L('Pangreksa', 'Pemeliharaan')),
    h('p', null, L('Rekaman latihan pemain disimpen paling suwe 30 dina, kajaba dibusak luwih disik. Sistem mbusak sing kadaluwarsa dhewe; tombol iki mbusak saiki.', 'Rekaman latihan pemain disimpan paling lama 30 hari, kecuali dihapus lebih dulu. Sistem menghapus yang kedaluwarsa sendiri; tombol ini menghapus sekarang.')),
    h('div', { class: 'row' },
      mbtn(L('Busak latihan kadaluwarsa', 'Hapus latihan kedaluwarsa'), async () => { const r = await POST('/api/admin/purge'); const n = Number(r.purged) || 0; toast(L(`Kebusak: ${n} latihan.`, `Terhapus: ${n} latihan.`)); reload(); },
        { ic: 'trash', confirm: L('Latihan pemain sing wis liwat 30 dina bakal dibusak permanen.', 'Latihan pemain yang sudah lewat 30 hari akan dihapus permanen.'), confirmTitle: L('Busak latihan kadaluwarsa?', 'Hapus latihan kedaluwarsa?'), danger: true }),
      mbtn(L('Segarno', 'Segarkan'), async () => reload(), { ic: 'refresh', cls: 'btn btn--ghost btn--sm' })));
}

export async function render() {
  const [o, ds] = await Promise.all([GET('/api/admin/overview'), GET('/api/admin/dataset')]);
  const host = h('div', { class: 'wrap pad stack', style: { '--gap': '1.6rem' } });
  let alive = true;
  const reload = async () => {
    try { const [o2, ds2] = await Promise.all([GET('/api/admin/overview'), GET('/api/admin/dataset')]); if (alive) await fill(o2, ds2); } catch (e) { toast(e.message, 'err'); }
  };
  async function fill(o1, ds1) {
    const users = await usersSec();
    host.replaceChildren(
      h('p', { class: 'hint asof' }, icon('clock', { cls: 'icon--sm' }), `${L('Dicuplik', 'Dicuplik')} ${fmtDateTime(o1.generated_at)} · ${L('skema basis data', 'skema basis data')} v${o1.schema_version}`),
      tiles(o1),
      h('div', { class: 'cols-2 cols-2--wide' }, healthSec(o1), ledgerSec(o1)),
      users, datasetSec(o1, ds1), maintSec(reload));
  }
  await fill(o, ds);
  const root = h('div', null,
    pageHead({ eyebrow: 'Admin', title: LB('Ruang admin', 'Ruang admin'), lead: LB('Kesehatan sistem, pengguna, lan korpus riset. Kaca iki ora nampilno isi rekaman utowo transkrip.', 'Kesehatan sistem, pengguna, dan korpus riset. Halaman ini tidak menampilkan isi rekaman atau transkrip.'), kind: 'ceplok' }),
    host);
  onLeave(() => { alive = false; });
  return root;
}
