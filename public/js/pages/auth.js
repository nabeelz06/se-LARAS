// Masuk, daftar (dengan persetujuan pemrosesan data pribadi), dan halaman akun (profil, ekspor data, hapus akun).
import { h, icon, fmtDate } from '../core/dom.js';
import { GET, POST, PATCH, DEL } from '../core/api.js';
import { S, isStaff, isAdmin } from '../core/state.js';
import { L, LB, LC } from '../core/i18n.js';
import { badge, notice, field, check, form, toast, hooks, confirmDialog } from '../core/ui.js';
import { go } from '../core/router.js';
import { logoMark } from '../art/ornament.js';
import { motifBg } from '../art/motif.js';
import { pageHead } from '../comp/pagehead.js';

const safeNext = (n) => (typeof n === 'string' && /^\/[A-Za-z0-9/_\-?=&%.]*$/.test(n) && !n.startsWith('//') ? n : '/');
const ROLE = { learner: () => L('Pemain / pelajar', 'Pemain / pelajar'), maestro: () => L('Maestro / praktisi', 'Maestro / praktisi'), admin: () => L('Admin', 'Admin') };

function shell(title, sub, body, side) {
  return h('div', { class: 'authwrap' },
    h('aside', { class: 'authart', 'aria-hidden': 'true' }, motifBg('kawung', { cell: 64, cls: 'authart__bg' }), h('div', { class: 'authart__in' }, logoMark({ size: 64 }), h('p', { class: 'authart__tag' }, L('Dokumentasi maestro, dilestarekno bareng-bareng.', 'Dokumentasi maestro, dilestarikan bersama-sama.')), side || null)),
    h('div', { class: 'authcard' }, h('div', { class: 'authcard__in stack', style: { '--gap': '1.1rem' } }, h('h1', null, title), sub ? h('p', { class: 'lead' }, sub) : null, body)));
}

export async function login(_p, q) {
  if (S.user) { go(safeNext(q.get('next'))); return h('div'); }
  const next = safeNext(q.get('next'));
  const f = form([
    field('Email', 'email', { type: 'email', required: true, autocomplete: 'username', maxlength: 120 }),
    field(L('Tembung sandi', 'Kata sandi'), 'password', { type: 'password', required: true, autocomplete: 'current-password', maxlength: 200 }),
  ], async (fdata) => { await POST('/api/auth/login', { email: fdata.get('email'), password: fdata.get('password') }); await hooks.session(); toast(L('Wilujeng rawuh', 'Selamat datang')); go(next); }, { submit: L('Mlebu', 'Masuk'), ic: 'arrow-right' });
  const demo = S.about && S.about.demo;
  const demoBox = demo ? h('div', { class: 'card card--soft stack', style: { '--gap': '.6rem' } }, h('h2', { class: 'h-sm' }, icon('key'), L('Mode peragaan', 'Mode peragaan')),
    h('p', { class: 'hint' }, L('Akun contoh iki mung kanggo nyoba. Isine dudu konten maestro.', 'Akun contoh ini hanya untuk mencoba. Isinya bukan konten maestro.')),
    h('div', { class: 'actions' }, demo.accounts.map((a) => h('button', { type: 'button', class: 'btn btn--line btn--sm', onclick: async () => { try { await POST('/api/auth/login', { email: a.email, password: demo.password }); await hooks.session(); go(next); } catch (e) { toast(e.message, 'err'); } } }, ({ murid: L('Murid', 'Murid'), maestro: 'Maestro', admin: 'Admin' })[a.role] || a.role)))) : null;
  return shell(L('Mlebu', 'Masuk'), LB('Mlebu kanggo latihan, nyimpen kemajuan, lan melu kelas.', 'Masuk untuk berlatih, menyimpan kemajuan, dan mengikuti kelas.'), h('div', { class: 'stack', style: { '--gap': '1.1rem' } }, f, demoBox,
    h('p', null, L('Durung duwe akun? ', 'Belum punya akun? '), h('a', { href: '#/daftar' }, L('Daftar', 'Daftar')))));
}

export async function register() {
  if (S.user) { go('/saya'); return h('div'); }
  const f = form([
    field(L('Jeneng', 'Nama'), 'name', { required: true, autocomplete: 'name', maxlength: 80 }),
    field('Email', 'email', { type: 'email', required: true, autocomplete: 'username', maxlength: 120 }),
    field(L('Tembung sandi', 'Kata sandi'), 'password', { type: 'password', required: true, autocomplete: 'new-password', maxlength: 200, hint: L('Minimal 8 karakter.', 'Minimal 8 karakter.') }),
    check(LC('Aku setuju data pribadiku (jeneng lan email) diproses se-LARAS kanggo ngatur akun lan latihanku, miturut UU Pelindungan Data Pribadi (UU 27/2022). Isok dibusak kapan wae.', 'Saya setuju data pribadi saya (nama dan email) diproses se-LARAS untuk mengelola akun dan latihan saya, sesuai UU Pelindungan Data Pribadi (UU 27/2022). Dapat dihapus kapan saja.'), 'consent', { required: true }),
  ], async (fdata) => { await POST('/api/auth/register', { name: fdata.get('name'), email: fdata.get('email'), password: fdata.get('password'), consent: fdata.get('consent') === 'true' }); await hooks.session(); toast(L('Akun wis digawe', 'Akun dibuat')); go('/unit'); }, { submit: L('Daftar', 'Daftar'), ic: 'check' });
  return shell(L('Daftar', 'Daftar'), LB('Akun anyar dadi pemain. Peran maestro diwenehno admin sak wise dicocokno.', 'Akun baru berperan sebagai pemain. Peran maestro diberikan admin setelah diverifikasi.'), h('div', { class: 'stack', style: { '--gap': '1.1rem' } }, f, h('p', null, L('Wis duwe akun? ', 'Sudah punya akun? '), h('a', { href: '#/masuk' }, L('Mlebu', 'Masuk')))));
}

