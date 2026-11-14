'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { setup, validatedUnit, clipForm, stubAnalyzer, CANNED_MAESTRO } = require('./harness');

test('daftar wajib persetujuan; peran maestro hanya diberi admin', async () => {
  const s = await setup();
  try {
    const c = s.client();
    const r = await c.post('/api/auth/register', { email: 'x@t.id', name: 'Xx', password: 'rahasia123' });
    assert.equal(r.status, 400);
    const l = await s.l.post('/api/units', clipForm());
    assert.equal(l.status, 403, 'pelajar tidak boleh membuat unit');
    const up = await s.l.patch(`/api/users/${s.lu.id}/role`, { role: 'maestro' });
    assert.equal(up.status, 403, 'pelajar tidak boleh mengangkat diri');
  } finally { await s.stop(); }
});

test('unit: wajib klip, izin tertulis, dan tanggal izin tidak di masa depan', async () => {
  const s = await setup();
  try {
    assert.equal((await s.m.post('/api/units', clipForm({}, { file: false }))).status, 400);
    assert.equal((await s.m.post('/api/units', clipForm({ consent_confirmed: 'false' }))).status, 400);
    assert.equal((await s.m.post('/api/units', clipForm({ consent_date: '2999-01-01' }))).status, 400);
    assert.equal((await s.m.post('/api/units', clipForm({}, { type: 'application/pdf', name: 'x.pdf' }))).status, 400);
    assert.equal((await s.m.post('/api/units', clipForm())).status, 201);
  } finally { await s.stop(); }
});

test('pengesahan unit digerbangi: analisis, rubrik, dan segmen sah', async () => {
  const s = await setup();
  try {
    const { data: { id } } = await s.m.post('/api/units', clipForm());
    await s.settle();
    let v = await s.m.post(`/api/units/${id}/validate`);
    assert.equal(v.status, 400); assert.match(v.data.error, /ukuran/i);
    // ukuran yang tidak andal pada acuan ditolak
    const bad = await s.m.put(`/api/units/${id}/rubric`, { dims: [{ metric: 'gesture_speech_lag_s', label_sby: 'Anu', label_id: 'Anu' }] });
    assert.equal(bad.status, 400); assert.match(bad.data.error, /tidak tersedia/);
    const unknown = await s.m.put(`/api/units/${id}/rubric`, { dims: [{ metric: 'skor_total', label_sby: 'Anu', label_id: 'Anu' }] });
    assert.equal(unknown.status, 400);
    await s.m.put(`/api/units/${id}/rubric`, { dims: [{ metric: 'pause_mean_s', label_sby: 'Mandeg', label_id: 'Jeda' }] });
    v = await s.m.post(`/api/units/${id}/validate`);
    assert.equal(v.status, 400); assert.match(v.data.error, /segmen/);
    // pelajar belum melihat unit draf
    assert.equal((await s.l.get(`/api/units/${id}`)).status, 403);
    assert.equal((await s.l.get('/api/units')).data.units.length, 0);
  } finally { await s.stop(); }
});

test('unit sah terlihat pelajar; hanya segmen sah yang muncul; ubah segmen membuka kembali unit', async () => {
  const s = await setup();
  try {
    const id = await validatedUnit(s);
    const d = await s.l.get(`/api/units/${id}`);
    assert.equal(d.status, 200);
    assert.equal(d.data.segments.length, 2);
    assert.equal(d.data.rubric.length, 2);
    assert.equal(d.data.analysis.pose.timeline, undefined, 'lini masa pose tidak ikut ringkasan');
    // segmen draf baru tidak tampil ke pelajar
    await s.m.post(`/api/units/${id}/segments`, { segments: [{ start_sec: 9, text_sby: 'Segmen draf', text_id: 'Draf' }] });
    assert.equal((await s.l.get(`/api/units/${id}`)).data.segments.length, 2);
    // mengubah segmen sah membuka kembali unit dan menariknya dari pencarian
    const own = await s.m.get(`/api/units/${id}`);
    const first = own.data.segments.find((x) => x.status === 'validated');
    await s.m.patch(`/api/segments/${first.id}`, { start_sec: 3, text_sby: first.text_sby + ' lho', text_id: first.text_id });
    assert.equal((await s.m.get(`/api/units/${id}`)).data.unit.status, 'draft');
    assert.equal((await s.l.get(`/api/units/${id}`)).status, 403);
    assert.equal((await s.l.get('/api/search?q=mlayu')).data.results.length, 0);
  } finally { await s.stop(); }
});

