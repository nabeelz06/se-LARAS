// Buku jejak: catatan berantai-hash tentang izin dan pengesahan. Menjamin ketahanan terhadap perubahan diam-diam; BUKAN tanda tangan digital maestro.
import { h, icon, fmtDateTime } from '../core/dom.js';
import { GET } from '../core/api.js';
import { S } from '../core/state.js';
import { L, LB } from '../core/i18n.js';
import { badge, notice, empty, hooks } from '../core/ui.js';
import { pageHead } from '../comp/pagehead.js';

const ACT = {
  unit_dibuat: ['Maestro ngunggah unit lan nyatet izin', 'Maestro mengunggah unit dan mencatat izin', 'upload'],
  unit_disahkan: ['Maestro nyahno unit', 'Maestro mengesahkan unit', 'shield'],
  unit_dibuka_kembali: ['Unit dibukak maneh kanggo disunting', 'Unit dibuka kembali untuk disunting', 'edit'],
  unit_ditarik: ['Maestro narik unit (klip dibusak)', 'Maestro menarik unit (klip dihapus)', 'x'],
  segmen_disahkan: ['Maestro nyahno segmen transkrip', 'Maestro mengesahkan segmen transkrip', 'check'],
  momen_disahkan: ['Maestro nyahno momen lan alasane', 'Maestro mengesahkan momen dan alasannya', 'flag'],
  rubrik_ditetapkan: ['Maestro nemtokno ukuran lan toleransi', 'Maestro menetapkan ukuran dan toleransi', 'sliders'],
  istilah_disahkan: ['Istilah kamus disahno', 'Istilah kamus disahkan', 'book'],
  asr_diusulkan: ['Pengenal ujaran ngusulno transkrip (draf)', 'Pengenal ujaran mengusulkan transkrip (draf)', 'mic'],
  penampil_dipilih: ['Penampil utama dipilih', 'Penampil utama dipilih', 'users'],
  izin_data_diubah: ['Izin panggunaan data diganti', 'Izin penggunaan data diubah', 'lock'],
  persetujuan_latihan: ['Pemain nyetujoni latihane dianalisis', 'Pemain menyetujui latihannya dianalisis', 'check'],
  berbagi_ke_maestro: ['Pemain mbagekno latihan marang maestro', 'Pemain membagikan latihan kepada maestro', 'share'],
  berbagi_dicabut: ['Pemain nyabut pembagian latihan', 'Pemain mencabut pembagian latihan', 'lock'],
  latihan_dihapus: ['Latihan dibusak pemaine', 'Latihan dihapus pemainnya', 'trash'],
  latihan_dihapus_otomatis: ['Latihan kebusak otomatis (lewat wektu simpen)', 'Latihan terhapus otomatis (melewati masa simpan)', 'clock'],
  salinan_putar_dibuat: ['Salinan putar digawe (klip asli ora diganti)', 'Salinan putar dibuat (klip asli tidak diubah)', 'video'],
  kelas_dibuat: ['Kelas digawe', 'Kelas dibuat', 'users'], kelas_diikuti: ['Pemain melu kelas', 'Pemain bergabung ke kelas', 'users'], kelas_dihapus: ['Kelas dibusak', 'Kelas dihapus', 'trash'],
  akun_dihapus: ['Akun dibusak', 'Akun dihapus', 'trash'], data_diekspor_pemilik: ['Pemilik njupuk salinan datane', 'Pemilik mengambil salinan datanya', 'download'],
  dataset_diekspor: ['Admin ngekspor korpus riset (mung sing diizinke)', 'Admin mengekspor korpus riset (hanya yang diizinkan)', 'download'], peran_diubah: ['Peran pengguna diganti admin', 'Peran pengguna diubah admin', 'key'],
};
const short = (x) => (x && x.length > 16 ? `${x.slice(0, 8)}…${x.slice(-6)}` : x || '');
const KIND_NAME = { unit: 'unit', kelas: 'kelas', segmen: 'segmen', momen: 'momen', latihan: 'latihan', user: 'pengguna', istilah: 'istilah' };
function subject(s) {
  const m = /^([a-z]+):(\d+)$/.exec(s || '');
  if (!m) return h('span', null, s || '');
  const label = `${KIND_NAME[m[1]] || m[1]} #${m[2]}`;
  if (m[1] === 'unit') return h('a', { href: `#/unit/${m[2]}` }, label);
  if (m[1] === 'kelas') return h('a', { href: `#/kelas/${m[2]}` }, label);
  return h('span', null, label);
}
const ROLE_NAME = { learner: () => L('pemain', 'pemain'), maestro: () => 'maestro', admin: () => 'admin', system: () => L('sistem', 'sistem') };
const actor = (lbl) => { const m = /^([a-z]+):(.*)$/.exec(lbl || ''); if (!m) return lbl || ''; const who = ROLE_NAME[m[1]] ? ROLE_NAME[m[1]]() : m[1]; const rest = m[2].replace(/^#/, '#'); return rest ? `${who} ${rest}` : who; };
function facts(e) {
  const p = e.payload || {}, out = [];
  if (p.duration_s != null) out.push(`${L('durasi', 'durasi')} ${p.duration_s} ${L('detik', 'detik')}`);
  if (p.data_use) out.push(`${L('panggunaan data', 'penggunaan data')}: ${p.data_use}`);
  if (p.dari && p.ke) out.push(`${p.dari} → ${p.ke}`);
  if (p.alasan) out.push(`${L('alasan', 'alasan')}: ${p.alasan}`);
  if (p.segmen_sah != null) out.push(`${p.segmen_sah} ${L('segmen sah', 'segmen sah')}`);
  if (p.momen_sah != null) out.push(`${p.momen_sah} ${L('momen sah', 'momen sah')}`);
  if (Array.isArray(p.rubrik) && p.rubrik.length) out.push(`${L('ukuran', 'ukuran')}: ${p.rubrik.join(', ')}`);
  if (Array.isArray(p.dims) && p.dims.length) out.push(`${L('ukuran', 'ukuran')}: ${p.dims.map((d) => `${d.metric} ±${d.tol}%`).join(', ')}`);
  if (p.orang_terdeteksi != null) out.push(`${p.orang_terdeteksi} ${L('wong kedeteksi', 'orang terdeteksi')}`);
  if (p.dibagikan_ke_maestro != null) out.push(p.dibagikan_ke_maestro ? L('dibagi nang maestro', 'dibagikan ke maestro') : L('pribadi', 'pribadi'));
  return out;
}

export async function render() {
  const [v, d] = await Promise.all([GET('/api/ledger/verify'), GET('/api/ledger?limit=60')]);
  const verify = v.ok
    ? h('div', { class: 'verify verify--ok', role: 'status' }, h('span', { class: 'verify__ic' }, icon('shield')), h('div', null, h('strong', null, L('Rantai utuh', 'Rantai utuh')), h('p', null, L(`${v.count} entri, isi lan urutane cocok karo tanda server.`, `${v.count} entri, isi dan urutannya cocok dengan tanda server.`)), v.head ? h('p', { class: 'hint mono' }, `${L('Ujung rantai', 'Ujung rantai')}: ${short(v.head)}`) : null))
    : h('div', { class: 'verify verify--bad', role: 'alert' }, h('span', { class: 'verify__ic' }, icon('alert')), h('div', null, h('strong', null, L('Rantai putus', 'Rantai putus')), h('p', null, L(`Ana owah-owahan nang entri #${v.broken_at}: ${v.reason}.`, `Ada perubahan pada entri #${v.broken_at}: ${v.reason}.`))));
  const list = d.entries.length ? h('ol', { class: 'ledger' }, d.entries.map((e) => {
    const a = ACT[e.action], f = facts(e);
    return h('li', { class: 'ledger__item' },
      h('span', { class: 'ledger__ic' }, icon(a ? a[2] : 'scroll')),
      h('div', { class: 'ledger__body' },
        h('p', { class: 'ledger__what' }, a ? L(a[0], a[1]) : e.action, ' ', h('small', { class: 'tnum' }, `#${e.seq}`)),
        h('p', { class: 'ledger__who hint' }, fmtDateTime(e.ts), ' · ', actor(e.actor_label), ' · ', subject(e.subject)),
        f.length ? h('p', { class: 'ledger__facts' }, f.map((x) => h('span', null, x))) : null,
        h('details', { class: 'ledger__raw' }, h('summary', null, L('Rincian teknis', 'Rincian teknis')), h('pre', null, JSON.stringify({ seq: e.seq, ts: e.ts, action: e.action, subject: e.subject, payload: e.payload, hash: e.hash }, null, 2)))));
  })) : empty(L('Buku isih kosong', 'Buku masih kosong'), '');
  return h('div', null,
    pageHead({ eyebrow: L('Buku jejak', 'Buku jejak'), title: LB('Sapa nyatet opo, kapan', 'Siapa mencatat apa, kapan'), lead: LB('Persetujuan lan pengesahan dicatet berantai. Nek ana sing ngowahi catetan lawas, rantaine putus lan ketok.', 'Persetujuan dan pengesahan dicatat berantai. Bila ada yang mengubah catatan lama, rantainya putus dan terlihat.'), kind: 'parang' }),
    h('div', { class: 'wrap pad stack', style: { '--gap': '1.4rem' } }, verify,
      notice(L('Cathetan jujur: buku iki nyegah owah-owahan diem-diem. Iki DUDU tanda tangan digital maestro; tandane digawe server, lan sing nyahno yaiku sesi login maestro.', 'Catatan jujur: buku ini mencegah perubahan diam-diam. Ini BUKAN tanda tangan digital maestro; tandanya dibuat server, dan yang mengesahkan adalah sesi login maestro.'), 'info', 'shield'),
      d.redacted ? notice(L('Jeneng pihak sing menehi izin lan lingkup izin ora ditampilno nang umum; mung admin sing isok ndelok.', 'Nama pihak pemberi izin dan lingkup izin tidak ditampilkan ke publik; hanya admin yang dapat melihat.'), 'info', 'lock') : null,
      list, d.entries.length >= 60 ? h('p', { class: 'hint' }, L('Nampilno 60 entri paling anyar.', 'Menampilkan 60 entri terbaru.')) : null));
}
void S; void badge; void hooks;
