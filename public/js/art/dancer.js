// Ilustrasi kerangka penari: pose berupa 14 titik sendi seperti yang dibaca se-LARAS dari video (BlazePose menghasilkan 33 titik; di sini 14 untuk tampilan).
// Emas = contoh maestro, teal = bayangan latihan pemain muda yang tertinggal dan sedikit lebih sempit. Gambar ini ILUSTRASI, bukan hasil pengukuran.
import { s } from '../core/dom.js';

const J = ['head', 'neck', 'sL', 'sR', 'eL', 'eR', 'wL', 'wR', 'pel', 'hL', 'hR', 'kL', 'kR', 'aL', 'aR'];
// Koordinat dalam kotak 240 x 340.
const P = [
  { head: [120, 58], neck: [120, 92], sL: [96, 102], sR: [144, 102], eL: [80, 142], eR: [160, 142], wL: [92, 178], wR: [148, 178], pel: [120, 192], hL: [106, 192], hR: [134, 192], kL: [84, 248], kR: [156, 248], aL: [70, 308], aR: [170, 308] },
  { head: [124, 56], neck: [122, 90], sL: [98, 100], sR: [146, 100], eL: [62, 112], eR: [180, 76], wL: [26, 128], wR: [204, 34], pel: [122, 190], hL: [108, 190], hR: [136, 190], kL: [82, 242], kR: [170, 222], aL: [66, 304], aR: [152, 270] },
  { head: [120, 62], neck: [120, 96], sL: [94, 104], sR: [146, 104], eL: [52, 100], eR: [188, 100], wL: [12, 98], wR: [228, 98], pel: [120, 198], hL: [102, 198], hR: [138, 198], kL: [60, 250], kR: [180, 250], aL: [38, 310], aR: [202, 310] },
  { head: [116, 56], neck: [118, 90], sL: [94, 100], sR: [142, 100], eL: [60, 76], eR: [178, 112], wL: [36, 34], wR: [214, 128], pel: [118, 190], hL: [104, 190], hR: [132, 190], kL: [70, 222], kR: [158, 242], aL: [88, 270], aR: [174, 304] },
];
const BONES = [['sL', 'sR'], ['neck', 'sL'], ['neck', 'sR'], ['sL', 'eL'], ['eL', 'wL'], ['sR', 'eR'], ['eR', 'wR'], ['neck', 'pel'], ['hL', 'hR'], ['sL', 'hL'], ['sR', 'hR'], ['hL', 'kL'], ['kL', 'aL'], ['hR', 'kR'], ['kR', 'aR']];
const SEG = 0.85; // detik per pose
const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - ((-2 * x + 2) ** 3) / 2);

function poseAt(t, amp = 1) {
  const k = ((t / SEG) % P.length + P.length) % P.length;
  const i = Math.floor(k), f = ease(k - i), a = P[i], b = P[(i + 1) % P.length], base = P[0];
  const out = {};
  const bob = Math.sin((t / SEG) * Math.PI * 2) * 3;
  for (const j of J) {
    let x = a[j][0] + (b[j][0] - a[j][0]) * f, y = a[j][1] + (b[j][1] - a[j][1]) * f;
    x = 120 + (x - 120) * amp + (base[j][0] - 120) * (1 - amp) * 0; y += j.startsWith('a') ? 0 : bob;
    out[j] = [x, y];
  }
  return out;
}

