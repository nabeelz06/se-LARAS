// DOM aman: semua teks lewat createTextNode, tidak ada innerHTML. Mendukung HTML dan SVG.
const SVGNS = 'http://www.w3.org/2000/svg';

function append(el, kids) {
  for (const k of kids.flat(Infinity)) {
    if (k == null || k === false) continue;
    el.append(k instanceof Node ? k : document.createTextNode(String(k)));
  }
}
function setProps(el, props, svg) {
  let value;
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.setAttribute('class', Array.isArray(v) ? v.filter(Boolean).join(' ') : v);
    else if (k === 'style' && typeof v === 'object') { for (const [p, val] of Object.entries(v)) { if (val == null) continue; if (p.startsWith('--')) el.style.setProperty(p, String(val)); else el.style[p] = val; } }
    else if (k === 'value' && !svg) value = v;
    else if (k === 'checked' && !svg) el.checked = !!v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  return value;
}
export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  const value = setProps(el, props, false);
  append(el, kids);
  if (value !== undefined) el.value = value;
  return el;
}
export function s(tag, props, ...kids) {
  const el = document.createElementNS(SVGNS, tag);
  setProps(el, props, true);
  append(el, kids);
  return el;
}
export const frag = (...kids) => { const f = document.createDocumentFragment(); append(f, kids); return f; };
export const clear = (el) => { while (el.firstChild) el.removeChild(el.firstChild); return el; };
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

