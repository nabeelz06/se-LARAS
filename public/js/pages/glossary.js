// Kamus Ludruk dan Suroboyoan: entri bersumber pustaka (berlabel belum disahkan) dan entri maestro. Mode daftar dan kartu kilat.
import { h, icon } from '../core/dom.js';
import { GET, POST, PATCH, DEL } from '../core/api.js';
import { S, isStaff } from '../core/state.js';
import { L, LB } from '../core/i18n.js';
import { badge, notice, empty, field, form, modal, act, toast, hooks } from '../core/ui.js';
import { pageHead } from '../comp/pagehead.js';
import { debounce } from '../core/dom.js';

const KINDS = [['all', () => L('Kabeh', 'Semua')], ['istilah', () => L('Istilah', 'Istilah')], ['ungkapan', () => L('Ungkapan', 'Ungkapan')], ['panggilan', () => L('Panggilan', 'Panggilan')], ['alat', () => L('Alat', 'Alat')], ['lakon', () => L('Lakon', 'Lakon')]];
const KIND_LABEL = Object.fromEntries(KINDS.map(([k, f]) => [k, f]));
const defOf = (g) => (S.lang === 'id' ? g.def_id : (g.def_sby || g.def_id));
const subOf = (g) => (S.lang === 'dua' && g.def_sby && g.def_id && g.def_sby !== g.def_id ? g.def_id : '');

function editor(g) {
  const edit = !!(g && g.id);
  let m;
  const f = form([
    field(L('Istilah (Suroboyoan)', 'Istilah (Suroboyoan)'), 'term_sby', { required: true, value: g && g.term_sby, maxlength: 80 }),
    field(L('Padanan Indonesia', 'Padanan Indonesia'), 'term_id', { value: g && g.term_id, maxlength: 120 }),
    field(L('Jenis', 'Jenis'), 'kind', { options: KINDS.slice(1).map(([k, fn]) => [k, fn()]), value: (g && g.kind) || 'istilah' }),
    field(L('Arti (Indonesia)', 'Arti (Indonesia)'), 'def_id', { type: 'textarea', required: true, rows: 3, value: g && g.def_id, maxlength: 600 }),
    field(L('Arti (Suroboyoan)', 'Arti (Suroboyoan)'), 'def_sby', { type: 'textarea', rows: 3, value: g && g.def_sby, maxlength: 600, hint: L('Teks Suroboyoan isih draf nganti disahno penutur asli.', 'Teks Suroboyoan masih draf sampai disahkan penutur asli.') }),
    field(L('Contoh kalimat (Suroboyoan)', 'Contoh kalimat (Suroboyoan)'), 'example_sby', { value: g && g.example_sby, maxlength: 300 }),
    field(L('Contoh kalimat (Indonesia)', 'Contoh kalimat (Indonesia)'), 'example_id', { value: g && g.example_id, maxlength: 300 }),
  ], async (data) => {
    const b = Object.fromEntries([...data.entries()].filter(([, v]) => typeof v === 'string'));
    if (edit) await PATCH(`/api/glossary/${g.id}`, b); else await POST('/api/glossary', b);
    m.close();
    toast(L('Istilah disimpen. Durung disahno.', 'Istilah disimpan. Belum disahkan.'));
    hooks.refresh();
  }, { submit: L('Simpen', 'Simpan') });
  m = modal({ title: edit ? L('Sunting istilah', 'Sunting istilah') : L('Tambah istilah', 'Tambah istilah'), body: f, wide: true });
}

/** Satu tautan untuk sumber utama; sumber tambahan (dipisah " · ") ditampilkan sebagai teks "juga:". */
function srcView(g) {
  const parts = String(g.source_label).split(' · ');
  const main = parts[0], rest = parts.slice(1);
  const a = g.source_url ? h('a', { class: 'term-card__src', href: g.source_url, target: '_blank', rel: 'noopener noreferrer' }, icon('external', { cls: 'icon--sm' }), main) : h('span', { class: 'term-card__src' }, main);
  return rest.length ? h('span', { class: 'term-card__srcs' }, a, h('span', { class: 'term-card__also' }, `${L('uga', 'juga')}: ${rest.join('; ')}`)) : a;
}

