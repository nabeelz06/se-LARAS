// Motif kain tradisional (kawung, ceplok, parang) digambar ulang sebagai pola geometris sederhana; pewarnaan memakai variabel CSS sehingga ikut tema.
import { s } from '../core/dom.js';

let n = 0;
const nextId = (p) => `${p}${++n}`;

const TILES = {
  kawung: (c) => [
    s('ellipse', { cx: 20, cy: 10, rx: 6.5, ry: 10, class: c }), s('ellipse', { cx: 20, cy: 30, rx: 6.5, ry: 10, class: c }),
    s('ellipse', { cx: 10, cy: 20, rx: 10, ry: 6.5, class: c }), s('ellipse', { cx: 30, cy: 20, rx: 10, ry: 6.5, class: c }),
    s('circle', { cx: 20, cy: 20, r: 2, class: `${c} motif__dot` }),
  ],
  ceplok: (c) => [
    s('circle', { cx: 20, cy: 20, r: 4, class: c }),
    ...[[20, 11], [20, 29], [11, 20], [29, 20]].map(([x, y]) => s('circle', { cx: x, cy: y, r: 4.5, class: c })),
    ...[[0, 0], [40, 0], [0, 40], [40, 40]].map(([x, y]) => s('circle', { cx: x, cy: y, r: 6, class: c })),
  ],
  parang: (c) => [
    s('path', { d: 'M0 40 C10 30 10 20 20 20 S30 10 40 0', class: c }), s('path', { d: 'M-20 20 C-10 10 -10 0 0 0', class: c }), s('path', { d: 'M20 60 C30 50 30 40 40 40', class: c }),
    s('path', { d: 'M0 20 C10 10 10 0 20 -20', class: `${c} motif__fine` }),
  ],
  truntum: (c) => [
    ...[[10, 10], [30, 30]].map(([x, y]) => s('path', { d: `M${x} ${y - 5} L${x + 1.5} ${y - 1.5} L${x + 5} ${y} L${x + 1.5} ${y + 1.5} L${x} ${y + 5} L${x - 1.5} ${y + 1.5} L${x - 5} ${y} L${x - 1.5} ${y - 1.5} Z`, class: `${c} motif__solid` })),
    s('circle', { cx: 30, cy: 10, r: 1.3, class: `${c} motif__solid` }), s('circle', { cx: 10, cy: 30, r: 1.3, class: `${c} motif__solid` }),
  ],
};
export const MOTIFS = Object.keys(TILES);

/** Latar bermotif yang mengisi induknya (absolute). Warna lewat kelas CSS .motif (stroke) dan .motif__solid (fill). */
export function motifBg(kind = 'kawung', { cell = 40, cls = '' } = {}) {
  const id = nextId('mt');
  const svg = s('svg', { class: ['motif-bg', cls], 'aria-hidden': 'true', focusable: 'false', width: '100%', height: '100%', preserveAspectRatio: 'none' });
  const pat = s('pattern', { id, width: cell, height: cell, patternUnits: 'userSpaceOnUse', viewBox: '0 0 40 40' }, ...(TILES[kind] || TILES.kawung)('motif'));
  svg.append(s('defs', null, pat), s('rect', { width: '100%', height: '100%', fill: `url(#${id})` }));
  return svg;
}
