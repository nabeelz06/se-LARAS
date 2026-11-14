import { h, icon, debounce } from '../core/dom.js';
import { GET } from '../core/api.js';
import { S } from '../core/state.js';
import { L, LB, pick } from '../core/i18n.js';
import { empty, notice } from '../core/ui.js';
import { unitCard } from '../comp/unitcard.js';
import { motifBg } from '../art/motif.js';

export async function render() {
  const { units } = await GET('/api/units');
  let query = '', kind = 'all';
  const grid = h('div', { class: 'grid grid--cards', 'aria-live': 'polite' });
  const count = h('p', { class: 'muted', role: 'status' });
  const match = (u) => {
    const hay = `${u.title_sby} ${u.title_id} ${u.skill} ${u.maestro.name} ${u.maestro.sanggar}`.toLowerCase();
    return (!query || hay.includes(query)) && (kind === 'all' || (kind === 'video' && u.is_video) || (kind === 'audio' && !u.is_video) || (kind === 'open' && u.access === 'public'));
  };
  const paint = () => {
    const list = units.filter(match);
    grid.replaceChildren(...(list.length ? list.map((u) => unitCard(u)) : [empty(L('Ora enek sing cocok', 'Tidak ada yang cocok'), L('Coba tembung liyane utowo busak panyaring.', 'Coba kata lain atau hapus penyaring.'))]));
    count.textContent = `${list.length} ${L('saka', 'dari')} ${units.length} unit`;
  };
  const chip = (v, label) => { const b = h('button', { type: 'button', class: 'chipbtn', 'aria-pressed': String(kind === v), onclick: () => { kind = v; chips.forEach(([k, el]) => el.setAttribute('aria-pressed', String(k === v))); paint(); } }, label); return [v, b]; };
  const chips = [chip('all', L('Kabeh', 'Semua')), chip('video', L('Video', 'Video')), chip('audio', L('Swara thok', 'Suara saja')), chip('open', L('Terbuka', 'Terbuka'))];
  const search = h('input', { class: 'input', type: 'search', placeholder: L('Goleki unit, maestro, utowo ketrampilan', 'Cari unit, maestro, atau keterampilan'), 'aria-label': L('Goleki unit', 'Cari unit'), oninput: debounce((e) => { query = e.target.value.trim().toLowerCase(); paint(); }, 120) });
  paint();
  return h('div', null,
    h('section', { class: 'pagehead' }, motifBg('kawung', { cell: 56, cls: 'pagehead__bg' }), h('div', { class: 'wrap pagehead__in' },
      h('p', { class: 'eyebrow' }, L('Nyebeng · Tedean · Ngelmu', 'Nyebeng · Tedean · Ngelmu')), h('h1', null, LB('Unit latihan soko maestro', 'Unit latihan dari maestro')),
      h('p', { class: 'lead' }, LB('Saben unit: siji klip demonstrasi, takarir Suroboyoan–Indonesia, momen karo alasane, lan ukuran sing dipilih maestro.', 'Setiap unit: satu klip demonstrasi, takarir Suroboyoan–Indonesia, momen beserta alasannya, dan ukuran pilihan maestro.')))),
    h('div', { class: 'wrap pad' },
      h('div', { class: 'toolbar' }, h('div', { class: 'toolbar__search' }, icon('search'), search), h('div', { class: 'chips', role: 'group', 'aria-label': L('Panyaring', 'Penyaring') }, chips.map(([, el]) => el)), count),
      units.some((u) => u.is_demo) ? notice(L('Unit "conto uji" digawe tim kanggo mbuktekno alur. Isine dudu konten maestro.', 'Unit "contoh uji" dibuat tim untuk membuktikan alur. Isinya bukan konten maestro.'), 'warn') : null,
      h('div', { style: { height: '1.2rem' } }), h('h2', { class: 'sr' }, L('Daftar unit latihan', 'Daftar unit latihan')), grid,
      !S.user ? h('p', { class: 'hint center', style: { marginTop: '1.6rem' } }, L('Sebagian unit mung isok dibukak sak wise mlebu.', 'Sebagian unit hanya dapat dibuka setelah masuk.')) : null));
}
void pick;
