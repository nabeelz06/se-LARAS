// Panggung: tirai merah berlipit dengan kelambu bersulam emas dan sorot lampu. Dekoratif (aria-hidden).
import { s } from '../core/dom.js';
import { motifBg } from './motif.js';

let n = 0;
export function stageCurtain({ open = true } = {}) {
  const id = `cu${++n}`;
  const W = 1200, H = 640;
  const svg = s('svg', { class: 'curtain', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMin meet', 'aria-hidden': 'true', focusable: 'false' });
  const defs = s('defs', null,
    s('linearGradient', { id: `${id}-bg`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#2a0e12' }), s('stop', { offset: 0.7, 'stop-color': '#1a0a0c' }), s('stop', { offset: 1, 'stop-color': '#0e0605' })),
    s('radialGradient', { id: `${id}-spot`, cx: 0.5, cy: 0, r: 0.9 }, s('stop', { offset: 0, 'stop-color': '#ffe9b0', 'stop-opacity': 0.55 }), s('stop', { offset: 0.5, 'stop-color': '#f1c866', 'stop-opacity': 0.12 }), s('stop', { offset: 1, 'stop-color': '#f1c866', 'stop-opacity': 0 })),
    s('linearGradient', { id: `${id}-fold`, x1: 0, y1: 0, x2: 1, y2: 0 },
      ...[['0', '#4b0b15'], ['.22', '#9a1f2e'], ['.5', '#c2354a'], ['.78', '#8a1b29'], ['1', '#3d0912']].map(([o, c]) => s('stop', { offset: o, 'stop-color': c }))),
    s('pattern', { id: `${id}-folds`, width: 84, height: 10, patternUnits: 'userSpaceOnUse' }, s('rect', { width: 84, height: 10, fill: `url(#${id}-fold)` })),
    s('linearGradient', { id: `${id}-shade`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#000', 'stop-opacity': 0.55 }), s('stop', { offset: 0.35, 'stop-color': '#000', 'stop-opacity': 0 }), s('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.45 })),
    s('linearGradient', { id: `${id}-gold`, x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#f6d680' }), s('stop', { offset: 1, 'stop-color': '#b5801c' })),
    s('clipPath', { id: `${id}-cl` }, s('path', { d: `M0 0 H372 C340 190 238 392 128 ${H} H0 Z` })),
    s('clipPath', { id: `${id}-cr` }, s('path', { d: `M${W} 0 H${W - 372} C${W - 340} 190 ${W - 238} 392 ${W - 128} ${H} H${W} Z` })));
  svg.append(defs, s('rect', { width: W, height: H, fill: `url(#${id}-bg)` }));
  const back = s('g', { class: 'curtain__back' });
  back.append(s('rect', { width: W, height: H, fill: `url(#${id}-spot)` }));
  svg.append(back);
  // sisi kiri/kanan
  const half = (clip, cls) => s('g', { class: ['curtain__half', cls] },
    s('g', { 'clip-path': `url(#${clip})` }, s('rect', { width: W, height: H, fill: `url(#${id}-folds)` }), s('rect', { width: W, height: H, fill: `url(#${id}-shade)` }),
      ...Array.from({ length: 9 }, (_, i) => s('path', { d: `M${i * 42 + 10} 0 V${H}`, stroke: 'rgb(255 214 150 / .12)', 'stroke-width': 1.2 }))));
  svg.append(half(`${id}-cl`, 'curtain__l'), half(`${id}-cr`, 'curtain__r'));
  // kelambu (pelmet) dengan lengkung dan rumbai
  const valance = s('g', { class: 'curtain__valance' });
  let d = `M0 0 H${W} V54`;
  const sc = 12, sw = W / sc;
  for (let i = sc; i > 0; i--) d += ` Q${(i - 0.5) * sw} 112 ${(i - 1) * sw} 54`;
  d += ' Z';
  valance.append(s('path', { d, fill: '#7a1220' }), s('path', { d, fill: 'none', stroke: `url(#${id}-gold)`, 'stroke-width': 3.5 }), s('rect', { width: W, height: 18, fill: `url(#${id}-gold)`, opacity: 0.95 }), s('rect', { y: 18, width: W, height: 3, fill: '#5b0e19' }));
  for (let i = 0; i < sc; i++) {
    const cx = (i + 0.5) * sw;
    valance.append(s('path', { d: `M${cx - 46} 40 Q${cx} 86 ${cx + 46} 40`, fill: 'none', stroke: 'rgb(246 214 128 / .55)', 'stroke-width': 1.5 }));
    for (let k = -3; k <= 3; k++) {
      const x = cx + k * 11, y0 = 54 + (1 - Math.abs(k) / 3.6) * 40;
      valance.append(s('path', { d: `M${x} ${y0} v12`, stroke: `url(#${id}-gold)`, 'stroke-width': 2, 'stroke-linecap': 'round' }), s('circle', { cx: x, cy: y0 + 14, r: 2.3, fill: '#e6b84a' }));
    }
  }
  svg.append(valance);
  svg.append(motifBg('kawung', { cell: 56, cls: 'curtain__motif' }));
  if (!open) svg.classList.add('curtain--static');
  return svg;
}
