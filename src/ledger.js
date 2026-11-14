'use strict';
/**
 * Buku jejak berantai-hash (append-only) untuk persetujuan dan pengesahan.
 * Menjamin KETAHANAN-TERHADAP-PERUBAHAN: mengubah/menghapus entri lama memutus rantai dan terdeteksi.
 * Bukan tanda tangan digital maestro: tanda HMAC dibuat server; yang mengesahkan adalah sesi login maestro.
 */
const crypto = require('crypto');

const canon = (o) => JSON.stringify(o, Object.keys(o).sort());
const sha = (s) => crypto.createHash('sha256').update(s).digest('hex');

function createLedger(db, secret, now = () => new Date()) {
  const last = db.prepare('SELECT seq,hash FROM ledger ORDER BY seq DESC LIMIT 1');
  const ins = db.prepare('INSERT INTO ledger(seq,ts,actor_id,actor_label,action,subject,payload,prev_hash,hash,sig) VALUES(?,?,?,?,?,?,?,?,?,?)');
  function body(e) {
    return canon({ seq: e.seq, ts: e.ts, actor_id: e.actor_id, actor_label: e.actor_label, action: e.action, subject: e.subject, payload: e.payload, prev_hash: e.prev_hash });
  }
  function append({ actor, action, subject, payload = {} }) {
    return db.transaction(() => {
      const l = last.get();
      const e = { seq: l ? l.seq + 1 : 1, ts: now().toISOString(), actor_id: actor ? actor.id : null,
        actor_label: actor ? `${actor.role}:${actor.role === 'learner' ? '#' + actor.id : actor.name}` : 'sistem',
        action, subject, payload: JSON.stringify(payload), prev_hash: l ? l.hash : '0'.repeat(64) };
      const hash = sha(body(e));
      const sig = crypto.createHmac('sha256', secret).update(hash).digest('hex');
      ins.run(e.seq, e.ts, e.actor_id, e.actor_label, e.action, e.subject, e.payload, e.prev_hash, hash, sig);
      return { seq: e.seq, hash };
    })();
  }
  function verify() {
    const rows = db.prepare('SELECT * FROM ledger ORDER BY seq').all();
    let prev = '0'.repeat(64);
    for (const r of rows) {
      if (r.prev_hash !== prev) return { ok: false, count: rows.length, broken_at: r.seq, reason: 'rantai putus' };
      if (sha(body(r)) !== r.hash) return { ok: false, count: rows.length, broken_at: r.seq, reason: 'isi entri berubah' };
      const sig = crypto.createHmac('sha256', secret).update(r.hash).digest('hex');
      if (sig !== r.sig) return { ok: false, count: rows.length, broken_at: r.seq, reason: 'tanda server tidak cocok' };
      prev = r.hash;
    }
    return { ok: true, count: rows.length, head: prev };
  }
  return { append, verify };
}
module.exports = { createLedger };
