'use strict';
/**
 * Pemeriksaan dan normalisasi berkas media lewat ffprobe/ffmpeg (tanpa layanan luar).
 *  - probe: memastikan berkas benar-benar media yang bisa diputar, mengambil durasi dan jenis aliran, menolak yang terlalu panjang.
 *  - normalize: membuat salinan putar yang bisa dibuka di semua peramban (MP4 H.264/AAC atau M4A) bila aslinya belum begitu.
 * Berkas asli tidak diubah dan tetap menjadi sumber analisis; hash keduanya dicatat di buku jejak.
 */
const { spawn } = require('child_process');
const path = require('path');

class MediaError extends Error { constructor(message) { super(message); this.status = 400; } }

function run(cmd, args, { timeoutMs = 120000 } = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '', err = '';
    const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} melewati batas waktu`)); }, timeoutMs);
    p.stdout.on('data', (d) => { out += d; if (out.length > 5e6) p.kill('SIGKILL'); });
    p.stderr.on('data', (d) => { err += d; if (err.length > 2e6) err = err.slice(-2e5); });
    p.on('error', (e) => { clearTimeout(timer); reject(e); });
    p.on('close', (code) => { clearTimeout(timer); resolve({ code, out, err }); });
  });
}

function createMedia({ ffprobe = process.env.FFPROBE || 'ffprobe', ffmpeg = process.env.FFMPEG || 'ffmpeg', maxDurationS = 150, maxSide = 960 } = {}) {
  // WebM dari perekam peramban sering tanpa durasi di kepala berkas: hitung dengan mendekode (batas 10 menit).
  async function decodedDuration(file) {
    const r = await run(ffmpeg, ['-hide_banner', '-stats', '-t', '600', '-i', file, '-f', 'null', '-'], { timeoutMs: 120000 });
    const all = [...(r.err || '').matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)];
    if (!all.length) return null;
    const m = all[all.length - 1];
    return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
  }

  async function probe(file) {
    let r;
    try { r = await run(ffprobe, ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', file], { timeoutMs: 30000 }); }
    catch (e) { throw new Error(`ffprobe tidak bisa dijalankan: ${e.message}`); }
    if (r.code !== 0) throw new MediaError('Berkas bukan media yang bisa dibaca (rusak atau format tidak dikenali)');
    let j;
    try { j = JSON.parse(r.out); } catch { throw new MediaError('Berkas media tidak terbaca'); }
    const streams = j.streams || [];
    const v = streams.find((s) => s.codec_type === 'video' && !(s.disposition && s.disposition.attached_pic));
    const a = streams.find((s) => s.codec_type === 'audio');
    if (!v && !a) throw new MediaError('Berkas tidak memuat gambar maupun suara');
    let dur = Number(j.format && j.format.duration);
    if (!Number.isFinite(dur) || dur <= 0) dur = Number((v || a).duration);
    if (!Number.isFinite(dur) || dur <= 0) dur = await decodedDuration(file); // rekaman peramban (WebM) sering tanpa durasi di kepala berkas
    if (!Number.isFinite(dur) || dur <= 0) throw new MediaError('Durasi berkas tidak bisa ditentukan');
    if (dur < 1) throw new MediaError('Klip terlalu pendek (minimal 1 detik)');
    if (dur > maxDurationS) throw new MediaError(`Klip terlalu panjang (${Math.round(dur)} dtk; maksimal ${maxDurationS} dtk). Potong dulu klipnya.`);
    const [num, den] = String((v && v.avg_frame_rate) || '0/1').split('/').map(Number);
    return {
      duration_s: Math.round(dur * 100) / 100, has_video: !!v, has_audio: !!a,
      width: v ? v.width : null, height: v ? v.height : null, fps: v && den ? Math.round((num / den) * 100) / 100 : null,
      vcodec: v ? v.codec_name : null, acodec: a ? a.codec_name : null, container: String((j.format && j.format.format_name) || ''),
    };
  }

  const friendly = (info) => {
    const mp4ish = /mp4|mov|m4a/.test(info.container);
    if (info.has_video) return mp4ish && info.vcodec === 'h264' && (!info.has_audio || info.acodec === 'aac') && Math.max(info.width || 0, info.height || 0) <= 1280;
    return mp4ish && info.acodec === 'aac';
  };

  /** Mengembalikan { path, mime } salinan putar (di samping berkas asli), atau null bila aslinya sudah ramah-peramban. */
  async function normalize(file, info) {
    if (friendly(info)) return null;
    const base = file.replace(/\.[^.]+$/, '');
    if (info.has_video) {
      const out = `${base}.play.mp4`;
      const vf = `scale=w='if(gt(iw,ih),min(${maxSide},iw),-2)':h='if(gt(iw,ih),-2,min(${maxSide},ih))'`;
      const args = ['-v', 'error', '-y', '-i', file, '-map', '0:v:0', ...(info.has_audio ? ['-map', '0:a:0'] : []), '-vf', vf, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '27',
        '-pix_fmt', 'yuv420p', ...(info.has_audio ? ['-c:a', 'aac', '-b:a', '96k'] : ['-an']), '-movflags', '+faststart', out];
      const r = await run(ffmpeg, args, { timeoutMs: 600000 });
      if (r.code !== 0) throw new Error(`ffmpeg gagal menormalkan video: ${r.err.split('\n').filter(Boolean).slice(-1)[0] || r.code}`);
      return { path: out, mime: 'video/mp4' };
    }
    const out = `${base}.play.m4a`;
    const r = await run(ffmpeg, ['-v', 'error', '-y', '-i', file, '-vn', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', out], { timeoutMs: 300000 });
    if (r.code !== 0) throw new Error(`ffmpeg gagal menormalkan audio: ${r.err.split('\n').filter(Boolean).slice(-1)[0] || r.code}`);
    return { path: out, mime: 'audio/mp4' };
  }

  /** Satu bingkai JPEG pada detik t (untuk memilih penampil di antara beberapa orang). */
  function frame(file, t = 0, width = 640) {
    return new Promise((resolve, reject) => {
      const vf = `scale='min(${Math.round(width)},iw)':-2`;
      const p = spawn(ffmpeg, ['-v', 'error', '-ss', String(Math.max(0, Number(t) || 0)), '-i', file, '-frames:v', '1', '-vf', vf, '-f', 'image2pipe', '-vcodec', 'mjpeg', '-q:v', '5', 'pipe:1'], { stdio: ['ignore', 'pipe', 'pipe'] });
      const chunks = []; let n = 0;
      const timer = setTimeout(() => { p.kill('SIGKILL'); reject(new Error('ffmpeg melewati batas waktu')); }, 30000);
      p.stdout.on('data', (d) => { n += d.length; if (n > 4e6) p.kill('SIGKILL'); else chunks.push(d); });
      p.on('error', (e) => { clearTimeout(timer); reject(e); });
      p.on('close', () => {
        clearTimeout(timer);
        const buf = Buffer.concat(chunks);
        if (buf.length < 100) return reject(new MediaError('Bingkai tidak tersedia pada detik itu'));
        resolve(buf);
      });
    });
  }

  // Normalisasi satu per satu (CPU kecil) dan terpisah dari antrean analisis.
  let chain = Promise.resolve();
  const normalizeQueued = (file, info) => { const job = chain.then(() => normalize(file, info)); chain = job.catch(() => {}); return job; };
  normalizeQueued.idle = () => chain;
  return { probe, normalize: normalizeQueued, frame, friendly, maxDurationS };
}

module.exports = { createMedia, MediaError, run, path };
