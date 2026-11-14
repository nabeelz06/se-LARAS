'use strict';
/**
 * Saluran data untuk riset: hanya klip yang (1) sudah disahkan maestro, (2) diberi tanda data_use='riset' oleh maestro sendiri
 * (persetujuan terpisah dari persetujuan tampil di aplikasi), (3) bukan data peragaan, dan (4) berkasnya masih ada dan hash-nya cocok.
 * Rekaman latihan pelajar TIDAK PERNAH ikut: tidak ada alur persetujuan untuk itu. Nama pemberi izin tidak ikut diekspor;
 * rujukan persetujuan adalah nomor entri buku jejak. Tidak ada klaim bahwa data ini cukup untuk melatih model: lihat datacard hasilnya.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const words = (t) => (String(t).match(/[\p{L}\p{N}']+/gu) || []).length;

function buildManifest(db, { uploadDir, now = () => new Date() } = {}) {
  const units = db.prepare(`SELECT u.*, (SELECT seq FROM ledger l WHERE l.action='unit_dibuat' AND l.subject='unit:'||u.id ORDER BY seq LIMIT 1) consent_ledger_seq
    FROM units u WHERE u.status='validated' AND u.data_use='riset' AND u.is_demo=0 AND u.file_path IS NOT NULL ORDER BY u.id`).all();
  const skipped = [];
  const items = [];
  for (const u of units) {
    const abs = uploadDir ? path.join(uploadDir, path.basename(u.file_path)) : null;
    if (abs) {
      if (!fs.existsSync(abs)) { skipped.push({ unit_id: u.id, alasan: 'berkas hilang' }); continue; }
      if (u.orig_sha256 && sha256(fs.readFileSync(abs)) !== u.orig_sha256) { skipped.push({ unit_id: u.id, alasan: 'hash berkas tidak cocok dengan catatan' }); continue; }
    }
    const info = (() => { try { return JSON.parse(u.media_info || 'null') || {}; } catch { return {}; } })();
    items.push({
      unit_id: u.id, speaker_key: `m${u.maestro_id}`, title_id: u.title_id, skill: u.skill, duration_s: u.duration_s, has_video: !!info.has_video, has_audio: info.has_audio !== false,
      orig_sha256: u.orig_sha256, ext: path.extname(u.file_path), consent: { date: u.consent_date, scope: u.consent_scope, ledger_seq: u.consent_ledger_seq }, data_use: u.data_use, validated_at: u.validated_at,
      segments: db.prepare("SELECT start_sec start, end_sec end, text_sby, text_id FROM segments WHERE unit_id=? AND status='validated' ORDER BY start_sec,seq").all(u.id),
      markers: db.prepare("SELECT t_sec t, kind, title_id, why_id, why_sby FROM markers WHERE unit_id=? AND status='validated' ORDER BY t_sec").all(u.id),
    });
  }
  const speakers = new Set(items.map((i) => i.speaker_key));
  const totals = {
    units: items.length, speakers: speakers.size, hours: Math.round(items.reduce((a, i) => a + (i.duration_s || 0), 0) / 36) / 100,
    segments: items.reduce((a, i) => a + i.segments.length, 0), words_sby: items.reduce((a, i) => a + i.segments.reduce((b, s) => b + words(s.text_sby), 0), 0),
    markers: items.reduce((a, i) => a + i.markers.length, 0), with_video: items.filter((i) => i.has_video).length,
  };
  return { generated_at: now().toISOString(), schema: 'laras-dataset/1', totals, skipped, items };
}

const fmtH = (h) => (h < 1 ? `${Math.round(h * 60)} menit` : `${String(h).replace('.', ',')} jam`);

function datacard(m) {
  const t = m.totals;
  const lines = [];
  const P = (s = '') => lines.push(s);
  P('# Kartu Data (datacard) – Korpus Ludruk se-LARAS');
  P();
  P(`Dibuat: ${m.generated_at} · skema \`${m.schema}\``);
  P();
  P('## Isi saat ini');
  P();
  P(`- Unit: **${t.units}** · penutur/maestro berbeda: **${t.speakers}** · total durasi: **${fmtH(t.hours)}** · segmen transkrip: **${t.segments}** (±${t.words_sby} kata Suroboyoan) · momen: ${t.markers} · berisi video: ${t.with_video}`);
  if (!t.units) P('- **Korpus ini kosong.** Belum ada klip yang disahkan maestro dan ditandai boleh dipakai riset. se-LARAS tidak membawa data Ludruk bawaan.');
  if (m.skipped.length) P(`- Dilewati karena masalah integritas: ${m.skipped.map((s) => `unit ${s.unit_id} (${s.alasan})`).join('; ')}`);
  P();
  P('## Asal dan persetujuan');
  P();
  P('- Setiap klip diunggah maestro/praktisi yang menyatakan sudah memegang izin tertulis dari semua orang yang tampil. Pernyataan itu, tanggal, lingkup izin, dan hash klip tercatat di buku jejak (nomor entri ada pada `consent.ledger_seq`).');
  P('- Pengikutsertaan untuk riset adalah **persetujuan terpisah** (`data_use = riset`) yang bisa dicabut maestro kapan saja; klip yang dicabut/ditarik tidak diekspor lagi, tetapi salinan yang sudah diekspor di luar kendali se-LARAS harus ditarik oleh penerimanya.');
  P('- Nama pemberi izin dan identitas akun TIDAK ikut diekspor; penutur diwakili kunci samaran `speaker_key`.');
  P('- Rekaman latihan pelajar tidak pernah masuk korpus.');
  P();
  P('## Anotasi');
  P();
  P('- Segmen transkrip (Suroboyoan + terjemahan Indonesia) dan momen (penanda waktu + penjelasan "kenapa") hanya yang **disahkan maestro**. Usulan mesin yang belum disahkan tidak diekspor.');
  P('- Tidak ada label mutu/skor. Transkrip belum diperiksa oleh penutur kedua; kesepakatan antar-anotator belum diukur.');
  P();
  P('## Batas yang harus dibaca penerima');
  P();
  P('- Suara dan wajah adalah data pribadi. Dilarang mengidentifikasi ulang, menggabungkan dengan data lain untuk mengenali orang, atau memakai untuk tujuan komersial tanpa perjanjian tertulis dengan maestro dan pengelola.');
  P('- Korpus ini kecil dan bias oleh siapa yang mau berpartisipasi (satu tradisi, sedikit penutur). Jangan menyimpulkan kinerja model pada Suroboyoan umum atau pada pertunjukan panggung penuh dari sini.');
  if (t.speakers < 5) P(`- Hanya ${t.speakers} penutur: pembagian latih/uji menurut penutur (\`analyzer/make_splits.py\`) membutuhkan minimal 5 penutur; di bawah itu jangan membagi, karena suara penutur yang sama akan bocor ke data uji dan menggelembungkan hasil.`);
  P('- Pelatihan ASR dari nol atau penyempurnaan model dengan korpus sekecil ini belum dilakukan dan tidak diklaim; rencana evaluasinya memakai `analyzer/asr_eval.py` (WER/CER) pada data uji yang dipegang terpisah.');
  P();
  return lines.join('\n') + '\n';
}

/** Tulis paket ekspor ke direktori (manifest.jsonl, datacard.md, SHA256SUMS, dan media/ bila diminta). */
function exportTo(dir, { db, uploadDir, includeMedia = false, ledger = null, now = () => new Date() }) {
  const m = buildManifest(db, { uploadDir, now });
  fs.mkdirSync(dir, { recursive: true });
  const files = {};
  const put = (rel, buf) => { const p = path.join(dir, rel); fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, buf); files[rel] = sha256(buf); };
  const rows = m.items.map((i) => {
    const { ext, ...rest } = i;
    return { ...rest, media_file: includeMedia ? `media/unit_${i.unit_id}${ext}` : null };
  });
  put('manifest.jsonl', rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
  put('datacard.md', datacard(m));
  if (includeMedia) for (const i of m.items) { const u = db.prepare('SELECT file_path FROM units WHERE id=?').get(i.unit_id); put(`media/unit_${i.unit_id}${i.ext}`, fs.readFileSync(path.join(uploadDir, path.basename(u.file_path)))); }
  fs.writeFileSync(path.join(dir, 'SHA256SUMS'), Object.entries(files).map(([f, h]) => `${h}  ${f}`).join('\n') + '\n');
  if (ledger) ledger.append({ actor: null, action: 'dataset_diekspor', subject: 'dataset', payload: { unit: m.totals.units, media: includeMedia, manifest_sha256: files['manifest.jsonl'] } });
  return { manifest: m, files };
}

module.exports = { buildManifest, datacard, exportTo };
