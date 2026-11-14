// Komponen antarmuka bersama: toast, dialog, tombol bersibuk, formulir, tab, lencana.
import { h, icon, frag } from './dom.js';
import { L } from './i18n.js';

export const hooks = { refresh: () => {}, go: (p) => { location.hash = p; } };

// ---------- toast ----------
export function toast(msg, kind = 'ok') {
  const box = document.getElementById('toasts');
  if (!box) return;
  const t = h('div', { class: `toast toast--${kind}`, role: kind === 'err' ? 'alert' : 'status' }, icon(kind === 'err' ? 'alert' : 'check'), h('span', null, msg));
  box.append(t);
  setTimeout(() => t.remove(), kind === 'err' ? 8000 : 4000);
  while (box.children.length > 3) box.firstChild.remove();
}

// ---------- dialog ----------
export function modal({ title, body, actions = [], onClose, wide = false }) {
  const dlg = h('dialog', { class: ['modal', wide ? 'modal--wide' : ''], 'aria-labelledby': 'dlg-title' });
  const close = (v) => { dlg.close(); dlg.remove(); if (onClose) onClose(v); };
  dlg.append(h('div', { class: 'modal__in' }, h('h2', { id: 'dlg-title' }, title), body, actions.length ? h('div', { class: 'actions actions--end' }, actions.map((a) => h('button', { type: 'button', class: ['btn', a.cls || 'btn--line'], onclick: async () => { if (a.run) { const r = await a.run(); if (r === false) return; } close(a.value); } }, a.label))) : null));
  dlg.addEventListener('cancel', () => { dlg.remove(); if (onClose) onClose(undefined); });
  document.body.append(dlg);
  dlg.showModal();
  return { close, el: dlg };
}
export function confirmDialog({ title, body, confirm = L('Iyo', 'Ya'), cancel = L('Batal', 'Batal'), danger = false, requireText = null }) {
  return new Promise((resolve) => {
    let input = null;
    const content = frag(h('p', null, body), requireText ? h('div', { class: 'field' }, h('label', { for: 'dlg-req' }, L(`Ketik "${requireText}" kanggo nerusno`, `Ketik "${requireText}" untuk melanjutkan`)), input = h('input', { id: 'dlg-req', class: 'input', autocomplete: 'off' })) : null);
    const m = modal({ title, body: content, onClose: (v) => resolve(v === true), actions: [{ label: cancel, value: false }, { label: confirm, value: true, cls: danger ? 'btn--danger' : 'btn--primary', run: () => (requireText && input.value.trim() !== requireText ? (input.focus(), false) : true) }] });
    m.el.querySelector('button').focus();
  });
}

// ---------- tombol ----------
export async function busy(btn, fn) {
  const label = btn.cloneNode(true).childNodes;
  btn.disabled = true; btn.setAttribute('aria-busy', 'true');
  const spin = h('span', { class: 'spinner', 'aria-hidden': 'true' });
  btn.prepend(spin);
  try { return await fn(); } finally { spin.remove(); btn.disabled = false; btn.removeAttribute('aria-busy'); void label; }
}
/** Tombol aksi: konfirmasi opsional, notifikasi, lalu muat ulang halaman. */
export function act(label, fn, { cls = 'btn btn--line btn--sm', confirmText, confirmTitle, danger = false, done, reload = true, ic } = {}) {
  const b = h('button', { type: 'button', class: cls }, ic ? icon(ic) : null, label);
  b.addEventListener('click', async () => {
    if (confirmText && !(await confirmDialog({ title: confirmTitle || label, body: confirmText, danger, confirm: label }))) return;
    try { await busy(b, fn); if (done) toast(done); if (reload) hooks.refresh(); } catch (e) { toast(e.message, 'err'); }
  });
  return b;
}

// ---------- formulir ----------
let uid = 0;
export const nid = (p = 'f') => `${p}${++uid}`;
export function field(label, name, { type = 'text', required = false, hint, value, placeholder, options, rows, min, max, step, maxlength, autocomplete, accept, cls = '', inputCls = '' } = {}) {
  const id = nid(`f_${name}_`), hid = hint ? `${id}_h` : null;
  let input;
  const common = { id, name, required, 'aria-describedby': hid };
  if (options) input = h('select', { ...common, class: ['select', inputCls] }, options.map(([v, t]) => h('option', { value: v, selected: String(v) === String(value) }, t)));
  else if (type === 'textarea') input = h('textarea', { ...common, class: ['textarea', inputCls], rows: rows || 3, placeholder, maxlength }, value || '');
  else input = h('input', { ...common, class: ['input', inputCls], type, value: value == null ? null : value, placeholder, min, max, step, maxlength, autocomplete, accept });
  return h('div', { class: ['field', cls] }, h('label', { for: id }, label, required ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null), input, hint ? h('p', { class: 'hint', id: hid }, hint) : null);
}
export const check = (label, name, { required = false, hint, checked = false } = {}) => h('label', { class: 'check' }, h('input', { type: 'checkbox', name, value: 'true', required, checked }), h('span', null, label, hint ? h('small', { class: 'hint block' }, hint) : null));
export const switchEl = (label, name, { checked = false, onchange } = {}) => h('label', { class: 'switch' }, h('input', { type: 'checkbox', role: 'switch', name, checked, onchange }), h('i', { 'aria-hidden': 'true' }), h('span', null, label));
export function form(children, onSubmit, { submit = L('Simpen', 'Simpan'), cls = 'form', ic, secondary } = {}) {
  const f = h('form', { class: cls, novalidate: true });
  const btn = h('button', { type: 'submit', class: 'btn btn--primary' }, ic ? icon(ic) : null, submit);
  f.append(...[].concat(children), h('div', { class: 'actions' }, btn, secondary || null));
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!f.reportValidity()) return;
    try { await busy(btn, () => onSubmit(new FormData(f), f)); } catch (er) { toast(er.message, 'err'); }
  });
  return f;
}
export const fd = (formData) => Object.fromEntries([...formData.entries()].filter(([, v]) => typeof v === 'string'));

