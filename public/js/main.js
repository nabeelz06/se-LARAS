// Kerangka aplikasi: bilah atas, menu bawah (ponsel), kaki halaman, rute, dan muat awal.
import { h, icon, clear } from './core/dom.js';
import { GET, POST } from './core/api.js';
import { S, setLang, setTheme, currentTheme, isStaff, isAdmin } from './core/state.js';
import { L } from './core/i18n.js';
import { route, start, render, parseHash, go } from './core/router.js';
import { hooks, toast } from './core/ui.js';
import { logoMark, gongsengDivider, aksara, AKSARA } from './art/ornament.js';

const page = (file, fn = 'render') => (p, q) => import(`./pages/${file}.js`).then((m) => m[fn](p, q));
route('/', page('home'));
route('/unit', page('units'));
route('/unit/:id', page('unit'));
route('/unit/:id/latihan', page('studio'), 'auth');
route('/latihan/:id', page('attempt'), 'auth');
route('/cari', page('search'));
route('/kamus', page('glossary'));
route('/kelas', page('classes'), 'auth');
route('/kelas/:id', page('classes', 'renderDetail'), 'auth');
route('/kemajuan', page('progress'), 'auth');
route('/jejak', page('ledger'));
route('/tentang', page('about'));
route('/masuk', page('auth', 'login'));
route('/daftar', page('auth', 'register'));
route('/saya', page('auth', 'account'), 'auth');
route('/maestro', page('maestro'), 'maestro');
route('/maestro/:id', page('manage'), 'maestro');
route('/admin', page('admin'), 'admin');

const topbar = document.getElementById('topbar'), tabbar = document.getElementById('tabbar'), foot = document.getElementById('foot');

// Prioritas menu atas: bila ruang sempit, item berprioritas terendah pindah ke menu "Liyane" (bukan meluber ke samping).
const NAV_PRI = { '/unit': 9, '/admin': 8, '/maestro': 8, '/cari': 7, '/kelas': 6, '/kemajuan': 5, '/kamus': 4, '/jejak': 2, '/tentang': 1 };
function navItems() {
  const items = [['/unit', L('Unit Latihan', 'Unit Latihan'), 'stage'], ['/cari', L('Goleki', 'Cari'), 'search'], ['/kamus', L('Kamus', 'Kamus'), 'book']];
  if (S.user) items.push(['/kelas', L('Kelas', 'Kelas'), 'users'], ['/kemajuan', L('Kemajuan', 'Kemajuan'), 'chart']);
  if (isStaff()) items.push(['/maestro', L('Maestro', 'Maestro'), 'drum']);
  if (isAdmin()) items.push(['/admin', 'Admin', 'settings']);
  items.push(['/jejak', L('Jejak', 'Jejak'), 'scroll'], ['/tentang', L('Tentang', 'Tentang'), 'info']);
  return items;
}
const active = (path, p) => (p === '/' ? path === '/' : path === p || path.startsWith(`${p}/`));

