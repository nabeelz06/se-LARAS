'use strict';
const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

const SCHEMA_V1 = `
CREATE TABLE IF NOT EXISTS users(
  id INTEGER PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL, password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'learner' CHECK(role IN ('learner','maestro','admin')),
  consent_at TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS maestro_profiles(
  user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  sanggar TEXT NOT NULL DEFAULT '', region TEXT NOT NULL DEFAULT 'Surabaya', bio TEXT NOT NULL DEFAULT '', is_demo INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS units(
  id INTEGER PRIMARY KEY, maestro_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title_sby TEXT NOT NULL, title_id TEXT NOT NULL, skill TEXT NOT NULL DEFAULT '',
  notes_sby TEXT NOT NULL DEFAULT '', notes_id TEXT NOT NULL DEFAULT '',
  access TEXT NOT NULL DEFAULT 'login' CHECK(access IN ('public','login')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','validated','withdrawn')),
  file_path TEXT, file_name TEXT, mime TEXT, size INTEGER,
  consent_holder TEXT NOT NULL, consent_date TEXT NOT NULL, consent_scope TEXT NOT NULL DEFAULT '',
  analysis TEXT, analysis_status TEXT NOT NULL DEFAULT 'pending' CHECK(analysis_status IN ('pending','running','done','failed')),
  analysis_error TEXT, is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')), validated_at TEXT);
CREATE TABLE IF NOT EXISTS segments(
  id INTEGER PRIMARY KEY, unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  seq INTEGER NOT NULL, start_sec REAL NOT NULL DEFAULT 0, text_sby TEXT NOT NULL, text_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft_human' CHECK(status IN ('draft_ai','draft_human','validated')),
  source TEXT NOT NULL DEFAULT 'manual', validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, validated_at TEXT);
CREATE VIRTUAL TABLE IF NOT EXISTS seg_fts USING fts5(text_sby, text_id, seg_id UNINDEXED, unit_id UNINDEXED, tokenize='unicode61 remove_diacritics 2');
CREATE TABLE IF NOT EXISTS rubric_dims(
  id INTEGER PRIMARY KEY, unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  metric TEXT NOT NULL, label_sby TEXT NOT NULL, label_id TEXT NOT NULL, hint_sby TEXT NOT NULL DEFAULT '', hint_id TEXT NOT NULL DEFAULT '',
  tolerance_pct REAL NOT NULL DEFAULT 25 CHECK(tolerance_pct BETWEEN 5 AND 100), UNIQUE(unit_id,metric));
CREATE TABLE IF NOT EXISTS attempts(
  id INTEGER PRIMARY KEY, unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  file_path TEXT, file_name TEXT, mime TEXT, size INTEGER, share_with_maestro INTEGER NOT NULL DEFAULT 0,
  analysis TEXT, comparison TEXT, status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','done','failed')),
  error TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS ledger(
  seq INTEGER PRIMARY KEY, ts TEXT NOT NULL, actor_id INTEGER, actor_label TEXT NOT NULL, action TEXT NOT NULL,
  subject TEXT NOT NULL, payload TEXT NOT NULL, prev_hash TEXT NOT NULL, hash TEXT NOT NULL, sig TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS ix_seg_unit ON segments(unit_id,seq);
CREATE INDEX IF NOT EXISTS ix_att_user ON attempts(user_id,id);
`;


