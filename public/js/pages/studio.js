import { h, icon, mmss } from '../core/dom.js';
import { GET, upload } from '../core/api.js';
import { S } from '../core/state.js';
import { L, LB, LC, PB, pick } from '../core/i18n.js';
import { badge, notice, check, toast, hooks } from '../core/ui.js';
import { createPlayer } from '../comp/player.js';
import { createRecorder } from '../comp/recorder.js';
import { onLeave, go } from '../core/router.js';
import { pageHead } from '../comp/pagehead.js';

export async function render({ id }) {
  const d = await GET(`/api/units/${id}`);
  const u = d.unit;
  if (u.status !== 'validated') return h('div', { class: 'wrap wrap--narrow pad' }, h('h1', null, L('Unit durung disahno', 'Unit belum disahkan')), notice(L('Latihan mung isok ditindakno nang unit sing wis disahno maestro.', 'Latihan hanya dapat dilakukan pada unit yang sudah disahkan maestro.'), 'warn'), h('a', { class: 'btn btn--line', href: `#/unit/${u.id}` }, L('Bali', 'Kembali')));
  const player = createPlayer({ src: `/api/units/${u.id}/clip`, isVideo: u.is_video, duration: u.duration_s || 0, segments: d.segments, markers: d.markers, label: pick(u, 'title'), unit: u, rhythm: d.analysis && d.analysis.audio && d.analysis.audio.speech_segments });
  onLeave(() => player.destroy());
  const maxS = (S.about && S.about.max_clip_seconds) || 150, days = (S.about && S.about.retention_days) || 30;
  let file = null, consentEl, shareEl, sendBtn, progressBar, progressTxt, sending = null;
  const recorder = createRecorder({ maxSeconds: maxS, onFile: (f) => { file = f; sync(); }, onClear: () => { file = null; sync(); } });
  onLeave(() => { recorder.destroy(); if (sending) sending.abort(); });
  function sync() { if (sendBtn) sendBtn.disabled = !(file && consentEl.querySelector('input').checked) || !!sending; }
  consentEl = check(LC(`Aku setuju rekaman video lan swaraku diproses kanggo analisis iki. Isok tak busak kapan wae, lan otomatis kebusak sak wise ${days} dino.`, `Saya setuju rekaman video dan suara saya diproses untuk analisis ini. Dapat saya hapus kapan saja, dan otomatis terhapus setelah ${days} hari.`), 'consent_confirmed', { required: true });
  consentEl.querySelector('input').addEventListener('change', sync);
  shareEl = check(L('Bagikno latihan iki marang maestro (opsional)', 'Bagikan latihan ini kepada maestro (opsional)'), 'share_with_maestro', { hint: L('Nek ora dicentang, mung sampeyan sing isok ndelok rekamane.', 'Bila tidak dicentang, hanya Anda yang dapat melihat rekamannya.') });
  progressBar = h('div', { class: 'progress__fill' }); progressTxt = h('span', { class: 'tnum' }, '0%');
  const progress = h('div', { class: 'progress', hidden: true, role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0', 'aria-label': L('Ngunggah', 'Mengunggah') }, h('div', { class: 'progress__bar' }, progressBar), progressTxt);
  sendBtn = h('button', { type: 'button', class: 'btn btn--primary btn--lg', disabled: true }, icon('upload'), L('Kirim lan analisis', 'Kirim dan analisis'));
  sendBtn.addEventListener('click', () => {
    if (!file || !consentEl.querySelector('input').checked) return;
    const fdata = new FormData();
    fdata.append('consent_confirmed', 'true'); fdata.append('share_with_maestro', shareEl.querySelector('input').checked ? 'true' : 'false');
    fdata.append('file', file, file.name);
    progress.hidden = false; sendBtn.disabled = true;
    sending = upload(`/api/units/${u.id}/attempts`, fdata, (p) => { const n = Math.round(p * 100); progressBar.style.width = `${n}%`; progressTxt.textContent = `${n}%`; progress.setAttribute('aria-valuenow', String(n)); });
    sending.promise.then((r) => { sending = null; toast(L('Wis kekirim. Lagi dianalisis…', 'Terkirim. Sedang dianalisis…')); go(`/latihan/${r.id}`); })
      .catch((e) => { sending = null; progress.hidden = true; if (!e.aborted) toast(e.message, 'err'); sync(); });
  });
  const dims = d.rubric.map((r) => h('li', null, h('strong', null, PB(r, 'label')), (r.hint_sby || r.hint_id) ? PB(r, 'hint', { tag: 'span', cls: 'hint block' }) : null));
  return h('div', null,
    pageHead({ eyebrow: L('Tedean · nyoba dewe', 'Tedean · mencoba sendiri'), title: LB('Rekam latihan sampeyan', 'Rekam latihan Anda'), lead: LB('Rekam utowo unggah latihan sampeyan. se-LARAS mbandingno karo ukuran pilihane maestro, ora ngekek skor.', 'Rekam atau unggah latihan Anda. se-LARAS membandingkan dengan ukuran pilihan maestro, tanpa memberi skor.'),
      crumbs: [{ href: '#/unit', label: 'Unit Latihan' }, { href: `#/unit/${u.id}`, label: pick(u, 'title') }, { label: 'Tedean' }] }),
    h('div', { class: 'wrap pad' },
    h('div', { class: 'studio' },
      h('section', { class: 'studio__ref stack', 'aria-labelledby': 'ref-h' }, h('h2', { id: 'ref-h', class: 'h-sm' }, icon('eye'), L('Contone maestro', 'Contoh maestro')), player.el,
        d.rubric.length ? h('div', { class: 'card card--soft' }, h('h3', { class: 'h-sm' }, icon('sliders'), L('Sing diukur maestro', 'Yang diukur maestro')), h('ul', { class: 'dims' }, dims)) : null),
      h('section', { class: 'studio__me stack', 'aria-labelledby': 'me-h' }, h('h2', { id: 'me-h', class: 'h-sm' }, icon('camera'), L('Latihan sampeyan', 'Latihan Anda')), recorder.el,
        h('details', { class: 'card card--soft tips' }, h('summary', null, icon('info'), L('Sadurunge ngrekam', 'Sebelum merekam')), h('ul', null,
          h('li', null, L('Awak kudu ketok kabeh nang kamera, kamera ojok obah.', 'Seluruh badan terlihat di kamera, kamera jangan bergerak.')), h('li', null, L('Ruangan sepi lan padhang. Swara rame bakal ngurangi ukuran sing isok dibandingno.', 'Ruangan sepi dan terang. Suara ramai akan mengurangi ukuran yang dapat dibandingkan.')),
          h('li', null, L('Nek muter contone maestro sinambi ngrekam, nganggo headset.', 'Bila memutar contoh maestro sambil merekam, pakai headset.')), h('li', null, L(`Maksimal ${mmss(maxS)} menit saben rekaman. Ukuran berkas maksimal 60 MB.`, `Maksimal ${mmss(maxS)} menit per rekaman. Ukuran berkas maksimal 60 MB.`)), h('li', null, L('Tampil dewe, utowo pilih awakmu nek ono akeh wong (sak wise analisis).', 'Tampil sendiri, atau pilih diri Anda bila ada banyak orang (setelah analisis).')))),
        h('div', { class: 'card stack' }, h('h3', { class: 'h-sm' }, icon('shield'), L('Izin sampeyan', 'Izin Anda')), consentEl, shareEl, progress,
          h('div', { class: 'actions' }, sendBtn), h('p', { class: 'hint' }, L('Rekaman mung ono nang perangkat sampeyan sampek sampeyan mencet Kirim.', 'Rekaman hanya ada di perangkat Anda sampai Anda menekan Kirim.')))))));
}
void badge; void hooks;
