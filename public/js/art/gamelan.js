// Siluet gamelan: gong bergantung pada gayor, kenong, saron, dan kendang. Digambar sendiri untuk se-LARAS (bukan salinan gambar mana pun).
import { s } from '../core/dom.js';

const GOLD = 'var(--gold)';
export function gamelanSilhouette({ cls = '' } = {}) {
  const body = { fill: 'var(--stage-0)', stroke: GOLD, 'stroke-opacity': '.42', 'stroke-width': '1.4', 'stroke-linejoin': 'round' };
  const boss = (cx, cy, r) => [s('circle', { cx, cy, r, ...body, fill: 'var(--stage-1)' }), s('circle', { cx, cy, r: r * 0.45, fill: GOLD, 'fill-opacity': '.28' })];
  const gong = (cx, cy, r) => s('g', null, s('circle', { cx, cy, r, ...body }), s('circle', { cx, cy, r: r * 0.78, fill: 'none', stroke: GOLD, 'stroke-opacity': '.2', 'stroke-width': '1' }), ...boss(cx, cy, r * 0.3));
  const kenong = (x) => s('g', null, s('ellipse', { cx: x, cy: 131, rx: 25, ry: 17, ...body }), s('ellipse', { cx: x, cy: 117, rx: 21, ry: 7, ...body, fill: 'var(--stage-1)' }), s('circle', { cx: x, cy: 115.5, r: 5.5, fill: GOLD, 'fill-opacity': '.34' }));
  const bars = Array.from({ length: 7 }, (_, i) => s('rect', { x: 628 + i * 33, y: 112 + i * 0.6, width: 28, height: 9, rx: 2, ...body, fill: 'var(--stage-1)' }));
  const pillar = (x) => s('g', null, s('rect', { x, y: 30, width: 11, height: 120, rx: 4, ...body }), s('circle', { cx: x + 5.5, cy: 28, r: 8, ...body }));
  const svg = s('svg', { class: ['gamelan', cls], viewBox: '0 0 1200 160', preserveAspectRatio: 'xMidYMax slice', role: 'presentation', 'aria-hidden': 'true', focusable: 'false' },
    s('rect', { x: 0, y: 148, width: 1200, height: 12, fill: 'var(--stage-0)' }),
    // gayor + dua gong
    pillar(36), pillar(300), s('rect', { x: 30, y: 36, width: 288, height: 9, rx: 4, ...body }),
    s('line', { x1: 205, y1: 45, x2: 205, y2: 62, stroke: GOLD, 'stroke-opacity': '.5', 'stroke-width': '1.6' }), s('line', { x1: 112, y1: 45, x2: 112, y2: 72, stroke: GOLD, 'stroke-opacity': '.5', 'stroke-width': '1.6' }),
    gong(205, 104, 52), gong(112, 112, 34),
    // kenong
    s('rect', { x: 372, y: 140, width: 270, height: 8, rx: 3, ...body }), ...[400, 458, 516, 574].map(kenong),
    // saron
    s('path', { d: 'M618 122 H866 L852 148 H632 Z', ...body }), ...bars,
    // kendang pada penyangga
    s('path', { d: 'M948 148 L1010 118 L1072 148 M968 148 L1010 124 L1052 148', fill: 'none', stroke: GOLD, 'stroke-opacity': '.4', 'stroke-width': '2.4', 'stroke-linecap': 'round' }),
    s('path', { d: 'M912 112 Q918 90 970 90 L1050 90 Q1102 90 1108 112 Q1102 134 1050 134 L970 134 Q918 134 912 112 Z', ...body }),
    s('ellipse', { cx: 914, cy: 112, rx: 7, ry: 21, ...body, fill: 'var(--stage-1)' }), s('ellipse', { cx: 1106, cy: 112, rx: 7, ry: 21, ...body, fill: 'var(--stage-1)' }),
    ...[948, 976, 1004, 1032, 1060, 1078].map((x) => s('line', { x1: x, y1: 92, x2: x + 14, y2: 132, stroke: GOLD, 'stroke-opacity': '.22', 'stroke-width': '1.2' })));
  return svg;
}
