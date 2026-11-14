'use strict';
/**
 * Jalur belajar per unit: Nyebeng (mengamati) -> Tedean (mencoba) -> Ngelmu (memahami).
 * Rancangan tim: rujukan akademik untuk urutan langkah ini TIDAK tercatat di repositori (docs/DAFTAR_VERIFIKASI.md) dan BELUM disahkan maestro.
 * Hanya tanggal dan hitungan yang disimpan;
 * tedean bertambah otomatis tiap unggah latihan, ngelmu hanya bisa ditandai setelah nyebeng dan minimal satu tedean.
 */
const { HttpError, bad, oneOf } = require('../http');

module.exports = function progress(ctx) {
  const { app, db, needAuth, unitRow, mustSee, ledger } = ctx;
  const STEPS = ['nyebeng', 'ngelmu'];
  const getP = (uid, unit) => db.prepare('SELECT nyebeng_at,tedean_at,tedean_n,ngelmu_at FROM unit_progress WHERE user_id=? AND unit_id=?').get(uid, unit) || { nyebeng_at: null, tedean_at: null, tedean_n: 0, ngelmu_at: null };

  app.get('/api/units/:id/progress', needAuth, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustSee(req, u);
    res.json({ progress: getP(req.user.id, u.id) });
  });
  app.post('/api/units/:id/progress', needAuth, (req, res) => {
    const u = unitRow(Number(req.params.id)); mustSee(req, u);
    if (u.status !== 'validated') throw new HttpError(409, 'Unit ini belum disahkan maestro');
    const step = oneOf(req.body && req.body.step, STEPS, 'step');
    const cur = getP(req.user.id, u.id);
    if (step === 'ngelmu') {
      if (!cur.nyebeng_at) throw bad('Tandai "nyebeng" dulu (amati contoh maestro)');
      if (!cur.tedean_n) throw bad('Coba dulu sekali (tedean): unggah satu latihan, baru tandai "ngelmu"');
    }
    db.prepare(`INSERT INTO unit_progress(user_id,unit_id,${step}_at) VALUES(?,?,datetime('now')) ON CONFLICT(user_id,unit_id) DO UPDATE SET ${step}_at=COALESCE(${step}_at,datetime('now'))`).run(req.user.id, u.id);
    res.json({ progress: getP(req.user.id, u.id) });
  });
  app.delete('/api/units/:id/progress', needAuth, (req, res) => {
    const u = unitRow(Number(req.params.id));
    db.prepare('DELETE FROM unit_progress WHERE user_id=? AND unit_id=?').run(req.user.id, u.id);
    res.json({ ok: true });
  });

  app.get('/api/me/progress', needAuth, (req, res) => {
    const rows = db.prepare(`SELECT u.id unit_id,u.title_id,u.title_sby,u.skill,m.name maestro,p.nyebeng_at,p.tedean_at,p.tedean_n,p.ngelmu_at
      FROM unit_progress p JOIN units u ON u.id=p.unit_id JOIN users m ON m.id=u.maestro_id WHERE p.user_id=? AND u.status='validated'
      ORDER BY COALESCE(p.ngelmu_at,p.tedean_at,p.nyebeng_at) DESC`).all(req.user.id);
    const total = db.prepare("SELECT COUNT(*) n FROM units WHERE status='validated'").get().n;
    res.json({ units: rows, totals: { available: total, nyebeng: rows.filter((r) => r.nyebeng_at).length, tedean: rows.filter((r) => r.tedean_n > 0).length, ngelmu: rows.filter((r) => r.ngelmu_at).length } });
  });

  // Hak akses dan portabilitas data pribadi (UU 27/2022): salinan data akun dalam JSON. Berkas media diunduh lewat tautan klip.
  app.get('/api/me/export', needAuth, (req, res) => {
    const me = req.user.id;
    const out = {
      exported_at: ctx.now().toISOString(), user: db.prepare('SELECT id,email,name,role,consent_at,created_at FROM users WHERE id=?').get(me),
      profile: db.prepare('SELECT sanggar,region,bio FROM maestro_profiles WHERE user_id=?').get(me) || null,
      attempts: db.prepare('SELECT id,unit_id,status,share_with_maestro,duration_s,self_note,created_at,comparison FROM attempts WHERE user_id=?').all(me).map((a) => ({ ...a, comparison: a.comparison ? JSON.parse(a.comparison) : null })),
      progress: db.prepare('SELECT unit_id,nyebeng_at,tedean_at,tedean_n,ngelmu_at FROM unit_progress WHERE user_id=?').all(me),
      classes_joined: db.prepare('SELECT class_id,joined_at FROM class_members WHERE user_id=?').all(me),
      classes_owned: db.prepare('SELECT id,name,description,created_at FROM classes WHERE owner_id=?').all(me),
      units: db.prepare('SELECT id,title_sby,title_id,skill,notes_sby,notes_id,access,status,consent_holder,consent_date,consent_scope,data_use,duration_s,created_at,validated_at FROM units WHERE maestro_id=?').all(me),
      ledger_entries_about_me: db.prepare('SELECT seq,ts,action,subject FROM ledger WHERE actor_id=? ORDER BY seq').all(me),
    };
    for (const u of out.units) {
      u.segments = db.prepare('SELECT start_sec,end_sec,text_sby,text_id,status FROM segments WHERE unit_id=? ORDER BY start_sec,seq').all(u.id);
      u.markers = db.prepare('SELECT t_sec,kind,title_sby,title_id,why_sby,why_id,status FROM markers WHERE unit_id=? ORDER BY t_sec').all(u.id);
      u.rubric = db.prepare('SELECT metric,label_sby,label_id,tolerance_pct FROM rubric_dims WHERE unit_id=?').all(u.id);
    }
    ledger.append({ actor: req.user, action: 'data_diekspor_pemilik', subject: `user:${me}`, payload: {} });
    res.set({ 'Content-Disposition': 'attachment; filename="data-laras-saya.json"', 'Cache-Control': 'private, no-store' });
    res.json(out);
  });
};
