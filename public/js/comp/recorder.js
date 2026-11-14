// Perekam latihan di peramban (MediaRecorder): pratinjau kamera, meter suara, hitung mundur "telu-loro-siji", batas durasi, putar ulang, atau unggah berkas.
// Semua rekaman hanya berada di perangkat sampai pemain menyetujui dan menekan kirim.
import { h, icon, mmss, bytes, clamp } from '../core/dom.js';
import { L } from '../core/i18n.js';
import { toast } from '../core/ui.js';

const VIDEO_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
const AUDIO_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
const pickType = (list) => (window.MediaRecorder ? list.find((t) => MediaRecorder.isTypeSupported(t)) : null) || '';
/** Tipe tanpa parameter: server hanya menerima 'video/webm' (bukan 'video/webm;codecs=...'). */
export const baseType = (t) => String(t || '').split(';')[0].trim().toLowerCase();
const EXT = { 'video/webm': 'webm', 'video/mp4': 'mp4', 'audio/webm': 'weba', 'audio/mp4': 'm4a' };

export function createRecorder({ maxSeconds = 150, onFile, onClear }) {
  let stream = null, rec = null, chunks = [], timer = 0, started = 0, blobUrl = null, audioCtx = null, meterRaf = 0, mode = 'video', destroyed = false;
  const preview = h('video', { class: 'rec__video', muted: true, playsinline: true, autoplay: true, 'aria-label': L('Pratinjau kamera', 'Pratinjau kamera') });
  const playback = h('video', { class: 'rec__video', controls: true, playsinline: true, hidden: true, 'aria-label': L('Rekaman sampeyan', 'Rekaman Anda') });
  const count = h('div', { class: 'rec__count', hidden: true, 'aria-hidden': 'true' });
  const badge = h('div', { class: 'rec__badge', hidden: true }, h('i', null), h('span', { class: 'tnum' }, '0:00'));
  const meterFill = h('div', { class: 'rec__meterfill' });
  const meter = h('div', { class: 'rec__meter', hidden: true, role: 'img', 'aria-label': L('Meter suara mikrofon', 'Meter suara mikrofon') }, icon('mic'), h('div', { class: 'rec__meterbar' }, meterFill));
  const stage = h('div', { class: 'rec__stage' }, h('div', { class: 'rec__idle' }, icon('camera'), h('p', null, L('Kamera durung dibukak', 'Kamera belum dibuka'))), preview, playback, count, badge, meter);
  const status = h('p', { class: 'hint', role: 'status', 'aria-live': 'polite' });
  const btnCam = h('button', { type: 'button', class: 'btn btn--primary' }, icon('camera'), L('Bukak kamera', 'Buka kamera'));
  const btnMic = h('button', { type: 'button', class: 'btn btn--line' }, icon('mic'), L('Mung swara', 'Hanya suara'));
  const fileIn = h('input', { type: 'file', accept: 'video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp4,audio/wav,audio/ogg,audio/webm', class: 'sr', 'aria-label': L('Unggah berkas latihan', 'Unggah berkas latihan') });
  const btnFile = h('button', { type: 'button', class: 'btn btn--line' }, icon('upload'), L('Unggah berkas', 'Unggah berkas'));
  const btnRec = h('button', { type: 'button', class: 'btn btn--gold btn--lg', hidden: true }, icon('play'), L('Wiwit ngrekam', 'Mulai merekam'));
  const btnStop = h('button', { type: 'button', class: 'btn btn--danger btn--lg', hidden: true }, icon('x'), L('Mandeg', 'Berhenti'));
  const btnRedo = h('button', { type: 'button', class: 'btn btn--line', hidden: true }, icon('refresh'), L('Rekam maneh', 'Rekam ulang'));
  const controls = h('div', { class: 'actions rec__actions' }, btnCam, btnMic, btnFile, fileIn, btnRec, btnStop, btnRedo);
  const root = h('div', { class: 'rec', 'data-state': 'idle' }, stage, controls, status);
  const set = (st, msg) => { root.dataset.state = st; if (msg !== undefined) status.textContent = msg; };

  const noMedia = !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder;
  if (noMedia) { btnCam.disabled = true; btnMic.disabled = true; set('idle', L('Peramban iki ora isok ngrekam; unggah berkas ae.', 'Peramban ini tidak bisa merekam; silakan unggah berkas.')); }

  function stopStream() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null; cancelAnimationFrame(meterRaf);
    if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
    preview.srcObject = null;
  }
  function startMeter() {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = audioCtx.createMediaStreamSource(stream), an = audioCtx.createAnalyser(); an.fftSize = 512; src.connect(an);
      const buf = new Uint8Array(an.fftSize);
      const tick = () => { if (destroyed || !audioCtx) return; an.getByteTimeDomainData(buf); let sum = 0; for (const v of buf) { const x = (v - 128) / 128; sum += x * x; } meterFill.style.width = `${clamp(Math.sqrt(sum / buf.length) * 320, 2, 100)}%`; meterRaf = requestAnimationFrame(tick); };
      tick();
    } catch { /* meter tidak wajib */ }
  }
  async function open(kind) {
    mode = kind;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: kind === 'video' ? { facingMode: 'user', width: { ideal: 960 }, height: { ideal: 540 }, frameRate: { ideal: 30 } } : false,
        // Tanpa peredam derau/AGC agar jeda dan dinamika suara terukur apa adanya (sama seperti klip acuan).
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch (e) {
      set('idle', e && e.name === 'NotAllowedError' ? L('Izin kamera/mikrofon ditolak. Ijinno nang setelan peramban, utowo unggah berkas.', 'Izin kamera/mikrofon ditolak. Izinkan di pengaturan peramban, atau unggah berkas.') : L('Kamera/mikrofon ora ketemu.', 'Kamera/mikrofon tidak ditemukan.'));
      return;
    }
    preview.srcObject = stream; preview.hidden = kind !== 'video'; playback.hidden = true;
    stage.classList.toggle('rec__stage--audio', kind !== 'video');
    meter.hidden = false; startMeter();
    btnCam.hidden = btnMic.hidden = btnFile.hidden = true; btnRec.hidden = false; btnRedo.hidden = true;
    set('ready', L('Siap. Nek muter contoh maestro, nganggo headset, yo.', 'Siap. Bila memutar contoh maestro, gunakan headset.'));
  }
  btnCam.addEventListener('click', () => open('video')); btnMic.addEventListener('click', () => open('audio'));
  btnFile.addEventListener('click', () => fileIn.click());
  fileIn.addEventListener('change', () => { const f = fileIn.files[0]; if (!f) return; useFile(f, false); });

  function useFile(file, recorded) {
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    blobUrl = URL.createObjectURL(file);
    stopStream(); preview.hidden = true; playback.hidden = false; playback.src = blobUrl; meter.hidden = true; badge.hidden = true;
    stage.classList.toggle('rec__stage--audio', file.type.startsWith('audio/'));
    btnRec.hidden = btnStop.hidden = true; btnCam.hidden = btnMic.hidden = btnFile.hidden = true; btnRedo.hidden = false;
    set('done', `${recorded ? L('Rekaman', 'Rekaman') : L('Berkas', 'Berkas')}: ${file.name} · ${bytes(file.size)}`);
    onFile(file, { recorded });
  }
  async function countdown() {
    count.hidden = false;
    for (const n of [L('Telu', 'Tiga'), L('Loro', 'Dua'), L('Siji', 'Satu')]) { count.textContent = n; count.classList.remove('pop'); void count.offsetWidth; count.classList.add('pop'); await new Promise((r) => setTimeout(r, 850)); if (destroyed) return false; }
    count.hidden = true; return true;
  }
  btnRec.addEventListener('click', async () => {
    btnRec.hidden = true; set('count', '');
    if (!(await countdown())) return;
    const type = pickType(mode === 'video' ? VIDEO_TYPES : AUDIO_TYPES);
    chunks = [];
    try { rec = new MediaRecorder(stream, type ? { mimeType: type } : undefined); } catch { toast(L('Perekam ora isok dimulai', 'Perekam tidak dapat dimulai'), 'err'); btnRec.hidden = false; return; }
    rec.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
    rec.onstop = () => {
      clearInterval(timer); badge.hidden = true;
      const bt = baseType(rec.mimeType || type) || (mode === 'video' ? 'video/webm' : 'audio/webm');
      const blob = new Blob(chunks, { type: bt });
      useFile(new File([blob], `latihan-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '')}.${EXT[bt] || 'webm'}`, { type: bt }), true);
    };
    rec.start(500); started = Date.now();
    badge.hidden = false; btnStop.hidden = false; set('rec', L('Lagi ngrekam…', 'Sedang merekam…'));
    timer = setInterval(() => { const s = (Date.now() - started) / 1000; badge.lastChild.textContent = `${mmss(s)} / ${mmss(maxSeconds)}`; if (s >= maxSeconds) btnStop.click(); }, 250);
  });
  btnStop.addEventListener('click', () => { btnStop.hidden = true; if (rec && rec.state !== 'inactive') rec.stop(); });
  btnRedo.addEventListener('click', () => {
    if (blobUrl) { URL.revokeObjectURL(blobUrl); blobUrl = null; }
    playback.removeAttribute('src'); playback.load(); playback.hidden = true; fileIn.value = '';
    btnRedo.hidden = true; btnCam.hidden = btnMic.hidden = btnFile.hidden = false; meter.hidden = true; set('idle', '');
    if (onClear) onClear();
  });
  return { el: root, destroy() { destroyed = true; clearInterval(timer); if (rec && rec.state !== 'inactive') { rec.onstop = null; try { rec.stop(); } catch { /* sudah berhenti */ } } stopStream(); if (blobUrl) URL.revokeObjectURL(blobUrl); } };
}