export function createDancer({ ghost = true, size = 340 } = {}) {
  const svg = s('svg', { class: 'dancer', viewBox: '-30 0 300 340', width: size, height: size * 340 / 300, role: 'img', 'aria-label': 'Ilustrasi kerangka gerak penari: garis emas contoh maestro dan garis teal bayangan latihan' });
  const defs = s('defs', null, s('linearGradient', { id: 'dn-gold', x1: 0, y1: 0, x2: 0, y2: 1 }, s('stop', { offset: 0, 'stop-color': '#f6d680' }), s('stop', { offset: 1, 'stop-color': '#c58f22' })),
    s('filter', { id: 'dn-glow', x: '-30%', y: '-30%', width: '160%', height: '160%' }, s('feGaussianBlur', { stdDeviation: 3.2, result: 'b' }), s('feMerge', null, s('feMergeNode', { in: 'b' }), s('feMergeNode', { in: 'SourceGraphic' }))));
  svg.append(defs);
  const mk = (cls, hasGhost) => {
    const g = s('g', { class: cls });
    const bones = BONES.map(() => g.appendChild(s('line', { class: 'dn__bone', 'stroke-linecap': 'round' })));
    const joints = J.filter((j) => j !== 'head' && j !== 'pel').map((j) => ({ j, el: g.appendChild(s('circle', { class: 'dn__joint', r: cls === 'dn dn--m' ? 4.4 : 3 })) }));
    const head = g.appendChild(s('circle', { class: 'dn__head', r: 17 }));
    const udeng = hasGhost ? g.appendChild(s('g', { class: 'dn__udeng' }, s('path', { d: 'M-17 -2 A17 17 0 0 1 17 -2 Q0 -10 -17 -2 Z' }), s('path', { d: 'M8 -15 L19 -25 L18 -9 Z' }))) : null;
    const bells = hasGhost ? ['aL', 'aR'].map((j) => ({ j, el: g.appendChild(s('g', { class: 'dn__bell' }, s('circle', { r: 7 }), s('path', { d: 'M-4 1 H4' }), s('circle', { cy: 3.5, r: 1.2 }))) })) : [];
    return { g, bones, joints, head, udeng, bells };
  };
  const learner = ghost ? mk('dn dn--l', false) : null;
  const trail = s('g', { class: 'dn__trail' });
  const trailSegs = Array.from({ length: 26 }, () => trail.appendChild(s('line', { 'stroke-linecap': 'round' })));
  const trail2 = s('g', { class: 'dn__trail' });
  const trailSegs2 = Array.from({ length: 26 }, () => trail2.appendChild(s('line', { 'stroke-linecap': 'round' })));
  const maestro = mk('dn dn--m', true);
  svg.append(...(learner ? [learner.g] : []), trail, trail2, maestro.g);
  const hist = [[], []];

  function place(skel, pose) {
    BONES.forEach(([a, b], i) => { const l = skel.bones[i]; l.setAttribute('x1', pose[a][0]); l.setAttribute('y1', pose[a][1]); l.setAttribute('x2', pose[b][0]); l.setAttribute('y2', pose[b][1]); });
    skel.joints.forEach(({ j, el }) => { el.setAttribute('cx', pose[j][0]); el.setAttribute('cy', pose[j][1]); });
    skel.head.setAttribute('cx', pose.head[0]); skel.head.setAttribute('cy', pose.head[1]);
    if (skel.udeng) skel.udeng.setAttribute('transform', `translate(${pose.head[0].toFixed(1)} ${pose.head[1].toFixed(1)})`);
    skel.bells.forEach(({ j, el }) => el.setAttribute('transform', `translate(${pose[j][0].toFixed(1)} ${(pose[j][1] + 8).toFixed(1)})`));
  }
  function drawTrail(segs, h) {
    const n = segs.length;
    segs.forEach((l, i) => {
      const a = h[h.length - 1 - i], b = h[h.length - 2 - i];
      if (!a || !b) { l.setAttribute('opacity', 0); return; }
      l.setAttribute('x1', a[0]); l.setAttribute('y1', a[1]); l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]);
      const k = 1 - i / n;
      l.setAttribute('opacity', (0.75 * k * k).toFixed(3)); l.setAttribute('stroke-width', (1 + 7 * k).toFixed(2));
    });
  }
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let raf = 0, t0 = performance.now(), stopped = false;
  const frame = (now) => {
    if (stopped || !svg.isConnected) return;
    const t = (now - t0) / 1000;
    const pm = poseAt(t, 1);
    place(maestro, pm);
    if (learner) place(learner, poseAt(t - 0.42, 0.9));
    [pm.wL, pm.wR].forEach((w, i) => { hist[i].push(w.slice()); if (hist[i].length > 28) hist[i].shift(); });
    drawTrail(trailSegs, hist[0]); drawTrail(trailSegs2, hist[1]);
    raf = requestAnimationFrame(frame);
  };
  if (reduced) { place(maestro, P[2]); if (learner) place(learner, poseAt(0.9, 0.9)); trailSegs.concat(trailSegs2).forEach((l) => l.setAttribute('opacity', 0)); }
  else { place(maestro, P[0]); raf = requestAnimationFrame(frame); }
  const vis = () => { if (document.hidden) cancelAnimationFrame(raf); else if (!reduced && !stopped && svg.isConnected) { cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', vis);
  svg.stop = () => { stopped = true; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); };
  return svg;
}