/** Menu atas adaptif ("priority+"): item yang tidak muat pindah ke tombol "Liyane". Dihitung dari lebar sebenarnya, jadi aman untuk peran, bahasa, dan font apa pun. */
let navCtl = null;
function navBlock(items, path) {
  const links = items.map(([p, t], i) => h('a', { href: `#${p}`, 'aria-current': active(path, p) ? 'page' : null, 'data-pri': String(NAV_PRI[p] ?? 5), 'data-i': String(i) }, t));
  const list = h('div', { class: 'nav__list' }, links);
  const pop = h('div', { class: 'nav__pop', id: 'nav-more-pop', hidden: true });
  const btn = h('button', { type: 'button', class: 'nav__morebtn', 'aria-expanded': 'false', 'aria-controls': 'nav-more-pop' }, L('Liyane', 'Lainnya'), icon('chevron-down', { cls: 'icon--sm' }));
  const more = h('div', { class: 'nav__more', hidden: true }, btn, pop);
  const nav = h('nav', { class: 'nav', 'aria-label': 'Menu utama' }, list, more);
  const setOpen = (o) => { btn.setAttribute('aria-expanded', String(o)); pop.hidden = !o; };
  btn.addEventListener('click', () => setOpen(pop.hidden));
  more.addEventListener('focusout', (e) => { if (!more.contains(e.relatedTarget)) setOpen(false); });
  const over = () => list.scrollWidth > list.clientWidth + 1;
  const fit = () => {
    links.forEach((a) => { a.hidden = false; });
    more.hidden = true; pop.replaceChildren(); setOpen(false); btn.classList.remove('is-on'); topbar.classList.remove('is-tight');
    if (!nav.offsetParent || !over()) return; // nav disembunyikan (ponsel) atau semua muat
    topbar.classList.add('is-tight'); // tahap 1: aksara di samping nama merek disembunyikan dan jarak dirapatkan
    if (!over()) return;
    more.hidden = false; // tahap 2: item berprioritas terendah pindah ke "Liyane"
    const moved = [];
    for (const a of [...links].sort((x, y) => (x.dataset.pri - y.dataset.pri) || (y.dataset.i - x.dataset.i))) { if (!over()) break; a.hidden = true; moved.push(a); }
    moved.sort((x, y) => x.dataset.i - y.dataset.i);
    pop.append(h('ul', null, moved.map((a) => h('li', null, h('a', { href: a.getAttribute('href'), 'aria-current': a.getAttribute('aria-current') }, a.textContent)))));
    btn.classList.toggle('is-on', moved.some((a) => a.getAttribute('aria-current') === 'page'));
  };
  navCtl = { fit, close: () => setOpen(false), isOpen: () => !pop.hidden, btn, more };
  return nav;
}
document.addEventListener('click', (e) => { if (navCtl && navCtl.isOpen() && !navCtl.more.contains(e.target)) navCtl.close(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && navCtl && navCtl.isOpen()) { navCtl.close(); navCtl.btn.focus(); } });
new ResizeObserver(() => { if (navCtl) navCtl.fit(); }).observe(document.getElementById('topbar'));
if (document.fonts) { document.fonts.ready.then(() => { if (navCtl) navCtl.fit(); }); document.fonts.addEventListener('loadingdone', () => { if (navCtl) navCtl.fit(); }); }

function langSwitch() {
  const opt = [['sby', 'SBY', 'Suroboyoan'], ['dua', 'SBY+ID', 'Suroboyoan dan Indonesia'], ['id', 'ID', 'Indonesia']];
  return h('div', { class: 'seg', role: 'group', 'aria-label': L('Basa antarmuka', 'Bahasa antarmuka') }, opt.map(([v, t, lab]) => h('button', { type: 'button', 'aria-pressed': String(S.lang === v), 'aria-label': `${t} – ${lab}`, title: lab, onclick: () => { setLang(v); renderChrome(); render({ focus: false, keepScroll: true }); } }, t)));
}
function themeBtn() {
  const dark = currentTheme() === 'gelap';
  return h('button', { type: 'button', class: 'iconbtn', 'aria-label': dark ? L('Tema padhang', 'Tema terang') : L('Tema peteng', 'Tema gelap'), title: dark ? L('Tema padhang', 'Tema terang') : L('Tema peteng', 'Tema gelap'), onclick: () => { setTheme(dark ? 'terang' : 'gelap'); renderChrome(); } }, icon(dark ? 'sun' : 'moon'));
}

/** Nama merek: "se-" kecil miring berwarna emas, lalu LARAS. Teks tetap terbaca "se-LARAS" bagi pembaca layar. */
const wordmark = () => h('span', { class: 'brand__word' }, h('span', { class: 'brand__se' }, 'se-'), 'LARAS');

