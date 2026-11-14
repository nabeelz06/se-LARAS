'use strict';
/**
 * Katalog ukuran dan perbandingan deskriptif.
 * Maestro memilih ukuran mana yang berarti, menamainya, dan menetapkan toleransi.
 * Tidak ada skor gabungan dan tidak ada penilaian "benar/salah": hanya selisih terhadap acuan maestro.
 * Teks Suroboyoan di sini berstatus DRAF sampai disahkan penutur asli (lihat docs/).
 */
const path = require('node:path');
const fs = require('node:fs');

// Kalibrasi diturunkan dari hasil evaluasi terukur (analyzer/evaluate.py -> evaluation/calibration.json).
// Tidak ada angka lantai yang ditulis tangan di sini; berkas dibaca saat dimuat dan wajib ada.
const CAL_PATH = path.join(__dirname, '..', 'analyzer', 'evaluation', 'calibration.json');
const CAL = JSON.parse(fs.readFileSync(CAL_PATH, 'utf8'));
const FRAGILE = new Set(CAL.rapuh_terhadap_derau || []);

const CATALOG = {
  pause_mean_s: { src: 'audio', unit: 'detik', digits: 2, id: 'Rata-rata lama jeda', sby: 'Rata-rata lawase mandeg', proxy: false },
  long_pauses_per_min: { src: 'audio', unit: 'per menit', digits: 1, id: 'Jeda panjang (≥0,8 dtk) per menit', sby: 'Mandeg dowo (≥0,8 detik) saben menit', proxy: false },
  onset_rate_per_s: { src: 'audio', unit: 'letupan/detik', digits: 2, id: 'Tempo ucap (perkiraan dari letupan suara)', sby: 'Kecepetan ngomong (kiro-kiro soko letupan swara)', proxy: true, proxy_note: 'Tempo ucap adalah perkiraan dari letupan suara, bukan hitungan suku kata.' },
  speech_ratio: { src: 'audio', unit: 'rasio', digits: 2, id: 'Porsi waktu berbicara', sby: 'Pira akehe wektu ngomong', proxy: false },
  dynamic_range_db: { src: 'audio', unit: 'dB', digits: 1, id: 'Rentang tinggi-rendah suara', sby: 'Dhuwur-endhek swara', proxy: false },
  pitch_range_st: { src: 'audio', unit: 'semiton', digits: 1, id: 'Rentang nada (perkiraan)', sby: 'Dhuwur-endhek nada (kiro-kiro)', proxy: true, proxy_note: 'Rentang nada adalah perkiraan dan terganggu iringan ramai.' },
  wrist_speed_mean: { src: 'pose', unit: 'panjang badan/detik', digits: 2, id: 'Kecepatan gerak tangan', sby: 'Cepete tangan obah', proxy: false },
  torso_lean_std_deg: { src: 'pose', unit: 'derajat', digits: 1, id: 'Variasi kemiringan badan', sby: 'Obah-obahe awak (miring)', proxy: false },
  gesture_speech_lag_s: { src: 'pose+audio', unit: 'detik', digits: 2, id: 'Selisih puncak gerak tangan terhadap awal ucapan', sby: 'Tangan nyusul utowo ndisiki ngomong', proxy: false },
};

const get = (analysis, key) => {
  if (!analysis) return null;
  const spec = CATALOG[key];
  if (!spec) return null;
  const a = analysis.audio, p = analysis.pose;
  const v = spec.src === 'audio' ? (a && a[key]) : (p && p[key]);
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
};

// Alasan sebuah ukuran tidak dibandingkan: kode -> [Indonesia, Suroboyoan (draf, menunggu penutur asli)].
const WHY = {
  tanpa_analisis: ['tidak ada analisis', 'analisise ora enek'],
  audio: ['audio tidak memadai', 'swarane ora cukup kanggo dianalisis'],
  derau: ['terlalu berisik untuk ukuran ini', 'kakehan rame kanggo ukuran iki'],
  pose: ['pose sulit dideteksi', 'obahan awak angel kedeteksi'],
  acuan_kosong: ['acuan maestro kosong', 'acuan maestro kosong'],
  tak_terhitung: ['ukuran tidak terhitung pada klip ini', 'ukuran iki ora kehitung nang klip iki'],
};

/** Kode alasan (kunci WHY) bila ukuran tidak andal pada analisis ini, selain itu null. */
function reliability(analysis, key) {
  const spec = CATALOG[key];
  const w = new Set((analysis && analysis.warnings) || []);
  if (!analysis) return 'tanpa_analisis';
  if (spec.src.includes('audio') && (w.has('tanpa_audio') || w.has('audio_senyap') || w.has('tidak_ada_ujaran_terdeteksi') || w.has('audio_terlalu_pendek'))) return 'audio';
  if (spec.src.includes('audio') && FRAGILE.has(key) && w.has('derau_tinggi')) return 'derau';
  if (spec.src.includes('pose') && (w.has('pose_tak_cukup') || w.has('pose_sulit_dideteksi') || w.has('tanpa_video'))) return 'pose';
  return null;
}

