// Bahasa antarmuka. Tiga mode: 'sby' (Suroboyoan), 'id' (Indonesia), 'dua' (Suroboyoan dahulu, dengan padanan Indonesia pada judul dan penjelasan).
// PERHATIAN: teks Suroboyoan di seluruh antarmuka adalah DRAF tulisan tim; belum disahkan penutur asli (docs/DAFTAR_VERIFIKASI.md).
import { h } from './dom.js';
import { S } from './state.js';

/** Teks pendek (tombol, label, menu): Suroboyoan pada mode sby/dua, Indonesia pada mode id. */
export const L = (sby, id) => (S.lang === 'id' ? id : sby);
/** Blok dua bahasa (judul, paragraf): pada mode dua tampil Suroboyoan dengan padanan Indonesia di bawahnya. */
export function LB(sby, id, { tag = 'span', cls = '' } = {}) {
  if (S.lang === 'sby' || (S.lang === 'dua' && String(sby).trim() === String(id).trim())) return h(tag, { class: cls, lang: 'jv' }, sby);
  if (S.lang === 'id') return h(tag, { class: cls, lang: 'id' }, id);
  return h(tag, { class: ['bi', cls] }, h('span', { class: 'bi__main', lang: 'jv' }, sby), h('span', { class: 'bi__sub', lang: 'id' }, id));
}
/** Teks persetujuan: selalu memuat versi Indonesia (acuan resmi), karena teks Suroboyoan masih draf dan persetujuan harus jelas. */
export function LC(sby, id) {
  if (S.lang === 'id') return h('span', { lang: 'id' }, id);
  return h('span', { class: 'bi' }, h('span', { class: 'bi__main', lang: 'jv' }, sby), h('span', { class: 'bi__sub', lang: 'id' }, id));
}
/** Pilih bidang berpasangan dari data server (title_sby/title_id): utama menurut mode; padanan dikembalikan terpisah. */
export function pick(o, base) {
  if (!o) return '';
  const sby = o[`${base}_sby`], id = o[`${base}_id`];
  return S.lang === 'id' ? (id || sby || '') : (sby || id || '');
}
export function other(o, base) {
  if (!o || S.lang !== 'dua') return '';
  const sby = o[`${base}_sby`], id = o[`${base}_id`];
  return sby && id && sby.trim() !== id.trim() ? id : '';
}
/** Teks dari data server dengan padanan: <main> + <sub> pada mode dua. */
export function PB(o, base, { tag = 'span', cls = '' } = {}) {
  const sub = other(o, base);
  return h(tag, { class: [sub ? 'bi' : '', cls] }, h('span', { class: sub ? 'bi__main' : null, lang: S.lang === 'id' ? 'id' : 'jv' }, pick(o, base)), sub ? h('span', { class: 'bi__sub', lang: 'id' }, sub) : null);
}
export const STATUS = {
  cedhak: () => L('Cedhak acuan', 'Dekat acuan'), luwih_dhuwur: () => L('Luwih dhuwur', 'Lebih tinggi'), luwih_endhek: () => L('Luwih endhek', 'Lebih rendah'), tidak_andal: () => L('Ora dibandingno', 'Tidak dibandingkan'),
  draft: () => L('Draf', 'Draf'), draft_ai: () => L('Usulan AI (durung disahno)', 'Usulan AI (belum disahkan)'), draft_human: () => L('Draf maestro', 'Draf maestro'), validated: () => L('Wis disahno', 'Disahkan'), withdrawn: () => L('Ditarik', 'Ditarik'),
  pending: () => L('Antri', 'Antre'), running: () => L('Lagi dianalisis', 'Sedang dianalisis'), done: () => L('Rampung', 'Selesai'), failed: () => L('Gagal', 'Gagal'),
};