// ---------- ikon (garis, 24px) ----------
const I = {
  home: 'M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10',
  book: 'M4 5a2 2 0 012-2h12v15H6a2 2 0 00-2 2V5zM6 20h12',
  stage: 'M3 6h18M5 6v13M19 6v13M3 19h18M9 6c0 4-2 7-4 8M15 6c0 4 2 7 4 8',
  search: [['circle', { cx: 11, cy: 11, r: 6.5 }], ['path', { d: 'M16 16l5 5' }]],
  users: [['circle', { cx: 9, cy: 8, r: 3.5 }], ['path', { d: 'M2.5 20c0-3.6 3-5.5 6.5-5.5s6.5 1.9 6.5 5.5M16 4.8a3.5 3.5 0 010 6.4M18 14.8c2.2.7 3.5 2.3 3.5 5.2' }]],
  user: [['circle', { cx: 12, cy: 8, r: 4 }], ['path', { d: 'M4 21c0-4 4-6 8-6s8 2 8 6' }]],
  play: { fill: true, d: 'M7 4.5v15l13-7.5z' },
  pause: { fill: true, d: 'M6.5 4h4v16h-4zM13.5 4h4v16h-4z' },
  mic: [['rect', { x: 9, y: 3, width: 6, height: 11, rx: 3 }], ['path', { d: 'M5 11a7 7 0 0014 0M12 18v3M9 21h6' }]],
  video: 'M3 6.5h12v11H3zM15 10l6-3.5v11L15 14',
  camera: [['path', { d: 'M4 8h3l2-3h6l2 3h3v11H4z' }], ['circle', { cx: 12, cy: 13, r: 3.5 }]],
  upload: 'M12 16V4M7 9l5-5 5 5M4 20h16',
  download: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  check: 'M4 12.5l5 5L20 6.5',
  x: 'M6 6l12 12M18 6L6 18',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6',
  edit: 'M4 20h4L19 9l-4-4L4 16v4zM13 7l4 4',
  share: [['circle', { cx: 6, cy: 12, r: 2.5 }], ['circle', { cx: 18, cy: 6, r: 2.5 }], ['circle', { cx: 18, cy: 18, r: 2.5 }], ['path', { d: 'M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6' }]],
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 018 0v3',
  globe: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18' }]],
  clock: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 7v5l3.5 2' }]],
  chart: 'M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6',
  eye: [['path', { d: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z' }], ['circle', { cx: 12, cy: 12, r: 3 }]],
  flag: 'M5 21V4M5 4h12l-2.5 4 2.5 4H5',
  bell: 'M12 3a6 6 0 016 6v4l2 3.5H4L6 13V9a6 6 0 016-6zM10 19.5a2 2 0 004 0',
  drum: [['ellipse', { cx: 12, cy: 7, rx: 7, ry: 2.5 }], ['path', { d: 'M5 7v9c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V7M5 10l14 5M19 10L5 15' }]],
  menu: 'M4 7h16M4 12h16M4 17h16',
  moon: 'M20 14.5A8.5 8.5 0 019.5 4 8.5 8.5 0 1020 14.5z',
  sun: [['circle', { cx: 12, cy: 12, r: 4 }], ['path', { d: 'M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8' }]],
  language: 'M4 5h9M8.5 3v2M6 5c1 4 3 7 7 9M12 5c-1 4-3 7-7 9M13 21l4-10 4 10M14.6 17.5h4.8',
  'arrow-right': 'M5 12h14M13 6l6 6-6 6',
  'arrow-left': 'M19 12H5M11 6l-6 6 6 6',
  'chevron-down': 'M6 9l6 6 6-6',
  'chevron-right': 'M9 6l6 6-6 6',
  info: [['circle', { cx: 12, cy: 12, r: 9 }], ['path', { d: 'M12 11v6M12 7.5v.2' }]],
  alert: 'M12 3.5l10 17.5H2L12 3.5zM12 10v5M12 18v.2',
  refresh: 'M20 12a8 8 0 10-2.8 6.1M20 5v5h-5',
  loop: 'M4 12V9a3 3 0 013-3h11l-3-3M20 12v3a3 3 0 01-3 3H6l3 3',
  speed: 'M4 18a9 9 0 1116 0M12 18l4-6',
  caption: 'M3 6h18v12H3zM7 11h4M13 11h4M7 14.5h6',
  body: [['circle', { cx: 12, cy: 4.6, r: 2.6 }], ['path', { d: 'M4.5 10.5l7.5-1.6 7.5 1.6M12 8.9v6M12 14.9l-4.2 6M12 14.9l4.2 6' }]],
  target: [['circle', { cx: 12, cy: 12, r: 9 }], ['circle', { cx: 12, cy: 12, r: 4.5 }], ['path', { d: 'M12 12h.01' }]],
  layers: 'M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 17l9 5 9-5',
  shield: 'M12 3l8 3v6c0 5-3.5 8-8 9.5C7.5 20 4 17 4 12V6l8-3zM8.5 12l2.5 2.5 4.5-5',
  scroll: 'M7 4h12v13a3 3 0 01-3 3H8a3 3 0 01-3-3v-1h3M7 4a2 2 0 00-2 2v10M10 8.5h6M10 12h6M10 15.5h3',
  copy: 'M9 9h11v11H9zM5 15V4h11',
  link: 'M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1',
  external: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  wave: 'M2 12h3l2-6 3 12 3-9 2 6 2-3h5',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  volume: 'M4 9.5v5h4l5 4v-13l-5 4h-4zM16.5 9a4 4 0 010 6M19 6.5a8 8 0 010 11',
  mute: 'M4 9.5v5h4l5 4v-13l-5 4h-4zM17 9.5l5 5M22 9.5l-5 5',
  logout: 'M10 4H5v16h5M15 8l4 4-4 4M19 12H9',
  settings: [['circle', { cx: 12, cy: 12, r: 3 }], ['path', { d: 'M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1' }]],
  heart: 'M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0112 7.5 4.3 4.3 0 0119.5 10c0 5.4-7.5 10-7.5 10z',
  star: 'M12 3.5l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9-5.3 2.9 1.1-6L3.4 9.8l6-.8L12 3.5z',
  flip: 'M4 12a8 8 0 0114-5.3L20 9M20 4v5h-5M20 12a8 8 0 01-14 5.3L4 15M4 20v-5h5',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  sliders: 'M4 7h9M17 7h3M4 17h3M11 17h9M13 5v4M7 15v4',
  key: [['circle', { cx: 8, cy: 14, r: 4 }], ['path', { d: 'M11 11l9-8M16 6l3 3M14 8l2 2' }]],
  link2: 'M8 12h8',
  hash: 'M5 9h14M5 15h14M10 4L8 20M16 4l-2 16',
  tag: 'M3 12V4h8l10 10-8 8L3 12zM7.5 8h.01',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
};
export function icon(name, { cls = '', size, title } = {}) {
  const def = I[name];
  const filled = !!def && !Array.isArray(def) && typeof def === 'object' && def.fill === true;
  const svg = s('svg', { class: ['icon', filled ? 'icon--fill' : '', cls], viewBox: '0 0 24 24', 'aria-hidden': title ? null : 'true', role: title ? 'img' : null, width: size, height: size, focusable: 'false' });
  if (title) svg.append(s('title', null, title));
  if (!def) return svg;
  if (typeof def === 'string') svg.append(s('path', { d: def }));
  else if (Array.isArray(def)) def.forEach(([t, a]) => svg.append(s(t, a)));
  else svg.append(s('path', { d: def.d }));
  return svg;
}

// ---------- format ----------
export const mmss = (sec) => { const n = Math.max(0, Math.floor(Number(sec) || 0)); return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`; };
export const num = (v, d = 2) => (v == null || !Number.isFinite(Number(v)) ? '–' : Number(v).toFixed(d).replace('.', ','));
export function fmtDate(iso, long = true) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00:00+07:00` : iso.replace(' ', 'T') + (iso.includes('T') || iso.includes('Z') ? '' : 'Z'));
  if (Number.isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat('id-ID', { dateStyle: long ? 'long' : 'medium', timeZone: 'Asia/Jakarta' }).format(d);
}
export function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso.replace(' ', 'T') + (iso.includes('T') || iso.includes('Z') ? '' : 'Z'));
  return Number.isNaN(d.getTime()) ? String(iso) : new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Jakarta' }).format(d) + ' WIB';
}
export const bytes = (n) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1).replace('.', ',')} MB`);
export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
