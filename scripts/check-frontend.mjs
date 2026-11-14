#!/usr/bin/env node
// Memeriksa frontend (public/js/** dan public/index.html):
//  1. sintaks semua modul sebagai ES module;
//  2. pola terlarang yang melanggar kebijakan DOM aman dan CSP (tanpa innerHTML, tanpa eval, tanpa atribut style/on* inline).
//     Manipulasi gaya lewat CSSOM (el.style.left = …) diperbolehkan CSP `style-src 'self'`; yang diblokir hanyalah atribut inline.
// `node --check` pada berkas .js biasa memperlakukannya sebagai CommonJS, jadi tiap berkas disalin ke .mjs sementara dulu.
import { readdirSync, statSync, copyFileSync, mkdtempSync, rmSync, readFileSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'js');
const files = [];
(function walk(d) { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (n.endsWith('.js')) files.push(p); } })(root);

const tmp = mkdtempSync(join(tmpdir(), 'laras-chk-'));
let bad = 0;
try {
  for (const f of files) {
    const t = join(tmp, 'm.mjs');
    copyFileSync(f, t);
    const r = spawnSync(process.execPath, ['--check', t], { encoding: 'utf8' });
    if (r.status !== 0) { bad++; console.error(`${relative(root, f)}: ${(r.stderr || '').split('\n').slice(0, 4).join('\n')}`); }
  }
} finally { rmSync(tmp, { recursive: true, force: true }); }
if (bad) { console.error(`${bad} modul frontend bermasalah dari ${files.length}`); process.exit(1); }
console.log(`${files.length} modul frontend: sintaks benar`);

// ---- pola terlarang ----
const FORBIDDEN = [
  [/\.(innerHTML|outerHTML)\b/, 'innerHTML/outerHTML (pakai h()/s() dari core/dom.js)'],
  [/\binsertAdjacentHTML\b/, 'insertAdjacentHTML'],
  [/\bdocument\.write(ln)?\b/, 'document.write'],
  [/\beval\s*\(/, 'eval()'],
  [/\bnew\s+Function\b/, 'new Function'],
  [/setAttribute\(\s*['"`]style['"`]/, "setAttribute('style') (diblokir CSP; pakai kelas CSS atau el.style.prop)"],
  [/setAttribute\(\s*['"`]on[a-z]+['"`]/, 'penangan on* lewat setAttribute (pakai addEventListener)'],
];
const isComment = (l) => /^\s*(\/\/|\/\*|\*)/.test(l);
let violations = 0;
for (const f of files) {
  const lines = readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (isComment(l)) return;
    for (const [re, why] of FORBIDDEN) if (re.test(l)) { violations++; console.error(`${relative(root, f)}:${i + 1}: ${why}`); }
  });
}
const html = readFileSync(join(root, '..', 'index.html'), 'utf8');
for (const [re, why] of [[/\sstyle\s*=/i, 'atribut style inline di index.html'], [/\son[a-z]+\s*=/i, 'penangan on* inline di index.html'], [/<script(?![^>]*\ssrc=)[^>]*>/i, '<script> inline di index.html']]) {
  if (re.test(html)) { violations++; console.error(`index.html: ${why}`); }
}
if (violations) { console.error(`${violations} pelanggaran kebijakan DOM aman/CSP`); process.exit(1); }
console.log('Tidak ada pola terlarang (innerHTML, eval, atribut style/on* inline)');
