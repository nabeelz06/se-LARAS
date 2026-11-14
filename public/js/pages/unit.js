import { h, icon, mmss, num, fmtDate, clamp } from '../core/dom.js';
import { GET, POST, DEL } from '../core/api.js';
import { S, isStaff } from '../core/state.js';
import { L, LB, PB, pick, other, STATUS } from '../core/i18n.js';
import { badge, notice, tabs, toast, act, empty, hooks } from '../core/ui.js';
import { createPlayer } from '../comp/player.js';
import { termIndex, withTerms } from '../comp/terms.js';
import { onLeave, parseHash } from '../core/router.js';
import { unitCover } from '../art/cover.js';

const refValue = (a, metric, cat) => {
  if (!a) return null;
  const v = (a.audio && a.audio[metric] != null ? a.audio[metric] : null) ?? (a.pose && a.pose[metric] != null ? a.pose[metric] : null);
  return v == null ? null : `${num(v, cat && cat.digits != null ? cat.digits : 2)} ${cat ? cat.unit : ''}`;
};
const KIND_IC = { jeda: 'clock', gerak: 'body', lain: 'flag' };
const KIND_TX = { jeda: () => L('Mandeg', 'Jeda'), gerak: () => L('Obahan', 'Gerak'), lain: () => L('Penting', 'Penting') };

