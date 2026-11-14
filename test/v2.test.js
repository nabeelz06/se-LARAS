'use strict';
// Fitur v2 (dengan analyzer dan media palsu): media, momen, penampil, takarir, kelas, glosarium, kemajuan, admin/dataset, keamanan.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');
const { setup, start, validatedUnit, clipForm, stubAnalyzer, stubMedia, CANNED_MAESTRO } = require('./harness');
const { migrate, SCHEMA_V1, SCHEMA_VERSION } = require('../src/db');
const { MediaError } = require('../src/media');
const { loadGlossarySeed } = require('../src/routes/glossary');
const { toVtt } = require('../src/routes/captions');
const { exportTo, buildManifest } = require('../src/dataset');
const { createLedger } = require('../src/ledger');

const PERSONS = { count_median: 2, selected: 1, frames: 10, tracks: [
  { id: 1, n: 8, first_t: 0, last_t: 9, mean_area: 0.3, weight: 2.4, boxes: [[0, 0.1, 0.1, 0.4, 0.9], [4, 0.1, 0.1, 0.4, 0.9]] },
  { id: 2, n: 6, first_t: 0, last_t: 9, mean_area: 0.2, weight: 1.2, boxes: [[0, 0.6, 0.1, 0.9, 0.9], [4, 0.6, 0.1, 0.9, 0.9]] }] };
const withMoments = (extra = {}) => ({ ...CANNED_MAESTRO, persons: PERSONS, moments: [{ t: 3.0, kind: 'jeda', dur: 1.2, strength: null }, { t: 7.0, kind: 'gerak', dur: null, strength: 0.8 }], ...extra });

const rawGet = async (s, who, url) => fetch(s.base + url, { headers: { cookie: who.cookie() } });

