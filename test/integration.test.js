'use strict';
// Uji ujung-ke-ujung dengan analyzer Python sungguhan pada klip SINTETIS (penari kartun buatan tim + pembacaan berjeda).
// Klip ini hanya menguji pipa; bukan rekaman Ludruk dan tidak membuktikan akurasi pada panggung nyata.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { setup, today } = require('./harness');
const { createAnalyzer } = require('../src/analysis');
const { createMedia } = require('../src/media');

let ok = true;
try { execFileSync('python3', ['-c', 'import librosa, cv2, ai_edge_litert, scipy'], { stdio: 'ignore' }); } catch { ok = false; }
const fx = (n) => fs.readFileSync(path.join(__dirname, '..', 'seed', 'fixtures', n));
const form = (name, extra = {}) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ title_id: 'Uji sintetis', title_sby: 'Uji sintetis', consent_holder: 'Uji (sintetis)', consent_date: today(), consent_confirmed: 'true', ...extra })) fd.set(k, v);
  fd.set('file', new Blob([fx(name)], { type: 'video/mp4' }), name);
  return fd;
};

test('analyzer nyata: jeda maestro lebih panjang daripada murid, terdeteksi deskriptif', { skip: !ok && 'pustaka Python tidak ada', timeout: 240000 }, async () => {
  const s = await setup({ analyze: createAnalyzer(), media: createMedia() });
  try {
    const r = await s.m.post('/api/units', form('maestro_uji.mp4'));
    assert.equal(r.status, 201);
    await s.settle(200000);
    const d = await s.m.get(`/api/units/${r.data.id}`);
    assert.equal(d.data.unit.analysis_status, 'done', d.data.unit.analysis_error);
    const a = d.data.analysis;
    assert.ok(a.audio.pause_mean_s > 0.7 && a.audio.pause_mean_s < 1.2, `jeda maestro ${a.audio.pause_mean_s}`);
    assert.ok(a.pose.detection_rate > 0.8);
    // Gambar kartun tidak dikenali detektor orang yang dilatih pada foto: yang diuji di sini justru JALUR CADANGAN (peringatan jujur, pose tetap dihitung).
    assert.equal(a.persons.count_median, 0);
    assert.ok(a.warnings.includes('orang_tak_terdeteksi_pakai_cadangan'), JSON.stringify(a.warnings));
    // usulan momen otomatis masuk sebagai DRAF dan tidak terlihat pelajar
    const drafts = d.data.markers.filter((m) => m.status === 'draft_ai');
    assert.ok(drafts.length >= 2, 'ada usulan momen dari analisis');
    assert.ok(drafts.every((m) => m.source === 'ai' && m.why_id === '' && m.why_sby === ''), 'usulan tidak membawa penjelasan maestro');
    // bingkai sungguhan dari ffmpeg (untuk memilih penampil)
    const fr = await fetch(`${s.base}/api/units/${r.data.id}/frame?t=2`, { headers: { cookie: s.m.cookie() } });
    assert.equal(fr.status, 200); assert.equal(fr.headers.get('content-type'), 'image/jpeg');
    const jpg = Buffer.from(await fr.arrayBuffer()); assert.equal(jpg[0], 0xff); assert.equal(jpg[1], 0xd8);
    assert.ok(d.data.available_metrics.includes('pause_mean_s') && d.data.available_metrics.includes('wrist_speed_mean'));
    await s.m.post(`/api/units/${r.data.id}/segments`, { segments: [{ start_sec: 1, text_sby: 'Uji sintetis', text_id: 'Uji sintetis' }] });
    const seg = (await s.m.get(`/api/units/${r.data.id}`)).data.segments[0];
    await s.m.post(`/api/segments/${seg.id}/validate`);
    const ru = await s.m.put(`/api/units/${r.data.id}/rubric`, { dims: [{ metric: 'pause_mean_s', label_sby: 'Lawase mandeg', label_id: 'Lama jeda', tolerance_pct: 25 },
      { metric: 'wrist_speed_mean', label_sby: 'Cepete tangan', label_id: 'Kecepatan tangan', tolerance_pct: 30 }] });
    assert.equal(ru.status, 200, JSON.stringify(ru.data));
    assert.equal((await s.m.post(`/api/units/${r.data.id}/validate`)).status, 200);
    const at = await s.l.post(`/api/units/${r.data.id}/attempts`, form('murid_uji.mp4', {}));
    assert.equal(at.status, 201);
    await s.settle(200000);
    const res = await s.l.get(`/api/attempts/${at.data.id}`);
    assert.equal(res.data.attempt.status, 'done', res.data.attempt.error);
    const [pause, wrist] = res.data.comparison.rows;
    assert.equal(pause.status, 'luwih_endhek', JSON.stringify(pause));
    assert.equal(wrist.status, 'luwih_dhuwur', JSON.stringify(wrist));
    // penyejajaran: isi sama (suara yang sama dengan jeda lebih pendek) => andal, tempo ≈ 10,5/12,8 dtk
    assert.equal(res.data.alignment.reliable, true, JSON.stringify(res.data.alignment));
    assert.ok(Math.abs(res.data.alignment.tempo_ratio - 0.825) < 0.1, `tempo ${res.data.alignment.tempo_ratio}`);
    assert.ok(res.data.alignment.path.length > 20);
    assert.ok(res.data.timeline.length > 10, 'ada lini masa pose untuk lapisan bayangan');
  } finally { await s.stop(); }
});
