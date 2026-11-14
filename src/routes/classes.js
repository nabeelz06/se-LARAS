'use strict';
/**
 * Kelas: jalur belajar yang disusun satu maestro dari unit-unitnya, diikuti pelajar lewat kode gabung.
 * Persetujuan: dengan bergabung, pelajar mengizinkan pemilik kelas melihat catatan kemajuannya (nyebeng/tedean/ngelmu) pada unit di kelas itu.
 * Rekaman latihan tetap hanya terlihat bila pelajar sendiri membagikannya.
 */
const crypto = require('crypto');
const { HttpError, bad, reqStr, optStr, truthy, num } = require('../http');

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // tanpa 0/O/1/I agar mudah dibaca
const newCode = () => Array.from({ length: 6 }, () => ALPHABET[crypto.randomInt(ALPHABET.length)]).join('');

module.exports = function classes(ctx) {
  const { app, db, ledger, needAuth, needMaestro, unitRow, seeUnit, isOwner, limited, publicUnit } = ctx;

  const classOr404 = (id) => {
    const c = db.prepare('SELECT c.*, u.name owner_name FROM classes c JOIN users u ON u.id=c.owner_id WHERE c.id=?').get(id);
    if (!c) throw new HttpError(404, 'Kelas tidak ditemukan');
    return c;
  };
  const ownsClass = (user, c) => !!user && (user.id === c.owner_id || user.role === 'admin');
  const isMember = (user, c) => !!user && !!db.prepare('SELECT 1 FROM class_members WHERE class_id=? AND user_id=?').get(c.id, user.id);
  const mustOwnClass = (req, c) => { if (!ownsClass(req.user, c)) throw new HttpError(403, 'Hanya pemilik kelas'); };
  function uniqueCode() {
    for (let i = 0; i < 20; i++) { const c = newCode(); if (!db.prepare('SELECT 1 FROM classes WHERE join_code=?').get(c)) return c; }
    throw new HttpError(500, 'Gagal membuat kode kelas');
  }

  app.post('/api/classes', needMaestro, (req, res) => {
    const name = reqStr(req.body.name, 'Nama kelas', 3, 100);
    const description = optStr(req.body.description, 'Deskripsi', 600);
    if (db.prepare('SELECT COUNT(*) n FROM classes WHERE owner_id=? AND archived=0').get(req.user.id).n >= 30) throw bad('Maksimal 30 kelas aktif');
    const id = db.prepare('INSERT INTO classes(owner_id,name,description,join_code) VALUES(?,?,?,?)').run(req.user.id, name, description, uniqueCode()).lastInsertRowid;
    ledger.append({ actor: req.user, action: 'kelas_dibuat', subject: `kelas:${id}`, payload: { nama: name } });
    res.status(201).json({ id });
  });

  app.get('/api/classes', needAuth, (req, res) => {
    const owned = db.prepare(`SELECT c.id,c.name,c.description,c.join_code,c.archived,c.created_at,
      (SELECT COUNT(*) FROM class_members m WHERE m.class_id=c.id) members, (SELECT COUNT(*) FROM class_units cu WHERE cu.class_id=c.id) units
      FROM classes c WHERE c.owner_id=? ORDER BY c.archived, c.id DESC`).all(req.user.id);
    const joined = db.prepare(`SELECT c.id,c.name,c.description,c.archived,o.name owner_name,m.joined_at,
      (SELECT COUNT(*) FROM class_units cu JOIN units u ON u.id=cu.unit_id WHERE cu.class_id=c.id AND u.status='validated') units
      FROM class_members m JOIN classes c ON c.id=m.class_id JOIN users o ON o.id=c.owner_id WHERE m.user_id=? AND c.archived=0 ORDER BY m.joined_at DESC`).all(req.user.id);
    res.json({ owned, joined });
  });

  app.post('/api/classes/join', needAuth, (req, res) => {
    if (limited(req, `join${req.user.id}`)) throw new HttpError(429, 'Terlalu banyak percobaan kode, coba lagi nanti');
    const code = reqStr(req.body.code, 'Kode kelas', 4, 12).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!truthy(req.body.consent_progress)) throw bad('Setujui dulu bahwa maestro pemilik kelas boleh melihat catatan kemajuan Anda di kelas ini');
    const c = db.prepare('SELECT * FROM classes WHERE join_code=? AND archived=0').get(code);
    if (!c) throw new HttpError(404, 'Kode kelas tidak ditemukan');
    if (c.owner_id === req.user.id) throw bad('Ini kelas Anda sendiri');
    const r = db.prepare('INSERT OR IGNORE INTO class_members(class_id,user_id) VALUES(?,?)').run(c.id, req.user.id);
    if (r.changes) ledger.append({ actor: req.user, action: 'kelas_diikuti', subject: `kelas:${c.id}`, payload: { persetujuan: 'pemilik kelas boleh melihat catatan kemajuan di kelas ini' } });
    res.json({ id: c.id, already: !r.changes });
  });

  const progressOf = (uid, unitIds) => {
    const m = new Map();
    if (!unitIds.length) return m;
    const q = db.prepare(`SELECT unit_id,nyebeng_at,tedean_at,tedean_n,ngelmu_at FROM unit_progress WHERE user_id=? AND unit_id IN (${unitIds.map(() => '?').join(',')})`).all(uid, ...unitIds);
    q.forEach((r) => m.set(r.unit_id, r));
    return m;
  };

  app.get('/api/classes/:id', needAuth, (req, res) => {
    const c = classOr404(Number(req.params.id));
    const owner = ownsClass(req.user, c);
    if (!owner && !isMember(req.user, c)) throw new HttpError(403, 'Anda bukan anggota kelas ini');
    const rows = db.prepare('SELECT cu.unit_id,cu.position,cu.note FROM class_units cu WHERE cu.class_id=? ORDER BY cu.position,cu.unit_id').all(c.id);
    const units = rows.map((r) => ({ r, u: unitRow(r.unit_id) })).filter(({ u }) => (owner ? u.status !== 'withdrawn' : u.status === 'validated' && seeUnit(req.user, u)));
    const mine = progressOf(req.user.id, units.map(({ r }) => r.unit_id));
    const out = {
      class: { id: c.id, name: c.name, description: c.description, archived: !!c.archived, owner: { id: c.owner_id, name: c.owner_name }, is_owner: owner, ...(owner ? { join_code: c.join_code } : {}) },
      units: units.map(({ r, u }) => ({ position: r.position, note: r.note, unit: publicUnit(u, req.user), progress: mine.get(r.unit_id) || null })),
    };
    if (owner) {
      const members = db.prepare('SELECT m.user_id,us.name,m.joined_at FROM class_members m JOIN users us ON us.id=m.user_id WHERE m.class_id=? ORDER BY m.joined_at').all(c.id);
      const ids = rows.map((r) => r.unit_id);
      out.members = members.map((mb) => ({ ...mb, progress: [...progressOf(mb.user_id, ids).values()] }));
    }
    res.json(out);
  });

  app.patch('/api/classes/:id', needMaestro, (req, res) => {
    const c = classOr404(Number(req.params.id)); mustOwnClass(req, c);
    const b = req.body || {};
    db.prepare('UPDATE classes SET name=?, description=?, archived=? WHERE id=?').run(b.name != null ? reqStr(b.name, 'Nama kelas', 3, 100) : c.name,
      b.description != null ? optStr(b.description, 'Deskripsi', 600) : c.description, b.archived != null ? (truthy(b.archived) ? 1 : 0) : c.archived, c.id);
    res.json({ ok: true });
  });
  app.post('/api/classes/:id/code', needMaestro, (req, res) => {
    const c = classOr404(Number(req.params.id)); mustOwnClass(req, c);
    const code = uniqueCode();
    db.prepare('UPDATE classes SET join_code=? WHERE id=?').run(code, c.id);
    res.json({ join_code: code });
  });
  app.delete('/api/classes/:id', needMaestro, (req, res) => {
    const c = classOr404(Number(req.params.id)); mustOwnClass(req, c);
    db.prepare('DELETE FROM classes WHERE id=?').run(c.id);
    ledger.append({ actor: req.user, action: 'kelas_dihapus', subject: `kelas:${c.id}`, payload: {} });
    res.json({ ok: true });
  });

  app.post('/api/classes/:id/units', needMaestro, (req, res) => {
    const c = classOr404(Number(req.params.id)); mustOwnClass(req, c);
    const u = unitRow(Number(req.body.unit_id));
    if (u.status === 'withdrawn') throw bad('Unit sudah ditarik');
    if (!isOwner(req.user, u) && !(u.status === 'validated' && seeUnit(req.user, u))) throw new HttpError(403, 'Unit ini tidak bisa ditambahkan');
    const pos = req.body.position != null ? num(req.body.position, 'Urutan', 0, 999) : db.prepare('SELECT COALESCE(MAX(position)+1,0) n FROM class_units WHERE class_id=?').get(c.id).n;
    db.prepare('INSERT INTO class_units(class_id,unit_id,position,note) VALUES(?,?,?,?) ON CONFLICT(class_id,unit_id) DO UPDATE SET position=excluded.position, note=excluded.note').run(c.id, u.id, pos, optStr(req.body.note, 'Catatan', 400));
    res.status(201).json({ ok: true });
  });
  app.delete('/api/classes/:id/units/:unitId', needMaestro, (req, res) => {
    const c = classOr404(Number(req.params.id)); mustOwnClass(req, c);
    db.prepare('DELETE FROM class_units WHERE class_id=? AND unit_id=?').run(c.id, Number(req.params.unitId));
    res.json({ ok: true });
  });
  app.delete('/api/classes/:id/members/:userId', needMaestro, (req, res) => {
    const c = classOr404(Number(req.params.id)); mustOwnClass(req, c);
    db.prepare('DELETE FROM class_members WHERE class_id=? AND user_id=?').run(c.id, Number(req.params.userId));
    res.json({ ok: true });
  });
  app.delete('/api/classes/:id/membership', needAuth, (req, res) => {
    const c = classOr404(Number(req.params.id));
    db.prepare('DELETE FROM class_members WHERE class_id=? AND user_id=?').run(c.id, req.user.id);
    res.json({ ok: true });
  });
};