test('pencarian bersumber: kutipan dengan menit, hanya segmen sah, tanpa jawaban buatan', async () => {
  const s = await setup();
  try {
    const id = await validatedUnit(s);
    const r = await s.l.get('/api/search?q=mlayu');
    assert.equal(r.data.results.length, 1);
    assert.equal(r.data.results[0].unit_id, id);
    assert.match(r.data.results[0].citation, /Cak Uji, "Membuka dagelan", menit 1:05/);
    assert.equal(r.data.results[0].text_id, 'Jangan lari');
    assert.equal((await s.l.get('/api/search?q=a')).data.results.length, 0);
    assert.equal((await s.client().get('/api/search?q=mlayu')).data.results.length, 0, 'unit akses-login tidak muncul untuk tamu');
    assert.equal((await s.l.get('/api/search?q=%22%20OR%20NEAR')).status, 200, 'karakter khusus FTS tidak menjatuhkan server');
  } finally { await s.stop(); }
});

test('latihan pelajar: persetujuan wajib, perbandingan deskriptif tanpa skor, privasi', async () => {
  const learner = { ...CANNED_MAESTRO, audio: { ...CANNED_MAESTRO.audio, pause_mean_s: 0.3 }, pose: { ...CANNED_MAESTRO.pose, wrist_speed_mean: 1.05 } };
  let n = 0;
  const analyze = stubAnalyzer({ next: () => (n++ === 0 ? CANNED_MAESTRO : learner) });
  const s = await setup({ analyze });
  try {
    const id = await validatedUnit(s);
    assert.equal((await s.l.post(`/api/units/${id}/attempts`, clipForm({ consent_confirmed: 'false' }))).status, 400);
    const r = await s.l.post(`/api/units/${id}/attempts`, clipForm());
    assert.equal(r.status, 201);
    await s.settle();
    const a = await s.l.get(`/api/attempts/${r.data.id}`);
    assert.equal(a.data.attempt.status, 'done');
    const rows = Object.fromEntries(a.data.comparison.rows.map((x) => [x.metric, x]));
    assert.equal(rows.pause_mean_s.status, 'luwih_endhek');
    assert.equal(rows.wrist_speed_mean.status, 'cedhak');
    assert.ok(!('score' in a.data.comparison) && !JSON.stringify(a.data).includes('"skor"'), 'tidak ada skor gabungan');
    assert.ok(a.data.comparison.cautions.some((c) => /bukan nilai/.test(c)));
    // orang lain dan maestro (belum dibagikan) tidak boleh melihat
    const other = s.client(); await other.signup('lain@t.id');
    assert.equal((await other.get(`/api/attempts/${r.data.id}`)).status, 403);
    assert.equal((await s.m.get(`/api/attempts/${r.data.id}`)).status, 403);
    assert.equal((await s.m.get(`/api/units/${id}/attempts`)).data.attempts.length, 0);
    await s.l.post(`/api/attempts/${r.data.id}/share`, { share: true });
    assert.equal((await s.m.get(`/api/attempts/${r.data.id}`)).status, 200);
    assert.equal((await s.m.get(`/api/units/${id}/attempts`)).data.attempts.length, 1);
    await s.l.post(`/api/attempts/${r.data.id}/share`, { share: false });
    assert.equal((await s.m.get(`/api/attempts/${r.data.id}`)).status, 403);
    // hapus: baris dan berkas hilang
    const before = fs.readdirSync(s.uploadDir).length;
    assert.equal((await s.l.del(`/api/attempts/${r.data.id}`)).status, 200);
    assert.equal(fs.readdirSync(s.uploadDir).length, before - 1);
    assert.equal((await s.l.get(`/api/attempts/${r.data.id}`)).status, 404);
  } finally { await s.stop(); }
});

