'use strict';
/**
 * Pengenal ujaran OPSIONAL (hanya bila dikonfigurasi). se-LARAS tidak membawa model ASR Suroboyoan dan tidak melatih satu pun:
 * belum ada korpus Ludruk/Suroboyoan yang memadai. Bila operator memasang perintah ASR sendiri lewat ASR_COMMAND_JSON
 * (daftar argumen JSON; berkas audio ditambahkan di akhir), hasilnya masuk sebagai DRAF yang wajib diperiksa maestro.
 * Kontrak keluaran perintah: JSON di stdout, {"segments":[{"start":detik,"end":detik,"text":"..."}]}.
 */
const { spawn } = require('child_process');

function createAsr({ env = process.env, timeoutMs = 600000 } = {}) {
  let argv = null;
  if (env.ASR_COMMAND_JSON) {
    try { const a = JSON.parse(env.ASR_COMMAND_JSON); if (Array.isArray(a) && a.length && a.every((x) => typeof x === 'string')) argv = a; } catch { /* diabaikan: dianggap tidak dikonfigurasi */ }
  }
  const enabled = () => Boolean(argv);
  function transcribe(file) {
    if (!argv) { const e = new Error('ASR belum dikonfigurasi (ASR_COMMAND_JSON kosong). Isi transkrip secara manual.'); e.status = 503; return Promise.reject(e); }
    return new Promise((resolve, reject) => {
      const p = spawn(argv[0], [...argv.slice(1), file], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '', err = '';
      const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('ASR melewati batas waktu')); }, timeoutMs);
      p.stdout.on('data', (d) => { out += d; if (out.length > 5e6) p.kill('SIGKILL'); });
      p.stderr.on('data', (d) => { err += d; if (err.length > 1e6) err = err.slice(-1e5); });
      p.on('error', (e) => { clearTimeout(timer); reject(e); });
      p.on('close', (code) => {
        clearTimeout(timer);
        if (code !== 0) return reject(new Error(`ASR gagal (kode ${code}): ${err.split('\n').filter(Boolean).slice(-1)[0] || ''}`));
        try {
          const j = JSON.parse(out.trim().split('\n').filter(Boolean).pop());
          const segs = (Array.isArray(j.segments) ? j.segments : [])
            .filter((s) => s && typeof s.text === 'string' && s.text.trim() && Number.isFinite(Number(s.start)))
            .map((s) => ({ start: Math.max(0, Number(s.start)), end: Number.isFinite(Number(s.end)) ? Number(s.end) : null, text: s.text.trim().slice(0, 1000) }));
          resolve(segs);
        } catch { reject(new Error('Keluaran ASR tidak terbaca')); }
      });
    });
  }
  return { enabled, transcribe };
}
module.exports = { createAsr };