export async function render() {
  const d = await GET('/api/glossary');
  const all = d.terms;
  let kind = 'all', q = '', mode = 'list';
  const host = h('div', { class: 'stack', style: { '--gap': '1rem' } });
  const count = h('span', { class: 'muted', role: 'status' });
  const filtered = () => all.filter((g) => (kind === 'all' || g.kind === kind) && (!q || `${g.term_sby} ${g.term_id} ${g.def_id} ${g.def_sby}`.toLowerCase().includes(q)));

  function card(g) {
    const staff = isStaff();
    return h('article', { class: 'term-card' },
      h('header', null, h('h3', { class: 'term-card__term', lang: 'jv' }, g.term_sby), h('span', { class: 'term-card__kind' }, KIND_LABEL[g.kind] ? KIND_LABEL[g.kind]() : g.kind)),
      g.term_id ? h('p', { class: 'term-card__id', lang: 'id' }, `= ${g.term_id}`) : null,
      h('p', { class: 'term-card__def', lang: S.lang === 'id' ? 'id' : 'jv' }, defOf(g)), subOf(g) ? h('p', { class: 'term-card__sub', lang: 'id' }, subOf(g)) : null,
      g.example_sby || g.example_id ? h('blockquote', { class: 'term-card__ex' }, g.example_sby ? h('span', { lang: 'jv' }, g.example_sby) : null, g.example_id ? h('em', { lang: 'id' }, g.example_id) : null) : null,
      h('footer', null,
        g.validated ? badge(L('Wis disahno maestro', 'Disahkan maestro'), 'ok', 'check') : badge(L('Durung disahno maestro', 'Belum disahkan maestro'), 'warn', 'alert'),
        g.is_demo ? badge(L('Contoh uji', 'Contoh uji'), 'demo') : null,
        g.source_label ? srcView(g) : (g.basis === 'maestro' ? h('span', { class: 'term-card__src' }, L('Ditulis maestro/praktisi', 'Ditulis maestro/praktisi')) : null),
        staff ? h('span', { class: 'term-card__tools' },
          !g.validated ? act(L('Sahno', 'Sahkan'), () => POST(`/api/glossary/${g.id}/validate`), { cls: 'btn btn--ghost btn--sm', done: L('Istilah disahno', 'Istilah disahkan'), ic: 'check' }) : null,
          h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => editor(g) }, icon('edit'), L('Sunting', 'Sunting')),
          act(L('Busak', 'Hapus'), () => DEL(`/api/glossary/${g.id}`), { cls: 'btn btn--ghost btn--sm', confirmText: L(`Busak istilah "${g.term_sby}"?`, `Hapus istilah "${g.term_sby}"?`), danger: true, done: L('Istilah dibusak', 'Istilah dihapus'), ic: 'trash' })) : null));
  }

  function flashDeck(list) {
    if (!list.length) return empty(L('Ora enek kartu', 'Tidak ada kartu'), '');
    let order = list.map((_, i) => i), pos = 0, flipped = false;
    const cardEl = h('button', { type: 'button', class: 'flash__card', 'aria-live': 'polite' });
    const counter = h('span', { class: 'tnum muted' });
    const paint = () => {
      const g = list[order[pos]];
      cardEl.classList.toggle('is-flipped', flipped);
      cardEl.replaceChildren(
        h('span', { class: 'flash__face flash__face--front' }, h('small', null, KIND_LABEL[g.kind] ? KIND_LABEL[g.kind]() : g.kind), h('strong', { lang: 'jv' }, g.term_sby), h('em', null, L('Klik kanggo ndelok artine', 'Klik untuk melihat artinya'))),
        h('span', { class: 'flash__face flash__face--back' }, h('small', null, g.term_id || g.term_sby), h('span', { lang: S.lang === 'id' ? 'id' : 'jv' }, defOf(g)), g.example_sby ? h('em', { lang: 'jv' }, g.example_sby) : null));
      cardEl.setAttribute('aria-label', flipped ? `${g.term_sby}: ${defOf(g)}` : `${g.term_sby}. ${L('Klik kanggo ndelok artine', 'Klik untuk melihat artinya')}`);
      counter.textContent = `${pos + 1} / ${order.length}`;
    };
    const go2 = (d) => { pos = (pos + d + order.length) % order.length; flipped = false; cardEl.classList.add('is-swap'); paint(); requestAnimationFrame(() => requestAnimationFrame(() => cardEl.classList.remove('is-swap'))); };
    cardEl.addEventListener('click', () => { flipped = !flipped; paint(); });
    const shuffle = () => { for (let i = order.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; } pos = 0; flipped = false; cardEl.classList.add('is-swap'); paint(); requestAnimationFrame(() => requestAnimationFrame(() => cardEl.classList.remove('is-swap'))); };
    paint();
    return h('div', { class: 'flash' }, cardEl, h('div', { class: 'actions actions--center' }, h('button', { type: 'button', class: 'btn btn--line', onclick: () => go2(-1) }, icon('arrow-left'), L('Sakdurunge', 'Sebelumnya')), counter, h('button', { type: 'button', class: 'btn btn--line', onclick: () => go2(1) }, L('Sakbanjure', 'Berikutnya'), icon('arrow-right')), h('button', { type: 'button', class: 'btn btn--ghost', onclick: shuffle }, icon('flip'), L('Acak', 'Acak'))));
  }

  function paint() {
    const list = filtered();
    count.textContent = `${list.length} ${L('saka', 'dari')} ${all.length} ${L('istilah', 'istilah')}`;
    host.replaceChildren(mode === 'flash' ? flashDeck(list) : (list.length ? h('div', { class: 'term-grid' }, list.map(card)) : empty(L('Ora ketemu', 'Tidak ditemukan'), L('Coba tembung liyane utowo busak panyaring.', 'Coba kata lain atau hapus penyaring.'))));
  }
  const chipRow = h('div', { class: 'chips', role: 'group', 'aria-label': L('Panyaring jenis', 'Penyaring jenis') }, KINDS.map(([k, f]) => { const b = h('button', { type: 'button', class: 'chipbtn', 'aria-pressed': String(k === kind), onclick: () => { kind = k; [...chipRow.children].forEach((c, i) => c.setAttribute('aria-pressed', String(KINDS[i][0] === k))); paint(); } }, f()); return b; }));
  const search = h('input', { class: 'input', type: 'search', placeholder: L('Goleki istilah', 'Cari istilah'), 'aria-label': L('Goleki istilah', 'Cari istilah'), oninput: debounce((e) => { q = e.target.value.trim().toLowerCase(); paint(); }, 120) });
  const modeBtn = (m, label, ic) => h('button', { type: 'button', class: 'chipbtn', 'aria-pressed': String(mode === m), onclick: (e) => { mode = m; [...e.currentTarget.parentElement.children].forEach((c) => c.setAttribute('aria-pressed', String(c === e.currentTarget))); paint(); } }, icon(ic, { cls: 'icon--sm' }), ' ', label);
  const unvalidated = all.filter((g) => !g.validated).length;
  paint();
  return h('div', null,
    pageHead({ eyebrow: L('Kamus Ludruk', 'Kamus Ludruk'), title: LB('Tembung-tembung Ludruk lan Suroboyoan', 'Istilah Ludruk dan Suroboyoan'), lead: LB('Saben entri nuduhno sumbere. Sing durung disahno maestro dilabeli, supaya ora kleru dianggep wis bener.', 'Setiap entri menunjukkan sumbernya. Yang belum disahkan maestro diberi label, agar tidak keliru dianggap sudah benar.'), kind: 'truntum',
      actions: isStaff() ? [h('button', { type: 'button', class: 'btn btn--gold', onclick: () => editor(null) }, icon('plus'), L('Tambah istilah', 'Tambah istilah'))] : null }),
    h('div', { class: 'wrap pad stack', style: { '--gap': '1.1rem' } },
      all.length ? h('div', { class: 'toolbar' }, h('div', { class: 'toolbar__search' }, icon('search'), search), chipRow, h('div', { class: 'chips', role: 'group', 'aria-label': L('Cara nampilno', 'Cara menampilkan') }, modeBtn('list', L('Daftar', 'Daftar'), 'list'), modeBtn('flash', L('Kartu kilat', 'Kartu kilat'), 'flip')), count) : null,
      unvalidated ? notice(L(`${unvalidated} entri durung disahno maestro (digawe saka rujukan pustaka). Tulisan Suroboyoan nang kene isih draf.`, `${unvalidated} entri belum disahkan maestro (disusun dari rujukan pustaka). Tulisan Suroboyoan di sini masih draf.`), 'warn') : null,
      all.length ? h('h2', { class: 'sr' }, L('Daftar istilah', 'Daftar istilah')) : null,
      all.length ? host : empty(L('Kamus isih kosong', 'Kamus masih kosong'), L('Entri bakal muncul sak wise maestro nambah utowo rujukan pustaka dimuat.', 'Entri akan muncul setelah maestro menambah atau rujukan pustaka dimuat.'))));
}
