// Keadaan bersama antarmuka. Hanya preferensi tampilan yang disimpan di peramban (bahasa, tema); data pengguna tetap di server.
const KEY_LANG = 'laras_bahasa', KEY_THEME = 'laras_tema';
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* penyimpanan tidak tersedia */ } },
};
export const S = {
  user: null, profile: null, about: null,
  lang: ['sby', 'id', 'dua'].includes(store.get(KEY_LANG)) ? store.get(KEY_LANG) : 'dua',
  theme: store.get(KEY_THEME) || null,
  listeners: new Set(),
};
export const isStaff = () => !!S.user && (S.user.role === 'maestro' || S.user.role === 'admin');
export const isAdmin = () => !!S.user && S.user.role === 'admin';
export function setLang(l) {
  S.lang = l; store.set(KEY_LANG, l);
  document.documentElement.lang = l === 'id' ? 'id' : 'jv';
}
export function currentTheme() { return S.theme || (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'gelap' : 'terang'); }
export function setTheme(t) {
  S.theme = t; store.set(KEY_THEME, t);
  document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name=theme-color]'); if (m) m.setAttribute('content', t === 'gelap' ? '#130e0c' : '#8c1c26');
}
export const onChange = (fn) => { S.listeners.add(fn); return () => S.listeners.delete(fn); };
export const emit = () => S.listeners.forEach((f) => f());
