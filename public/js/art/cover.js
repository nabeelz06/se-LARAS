// Sampul unit yang dibangkitkan dari data: warna dan motif ditentukan id unit, lajur bawah menggambar irama ucap klip itu sendiri (bagian bicara = batang, jeda = celah).
import { s, h } from '../core/dom.js';
import { MOTIFS } from './motif.js';

const PALETTES = [['#8c1c26', '#4a0c14'], ['#1b6b66', '#0c3a37'], ['#243f6e', '#101f3a'], ['#a15e12', '#59300a']];
let n = 0;

export function rhythmBars(segs, duration, { w = 400, hgt = 36, cls = 'cover__rhythm', min = 3 } = {}) {
  const svg = s('svg', { class: cls, viewBox: `0 0 ${w} ${hgt}`, preserveAspectRatio: 'none', 'aria-hidden': 'true', focusable: 'false' });
  if (!segs || !segs.length || !duration) return svg;
  for (const [a, b] of segs) {
    const x = (a / duration) * w, ww = Math.max(min, ((b - a) / duration) * w - 1.5);
    const k = 0.45 + 0.55 * Math.abs(Math.sin(a * 7.13 + b * 3.1));
    svg.append(s('rect', { x: x.toFixed(1), y: ((hgt - hgt * k) / 2).toFixed(1), width: ww.toFixed(1), height: (hgt * k).toFixed(1), rx: Math.min(4, ww / 2), class: 'rb' }));
  }
  return svg;
}

export function unitCover(unit, { tall = false } = {}) {
  const id = Number(unit.id) || 0, pal = PALETTES[id % PALETTES.length], kind = MOTIFS[id % MOTIFS.length];
  const gid = `cv${++n}`, cell = 34 + (id % 3) * 6;
  const W = 400, H = tall ? 300 : 230;
  const svg = s('svg', { class: 'cover', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true', focusable: 'false' });
  svg.append(s('defs', null,
    s('linearGradient', { id: `${gid}g`, x1: 0, y1: 0, x2: 1, y2: 1 }, s('stop', { offset: 0, 'stop-color': pal[0] }), s('stop', { offset: 1, 'stop-color': pal[1] })),
    s('radialGradient', { id: `${gid}r`, cx: 0.3, cy: 0.1, r: 0.9 }, s('stop', { offset: 0, 'stop-color': '#fff', 'stop-opacity': 0.28 }), s('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0 })),
    s('pattern', { id: `${gid}p`, width: cell, height: cell, patternUnits: 'userSpaceOnUse', viewBox: '0 0 40 40', patternTransform: `rotate(${(id % 2) * 45} 20 20)` },
      ...patternShapes(kind))));
  svg.append(s('rect', { width: W, height: H, fill: `url(#${gid}g)` }), s('rect', { width: W, height: H, fill: `url(#${gid}p)`, opacity: 0.34 }), s('rect', { width: W, height: H, fill: `url(#${gid}r)` }));
  // lingkaran emblem: kawung kecil
  const cx = W / 2, cy = H / 2 - 14;
  svg.append(s('g', { transform: `translate(${cx} ${cy})`, class: 'cover__emblem' }, s('circle', { r: 46, fill: 'rgb(18 8 8 / .38)', stroke: 'rgb(246 214 128 / .75)', 'stroke-width': 1.6 }),
    ...[[0, -17, 7, 15], [0, 17, 7, 15]].map(([x, y, rx, ry]) => s('ellipse', { cx: x, cy: y, rx, ry, fill: 'none', stroke: '#f1c866', 'stroke-width': 2 })),
    ...[[-17, 0, 15, 7], [17, 0, 15, 7]].map(([x, y, rx, ry]) => s('ellipse', { cx: x, cy: y, rx, ry, fill: 'none', stroke: '#f1c866', 'stroke-width': 2 })), s('circle', { r: 3.2, fill: '#f1c866' })));
  return svg;
}
function patternShapes(kind) {
  const st = { fill: 'none', stroke: '#fff', 'stroke-width': 1.3 };
  if (kind === 'kawung') return [[20, 10, 6.5, 10], [20, 30, 6.5, 10], [10, 20, 10, 6.5], [30, 20, 10, 6.5]].map(([cx, cy, rx, ry]) => s('ellipse', { cx, cy, rx, ry, ...st }));
  if (kind === 'ceplok') return [[20, 20], [20, 11], [20, 29], [11, 20], [29, 20]].map(([cx, cy]) => s('circle', { cx, cy, r: 4.5, ...st }));
  if (kind === 'parang') return [s('path', { d: 'M0 40 C10 30 10 20 20 20 S30 10 40 0', ...st }), s('path', { d: 'M-20 20 C-10 10 -10 0 0 0', ...st }), s('path', { d: 'M20 60 C30 50 30 40 40 40', ...st })];
  return [s('path', { d: 'M10 5 L11.5 8.5 L15 10 L11.5 11.5 L10 15 L8.5 11.5 L5 10 L8.5 8.5 Z', fill: '#fff' }), s('path', { d: 'M30 25 L31.5 28.5 L35 30 L31.5 31.5 L30 35 L28.5 31.5 L25 30 L28.5 28.5 Z', fill: '#fff' })];
}
export const coverWithRhythm = (unit) => h('div', { class: 'cover-wrap' }, unitCover(unit), rhythmBars(unit.rhythm, unit.duration_s));
