// Penyorot istilah glosarium di dalam teks transkrip. Hanya mencocokkan kata utuh; klik membuka rincian beserta sumber dan status pengesahan.
import { h, icon } from '../core/dom.js';
import { L } from '../core/i18n.js';
import { modal, badge } from '../core/ui.js';
import { S } from '../core/state.js';

export function termIndex(terms) {
  const map = new Map();
  for (const t of terms || []) { const k = t.term_sby.trim().toLowerCase(); if (k.length >= 3 && !map.has(k)) map.set(k, t); }
  const keys = [...map.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = keys.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${keys.join('|')})(?![\\p{L}\\p{N}])`, 'giu') : null;
  return { map, re };
}
export function termDetail(t) {
  const body = h('div', { class: 'stack', style: { '--gap': '.7rem' } },
    t.term_id ? h('p', { class: 'muted' }, `${L('Padanan', 'Padanan')}: ${t.term_id}`) : null,
    h('p', null, S.lang === 'id' ? t.def_id : (t.def_sby || t.def_id)), S.lang === 'dua' && t.def_sby && t.def_id ? h('p', { class: 'muted' }, t.def_id) : null,
    t.example_sby || t.example_id ? h('blockquote', { class: 'term-ex' }, S.lang === 'id' ? (t.example_id || t.example_sby) : (t.example_sby || t.example_id)) : null,
    h('div', { class: 'chips' }, t.validated ? badge(L('Wis disahno maestro', 'Disahkan maestro'), 'ok', 'check') : badge(L('Durung disahno maestro', 'Belum disahkan maestro'), 'warn', 'alert'), badge(t.kind), t.is_demo ? badge(L('Conto uji', 'Contoh uji'), 'demo') : null),
    t.source_label ? h('p', { class: 'hint' }, `${L('Sumber', 'Sumber')}: `, t.source_url ? h('a', { href: t.source_url, target: '_blank', rel: 'noopener noreferrer' }, t.source_label, icon('external', { cls: 'icon--sm' })) : t.source_label) : null);
  modal({ title: t.term_sby, body, actions: [{ label: L('Tutup', 'Tutup'), value: true, cls: 'btn--primary' }] });
}
/** Ubah teks menjadi simpul: potongan teks dan tombol istilah. */
export function withTerms(text, idx) {
  if (!idx || !idx.re || !text) return [text];
  const out = []; let last = 0;
  text.replace(idx.re, (m, _g, off) => {
    if (off > last) out.push(text.slice(last, off));
    const t = idx.map.get(m.toLowerCase());
    out.push(h('button', { type: 'button', class: 'term', 'aria-haspopup': 'dialog', onclick: () => termDetail(t) }, m));
    last = off + m.length; return m;
  });
  if (last < text.length) out.push(text.slice(last));
  return out;
}
