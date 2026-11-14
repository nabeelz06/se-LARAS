'use strict';
/**
 * Momen: penanda waktu pada klip acuan beserta penjelasan maestro ("kenapa"). Usulan otomatis (jeda panjang, puncak gerak)
 * hanya berstatus draf; momen baru tampil ke pelajar setelah maestro menulis penjelasannya lalu mengesahkannya.
 */
const { HttpError, bad, reqStr, optStr, num, oneOf } = require('../http');

module.exports = function markers(ctx) {
  const { app, db, ledger, needMaestro, unitRow, mustOwn, reopen, reindex } = ctx;
  const KINDS = ['jeda', 'gerak', 'lain'];
  const MAX_PER_UNIT = 60;
  const row = (id) => {
    const m = db.prepare('SELECT m.*, u.maestro_id, u.duration_s FROM markers m JOIN units u ON u.id=m.unit_id WHERE m.id=?').get(id);
    if (!m) throw new HttpError(404, 'Momen tidak ditemukan');
    return m;
  };
  const tmax = (u) => (u.duration_s ? u.duration_s + 0.5 : 7200);

  app.post('/api/units/:id/markers', needMaestro, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    const b = req.body || {};
    if (db.prepare('SELECT COUNT(*) n FROM markers WHERE unit_id=?').get(u.id).n >= MAX_PER_UNIT) throw bad(`Maksimal ${MAX_PER_UNIT} momen per unit`);
    const t = num(b.t_sec, 'Waktu (detik)', 0, tmax(u));
    const kind = b.kind == null ? 'lain' : oneOf(b.kind, KINDS, 'Jenis');
    const title_id = reqStr(b.title_id, 'Judul momen (Indonesia)', 2, 120);
    const id = db.prepare("INSERT INTO markers(unit_id,t_sec,kind,title_sby,title_id,why_sby,why_id,status,source) VALUES(?,?,?,?,?,?,?,'draft_human','manual')")
      .run(u.id, t, kind, optStr(b.title_sby, 'Judul momen (Suroboyoan)', 120), title_id, optStr(b.why_sby, 'Penjelasan (Suroboyoan)', 800), optStr(b.why_id, 'Penjelasan (Indonesia)', 800)).lastInsertRowid;
    res.status(201).json({ id });
  });

  app.patch('/api/markers/:id', needMaestro, (req, res) => {
    const m = row(Number(req.params.id)); mustOwn(req, { maestro_id: m.maestro_id });
    const b = req.body || {};
    const t = b.t_sec == null ? m.t_sec : num(b.t_sec, 'Waktu (detik)', 0, tmax(m));
    const kind = b.kind == null ? m.kind : oneOf(b.kind, KINDS, 'Jenis');
    // Menyunting momen mengembalikannya ke draf: pengesahan berlaku untuk isi yang sudah dibaca maestro, bukan isi sesudah diubah.
    db.prepare("UPDATE markers SET t_sec=?, kind=?, title_sby=?, title_id=?, why_sby=?, why_id=?, status='draft_human', validated_by=NULL, validated_at=NULL WHERE id=?").run(
      t, kind, b.title_sby != null ? optStr(b.title_sby, 'Judul momen (Suroboyoan)', 120) : m.title_sby, b.title_id != null ? reqStr(b.title_id, 'Judul momen (Indonesia)', 2, 120) : m.title_id,
      b.why_sby != null ? optStr(b.why_sby, 'Penjelasan (Suroboyoan)', 800) : m.why_sby, b.why_id != null ? optStr(b.why_id, 'Penjelasan (Indonesia)', 800) : m.why_id, m.id);
    if (m.status === 'validated') reopen(req, unitRow(m.unit_id), 'momen diubah');   // hanya momen yang sudah terlihat pelajar yang membuka kembali unit
    reindex(m.unit_id);
    res.json({ ok: true });
  });

  app.delete('/api/markers/:id', needMaestro, (req, res) => {
    const m = row(Number(req.params.id)); mustOwn(req, { maestro_id: m.maestro_id });
    db.prepare('DELETE FROM markers WHERE id=?').run(m.id);
    if (m.status === 'validated') reopen(req, unitRow(m.unit_id), 'momen dihapus');
    reindex(m.unit_id);
    res.json({ ok: true });
  });

  app.post('/api/markers/:id/validate', needMaestro, (req, res) => {
    const m = row(Number(req.params.id)); mustOwn(req, { maestro_id: m.maestro_id });
    if (!m.title_id.trim()) throw bad('Judul momen (Indonesia) harus diisi sebelum disahkan');
    if (!m.why_id.trim() && !m.why_sby.trim()) throw bad('Tulis penjelasan maestro ("kenapa") sebelum mengesahkan momen; ukuran otomatis saja belum pengetahuan');
    db.prepare("UPDATE markers SET status='validated', validated_by=?, validated_at=datetime('now') WHERE id=?").run(req.user.id, m.id);
    ledger.append({ actor: req.user, action: 'momen_disahkan', subject: `momen:${m.id}`, payload: { unit: m.unit_id, t_sec: m.t_sec, sumber: m.source } });
    reindex(m.unit_id);
    res.json({ ok: true });
  });
};
