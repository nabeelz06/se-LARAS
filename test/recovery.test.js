'use strict';
// Pemulihan pekerjaan latar saat start: server yang mati di tengah analisis tidak boleh meninggalkan baris 'running' selamanya.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { start, stubAnalyzer, stubMedia, CANNED_MAESTRO } = require('./harness');

const INFO = JSON.stringify({ duration_s: 20, has_video: true, has_audio: true, width: 640, height: 360, fps: 25, vcodec: 'h264', acodec: 'aac', container: 'mov,mp4,m4a,3gp,3g2,mj2' });
const touch = (dir, name) => { fs.writeFileSync(path.join(dir, name), 'bukan-video-asli'); return name; };

function crashedState(db, dir) {
  db.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(1,'m@t.id','Cak Uji','x','maestro'),(2,'p@t.id','Murid Uji','x','learner')").run();
  const unit = db.prepare(`INSERT INTO units(id,maestro_id,title_sby,title_id,file_path,file_name,mime,size,consent_holder,consent_date,media_info,analysis,analysis_status,media_status,status)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`);
  const day = '2026-01-01';
  unit.run(1, 1, 'Unit gantung', 'Unit menggantung', touch(dir, 'u1.mp4'), 'u1.mp4', 'video/mp4', 16, 'Cak Uji', day, INFO, null, 'running', 'running', 'draft');
  unit.run(2, 1, 'Unit antre', 'Unit antre', touch(dir, 'u2.mp4'), 'u2.mp4', 'video/mp4', 16, 'Cak Uji', day, INFO, null, 'pending', 'pending', 'draft');
  unit.run(3, 1, 'Unit selesai', 'Unit selesai', touch(dir, 'u3.mp4'), 'u3.mp4', 'video/mp4', 16, 'Cak Uji', day, INFO, JSON.stringify(CANNED_MAESTRO), 'done', 'done', 'draft');
  unit.run(4, 1, 'Unit ditarik', 'Unit ditarik', null, null, null, null, 'Cak Uji', day, null, null, 'running', 'none', 'withdrawn');
  unit.run(5, 1, 'Unit tanpa info media', 'Unit tanpa info media', touch(dir, 'u5.mp4'), 'u5.mp4', 'video/mp4', 16, 'Cak Uji', day, null, JSON.stringify(CANNED_MAESTRO), 'done', 'running', 'draft');
  const att = db.prepare('INSERT INTO attempts(id,unit_id,user_id,file_path,file_name,mime,size,status,media_info) VALUES(?,?,?,?,?,?,?,?,?)');
  att.run(1, 3, 2, touch(dir, 'a1.mp4'), 'a1.mp4', 'video/mp4', 16, 'running', INFO);
  att.run(2, 3, 2, touch(dir, 'a2.mp4'), 'a2.mp4', 'video/mp4', 16, 'pending', INFO);
  att.run(3, 3, 2, touch(dir, 'a3.mp4'), 'a3.mp4', 'video/mp4', 16, 'done', INFO);
}
const busy = (db) => db.prepare(`SELECT
  (SELECT COUNT(*) FROM units WHERE file_path IS NOT NULL AND (analysis_status IN ('pending','running') OR media_status IN ('pending','running'))) +
  (SELECT COUNT(*) FROM attempts WHERE file_path IS NOT NULL AND status IN ('pending','running')) n`).get().n;
async function until(fn, ms = 5000) { for (let i = 0; i < ms / 20; i++) { if (fn()) return; await new Promise((r) => setTimeout(r, 20)); } throw new Error('keadaan yang ditunggu tidak tercapai'); }

test('start ulang menjadwalkan kembali analisis dan salinan putar yang tertinggal; yang selesai/ditarik tidak disentuh', async () => {
  const analyze = stubAnalyzer();
  const s = await start({ analyze, media: stubMedia(), prepare: crashedState });
  try {
    assert.deepEqual(s.app.locals.recovered, { analisis_unit: 2, analisis_latihan: 2, salinan_putar: 2, salinan_putar_gagal: 1 });
    await until(() => busy(s.db) === 0);
    const u = (id) => s.db.prepare('SELECT analysis_status a, media_status m, analysis, analysis_error e FROM units WHERE id=?').get(id);
    for (const id of [1, 2]) { assert.equal(u(id).a, 'done', `unit ${id}: ${u(id).e}`); assert.ok(JSON.parse(u(id).analysis).audio.pause_count >= 0); assert.equal(u(id).m, 'done'); }
    const at = (id) => s.db.prepare('SELECT status, comparison, error FROM attempts WHERE id=?').get(id);
    for (const id of [1, 2]) { assert.equal(at(id).status, 'done', `latihan ${id}: ${at(id).error}`); assert.ok(JSON.parse(at(id).comparison)); }
    // yang sudah selesai tidak dianalisis ulang; unit tertarik (tanpa berkas) tidak punya apa-apa untuk diulang
    const called = analyze.calls.map((f) => path.basename(f)).sort();
    assert.deepEqual(called, ['a1.mp4', 'a2.mp4', 'u1.mp4', 'u2.mp4']);
    assert.equal(u(3).a, 'done'); assert.equal(at(3).status, 'done');
    // media tanpa info tidak bisa diulang: ditandai gagal, bukan menggantung
    assert.equal(u(5).m, 'failed');
    assert.equal(u(4).a, 'running', 'unit ditarik tidak diubah (tidak ada berkas)');
  } finally { await s.stop(); }
});

test('setelah pemulihan, tombol analisis ulang tidak lagi ditolak 409 karena status menggantung', async () => {
  // Penjaga regresi: sebelum pemulihan ada, unit yang tertinggal 'running' membuat reanalyze selalu 409.
  const s = await start({ prepare: (db, dir) => {
    crashedState(db, dir);
    db.prepare("UPDATE users SET email='maestro@t.id', password_hash=? WHERE id=1").run(require('../src/auth').hashPassword('kata-sandi-uji'));
  } });
  try {
    const m = s.client();
    const r = await m.post('/api/auth/login', { email: 'maestro@t.id', password: 'kata-sandi-uji' });
    assert.equal(r.status, 200, JSON.stringify(r.data));
    await until(() => busy(s.db) === 0);
    const again = await m.post('/api/units/1/reanalyze');
    assert.equal(again.status, 200, JSON.stringify(again.data));
  } finally { await s.stop(); }
});

test('basis data bersih: pemulihan tidak melakukan apa-apa', async () => {
  const analyze = stubAnalyzer();
  const s = await start({ analyze });
  try {
    assert.deepEqual(s.app.locals.recovered, { analisis_unit: 0, analisis_latihan: 0, salinan_putar: 0, salinan_putar_gagal: 0 });
    assert.equal(analyze.calls.length, 0);
  } finally { await s.stop(); }
});
