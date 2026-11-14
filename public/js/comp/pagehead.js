// Kepala halaman bersama: pita panggung gelap bermotif kawung, jejak halaman, judul, dan pengantar.
import { h, icon } from '../core/dom.js';
import { motifBg } from '../art/motif.js';

export function pageHead({ eyebrow, title, lead, crumbs = null, actions = null, kind = 'kawung', meta = null }) {
  return h('section', { class: 'pagehead' }, motifBg(kind, { cell: 56, cls: 'pagehead__bg' }),
    h('div', { class: 'wrap pagehead__in' },
      crumbs ? h('nav', { class: 'crumbs', 'aria-label': 'Jejak halaman' }, crumbs.flatMap((c, i) => [i ? icon('chevron-right', { cls: 'icon--sm' }) : null, c.href ? h('a', { href: c.href }, c.label) : h('span', { 'aria-current': 'page' }, c.label)])) : null,
      eyebrow ? h('p', { class: 'eyebrow' }, eyebrow) : null,
      h('h1', null, title),
      lead ? h('p', { class: 'lead' }, lead) : null,
      meta ? h('div', { class: 'pagehead__meta' }, meta) : null,
      actions ? h('div', { class: 'actions pagehead__actions' }, actions) : null));
}
