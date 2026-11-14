#!/usr/bin/env node
'use strict';
/**
 * Ekspor korpus riset (hanya klip disahkan + berizin riset). Contoh:
 *   DATA_DIR=./data SESSION_SECRET=... node scripts/export-dataset.js --out ./ekspor [--media]
 * Tanpa --media hanya manifest + datacard. Tanpa SESSION_SECRET ekspor tetap jalan tetapi tidak dicatat di buku jejak.
 */
const path = require('path');
const { openDb } = require('../src/db');
const { createLedger } = require('../src/ledger');
const { exportTo } = require('../src/dataset');

const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const val = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const out = val('--out');
if (!out || flag('--help')) { console.error('Pakai: node scripts/export-dataset.js --out DIREKTORI [--media]'); process.exit(out ? 0 : 2); }

const dataDir = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));
const db = openDb(path.join(dataDir, 'laras.db'));
const secret = process.env.SESSION_SECRET;
if (!secret) console.warn('[peringatan] SESSION_SECRET kosong: ekspor tidak dicatat di buku jejak.');
const r = exportTo(path.resolve(out), { db, uploadDir: path.join(dataDir, 'uploads'), includeMedia: flag('--media'), ledger: secret ? createLedger(db, secret) : null });
const t = r.manifest.totals;
console.log(`Ekspor selesai di ${path.resolve(out)}: ${t.units} unit, ${t.speakers} penutur, ${t.hours} jam.${r.manifest.skipped.length ? ` Dilewati: ${r.manifest.skipped.length}.` : ''}`);
if (!t.units) console.log('Korpus kosong: belum ada klip yang disahkan dan ditandai boleh dipakai riset.');
db.close();