test('rekaman buruk: ukuran ditandai tidak andal, bukan angka karangan', async () => {
  const poor = { version: 1, warnings: ['pose_sulit_dideteksi'], audio: { ...CANNED_MAESTRO.audio }, pose: { frames_analyzed: 50, frames_detected: 5, detection_rate: 0.1 } };
  let n = 0;
  const s = await setup({ analyze: stubAnalyzer({ next: () => (n++ === 0 ? CANNED_MAESTRO : poor) }) });
  try {
    const id = await validatedUnit(s);
    const r = await s.l.post(`/api/units/${id}/attempts`, clipForm());
    await s.settle();
    const a = await s.l.get(`/api/attempts/${r.data.id}`);
    const hand = a.data.comparison.rows.find((x) => x.metric === 'wrist_speed_mean');
    assert.equal(hand.status, 'tidak_andal');
    assert.match(hand.note_id, /pose sulit dideteksi/);
  } finally { await s.stop(); }
});

test('analisis gagal dicatat sebagai gagal, server tetap hidup', async () => {
  const s = await setup({ analyze: stubAnalyzer({ next: () => new Error('rusak') }) });
  try {
    const { data: { id } } = await s.m.post('/api/units', clipForm());
    await s.settle();
    const d = await s.m.get(`/api/units/${id}`);
    assert.equal(d.data.unit.analysis_status, 'failed');
    assert.match(d.data.readiness.problems[0], /Analisis/);
  } finally { await s.stop(); }
});

test('buku jejak: berantai, terverifikasi, dan perubahan terdeteksi', async () => {
  const s = await setup();
  try {
    await validatedUnit(s);
    const v = await s.client().get('/api/ledger/verify');
    assert.equal(v.data.ok, true);
    assert.ok(v.data.count >= 6);
    const acts = (await s.client().get('/api/ledger')).data.entries.map((e) => e.action);
    for (const a of ['unit_dibuat', 'segmen_disahkan', 'rubrik_ditetapkan', 'unit_disahkan']) assert.ok(acts.includes(a), a);
    // peretasan: ubah isi entri lama
    s.db.prepare("UPDATE ledger SET payload='{\"x\":1}' WHERE seq=2").run();
    const bad = await s.client().get('/api/ledger/verify');
    assert.equal(bad.data.ok, false); assert.equal(bad.data.broken_at, 2);
  } finally { await s.stop(); }
});

test('buku jejak publik tidak membuka nama pemberi izin dan lingkup izin; admin melihat lengkap', async () => {
  const s = await setup();
  try {
    await validatedUnit(s);
    const pub = (await s.client().get('/api/ledger?limit=50')).data;
    assert.equal(pub.redacted, true);
    const dibuat = pub.entries.find((e) => e.action === 'unit_dibuat');
    assert.ok(dibuat && dibuat.payload.clip_sha256, 'hash klip tetap tampil agar bisa diaudit');
    assert.equal(dibuat.payload.consent_holder, undefined);
    assert.equal(dibuat.payload.scope, undefined);
    assert.ok(!JSON.stringify(pub).includes('consent_holder'));
    const adm = (await s.admin.get('/api/ledger?limit=50')).data;
    assert.equal(adm.redacted, false);
    assert.ok(adm.entries.find((e) => e.action === 'unit_dibuat').payload.consent_holder, 'admin melihat nama pemberi izin');
    assert.equal((await s.client().get('/api/ledger/verify')).data.ok, true, 'penyamaran hanya pada tampilan; rantai tetap utuh');
  } finally { await s.stop(); }
});

