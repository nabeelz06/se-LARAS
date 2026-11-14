// Perkakas kecil untuk halaman maestro: bidang waktu, tombol aksi dengan konfirmasi, dan dialog formulir.
import { h, icon } from '../core/dom.js';
import { L } from '../core/i18n.js';
import { field, form, modal, busy, toast, confirmDialog } from '../core/ui.js';

/** "1:05", "1:05,5" atau "65" -> detik; null bila tidak terbaca. */
export function parseTime(v) {
  const t = String(v == null ? '' : v).trim().replace(',', '.');
  if (!/^\d+(:\d{1,2}){0,2}(\.\d+)?$/.test(t)) return null;
  let sec = 0; for (const p of t.split(':')) sec = sec * 60 + Number(p);
  return Number.isFinite(sec) ? Math.round(sec * 100) / 100 : null;
}
/** Detik dengan satu desimal untuk judul/tooltip. */
export const sec1 = (v) => `${Number(v).toFixed(1).replace('.', ',')} dtk`;

/** Bidang waktu (detik) dengan tombol "pakai waktu pemutar". player boleh null. */
export function timeField(player, label, name, { value, required = false, hint } = {}) {
  const f = field(label, name, { type: 'number', min: 0, step: '0.1', required, value: value == null ? '' : value, hint });
  const input = f.querySelector('input');
  if (player) {
    f.append(h('button', { type: 'button', class: 'btn btn--ghost btn--sm timefield__now', onclick: () => { input.value = nowOf(player).toFixed(1); input.dispatchEvent(new Event('input', { bubbles: true })); } },
      icon('clock', { cls: 'icon--sm' }), L('Pakai wektu pemutar', 'Pakai waktu pemutar')));
  }
  return f;
}
export const nowOf = (player) => (player ? Math.floor(player.video.currentTime * 10) / 10 : 0);
export const secOrNull = (v) => (v == null || v === '' ? null : Number(v));

async function confirmThen(b, fn, { confirm: ctext, confirmTitle, danger, label, requireText, done }) {
  if (ctext && !(await confirmDialog({ title: confirmTitle || label, body: ctext, danger, confirm: label, requireText }))) return;
  try { await busy(b, fn); if (done) toast(done); } catch (e) { toast(e.message, 'err'); }
}
/** Tombol aksi: konfirmasi opsional, spinner, lalu fn(); galat tampil sebagai toast. */
export function mbtn(label, fn, { ic, cls = 'btn btn--line btn--sm', disabled = false, title, ...o } = {}) {
  const b = h('button', { type: 'button', class: cls, title: title || null, disabled }, ic ? icon(ic) : null, label);
  b.addEventListener('click', () => confirmThen(b, fn, { ...o, label }));
  return b;
}
/** Tombol ikon (tanpa teks tampak) untuk baris daftar. */
export function ibtn(label, fn, { ic, disabled = false, danger = false, ...o } = {}) {
  const b = h('button', { type: 'button', class: ['iconbtn', 'iconbtn--sm', danger ? 'iconbtn--danger' : ''], 'aria-label': label, title: label, disabled }, icon(ic));
  b.addEventListener('click', () => confirmThen(b, fn, { ...o, label, danger }));
  return b;
}

/** Dialog berisi formulir; onSubmit(FormData) dijalankan, lalu dialog ditutup bila tidak melempar galat. */
export function formModal({ title, children, onSubmit, submit = L('Simpen', 'Simpan'), ic }) {
  let m;
  const cancel = h('button', { type: 'button', class: 'btn btn--line', onclick: () => m.close() }, L('Batal', 'Batal'));
  const f = form(children, async (fd) => { await onSubmit(fd); m.close(); }, { submit, secondary: cancel, ic });
  m = modal({ title, body: f, wide: true });
  return m;
}
export const fdObj = (fd) => Object.fromEntries([...fd.entries()].filter(([, v]) => typeof v === 'string'));
