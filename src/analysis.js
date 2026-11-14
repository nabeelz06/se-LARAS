'use strict';
/** Menjalankan analyzer Python (CPU) satu per satu agar server kecil tidak kehabisan memori. */
const { spawn } = require('child_process');
const path = require('path');

function createAnalyzer({ python = process.env.PYTHON || 'python3', script = path.join(__dirname, '..', 'analyzer', 'analyze.py'), timeoutMs = 240000 } = {}) {
  let chain = Promise.resolve();
  function run(file, mode, opts = {}) {
    return new Promise((resolve, reject) => {
      const args = ['-I', script, file, mode];
      if (opts.track != null) args.push('--track', String(Number(opts.track)));
      if (opts.ref) args.push('--ref', opts.ref);
      const p = spawn(python, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, TF_CPP_MIN_LOG_LEVEL: '3' } });
      let out = '', err = '';
      const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('Analisis melewati batas waktu')); }, timeoutMs);
      p.stdout.on('data', (d) => { out += d; if (out.length > 20e6) p.kill('SIGKILL'); });
      p.stderr.on('data', (d) => { err += d; if (err.length > 1e6) err = err.slice(-1e5); });
      p.on('error', (e) => { clearTimeout(timer); reject(e); });
      p.on('close', (code) => {
        clearTimeout(timer);
        const line = out.trim().split('\n').filter(Boolean).pop();
        if (code !== 0 && !line) return reject(new Error(`Analyzer berhenti (kode ${code}): ${err.split('\n').filter((l) => l && !l.includes('INFO:')).slice(-2).join(' ')}`));
        try { resolve(JSON.parse(line)); } catch { reject(new Error('Keluaran analyzer tidak terbaca')); }
      });
    });
  }
  const analyze = (file, mode = 'both', opts = {}) => {
    const job = chain.then(() => run(file, mode, opts));
    chain = job.catch(() => {});
    return job;
  };
  analyze.idle = () => chain;
  return analyze;
}
module.exports = { createAnalyzer };