/** Bilah kemajuan unggahan (disembunyikan sampai dipakai). el.set(0..1) memperbarui isi. */
export function progressBar(label) {
  const fill = h('div', { class: 'progress__fill' }), txt = h('span', { class: 'tnum' }, '0%');
  const el = h('div', { class: 'progress', hidden: true, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-label': label }, h('div', { class: 'progress__bar' }, fill), txt);
  el.set = (p) => { const n = Math.round(p * 100); fill.style.width = `${n}%`; txt.textContent = `${n}%`; el.setAttribute('aria-valuenow', String(n)); };
  return el;
}

// ---------- potongan kecil ----------
export const badge = (text, kind = '', ic) => h('span', { class: ['badge', kind ? `badge--${kind}` : ''] }, ic ? icon(ic, { cls: 'icon--sm' }) : null, text);
export const notice = (body, kind = 'info', ic) => h('div', { class: ['notice', kind === 'info' ? '' : `notice--${kind}`], role: kind === 'danger' ? 'alert' : null }, icon(ic || (kind === 'warn' || kind === 'danger' ? 'alert' : kind === 'ok' ? 'check' : 'info')), h('div', null, body));
export const skeleton = (w = '100%', hh = '1rem') => h('div', { class: 'skel', style: { width: w, height: hh }, 'aria-hidden': 'true' });
export const loadingBlock = () => h('div', { class: 'wrap pad', role: 'status', 'aria-label': 'Memuat' }, skeleton('45%', '2.4rem'), h('div', { style: { height: '14px' } }), skeleton('80%'), h('div', { style: { height: '8px' } }), skeleton('65%'), h('div', { style: { height: '24px' } }), skeleton('100%', '220px'));
export function empty(title, text, art) {
  return h('div', { class: 'empty' }, art || null, h('h3', null, title), text ? h('p', null, text) : null);
}
export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); toast(L('Wis disalin', 'Tersalin')); } catch { toast(L('Gagal nyalin', 'Gagal menyalin'), 'err'); }
}

// ---------- tab yang dapat diakses ----------
export function tabs(items, { initial = 0, label = 'Tab', onChange } = {}) {
  const id = nid('tb');
  const list = h('div', { class: 'tabs__list', role: 'tablist', 'aria-label': label });
  const panels = [];
  const btns = items.map((it, i) => {
    const b = h('button', { type: 'button', role: 'tab', id: `${id}-t${i}`, 'aria-controls': `${id}-p${i}`, class: 'tabs__tab', tabindex: i === initial ? '0' : '-1' }, it.icon ? icon(it.icon) : null, h('span', null, it.label), it.count != null ? h('span', { class: 'tabs__count' }, it.count) : null);
    b.addEventListener('click', () => select(i, false));
    b.addEventListener('keydown', (e) => {
      const n = items.length;
      let j = null;
      if (e.key === 'ArrowRight') j = (i + 1) % n; else if (e.key === 'ArrowLeft') j = (i - 1 + n) % n; else if (e.key === 'Home') j = 0; else if (e.key === 'End') j = n - 1;
      if (j != null) { e.preventDefault(); select(j, true); }
    });
    list.append(b);
    return b;
  });
  items.forEach((it, i) => {
    const p = h('div', { class: 'tabs__panel', role: 'tabpanel', id: `${id}-p${i}`, 'aria-labelledby': `${id}-t${i}`, tabindex: '0', hidden: i !== initial }, it.panel);
    panels.push(p);
  });
  function select(i, focus) {
    btns.forEach((b, j) => { b.setAttribute('aria-selected', String(j === i)); b.tabIndex = j === i ? 0 : -1; panels[j].hidden = j !== i; });
    if (focus) btns[i].focus();
    if (onChange) onChange(i);
  }
  btns.forEach((b, j) => b.setAttribute('aria-selected', String(j === initial)));
  const root = h('div', { class: 'tabs' }, list, ...panels);
  root.select = (i) => select(i, false);
  return root;
}

// ---------- gerak masuk saat digulir ----------
let io;
export function reveal(root) {
  const els = [...root.querySelectorAll('.reveal')];
  if (!els.length) return;
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach((e) => e.classList.add('in')); return; }
  io = io || new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  els.forEach((e) => io.observe(e));
}
