// Hiasan kecil: tanda se-LARAS, pembatas gongseng, bentuk kendang, aksara Jawa.
import { h, s } from '../core/dom.js';

let n = 0;
const uid = (p) => `${p}${++n}`;

/** Tanda se-LARAS: ubin merah dengan kawung emas (empat kelopak) dan satu titik pusat. */
export function logoMark({ size = 36, title } = {}) {
  const g = uid('lg');
  const svg = s('svg', { class: 'brand__mark', viewBox: '0 0 48 48', width: size, height: size, role: title ? 'img' : null, 'aria-hidden': title ? null : 'true', focusable: 'false' });
  if (title) svg.append(s('title', null, title));
  svg.append(
    s('defs', null,
      s('linearGradient', { id: g, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#b3263a' }), s('stop', { offset: 1, 'stop-color': '#6b1220' })),
      s('linearGradient', { id: `${g}g`, x1: 0, y1: 0, x2: 1, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#f1c866' }), s('stop', { offset: 1, 'stop-color': '#c58f22' }))),
    s('rect', { x: 1.5, y: 1.5, width: 45, height: 45, rx: 12, fill: `url(#${g})` }),
    s('rect', { x: 4.5, y: 4.5, width: 39, height: 39, rx: 9, fill: 'none', stroke: `url(#${g}g)`, 'stroke-width': 1, opacity: 0.75 }),
    ...[[24, 14.5, 4.6, 8.2], [24, 33.5, 4.6, 8.2]].map(([cx, cy, rx, ry]) => s('ellipse', { cx, cy, rx, ry, fill: 'none', stroke: `url(#${g}g)`, 'stroke-width': 2.2 })),
    ...[[14.5, 24, 8.2, 4.6], [33.5, 24, 8.2, 4.6]].map(([cx, cy, rx, ry]) => s('ellipse', { cx, cy, rx, ry, fill: 'none', stroke: `url(#${g}g)`, 'stroke-width': 2.2 })),
    s('circle', { cx: 24, cy: 24, r: 2.6, fill: `url(#${g}g)` }));
  return svg;
}

/** Pembatas berupa untaian gongseng (lonceng kaki penari Ngremo) pada seutas tali. */
export function gongsengDivider({ count = 11, cls = '' } = {}) {
  const w = 600, hgt = 34;
  const svg = s('svg', { class: ['divider-bells', cls], viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: 'xMidYMid meet', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(s('path', { d: `M0 8 Q ${w / 2} 16 ${w} 8`, class: 'bells__cord', fill: 'none' }));
  for (let i = 0; i < count; i++) {
    const x = (w / (count + 1)) * (i + 1);
    const y = 8 + 8 * Math.sin((x / w) * Math.PI);
    const r = i === Math.floor(count / 2) ? 7.5 : 5.5;
    svg.append(s('g', { transform: `translate(${x.toFixed(1)} ${(y + r).toFixed(1)})`, class: 'bells__bell' },
      s('circle', { r, class: 'bells__body' }), s('path', { d: `M${-r * 0.6} ${r * 0.15} H${r * 0.6}`, class: 'bells__slit' }), s('circle', { cx: 0, cy: r * 0.55, r: r * 0.16, class: 'bells__slit-dot' }), s('path', { d: `M0 ${-r} V${-r - 3}`, class: 'bells__cord' })));
  }
  return svg;
}

/** Garis hias dengan belah ketupat di tengah. */
export function ornamentLine({ cls = '' } = {}) {
  return s('svg', { class: ['orn-line', cls], viewBox: '0 0 240 14', 'aria-hidden': 'true', focusable: 'false', preserveAspectRatio: 'xMidYMid meet' },
    s('path', { d: 'M0 7 H100 M140 7 H240', class: 'orn__stroke' }), s('path', { d: 'M120 1 L127 7 L120 13 L113 7 Z', class: 'orn__fill' }),
    s('circle', { cx: 104, cy: 7, r: 1.8, class: 'orn__fill' }), s('circle', { cx: 136, cy: 7, r: 1.8, class: 'orn__fill' }));
}

/** Aksara Jawa untuk hiasan. Penulisan perlu diperiksa penutur/ahli aksara (lihat docs/DAFTAR_VERIFIKASI.md). */
export const AKSARA = { laras: 'ꦭꦫꦱ꧀', selaras: 'ꦱꦼꦭꦫꦱ꧀', ludruk: 'ꦭꦸꦢꦿꦸꦏ꧀' };
export const aksara = (text, cls = '') => h('span', { class: ['jawa', cls], lang: 'jv-Java', 'aria-hidden': 'true' }, text);
