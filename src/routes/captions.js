'use strict';
/** Takarir WebVTT dari segmen yang disahkan (pemilik juga boleh meminta draf). Satu berkas per bahasa agar pemutar bisa memilih. */
const { HttpError, bad } = require('../http');

const ts = (s) => {
  const ms = Math.max(0, Math.round(s * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, sec = Math.floor(ms / 1000) % 60, r = ms % 1000;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(r).padStart(3, '0')}`;
};
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\r?\n+/g, ' ').trim();

/** Segmen -> berkas WebVTT. Cue tidak saling tumpang: akhir = min(end_sec, awal segmen berikutnya); tanpa end_sec dipakai awal berikutnya atau 4 detik. */
function toVtt(segs, lang, durationS) {
  const out = ['WEBVTT', ''];
  const list = segs.filter((s) => (lang === 'id' ? s.text_id : s.text_sby)).sort((a, b) => a.start_sec - b.start_sec || a.seq - b.seq);
  list.forEach((s, i) => {
    const next = list[i + 1];
    let end = s.end_sec != null ? s.end_sec : s.start_sec + 4;
    if (next && next.start_sec > s.start_sec) end = Math.min(end, next.start_sec);
    if (durationS) end = Math.min(end, durationS);
    if (end - s.start_sec < 0.4) end = s.start_sec + 0.4;
    out.push(String(i + 1), `${ts(s.start_sec)} --> ${ts(end)}`, esc(lang === 'id' ? s.text_id : s.text_sby), '');
  });
  return out.join('\n');
}

module.exports = function captions(ctx) {
  const { app, db, unitRow, mustSee, isOwner } = ctx;
  app.get('/api/units/:id/captions.vtt', (req, res) => {
    const u = unitRow(Number(req.params.id));
    mustSee(req, u);
    const lang = req.query.lang === 'id' ? 'id' : req.query.lang === 'sby' || req.query.lang == null ? 'sby' : null;
    if (!lang) throw bad('lang harus sby atau id');
    const drafts = req.query.drafts === '1' && isOwner(req.user, u);
    const segs = db.prepare(`SELECT seq,start_sec,end_sec,text_sby,text_id FROM segments WHERE unit_id=? ${drafts ? '' : "AND status='validated'"} ORDER BY start_sec,seq`).all(u.id);
    if (!segs.length) throw new HttpError(404, 'Belum ada takarir yang disahkan');
    res.set({ 'Content-Type': 'text/vtt; charset=utf-8', 'Cache-Control': 'private, no-store' });
    res.send(toVtt(segs, lang, u.duration_s));
  });
};
module.exports.toVtt = toVtt;
