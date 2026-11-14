'use strict';
const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { hashPassword, verifyPassword, sign, verify, parseCookies } = require('./auth');
const { createLedger } = require('./ledger');
const { reindexUnit } = require('./db');
const { createMedia } = require('./media');
const { createAsr } = require('./asr');
const M = require('./metrics');
const { HttpError, bad, reqStr, optStr, isoDate, num, truthy, safeName, parse, mmss } = require('./http');

const APP_NAME = 'se-LARAS';
const APP_VERSION = '0.3.0';
// Akun peragaan (dibuat oleh `npm run seed`). Hanya ditawarkan antarmuka bila operator menyalakan LARAS_DEMO=1; jangan dipakai pada pemasangan sungguhan.
const DEMO = { password: 'contoh-uji-123', accounts: [['murid', 'murid-contoh@laras.invalid'], ['maestro', 'maestro-contoh@laras.invalid'], ['admin', 'admin-contoh@laras.invalid']] };
const FIRST_BUILD = '2026-11-14'; // se-LARAS Inti; modul auth dan arsip berizin berasal dari LudrukHub (dibangun 2026-11-12)
const MAX_UPLOAD = 60 * 1024 * 1024;
const MIME_EXT = {
  'video/mp4': '.mp4', 'video/webm': '.webm', 'video/quicktime': '.mov',
  'audio/mpeg': '.mp3', 'audio/mp4': '.m4a', 'audio/x-m4a': '.m4a', 'audio/aac': '.aac', 'audio/wav': '.wav', 'audio/x-wav': '.wav', 'audio/webm': '.weba', 'audio/ogg': '.ogg',
};
const EXT_MIME = { '.mp4': 'video/mp4', '.m4v': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime', '.mp3': 'audio/mpeg', '.m4a': 'audio/mp4', '.aac': 'audio/aac', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.weba': 'audio/webm' };
const isVideo = (m) => String(m).startsWith('video/');
const baseMime = (m) => String(m || '').split(';')[0].trim().toLowerCase();   // 'video/webm;codecs=vp9,opus' -> 'video/webm'
/**
 * Jenis berkas yang dipakai: busboy gagal membaca tipe berparameter yang mengandung koma ('video/webm;codecs=vp9,opus', lazim dari MediaRecorder)
 * dan menggantinya 'text/plain'; maka bila tipe tak dikenal, dipakai ekstensi nama berkas. Isi sebenarnya tetap divalidasi ffprobe.
 */
function fileMime(file) {
  const m = baseMime(file.mimetype);
  if (MIME_EXT[m]) return m;
  return EXT_MIME[path.extname(String(file.originalname || '')).toLowerCase()] || m;
}
/** Ada gambar? Dari hasil ffprobe bila ada (rekaman peramban bisa berlabel video padahal hanya suara), kalau tidak dari tipe berkas. */
function hasVideo(row) {
  const info = parse(row.media_info);
  return info && typeof info.has_video === 'boolean' ? info.has_video : isVideo(row.mime);
}
const ATTEMPT_TTL_DAYS = 30;
const DATA_USES = ['tidak', 'riset'];

