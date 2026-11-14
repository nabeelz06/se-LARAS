// Router hash dengan penjaga akses, pengelolaan fokus, dan pembersihan halaman.
import { h, clear } from './dom.js';
import { S, isStaff, isAdmin } from './state.js';
import { L } from './i18n.js';
import { hooks, loadingBlock, reveal } from './ui.js';

const routes = [];
let seq = 0, leaveFns = [], mainEl = null, onRoute = () => {};
export const route = (pattern, loader, guard) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:([a-z]+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }).replace(/\/$/, '') + '/?$');
  routes.push({ re, keys, loader, guard, pattern });
};
export const onLeave = (fn) => { leaveFns.push(fn); };
export function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const [path, qs] = raw.split('?');
  return { path: path || '/', query: new URLSearchParams(qs || '') };
}
export const go = (p) => { if (location.hash === `#${p}`) render(); else location.hash = p; };
hooks.go = (p) => go(p.replace(/^#/, ''));

export async function render({ focus = true, keepScroll = false } = {}) {
  const my = ++seq;
  const { path, query } = parseHash();
  const y = window.scrollY;
  leaveFns.splice(0).forEach((f) => { try { f(); } catch { /* sudah dibersihkan */ } });
  let hit = null, params = {};
  for (const r of routes) { const m = r.re.exec(path); if (m) { hit = r; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); }); break; } }
  onRoute(path);
  const slow = setTimeout(() => { if (my === seq) { clear(mainEl); mainEl.append(loadingBlock()); } }, 140);
  let node;
  try {
    if (!hit) node = notFound();
    else if (hit.guard && !allowed(hit.guard)) node = needLogin(hit.guard, path);
    else node = await hit.loader(params, query);
  } catch (e) {
    node = failure(e);
  }
  clearTimeout(slow);
  if (my !== seq) return;
  clear(mainEl); mainEl.append(node);
  const h1 = mainEl.querySelector('h1');
  document.title = `${h1 ? h1.textContent.replace(/\s+/g, ' ').trim() : 'se-LARAS'} · se-LARAS`;
  reveal(mainEl);
  if (keepScroll) window.scrollTo(0, y);
  else if (focus) { window.scrollTo(0, 0); mainEl.focus({ preventScroll: true }); }
  const live = document.getElementById('route-live'); if (live) live.textContent = document.title;
}
function allowed(g) { return g === 'auth' ? !!S.user : g === 'maestro' ? isStaff() : g === 'admin' ? isAdmin() : true; }
function needLogin(g, path) {
  const back = encodeURIComponent(path);
  return h('div', { class: 'wrap wrap--narrow pad' }, h('h1', null, S.user ? L('Ora entuk mlebu', 'Tidak punya akses') : L('Mlebu sik, yo', 'Silakan masuk dulu')),
    h('p', { class: 'lead' }, S.user ? L('Kaca iki kanggo maestro/praktisi sing ditunjuk.', 'Halaman ini untuk maestro atau praktisi yang ditunjuk.') : L('Kaca iki butuh akun.', 'Halaman ini membutuhkan akun.')),
    S.user ? h('a', { class: 'btn btn--line', href: '#/' }, L('Bali nang ngarep', 'Kembali ke beranda')) : h('a', { class: 'btn btn--primary', href: `#/masuk?next=${back}` }, L('Mlebu', 'Masuk')), g === 'maestro' && S.user ? null : null);
}
function notFound() {
  return h('div', { class: 'wrap wrap--narrow pad center' }, h('p', { class: 'eyebrow' }, '404'), h('h1', null, L('Kaca ora ketemu', 'Halaman tidak ditemukan')), h('p', { class: 'lead', style: { marginInline: 'auto' } }, L('Mungkin alamate salah, utowo kontene wis ditarik maestro.', 'Mungkin alamatnya salah, atau kontennya sudah ditarik maestro.')), h('a', { class: 'btn btn--primary', href: '#/' }, L('Bali nang ngarep', 'Kembali ke beranda')));
}
function failure(e) {
  const gone = e.status === 410, auth = e.status === 401;
  return h('div', { class: 'wrap wrap--narrow pad' }, h('h1', null, gone ? L('Unit wis ditarik', 'Unit sudah ditarik') : auth ? L('Mlebu sik, yo', 'Silakan masuk dulu') : L('Ono kendala', 'Terjadi kendala')),
    h('div', { class: 'notice notice--warn', role: 'alert' }, h('p', null, e.message)),
    h('div', { class: 'actions', style: { marginTop: '1.2rem' } }, auth ? h('a', { class: 'btn btn--primary', href: `#/masuk?next=${encodeURIComponent(parseHash().path)}` }, L('Mlebu', 'Masuk')) : null, h('a', { class: 'btn btn--line', href: '#/' }, L('Bali nang ngarep', 'Kembali ke beranda'))));
}
export function start(main, routeCb) {
  mainEl = main; onRoute = routeCb || onRoute;
  hooks.refresh = () => render({ focus: false, keepScroll: true });
  window.addEventListener('hashchange', () => render());
  return render();
}
