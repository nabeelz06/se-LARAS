'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { openDb } = require('../src/db');
const { loadGlossarySeed } = require('../src/routes/glossary');

const file = path.join(__dirname, '..', 'seed', 'glossary.json');
const items = JSON.parse(fs.readFileSync(file, 'utf8'));
const KINDS = ['istilah', 'ungkapan', 'panggilan', 'alat', 'lakon'];

test('seed glosarium: setiap entri punya sumber https, istilah unik, dan jenis yang sah', () => {
  assert.ok(items.length >= 20, 'glosarium bawaan terlalu sedikit');
  const seen = new Set();
  for (const g of items) {
    assert.ok(g.term_sby && g.def_id && g.def_sby, `entri tidak lengkap: ${g.term_sby}`);
    assert.ok(KINDS.includes(g.kind), `jenis tidak sah: ${g.term_sby}`);
    assert.ok(g.source_label && /^https:\/\//.test(g.source_url), `sumber tidak berurl https: ${g.term_sby}`);
    assert.ok(!seen.has(g.term_sby.toLowerCase()), `istilah ganda: ${g.term_sby}`);
    seen.add(g.term_sby.toLowerCase());
  }
});

test('seed glosarium: dimuat sebagai pustaka berstatus draf, tidak disahkan atas nama maestro', () => {
  const db = openDb(':memory:');
  assert.equal(loadGlossarySeed(db), items.length);
  assert.equal(loadGlossarySeed(db), 0, 'pemuatan kedua tidak boleh menggandakan');
  const bad = db.prepare("SELECT COUNT(*) n FROM glossary WHERE basis!='pustaka' OR status!='draft' OR validated_by IS NOT NULL").get().n;
  assert.equal(bad, 0);
  db.close();
});

test('seed glosarium: contoh kalimat hanya muncul bersama padanan Indonesia', () => {
  for (const g of items) if (g.example_sby) assert.ok(g.example_id, `contoh tanpa terjemahan: ${g.term_sby}`);
});
