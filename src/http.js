'use strict';
/** Pembantu HTTP dan validasi masukan yang dipakai bersama oleh semua modul rute. */
class HttpError extends Error { constructor(status, message) { super(message); this.status = status; } }
const bad = (m) => new HttpError(400, m);
function reqStr(v, name, min = 1, max = 200) {
  if (typeof v !== 'string') throw bad(`${name} wajib diisi`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw bad(`${name} harus ${min}–${max} karakter`);
  return s;
}
function optStr(v, name, max = 2000) {
  if (v == null || v === '') return '';
  if (typeof v !== 'string') throw bad(`${name} tidak valid`);
  const s = v.trim();
  if (s.length > max) throw bad(`${name} maksimal ${max} karakter`);
  return s;
}
function isoDate(v, name) {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw bad(`${name} harus berformat YYYY-MM-DD`);
  return v;
}
function num(v, name, min, max) {
  const n = Number(v);
  if (v === '' || v == null || !Number.isFinite(n) || n < min || n > max) throw bad(`${name} harus berupa angka ${min}–${max}`);
  return n;
}
function oneOf(v, list, name) {
  if (!list.includes(v)) throw bad(`${name} harus salah satu dari: ${list.join(', ')}`);
  return v;
}
const truthy = (v) => v === true || v === 'true' || v === '1' || v === 'on';
const safeName = (n) => String(n || 'berkas').replace(/[^\w.\- ]+/g, '_').slice(0, 120);
const parse = (s) => { try { return s ? JSON.parse(s) : null; } catch { return null; } };
const mmss = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
module.exports = { HttpError, bad, reqStr, optStr, isoDate, num, oneOf, truthy, safeName, parse, mmss };
