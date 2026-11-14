// Kelas: jalur belajar yang disusun satu maestro dari unitnya, diikuti pemain lewat kode gabung. Bergabung = izin agar pemilik melihat catatan kemajuan di kelas itu.
import { h, icon, fmtDate } from '../core/dom.js';
import { GET, POST, PATCH, DEL } from '../core/api.js';
import { S, isStaff } from '../core/state.js';
import { L, LB, LC, pick, STATUS } from '../core/i18n.js';
import { badge, notice, empty, field, check, form, toast, act, hooks, confirmDialog, copyText } from '../core/ui.js';
import { go } from '../core/router.js';
import { pageHead } from '../comp/pagehead.js';

const dots = (p) => h('span', { class: 'mini', role: 'img', 'aria-label': p ? `Nyebeng ${p.nyebeng_at ? '✓' : '–'}, Tedean ${p.tedean_n ? p.tedean_n + '×' : '–'}, Ngelmu ${p.ngelmu_at ? '✓' : '–'}` : L('Durung ana kemajuan', 'Belum ada kemajuan') },
  [['nyebeng', p && p.nyebeng_at], ['tedean', p && p.tedean_n > 0], ['ngelmu', p && p.ngelmu_at]].map(([k, on]) => h('i', { class: on ? 'on' : '', title: k })));

export async function render() {
  const d = await GET('/api/classes');
  const joinForm = form([
    field(L('Kode kelas', 'Kode kelas'), 'code', { required: true, maxlength: 12, autocomplete: 'off', inputCls: 'input--code', hint: L('Enem aksara/angka saka maestro.', 'Enam huruf/angka dari maestro.') }),
    check(LC('Aku ngeculno maestro pemilik kelas ndelok catetan kemajuanku (nyebeng, tedean, ngelmu) nang kelas iki. Rekaman latihanku tetep pribadi kejaba tak bagekno dewe.', 'Saya mengizinkan maestro pemilik kelas melihat catatan kemajuan saya (nyebeng, tedean, ngelmu) di kelas ini. Rekaman latihan saya tetap pribadi kecuali saya bagikan sendiri.'), 'consent_progress', { required: true }),
  ], async (fdata) => { const r = await POST('/api/classes/join', { code: fdata.get('code'), consent_progress: fdata.get('consent_progress') === 'true' }); toast(r.already ? L('Sampeyan wis dadi anggota', 'Anda sudah menjadi anggota') : L('Wis melu kelas', 'Berhasil bergabung')); go(`/kelas/${r.id}`); }, { submit: L('Melu kelas', 'Gabung kelas'), ic: 'users' });
  const card = (c, own) => h('a', { class: 'card card--link classcard', href: `#/kelas/${c.id}` }, h('h3', null, c.name), c.description ? h('p', { class: 'muted' }, c.description) : null,
    h('p', { class: 'classcard__meta' }, own ? [badge(`${c.members} ${L('anggota', 'anggota')}`, 'info', 'users'), ' ', badge(`${c.units} unit`, '', 'stage'), c.archived ? [' ', badge(L('Diarsipno', 'Diarsipkan'), 'warn')] : null] : [badge(`${c.units} unit`, '', 'stage'), ' ', h('span', { class: 'hint' }, `${L('Maestro', 'Maestro')}: ${c.owner_name}`)]));
  const createForm = isStaff() ? h('section', { class: 'card stack', 'aria-labelledby': 'mk-h' }, h('h2', { id: 'mk-h', class: 'h-sm' }, icon('plus'), L('Gawe kelas anyar', 'Buat kelas baru')),
    form([field(L('Jeneng kelas', 'Nama kelas'), 'name', { required: true, maxlength: 100 }), field(L('Katrangan', 'Deskripsi'), 'description', { type: 'textarea', rows: 2, maxlength: 600 })],
      async (fdata) => { const r = await POST('/api/classes', { name: fdata.get('name'), description: fdata.get('description') }); toast(L('Kelas digawe', 'Kelas dibuat')); go(`/kelas/${r.id}`); }, { submit: L('Gawe kelas', 'Buat kelas'), ic: 'plus' })) : null;
  return h('div', null,
    pageHead({ eyebrow: L('Kelas', 'Kelas'), title: LB('Kelas lan dalane belajar', 'Kelas dan jalur belajar'), lead: LB('Maestro nyusun unit dadi urutan; pemain melu nganggo kode.', 'Maestro menyusun unit menjadi urutan; pemain bergabung dengan kode.'), kind: 'ceplok' }),
    h('div', { class: 'wrap pad stack', style: { '--gap': '2rem' } },
      h('div', { class: 'grid grid--2' }, h('section', { class: 'card stack', 'aria-labelledby': 'jn-h' }, h('h2', { id: 'jn-h', class: 'h-sm' }, icon('key'), L('Melu kelas', 'Gabung kelas')), joinForm), createForm),
      d.joined.length ? h('section', { class: 'stack', 'aria-labelledby': 'jd-h' }, h('h2', { id: 'jd-h' }, L('Kelas sing tak ikuti', 'Kelas yang saya ikuti')), h('div', { class: 'grid--cards grid' }, d.joined.map((c) => card(c, false)))) : null,
      isStaff() ? h('section', { class: 'stack', 'aria-labelledby': 'ow-h' }, h('h2', { id: 'ow-h' }, L('Kelas sing tak urus', 'Kelas yang saya kelola')), d.owned.length ? h('div', { class: 'grid--cards grid' }, d.owned.map((c) => card(c, true))) : h('p', { class: 'muted' }, L('Durung enek kelas.', 'Belum ada kelas.'))) : null,
      !d.joined.length && !isStaff() ? empty(L('Durung melu kelas', 'Belum bergabung ke kelas'), L('Njaluk kode kelas saka maestro, terus tulis nang duwur.', 'Minta kode kelas dari maestro, lalu tulis di atas.'), icon('users', { size: 56 })) : null));
}