/**
 * Lantai selisih (di bawahnya dianggap sama) = batas kebisingan hasil ukur untuk ukuran itu (calibration.json).
 * Untuk hitungan jeda per menit, satu jeda lebih/kurang pada klip sependek itu sudah selisih 60/lama detik.
 */
function floorFor(key, ref, att) {
  const base = (CAL.lantai && CAL.lantai[key]) != null ? CAL.lantai[key] : 0.05;
  if (key === 'long_pauses_per_min') {
    const sr = ref && ref.audio && ref.audio.span_s, sa = att && att.audio && att.audio.span_s;
    const span = Math.min(sr || Infinity, sa || Infinity);
    if (Number.isFinite(span) && span > 0) return Math.max(base, 60 / span * 0.5);
  }
  return base;
}

const fmt = (key, v) => `${Number(v).toFixed(CATALOG[key].digits).replace('.', ',')} ${CATALOG[key].unit}`;

/** Ukuran yang tersedia dan andal pada analisis acuan maestro (itulah yang boleh dipilih untuk rubrik). */
function available(analysis) {
  return Object.keys(CATALOG).filter((k) => get(analysis, k) != null && !reliability(analysis, k));
}

/**
 * Bandingkan klip pelajar dengan acuan maestro menurut rubrik.
 * dims: [{metric,label_sby,label_id,hint_sby,hint_id,tolerance_pct}]
 */
function compare(ref, att, dims) {
  const rows = dims.map((d) => {
    const spec = CATALOG[d.metric];
    const r = get(ref, d.metric), l = get(att, d.metric);
    const base = { metric: d.metric, label_sby: d.label_sby, label_id: d.label_id, hint_sby: d.hint_sby, hint_id: d.hint_id,
      tolerance_pct: d.tolerance_pct, unit: spec.unit, digits: spec.digits, proxy: spec.proxy, ref: r, value: l, band: null };
    const why = reliability(att, d.metric) || reliability(ref, d.metric) || (r == null ? 'acuan_kosong' : l == null ? 'tak_terhitung' : null);
    if (why) return { ...base, status: 'tidak_andal', reason: why, note_id: `Tidak dibandingkan: ${WHY[why][0]}.`, note_sby: `Ora dibandingno: ${WHY[why][1]}.` };
    // toleransi relatif terhadap acuan, dengan lantai kecil agar acuan ≈ 0 tidak menjadikan semuanya "beda"
    const floor = Math.max(Math.abs(r) * (d.tolerance_pct / 100), floorFor(d.metric, ref, att));
    const diff = l - r;
    const status = Math.abs(diff) <= floor ? 'cedhak' : diff > 0 ? 'luwih_dhuwur' : 'luwih_endhek';
    const a = fmt(d.metric, l), b = fmt(d.metric, r);
    const ids = { cedhak: `Dekat dengan acuan maestro: ${a} (acuan ${b}).`, luwih_dhuwur: `Lebih tinggi dari acuan: ${a} dibanding ${b}.`, luwih_endhek: `Lebih rendah dari acuan: ${a} dibanding ${b}.` };
    const sbys = { cedhak: `Cedhak karo acuan maestro: ${a} (acuan ${b}).`, luwih_dhuwur: `Luwih dhuwur tinimbang acuan: ${a} lawan ${b}.`, luwih_endhek: `Luwih endhek tinimbang acuan: ${a} lawan ${b}.` };
    return { ...base, status, delta: Math.round(diff * 1000) / 1000, band: Math.round(floor * 1000) / 1000, note_id: ids[status], note_sby: sbys[status] };
  });
  const cautions = [];
  const rd = ref && ref.audio && ref.audio.duration_s, ld = att && att.audio && att.audio.duration_s;
  if (rd && ld && Math.abs(ld - rd) / rd > 0.4) cautions.push('Durasi klip berbeda jauh dari acuan; bandingkan dengan hati-hati.');
  for (const x of rows) if (x.proxy && CATALOG[x.metric].proxy_note && !cautions.includes(CATALOG[x.metric].proxy_note)) cautions.push(CATALOG[x.metric].proxy_note);
  cautions.push('Ini selisih deskriptif terhadap contoh satu maestro, bukan nilai dan bukan penilaian benar-salah.');
  return { rows, cautions };
}

module.exports = { CATALOG, CAL, get, available, compare, reliability, floorFor };
