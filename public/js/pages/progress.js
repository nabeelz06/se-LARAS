// Kemajuan belajar pribadi: Nyebeng (mengamati) -> Tedean (mencoba) -> Ngelmu (memahami), per unit; hanya tanggal dan hitungan yang tersimpan.
import { h, icon, fmtDate, fmtDateTime } from '../core/dom.js';
import { GET } from '../core/api.js';
import { L, LB, STATUS, pick } from '../core/i18n.js';
import { badge, notice, empty } from '../core/ui.js';
import { pageHead } from '../comp/pagehead.js';

const STEP = [['nyebeng', 'Nyebeng', 'eye', () => L('ngamati', 'mengamati')], ['tedean', 'Tedean', 'drum', () => L('nyoba', 'mencoba')], ['ngelmu', 'Ngelmu', 'book', () => L('mangerteni', 'memahami')]];

export async function render() {
  const [p, a] = await Promise.all([GET('/api/me/progress'), GET('/api/me/attempts').catch(() => ({ attempts: [] }))]);
  const t = p.totals;
  const tile = (key, label, ic, sub, n) => h('div', { class: 'ptile' }, h('span', { class: 'ptile__ic' }, icon(ic)), h('div', null, h('strong', { class: 'tnum' }, `${n}`, h('small', null, ` / ${t.available}`)), h('span', null, label), h('small', null, sub)));
  const tiles = h('div', { class: 'ptiles', 'aria-label': L('Ringkasan kemajuan', 'Ringkasan kemajuan') }, tile('nyebeng', 'Nyebeng', 'eye', L('ngamati unit', 'mengamati unit'), t.nyebeng), tile('tedean', 'Tedean', 'drum', L('unit sing wis dicoba', 'unit yang sudah dicoba'), t.tedean), tile('ngelmu', 'Ngelmu', 'book', L('unit sing wis dimangerteni', 'unit yang sudah dipahami'), t.ngelmu));
  const rows = p.units.length ? h('ul', { class: 'plist' }, p.units.map((r) => {
    const dones = { nyebeng: r.nyebeng_at, tedean: r.tedean_n > 0 ? r.tedean_at : null, ngelmu: r.ngelmu_at };
    return h('li', { class: 'plist__row' },
      h('div', { class: 'plist__title' }, h('a', { href: `#/unit/${r.unit_id}` }, pick(r, 'title')), h('small', null, `${r.maestro}${r.skill ? ` · ${r.skill}` : ''}`)),
      h('ol', { class: 'plist__steps' }, STEP.map(([k, label, ic]) => h('li', { class: dones[k] ? 'is-done' : '', 'aria-label': `${label}: ${dones[k] ? fmtDate(dones[k]) : L('durung', 'belum')}` }, h('span', { class: 'plist__dot' }, dones[k] ? icon('check') : icon(ic)), h('span', null, label, h('small', null, k === 'tedean' && r.tedean_n ? `${r.tedean_n}×` : dones[k] ? fmtDate(dones[k], false) : '–'))))));
  })) : empty(L('Durung enek kemajuan', 'Belum ada kemajuan'), L('Wiwiti saka Nyebeng: ndelok contone maestro nang salah siji unit.', 'Mulailah dari Nyebeng: menonton contoh maestro pada salah satu unit.'), icon('stage', { size: 56 }));
  const att = a.attempts.length ? h('ul', { class: 'plist plist--att' }, a.attempts.map((x) => h('li', { class: 'plist__row' },
    h('div', { class: 'plist__title' }, h('a', { href: `#/latihan/${x.id}` }, pick(x, 'title')), h('small', null, fmtDateTime(`${x.created_at.replace(' ', 'T')}Z`))),
    h('div', { class: 'plist__meta' }, badge(STATUS[x.status](), x.status === 'done' ? 'ok' : x.status === 'failed' ? 'danger' : ''), x.share_with_maestro ? badge(L('Dibagi', 'Dibagikan'), 'gold', 'share') : badge(L('Pribadi', 'Pribadi'), '', 'lock'))))) : h('p', { class: 'muted' }, L('Durung enek latihan sing direkam.', 'Belum ada latihan yang direkam.'));
  return h('div', null,
    pageHead({ eyebrow: L('Kemajuan', 'Kemajuan'), title: LB('Dalane belajar sampeyan', 'Jalur belajar Anda'), lead: LB('Nyebeng, tedean, ngelmu: mung tanggal lan cacahe sing disimpen. Ora enek skor, ora enek peringkat.', 'Nyebeng, tedean, ngelmu: hanya tanggal dan jumlahnya yang disimpan. Tidak ada skor, tidak ada peringkat.'), kind: 'parang' }),
    h('div', { class: 'wrap pad stack', style: { '--gap': '2rem' } }, tiles,
      h('section', { class: 'stack', 'aria-labelledby': 'pr-h' }, h('h2', { id: 'pr-h' }, L('Unit sing wis dilakoni', 'Unit yang sudah dijalani')), rows),
      h('section', { class: 'stack', 'aria-labelledby': 'at-h' }, h('h2', { id: 'at-h' }, L('Latihan sing direkam', 'Latihan yang direkam')), att, h('p', { class: 'hint' }, L('Rekaman latihan kebusak otomatis sak wise 30 dino; catetan kemajuan nang duwur tetep ana.', 'Rekaman latihan terhapus otomatis setelah 30 hari; catatan kemajuan di atas tetap ada.'))),
      notice(L('Jalur Nyebeng–Tedean–Ngelmu iki rancangan tim lan DURUNG disahno maestro.', 'Jalur Nyebeng–Tedean–Ngelmu ini rancangan tim dan BELUM disahkan maestro.'), 'info')));
}
