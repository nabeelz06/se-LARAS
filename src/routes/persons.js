'use strict';
/**
 * Memilih penampil utama di antara beberapa orang pada video (detektor YOLOX + pelacak). Tanpa pilihan, ukuran gerak mengikuti
 * jejak terbesar, yang pada panggung ramai belum tentu tokoh yang dimaksud. Pilihan memicu analisis ulang.
 */
const { HttpError, bad, parse } = require('../http');

module.exports = function persons(ctx) {
  const { app, db, ledger, media, needAuth, needMaestro, unitRow, mustOwn, schedule, reopen, absPath, attemptRow, thinTracks, hasVideo } = ctx;

  const personsOf = (analysisJson) => {
    const a = parse(analysisJson);
    return a && a.persons && Array.isArray(a.persons.tracks) ? a.persons : null;
  };
  const view = (p, chosen) => ({ count_median: p ? p.count_median : 0, selected: p ? p.selected : null, chosen: chosen || null, tracks: p ? thinTracks(p.tracks) : [] });
  const needFloat = (v, name, max) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > max) throw bad(`${name} tidak valid`);
    return n;
  };
  async function sendFrame(res, row, t) {
    if (!row.file_path) throw new HttpError(404, 'Berkas tidak ditemukan');
    if (!hasVideo(row)) throw bad('Klip ini hanya berisi suara');
    const buf = await media.frame(absPath(row.file_path), needFloat(t == null ? 0 : t, 'Waktu', 7200), 640);
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=300' });
    res.send(buf);
  }

  // --- unit (maestro) ---
  app.get('/api/units/:id/persons', needMaestro, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    res.json(view(personsOf(u.analysis), u.performer_track));
  });
  app.get('/api/units/:id/frame', needMaestro, async (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    await sendFrame(res, u, req.query.t);
  });
  app.post('/api/units/:id/performer', needMaestro, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustOwn(req, u);
    if (u.analysis_status === 'running') throw new HttpError(409, 'Analisis sedang berjalan; tunggu selesai dulu');
    const p = personsOf(u.analysis);
    const id = Number(req.body && req.body.track_id);
    if (!p || !p.tracks.some((t) => t.id === id)) throw bad('Jejak orang tidak ditemukan pada klip ini');
    db.prepare('UPDATE units SET performer_track=? WHERE id=?').run(id, u.id);
    ledger.append({ actor: req.user, action: 'penampil_dipilih', subject: `unit:${u.id}`, payload: { track_id: id, orang_terdeteksi: p.count_median } });
    reopen(req, u, 'penampil utama diubah');
    schedule('unit', u.id);
    res.json({ ok: true });
  });

  // --- latihan (pelajar sendiri) ---
  const own = (req) => {
    const a = attemptRow(Number(req.params.id));
    if (a.user_id !== req.user.id) throw new HttpError(403, 'Hanya pemilik latihan');
    return a;
  };
  app.get('/api/attempts/:id/frame', needAuth, async (req, res) => { await sendFrame(res, own(req), req.query.t); });
  app.post('/api/attempts/:id/performer', needAuth, (req, res) => {
    const a = own(req);
    if (a.status === 'running') throw new HttpError(409, 'Analisis sedang berjalan; tunggu selesai dulu');
    const p = personsOf(a.analysis);
    const id = Number(req.body && req.body.track_id);
    if (!p || !p.tracks.some((t) => t.id === id)) throw bad('Jejak orang tidak ditemukan pada klip ini');
    db.prepare('UPDATE attempts SET track_id=? WHERE id=?').run(id, a.id);
    schedule('attempt', a.id);
    res.json({ ok: true });
  });
};
