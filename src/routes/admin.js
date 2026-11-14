'use strict';
/** Ringkasan operasional untuk admin dan pratinjau korpus riset. Tidak menampilkan isi rekaman atau data pribadi selain nama peran. */
const fs = require('fs');
const path = require('path');
const { buildManifest, datacard } = require('../dataset');

module.exports = function admin(ctx) {
  const { app, db, ledger, needAdmin, uploadDir, now } = ctx;
  function diskUse() {
    let bytes = 0, files = 0;
    try { for (const f of fs.readdirSync(uploadDir)) { const s = fs.statSync(path.join(uploadDir, f)); if (s.isFile()) { bytes += s.size; files += 1; } } } catch { /* direktori belum ada */ }
    return { bytes, files };
  }
  const group = (sql) => Object.fromEntries(db.prepare(sql).all().map((r) => [r.k, r.n]));

  app.get('/api/admin/overview', needAdmin, (req, res) => {
    res.json({
      generated_at: now().toISOString(), schema_version: db.pragma('user_version', { simple: true }),
      users: group('SELECT role k, COUNT(*) n FROM users GROUP BY role'), units: group('SELECT status k, COUNT(*) n FROM units GROUP BY status'),
      units_demo: db.prepare('SELECT COUNT(*) n FROM units WHERE is_demo=1').get().n,
      analysis: group('SELECT analysis_status k, COUNT(*) n FROM units WHERE file_path IS NOT NULL GROUP BY analysis_status'),
      attempts: group('SELECT status k, COUNT(*) n FROM attempts GROUP BY status'), media: group("SELECT media_status k, COUNT(*) n FROM units WHERE file_path IS NOT NULL GROUP BY media_status"),
      failures: db.prepare("SELECT id,analysis_error error FROM units WHERE analysis_status='failed' ORDER BY id DESC LIMIT 10").all(),
      disk: diskUse(), ledger: ledger.verify(), classes: db.prepare('SELECT COUNT(*) n FROM classes').get().n,
      data_use_riset: db.prepare("SELECT COUNT(*) n FROM units WHERE data_use='riset' AND status='validated' AND is_demo=0").get().n,
    });
  });
  app.post('/api/admin/purge', needAdmin, (req, res) => res.json({ purged: ctx.app.locals.purgeOld() }));
  app.get('/api/admin/dataset', needAdmin, (req, res) => {
    const m = buildManifest(db, { uploadDir, now });
    res.json({ generated_at: m.generated_at, totals: m.totals, skipped: m.skipped, units: m.items.map((i) => ({ unit_id: i.unit_id, speaker_key: i.speaker_key, title_id: i.title_id, duration_s: i.duration_s, segments: i.segments.length, markers: i.markers.length })) });
  });
  app.get('/api/admin/datacard', needAdmin, (req, res) => {
    res.set({ 'Content-Type': 'text/markdown; charset=utf-8', 'Cache-Control': 'no-store' });
    res.send(datacard(buildManifest(db, { uploadDir, now })));
  });
};