test('buku jejak: menghapus entri tengah memutus rantai', async () => {
  const s = await setup();
  try {
    await validatedUnit(s);
    s.db.prepare('DELETE FROM ledger WHERE seq=3').run();
    const v = await s.client().get('/api/ledger/verify');
    assert.equal(v.data.ok, false);
  } finally { await s.stop(); }
});

test('tarik unit menghapus klip, analisis, dan indeks pencarian', async () => {
  const s = await setup();
  try {
    const id = await validatedUnit(s);
    const before = fs.readdirSync(s.uploadDir).length;
    assert.equal((await s.m.post(`/api/units/${id}/withdraw`)).status, 200);
    assert.equal(fs.readdirSync(s.uploadDir).length, before - 1);
    assert.equal((await s.l.get(`/api/units/${id}`)).status, 410);
    assert.equal((await s.l.get('/api/search?q=mlayu')).data.results.length, 0);
  } finally { await s.stop(); }
});

test('pembersihan otomatis: latihan lewat masa simpan dihapus beserta berkasnya', async () => {
  let t = new Date();
  const s = await setup({ now: () => t });
  try {
    const id = await validatedUnit(s);
    const r = await s.l.post(`/api/units/${id}/attempts`, clipForm());
    await s.settle();
    s.db.prepare("UPDATE attempts SET created_at=datetime('now','-40 days') WHERE id=?").run(r.data.id);
    const files = fs.readdirSync(s.uploadDir).length;
    assert.equal(s.app.locals.purgeOld(), 1);
    assert.equal(fs.readdirSync(s.uploadDir).length, files - 1);
    assert.equal(s.db.prepare('SELECT COUNT(*) n FROM attempts').get().n, 0);
  } finally { await s.stop(); }
});

test('hapus akun menghapus latihan dan berkasnya', async () => {
  const s = await setup();
  try {
    const id = await validatedUnit(s);
    await s.l.post(`/api/units/${id}/attempts`, clipForm()); await s.settle();
    const files = fs.readdirSync(s.uploadDir).length;
    assert.equal((await s.l.del('/api/me')).status, 200);
    assert.equal(fs.readdirSync(s.uploadDir).length, files - 1);
  } finally { await s.stop(); }
});

test('AI teks opsional: tanpa kunci ditolak jelas, hasilnya berstatus draf', async () => {
  const s = await setup();
  try {
    const { data: { id } } = await s.m.post('/api/units', clipForm());
    assert.equal((await s.m.post(`/api/units/${id}/segments/suggest`, { text: 'Cak awakmu iku ngomong opo' })).status, 503);
  } finally { await s.stop(); }
  const fetchStub = async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: '{"segments":[{"text_sby":"Cak awakmu","text_id":"Mas kamu"}]}' }] }) });
  const s2 = await setup({ aiKey: 'k', aiFetch: fetchStub });
  try {
    const { data: { id } } = await s2.m.post('/api/units', clipForm());
    assert.equal((await s2.m.post(`/api/units/${id}/segments/suggest`, { text: 'Cak awakmu iku ngomong opo' })).status, 201);
    assert.equal((await s2.m.get(`/api/units/${id}`)).data.segments[0].status, 'draft_ai');
  } finally { await s2.stop(); }
});

test('statistik beranda: akun peragaan tidak dihitung sebagai maestro sungguhan', async () => {
  const s = await setup();
  try {
    let st = (await s.client().get('/api/stats')).data;
    assert.equal(st.maestros, 1, 'satu maestro (akun uji harness) terdaftar dan bukan peragaan');
    s.db.prepare('INSERT INTO maestro_profiles(user_id,is_demo) VALUES(?,1) ON CONFLICT(user_id) DO UPDATE SET is_demo=1').run(s.mu.id);
    st = (await s.client().get('/api/stats')).data;
    assert.equal(st.maestros, 0, 'akun yang ditandai peragaan tidak boleh menaikkan angka "maestro/praktisi"');
  } finally { await s.stop(); }
});
