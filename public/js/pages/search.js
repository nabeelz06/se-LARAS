// Pencarian bersumber (retrieval-first): hasil hanya kutipan segmen dan momen yang sudah disahkan maestro, lengkap dengan menit. Tidak ada jawaban yang dibangkitkan.
import { h, icon, mmss } from '../core/dom.js';
import { GET } from '../core/api.js';
import { L, LB } from '../core/i18n.js';
import { badge, notice, empty, copyText } from '../core/ui.js';
import { go } from '../core/router.js';
import { pageHead } from '../comp/pagehead.js';

const hit = (text, q) => {
  // sorot kata kunci tanpa innerHTML: pecah teks lalu bungkus yang cocok dengan <mark>
  const terms = q.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2);
  if (!terms.length || !text) return text;
  const re = new RegExp(`(${terms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'giu');
  return text.split(re).map((part, i) => (i % 2 ? h('mark', null, part) : part));
};

export async function render(_p, query) {
  const q = (query.get('q') || '').trim();
  const [res, gl] = await Promise.all([q.length >= 2 ? GET(`/api/search?q=${encodeURIComponent(q)}`) : Promise.resolve(null), GET('/api/glossary').catch(() => ({ terms: [] }))]);
  const input = h('input', { class: 'input input--lg', type: 'search', name: 'q', value: q, placeholder: L('Contone: jeda, guyon, gerak tangan', 'Contoh: jeda, lelucon, gerak tangan'), 'aria-label': L('Goleki nang pengetahuan maestro', 'Cari di pengetahuan maestro'), autocomplete: 'off', enterkeyhint: 'search' });
  const f = h('form', { class: 'searchbar', role: 'search' }, h('div', { class: 'toolbar__search toolbar__search--lg' }, icon('search'), input), h('button', { type: 'submit', class: 'btn btn--gold btn--lg' }, L('Goleki', 'Cari')));
  f.addEventListener('submit', (e) => { e.preventDefault(); const v = input.value.trim(); go(v ? `/cari?q=${encodeURIComponent(v)}` : '/cari'); });
  const sample = (gl.terms || []).filter((t) => t.term_sby.length <= 14).slice(0, 6);
  const chips = sample.length ? h('div', { class: 'chips', role: 'group', 'aria-label': L('Tembung saka kamus', 'Kata dari kamus') }, h('span', { class: 'hint' }, L('Saka kamus:', 'Dari kamus:')), sample.map((t) => h('a', { class: 'chipbtn', href: `#/cari?q=${encodeURIComponent(t.term_sby)}` }, t.term_sby))) : null;

  let body;
  if (!res) body = h('div', { class: 'empty empty--soft' }, icon('search', { size: 56 }), h('h2', null, L('Ketik sing arep digoleki', 'Ketik yang ingin dicari')), h('p', null, L('Minimal rong huruf. Hasile kutipan saka klip, lengkap karo menite, supaya isok langsung dimuter.', 'Minimal dua huruf. Hasilnya kutipan dari klip, lengkap dengan menitnya, sehingga bisa langsung diputar.')));
  else if (!res.results.length) body = empty(L('Ora ketemu', 'Tidak ditemukan'), L(`Ora enek segmen utowo momen sing wis disahno maestro kanggo "${q}". Coba tembung liyane.`, `Belum ada segmen atau momen yang disahkan maestro untuk "${q}". Coba kata lain.`), icon('search', { size: 56 }));
  else {
    body = h('ol', { class: 'hits' }, res.results.map((r) => {
      const main = r.text_sby || r.text_id, sub = r.text_sby && r.text_id && r.text_id !== r.text_sby ? r.text_id : '';
      return h('li', { class: 'hit' },
        h('a', { class: 'hit__time tnum', href: `#/unit/${r.unit_id}?t=${Math.floor(r.start_sec)}`, 'aria-label': `${L('Muter', 'Putar')} ${r.unit_title_sby || r.unit_title_id} ${L('menit', 'menit')} ${mmss(r.start_sec)}` }, icon('play', { cls: 'icon--sm' }), mmss(r.start_sec)),
        h('div', { class: 'hit__body' },
          h('p', { class: 'hit__text', lang: 'jv' }, hit(main, q)), sub ? h('p', { class: 'hit__sub', lang: 'id' }, hit(sub, q)) : null,
          h('p', { class: 'hit__meta' }, badge(r.kind === 'momen' ? L('Momen', 'Momen') : L('Segmen', 'Segmen'), r.kind === 'momen' ? 'gold' : 'info'), ' ', h('a', { href: `#/unit/${r.unit_id}` }, r.unit_title_sby || r.unit_title_id), ' · ', r.maestro)),
        h('button', { type: 'button', class: 'btn btn--ghost btn--sm', 'aria-label': L('Salin kutipan', 'Salin kutipan'), onclick: () => copyText(r.citation) }, icon('copy'), L('Kutip', 'Kutip')));
    }));
  }
  return h('div', null,
    pageHead({ eyebrow: L('Goleki bersumber', 'Pencarian bersumber'), title: LB('Goleki nang pengetahuan maestro', 'Cari di pengetahuan maestro'), lead: LB('Hasile mung kutipan saka segmen lan momen sing wis disahno maestro. Ora enek jawaban sing dikarang AI.', 'Hasilnya hanya kutipan dari segmen dan momen yang sudah disahkan maestro. Tidak ada jawaban yang dikarang AI.'), kind: 'ceplok' }),
    h('div', { class: 'wrap pad stack', style: { '--gap': '1.2rem' } }, f, chips, res && res.results.length ? h('p', { class: 'hint', role: 'status' }, `${res.results.length} ${L('kutipan ketemu', 'kutipan ditemukan')}`) : null, body, res && res.note ? notice(res.note, 'info', 'shield') : null));
}
