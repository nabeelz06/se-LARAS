// "Laras": penunjuk selisih deskriptif. Titik emas = acuan maestro; pita = toleransi yang ditetapkan maestro; lingkaran = latihan pemain.
// Tidak ada warna baik/buruk: dekat acuan (teal), lebih tinggi (oker), lebih rendah (indigo). Selisih adalah deskripsi, bukan nilai.
import { h, icon, num, clamp } from '../core/dom.js';
import { L, PB, STATUS } from '../core/i18n.js';
import { S } from '../core/state.js';

const fmt = (row, v) => `${num(v, row.digits != null ? row.digits : 2)} ${row.unit}`;
const POS = { luwih_dhuwur: 'high', luwih_endhek: 'low', cedhak: 'near' };

export function tuner(row) {
  const name = S.lang === 'id' ? row.label_id : (row.label_sby || row.label_id);
  const sub = S.lang === 'dua' && row.label_sby && row.label_id && row.label_sby !== row.label_id ? row.label_id : '';
  const head = h('div', { class: 'tuner__head' }, h('h3', { class: 'tuner__title' }, h('span', null, name), sub ? h('small', { class: 'bi__sub' }, sub) : null),
    h('span', { class: ['tuner__status', `tuner__status--${POS[row.status] || 'na'}`] }, STATUS[row.status]()));
  if (row.status === 'tidak_andal' || row.ref == null || row.value == null) {
    return h('article', { class: 'tuner tuner--na' }, head, h('p', { class: 'tuner__note' }, icon('info'), S.lang === 'id' ? row.note_id : row.note_sby), row.proxy ? h('p', { class: 'hint' }, L('Perkiraan, ora ukuran langsung.', 'Perkiraan, bukan ukuran langsung.')) : null);
  }
  const band = row.band != null && row.band > 0 ? row.band : Math.max(Math.abs(row.ref) * (row.tolerance_pct / 100), 0.01);
  const R = Math.max(band * 3.2, Math.abs(row.value - row.ref) * 1.45);
  const pos = (v) => clamp(50 + ((v - row.ref) / R) * 46, 3, 97);
  const bandL = pos(row.ref - band), bandR = pos(row.ref + band);
  const you = pos(row.value);
  const youLabel = clamp(you, 14, 86);
  const scale = h('div', { class: 'tuner__scale', role: 'img', 'aria-label': `${name}: ${L('acuan maestro', 'acuan maestro')} ${fmt(row, row.ref)}; ${L('latihan sampeyan', 'latihan Anda')} ${fmt(row, row.value)}; ${STATUS[row.status]()}` },
    h('div', { class: 'tuner__track' }), ...Array.from({ length: 11 }, (_, i) => { const t = h('i', { class: ['tuner__tick', i % 5 === 0 ? 'tuner__tick--major' : ''] }); t.style.left = `${4 + i * 9.2}%`; return t; }));
  const bandEl = h('div', { class: 'tuner__band' }); bandEl.style.left = `${bandL}%`; bandEl.style.width = `${Math.max(1.5, bandR - bandL)}%`;
  const dg = row.digits != null ? row.digits : 2;
  const ref = h('div', { class: 'tuner__ref' }, h('span', { class: 'tuner__reflabel' }, L('Acuan maestro', 'Acuan maestro')), h('b', { class: 'tuner__refval tnum' }, num(row.ref, dg)), h('small', { class: 'tuner__unit' }, row.unit), h('i', { class: 'tuner__diamond' }));
  ref.style.left = '50%';
  const pointer = h('div', { class: ['tuner__you', `tuner__you--${POS[row.status]}`] }, h('i', { class: 'tuner__dot' }, icon('bell')));
  pointer.style.left = '50%';
  const youLab = h('div', { class: 'tuner__youlabel' }, h('span', null, L('Latihan sampeyan', 'Latihan Anda')), h('b', { class: 'tnum' }, num(row.value, dg)), h('small', null, row.unit));
  youLab.style.left = `${youLabel}%`;
  scale.append(bandEl, ref, pointer, youLab);
  // gerak masuk: penanda bergeser dari acuan ke nilai latihan
  requestAnimationFrame(() => requestAnimationFrame(() => { pointer.style.left = `${you}%`; }));
  const hint = (S.lang === 'id' ? row.hint_id : row.hint_sby) || row.hint_id || row.hint_sby;
  const dir = row.status === 'cedhak' ? '' : row.status === 'luwih_dhuwur' ? '▲ ' : '▼ ';
  return h('article', { class: 'tuner' }, head, scale,
    h('p', { class: 'tuner__note' }, h('b', null, dir), S.lang === 'id' ? row.note_id : row.note_sby),
    h('p', { class: 'tuner__tol hint' }, `${L('Toleransi dening maestro', 'Toleransi dari maestro')}: ±${num(band, row.digits != null ? row.digits : 2)} ${row.unit} (${row.tolerance_pct}%)`),
    row.proxy ? h('p', { class: 'hint' }, L('Iki perkiraan, ora ukuran langsung.', 'Ini perkiraan, bukan ukuran langsung.')) : null,
    hint ? h('blockquote', { class: 'tuner__hint' }, h('span', { class: 'tuner__hintlabel' }, L('Catetane maestro', 'Catatan maestro')), hint) : null);
}
void PB;