export async function render({ id }, q) {
  const [d, gl, mt] = await Promise.all([GET(`/api/units/${id}`), GET('/api/glossary').catch(() => ({ terms: [] })), GET('/api/metrics').catch(() => ({ metrics: [] }))]);
  let progress = null;
  if (S.user) { try { progress = (await GET(`/api/units/${id}/progress`)).progress; } catch { /* unit belum disahkan */ } }
  const u = d.unit, idx = termIndex(gl.terms), cat = Object.fromEntries((mt.metrics || []).map((m) => [m.key, m]));
  const startAt = Number(q.get('t')) || 0;
  const own = u.can_manage;

  // ---------- pemutar ----------
  let player = null;
  if (u.has_clip) {
    player = createPlayer({ src: `/api/units/${u.id}/clip`, isVideo: u.is_video, duration: u.duration_s || 0, segments: d.segments, markers: d.markers, label: pick(u, 'title'), unit: u, rhythm: d.analysis && d.analysis.audio && d.analysis.audio.speech_segments, startAt });
    onLeave(() => player.destroy());
    if (u.is_video && d.analysis && d.analysis.pose && d.analysis.pose.frames_detected) GET(`/api/units/${u.id}/pose`).then((r) => player.setTimeline(r.timeline)).catch(() => {});
  }

  // ---------- transkrip ----------
  const segList = h('ol', { class: 'tx' });
  const segEls = d.segments.map((sg) => {
    const main = S.lang === 'id' ? (sg.text_id || sg.text_sby) : sg.text_sby;
    const sub = S.lang === 'dua' && sg.text_id ? sg.text_id : '';
    const li = h('li', { class: ['tx__row', sg.status !== 'validated' ? 'tx__row--draft' : ''] },
      h('button', { type: 'button', class: 'tx__time tnum', 'aria-label': `${L('Mlumpat nang', 'Lompat ke')} ${mmss(sg.start_sec)}`, onclick: () => player && player.seek(sg.start_sec, true) }, mmss(sg.start_sec)),
      h('div', { class: 'tx__text' }, h('p', { class: 'tx__main', lang: S.lang === 'id' ? 'id' : 'jv' }, withTerms(main, idx)), sub ? h('p', { class: 'tx__sub', lang: 'id' }, sub) : null, sg.status !== 'validated' ? badge(STATUS[sg.status](), 'warn') : null),
      player ? h('button', { type: 'button', class: 'iconbtn iconbtn--sm', 'aria-label': L('Ulangi bagian iki', 'Ulangi bagian ini'), title: L('Ulangi bagian iki', 'Ulangi bagian ini'), onclick: () => { const nx = d.segments.find((x) => x.start_sec > sg.start_sec); player.loop(sg.start_sec, sg.end_sec != null ? sg.end_sec : (nx ? nx.start_sec : sg.start_sec + 4)); } }, icon('loop')) : null);
    segList.append(li); return li;
  });
  const txPanel = h('div', { class: 'stack', style: { '--gap': '.8rem' } },
    d.segments.length ? segList : empty(L('Durung enek transkrip', 'Belum ada transkrip'), L('Transkrip tampil nang pelajar sak wise disahno maestro.', 'Transkrip tampil bagi pelajar setelah disahkan maestro.')),
    d.segments.length ? h('div', { class: 'tx__dl' }, h('a', { class: 'btn btn--ghost btn--sm', href: `/api/units/${u.id}/captions.vtt?lang=sby`, download: `takarir-${u.id}-sby.vtt` }, icon('download'), L('Takarir Suroboyoan (.vtt)', 'Takarir Suroboyoan (.vtt)')), h('a', { class: 'btn btn--ghost btn--sm', href: `/api/units/${u.id}/captions.vtt?lang=id`, download: `takarir-${u.id}-id.vtt` }, icon('download'), L('Takarir Indonesia (.vtt)', 'Takarir Indonesia (.vtt)'))) : null,
    gl.terms.length && d.segments.length ? h('p', { class: 'hint' }, icon('book', { cls: 'icon--sm' }), ' ', L('Tembung sing digarisi titik-titik enek nang Kamus; klik kanggo ndelok artine.', 'Kata bergaris titik-titik ada di Kamus; klik untuk melihat artinya.')) : null);
  if (player) {
    let last = -1;
    player.subscribe((t) => {
      let cur = -1;
      d.segments.forEach((sg, i) => { if (sg.start_sec <= t + 0.05) cur = i; });
      if (cur === last) return; last = cur;
      segEls.forEach((el, i) => el.classList.toggle('is-active', i === cur));
      if (cur >= 0 && !player.video.paused) { const el = segEls[cur], box = segList.closest('.tabs__panel') || segList.parentElement; if (box && box.scrollHeight > box.clientHeight) { const top = el.offsetTop - box.offsetTop - box.clientHeight / 3; box.scrollTo({ top: Math.max(0, top), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }); } }
    });
  }

  // ---------- momen ----------
  const mkPanel = d.markers.length ? h('ol', { class: 'moments' }, d.markers.map((m) => h('li', { class: 'moment' },
    h('div', { class: 'moment__head' }, h('span', { class: ['moment__kind', `moment__kind--${m.kind}`] }, icon(KIND_IC[m.kind] || 'flag'), KIND_TX[m.kind] ? KIND_TX[m.kind]() : m.kind),
      h('button', { type: 'button', class: 'tx__time tnum', onclick: () => player && player.seek(m.t_sec, true), 'aria-label': `${L('Mlumpat nang', 'Lompat ke')} ${mmss(m.t_sec)}` }, mmss(m.t_sec)), m.status !== 'validated' ? badge(STATUS[m.status](), 'warn') : null),
    h('h4', { class: 'moment__title' }, PB(m, 'title')),
    (m.why_sby || m.why_id) ? h('div', { class: 'moment__why' }, h('span', { class: 'moment__whylabel' }, icon('scroll', { cls: 'icon--sm' }), L('Kenek opo? (jare maestro)', 'Kenapa? (kata maestro)')), PB(m, 'why', { tag: 'p' })) : null)))
    : empty(L('Durung enek momen', 'Belum ada momen'), L('Momen lan alasane tampil sak wise disahno maestro.', 'Momen dan alasannya tampil setelah disahkan maestro.'));

  // ---------- rubrik ----------
  const rubPanel = d.rubric.length ? h('div', { class: 'stack' }, h('p', { class: 'hint' }, L('Iki ukuran sing dipilih maestro. se-LARAS mung mbandingno latihan sampeyan karo acuan iki, tanpa skor.', 'Ini ukuran pilihan maestro. se-LARAS hanya membandingkan latihan Anda dengan acuan ini, tanpa skor.')),
    d.rubric.map((r) => { const c = cat[r.metric], rv = refValue(d.analysis, r.metric, c); return h('article', { class: 'rubric' }, h('div', { class: 'rubric__head' }, h('h4', null, PB(r, 'label')), rv ? h('span', { class: 'rubric__ref tnum' }, h('small', null, L('Acuan maestro', 'Acuan maestro')), rv) : null),
      (r.hint_sby || r.hint_id) ? PB(r, 'hint', { tag: 'p', cls: 'rubric__hint' }) : null, h('p', { class: 'hint' }, `${L('Toleransi', 'Toleransi')} ±${r.tolerance_pct}%`, c && c.proxy ? ` · ${L('perkiraan', 'perkiraan')}` : '')); })) : empty(L('Durung enek ukuran', 'Belum ada ukuran'), L('Maestro durung nentokno ukuran.', 'Maestro belum menentukan ukuran.'));

  const panel = tabs([{ label: L('Transkrip', 'Transkrip'), icon: 'caption', count: d.segments.length, panel: txPanel }, { label: L('Momen', 'Momen'), icon: 'flag', count: d.markers.length, panel: mkPanel }, { label: L('Ukuran', 'Ukuran'), icon: 'sliders', count: d.rubric.length, panel: rubPanel }], { label: L('Isi unit', 'Isi unit') });

  // ---------- jalur belajar ----------
  const stepperHost = h('div');
  const pstate = () => ({ nyebeng: !!(progress && progress.nyebeng_at), tedean: !!(progress && progress.tedean_n > 0), ngelmu: !!(progress && progress.ngelmu_at) });
  const mark = async (step) => { try { const r = await POST(`/api/units/${u.id}/progress`, { step }); progress = r.progress; paintStepper(); toast(step === 'nyebeng' ? L('Dicatet: wis nyebeng', 'Tercatat: sudah nyebeng') : L('Dicatet: wis ngelmu', 'Tercatat: sudah ngelmu')); } catch (e) { toast(e.message, 'err'); } };
  function paintStepper() {
    const st = pstate(), next = !st.nyebeng ? 'nyebeng' : !st.tedean ? 'tedean' : !st.ngelmu ? 'ngelmu' : null;
    const login = `#/masuk?next=${encodeURIComponent(parseHash().path)}`;
    const step = (key, n, title, desc, action, date) => h('li', { class: 'stepper__step', 'data-state': st[key] ? 'done' : next === key ? 'current' : 'todo' },
      h('span', { class: 'stepper__dot', 'aria-hidden': 'true' }, st[key] ? icon('check') : n), h('div', { class: 'stepper__body' }, h('strong', null, title, h('span', { class: 'sr' }, st[key] ? ` (${L('wis', 'sudah')})` : '')), h('small', null, date ? `${L('Wis', 'Sudah')} ${fmtDate(date, false)}` : desc), action));
    const act1 = !S.user ? h('a', { class: 'btn btn--line btn--sm', href: login }, L('Mlebu kanggo nyatet', 'Masuk untuk mencatat')) : st.nyebeng ? null : h('button', { type: 'button', class: ['btn btn--sm', next === 'nyebeng' ? 'btn--primary' : 'btn--line'], onclick: () => mark('nyebeng') }, icon('eye'), L('Tandai wis nyebeng', 'Tandai sudah nyebeng'));
    const act2 = u.status !== 'validated' ? null : h('a', { class: ['btn btn--sm', next === 'tedean' ? 'btn--primary' : 'btn--line'], href: S.user ? `#/unit/${u.id}/latihan` : login }, icon('camera'), progress && progress.tedean_n ? L('Latihan maneh', 'Latihan lagi') : L('Latihan saiki', 'Latihan sekarang'));
    const act3 = !S.user || st.ngelmu ? null : h('button', { type: 'button', class: ['btn btn--sm', next === 'ngelmu' ? 'btn--primary' : 'btn--line'], disabled: !(st.nyebeng && st.tedean), title: st.nyebeng && st.tedean ? '' : L('Nyebeng lan latihan sepisan sik', 'Nyebeng dan latihan sekali dulu'), onclick: () => mark('ngelmu') }, icon('scroll'), L('Tandai wis ngerti', 'Tandai sudah paham'));
    stepperHost.replaceChildren(h('section', { class: 'card stepper', 'aria-labelledby': 'stp-h' }, h('div', { class: 'row row--between' }, h('h2', { id: 'stp-h', class: 'stepper__title' }, L('Jalur sampeyan', 'Jalurmu')), badge(L('Rancangan tim, durung disahno maestro', 'Rancangan tim, belum disahkan maestro'), '')),
      h('ol', { class: 'stepper__list' }, step('nyebeng', 1, 'Nyebeng', L('Ndelok klip maestro nganti rampung.', 'Tonton klip maestro sampai selesai.'), act1, progress && progress.nyebeng_at), step('tedean', 2, 'Tedean', L('Nyoba dewe lan unggah latihan.', 'Coba sendiri dan unggah latihan.'), act2, progress && progress.tedean_at), step('ngelmu', 3, 'Ngelmu', L('Ngerti selisihe, trus tandai.', 'Pahami selisihnya, lalu tandai.'), act3, progress && progress.ngelmu_at)),
      progress && progress.tedean_n ? h('p', { class: 'hint' }, `${L('Wis nyoba', 'Sudah mencoba')} ${progress.tedean_n}× · `, h('a', { href: '#/kemajuan' }, L('Delok kemajuan', 'Lihat kemajuan'))) : null));
  }
  paintStepper();
  if (player) player.video.addEventListener('ended', () => { if (S.user && !pstate().nyebeng) toast(L('Wis ndelok nganti rampung? Tandai "nyebeng" nang jalur sampeyan.', 'Sudah menonton sampai selesai? Tandai "nyebeng" di jalur Anda.')); });

  // ---------- kartu samping ----------
  const m = u.maestro;
  const maestroCard = h('section', { class: 'card card--soft maestro' }, h('div', { class: 'maestro__avatar', 'aria-hidden': 'true' }, icon('drum')), h('div', null, h('p', { class: 'eyebrow' }, L('Maestro', 'Maestro')), h('h3', null, m.name), h('p', { class: 'muted' }, [m.sanggar, m.region].filter(Boolean).join(' · ') || L('Profil durung diisi', 'Profil belum diisi')), m.bio ? h('p', null, m.bio) : null));
  const notes = (u.notes_sby || u.notes_id) ? h('section', { class: 'card' }, h('h3', null, icon('scroll'), L('Catetane maestro', 'Catatan maestro')), PB(u, 'notes', { tag: 'p', cls: 'prewrap' })) : null;
  const consent = h('details', { class: 'card card--soft consent' }, h('summary', null, icon('shield'), L('Izin lan asal klip', 'Izin dan asal klip')),
    h('dl', { class: 'dl' }, h('dt', null, L('Sing diizini (tampil nang klip)', 'Pemberi izin (tampil di klip)')), h('dd', null, u.consent.holder), h('dt', null, L('Tanggal izin', 'Tanggal izin')), h('dd', null, fmtDate(u.consent.date)), u.consent.scope ? [h('dt', null, L('Lingkup', 'Lingkup')), h('dd', null, u.consent.scope)] : null,
      h('dt', null, L('Disahno', 'Disahkan')), h('dd', null, u.validated_at ? fmtDate(u.validated_at) : L('Durung', 'Belum'))), h('p', { class: 'hint' }, L('Maestro isok narik unit iki kapan wae; klip lan analisise dibusak.', 'Maestro dapat menarik unit ini kapan saja; klip dan analisisnya dihapus.')));

  const flags = [];
  if (u.is_demo) flags.push(badge(L('Conto uji (dudu konten maestro)', 'Contoh uji (bukan konten maestro)'), 'demo'));
  if (u.status !== 'validated') flags.push(badge(STATUS[u.status](), u.status === 'withdrawn' ? 'danger' : 'warn'));
  flags.push(u.access === 'public' ? badge(L('Terbuka', 'Terbuka'), '', 'globe') : badge(L('Kudu mlebu', 'Perlu masuk'), '', 'lock'));
  if (d.analysis && d.analysis.warnings && d.analysis.warnings.length) flags.push(badge(L('Enek peringatan analisis', 'Ada peringatan analisis'), 'warn', 'alert'));

  const head = h('header', { class: 'wrap unithead' },
    h('nav', { class: 'crumbs', 'aria-label': 'Jejak halaman' }, h('a', { href: '#/unit' }, L('Unit Latihan', 'Unit Latihan')), icon('chevron-right', { cls: 'icon--sm' }), h('span', { 'aria-current': 'page' }, pick(u, 'title'))),
    h('h1', null, PB(u, 'title')), h('div', { class: 'chips' }, flags, u.skill ? badge(u.skill, 'gold', 'target') : null),
    own ? h('div', { class: 'actions', style: { marginTop: '.8rem' } }, h('a', { class: 'btn btn--line btn--sm', href: `#/maestro/${u.id}` }, icon('edit'), L('Kelola unit iki', 'Kelola unit ini'))) : null);

  const media = player ? player.el : h('div', { class: 'card' }, empty(L('Klip ora enek', 'Klip tidak tersedia'), L('Klip wis ditarik maestro.', 'Klip telah ditarik maestro.')));
  if (u.status === 'draft' && own) head.append(h('div', { style: { marginTop: '.8rem' } }, notice(L('Unit iki durung disahno: pelajar durung isok ndelok. Awakmu ndelok iki amergo awakmu pemilik.', 'Unit ini belum disahkan: pelajar belum dapat melihatnya. Anda melihat ini karena pemilik.'), 'warn')));
  return h('div', { class: 'unitpage' }, head,
    h('div', { class: 'wrap unitpage__grid' }, h('div', { class: 'unitpage__main stack' }, media, stepperHost, notes, maestroCard, consent), h('aside', { class: 'unitpage__side', 'aria-label': L('Isi unit', 'Isi unit') }, h('div', { class: 'card unitpage__panel' }, panel))));
}
void other; void clamp; void DEL; void act; void hooks; void unitCover; void isStaff;
