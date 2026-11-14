'use strict';
// Saluran data ujung-ke-ujung pada klip SINTETIS: 5 maestro -> unit sah berizin riset -> ekspor (manifest + media)
// -> manifest ASR (potong per segmen sah) -> pembagian latih/dev/uji menurut penutur.
// Ini menguji PIPA, bukan kualitas data: isinya pembacaan LJSpeech (domain publik) dan gambar penari kartun buatan tim, bukan Ludruk.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');
const { setup, today } = require('./harness');
const { createMedia } = require('../src/media');
const { exportTo } = require('../src/dataset');
const { createLedger } = require('../src/ledger');

let ok = true;
try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); execFileSync('python3', ['--version'], { stdio: 'ignore' }); } catch { ok = false; }
const ANALYZER = path.join(__dirname, '..', 'analyzer');
const clip = fs.readFileSync(path.join(__dirname, '..', 'seed', 'fixtures', 'maestro_uji.mp4'));
const py = (script, ...args) => execFileSync('python3', ['-I', path.join(ANALYZER, script), ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const jsonl = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));

async function publishUnit(s, client, tag, dataUse) {
  const fd = new FormData();
  for (const [k, v] of Object.entries({ title_id: `Uji saluran ${tag}`, title_sby: `Uji saluran ${tag}`, consent_holder: `Pemberi izin sintetis ${tag}`, consent_date: today(), consent_confirmed: 'true', data_use: dataUse })) fd.set(k, v);
  fd.set('file', new Blob([clip], { type: 'video/mp4' }), 'maestro_uji.mp4');
  const r = await client.post('/api/units', fd);
  assert.equal(r.status, 201, JSON.stringify(r.data));
  await s.settle(30000);
  const id = r.data.id;
  const add = await client.post(`/api/units/${id}/segments`, { segments: [
    { start_sec: 1, end_sec: 4, text_sby: `Cak ${tag}, awakmu iku ngomong opo`, text_id: 'Mas, kamu itu bicara apa' },
    { start_sec: 5, end_sec: 9, text_sby: `Ojok mlayu ${tag}`, text_id: 'Jangan lari' },
    { start_sec: 10, text_sby: `Segmen tanpa batas akhir ${tag}`, text_id: 'Segmen tanpa batas akhir' } ] });
  assert.equal(add.status, 201, JSON.stringify(add.data));
  for (const sg of (await client.get(`/api/units/${id}`)).data.segments) { const sv = await client.post(`/api/segments/${sg.id}/validate`); assert.equal(sv.status, 200, JSON.stringify(sv.data)); }
  const ru = await client.put(`/api/units/${id}/rubric`, { dims: [{ metric: 'pause_mean_s', label_sby: 'Lawase mandeg', label_id: 'Lama jeda', tolerance_pct: 25 }] });
  assert.equal(ru.status, 200, JSON.stringify(ru.data));
  const v = await client.post(`/api/units/${id}/validate`);
  assert.equal(v.status, 200, JSON.stringify(v.data));
  return id;
}

test('saluran data: ekspor -> manifest ASR -> pembagian menurut penutur (klip sintetis)', { skip: !ok && 'ffmpeg/python3 tidak ada', timeout: 180000 }, async () => {
  const s = await setup({ media: createMedia() });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'laras-pipe-'));
  try {
    const makers = [s.m];
    for (let i = 2; i <= 5; i++) {
      const c = s.client(); const u = await c.signup(`m${i}@t.id`, `Cak Uji ${i}`);
      assert.equal((await s.admin.patch(`/api/users/${u.id}/role`, { role: 'maestro' })).status, 200);
      makers.push(c);
    }
    for (let i = 0; i < 5; i++) await publishUnit(s, makers[i], `m${i + 1}`, 'riset');
    // klip keenam: sah tetapi TANPA izin riset -> tidak boleh ikut
    const tanpaIzin = await publishUnit(s, makers[0], 'tanpa-izin', 'tidak');

    const dir = path.join(tmp, 'ekspor');
    const ex = exportTo(dir, { db: s.db, uploadDir: s.uploadDir, includeMedia: true, ledger: createLedger(s.db, 'test-secret-0123456789') });
    assert.equal(ex.manifest.totals.units, 5, 'hanya klip berizin riset');
    assert.equal(ex.manifest.totals.speakers, 5);
    assert.ok(!ex.manifest.items.some((i) => i.unit_id === tanpaIzin));
    assert.ok(!fs.readFileSync(path.join(dir, 'manifest.jsonl'), 'utf8').includes('Pemberi izin sintetis'), 'nama pemberi izin tidak diekspor');

    const out = path.join(tmp, 'asr');
    const log = py('manifest_to_asr.py', path.join(dir, 'manifest.jsonl'), out);
    assert.match(log, /10 ujaran dari 5 unit, 5 penutur/);
    const rows = jsonl(path.join(out, 'asr_manifest.jsonl'));
    assert.equal(rows.length, 10, 'dua segmen berbatas akhir per unit; segmen tanpa batas akhir dilewati');
    assert.ok(rows.every((r) => r.end_basis === 'ditetapkan' && fs.statSync(path.join(out, r.audio)).size > 1000));
    assert.equal(fs.readFileSync(path.join(out, rows[0].audio)).subarray(0, 4).toString(), 'RIFF');

    const splits = path.join(tmp, 'splits');
    py('make_splits.py', path.join(out, 'asr_manifest.jsonl'), splits);
    const parts = Object.fromEntries(['train', 'dev', 'test'].map((k) => [k, jsonl(path.join(splits, `${k}.jsonl`))]));
    assert.equal(parts.train.length + parts.dev.length + parts.test.length, 10);
    const spk = (k) => new Set(parts[k].map((r) => r.speaker));
    for (const k of ['train', 'dev', 'test']) assert.ok(spk(k).size >= 1, `${k} berpenutur`);
    for (const [a, b] of [['train', 'dev'], ['train', 'test'], ['dev', 'test']]) assert.equal([...spk(a)].filter((x) => spk(b).has(x)).length, 0, `${a}/${b} tidak berbagi penutur`);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); await s.stop(); }
});
