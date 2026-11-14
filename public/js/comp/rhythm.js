// Untai irama: batang = bagian bicara, celah = jeda. Dua baris (maestro dan latihan) dihubungkan garis penyejajaran DTW sehingga terlihat di mana tempo pemain menyimpang.
import { s, h, mmss } from '../core/dom.js';
import { L } from '../core/i18n.js';

export function rhythmStrip({ segs, duration, label, kind = 'maestro' }) {
  const W = 720, H = 44;
  const svg = s('svg', { class: ['rhythm', `rhythm--${kind}`], viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(s('line', { x1: 0, y1: H / 2, x2: W, y2: H / 2, class: 'rhythm__axis' }));
  (segs || []).forEach(([a, b]) => { const x = (a / duration) * W, w = Math.max(2.5, ((b - a) / duration) * W); svg.append(s('rect', { x: x.toFixed(1), y: 6, width: w.toFixed(1), height: H - 12, rx: 5, class: 'rhythm__bar' })); });
  return h('div', { class: 'rhythm-row' }, h('span', { class: 'rhythm-row__label' }, label), svg, h('span', { class: 'rhythm-row__dur tnum' }, mmss(duration)));
}

export function rhythmCompare({ ref, att, alignment }) {
  const W = 720, GAP = 60;
  const box = h('figure', { class: 'rhythm-cmp' });
  box.append(rhythmStrip({ segs: ref.segs, duration: ref.duration, label: L('Maestro', 'Maestro'), kind: 'maestro' }));
  if (alignment && alignment.path && alignment.path.length > 2) {
    const svg = s('svg', { class: 'rhythm__links', viewBox: `0 0 ${W} ${GAP}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
    const step = Math.max(1, Math.floor(alignment.path.length / 22));
    alignment.path.forEach(([tr, ta], i) => { if (i % step) return; const x1 = (tr / ref.duration) * W, x2 = (ta / att.duration) * W; svg.append(s('path', { d: `M${x1.toFixed(1)} 0 C${x1.toFixed(1)} ${GAP / 2} ${x2.toFixed(1)} ${GAP / 2} ${x2.toFixed(1)} ${GAP}`, class: 'rhythm__link' })); });
    box.append(h('div', { class: 'rhythm-links' }, h('span', { class: 'rhythm-row__label' }), svg, h('span', { class: 'rhythm-row__dur' })));
  } else box.append(h('div', { style: { height: '14px' } }));
  box.append(rhythmStrip({ segs: att.segs, duration: att.duration, label: L('Sampeyan', 'Anda'), kind: 'murid' }));
  return box;
}
