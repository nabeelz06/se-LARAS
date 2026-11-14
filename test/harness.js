'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { openDb } = require('../src/db');
const { createApp } = require('../src/app');
const { createAi } = require('../src/ai');

const CANNED_MAESTRO = { version: 1, warnings: [],
  audio: { duration_s: 20, speech_ratio: 0.6, pause_count: 10, pause_mean_s: 0.9, pause_max_s: 1.1, long_pauses_per_min: 30, onset_rate_per_s: 3.5, dynamic_range_db: 8, speech_onsets_s: [0.5, 2.5] },
  pose: { frames_analyzed: 100, frames_detected: 95, detection_rate: 0.95, wrist_speed_mean: 1.0, wrist_speed_p90: 2, torso_lean_mean_deg: 5, torso_lean_std_deg: 2.5, timeline: [{ t: 0, lm: [[0.5, 0.5, 1]] }] } };

function stubAnalyzer(table = {}) {
  const calls = [], optCalls = [];
  const fn = async (file, mode, opts = {}) => { calls.push(file); optCalls.push({ mode, ...opts }); const r = table.next ? table.next(file, mode, opts) : CANNED_MAESTRO; if (r instanceof Error) throw r; return r; };
  fn.idle = () => Promise.resolve();
  fn.calls = calls;
  fn.opts = optCalls;
  return fn;
}

// Media palsu: berkas uji berisi byte acak, jadi ffprobe sungguhan akan menolaknya. Pengujian media asli ada di media.test.js.
const JPEG = Buffer.from('/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=', 'base64');
function stubMedia(over = {}) {
  const probe = over.probe || (async (file) => {
    const audioOnly = /\.(mp3|m4a|wav|ogg|weba|aac)$/i.test(file);
    return { duration_s: 20, has_video: !audioOnly, has_audio: true, width: audioOnly ? null : 640, height: audioOnly ? null : 360, fps: audioOnly ? null : 25, vcodec: audioOnly ? null : 'h264', acodec: 'aac', container: 'mov,mp4,m4a,3gp,3g2,mj2' };
  });
  const normalize = over.normalize || (async () => null);
  normalize.idle = normalize.idle || (() => Promise.resolve());
  return { probe, normalize, frame: over.frame || (async () => JPEG), friendly: () => true, maxDurationS: 150 };
}

