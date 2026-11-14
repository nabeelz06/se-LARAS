'use strict';
/**
 * Glosarium istilah Ludruk/Suroboyoan. Dua dasar entri:
 *  - 'pustaka': dirangkum dari rujukan bersumber (tampil dengan label "belum disahkan maestro" sampai maestro mengesahkan);
 *  - 'maestro': ditulis maestro/praktisi sendiri.
 * Teks Suroboyoan pada entri adalah DRAF sampai disahkan penutur asli.
 */
const fs = require('fs');
const path = require('path');
const { HttpError, bad, reqStr, optStr, oneOf } = require('../http');

const KINDS = ['istilah', 'ungkapan', 'panggilan', 'alat', 'lakon'];
const SEED_FILE = path.join(__dirname, '..', '..', 'seed', 'glossary.json');

/** Masukkan entri bawaan (bersumber) bila belum ada. Mengembalikan jumlah yang ditambahkan. */
function loadGlossarySeed(db, file = SEED_FILE) {
  if (!fs.existsSync(file)) return 0;
  const items = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ins = db.prepare("INSERT OR IGNORE INTO glossary(term_sby,term_id,kind,def_sby,def_id,example_sby,example_id,source_label,source_url,basis,status) VALUES(?,?,?,?,?,?,?,?,?,'pustaka','draft')");
  let n = 0;
  db.transaction(() => {
    for (const g of items) {
      if (!g.term_sby || !g.def_id || !g.source_label) continue; // entri tanpa sumber tidak dimuat
      n += ins.run(g.term_sby, g.term_id || '', KINDS.includes(g.kind) ? g.kind : 'istilah', g.def_sby || '', g.def_id, g.example_sby || '', g.example_id || '', g.source_label, g.source_url || '').changes;
    }
  })();
  return n;
}

module.exports = function glossary(ctx) {
  const { app, db, ledger, needMaestro } = ctx;
  const isStaff = (u) => !!u && (u.role === 'maestro' || u.role === 'admin');
  const view = (g) => ({ id: g.id, term_sby: g.term_sby, term_id: g.term_id, kind: g.kind, def_sby: g.def_sby, def_id: g.def_id, example_sby: g.example_sby, example_id: g.example_id,
    source_label: g.source_label, source_url: g.source_url, basis: g.basis, validated: g.status === 'validated', is_demo: !!g.is_demo });

  app.get('/api/glossary', (req, res) => {
    const q = String(req.query.q || '').trim().slice(0, 60).toLowerCase();
    const kind = KINDS.includes(req.query.kind) ? req.query.kind : null;
    const rows = db.prepare(`SELECT * FROM glossary WHERE (status='validated' OR basis='pustaka' ${isStaff(req.user) ? "OR 1=1" : ''}) ORDER BY lower(term_sby)`).all()
      .filter((g) => (!kind || g.kind === kind) && (!q || `${g.term_sby} ${g.term_id} ${g.def_id} ${g.def_sby}`.toLowerCase().includes(q)));
    res.json({ terms: rows.map(view), note: 'Entri berlabel "belum disahkan maestro" bersumber dari pustaka dan menunggu pengesahan; teks Suroboyoan berstatus draf.' });
  });

  const fields = (b, cur = {}) => ({
    term_sby: b.term_sby != null ? reqStr(b.term_sby, 'Istilah', 1, 80) : cur.term_sby, term_id: b.term_id != null ? optStr(b.term_id, 'Padanan Indonesia', 120) : cur.term_id || '',
    kind: b.kind != null ? oneOf(b.kind, KINDS, 'Jenis') : cur.kind || 'istilah',
    def_sby: b.def_sby != null ? optStr(b.def_sby, 'Arti (Suroboyoan)', 600) : cur.def_sby || '', def_id: b.def_id != null ? reqStr(b.def_id, 'Arti (Indonesia)', 3, 600) : cur.def_id,
    example_sby: b.example_sby != null ? optStr(b.example_sby, 'Contoh (Suroboyoan)', 300) : cur.example_sby || '', example_id: b.example_id != null ? optStr(b.example_id, 'Contoh (Indonesia)', 300) : cur.example_id || '',
  });
  app.post('/api/glossary', needMaestro, (req, res) => {
    const f = fields(req.body || {});
    if (!f.def_id) throw bad('Arti (Indonesia) wajib diisi');
    if (db.prepare('SELECT 1 FROM glossary WHERE lower(term_sby)=lower(?)').get(f.term_sby)) throw new HttpError(409, 'Istilah itu sudah ada');
    const id = db.prepare("INSERT INTO glossary(term_sby,term_id,kind,def_sby,def_id,example_sby,example_id,basis,status,added_by) VALUES(?,?,?,?,?,?,?,'maestro','draft',?)")
      .run(f.term_sby, f.term_id, f.kind, f.def_sby, f.def_id, f.example_sby, f.example_id, req.user.id).lastInsertRowid;
    res.status(201).json({ id });
  });
  const row = (id) => { const g = db.prepare('SELECT * FROM glossary WHERE id=?').get(id); if (!g) throw new HttpError(404, 'Istilah tidak ditemukan'); return g; };
  app.patch('/api/glossary/:id', needMaestro, (req, res) => {
    const g = row(Number(req.params.id));
    const f = fields(req.body || {}, g);
    if (f.term_sby.toLowerCase() !== g.term_sby.toLowerCase() && db.prepare('SELECT 1 FROM glossary WHERE lower(term_sby)=lower(?)').get(f.term_sby)) throw new HttpError(409, 'Istilah itu sudah ada');
    db.prepare("UPDATE glossary SET term_sby=?,term_id=?,kind=?,def_sby=?,def_id=?,example_sby=?,example_id=?,status='draft',validated_by=NULL,validated_at=NULL WHERE id=?")
      .run(f.term_sby, f.term_id, f.kind, f.def_sby, f.def_id, f.example_sby, f.example_id, g.id);
    res.json({ ok: true });
  });
  app.post('/api/glossary/:id/validate', needMaestro, (req, res) => {
    const g = row(Number(req.params.id));
    if (!g.def_id.trim()) throw bad('Arti (Indonesia) harus diisi sebelum disahkan');
    db.prepare("UPDATE glossary SET status='validated', validated_by=?, validated_at=datetime('now') WHERE id=?").run(req.user.id, g.id);
    ledger.append({ actor: req.user, action: 'istilah_disahkan', subject: `istilah:${g.id}`, payload: { istilah: g.term_sby, dasar: g.basis } });
    res.json({ ok: true });
  });
  app.delete('/api/glossary/:id', needMaestro, (req, res) => {
    const g = row(Number(req.params.id));
    if (req.user.role !== 'admin' && g.added_by !== req.user.id) throw new HttpError(403, 'Hanya penambah entri atau admin');
    db.prepare('DELETE FROM glossary WHERE id=?').run(g.id);
    res.json({ ok: true });
  });
};
module.exports.loadGlossarySeed = loadGlossarySeed;