export function renderChrome() {
  const { path } = parseHash();
  const items = navItems();
  clear(topbar).append(h('div', { class: 'wrap topbar__in' },
    h('a', { class: 'brand', href: '#/' }, logoMark({ size: 36 }), wordmark(), aksara(AKSARA.selaras, 'brand__aksara'), h('span', { class: 'sr' }, L(', nang ngarep', ', ke beranda'))),
    navBlock(items, path),
    h('div', { class: 'tools' }, langSwitch(), themeBtn(),
      S.user ? h('a', { class: ['btn btn--line btn--sm', active(path, '/saya') ? 'is-on' : ''], href: '#/saya' }, icon('user'), h('span', { class: 'sr' }, `${L('Akun', 'Akun')}: `), h('span', { class: 'hide-sm' }, S.user.name.split(' ')[0]))
        : h('a', { class: 'btn btn--primary btn--sm', href: '#/masuk' }, L('Mlebu', 'Masuk')))));
  navCtl.fit();
  const tabs = [['/', L('Ngarep', 'Beranda'), 'home'], ['/unit', L('Latihan', 'Latihan'), 'stage'], ['/cari', L('Goleki', 'Cari'), 'search'], ['/kamus', L('Kamus', 'Kamus'), 'book'],
    S.user ? (isStaff() ? ['/maestro', L('Maestro', 'Maestro'), 'drum'] : ['/kemajuan', L('Kemajuan', 'Kemajuan'), 'chart']) : ['/masuk', L('Mlebu', 'Masuk'), 'user']];
  clear(tabbar).append(h('div', { class: 'tabbar__in' }, tabs.map(([p, t, ic]) => h('a', { href: `#${p}`, 'aria-current': active(path, p) ? 'page' : null }, icon(ic), h('span', null, t)))));
  const a = S.about || {};
  clear(foot).append(h('div', { class: 'wrap' }, gongsengDivider({ cls: 'foot__ornament' }),
    h('div', { class: 'foot__grid' },
      h('div', null, h('div', { class: 'brand', style: { marginBottom: '.6rem' } }, logoMark({ size: 32 }), wordmark()), h('p', null, L('Living Arts Repository, Analysis, and Skills-transfer. Arsip belajar Ludruk Surabaya soko maestro, kanggo pemain sakteruse.', 'Living Arts Repository, Analysis, and Skills-transfer. Arsip belajar Ludruk Surabaya dari maestro, untuk pemain berikutnya.'))),
      h('div', null, h('h2', { class: 'foot__h' }, L('Jelajahi', 'Jelajahi')), h('ul', null, [['/unit', L('Unit latihan', 'Unit latihan')], ['/cari', L('Goleki bersumber', 'Pencarian bersumber')], ['/kamus', L('Kamus Ludruk', 'Kamus Ludruk')], ['/jejak', L('Buku jejak', 'Buku jejak')], ['/tentang', L('Cara kerja lan watese', 'Cara kerja dan batasnya')]].map(([p, t]) => h('li', null, h('a', { href: `#${p}` }, t))))),
      h('div', null, h('h2', { class: 'foot__h' }, L('Sing kudu ditepungi', 'Yang perlu diketahui')), h('p', null, L('Tulisan Suroboyoan nang kene isih DRAF, nunggu disahno penutur asli. Unit "conto uji" ora isi maestro.', 'Tulisan Suroboyoan di sini masih DRAF dan menunggu pengesahan penutur asli. Unit "contoh uji" bukan konten maestro.')),
        h('p', { class: 'muted' }, `v${a.version || '0.3.0'} · ${L('Prototipe BUDAYA GO! 2026 · Subtema 4', 'Prototipe BUDAYA GO! 2026 · Subtema 4')}`)))));
}

async function refreshSession() {
  try { const me = await GET('/api/me'); S.user = me.user; S.profile = me.profile; } catch { S.user = null; }
}
hooks.session = async () => { await refreshSession(); renderChrome(); };
window.addEventListener('hashchange', renderChrome);

(async () => {
  setLang(S.lang); setTheme(currentTheme());
  try { const [, about] = await Promise.all([refreshSession(), GET('/api/about')]); S.about = about; } catch (e) { toast(e.message, 'err'); }
  renderChrome();
  await start(document.getElementById('main'), renderChrome);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('/sw.js').catch(() => {});
})();
void POST; void go;
