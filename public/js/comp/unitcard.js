// Kartu unit: sampul bangkitan (motif + irama ucap), judul dua bahasa, maestro, dan penanda status.
import { h, icon, mmss } from '../core/dom.js';
import { L, PB } from '../core/i18n.js';
import { badge } from '../core/ui.js';
import { unitCover, rhythmBars } from '../art/cover.js';
import { STATUS } from '../core/i18n.js';

export function unitCard(u, { manage = false } = {}) {
  const href = manage ? `#/maestro/${u.id}` : `#/unit/${u.id}`;
  const flags = [];
  if (u.is_demo) flags.push(badge(L('Conto uji', 'Contoh uji'), 'demo'));
  if (manage && u.status !== 'validated') flags.push(badge(STATUS[u.status] ? STATUS[u.status]() : u.status, u.status === 'withdrawn' ? 'danger' : 'warn'));
  const cover = h('div', { class: 'ucard__cover' }, unitCover(u), rhythmBars(u.rhythm, u.duration_s, { cls: 'ucard__rhythm', hgt: 40 }),
    h('div', { class: 'ucard__flags' }, flags),
    h('div', { class: 'ucard__kind' }, icon(u.is_video ? 'video' : 'mic'), u.duration_s ? h('span', { class: 'tnum' }, mmss(u.duration_s)) : null));
  return h('a', { class: 'card card--link ucard', href }, cover,
    h('div', { class: 'ucard__body' }, h('h3', { class: 'ucard__title' }, PB(u, 'title')),
      u.skill ? h('p', { class: 'ucard__skill' }, icon('target', { cls: 'icon--sm' }), u.skill) : null,
      h('p', { class: 'ucard__by' }, u.maestro.name, u.maestro.sanggar ? ` · ${u.maestro.sanggar}` : ''),
      h('div', { class: 'chips' }, u.marker_count ? badge(`${u.marker_count} ${L('momen', 'momen')}`, '', 'flag') : null, u.rubric_count ? badge(`${u.rubric_count} ${L('ukuran maestro', 'ukuran maestro')}`, '', 'sliders') : null, u.access === 'login' ? badge(L('Kudu mlebu', 'Perlu masuk'), '', 'lock') : badge(L('Terbuka', 'Terbuka'), '', 'globe'))));
}
