// Pemutar kustom: takarir dua bahasa dari segmen yang disahkan, penanda momen, kecepatan, ulang bagian, kerangka gerak, papan tombol, dan layar penuh.
import { h, icon, mmss, clamp } from '../core/dom.js';
import { L } from '../core/i18n.js';
import { S, setLang } from '../core/state.js';
import { nearest, contentRect, drawSkeleton, anchorTo, SKEL_COLORS } from './skeleton.js';
import { rhythmBars, unitCover } from '../art/cover.js';

const SPEEDS = [0.5, 0.75, 1];
const KIND_LABEL = { jeda: () => L('Mandeg', 'Jeda'), gerak: () => L('Obahan', 'Gerak'), lain: () => L('Penting', 'Penting') };

export function createPlayer({ src, isVideo = true, duration = 0, segments = [], markers = [], timeline = null, color = SKEL_COLORS.maestro, label = '', unit = null, rhythm = null, ghost = null, startAt = 0 } = {}) {
  const video = h('video', { class: 'player__video', playsinline: true, preload: 'metadata', src, 'aria-label': label || null, disablepictureinpicture: false });
  const canvas = h('canvas', { class: 'player__overlay', 'aria-hidden': 'true' });
  const caption = h('div', { class: 'player__caption', 'aria-hidden': 'true' });
  const bigplay = h('button', { type: 'button', class: 'player__big', 'aria-label': L('Muter', 'Putar') }, icon('play'));
  const spin = h('div', { class: 'player__spin', hidden: true }, h('span', { class: 'spinner' }));
  const stageKids = [video, canvas, caption, bigplay, spin];
  if (!isVideo) stageKids.unshift(h('div', { class: 'player__audio' }, unit ? unitCover(unit, { tall: true }) : null, rhythm ? rhythmBars(rhythm, duration, { cls: 'player__rhythm', hgt: 60 }) : null, h('div', { class: 'player__audiolabel' }, icon('mic'), L('Klip swara', 'Klip suara'))));
  const stage = h('div', { class: 'player__stage', tabindex: '0', 'aria-label': (label ? `${label}. ` : '') + L('Spasi: muter/mandeg. Panah: maju-mundur 5 detik.', 'Spasi: putar/jeda. Panah: maju-mundur 5 detik.') }, ...stageKids);

  // bilah kendali
  const playBtn = h('button', { type: 'button', class: 'player__btn', 'aria-label': L('Muter', 'Putar') }, icon('play'));
  const time = h('span', { class: 'player__time tnum' }, `0:00 / ${mmss(duration)}`);
  const fill = h('div', { class: 'player__fill' });
  const thumb = h('div', { class: 'player__thumb' });
  const seek = h('div', { class: 'player__seek', role: 'slider', tabindex: '0', 'aria-label': L('Posisi klip', 'Posisi klip'), 'aria-valuemin': '0', 'aria-valuemax': String(Math.round(duration)), 'aria-valuenow': '0' }, h('div', { class: 'player__rail' }, fill), thumb);
  const markerEls = [];
  // penanda momen = tombol sungguhan yang SAUDARA dari slider (bukan anak), agar slider tidak berisi elemen fokus di dalamnya
  const markerLayer = h('div', { class: 'player__markers' });
  const seekWrap = h('div', { class: 'player__seekwrap' }, seek, markerLayer);
  const dur = () => (Number.isFinite(video.duration) && video.duration > 0 ? video.duration : duration) || 1;
  const mkMarkers = () => {
    markerEls.splice(0).forEach((m) => m.remove());
    markers.forEach((m) => {
      const b = h('button', { type: 'button', class: ['player__marker', `player__marker--${m.kind}`], 'aria-label': `${L('Momen', 'Momen')} ${mmss(m.t_sec)}: ${S.lang === 'id' ? m.title_id : (m.title_sby || m.title_id)}`, title: `${mmss(m.t_sec)} · ${S.lang === 'id' ? m.title_id : (m.title_sby || m.title_id)}` });
      b.style.left = `${clamp((m.t_sec / dur()) * 100, 0, 100)}%`;
      b.addEventListener('click', (e) => { e.stopPropagation(); api.seek(m.t_sec, true); });
      b.addEventListener('keydown', (e) => e.stopPropagation());
      markerLayer.append(b); markerEls.push(b);
    });
  };
  const speedTxt = h('span', null, '1×');
  const speedBtn = h('button', { type: 'button', class: 'player__btn player__btn--txt' }, h('span', { class: 'sr' }, `${L('Kecepatan putar', 'Kecepatan putar')}: `), speedTxt);
  const LANGS = ['dua', 'sby', 'id', 'off'];
  let capMode = segments.length ? (S.lang === 'id' ? 'id' : S.lang === 'sby' ? 'sby' : 'dua') : 'off';
  const capLabel = () => ({ dua: 'SBY+ID', sby: 'SBY', id: 'ID', off: L('Mati', 'Mati') }[capMode]);
  const capBtn = h('button', { type: 'button', class: 'player__btn player__btn--txt', disabled: !segments.length }, icon('caption'), h('span', { class: 'sr' }, `${L('Takarir', 'Takarir')}: `), h('span', null, capLabel()));
  const skelBtn = h('button', { type: 'button', class: 'player__btn', 'aria-pressed': 'false', 'aria-label': L('Tampilno kerangka obahan', 'Tampilkan kerangka gerak'), title: L('Kerangka obahan', 'Kerangka gerak'), disabled: !isVideo }, icon('body'));
  const loopBtn = h('button', { type: 'button', class: 'player__btn player__btn--txt', hidden: true, 'aria-label': L('Mateni ulangan', 'Matikan ulangan') }, icon('loop'), h('span', null, ''));
  const fsBtn = h('button', { type: 'button', class: 'player__btn', 'aria-label': L('Layar kebak', 'Layar penuh'), hidden: !isVideo }, icon('fullscreen'));
  const bar = h('div', { class: 'player__bar' }, playBtn, time, seekWrap, loopBtn, speedBtn, capBtn, skelBtn, fsBtn);
  const root = h('div', { class: ['player', isVideo ? '' : 'player--audio'], role: 'group', 'aria-label': label || L('Pemutar klip', 'Pemutar klip') }, stage, bar);

  const subs = new Set();
  let showSkel = false, loopRange = null, tl = timeline, ghostTl = ghost && ghost.timeline, ghostColor = ghost && ghost.color, raf = 0, destroyed = false;

  function activeSeg(t) {
    let cur = null;
    for (let i = 0; i < segments.length; i++) {
      const sg = segments[i], nx = segments[i + 1];
      const end = sg.end_sec != null ? sg.end_sec : (nx ? nx.start_sec : sg.start_sec + 4);
      if (t >= sg.start_sec && t < Math.min(end, nx && nx.start_sec > sg.start_sec ? Math.max(nx.start_sec, sg.start_sec + 0.4) : end)) cur = sg;
    }
    return cur;
  }
  function paintCaption(t) {
    const sg = capMode === 'off' ? null : activeSeg(t);
    if (!sg) { caption.replaceChildren(); caption.hidden = true; return; }
    caption.hidden = false;
    const kids = [];
    if ((capMode === 'sby' || capMode === 'dua') && sg.text_sby) kids.push(h('span', { class: 'cap__sby', lang: 'jv' }, sg.text_sby));
    if ((capMode === 'id' || capMode === 'dua') && sg.text_id) kids.push(h('span', { class: ['cap__id', capMode === 'dua' ? 'cap__id--sub' : ''], lang: 'id' }, sg.text_id));
    if (!kids.length && sg.text_sby) kids.push(h('span', { class: 'cap__sby', lang: 'jv' }, sg.text_sby));
    caption.replaceChildren(...kids);
  }
  function paintOverlay(t) {
    const g = canvas.getContext('2d');
    const r = video.getBoundingClientRect();
    const w = Math.max(1, Math.round(r.width)), hh = Math.max(1, Math.round(r.height));
    if (canvas.width !== w || canvas.height !== hh) { canvas.width = w; canvas.height = hh; }
    g.clearRect(0, 0, w, hh);
    if (!showSkel || !isVideo) return;
    const box = contentRect(video);
    const a = nearest(tl, t);
    if (ghostTl && ghost) { const b = nearest(ghostTl, ghost.map ? ghost.map(t) : t * (ghost.scale || 1)); if (b && a) { const m = anchorTo(b.lm, a.lm, box); if (m) drawSkeleton(g, m, box, ghostColor, { alpha: 0.6, line: 2.4, dot: 3 }); } }
    if (a) drawSkeleton(g, a.lm, box, color, { alpha: 0.95 });
  }
  function paint() {
    const t = video.currentTime, d = dur();
    time.textContent = `${mmss(t)} / ${mmss(d)}`;
    const p = clamp(t / d, 0, 1) * 100;
    fill.style.width = `${p}%`; thumb.style.left = `${p}%`;
    seek.setAttribute('aria-valuenow', String(Math.round(t))); seek.setAttribute('aria-valuetext', `${mmss(t)} ${L('saking', 'dari')} ${mmss(d)}`);
    paintCaption(t); paintOverlay(t);
    if (loopRange && t >= loopRange[1]) video.currentTime = loopRange[0];
    subs.forEach((f) => f(t));
  }
  const loop = () => { if (destroyed) return; paint(); if (!video.paused && !video.ended) raf = requestAnimationFrame(loop); };
  const kick = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); };

  const toggle = () => { if (video.paused) video.play().catch(() => {}); else video.pause(); };
  playBtn.addEventListener('click', toggle); bigplay.addEventListener('click', toggle);
  stage.addEventListener('click', (e) => { if (e.target === stage || e.target === video || e.target === canvas) toggle(); });
  video.addEventListener('play', () => { root.classList.add('is-playing'); playBtn.replaceChildren(icon('pause')); playBtn.setAttribute('aria-label', L('Mandeg', 'Jeda')); kick(); });
  video.addEventListener('pause', () => { root.classList.remove('is-playing'); playBtn.replaceChildren(icon('play')); playBtn.setAttribute('aria-label', L('Muter', 'Putar')); paint(); });
  video.addEventListener('ended', () => { root.classList.remove('is-playing'); playBtn.replaceChildren(icon('play')); });
  for (const ev of ['seeked', 'timeupdate', 'loadedmetadata', 'durationchange']) video.addEventListener(ev, () => { if (ev === 'loadedmetadata' || ev === 'durationchange') mkMarkers(); if (video.paused) paint(); });
  video.addEventListener('waiting', () => { spin.hidden = false; }); video.addEventListener('playing', () => { spin.hidden = true; }); video.addEventListener('canplay', () => { spin.hidden = true; });
  video.addEventListener('error', () => { caption.hidden = false; caption.replaceChildren(h('span', { class: 'cap__sby' }, L('Klip ora isok dimuter', 'Klip tidak dapat diputar'))); });
  if (startAt) video.addEventListener('loadedmetadata', () => { video.currentTime = clamp(startAt, 0, dur()); }, { once: true });
  // bingkai mengikuti rasio video (dibatasi 1:1 sampai 16:9) agar video tegak tidak menyisakan pita hitam yang terlalu lebar
  video.addEventListener('loadedmetadata', () => { if (isVideo && video.videoWidth && video.videoHeight) stage.style.aspectRatio = String(clamp(video.videoWidth / video.videoHeight, 1, 16 / 9)); });
  new ResizeObserver(() => paint()).observe(stage);

  // geser posisi
  const seekTo = (clientX) => { const r = seek.getBoundingClientRect(); video.currentTime = clamp((clientX - r.left) / r.width, 0, 1) * dur(); paint(); };
  let dragging = false;
  seek.addEventListener('pointerdown', (e) => { dragging = true; seek.setPointerCapture(e.pointerId); seekTo(e.clientX); });
  seek.addEventListener('pointermove', (e) => { if (dragging) seekTo(e.clientX); });
  seek.addEventListener('pointerup', () => { dragging = false; });
  const key = (e) => {
    if (e.target.closest('button') && e.target !== seek && !(e.target === stage)) return;
    const k = e.key;
    if (k === ' ' || k === 'k') { if (e.target === seek || e.target === stage) { e.preventDefault(); toggle(); } }
    else if (k === 'ArrowRight') { e.preventDefault(); api.seek(video.currentTime + 5); }
    else if (k === 'ArrowLeft') { e.preventDefault(); api.seek(video.currentTime - 5); }
    else if (k === 'Home' && e.target === seek) { e.preventDefault(); api.seek(0); }
    else if (k === 'End' && e.target === seek) { e.preventDefault(); api.seek(dur()); }
    else if (k === 'c' && segments.length) { capBtn.click(); }
    else if (k === 'f' && isVideo) { fsBtn.click(); }
  };
  stage.addEventListener('keydown', key); seek.addEventListener('keydown', key);

  speedBtn.addEventListener('click', () => { const i = (SPEEDS.indexOf(video.playbackRate) + 1) % SPEEDS.length; video.playbackRate = SPEEDS[i]; speedTxt.textContent = `${String(SPEEDS[i]).replace('.', ',')}×`; });
  capBtn.addEventListener('click', () => { capMode = LANGS[(LANGS.indexOf(capMode) + 1) % LANGS.length]; capBtn.lastChild.textContent = capLabel(); paint(); });
  skelBtn.addEventListener('click', () => { showSkel = !showSkel; skelBtn.setAttribute('aria-pressed', String(showSkel)); skelBtn.classList.toggle('is-on', showSkel); paint(); });
  fsBtn.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else root.requestFullscreen && root.requestFullscreen().catch(() => {}); });
  loopBtn.addEventListener('click', () => api.clearLoop());
  document.addEventListener('fullscreenchange', () => root.classList.toggle('is-fs', document.fullscreenElement === root));

  const api = {
    el: root, video, subscribe: (f) => { subs.add(f); return () => subs.delete(f); },
    seek(t, play = false) { video.currentTime = clamp(t, 0, dur()); if (play) video.play().catch(() => {}); paint(); },
    loop(a, b) { loopRange = [a, b]; loopBtn.hidden = false; loopBtn.lastChild.textContent = `${mmss(a)}–${mmss(b)}`; api.seek(a, true); },
    clearLoop() { loopRange = null; loopBtn.hidden = true; },
    setTimeline(x) { tl = x; skelBtn.disabled = !(x && x.length); paint(); },
    setGhost(x, map, gcolor = SKEL_COLORS.maestro) { ghostTl = x; ghostColor = gcolor; ghost = { map }; paint(); },
    showSkeleton(on) { if (showSkel !== on) skelBtn.click(); },
    setCaptions(list) { segments = list; capBtn.disabled = !list.length; paint(); },
    setMarkers(list) { markers = list; mkMarkers(); },
    destroy() { destroyed = true; cancelAnimationFrame(raf); video.pause(); video.removeAttribute('src'); video.load(); },
  };
  skelBtn.disabled = !isVideo || !(tl && tl.length);
  mkMarkers(); paint();
  return api;
}
void setLang;
