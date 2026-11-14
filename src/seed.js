'use strict';
/**
 * Data peragaan. BUKAN konten maestro: klip sintetis (penari kartun yang digambar dengan kode oleh tim, dengan pembacaan LJSpeech
 * domain publik berjeda; tidak ada foto atau rekaman orang) hanya memperagakan alur. Semua unit/akun ditandai "contoh uji" dan teksnya adalah contoh bentuk data.
 * Ganti dengan rekaman tim sendiri (izin tertulis) sebelum demo sungguhan.
 * Pakai:  node src/seed.js   (DATA_DIR, SESSION_SECRET dibaca dari lingkungan)
 */
const fs = require('fs');
const path = require('path');
const { openDb } = require('./db');
const { createApp, DEMO } = require('./app');
const { createAnalyzer } = require('./analysis');
const { createMedia } = require('./media');
const { loadGlossarySeed } = require('./routes/glossary');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const root = path.join(__dirname, '..');
  const dataDir = path.resolve(process.env.DATA_DIR || path.join(root, 'data'));
  const secret = process.env.SESSION_SECRET || 'dev-secret-' + Date.now() + 'xxxxxxxx';
  if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET kosong; seed memakai rahasia sementara (tanda buku jejak tidak bisa diverifikasi oleh server yang memakai rahasia lain).');
  const db = openDb(path.join(dataDir, 'laras.db'));
  const gl = loadGlossarySeed(db);
  if (gl) console.log(`Glosarium: ${gl} entri bawaan dimuat.`);
  if (db.prepare('SELECT 1 FROM units WHERE is_demo=1').get()) { console.log('Data peragaan sudah ada.'); db.close(); return; }
  const analyze = createAnalyzer();
  const app = createApp({ db, analyze, media: createMedia(), secret, uploadDir: path.join(dataDir, 'uploads'), adminEmails: [DEMO.accounts.find(([r]) => r === 'admin')[1]], authLimit: 1000 });
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const mk = () => { let cookie = ''; return async (m, u, b) => {
    const res = await fetch(base + u, { method: m, headers: { ...(cookie ? { cookie } : {}), ...(b && !(b instanceof FormData) ? { 'content-type': 'application/json' } : {}) }, body: b instanceof FormData ? b : b ? JSON.stringify(b) : undefined });
    for (const c of res.headers.getSetCookie()) { const kv = c.split(';')[0]; cookie = kv.endsWith('=') ? '' : kv; }
    const d = await res.json(); if (!res.ok) throw new Error(`${m} ${u}: ${d.error}`); return d; }; };
  const admin = mk(), maestro = mk(), murid = mk();
  const PW = DEMO.password;
  await admin('POST', '/api/auth/register', { email: 'admin-contoh@laras.invalid', name: 'Admin Contoh', password: PW, consent: true });
  const mu = (await maestro('POST', '/api/auth/register', { email: 'maestro-contoh@laras.invalid', name: 'Maestro Contoh (uji)', password: PW, consent: true })).user;
  await murid('POST', '/api/auth/register', { email: 'murid-contoh@laras.invalid', name: 'Murid Contoh (uji)', password: PW, consent: true });
  await admin('PATCH', `/api/users/${mu.id}/role`, { role: 'maestro' });
  await maestro('PATCH', '/api/me/profile', { sanggar: 'Sanggar Contoh (tidak nyata)', region: 'Surabaya', bio: 'Akun peragaan. Bukan maestro sungguhan.' });

  const today = new Date().toISOString().slice(0, 10);
  const fd = new FormData();
  for (const [k, v] of Object.entries({ title_id: 'Contoh uji: jeda dan gestur saat membuka dagelan', title_sby: 'Conto uji: mandeg lan obah tangan pas mbukak dagelan', skill: 'contoh uji (klip sintetis, bukan Ludruk)',
    notes_id: 'Unit ini hanya memperagakan alur. Klipnya sintetis: pembacaan bahasa Inggris domain publik dan gambar penari kartun buatan tim (bukan foto atau rekaman orang), tanpa penampil Ludruk. Karena kartun, detektor orang tidak mengenalinya dan analisis memakai cara cadangan. Teks transkrip hanya contoh bentuk data.',
    notes_sby: 'Unit iki mung kanggo nuduhno alur. Klipe sintetis lan ora enek pemain Ludruke. Teks transkrip mung conto bentuk data.',
    consent_holder: 'Tim se-LARAS (klip sintetis; tanpa penampil nyata)', consent_date: today, consent_scope: 'peragaan internal', access: 'public', consent_confirmed: 'true' })) fd.set(k, v);
  const clip = (name) => new Blob([fs.readFileSync(path.join(root, 'seed', 'fixtures', name))], { type: 'video/mp4' });
  fd.set('file', clip('maestro_uji.mp4'), 'contoh_uji.mp4');
  const { id } = await maestro('POST', '/api/units', fd);
  const waitUnit = async () => { for (let i = 0; i < 1200; i++) { await sleep(300); const u = db.prepare('SELECT analysis_status a, media_status m FROM units WHERE id=?').get(id); if (u.a === 'failed') throw new Error('analisis contoh gagal'); if (u.a === 'done' && !['pending', 'running'].includes(u.m)) return; } throw new Error('analisis contoh tidak selesai'); };
  await waitUnit();
  const info = JSON.parse(db.prepare('SELECT analysis FROM units WHERE id=?').get(id).analysis);
  const segsAt = (info.audio.speech_segments || []).map((s) => s[0]);
  await maestro('POST', `/api/units/${id}/segments`, { segments: [
    { start_sec: segsAt[0] || 0.3, text_sby: 'Cak, awakmu iku ngomong opo?', text_id: 'Mas, kamu itu bicara apa?' },
    { start_sec: segsAt[1] || 4, text_sby: 'Ojok mlayu, rungokno sek.', text_id: 'Jangan lari, dengarkan dulu.' },
    { start_sec: segsAt[2] || 9, text_sby: 'Wis talah, ndang mulai.', text_id: 'Sudahlah, segera mulai.' }] });
  for (const s of (await maestro('GET', `/api/units/${id}`)).segments) await maestro('POST', `/api/segments/${s.id}/validate`);
  // satu usulan otomatis dijadikan momen sah dengan penjelasan (contoh) — sisanya dibiarkan draf
  const draft = (await maestro('GET', `/api/units/${id}`)).markers.find((m) => m.kind === 'jeda' && m.status === 'draft_ai');
  if (draft) {
    await maestro('PATCH', `/api/markers/${draft.id}`, { title_sby: 'Mandeg sedhela sak durunge guyon (conto uji)', title_id: 'Berhenti sejenak sebelum lelucon (contoh uji)',
      why_sby: 'Mandeg ben penonton siap ngguyu. Iki conto teks, dudu katrangan maestro sing nyata.', why_id: 'Jeda memberi penonton waktu bersiap tertawa. Ini contoh teks, bukan penjelasan maestro yang nyata.' });
    await maestro('POST', `/api/markers/${draft.id}/validate`);
  }
  await maestro('PUT', `/api/units/${id}/rubric`, { dims: [
    { metric: 'pause_mean_s', label_sby: 'Rata-rata lawase mandeg', label_id: 'Rata-rata lama jeda', hint_sby: 'Mandeg sek sakdurunge guyon, ojok kesusu.', hint_id: 'Beri jeda sebelum lelucon, jangan terburu-buru.', tolerance_pct: 25 },
    { metric: 'long_pauses_per_min', label_sby: 'Mandeg dowo saben menit', label_id: 'Jeda panjang per menit', tolerance_pct: 40 },
    { metric: 'wrist_speed_mean', label_sby: 'Cepete tangan obah', label_id: 'Kecepatan gerak tangan', hint_sby: 'Tangan ojok obah terus.', hint_id: 'Jangan menggerakkan tangan terus-menerus.', tolerance_pct: 30 }] });
  await maestro('POST', `/api/units/${id}/validate`);
  db.prepare('UPDATE units SET is_demo=1 WHERE id=?').run(id);
  db.prepare('UPDATE maestro_profiles SET is_demo=1 WHERE user_id=?').run(mu.id);

  const cls = await maestro('POST', '/api/classes', { name: 'Kelas Contoh (peragaan)', description: 'Kelas peragaan: satu unit contoh. Bukan kelas sanggar sungguhan.' });
  await maestro('POST', `/api/classes/${cls.id}/units`, { unit_id: id, note: 'Mulai dari sini (contoh).' });
  const code = (await maestro('GET', '/api/classes')).owned[0].join_code;
  await murid('POST', '/api/classes/join', { code, consent_progress: true });
  await murid('POST', `/api/units/${id}/progress`, { step: 'nyebeng' });
  const afd = new FormData();
  afd.set('consent_confirmed', 'true'); afd.set('share_with_maestro', 'true'); afd.set('file', clip('murid_uji.mp4'), 'latihan_contoh.mp4');
  const att = await murid('POST', `/api/units/${id}/attempts`, afd);
  for (let i = 0; i < 1200; i++) { await sleep(300); const a = db.prepare('SELECT status s FROM attempts WHERE id=?').get(att.id).s; if (a === 'done') break; if (a === 'failed') throw new Error('analisis latihan contoh gagal'); }
  console.log(`Seed selesai. Unit contoh #${id}, kelas contoh (kode ${code}). Akun peragaan (kata sandi: ${PW}): admin-contoh@laras.invalid, maestro-contoh@laras.invalid, murid-contoh@laras.invalid`);
  await new Promise((r) => server.close(r)); db.close();
}
main().catch((e) => { console.error(e); process.exit(1); });