const V2_SQL = `
ALTER TABLE units ADD COLUMN data_use TEXT NOT NULL DEFAULT 'tidak' CHECK(data_use IN ('tidak','riset'));
ALTER TABLE units ADD COLUMN performer_track INTEGER;
ALTER TABLE units ADD COLUMN duration_s REAL;
ALTER TABLE units ADD COLUMN media_info TEXT;
ALTER TABLE units ADD COLUMN play_path TEXT;
ALTER TABLE units ADD COLUMN play_mime TEXT;
ALTER TABLE units ADD COLUMN media_status TEXT NOT NULL DEFAULT 'none' CHECK(media_status IN ('none','pending','running','done','failed'));
ALTER TABLE units ADD COLUMN orig_sha256 TEXT;
ALTER TABLE segments ADD COLUMN end_sec REAL;
ALTER TABLE attempts ADD COLUMN track_id INTEGER;
ALTER TABLE attempts ADD COLUMN duration_s REAL;
ALTER TABLE attempts ADD COLUMN media_info TEXT;
ALTER TABLE attempts ADD COLUMN play_path TEXT;
ALTER TABLE attempts ADD COLUMN play_mime TEXT;
ALTER TABLE attempts ADD COLUMN self_note TEXT NOT NULL DEFAULT '';
CREATE TABLE IF NOT EXISTS markers(
  id INTEGER PRIMARY KEY, unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  t_sec REAL NOT NULL CHECK(t_sec>=0), kind TEXT NOT NULL DEFAULT 'lain' CHECK(kind IN ('jeda','gerak','lain')),
  title_sby TEXT NOT NULL DEFAULT '', title_id TEXT NOT NULL DEFAULT '', why_sby TEXT NOT NULL DEFAULT '', why_id TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft_human' CHECK(status IN ('draft_ai','draft_human','validated')),
  source TEXT NOT NULL DEFAULT 'manual', meta TEXT, validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, validated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE INDEX IF NOT EXISTS ix_markers_unit ON markers(unit_id,t_sec);
CREATE TABLE IF NOT EXISTS classes(
  id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', join_code TEXT NOT NULL UNIQUE, archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS class_members(
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  joined_at TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY(class_id,user_id));
CREATE TABLE IF NOT EXISTS class_units(
  class_id INTEGER NOT NULL REFERENCES classes(id) ON DELETE CASCADE, unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  position INTEGER NOT NULL DEFAULT 0, note TEXT NOT NULL DEFAULT '', PRIMARY KEY(class_id,unit_id));
CREATE TABLE IF NOT EXISTS glossary(
  id INTEGER PRIMARY KEY, term_sby TEXT NOT NULL UNIQUE, term_id TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'istilah' CHECK(kind IN ('istilah','ungkapan','panggilan','alat','lakon')),
  def_sby TEXT NOT NULL DEFAULT '', def_id TEXT NOT NULL DEFAULT '', example_sby TEXT NOT NULL DEFAULT '', example_id TEXT NOT NULL DEFAULT '',
  source_label TEXT NOT NULL DEFAULT '', source_url TEXT NOT NULL DEFAULT '', is_demo INTEGER NOT NULL DEFAULT 0,
  basis TEXT NOT NULL DEFAULT 'maestro' CHECK(basis IN ('maestro','pustaka')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft','validated')),
  added_by INTEGER REFERENCES users(id) ON DELETE SET NULL, validated_by INTEGER REFERENCES users(id) ON DELETE SET NULL, validated_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')));
CREATE TABLE IF NOT EXISTS unit_progress(
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, unit_id INTEGER NOT NULL REFERENCES units(id) ON DELETE CASCADE,
  nyebeng_at TEXT, tedean_at TEXT, tedean_n INTEGER NOT NULL DEFAULT 0, ngelmu_at TEXT, PRIMARY KEY(user_id,unit_id));
DROP TABLE IF EXISTS seg_fts;
CREATE VIRTUAL TABLE IF NOT EXISTS search_fts USING fts5(text_sby, text_id, kind UNINDEXED, ref_id UNINDEXED, unit_id UNINDEXED, t_sec UNINDEXED, tokenize='unicode61 remove_diacritics 2');
`;

/** Indeks pencarian satu unit: segmen dan momen yang SAH, hanya bila unitnya sah. */
function reindexUnit(db, uid) {
  db.prepare('DELETE FROM search_fts WHERE unit_id=?').run(uid);
  const u = db.prepare('SELECT status FROM units WHERE id=?').get(uid);
  if (!u || u.status !== 'validated') return;
  const ins = db.prepare('INSERT INTO search_fts(text_sby,text_id,kind,ref_id,unit_id,t_sec) VALUES(?,?,?,?,?,?)');
  for (const s of db.prepare("SELECT id,start_sec,text_sby,text_id FROM segments WHERE unit_id=? AND status='validated'").all(uid)) ins.run(s.text_sby, s.text_id, 'segmen', s.id, uid, s.start_sec);
  for (const m of db.prepare("SELECT id,t_sec,title_sby,title_id,why_sby,why_id FROM markers WHERE unit_id=? AND status='validated'").all(uid)) {
    ins.run(`${m.title_sby} ${m.why_sby}`.trim(), `${m.title_id} ${m.why_id}`.trim(), 'momen', m.id, uid, m.t_sec);
  }
}

// Setiap langkah dijalankan sekali dalam transaksi; nomor versi disimpan di PRAGMA user_version.
const MIGRATIONS = [
  (db) => db.exec(SCHEMA_V1),
  (db) => {
    db.exec(V2_SQL);
    for (const r of db.prepare("SELECT id FROM units WHERE status='validated'").all()) reindexUnit(db, r.id);
  },
];

function migrate(db) {
  let v = db.pragma('user_version', { simple: true });
  for (; v < MIGRATIONS.length; v++) {
    db.transaction(() => { MIGRATIONS[v](db); db.pragma(`user_version = ${v + 1}`); })();
  }
  return db.pragma('user_version', { simple: true });
}

function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}
module.exports = { openDb, migrate, reindexUnit, SCHEMA_V1, SCHEMA_VERSION: MIGRATIONS.length };
