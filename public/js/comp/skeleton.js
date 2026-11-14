// Penggambar kerangka pose (BlazePose, koordinat 0..1) di atas video. Menghitung kotak isi video agar tepat walau ada pita hitam (object-fit: contain).
const EDGES = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28], [0, 11], [0, 12]];
const DOTS = [0, 11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
export const SKEL_COLORS = { maestro: '#f1c866', murid: '#5fd3c8' };

export function nearest(timeline, t) {
  if (!timeline || !timeline.length) return null;
  let lo = 0, hi = timeline.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (timeline[mid].t < t) lo = mid + 1; else hi = mid; }
  const c = [timeline[lo], timeline[lo - 1]].filter(Boolean).sort((a, b) => Math.abs(a.t - t) - Math.abs(b.t - t))[0];
  return c && Math.abs(c.t - t) <= 0.6 ? c : null;
}
/** Kotak isi video di dalam elemen (px relatif elemen). */
export function contentRect(video) {
  const r = video.getBoundingClientRect();
  const vw = video.videoWidth || r.width, vh = video.videoHeight || r.height;
  const k = Math.min(r.width / vw, r.height / vh);
  const w = vw * k, hh = vh * k;
  return { x: (r.width - w) / 2, y: (r.height - hh) / 2, w, h: hh };
}
export function drawSkeleton(g, lm, box, color, { alpha = 1, line = 3, dot = 4 } = {}) {
  g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.fillStyle = color; g.lineWidth = line; g.lineCap = 'round';
  const X = (p) => box.x + p[0] * box.w, Y = (p) => box.y + p[1] * box.h;
  for (const [a, b] of EDGES) {
    if (!lm[a] || !lm[b] || lm[a][2] < 0.5 || lm[b][2] < 0.5) continue;
    g.beginPath(); g.moveTo(X(lm[a]), Y(lm[a])); g.lineTo(X(lm[b]), Y(lm[b])); g.stroke();
  }
  for (const i of DOTS) { if (!lm[i] || lm[i][2] < 0.5) continue; g.beginPath(); g.arc(X(lm[i]), Y(lm[i]), dot, 0, 7); g.fill(); }
  g.restore();
}
/** Geser kerangka acuan agar berpusat di pinggul dan sama besar dengan kerangka sasaran (khusus tampilan "bayangan"). */
export function anchorTo(src, dst, box) {
  const c = (lm) => {
    if (![11, 12, 23, 24].every((i) => lm[i] && lm[i][2] >= 0.5)) return null;
    const sh = [(lm[11][0] + lm[12][0]) / 2 * box.w, (lm[11][1] + lm[12][1]) / 2 * box.h], hp = [(lm[23][0] + lm[24][0]) / 2 * box.w, (lm[23][1] + lm[24][1]) / 2 * box.h];
    return { hp, len: Math.hypot(sh[0] - hp[0], sh[1] - hp[1]) };
  };
  const a = c(src), b = c(dst);
  if (!a || !b || a.len < 5) return null;
  const k = b.len / a.len;
  return src.map((p) => [((p[0] * box.w - a.hp[0]) * k + b.hp[0]) / box.w, ((p[1] * box.h - a.hp[1]) * k + b.hp[1]) / box.h, p[2]]);
}
