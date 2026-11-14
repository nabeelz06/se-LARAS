'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const M = require('../src/metrics');
const { CANNED_MAESTRO } = require('./harness');

const dims = [{ metric: 'pause_mean_s', label_sby: 'a', label_id: 'a', tolerance_pct: 20 }];
const mk = (p) => ({ ...CANNED_MAESTRO, audio: { ...CANNED_MAESTRO.audio, pause_mean_s: p } });

test('toleransi: di dalam = cedhak, di luar = lebih tinggi/rendah', () => {
  const st = (p) => M.compare(CANNED_MAESTRO, mk(p), dims).rows[0].status;
  assert.equal(st(0.9), 'cedhak'); assert.equal(st(1.05), 'cedhak'); assert.equal(st(1.2), 'luwih_dhuwur'); assert.equal(st(0.5), 'luwih_endhek');
});
test('acuan nol tidak membuat semuanya berbeda (lantai toleransi)', () => {
  const ref = { ...CANNED_MAESTRO, audio: { ...CANNED_MAESTRO.audio, pause_mean_s: 0 } };
  assert.equal(M.compare(ref, mk(0.02), dims).rows[0].status, 'cedhak');
});
test('ukuran kosong atau peringatan => tidak_andal, bukan nol', () => {
  const noAudio = { version: 1, audio: null, pose: null, warnings: ['tanpa_audio'] };
  assert.equal(M.compare(CANNED_MAESTRO, noAudio, dims).rows[0].status, 'tidak_andal');
});
test('available hanya memuat ukuran yang terhitung dan andal', () => {
  const a = M.available(CANNED_MAESTRO);
  assert.ok(a.includes('pause_mean_s') && a.includes('wrist_speed_mean'));
  assert.ok(!a.includes('gesture_speech_lag_s'));
  assert.deepEqual(M.available({ ...CANNED_MAESTRO, warnings: ['pose_sulit_dideteksi'] }).filter((k) => M.CATALOG[k].src === 'pose'), []);
});
test('tidak ada skor gabungan di keluaran perbandingan', () => {
  const c = M.compare(CANNED_MAESTRO, mk(0.5), dims);
  assert.deepEqual(Object.keys(c), ['rows', 'cautions']);
});