test('migrasi: basis data baru dan peningkatan dari v0.1 mempertahankan data dan membangun indeks', () => {
  const fresh = new Database(':memory:'); fresh.pragma('foreign_keys = ON');
  assert.equal(migrate(fresh), SCHEMA_VERSION);
  // basis data v0.1: skema lama + satu unit sah dengan satu segmen sah
  const old = new Database(':memory:'); old.pragma('foreign_keys = ON');
  old.exec(SCHEMA_V1); old.pragma('user_version = 1');
  old.prepare("INSERT INTO users(id,email,name,password_hash,role) VALUES(1,'m@t','M','x','maestro')").run();
  old.prepare("INSERT INTO units(id,maestro_id,title_sby,title_id,consent_holder,consent_date,status,file_path,mime) VALUES(1,1,'a','Judul lama','x','2026-01-01','validated','f.mp4','video/mp4')").run();
  old.prepare("INSERT INTO segments(unit_id,seq,start_sec,text_sby,text_id,status) VALUES(1,1,2,'Cak awakmu','Mas kamu','validated')").run();
  assert.equal(migrate(old), SCHEMA_VERSION);
  assert.equal(old.prepare('SELECT title_id FROM units').get().title_id, 'Judul lama');
  assert.equal(old.prepare('SELECT data_use FROM units').get().data_use, 'tidak', 'izin riset bawaan = tidak');
  const hit = old.prepare("SELECT kind,t_sec FROM search_fts WHERE search_fts MATCH 'awakmu*'").get();
  assert.deepEqual({ ...hit }, { kind: 'segmen', t_sec: 2 });
  assert.equal(migrate(old), SCHEMA_VERSION, 'idempoten');
  assert.equal(old.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='seg_fts'").get().n, 0);
});

test('unggah: tipe MIME berparameter diterima; media dicek ffprobe; berkas buruk ditolak dan dibuang', async () => {
  const media = stubMedia({ probe: async (f) => { if (/rusak/.test(fs.readFileSync(f, 'utf8'))) throw new MediaError('Berkas bukan media yang bisa dibaca'); return stubMedia().probe(f); } });
  const s = await setup({ media });
  try {
    const ok = await s.m.post('/api/units', clipForm({}, { type: 'video/webm;codecs=vp9,opus', name: 'rekam.webm' }));
    assert.equal(ok.status, 201, JSON.stringify(ok.data));
    const d = (await s.m.get(`/api/units/${ok.data.id}`)).data;
    assert.equal(d.unit.duration_s, 20); assert.equal(d.unit.is_video, true);
    const fd = clipForm({}, { name: 'x.mp4' }); fd.set('file', new Blob([Buffer.from('rusak')], { type: 'video/mp4' }), 'x.mp4');
    const before = fs.readdirSync(s.uploadDir).length;
    const bad = await s.m.post('/api/units', fd);
    assert.equal(bad.status, 400); assert.match(bad.data.error, /bukan media/);
    assert.equal(fs.readdirSync(s.uploadDir).length, before, 'berkas ditolak tidak tertinggal');
    const audio = await s.m.post('/api/units', clipForm({}, { type: 'audio/mpeg', name: 'a.mp3' }));
    assert.equal(audio.status, 201);
    assert.equal((await s.m.get(`/api/units/${audio.data.id}`)).data.unit.is_video, false);
  } finally { await s.stop(); }
});

test('salinan putar: dibuat di latar belakang, diputar bila ada, hash keduanya dicatat, dihapus saat tarik', async () => {
  const calls = [];
  const normalize = async (file) => { calls.push(file); const out = file.replace(/\.[^.]+$/, '.play.mp4'); fs.writeFileSync(out, Buffer.from('salinan-putar')); return { path: out, mime: 'video/mp4' }; };
  normalize.idle = () => Promise.resolve();
  const s = await setup({ media: stubMedia({ normalize }) });
  try {
    const { data: { id } } = await s.m.post('/api/units', clipForm({}, { type: 'video/webm', name: 'a.webm' }));
    await s.settle();
    const u = s.db.prepare('SELECT play_path,play_mime,media_status FROM units WHERE id=?').get(id);
    assert.equal(u.media_status, 'done'); assert.match(u.play_path, /\.play\.mp4$/);
    const clip = await rawGet(s, s.m, `/api/units/${id}/clip`);
    assert.equal(clip.headers.get('content-type'), 'video/mp4');
    assert.equal(Buffer.from(await clip.arrayBuffer()).toString(), 'salinan-putar');
    const led = (await s.m.get('/api/ledger?limit=50')).data.entries.find((e) => e.action === 'salinan_putar_dibuat');
    assert.ok(led.payload.asli_sha256 && led.payload.putar_sha256 && led.payload.asli_sha256 !== led.payload.putar_sha256);
    assert.equal(fs.readdirSync(s.uploadDir).length, 2);
    await s.m.post(`/api/units/${id}/withdraw`);
    assert.equal(fs.readdirSync(s.uploadDir).length, 0, 'klip asli dan salinan putar dihapus');
  } finally { await s.stop(); }
});

test('media gagal dinormalkan: unggahan tetap sah dan klip asli yang diputar', async () => {
  const normalize = async () => { throw new Error('ffmpeg mati'); }; normalize.idle = () => Promise.resolve();
  const s = await setup({ media: stubMedia({ normalize }) });
  try {
    const { data: { id } } = await s.m.post('/api/units', clipForm());
    await s.settle();
    assert.equal(s.db.prepare('SELECT media_status FROM units WHERE id=?').get(id).media_status, 'failed');
    const clip = await rawGet(s, s.m, `/api/units/${id}/clip`);
    assert.equal(clip.status, 200); assert.equal(clip.headers.get('content-type'), 'video/mp4');
  } finally { await s.stop(); }
});

test('usulan momen dari analisis: draf, tersembunyi dari pelajar, tidak menimpa momen yang sudah disahkan', async () => {
  const s = await setup({ analyze: stubAnalyzer({ next: () => withMoments({ persons: { ...PERSONS, count_median: 1 } }) }) });
  try {
    const id = await validatedUnit(s);
    let d = (await s.m.get(`/api/units/${id}`)).data;
    const drafts = d.markers.filter((m) => m.status === 'draft_ai');
    assert.equal(drafts.length, 2); assert.ok(drafts.every((m) => m.source === 'ai' && /usulan otomatis/.test(m.title_id)));
    assert.equal((await s.l.get(`/api/units/${id}`)).data.markers.length, 0, 'pelajar tidak melihat draf');
    // sahkan satu usulan: wajib ada penjelasan
    const jeda = drafts.find((m) => m.kind === 'jeda');
    assert.equal((await s.m.post(`/api/markers/${jeda.id}/validate`)).status, 400);
    assert.equal((await s.m.patch(`/api/markers/${jeda.id}`, { title_id: 'Jeda sebelum punchline', why_id: 'Beri napas supaya penonton siap tertawa' })).status, 200);
    assert.equal((await s.m.post(`/api/markers/${jeda.id}/validate`)).status, 200);
    assert.deepEqual((await s.l.get(`/api/units/${id}`)).data.markers.map((m) => m.title_id), ['Jeda sebelum punchline']);
    // analisis ulang: usulan baru menggantikan draf lama, momen sah tetap, dan tidak menumpuk di titik yang sama
    assert.equal((await s.m.post(`/api/units/${id}/reanalyze`)).status, 200); await s.settle();
    d = (await s.m.get(`/api/units/${id}`)).data;
    assert.equal(d.markers.filter((m) => m.status === 'validated').length, 1);
    assert.equal(d.markers.filter((m) => m.status === 'draft_ai').length, 1, 'usulan di titik yang sudah disahkan dilewati');
  } finally { await s.stop(); }
});

test('momen: sunting mengembalikan ke draf dan membuka kembali unit; masuk pencarian dengan kutipan menit', async () => {
  const s = await setup();
  try {
    const id = await validatedUnit(s);
    const mk = await s.m.post(`/api/units/${id}/markers`, { t_sec: 12.5, kind: 'gerak', title_id: 'Tangan terbuka', title_sby: 'Tangan mbukak', why_id: 'Tanda mengajak penonton', why_sby: 'Tanda ngajak wong nonton' });
    assert.equal(mk.status, 201);
    assert.equal((await s.m.post(`/api/units/${id}/markers`, { t_sec: 9999, title_id: 'Terlalu jauh' })).status, 400);
    assert.equal((await s.m.post(`/api/units/${id}/markers`, { t_sec: 3, kind: 'sihir', title_id: 'Jenis salah' })).status, 400);
    assert.equal((await s.l.post(`/api/units/${id}/markers`, { t_sec: 3, title_id: 'Pelajar tidak boleh' })).status, 403);
    // menambah momen ke unit sah tidak membuka unit; mengesahkannya meng-indeks
    assert.equal((await s.m.post(`/api/markers/${mk.data.id}/validate`)).status, 200);
    const hit = (await s.l.get('/api/search?q=mengajak')).data.results.find((r) => r.kind === 'momen');
    assert.ok(hit); assert.match(hit.citation, /menit 0:12$/);
    // sunting => draf, unit dibuka kembali, indeks momen hilang
    assert.equal((await s.m.patch(`/api/markers/${mk.data.id}`, { why_id: 'Mengajak penonton ikut bermain' })).status, 200);
    const u = (await s.m.get(`/api/units/${id}`)).data;
    assert.equal(u.unit.status, 'draft'); assert.equal(u.markers[0].status, 'draft_human');
    assert.equal((await s.l.get('/api/search?q=mengajak')).data.results.length, 0);
    assert.equal((await s.m.del(`/api/markers/${mk.data.id}`)).status, 200);
  } finally { await s.stop(); }
});

test('pilih penampil: butuh beberapa orang; memicu analisis ulang dengan jejak terpilih; gerbang pengesahan', async () => {
  const an = stubAnalyzer({ next: () => withMoments() });
  const s = await setup({ analyze: an });
  try {
    const { data: { id } } = await s.m.post('/api/units', clipForm());
    await s.settle();
    await s.m.post(`/api/units/${id}/segments`, { segments: [{ start_sec: 1, text_sby: 'a', text_id: 'a' }] });
    const seg = (await s.m.get(`/api/units/${id}`)).data.segments[0];
    await s.m.post(`/api/segments/${seg.id}/validate`);
    await s.m.put(`/api/units/${id}/rubric`, { dims: [{ metric: 'wrist_speed_mean', label_sby: 'Tangan', label_id: 'Tangan', tolerance_pct: 30 }] });
    const blocked = await s.m.post(`/api/units/${id}/validate`);
    assert.equal(blocked.status, 400); assert.match(blocked.data.error, /pilih penampil/i);
    const p = (await s.m.get(`/api/units/${id}/persons`)).data;
    assert.equal(p.count_median, 2); assert.equal(p.tracks.length, 2); assert.equal(p.chosen, null);
    assert.equal((await s.m.post(`/api/units/${id}/performer`, { track_id: 99 })).status, 400);
    assert.equal((await s.l.post(`/api/units/${id}/performer`, { track_id: 2 })).status, 403);
    assert.equal((await s.m.post(`/api/units/${id}/performer`, { track_id: 2 })).status, 200);
    await s.settle();
    assert.equal(an.opts.at(-1).track, 2, 'analisis ulang memakai jejak 2');
    assert.equal((await s.m.post(`/api/units/${id}/validate`)).status, 200);
    // mengubah penampil setelah sah membuka kembali unit
    await s.m.post(`/api/units/${id}/performer`, { track_id: 1 }); await s.settle();
    assert.equal((await s.m.get(`/api/units/${id}`)).data.unit.status, 'draft');
    // pelajar: pemilih penampil di latihan sendiri; klip acuan dikirim sebagai ref
    assert.equal((await s.m.post(`/api/units/${id}/validate`)).status, 200);
    const at = await s.l.post(`/api/units/${id}/attempts`, clipForm({ consent_confirmed: 'true' }));
    await s.settle();
    assert.equal(an.opts.at(-1).ref, path.join(s.uploadDir, path.basename(s.db.prepare('SELECT file_path FROM units WHERE id=?').get(id).file_path)));
    const ap = (await s.l.get(`/api/attempts/${at.data.id}`)).data;
    assert.equal(ap.persons.tracks.length, 2);
    assert.equal((await s.m.post(`/api/attempts/${at.data.id}/performer`, { track_id: 2 })).status, 403);
    assert.equal((await s.l.post(`/api/attempts/${at.data.id}/performer`, { track_id: 2 })).status, 200); await s.settle();
    assert.equal(an.opts.at(-1).track, 2);
  } finally { await s.stop(); }
});

test('bingkai untuk memilih penampil: hanya pemilik; jenis JPEG; audio ditolak', async () => {
  const s = await setup();
  try {
    const { data: { id } } = await s.m.post('/api/units', clipForm()); await s.settle();
    const ok = await rawGet(s, s.m, `/api/units/${id}/frame?t=1`);
    assert.equal(ok.status, 200); assert.equal(ok.headers.get('content-type'), 'image/jpeg');
    assert.equal((await rawGet(s, s.l, `/api/units/${id}/frame?t=1`)).status, 403);
    assert.equal((await rawGet(s, s.m, `/api/units/${id}/frame?t=abc`)).status, 400);
    const au = await s.m.post('/api/units', clipForm({}, { type: 'audio/mpeg', name: 'a.mp3' }));
    assert.equal((await rawGet(s, s.m, `/api/units/${au.data.id}/frame?t=1`)).status, 400);
  } finally { await s.stop(); }
});

test('takarir WebVTT: hanya segmen sah untuk pelajar; cue tidak tumpang tindih; lang diperiksa', async () => {
  const vtt = toVtt([{ seq: 1, start_sec: 1, end_sec: 9, text_sby: 'A <b>', text_id: 'a' }, { seq: 2, start_sec: 3.5, end_sec: null, text_sby: 'B & C', text_id: '' }], 'sby', 20);
  assert.match(vtt, /^WEBVTT\n\n1\n00:00:01\.000 --> 00:00:03\.500\nA &lt;b&gt;\n\n2\n00:00:03\.500 --> 00:00:07\.500\nB &amp; C\n/);
  assert.ok(!toVtt([{ seq: 1, start_sec: 1, end_sec: null, text_sby: 'x', text_id: '' }], 'id', 20).includes('x'), 'baris tanpa terjemahan tidak dimasukkan ke takarir id');
  const s = await setup();
  try {
    const id = await validatedUnit(s);
    await s.m.post(`/api/units/${id}/segments`, { segments: [{ start_sec: 30, text_sby: 'Draf rahasia', text_id: 'draf' }] });
    const r = await rawGet(s, s.l, `/api/units/${id}/captions.vtt?lang=sby`);
    assert.equal(r.status, 200); assert.match(r.headers.get('content-type'), /text\/vtt/);
    const t = await r.text();
    assert.match(t, /Cak, awakmu iku ngomong opo/); assert.ok(!t.includes('Draf rahasia'));
    const own = await (await rawGet(s, s.m, `/api/units/${id}/captions.vtt?lang=id&drafts=1`)).text();
    assert.match(own, /draf/); 
    assert.equal((await rawGet(s, s.l, `/api/units/${id}/captions.vtt?lang=jw`)).status, 400);
  } finally { await s.stop(); }
});

test('kelas: kode gabung, persetujuan kemajuan, akses anggota, pemilik melihat kemajuan, bukan anggota ditolak', async () => {
  const s = await setup();
  try {
    const id = await validatedUnit(s);
    assert.equal((await s.l.post('/api/classes', { name: 'Kelas pelajar' })).status, 403);
    const c = await s.m.post('/api/classes', { name: 'Kelas Remo Pemula', description: 'Jalur dasar' });
    assert.equal(c.status, 201);
    const mine = (await s.m.get('/api/classes')).data.owned[0];
    assert.match(mine.join_code, /^[A-HJ-NP-Z2-9]{6}$/);
    assert.equal((await s.m.post(`/api/classes/${c.data.id}/units`, { unit_id: id, note: 'Mulai dari sini' })).status, 201);
    assert.equal((await s.l.get(`/api/classes/${c.data.id}`)).status, 403, 'bukan anggota');
    assert.equal((await s.l.post('/api/classes/join', { code: mine.join_code })).status, 400, 'butuh persetujuan');
    assert.equal((await s.l.post('/api/classes/join', { code: 'ZZZZZZ', consent_progress: true })).status, 404);
    const j = await s.l.post('/api/classes/join', { code: mine.join_code.toLowerCase(), consent_progress: true });
    assert.equal(j.status, 200); assert.equal(j.data.already, false);
    assert.equal((await s.l.post('/api/classes/join', { code: mine.join_code, consent_progress: true })).data.already, true);
    // pelajar menandai nyebeng; pemilik kelas melihatnya, anggota tidak melihat daftar anggota
    await s.l.post(`/api/units/${id}/progress`, { step: 'nyebeng' });
    const mem = (await s.l.get(`/api/classes/${c.data.id}`)).data;
    assert.equal(mem.units.length, 1); assert.equal(mem.members, undefined); assert.ok(mem.units[0].progress.nyebeng_at);
    assert.equal(mem.class.join_code, undefined, 'anggota tidak melihat kode gabung');
    const own = (await s.m.get(`/api/classes/${c.data.id}`)).data;
    assert.equal(own.members.length, 1); assert.ok(own.members[0].progress[0].nyebeng_at); assert.equal(own.class.join_code, mine.join_code);
    // unit yang ditarik tak lagi terlihat anggota
    await s.m.post(`/api/units/${id}/withdraw`);
    assert.equal((await s.l.get(`/api/classes/${c.data.id}`)).data.units.length, 0);
    // keluar dan kode baru
    assert.equal((await s.l.del(`/api/classes/${c.data.id}/membership`)).status, 200);
    assert.equal((await s.l.get(`/api/classes/${c.data.id}`)).status, 403);
    const nc = (await s.m.post(`/api/classes/${c.data.id}/code`)).data.join_code;
    assert.notEqual(nc, mine.join_code);
    assert.equal((await s.l.post('/api/classes/join', { code: mine.join_code, consent_progress: true })).status, 404, 'kode lama tidak berlaku');
    assert.equal((await s.m.post(`/api/classes/${c.data.id}/units`, { unit_id: 99999 })).status, 404);
  } finally { await s.stop(); }
});

test('glosarium: entri pustaka tampil berlabel, draf maestro tersembunyi sampai disahkan, entri tanpa sumber tidak dimuat', async () => {
  const s = await setup();
  try {
    const f = path.join(s.uploadDir, 'g.json');
    fs.writeFileSync(f, JSON.stringify([{ term_sby: 'Remo', term_id: 'tari Remo', kind: 'istilah', def_id: 'Tari pembuka.', def_sby: 'Tari pembuka.', source_label: 'Sumber uji', source_url: 'https://contoh.invalid/a' },
      { term_sby: 'Tanpa sumber', def_id: 'x' }, { term_sby: 'Tanpa arti', source_label: 'S' }]));
    assert.equal(loadGlossarySeed(s.db, f), 1); assert.equal(loadGlossarySeed(s.db, f), 0, 'idempoten');
    let g = (await s.l.get('/api/glossary')).data.terms;
    assert.equal(g.length, 1); assert.equal(g[0].validated, false); assert.equal(g[0].basis, 'pustaka'); assert.equal(g[0].source_label, 'Sumber uji');
    const mk = await s.m.post('/api/glossary', { term_sby: 'Parikan', term_id: 'pantun Jawa', kind: 'ungkapan', def_id: 'Larik berirama.' });
    assert.equal(mk.status, 201);
    assert.equal((await s.m.post('/api/glossary', { term_sby: 'parikan', def_id: 'dobel' })).status, 409);
    assert.equal((await s.l.post('/api/glossary', { term_sby: 'Anu', def_id: 'Anu' })).status, 403);
    assert.equal((await s.l.get('/api/glossary')).data.terms.length, 1, 'draf maestro belum tampil ke pelajar');
    assert.equal((await s.m.get('/api/glossary')).data.terms.length, 2);
    assert.equal((await s.m.post(`/api/glossary/${mk.data.id}/validate`)).status, 200);
    g = (await s.l.get('/api/glossary?q=pantun')).data.terms;
    assert.equal(g.length, 1); assert.equal(g[0].validated, true);
    assert.equal((await s.l.get('/api/glossary?kind=alat')).data.terms.length, 0);
    assert.ok((await s.m.get('/api/ledger?limit=20')).data.entries.some((e) => e.action === 'istilah_disahkan'));
    // sunting mengembalikan ke draf
    await s.m.patch(`/api/glossary/${mk.data.id}`, { def_id: 'Larik berirama dua baris.' });
    assert.equal((await s.l.get('/api/glossary')).data.terms.length, 1);
  } finally { await s.stop(); }
});

test('kemajuan: nyebeng, tedean otomatis, ngelmu hanya setelah mencoba; catatan bertahan setelah rekaman dihapus', async () => {
  let t = Date.now();
  const s = await setup({ now: () => new Date(t) });
  try {
    const id = await validatedUnit(s);
    assert.equal((await s.l.post(`/api/units/${id}/progress`, { step: 'ngelmu' })).status, 400);
    assert.equal((await s.l.post(`/api/units/${id}/progress`, { step: 'tedean' })).status, 400, 'tedean tidak bisa ditandai tangan');
    assert.equal((await s.l.post(`/api/units/${id}/progress`, { step: 'nyebeng' })).status, 200);
    assert.equal((await s.l.post(`/api/units/${id}/progress`, { step: 'ngelmu' })).status, 400, 'belum mencoba');
    const at = await s.l.post(`/api/units/${id}/attempts`, clipForm({ consent_confirmed: 'true' })); await s.settle();
    const p = (await s.l.post(`/api/units/${id}/progress`, { step: 'ngelmu' })).data.progress;
    assert.equal(p.tedean_n, 1); assert.ok(p.nyebeng_at && p.ngelmu_at);
    await s.l.patch(`/api/attempts/${at.data.id}`, { self_note: 'Jeda saya terlalu pendek' });
    assert.equal((await s.l.get(`/api/attempts/${at.data.id}`)).data.attempt.self_note, 'Jeda saya terlalu pendek');
    assert.equal((await s.m.get(`/api/attempts/${at.data.id}`)).status, 403);
    // rekaman dipurge setelah 30 hari, catatan kemajuan tetap
    t += 31 * 86400000; assert.equal(s.app.locals.purgeOld(), 1);
    const me = (await s.l.get('/api/me/progress')).data;
    assert.equal(me.units.length, 1); assert.deepEqual(me.totals, { available: 1, nyebeng: 1, tedean: 1, ngelmu: 1 });
    // ekspor data pribadi memuat milik sendiri saja
    const ex = (await s.l.get('/api/me/export')).data;
    assert.equal(ex.user.email, 'murid@t.id'); assert.equal(ex.progress.length, 1); assert.equal(ex.units.length, 0);
    const exm = (await s.m.get('/api/me/export')).data;
    assert.equal(exm.units.length, 1); assert.equal(exm.units[0].segments.length, 2); assert.ok(!JSON.stringify(exm).includes('murid@t.id'));
  } finally { await s.stop(); }
});

test('ASR opsional: tanpa perintah ditolak jelas; perintah palsu menghasilkan draf berstatus asr', async () => {
  const s0 = await setup();
  try {
    const { data: { id } } = await s0.m.post('/api/units', clipForm());
    const r = await s0.m.post(`/api/units/${id}/segments/transcribe`);
    assert.equal(r.status, 503); assert.match(r.data.error, /ASR/);
    assert.equal((await s0.m.get('/api/about')).data.asr_enabled, false);
  } finally { await s0.stop(); }
  const { createAsr } = require('../src/asr');
  const js = `console.log(JSON.stringify({segments:[{start:1.5,end:3,text:'Cak, ayo mulai'},{start:4,text:'Wis talah'},{start:'x',text:'dibuang'}]}))`;
  const s = await setup({ asr: createAsr({ env: { ASR_COMMAND_JSON: JSON.stringify([process.execPath, '-e', js, '--']) } }) });
  try {
    const { data: { id } } = await s.m.post('/api/units', clipForm()); await s.settle();
    assert.equal((await s.m.post(`/api/units/${id}/segments/transcribe`)).status, 201);
    const segs = (await s.m.get(`/api/units/${id}`)).data.segments;
    assert.equal(segs.length, 2); assert.ok(segs.every((x) => x.status === 'draft_ai' && x.source === 'asr' && x.text_id === ''));
    assert.equal(segs[0].end_sec, 3);
    assert.equal((await s.l.get(`/api/units/${id}`)).status, 403);
    // draf ASR tidak bisa disahkan tanpa terjemahan
    assert.equal((await s.m.post(`/api/segments/${segs[0].id}/validate`)).status, 400);
    assert.equal((await s.m.get('/api/about')).data.asr_enabled, true);
  } finally { await s.stop(); }
  const bad = await setup({ asr: createAsr({ env: { ASR_COMMAND_JSON: JSON.stringify([process.execPath, '-e', 'console.log("bukan json")', '--']) } }) });
  try {
    const { data: { id } } = await bad.m.post('/api/units', clipForm());
    assert.equal((await bad.m.post(`/api/units/${id}/segments/transcribe`)).status, 500);
  } finally { await bad.stop(); }
});

test('admin: ringkasan hanya untuk admin; korpus riset hanya klip sah+izin riset+bukan contoh; ekspor lengkap dan berantai', async () => {
  const s = await setup();
  try {
    assert.equal((await s.m.get('/api/admin/overview')).status, 403);
    assert.equal((await s.l.get('/api/admin/dataset')).status, 403);
    const ov = (await s.admin.get('/api/admin/overview')).data;
    assert.equal(ov.schema_version, SCHEMA_VERSION); assert.equal(ov.ledger.ok, true); assert.equal(ov.data_use_riset, 0);
    assert.equal((await s.admin.get('/api/admin/dataset')).data.totals.units, 0);
    assert.match(await (await rawGet(s, s.admin, '/api/admin/datacard')).text(), /Korpus ini kosong/);
    // tiga unit: (a) sah + riset, (b) sah tanpa riset, (c) sah + riset tapi contoh
    const make = async (over) => { const id = await validatedUnitWith(s, over); return id; };
    const a = await make({ data_use: 'riset', title_id: 'Unit A' });
    await make({ title_id: 'Unit B' });
    const c = await make({ data_use: 'riset', title_id: 'Unit C' }); s.db.prepare('UPDATE units SET is_demo=1 WHERE id=?').run(c);
    const man = buildManifest(s.db, { uploadDir: s.uploadDir });
    assert.deepEqual(man.items.map((i) => i.title_id), ['Unit A']);
    assert.ok(man.items[0].consent.ledger_seq > 0); assert.ok(!JSON.stringify(man).includes('Cak Uji'), 'nama pemberi izin tidak diekspor');
    assert.equal(man.items[0].segments.length, 2);
    // ekspor ke direktori, termasuk media; hash cocok; entri buku jejak
    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-exp-'));
    const ledger = createLedger(s.db, 'test-secret-0123456789');
    const r = exportTo(out, { db: s.db, uploadDir: s.uploadDir, includeMedia: true, ledger });
    assert.deepEqual(fs.readdirSync(out).sort(), ['SHA256SUMS', 'datacard.md', 'manifest.jsonl', 'media']);
    const line = JSON.parse(fs.readFileSync(path.join(out, 'manifest.jsonl'), 'utf8').trim());
    assert.equal(line.media_file, `media/unit_${a}.mp4`); assert.ok(fs.existsSync(path.join(out, line.media_file)));
    assert.match(fs.readFileSync(path.join(out, 'datacard.md'), 'utf8'), /Hanya 1 penutur/);
    assert.ok((await s.admin.get('/api/ledger?limit=5')).data.entries.some((e) => e.action === 'dataset_diekspor'));
    assert.equal(r.manifest.totals.units, 1);
    // klip yang berkasnya diubah dilewati, bukan diekspor diam-diam
    fs.writeFileSync(path.join(s.uploadDir, path.basename(s.db.prepare('SELECT file_path FROM units WHERE id=?').get(a).file_path)), 'diubah');
    const m2 = buildManifest(s.db, { uploadDir: s.uploadDir });
    assert.equal(m2.totals.units, 0); assert.match(m2.skipped[0].alasan, /hash/);
    // pencabutan izin riset mengeluarkan klip dan tercatat
    await s.m.patch(`/api/units/${a}`, { data_use: 'tidak' });
    assert.ok((await s.admin.get('/api/ledger?limit=10')).data.entries.some((e) => e.action === 'izin_data_diubah'));
    assert.equal((await s.admin.get('/api/admin/overview')).data.data_use_riset, 0, 'unit contoh tidak dihitung dan izin unit A sudah dicabut');
    fs.rmSync(out, { recursive: true, force: true });
  } finally { await s.stop(); }
});
async function validatedUnitWith(s, over) {
  const r = await s.m.post('/api/units', clipForm(over));
  await s.settle();
  await s.m.post(`/api/units/${r.data.id}/segments`, { segments: [{ start_sec: 3, text_sby: 'Cak, awakmu iku ngomong opo', text_id: 'Mas, kamu itu bicara apa' }, { start_sec: 9, text_sby: 'Ojok mlayu', text_id: 'Jangan lari' }] });
  const d = await s.m.get(`/api/units/${r.data.id}`);
  for (const sg of d.data.segments) await s.m.post(`/api/segments/${sg.id}/validate`);
  await s.m.put(`/api/units/${r.data.id}/rubric`, { dims: [{ metric: 'pause_mean_s', label_sby: 'Lawase mandeg', label_id: 'Lama jeda', tolerance_pct: 25 }] });
  const v = await s.m.post(`/api/units/${r.data.id}/validate`);
  if (v.status !== 200) throw new Error(JSON.stringify(v.data));
  return r.data.id;
}

test('keamanan: Origin asing ditolak pada permintaan pengubah data; header perlindungan terpasang', async () => {
  const s = await setup();
  try {
    const mk = (origin) => fetch(`${s.base}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json', ...(origin ? { origin } : {}) }, body: JSON.stringify({ email: 'maestro@t.id', password: 'kata-sandi-uji' }) });
    assert.equal((await mk('https://jahat.example')).status, 403);
    assert.equal((await mk(new URL(s.base).origin)).status, 200);
    assert.equal((await mk(null)).status, 200, 'klien tanpa Origin (curl) tetap bisa; cookie SameSite=Lax menjadi lapisan lain');
    const h = (await fetch(`${s.base}/healthz`)).headers;
    assert.match(h.get('permissions-policy'), /camera=\(self\)/); assert.equal(h.get('cross-origin-opener-policy'), 'same-origin');
    assert.match(h.get('content-security-policy'), /default-src 'self'/); assert.equal(h.get('x-frame-options'), 'DENY');
    const about = (await fetch(`${s.base}/api/about`).then((r) => r.json()));
    assert.equal(about.honest.trained_on_ludruk_data, false); assert.equal(about.honest.asr_model_included, false);
    // Versi tidak ditulis keras di tes: tiga tempat harus selalu sama (API, package.json, nama cache service worker).
    const { APP_VERSION } = require('../src/app');
    assert.equal(about.version, APP_VERSION);
    assert.equal(APP_VERSION, require('../package.json').version, 'package.json dan src/app.js harus bernomor sama');
    assert.ok(fs.readFileSync(path.join(__dirname, '..', 'public', 'sw.js'), 'utf8').includes(`se-laras-v${APP_VERSION}`), 'nama cache service worker harus memuat nomor versi (supaya cache lama terbuang saat rilis)');
  } finally { await s.stop(); }
});

test('hapus akun: berkas asli dan salinan putar semua terhapus, unit hilang dari indeks', async () => {
  const normalize = async (file) => { const out = file.replace(/\.[^.]+$/, '.play.mp4'); fs.writeFileSync(out, 'x'); return { path: out, mime: 'video/mp4' }; }; normalize.idle = () => Promise.resolve();
  const s = await setup({ media: stubMedia({ normalize }) });
  try {
    const id = await validatedUnit(s);
    await s.l.post(`/api/units/${id}/attempts`, clipForm({ consent_confirmed: 'true' })); await s.settle();
    assert.equal(fs.readdirSync(s.uploadDir).length, 4);
    assert.equal((await s.m.del('/api/me')).status, 200);
    assert.equal(fs.readdirSync(s.uploadDir).length, 0, 'klip maestro, salinannya, dan rekaman pelajar pada unit itu semua terhapus (tanpa berkas yatim)');
    assert.equal((await s.l.get('/api/search?q=awakmu')).data.results.length, 0);
    assert.equal((await s.l.get('/api/me/attempts')).data.attempts.length, 0);
    assert.equal((await s.l.del('/api/me')).status, 200);
  } finally { await s.stop(); }
});

test('pemasangan bersih: .npmrc mematikan skrip pasang, tak ada dependensi yang butuh skripnya, engines tidak lebih longgar dari better-sqlite3, Dockerfile dan tag image sinkron', () => {
  // Latar: `npm ci` dari package-lock.json menjalankan `node-gyp rebuild` untuk better-sqlite3 13 (teramati di npm 10.9.9)
  // padahal paketnya membawa biner siap pakai. Tanpa kompilator C++ atau akses ke nodejs.org, pemasangan pertama gagal.
  const root = path.join(__dirname, '..');
  const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
  assert.match(read('.npmrc'), /^ignore-scripts=true\s*$/m, '.npmrc harus berisi ignore-scripts=true');
  const lock = JSON.parse(read('package-lock.json'));
  const scripted = Object.entries(lock.packages).filter(([, v]) => v.hasInstallScript).map(([k]) => k);
  assert.deepEqual(scripted, [], `ada dependensi dengan skrip pasang yang akan terlewati oleh ignore-scripts: ${scripted.join(', ')}`);
  const major = (range) => Number(/(\d+)/.exec(range)[1]);
  const own = require('../package.json').engines.node;
  const dep = require('better-sqlite3/package.json').engines.node;
  assert.ok(major(own) >= major(dep), `engines.node proyek (${own}) lebih longgar daripada better-sqlite3 (${dep})`);
  assert.equal(lock.packages[''].engines.node, own, 'package-lock.json harus mengikuti engines di package.json');
  assert.match(read('Dockerfile'), /^COPY[^\n]*\.npmrc/m, 'Dockerfile harus menyalin .npmrc sebelum npm ci');
  const minor = require('../package.json').version.split('.').slice(0, 2).join('.');
  assert.match(read('docker-compose.yml'), new RegExp(`image: se-laras:${minor.replace('.', '\\.')}\\s*$`, 'm'), `tag image di docker-compose.yml harus ${minor}`);
});
