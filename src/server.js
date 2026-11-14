'use strict';
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const { openDb } = require('./db');
const { createApp, APP_NAME, APP_VERSION } = require('./app');
const { createAi } = require('./ai');
const { createAnalyzer } = require('./analysis');
const { createMedia } = require('./media');
const { createAsr } = require('./asr');
const { loadGlossarySeed } = require('./routes/glossary');

const env = process.env;
const root = path.join(__dirname, '..');
const dataDir = path.resolve(env.DATA_DIR || path.join(root, 'data'));
let secret = env.SESSION_SECRET;
if (!secret) {
  if (env.NODE_ENV === 'production') { console.error('SESSION_SECRET wajib diisi (minimal 16 karakter) saat NODE_ENV=production'); process.exit(1); }
  secret = crypto.randomBytes(32).toString('hex');
  console.warn('[peringatan] SESSION_SECRET kosong: rahasia sementara dipakai; sesi masuk DAN tanda buku jejak tidak bisa diverifikasi setelah restart. Isi SESSION_SECRET.');
}
for (const bin of [env.FFPROBE || 'ffprobe', env.FFMPEG || 'ffmpeg']) {
  const r = spawnSync(bin, ['-version'], { stdio: 'ignore' });
  if (r.error || r.status !== 0) { console.error(`[galat] ${bin} tidak ditemukan: unggahan klip akan ditolak. Pasang ffmpeg (lihat README).`); if (env.NODE_ENV === 'production') process.exit(1); }
}
const db = openDb(path.join(dataDir, 'laras.db'));
const seeded = loadGlossarySeed(db);
if (seeded) console.log(`Glosarium: ${seeded} entri bawaan (bersumber, belum disahkan maestro) dimuat.`);
const asr = createAsr();
const app = createApp({
  db, ai: createAi(), analyze: createAnalyzer(), media: createMedia(), asr, secret, uploadDir: path.join(dataDir, 'uploads'),
  adminEmails: (env.ADMIN_EMAILS || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean), secureCookies: env.SECURE_COOKIES === '1',
  authLimit: Number(env.AUTH_LIMIT) > 0 ? Number(env.AUTH_LIMIT) : undefined, // batas percobaan masuk per jendela waktu; bawaan 10
});
const rec = app.locals.recovered;
if (rec && (rec.analisis_unit || rec.analisis_latihan || rec.salinan_putar || rec.salinan_putar_gagal)) {
  console.log(`Pemulihan: ${rec.analisis_unit} analisis unit, ${rec.analisis_latihan} analisis latihan, ${rec.salinan_putar} salinan putar dijadwalkan ulang (server sebelumnya berhenti saat pekerjaan berjalan).`);
}
app.locals.purgeOld();
setInterval(() => app.locals.purgeOld(), 6 * 3600 * 1000).unref();
const port = Number(env.PORT || 3000);
const server = app.listen(port, () => console.log(`${APP_NAME} ${APP_VERSION} berjalan di http://localhost:${port}${asr.enabled() ? ' (ASR opsional aktif)' : ''}`));
const stop = () => server.close(() => { db.close(); process.exit(0); });
process.on('SIGINT', stop); process.on('SIGTERM', stop);