export async function account() {
  const u = S.user;
  const pf = S.profile || {};
  const head = pageHead({ eyebrow: L('Akun', 'Akun'), title: u.name, meta: [badge(ROLE[u.role] ? ROLE[u.role]() : u.role, 'gold', 'user'), ' ', h('span', null, u.email)] });
  const profileForm = isStaff() ? h('section', { class: 'card stack', 'aria-labelledby': 'pf-h' }, h('h2', { id: 'pf-h', class: 'h-sm' }, icon('drum'), L('Profil maestro', 'Profil maestro')), h('p', { class: 'hint' }, L('Tampil nang kaca unit sampeyan.', 'Tampil di halaman unit Anda.')),
    form([field(L('Sanggar / kelompok', 'Sanggar / kelompok'), 'sanggar', { value: pf.sanggar || '', maxlength: 120 }), field(L('Daerah', 'Daerah'), 'region', { value: pf.region || 'Surabaya', maxlength: 80 }), field(L('Profil singkat', 'Profil singkat'), 'bio', { type: 'textarea', rows: 4, value: pf.bio || '', maxlength: 800, hint: L('Cukup tulis sing sampeyan yakin, tanpa klaim sing ora isok dibuktekno.', 'Cukup tulis yang Anda yakini, tanpa klaim yang tidak dapat dibuktikan.') })],
      async (fdata) => { await PATCH('/api/me/profile', { sanggar: fdata.get('sanggar'), region: fdata.get('region'), bio: fdata.get('bio') }); await hooks.session(); toast(L('Profil disimpen', 'Profil disimpan')); }, { submit: L('Simpen profil', 'Simpan profil'), ic: 'check' })) : null;
  const logout = h('button', { type: 'button', class: 'btn btn--line', onclick: async () => { try { await POST('/api/auth/logout'); await hooks.session(); toast(L('Wis metu', 'Sudah keluar')); go('/'); } catch (e) { toast(e.message, 'err'); } } }, icon('logout'), L('Metu', 'Keluar'));
  const del = h('button', { type: 'button', class: 'btn btn--danger', onclick: async () => {
    const ok = await confirmDialog({ title: L('Busak akun?', 'Hapus akun?'), body: L('Akun, latihan, lan catetan kemajuan sampeyan bakal dibusak permanen. Nek sampeyan maestro, unit lan klip sampeyan uga ilang. Iki ora isok dibalekno.', 'Akun, latihan, dan catatan kemajuan Anda akan dihapus permanen. Bila Anda maestro, unit dan klip Anda juga hilang. Ini tidak dapat dikembalikan.'), confirm: L('Busak permanen', 'Hapus permanen'), danger: true, requireText: 'HAPUS' });
    if (!ok) return;
    try { await DEL('/api/me'); await hooks.session(); toast(L('Akun wis dibusak', 'Akun sudah dihapus')); go('/'); } catch (e) { toast(e.message, 'err'); }
  } }, icon('trash'), L('Busak akun', 'Hapus akun'));
  const work = isStaff() ? h('section', { class: 'card stack', 'aria-labelledby': 'wk-h' }, h('h2', { id: 'wk-h', class: 'h-sm' }, icon('drum'), L('Ruang kerja', 'Ruang kerja')),
    h('div', { class: 'actions' }, h('a', { class: 'btn btn--line', href: '#/maestro' }, icon('drum'), L('Ruang maestro', 'Ruang maestro')), isAdmin() ? h('a', { class: 'btn btn--line', href: '#/admin' }, icon('settings'), L('Ruang admin', 'Ruang admin')) : null)) : null;
  return h('div', null, head, h('div', { class: 'wrap pad stack', style: { '--gap': '1.4rem' } },
    work,
    h('div', { class: 'grid grid--2' },
      h('section', { class: 'card stack', 'aria-labelledby': 'dt-h' }, h('h2', { id: 'dt-h', class: 'h-sm' }, icon('shield'), L('Data sampeyan', 'Data Anda')),
        h('p', null, L('Sampeyan duwe hak ndelok, njupuk, lan mbusak data pribadi sampeyan (UU 27/2022).', 'Anda berhak melihat, mengambil, dan menghapus data pribadi Anda (UU 27/2022).')),
        h('div', { class: 'actions' }, h('a', { class: 'btn btn--line', href: '/api/me/export', download: 'data-laras-saya.json' }, icon('download'), L('Undhuh data (JSON)', 'Unduh data (JSON)')), h('a', { class: 'btn btn--line', href: '#/kemajuan' }, icon('chart'), L('Kemajuan lan latihan', 'Kemajuan dan latihan'))),
        h('p', { class: 'hint' }, L(`Rekaman latihan kebusak otomatis sak wise ${(S.about && S.about.retention_days) || 30} dino.`, `Rekaman latihan terhapus otomatis setelah ${(S.about && S.about.retention_days) || 30} hari.`))),
      h('section', { class: 'card stack', 'aria-labelledby': 'ss-h' }, h('h2', { id: 'ss-h', class: 'h-sm' }, icon('lock'), L('Sesi lan akun', 'Sesi dan akun')), h('div', { class: 'actions' }, logout, del), h('p', { class: 'hint' }, L('Busak akun ngilangno kabeh datamu saka server iki.', 'Menghapus akun menghilangkan semua datamu dari server ini.')))),
    profileForm));
}
void fmtDate; void notice;