function createApp({
  db, ai, analyze, media = createMedia(), asr = createAsr(), secret, uploadDir, adminEmails = [], now = () => new Date(), secureCookies = false, authLimit = 10,
  publicDir = path.join(__dirname, '..', 'public'),
}) {
  if (!secret || secret.length < 16) throw new Error('secret minimal 16 karakter');
  fs.mkdirSync(uploadDir, { recursive: true });
  const ledger = createLedger(db, secret, now);
  const app = express();
  app.disable('x-powered-by');
  if (secureCookies) app.set('trust proxy', 1);
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'same-origin',
      'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin',
      'Permissions-Policy': 'camera=(self), microphone=(self), geolocation=(), payment=(), usb=()',
      'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; media-src 'self' blob:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; worker-src 'self'; manifest-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
    });
    next();
  });
  // Pertahanan berlapis terhadap CSRF (selain cookie SameSite=Lax): permintaan yang mengubah data dan membawa Origin harus berasal dari host yang sama.
  app.use((req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
    const o = req.headers.origin;
    if (!o) return next();
    let host = '';
    try { host = new URL(o).host; } catch { /* diperlakukan tidak cocok */ }
    return host === req.headers.host ? next() : next(new HttpError(403, 'Asal permintaan tidak diizinkan'));
  });
  app.use(express.json({ limit: '300kb' }));

  const upload = multer({
    storage: multer.diskStorage({
      destination: uploadDir,
      filename: (req, file, cb) => { file.mimetype = fileMime(file); cb(null, crypto.randomBytes(16).toString('hex') + (MIME_EXT[file.mimetype] || '.bin')); },
    }),
    limits: { fileSize: MAX_UPLOAD, files: 1, fields: 20 },
    fileFilter: (req, file, cb) => { file.mimetype = fileMime(file); return MIME_EXT[file.mimetype] ? cb(null, true) : cb(bad('Jenis berkas tidak didukung (video mp4/webm/mov atau audio mp3/m4a/wav/ogg/webm)')); },
  });
  const uploadOne = (req, res, next) => upload.single('file')(req, res, (err) => (err ? next(err.status ? err : bad(err.message)) : next()));
  const absPath = (p) => path.join(uploadDir, path.basename(p));
  const rmFile = (p) => { if (p) { try { fs.rmSync(absPath(p), { force: true }); } catch { /* sudah hilang */ } } };
  const sha256File = (p) => crypto.createHash('sha256').update(fs.readFileSync(absPath(p))).digest('hex');
  const clipFiles = (row) => [row.file_path, row.play_path];
  /** Periksa berkas yang baru diunggah; bila bukan media yang sah, hapus dan lempar 400. */
  async function ingest(file) {
    try { return await media.probe(absPath(file.filename)); } catch (e) { rmFile(file.filename); throw e; }
  }

  // ---------- auth ----------
  const attemptsMap = new Map();
  function limited(req, key) {
    const k = `${req.ip}|${key}`, t = now().getTime(), e = attemptsMap.get(k);
    if (!e || e.reset < t) { attemptsMap.set(k, { n: 1, reset: t + 15 * 60 * 1000 }); return false; }
    e.n += 1;
    return e.n > authLimit;
  }
  const userById = db.prepare('SELECT id,email,name,role FROM users WHERE id=?');
  app.use((req, res, next) => {
    const p = verify(parseCookies(req.headers.cookie).lr_token, secret);
    req.user = p ? userById.get(p.uid) || null : null;
    next();
  });
  const needAuth = (req, res, next) => (req.user ? next() : next(new HttpError(401, 'Silakan masuk terlebih dahulu')));
  const needMaestro = (req, res, next) => (!req.user ? next(new HttpError(401, 'Silakan masuk terlebih dahulu'))
    : (req.user.role === 'maestro' || req.user.role === 'admin') ? next() : next(new HttpError(403, 'Hanya maestro atau praktisi yang ditunjuk')));
  const needAdmin = (req, res, next) => (!req.user ? next(new HttpError(401, 'Silakan masuk terlebih dahulu'))
    : req.user.role === 'admin' ? next() : next(new HttpError(403, 'Hanya admin')));
  const setSession = (res, uid) => res.append('Set-Cookie', `lr_token=${encodeURIComponent(sign({ uid }, secret))}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}${secureCookies ? '; Secure' : ''}`);

  app.post('/api/auth/register', (req, res) => {
    const email = reqStr(req.body.email, 'Email', 5, 120).toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('Email tidak valid');
    const name = reqStr(req.body.name, 'Nama', 2, 80);
    const pw = reqStr(req.body.password, 'Kata sandi', 8, 200);
    if (req.body.consent !== true) throw bad('Persetujuan pemrosesan data pribadi diperlukan (UU 27/2022)');
    if (limited(req, 'reg')) throw new HttpError(429, 'Terlalu banyak percobaan, coba lagi nanti');
    if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) throw new HttpError(409, 'Email sudah terdaftar');
    const role = adminEmails.includes(email) ? 'admin' : 'learner';
    const id = db.prepare('INSERT INTO users(email,name,password_hash,role,consent_at) VALUES(?,?,?,?,?)').run(email, name, hashPassword(pw), role, now().toISOString()).lastInsertRowid;
    setSession(res, id);
    res.status(201).json({ user: userById.get(id) });
  });
  app.post('/api/auth/login', (req, res) => {
    const email = reqStr(req.body.email, 'Email', 3, 120).toLowerCase();
    const pw = reqStr(req.body.password, 'Kata sandi', 1, 200);
    if (limited(req, email)) throw new HttpError(429, 'Terlalu banyak percobaan, coba lagi nanti');
    const u = db.prepare('SELECT * FROM users WHERE email=?').get(email);
    if (!u || !verifyPassword(pw, u.password_hash)) throw new HttpError(401, 'Email atau kata sandi salah');
    setSession(res, u.id);
    res.json({ user: userById.get(u.id) });
  });
  app.post('/api/auth/logout', (req, res) => { res.append('Set-Cookie', 'lr_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0'); res.json({ ok: true }); });
  app.get('/api/me', (req, res) => {
    const profile = req.user && (req.user.role === 'maestro' || req.user.role === 'admin') ? db.prepare('SELECT sanggar,region,bio FROM maestro_profiles WHERE user_id=?').get(req.user.id) || null : null;
    res.json({ user: req.user, profile });
  });
  app.delete('/api/me', needAuth, (req, res) => {
    const units = db.prepare('SELECT id,file_path,play_path FROM units WHERE maestro_id=?').all(req.user.id);
    // rekaman latihan: milik pengguna sendiri DAN latihan orang lain pada unit yang ikut terhapus (baris DB-nya hilang lewat cascade; berkasnya harus ikut dibuang)
    const files = db.prepare('SELECT file_path,play_path FROM attempts WHERE user_id=? OR unit_id IN (SELECT id FROM units WHERE maestro_id=?)').all(req.user.id, req.user.id);
    ledger.append({ actor: req.user, action: 'akun_dihapus', subject: `user:${req.user.id}`, payload: { attempts: files.length, units: units.length } });
    db.transaction(() => {
      for (const u of units) db.prepare('DELETE FROM search_fts WHERE unit_id=?').run(u.id);
      db.prepare('DELETE FROM users WHERE id=?').run(req.user.id);
    })();
    files.forEach((f) => clipFiles(f).forEach(rmFile)); units.forEach((u) => clipFiles(u).forEach(rmFile));
    res.append('Set-Cookie', 'lr_token=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    res.json({ ok: true });
  });
  app.get('/api/users', needAdmin, (req, res) => {
    res.json({ users: db.prepare('SELECT id,email,name,role,created_at FROM users ORDER BY id').all() });
  });
  app.patch('/api/users/:id/role', needAdmin, (req, res) => {
    const role = req.body.role;
    if (!['learner', 'maestro', 'admin'].includes(role)) throw bad('role tidak valid');
    const id = Number(req.params.id);
    const r = db.prepare('UPDATE users SET role=? WHERE id=?').run(role, id);
    if (!r.changes) throw new HttpError(404, 'Pengguna tidak ditemukan');
    if (role === 'maestro') db.prepare('INSERT OR IGNORE INTO maestro_profiles(user_id) VALUES(?)').run(id);
    ledger.append({ actor: req.user, action: 'peran_diubah', subject: `user:${id}`, payload: { role } });
    res.json({ ok: true });
  });
  app.patch('/api/me/profile', needMaestro, (req, res) => {
    db.prepare('INSERT OR IGNORE INTO maestro_profiles(user_id) VALUES(?)').run(req.user.id);
    db.prepare('UPDATE maestro_profiles SET sanggar=?, region=?, bio=? WHERE user_id=?').run(optStr(req.body.sanggar, 'Sanggar', 120), optStr(req.body.region, 'Daerah', 80) || 'Surabaya', optStr(req.body.bio, 'Profil', 800), req.user.id);
    res.json({ ok: true });
  });

  // ---------- info ----------
  app.get('/healthz', (req, res) => res.json({ ok: true }));
  app.get('/api/about', (req, res) => res.json({
    name: APP_NAME, version: APP_VERSION, first_build: FIRST_BUILD, ai_text_enabled: Boolean(ai && ai.enabled()), asr_enabled: asr.enabled(),
    retention_days: ATTEMPT_TTL_DAYS, max_clip_seconds: media.maxDurationS || 150, max_upload_mb: Math.round(MAX_UPLOAD / 1048576),
    reused: { name: 'LudrukHub', built: '2026-11-12', parts: ['akun dan peran', 'arsip klip berizin', 'buku jejak berantai'] },
    demo: process.env.LARAS_DEMO === '1' ? { password: DEMO.password, accounts: DEMO.accounts.map(([role, email]) => ({ role, email })) } : null,
    // Pernyataan apa adanya tentang apa yang ada dan tidak ada (dibaca antarmuka dan dokumen).
    honest: {
      trained_on_ludruk_data: false, asr_model_included: false, ludruk_dataset: 'belum ada; data hanya masuk lewat izin maestro',
      evaluation: 'hanya pada data publik non-Ludruk; rincian dan batasnya ada di dokumen evaluasi proyek', suroboyoan_text: 'draf; menunggu pengesahan penutur asli',
    },
    engines: { speech: 'Silero VAD v6.2 (ONNX)', people: 'YOLOX-S (ONNX)', pose: 'BlazePose GHUM full (TFLite)', alignment: 'DTW pada MFCC' },
    notes: [
      'Analisis gerak dan suara berjalan di server tanpa layanan luar; semua angka bersifat deskriptif dan tidak ada skor mutu.',
      'Transkrip, momen, dan ukuran baru tampil kepada pelajar setelah disahkan maestro.',
      'Data berlabel "contoh" hanya untuk peragaan dan bukan konten maestro.',
    ],
  }));
  app.get('/api/metrics', (req, res) => res.json({
    metrics: Object.entries(M.CATALOG).map(([key, v]) => ({ key, ...v, floor: M.CAL.lantai[key] != null ? M.CAL.lantai[key] : null, fragile_to_noise: M.CAL.rapuh_terhadap_derau.includes(key) })),
    calibration: { aligned_cost_max: M.CAL.ambang_biaya_penyejajaran, source: M.CAL.sumber },
  }));
  app.get('/api/stats', (req, res) => {
    const n = (s, ...a) => db.prepare(s).get(...a).n;
    res.json({
      units_validated: n("SELECT COUNT(*) n FROM units WHERE status='validated' AND is_demo=0"),
      units_demo: n("SELECT COUNT(*) n FROM units WHERE status='validated' AND is_demo=1"),
      segments_validated: n("SELECT COUNT(*) n FROM segments s JOIN units u ON u.id=s.unit_id WHERE s.status='validated' AND u.status='validated'"),
      markers_validated: n("SELECT COUNT(*) n FROM markers m JOIN units u ON u.id=m.unit_id WHERE m.status='validated' AND u.status='validated'"),
      glossary_validated: n("SELECT COUNT(*) n FROM glossary WHERE status='validated' AND is_demo=0"),
      // akun peragaan (maestro_profiles.is_demo=1) bukan maestro sungguhan: tidak boleh menaikkan angka di beranda
      maestros: n("SELECT COUNT(*) n FROM users u LEFT JOIN maestro_profiles p ON p.user_id=u.id WHERE u.role='maestro' AND COALESCE(p.is_demo,0)=0"),
      ledger_entries: n('SELECT COUNT(*) n FROM ledger'),
    });
  });

  // ---------- unit ----------
  const unitRow = (id) => {
    const u = db.prepare('SELECT u.*, m.name maestro_name, p.sanggar, p.region, p.bio FROM units u JOIN users m ON m.id=u.maestro_id LEFT JOIN maestro_profiles p ON p.user_id=u.maestro_id WHERE u.id=?').get(id);
    if (!u) throw new HttpError(404, 'Unit tidak ditemukan');
    return u;
  };
  const isOwner = (user, u) => !!user && (user.id === u.maestro_id || user.role === 'admin');
  function seeUnit(user, u) {
    if (u.status === 'validated') return u.access === 'public' || !!user;
    return isOwner(user, u);
  }
  function mustSee(req, u) {
    if (u.status === 'withdrawn' && !isOwner(req.user, u)) throw new HttpError(410, 'Unit ini telah ditarik oleh maestro');
    if (!seeUnit(req.user, u)) throw new HttpError(req.user ? 403 : 401, req.user ? 'Unit belum tersedia' : 'Masuk untuk membuka unit ini');
  }
  const mustOwn = (req, u) => { if (!isOwner(req.user, u)) throw new HttpError(403, 'Hanya maestro pemilik unit'); };
  /** Ringkasan analisis untuk antarmuka: tanpa lini masa pose dan tanpa lintasan orang/penyejajaran yang besar. */
  const summary = (a) => {
    if (!a) return null;
    const { timeline, ...pose } = a.pose || {};
    const { speech_onsets_s, ...audio } = a.audio || {};
    const al = a.alignment ? (({ path: _p, ...rest }) => rest)(a.alignment) : null;
    return {
      audio: a.audio ? audio : null, pose: a.pose ? pose : null, warnings: a.warnings || [], error: a.error || null, engine: a.engine || null,
      persons: a.persons ? { count_median: a.persons.count_median, selected: a.persons.selected, n_tracks: (a.persons.tracks || []).length } : null, alignment: al,
    };
  };
  const publicUnit = (u, user) => ({
    id: u.id, title_sby: u.title_sby, title_id: u.title_id, skill: u.skill, notes_sby: u.notes_sby, notes_id: u.notes_id, access: u.access, status: u.status,
    maestro: { id: u.maestro_id, name: u.maestro_name, sanggar: u.sanggar || '', region: u.region || '', bio: u.bio || '' },
    has_clip: !!u.file_path, is_video: u.file_path ? hasVideo(u) : false, is_demo: !!u.is_demo, created_at: u.created_at, validated_at: u.validated_at,
    consent: { holder: u.consent_holder, date: u.consent_date, scope: u.consent_scope }, duration_s: u.duration_s, media_status: u.media_status,
    analysis_status: u.analysis_status, analysis_error: u.analysis_error, can_manage: isOwner(user, u),
    ...(isOwner(user, u) ? { data_use: u.data_use, performer_track: u.performer_track } : {}),
  });
  const rubricOf = (id) => db.prepare('SELECT metric,label_sby,label_id,hint_sby,hint_id,tolerance_pct FROM rubric_dims WHERE unit_id=? ORDER BY id').all(id);
  const markersOf = (id, own) => db.prepare(`SELECT id,t_sec,kind,title_sby,title_id,why_sby,why_id,status,source,meta FROM markers WHERE unit_id=? ${own ? '' : "AND status='validated'"} ORDER BY t_sec,id`).all(id)
    .map((m) => ({ ...m, meta: parse(m.meta) }));

  /** Irama ucap klip (bagian bicara, detik) untuk sampul unit; hanya bentuk waktu, tanpa isi ucapan. */
  const rhythmOf = (u) => { const a = parse(u.analysis); const sp = a && a.audio && a.audio.speech_segments; return Array.isArray(sp) ? sp.slice(0, 80) : []; };
  app.get('/api/units', (req, res) => {
    const mine = req.query.mine === '1' && req.user;
    const rows = mine
      ? db.prepare("SELECT id FROM units WHERE maestro_id=? AND status<>'withdrawn' ORDER BY id DESC").all(req.user.id)
      : db.prepare("SELECT id FROM units WHERE status='validated' ORDER BY id DESC LIMIT 100").all();
    res.json({ units: rows.map((r) => unitRow(r.id)).filter((u) => seeUnit(req.user, u) || mine).map((u) => ({ ...publicUnit(u, req.user), rubric_count: rubricOf(u.id).length, rhythm: rhythmOf(u),
      marker_count: db.prepare("SELECT COUNT(*) n FROM markers WHERE unit_id=? AND status='validated'").get(u.id).n })) });
  });
  app.get('/api/units/:id', (req, res) => {
    const u = unitRow(Number(req.params.id));
    mustSee(req, u);
    const own = isOwner(req.user, u);
    const a = parse(u.analysis);
    const segs = db.prepare(`SELECT id,seq,start_sec,end_sec,text_sby,text_id,status,source FROM segments WHERE unit_id=? ${own ? '' : "AND status='validated'"} ORDER BY start_sec,seq`).all(u.id);
    res.json({ unit: publicUnit(u, req.user), segments: segs, markers: markersOf(u.id, own), rubric: rubricOf(u.id), analysis: own || u.status === 'validated' ? summary(a) : null,
      available_metrics: own ? M.available(a) : undefined, readiness: own ? readiness(u.id) : undefined });
  });
  /** Berkas yang diputar: salinan ternormalisasi bila ada, kalau tidak yang asli. Mendukung Range (sendFile). */
  function sendClip(res, row) {
    const useCopy = row.play_path && fs.existsSync(absPath(row.play_path));
    const file = useCopy ? row.play_path : row.file_path;
    if (!file || !fs.existsSync(absPath(file))) throw new HttpError(404, 'Berkas tidak ditemukan');
    res.set({ 'Content-Type': useCopy ? row.play_mime : row.mime, 'Cache-Control': 'private, no-store' });
    res.sendFile(absPath(file));
  }
  app.get('/api/units/:id/clip', (req, res) => {
    const u = unitRow(Number(req.params.id));
    mustSee(req, u);
    if (!u.file_path) throw new HttpError(404, 'Unit tidak memiliki klip');
    sendClip(res, u);
  });
  app.get('/api/units/:id/pose', (req, res) => {
    const u = unitRow(Number(req.params.id));
    mustSee(req, u);
    const a = parse(u.analysis);
    res.json({ timeline: (a && a.pose && a.pose.timeline) || [] });
  });

  function readiness(uid) {
    const u = unitRow(uid), a = parse(u.analysis), avail = M.available(a);
    const dims = rubricOf(uid);
    const segs = db.prepare("SELECT COUNT(*) n, SUM(status='validated') v FROM segments WHERE unit_id=?").get(uid);
    const problems = [];
    if (u.analysis_status !== 'done') problems.push('Analisis klip belum selesai atau gagal');
    if (!dims.length) problems.push('Belum ada ukuran yang dipilih');
    for (const d of dims) if (!avail.includes(d.metric)) problems.push(`Ukuran "${d.metric}" tidak tersedia/andal pada klip acuan`);
    const poseDims = dims.some((d) => M.CATALOG[d.metric] && M.CATALOG[d.metric].src.includes('pose'));
    if (poseDims && a && a.persons && a.persons.count_median >= 2 && !u.performer_track) problems.push('Beberapa orang terdeteksi di video: pilih penampil utama dulu agar ukuran gerak mengikuti orang yang tepat');
    if (!segs.v) problems.push('Belum ada segmen transkrip yang disahkan');
    if (segs.n && segs.v < segs.n) problems.push(`${segs.n - segs.v} segmen transkrip belum disahkan (hanya yang disahkan tampil ke pelajar)`);
    return { ok: problems.filter((p) => !p.includes('segmen transkrip belum disahkan')).length === 0, problems };
  }

  /** Usulan momen otomatis dari analisis: selalu draf; yang sudah disentuh/disahkan maestro tidak ditimpa. */
  function proposeMarkers(unitId, res) {
    const moments = Array.isArray(res.moments) ? res.moments : [];
    db.prepare("DELETE FROM markers WHERE unit_id=? AND status='draft_ai'").run(unitId);
    const keep = db.prepare('SELECT t_sec,kind FROM markers WHERE unit_id=?').all(unitId);
    const ins = db.prepare("INSERT INTO markers(unit_id,t_sec,kind,title_sby,title_id,status,source,meta) VALUES(?,?,?,?,?,'draft_ai','ai',?)");
    for (const m of moments.slice(0, 24)) {
      if (!Number.isFinite(m.t) || m.t < 0 || !['jeda', 'gerak'].includes(m.kind)) continue;
      if (keep.some((k) => k.kind === m.kind && Math.abs(k.t_sec - m.t) < 0.6)) continue;
      const title = m.kind === 'jeda'
        ? [`Jeda ${Number(m.dur).toFixed(1)} dtk (usulan otomatis)`, `Mandeg ${Number(m.dur).toFixed(1)} detik (usulan otomatis)`]
        : ['Puncak gerak tangan (usulan otomatis)', 'Tangan obah banter (usulan otomatis)'];
      ins.run(unitId, m.t, m.kind, title[1], title[0], JSON.stringify({ dur: m.dur, strength: m.strength }));
    }
  }

  function schedule(kind, id) {
    const tbl = kind === 'unit' ? 'units' : 'attempts';
    const row = db.prepare(`SELECT * FROM ${tbl} WHERE id=?`).get(id);
    if (!row || !row.file_path) return;
    const col = kind === 'unit' ? 'analysis_status' : 'status';
    db.prepare(`UPDATE ${tbl} SET ${col}='running' WHERE id=?`).run(id);
    const opts = {};
    let unit = null;
    if (kind === 'unit') { if (row.performer_track) opts.track = row.performer_track; }
    else {
      unit = db.prepare('SELECT file_path FROM units WHERE id=?').get(row.unit_id);
      if (unit && unit.file_path) opts.ref = absPath(unit.file_path);
      if (row.track_id) opts.track = row.track_id;
    }
    analyze(absPath(row.file_path), hasVideo(row) ? 'both' : 'audio', opts).then((res) => {
      if (res.error) throw new Error(res.error);
      if (kind === 'unit') {
        db.transaction(() => {
          db.prepare("UPDATE units SET analysis=?, analysis_status='done', analysis_error=NULL WHERE id=?").run(JSON.stringify(res), id);
          proposeMarkers(id, res);
        })();
      } else {
        const at = db.prepare('SELECT unit_id FROM attempts WHERE id=?').get(id);
        if (!at) return;
        const ref = parse(db.prepare('SELECT analysis FROM units WHERE id=?').get(at.unit_id).analysis);
        const cmp = M.compare(ref, res, rubricOf(at.unit_id));
        db.prepare("UPDATE attempts SET analysis=?, comparison=?, status='done', error=NULL WHERE id=?").run(JSON.stringify(res), JSON.stringify(cmp), id);
      }
    }).catch((e) => {
      const msg = String(e.message || e).slice(0, 300);
      if (kind === 'unit') db.prepare("UPDATE units SET analysis_status='failed', analysis_error=? WHERE id=?").run(msg, id);
      else db.prepare("UPDATE attempts SET status='failed', error=? WHERE id=?").run(msg, id);
    });
  }
  /** Salinan putar (ramah-peramban) dibuat di latar belakang; kegagalan tidak menggagalkan unggahan (klip asli tetap diputar). */
  function scheduleMedia(kind, id) {
    const tbl = kind === 'unit' ? 'units' : 'attempts';
    const row = db.prepare(`SELECT file_path,media_info FROM ${tbl} WHERE id=?`).get(id);
    const info = parse(row && row.media_info);
    if (!row || !row.file_path || !info) return;
    if (kind === 'unit') db.prepare("UPDATE units SET media_status='running' WHERE id=?").run(id);
    media.normalize(absPath(row.file_path), info).then((out) => {
      const still = db.prepare(`SELECT file_path FROM ${tbl} WHERE id=?`).get(id);
      if (!still || !still.file_path) { if (out) rmFile(out.path); return; }  // dihapus/ditarik selagi diproses
      if (out) {
        db.prepare(`UPDATE ${tbl} SET play_path=?, play_mime=? ${kind === 'unit' ? ", media_status='done'" : ''} WHERE id=?`).run(path.basename(out.path), out.mime, id);
        ledger.append({ actor: null, action: 'salinan_putar_dibuat', subject: `${kind === 'unit' ? 'unit' : 'latihan'}:${id}`, payload: { asli_sha256: sha256File(row.file_path), putar_sha256: sha256File(out.path), codec: out.mime } });
      } else if (kind === 'unit') db.prepare("UPDATE units SET media_status='done' WHERE id=?").run(id);
    }).catch(() => { if (kind === 'unit') db.prepare("UPDATE units SET media_status='failed' WHERE id=?").run(id); });
  }
  app.locals.idle = async () => { await analyze.idle(); if (media.normalize.idle) await media.normalize.idle(); };

  /**
   * Pemulihan saat start. Antrean pekerjaan latar (analisis, salinan putar) hidup di memori proses, sedangkan statusnya tersimpan di
   * basis data. Bila server mati atau dimulai ulang saat pekerjaan berjalan, barisnya tertinggal 'pending'/'running' selamanya:
   * pelajar menunggu tanpa akhir dan tombol "analisis ulang" ditolak 409. Di sini pekerjaan itu dijadwalkan ulang. Aman diulang:
   * analisis hanya membaca berkas asli dan menimpa kolom hasil yang sama; salinan putar ditulis dengan `ffmpeg -y`.
   * Batas yang disengaja: salinan putar LATIHAN tidak punya kolom status, jadi tidak dipulihkan (klip asli tetap diputar).
   */
  function recoverJobs() {
    const n = { analisis_unit: 0, analisis_latihan: 0, salinan_putar: 0, salinan_putar_gagal: 0 };
    for (const r of db.prepare("SELECT id FROM units WHERE file_path IS NOT NULL AND analysis_status IN ('pending','running') ORDER BY id").all()) { schedule('unit', r.id); n.analisis_unit++; }
    for (const r of db.prepare("SELECT id FROM attempts WHERE file_path IS NOT NULL AND status IN ('pending','running') ORDER BY id").all()) { schedule('attempt', r.id); n.analisis_latihan++; }
    for (const r of db.prepare("SELECT id, media_info FROM units WHERE file_path IS NOT NULL AND media_status IN ('pending','running') ORDER BY id").all()) {
      if (parse(r.media_info)) { scheduleMedia('unit', r.id); n.salinan_putar++; }
      else { db.prepare("UPDATE units SET media_status='failed' WHERE id=?").run(r.id); n.salinan_putar_gagal++; }  // tanpa info media tidak ada yang bisa diulang
    }
    return n;
  }
  app.locals.recoverJobs = recoverJobs;
  app.locals.recovered = analyze ? recoverJobs() : null;

  app.post('/api/units', needMaestro, uploadOne, async (req, res) => {
    try {
      const b = req.body || {};
      if (!req.file) throw bad('Klip demonstrasi wajib diunggah');
      const title_id = reqStr(b.title_id, 'Judul (Indonesia)', 3, 120), title_sby = reqStr(b.title_sby, 'Judul (Suroboyoan)', 3, 120);
      const holder = reqStr(b.consent_holder, 'Pihak yang memberi izin (yang tampil di klip)', 2, 160);
      const cdate = isoDate(b.consent_date, 'Tanggal izin');
      if (cdate > new Date(now().getTime() + 14 * 3600e3).toISOString().slice(0, 10)) throw bad('Tanggal izin tidak boleh di masa depan');   // toleransi zona waktu: tanggal WIB dini hari sudah "besok" menurut UTC
      if (!truthy(b.consent_confirmed)) throw bad('Izin tertulis dari semua orang yang tampil di klip harus sudah diperoleh');
      const dataUse = b.data_use == null || b.data_use === '' ? 'tidak' : b.data_use;
      if (!DATA_USES.includes(dataUse)) throw bad('data_use tidak valid');
      const access = b.access === 'public' ? 'public' : 'login';
      const info = await ingest(req.file);
      db.prepare('INSERT OR IGNORE INTO maestro_profiles(user_id) VALUES(?)').run(req.user.id);
      const origSha = sha256File(req.file.filename);
      const id = db.prepare(`INSERT INTO units(maestro_id,title_sby,title_id,skill,notes_sby,notes_id,access,file_path,file_name,mime,size,consent_holder,consent_date,consent_scope,data_use,duration_s,media_info,orig_sha256,media_status)
        VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'pending')`).run(req.user.id, title_sby, title_id, optStr(b.skill, 'Keterampilan', 120), optStr(b.notes_sby, 'Catatan (Suroboyoan)', 2000), optStr(b.notes_id, 'Catatan (Indonesia)', 2000),
        access, req.file.filename, safeName(req.file.originalname), req.file.mimetype, req.file.size, holder, cdate, optStr(b.consent_scope, 'Lingkup izin', 500), dataUse, info.duration_s, JSON.stringify(info), origSha).lastInsertRowid;
      ledger.append({ actor: req.user, action: 'unit_dibuat', subject: `unit:${id}`, payload: { clip_sha256: origSha, consent_holder: holder, consent_date: cdate, scope: optStr(b.consent_scope, 'Lingkup izin', 500), data_use: dataUse, duration_s: info.duration_s } });
      schedule('unit', id);
      scheduleMedia('unit', id);
      res.status(201).json({ id });
    } catch (e) { if (req.file) rmFile(req.file.filename); throw e; }
  });
  app.patch('/api/units/:id', needMaestro, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    const b = req.body || {};
    let dataUse = u.data_use;
    if (b.data_use != null) { if (!DATA_USES.includes(b.data_use)) throw bad('data_use tidak valid'); dataUse = b.data_use; }
    db.prepare('UPDATE units SET title_sby=?,title_id=?,skill=?,notes_sby=?,notes_id=?,access=?,data_use=? WHERE id=?').run(
      b.title_sby != null ? reqStr(b.title_sby, 'Judul (Suroboyoan)', 3, 120) : u.title_sby, b.title_id != null ? reqStr(b.title_id, 'Judul (Indonesia)', 3, 120) : u.title_id,
      b.skill != null ? optStr(b.skill, 'Keterampilan', 120) : u.skill, b.notes_sby != null ? optStr(b.notes_sby, 'Catatan', 2000) : u.notes_sby,
      b.notes_id != null ? optStr(b.notes_id, 'Catatan', 2000) : u.notes_id, b.access === 'public' ? 'public' : b.access === 'login' ? 'login' : u.access, dataUse, u.id);
    if (dataUse !== u.data_use) ledger.append({ actor: req.user, action: 'izin_data_diubah', subject: `unit:${u.id}`, payload: { dari: u.data_use, ke: dataUse } });
    reopen(req, u, 'isi diubah');
    res.json({ ok: true });
  });
  app.post('/api/units/:id/reanalyze', needMaestro, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    if (u.analysis_status === 'running') throw new HttpError(409, 'Analisis sedang berjalan');
    schedule('unit', u.id);
    res.json({ ok: true });
  });

  // transkrip
  function reindex(uid) { reindexUnit(db, uid); }
  const nextSeq = (uid) => db.prepare('SELECT COALESCE(MAX(seq),0)+1 n FROM segments WHERE unit_id=?').get(uid).n;
  const reopen = (req, u, why) => {
    const cur = db.prepare('SELECT status FROM units WHERE id=?').get(u.id);
    if (!cur || cur.status !== 'validated') return;
    db.prepare("UPDATE units SET status='draft', validated_at=NULL WHERE id=?").run(u.id);
    reindex(u.id);
    ledger.append({ actor: req.user, action: 'unit_dibuka_kembali', subject: `unit:${u.id}`, payload: { alasan: why } });
  };
  const optTime = (v, name) => (v == null || v === '' ? null : num(v, name, 0, 7200));
  app.post('/api/units/:id/segments', needMaestro, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    const segs = Array.isArray(req.body.segments) ? req.body.segments : null;
    if (!segs || !segs.length || segs.length > 200) throw bad('segments wajib berisi 1–200 segmen');
    const ins = db.prepare("INSERT INTO segments(unit_id,seq,start_sec,end_sec,text_sby,text_id,status,source) VALUES(?,?,?,?,?,?,'draft_human','manual')");
    db.transaction(() => {
      for (const s of segs) {
        const st = s.start_sec == null || s.start_sec === '' ? 0 : num(s.start_sec, 'start_sec', 0, 7200);
        const en = optTime(s.end_sec, 'end_sec');
        if (en != null && en <= st) throw bad('end_sec harus setelah start_sec');
        ins.run(u.id, nextSeq(u.id), st, en, reqStr(s.text_sby, 'Teks Suroboyoan', 1, 1000), optStr(s.text_id, 'Terjemahan', 1000));
      }
    })();
    res.status(201).json({ added: segs.length });
  });
  app.post('/api/units/:id/segments/suggest', needMaestro, async (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    if (!ai || !ai.enabled()) throw new HttpError(503, 'AI teks belum dikonfigurasi (ANTHROPIC_API_KEY kosong). Isi transkrip secara manual.');
    const out = await ai.suggest(reqStr(req.body.text, 'Teks', 5, 4000));
    if (!out.length) throw new HttpError(502, 'AI tidak mengembalikan segmen');
    const ins = db.prepare("INSERT INTO segments(unit_id,seq,start_sec,text_sby,text_id,status,source) VALUES(?,?,0,?,?,'draft_ai','ai')");
    db.transaction(() => out.slice(0, 100).forEach((s) => ins.run(u.id, nextSeq(u.id), s.text_sby, s.text_id)))();
    res.status(201).json({ added: Math.min(out.length, 100) });
  });
  app.post('/api/units/:id/segments/transcribe', needMaestro, async (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    if (!asr.enabled()) throw new HttpError(503, 'Pengenal ujaran belum dipasang (ASR_COMMAND_JSON kosong). se-LARAS tidak membawa model ASR Suroboyoan; isi transkrip secara manual.');
    if (!u.file_path) throw bad('Unit tidak memiliki klip');
    const out = await asr.transcribe(absPath(u.file_path));
    if (!out.length) throw new HttpError(502, 'ASR tidak mengembalikan segmen');
    const ins = db.prepare("INSERT INTO segments(unit_id,seq,start_sec,end_sec,text_sby,text_id,status,source) VALUES(?,?,?,?,?,'','draft_ai','asr')");
    db.transaction(() => out.slice(0, 200).forEach((s) => ins.run(u.id, nextSeq(u.id), s.start, s.end != null && s.end > s.start ? s.end : null, s.text)))();
    ledger.append({ actor: req.user, action: 'asr_diusulkan', subject: `unit:${u.id}`, payload: { segmen: Math.min(out.length, 200) } });
    res.status(201).json({ added: Math.min(out.length, 200) });
  });
  const segOr404 = (id) => {
    const s = db.prepare('SELECT s.*, u.maestro_id FROM segments s JOIN units u ON u.id=s.unit_id WHERE s.id=?').get(id);
    if (!s) throw new HttpError(404, 'Segmen tidak ditemukan');
    return s;
  };
  app.patch('/api/segments/:id', needMaestro, (req, res) => {
    const s = segOr404(Number(req.params.id)); mustOwn(req, { maestro_id: s.maestro_id });
    const st = req.body.start_sec == null ? s.start_sec : num(req.body.start_sec, 'start_sec', 0, 7200);
    const en = req.body.end_sec === undefined ? s.end_sec : optTime(req.body.end_sec, 'end_sec');
    if (en != null && en <= st) throw bad('end_sec harus setelah start_sec');
    db.prepare("UPDATE segments SET start_sec=?, end_sec=?, text_sby=?, text_id=?, status='draft_human', validated_by=NULL, validated_at=NULL WHERE id=?")
      .run(st, en, reqStr(req.body.text_sby, 'Teks Suroboyoan', 1, 1000), optStr(req.body.text_id, 'Terjemahan', 1000), s.id);
    if (s.status === 'validated') reopen(req, unitRow(s.unit_id), 'segmen diubah');   // draf belum terlihat pelajar: tidak perlu membuka kembali unit
    reindex(s.unit_id);
    res.json({ ok: true });
  });
  app.delete('/api/segments/:id', needMaestro, (req, res) => {
    const s = segOr404(Number(req.params.id)); mustOwn(req, { maestro_id: s.maestro_id });
    db.prepare('DELETE FROM segments WHERE id=?').run(s.id);
    if (s.status === 'validated') reopen(req, unitRow(s.unit_id), 'segmen dihapus');
    reindex(s.unit_id);
    res.json({ ok: true });
  });
  app.post('/api/segments/:id/validate', needMaestro, (req, res) => {
    const s = segOr404(Number(req.params.id)); mustOwn(req, { maestro_id: s.maestro_id });
    if (!s.text_id.trim()) throw bad('Terjemahan harus diisi sebelum disahkan');
    if (s.text_id.startsWith('[ragu]')) throw bad('Hapus penanda [ragu] setelah diperiksa, lalu sahkan');
    db.prepare("UPDATE segments SET status='validated', validated_by=?, validated_at=datetime('now') WHERE id=?").run(req.user.id, s.id);
    ledger.append({ actor: req.user, action: 'segmen_disahkan', subject: `segmen:${s.id}`, payload: { unit: s.unit_id, teks_sha256: crypto.createHash('sha256').update(s.text_sby + '\n' + s.text_id).digest('hex') } });
    reindex(s.unit_id);
    res.json({ ok: true });
  });

  // rubrik maestro
  app.put('/api/units/:id/rubric', needMaestro, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    const dims = Array.isArray(req.body.dims) ? req.body.dims : null;
    if (!dims || dims.length > 6) throw bad('dims wajib berupa daftar maksimal 6 ukuran');
    const avail = M.available(parse(u.analysis));
    const seen = new Set();
    const clean = dims.map((d) => {
      if (!M.CATALOG[d.metric]) throw bad(`Ukuran tidak dikenal: ${d.metric}`);
      if (seen.has(d.metric)) throw bad(`Ukuran ganda: ${d.metric}`);
      seen.add(d.metric);
      if (!avail.includes(d.metric)) throw bad(`Ukuran "${d.metric}" tidak tersedia atau tidak andal pada klip acuan ini`);
      const tol = Number(d.tolerance_pct == null ? 25 : d.tolerance_pct);
      if (!Number.isFinite(tol) || tol < 5 || tol > 100) throw bad('Toleransi harus 5–100%');
      return { metric: d.metric, label_sby: reqStr(d.label_sby, 'Nama (Suroboyoan)', 2, 80), label_id: reqStr(d.label_id, 'Nama (Indonesia)', 2, 80),
        hint_sby: optStr(d.hint_sby, 'Petunjuk (Suroboyoan)', 400), hint_id: optStr(d.hint_id, 'Petunjuk (Indonesia)', 400), tolerance_pct: tol };
    });
    db.transaction(() => {
      db.prepare('DELETE FROM rubric_dims WHERE unit_id=?').run(u.id);
      const ins = db.prepare('INSERT INTO rubric_dims(unit_id,metric,label_sby,label_id,hint_sby,hint_id,tolerance_pct) VALUES(?,?,?,?,?,?,?)');
      clean.forEach((d) => ins.run(u.id, d.metric, d.label_sby, d.label_id, d.hint_sby, d.hint_id, d.tolerance_pct));
    })();
    ledger.append({ actor: req.user, action: 'rubrik_ditetapkan', subject: `unit:${u.id}`, payload: { dims: clean.map((d) => ({ metric: d.metric, tol: d.tolerance_pct })) } });
    reopen(req, u, 'ukuran diubah');
    res.json({ ok: true });
  });

  app.post('/api/units/:id/validate', needMaestro, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    if (u.status === 'withdrawn') throw new HttpError(409, 'Unit sudah ditarik');
    const r = readiness(u.id);
    if (!r.ok) throw bad(`Belum bisa disahkan: ${r.problems[0]}`);
    db.prepare("UPDATE units SET status='validated', validated_at=datetime('now') WHERE id=?").run(u.id);
    ledger.append({ actor: req.user, action: 'unit_disahkan', subject: `unit:${u.id}`, payload: { rubrik: rubricOf(u.id).map((d) => d.metric), segmen_sah: db.prepare("SELECT COUNT(*) n FROM segments WHERE unit_id=? AND status='validated'").get(u.id).n,
      momen_sah: db.prepare("SELECT COUNT(*) n FROM markers WHERE unit_id=? AND status='validated'").get(u.id).n } });
    reindex(u.id);
    res.json({ ok: true });
  });
  app.post('/api/units/:id/withdraw', needMaestro, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    db.prepare("UPDATE units SET status='withdrawn', file_path=NULL, play_path=NULL, analysis=NULL, media_status='none' WHERE id=?").run(u.id);
    db.prepare('DELETE FROM search_fts WHERE unit_id=?').run(u.id);
    clipFiles(u).forEach(rmFile);
    ledger.append({ actor: req.user, action: 'unit_ditarik', subject: `unit:${u.id}`, payload: { klip_dihapus: !!u.file_path } });
    res.json({ ok: true });
  });

  // ---------- latihan pelajar ----------
  /** Catatan kemajuan belajar (hanya tanggal dan hitungan) tetap ada walau rekaman latihan dihapus; dihapus bersama akun. */
  const touchProgress = db.prepare(`INSERT INTO unit_progress(user_id,unit_id,tedean_at,tedean_n) VALUES(?,?,datetime('now'),1)
    ON CONFLICT(user_id,unit_id) DO UPDATE SET tedean_n=tedean_n+1, tedean_at=COALESCE(tedean_at,datetime('now'))`);
  const attemptRow = (id) => {
    const a = db.prepare('SELECT a.*, u.maestro_id FROM attempts a JOIN units u ON u.id=a.unit_id WHERE a.id=?').get(id);
    if (!a) throw new HttpError(404, 'Latihan tidak ditemukan');
    return a;
  };
  const canSeeAttempt = (user, a) => !!user && (user.id === a.user_id || (a.share_with_maestro && user.id === a.maestro_id));
  app.post('/api/units/:id/attempts', needAuth, (req, res, next) => {
    try {
      const u = unitRow(Number(req.params.id));
      if (u.status !== 'validated') throw new HttpError(409, 'Unit ini belum disahkan maestro');
    } catch (e) { return next(e); }
    uploadOne(req, res, next);
  }, async (req, res) => {
    try {
      const u = unitRow(Number(req.params.id));
      if (!req.file) throw bad('Klip latihan wajib diunggah');
      if (!truthy(req.body.consent_confirmed)) throw bad('Anda harus menyetujui pemrosesan rekaman diri Anda (video dan suara) untuk analisis ini');
      if (limited(req, `att${req.user.id}`)) throw new HttpError(429, 'Terlalu banyak unggahan, coba lagi nanti');
      const info = await ingest(req.file);
      const share = truthy(req.body.share_with_maestro) ? 1 : 0;
      const id = db.prepare('INSERT INTO attempts(unit_id,user_id,file_path,file_name,mime,size,share_with_maestro,duration_s,media_info) VALUES(?,?,?,?,?,?,?,?,?)')
        .run(u.id, req.user.id, req.file.filename, safeName(req.file.originalname), req.file.mimetype, req.file.size, share, info.duration_s, JSON.stringify(info)).lastInsertRowid;
      ledger.append({ actor: req.user, action: 'persetujuan_latihan', subject: `latihan:${id}`, payload: { unit: u.id, dibagikan_ke_maestro: !!share, klip_sha256: sha256File(req.file.filename), tujuan: 'analisis deskriptif; hapus kapan saja; otomatis dihapus setelah ' + ATTEMPT_TTL_DAYS + ' hari' } });
      touchProgress.run(req.user.id, u.id);
      schedule('attempt', id);
      scheduleMedia('attempt', id);
      res.status(201).json({ id });
    } catch (e) { if (req.file) rmFile(req.file.filename); throw e; }
  });
  app.get('/api/me/attempts', needAuth, (req, res) => {
    res.json({ attempts: db.prepare(`SELECT a.id,a.unit_id,a.status,a.created_at,a.share_with_maestro,a.duration_s,u.title_id,u.title_sby FROM attempts a JOIN units u ON u.id=a.unit_id WHERE a.user_id=? ORDER BY a.id DESC LIMIT 100`).all(req.user.id) });
  });
  app.get('/api/units/:id/attempts', needMaestro, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    res.json({ attempts: db.prepare(`SELECT a.id,a.status,a.created_at,us.name learner FROM attempts a JOIN users us ON us.id=a.user_id WHERE a.unit_id=? AND a.share_with_maestro=1 ORDER BY a.id DESC LIMIT 100`).all(u.id) });
  });
  app.get('/api/attempts/:id', needAuth, (req, res) => {
    const a = attemptRow(Number(req.params.id));
    if (!canSeeAttempt(req.user, a)) throw new HttpError(403, 'Latihan ini bukan milik Anda');
    const an = parse(a.analysis);
    const own = a.user_id === req.user.id;
    res.json({ attempt: { id: a.id, unit_id: a.unit_id, status: a.status, error: a.error, created_at: a.created_at, share_with_maestro: !!a.share_with_maestro, is_video: hasVideo(a), is_owner: own, duration_s: a.duration_s,
        track_id: a.track_id, self_note: own ? a.self_note : '' },
      analysis: summary(an), comparison: parse(a.comparison), timeline: (an && an.pose && an.pose.timeline) || [],
      alignment: an && an.alignment ? an.alignment : null,
      persons: own && an && an.persons ? { count_median: an.persons.count_median, selected: an.persons.selected, tracks: thinTracks(an.persons.tracks) } : null });
  });
  app.get('/api/attempts/:id/clip', needAuth, (req, res) => {
    const a = attemptRow(Number(req.params.id));
    if (!canSeeAttempt(req.user, a)) throw new HttpError(403, 'Latihan ini bukan milik Anda');
    if (!a.file_path) throw new HttpError(404, 'Klip sudah dihapus');
    sendClip(res, a);
  });
  app.post('/api/attempts/:id/share', needAuth, (req, res) => {
    const a = attemptRow(Number(req.params.id));
    if (a.user_id !== req.user.id) throw new HttpError(403, 'Hanya pemilik latihan');
    const v = truthy(req.body.share) ? 1 : 0;
    db.prepare('UPDATE attempts SET share_with_maestro=? WHERE id=?').run(v, a.id);
    ledger.append({ actor: req.user, action: v ? 'berbagi_ke_maestro' : 'berbagi_dicabut', subject: `latihan:${a.id}`, payload: {} });
    res.json({ ok: true });
  });
  app.patch('/api/attempts/:id', needAuth, (req, res) => {
    const a = attemptRow(Number(req.params.id));
    if (a.user_id !== req.user.id) throw new HttpError(403, 'Hanya pemilik latihan');
    db.prepare('UPDATE attempts SET self_note=? WHERE id=?').run(optStr(req.body.self_note, 'Catatan diri', 1000), a.id);
    res.json({ ok: true });
  });
  app.delete('/api/attempts/:id', needAuth, (req, res) => {
    const a = attemptRow(Number(req.params.id));
    if (a.user_id !== req.user.id) throw new HttpError(403, 'Hanya pemilik latihan');
    db.prepare('DELETE FROM attempts WHERE id=?').run(a.id);
    clipFiles(a).forEach(rmFile);
    ledger.append({ actor: req.user, action: 'latihan_dihapus', subject: `latihan:${a.id}`, payload: {} });
    res.json({ ok: true });
  });
  function purgeOld() {
    const cutoff = new Date(now().getTime() - ATTEMPT_TTL_DAYS * 86400000).toISOString().replace('T', ' ').slice(0, 19);
    const old = db.prepare('SELECT id,file_path,play_path FROM attempts WHERE created_at < ?').all(cutoff);
    for (const a of old) { db.prepare('DELETE FROM attempts WHERE id=?').run(a.id); clipFiles(a).forEach(rmFile); ledger.append({ actor: null, action: 'latihan_dihapus_otomatis', subject: `latihan:${a.id}`, payload: { alasan: `lewat ${ATTEMPT_TTL_DAYS} hari` } }); }
    return old.length;
  }
  app.locals.purgeOld = purgeOld;

  // ---------- pencarian bersumber (retrieval-first) ----------
  app.get('/api/search', (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 120);
    if (q.length < 2) return res.json({ q, results: [], note: 'Ketik minimal 2 huruf.' });
    const terms = q.split(/[^\p{L}\p{N}]+/u).filter((t) => t.length >= 2).slice(0, 8);
    if (!terms.length) return res.json({ q, results: [] });
    const match = terms.map((t) => `"${t.replace(/"/g, '')}"*`).join(' OR ');
    let rows = [];
    try {
      rows = db.prepare(`SELECT f.kind, f.ref_id, bm25(search_fts) rank, f.t_sec start_sec, f.text_sby, f.text_id, u.id unit_id, u.title_id, u.title_sby, u.access, m.name maestro
        FROM search_fts f JOIN units u ON u.id=f.unit_id JOIN users m ON m.id=u.maestro_id
        WHERE search_fts MATCH ? AND u.status='validated' ORDER BY rank LIMIT 24`).all(match);
    } catch { rows = []; }
    rows = rows.filter((r) => r.access === 'public' || req.user);
    res.json({ q, results: rows.map((r) => ({ kind: r.kind, unit_id: r.unit_id, unit_title_id: r.title_id, unit_title_sby: r.title_sby, maestro: r.maestro, start_sec: r.start_sec,
      text_sby: r.text_sby, text_id: r.text_id, citation: `${r.maestro}, "${r.title_id}", menit ${mmss(r.start_sec)}` })),
    note: 'Hasil hanya berupa kutipan dari segmen dan momen yang disahkan maestro; tidak ada jawaban yang dibangkitkan.' });
  });

  // ---------- buku jejak ----------
  // Buku jejak terbuka untuk dibaca siapa pun (transparansi), tetapi nama pihak yang memberi izin dan lingkup izin hanya untuk admin.
  const LEDGER_PRIVATE = ['consent_holder', 'scope'];
  app.get('/api/ledger', (req, res) => {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const admin = !!req.user && req.user.role === 'admin';
    const rows = db.prepare('SELECT seq,ts,actor_label,action,subject,payload,hash FROM ledger ORDER BY seq DESC LIMIT ?').all(limit);
    res.json({ entries: rows.map((r) => { const p = parse(r.payload); if (!admin && p) for (const k of LEDGER_PRIVATE) delete p[k]; return { ...r, payload: p }; }), redacted: !admin });
  });
  app.get('/api/ledger/verify', (req, res) => res.json(ledger.verify()));

  // ---------- modul rute lain ----------
  const thinTracks = (tracks = []) => tracks.slice(0, 8).map((t) => ({ id: t.id, n: t.n, first_t: t.first_t, last_t: t.last_t, mean_area: t.mean_area,
    boxes: t.boxes.filter((_, i) => i % Math.max(1, Math.floor(t.boxes.length / 40)) === 0) }));
  const ctx = { app, db, ledger, now, uploadDir, secret, M, analyze, media, asr, ai, upload, uploadOne, needAuth, needMaestro, needAdmin, unitRow, seeUnit, mustSee, mustOwn, isOwner, publicUnit,
    rubricOf, markersOf, readiness, schedule, reopen, reindex, rmFile, absPath, sha256File, thinTracks, summary, attemptRow, canSeeAttempt, limited, isVideo, hasVideo, clipFiles };
  require('./routes/markers')(ctx);
  require('./routes/persons')(ctx);
  require('./routes/captions')(ctx);
  require('./routes/classes')(ctx);
  require('./routes/glossary')(ctx);
  require('./routes/progress')(ctx);
  require('./routes/admin')(ctx);

  // ---------- static ----------
  app.use('/api', (req, res, next) => next(new HttpError(404, 'Endpoint tidak ditemukan')));
  app.use(express.static(publicDir, { maxAge: 0, extensions: ['html'] }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message });
    if (err && err.name === 'MulterError') return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Berkas terlalu besar (maks 60 MB)' : 'Unggahan tidak valid' });
    if (err && err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON tidak valid' });
    if (err && err.code && String(err.code).startsWith('SQLITE_CONSTRAINT')) return res.status(409).json({ error: 'Data bertentangan dengan aturan basis data' });
    if (err && typeof err.status === 'number' && err.status < 600 && err.status !== 500) return res.status(err.status).json({ error: err.message });
    console.error(err);
    return res.status(500).json({ error: 'Terjadi kesalahan di server' });
  });
  return app;
}
module.exports = { createApp, HttpError, APP_NAME, APP_VERSION, FIRST_BUILD, DEMO };