async function start({ analyze = stubAnalyzer(), media = stubMedia(), asr, aiKey, aiFetch, adminEmails = ['admin@t.id'], now, prepare } = {}) {
  const db = openDb(':memory:');
  const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'lr-up-'));
  if (prepare) prepare(db, uploadDir); // menyiapkan keadaan awal (mis. sisa pekerjaan dari proses yang mati) sebelum aplikasi dibuat
  const ai = createAi({ env: aiKey ? { ANTHROPIC_API_KEY: aiKey } : {}, fetchImpl: aiFetch });
  const app = createApp({ db, ai, analyze, media, asr, secret: 'test-secret-0123456789', uploadDir, adminEmails, authLimit: 1000, now });
  const server = await new Promise((r) => { const s = app.listen(0, '127.0.0.1', () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  const settle = async (limitMs = 10000) => { for (let i = 0; i < Math.ceil(limitMs / 25); i++) { await new Promise((r) => setTimeout(r, 25)); if (!db.prepare("SELECT 1 FROM units WHERE (analysis_status IN ('pending','running') OR media_status IN ('pending','running')) AND file_path IS NOT NULL UNION SELECT 1 FROM attempts WHERE status IN ('pending','running')").get()) return; } throw new Error('analisis tidak selesai'); };
  return { db, app, base, uploadDir, analyze, settle, client: () => client(base),
    stop: () => new Promise((r) => server.close(() => { db.close(); fs.rmSync(uploadDir, { recursive: true, force: true }); r(); })) };
}

function client(base) {
  let cookie = '';
  async function call(method, url, body) {
    const headers = {};
    if (cookie) headers.cookie = cookie;
    let payload;
    if (body instanceof FormData) payload = body;
    else if (body !== undefined) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
    const res = await fetch(base + url, { method, headers, body: payload });
    for (const c of (res.headers.getSetCookie ? res.headers.getSetCookie() : [])) { const kv = c.split(';')[0]; cookie = kv.endsWith('=') ? '' : kv; }
    const ct = res.headers.get('content-type') || '';
    return { status: res.status, data: ct.includes('json') ? await res.json() : await res.arrayBuffer() };
  }
  return { cookie: () => cookie, get: (u) => call('GET', u), post: (u, b) => call('POST', u, b === undefined ? {} : b), put: (u, b) => call('PUT', u, b), patch: (u, b) => call('PATCH', u, b), del: (u) => call('DELETE', u),
    async signup(email, name = 'Pengguna Uji') {
      const r = await call('POST', '/api/auth/register', { email, name, password: 'kata-sandi-uji', consent: true });
      if (r.status !== 201) throw new Error(`signup gagal: ${JSON.stringify(r.data)}`);
      return r.data.user;
    } };
}
const today = () => new Date().toISOString().slice(0, 10);
function clipForm(over = {}, { file = true, name = 'klip.mp4', type = 'video/mp4' } = {}) {
  const fd = new FormData();
  const v = { title_id: 'Membuka dagelan', title_sby: 'Mbukak dagelan', skill: 'improvisasi komedi (contoh uji)', consent_holder: 'Cak Uji', consent_date: today(), consent_confirmed: 'true', ...over };
  for (const [k, val] of Object.entries(v)) if (val !== null) fd.set(k, val);
  if (file) fd.set('file', new Blob([Buffer.from('bukan-video-asli')], { type }), name);
  return fd;
}
// maestro + admin siap pakai
async function setup(opts) {
  const s = await start(opts);
  const admin = s.client(); await admin.signup('admin@t.id', 'Admin');
  const m = s.client(); const mu = await m.signup('maestro@t.id', 'Cak Uji');
  await admin.patch(`/api/users/${mu.id}/role`, { role: 'maestro' });
  const l = s.client(); const lu = await l.signup('murid@t.id', 'Murid Uji');
  return { ...s, admin, m, mu, l, lu };
}
// unit siap sah: segmen + rubrik
async function validatedUnit(s) {
  const r = await s.m.post('/api/units', clipForm());
  if (r.status !== 201) throw new Error(JSON.stringify(r.data));
  await s.settle();
  await s.m.post(`/api/units/${r.data.id}/segments`, { segments: [{ start_sec: 3, text_sby: 'Cak, awakmu iku ngomong opo', text_id: 'Mas, kamu itu bicara apa' }, { start_sec: 65, text_sby: 'Ojok mlayu', text_id: 'Jangan lari' }] });
  const d = await s.m.get(`/api/units/${r.data.id}`);
  for (const sg of d.data.segments) await s.m.post(`/api/segments/${sg.id}/validate`);
  const ru = await s.m.put(`/api/units/${r.data.id}/rubric`, { dims: [
    { metric: 'pause_mean_s', label_sby: 'Lawase mandeg', label_id: 'Lama jeda', hint_sby: 'Mandeg sek, ojok kesusu', hint_id: 'Beri jeda', tolerance_pct: 25 },
    { metric: 'wrist_speed_mean', label_sby: 'Obahe tangan', label_id: 'Gerak tangan', tolerance_pct: 30 }] });
  if (ru.status !== 200) throw new Error(JSON.stringify(ru.data));
  const v = await s.m.post(`/api/units/${r.data.id}/validate`);
  if (v.status !== 200) throw new Error(JSON.stringify(v.data));
  return r.data.id;
}
module.exports = { start, setup, validatedUnit, clipForm, stubAnalyzer, stubMedia, CANNED_MAESTRO, today };