export async function renderDetail({ id }) {
  const d = await GET(`/api/classes/${id}`);
  const c = d.class, own = c.is_owner;
  let mine = [];
  if (own) { try { mine = (await GET('/api/units?mine=1')).units; } catch { mine = []; } }
  const inClass = new Set(d.units.map((x) => x.unit.id));
  const addable = mine.filter((u) => !inClass.has(u.id));
  const head = pageHead({ eyebrow: `${L('Kelas', 'Kelas')} · ${L('Maestro', 'Maestro')} ${c.owner.name}`, title: c.name, lead: c.description || null, kind: 'ceplok', crumbs: [{ href: '#/kelas', label: L('Kelas', 'Kelas') }, { label: c.name }],
    meta: own ? [h('span', { class: 'codebox' }, icon('key', { cls: 'icon--sm' }), L('Kode', 'Kode'), ' ', h('b', { class: 'tnum' }, c.join_code)), h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => copyText(c.join_code) }, icon('copy'), L('Salin', 'Salin')), c.archived ? badge(L('Diarsipno', 'Diarsipkan'), 'warn') : null] : null });
  const unitRows = d.units.length ? h('ol', { class: 'cunits' }, d.units.map((x, i) => {
    const u = x.unit;
    return h('li', { class: 'cunit' }, h('span', { class: 'cunit__n tnum' }, i + 1),
      h('div', { class: 'cunit__body' }, h('a', { class: 'cunit__title', href: `#/unit/${u.id}` }, pick(u, 'title')), h('p', { class: 'hint' }, `${u.maestro.name}${u.skill ? ` · ${u.skill}` : ''}`), x.note ? h('p', { class: 'cunit__note' }, x.note) : null,
        u.status !== 'validated' ? badge(STATUS[u.status](), 'warn') : null),
      h('div', { class: 'cunit__side' }, S.user ? dots(x.progress) : null, own ? act(L('Copot', 'Keluarkan'), () => DEL(`/api/classes/${c.id}/units/${u.id}`), { cls: 'btn btn--ghost btn--sm', confirmText: L('Copot unit iki saka kelas? Unite dewe ora dibusak.', 'Keluarkan unit ini dari kelas? Unitnya sendiri tidak dihapus.'), done: L('Unit dicopot', 'Unit dikeluarkan'), ic: 'x' }) : null));
  })) : empty(L('Kelas iki durung enek unit', 'Kelas ini belum berisi unit'), own ? L('Tambahno unit sampeyan nang ngisor.', 'Tambahkan unit Anda di bawah.') : '');
  const addForm = own ? h('section', { class: 'card stack', 'aria-labelledby': 'ad-h' }, h('h2', { id: 'ad-h', class: 'h-sm' }, icon('plus'), L('Tambah unit', 'Tambah unit')), addable.length
    ? form([field(L('Unit', 'Unit'), 'unit_id', { options: addable.map((u) => [u.id, `${pick(u, 'title')}${u.status !== 'validated' ? ` (${STATUS[u.status]()})` : ''}`]) }), field(L('Catetan nggo anggota (opsional)', 'Catatan untuk anggota (opsional)'), 'note', { maxlength: 400 })],
      async (fdata) => { await POST(`/api/classes/${c.id}/units`, { unit_id: Number(fdata.get('unit_id')), note: fdata.get('note') }); toast(L('Unit ditambah', 'Unit ditambahkan')); hooks.refresh(); }, { submit: L('Tambah', 'Tambah'), ic: 'plus' })
    : h('p', { class: 'muted' }, mine.length ? L('Kabeh unit sampeyan wis nang kelas iki.', 'Semua unit Anda sudah ada di kelas ini.') : L('Sampeyan durung duwe unit. Gawe unit sik nang kaca Maestro.', 'Anda belum punya unit. Buat unit dulu di halaman Maestro.'))) : null;
  const members = own ? h('section', { class: 'stack', 'aria-labelledby': 'mb-h' }, h('h2', { id: 'mb-h' }, `${L('Anggota', 'Anggota')} (${(d.members || []).length})`),
    (d.members || []).length ? h('div', { class: 'tablewrap', tabindex: '0', role: 'region', 'aria-label': L('Kemajuan anggota kelas', 'Kemajuan anggota kelas') }, h('table', { class: 'table' }, h('caption', { class: 'sr' }, L('Kemajuan anggota kelas', 'Kemajuan anggota kelas')),
      h('thead', null, h('tr', null, h('th', { scope: 'col' }, L('Jeneng', 'Nama')), h('th', { scope: 'col' }, L('Melu', 'Bergabung')), d.units.map((x, i) => h('th', { scope: 'col', title: pick(x.unit, 'title') }, `U${i + 1}`)), h('th', { scope: 'col' }, h('span', { class: 'sr' }, L('Aksi', 'Aksi'))))),
      h('tbody', null, d.members.map((m) => { const pm = new Map(m.progress.map((p) => [p.unit_id, p])); return h('tr', null, h('th', { scope: 'row' }, m.name), h('td', null, fmtDate(m.joined_at, false)), d.units.map((x) => h('td', null, dots(pm.get(x.unit.id)))), h('td', null, act(L('Metokno', 'Keluarkan'), () => DEL(`/api/classes/${c.id}/members/${m.user_id}`), { cls: 'btn btn--ghost btn--sm', confirmText: L(`Metokno ${m.name} saka kelas?`, `Keluarkan ${m.name} dari kelas?`), danger: true, done: L('Anggota dikeluarno', 'Anggota dikeluarkan'), ic: 'x' }))); })))) : h('p', { class: 'muted' }, L('Durung enek anggota. Bagekno kode kelas.', 'Belum ada anggota. Bagikan kode kelas.')),
    h('p', { class: 'hint' }, icon('shield', { cls: 'icon--sm' }), ' ', L('Sampeyan mung ndelok kemajuan (nyebeng, tedean, ngelmu). Rekaman latihan ora kelihatan kejaba pemaine mbagekno.', 'Anda hanya melihat kemajuan (nyebeng, tedean, ngelmu). Rekaman latihan tidak terlihat kecuali pemainnya membagikan.'))) : null;
  const ownTools = own ? h('section', { class: 'card stack', 'aria-label': L('Kelola kelas', 'Kelola kelas') }, h('h2', { class: 'h-sm' }, icon('settings'), L('Kelola kelas', 'Kelola kelas')),
    h('div', { class: 'actions' },
      act(L('Kode anyar', 'Kode baru'), () => POST(`/api/classes/${c.id}/code`), { confirmText: L('Kode lawas ora isok dipakai maneh. Terusno?', 'Kode lama tidak dapat dipakai lagi. Lanjutkan?'), done: L('Kode anyar digawe', 'Kode baru dibuat'), ic: 'refresh' }),
      act(c.archived ? L('Aktifno maneh', 'Aktifkan kembali') : L('Arsipno', 'Arsipkan'), () => PATCH(`/api/classes/${c.id}`, { archived: !c.archived }), { done: c.archived ? L('Kelas diaktifno', 'Kelas diaktifkan') : L('Kelas diarsipno', 'Kelas diarsipkan'), ic: 'layers' }),
      act(L('Busak kelas', 'Hapus kelas'), async () => { await DEL(`/api/classes/${c.id}`); go('/kelas'); }, { cls: 'btn btn--danger btn--sm', confirmText: L('Kelas lan keanggotaane bakal dibusak. Unit lan kemajuan pemain ora ikut dibusak.', 'Kelas dan keanggotaannya akan dihapus. Unit dan kemajuan pemain tidak ikut terhapus.'), danger: true, reload: false, done: L('Kelas dibusak', 'Kelas dihapus'), ic: 'trash' }))) : null;
  const leave = !own ? act(L('Metu saka kelas', 'Keluar dari kelas'), async () => { await DEL(`/api/classes/${c.id}/membership`); go('/kelas'); }, { cls: 'btn btn--line', confirmText: L('Metu saka kelas iki? Maestro ora isok ndelok kemajuanmu maneh.', 'Keluar dari kelas ini? Maestro tidak dapat melihat kemajuanmu lagi.'), reload: false, done: L('Wis metu saka kelas', 'Sudah keluar dari kelas'), ic: 'logout' }) : null;
  return h('div', null, head, h('div', { class: 'wrap pad stack', style: { '--gap': '2rem' } },
    h('section', { class: 'stack', 'aria-labelledby': 'cu-h' }, h('h2', { id: 'cu-h' }, L('Urutan unit', 'Urutan unit')), unitRows),
    addForm, members, ownTools, leave ? h('div', { class: 'actions' }, leave) : null,
    !own ? notice(L('Maestro pemilik kelas isok ndelok catetan kemajuanmu (nyebeng, tedean, ngelmu) nang kelas iki, mergo sampeyan setuju pas melu.', 'Maestro pemilik kelas dapat melihat catatan kemajuan Anda (nyebeng, tedean, ngelmu) di kelas ini, karena Anda menyetujuinya saat bergabung.'), 'info', 'shield') : null));
}
