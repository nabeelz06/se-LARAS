// Kelola unit (maestro): pemutar tetap di kiri, kesiapan pengesahan, dan penyunting transkrip, momen, ukuran, serta pengaturan di kanan.
import { h, icon, fmtDate } from '../core/dom.js';
import { GET, POST } from '../core/api.js';
import { S } from '../core/state.js';
import { L, LC, pick, STATUS } from '../core/i18n.js';
import { badge, notice, tabs, toast } from '../core/ui.js';
import { createPlayer } from '../comp/player.js';
import { onLeave } from '../core/router.js';
import { pageHead } from '../comp/pagehead.js';
import { transcriptPanel } from '../comp/mtranscript.js';
import { momentsPanel } from '../comp/mmoments.js';
import { rubricPanel } from '../comp/mrubric.js';
import { settingsPanel } from '../comp/msettings.js';
import { mbtn } from '../comp/mkit.js';

const REOPEN = () => L('Nyunting isi sing wis disahno (segmen, momen, ukuran, penampil, keterangan) bakal mbalekno unit nang draf nganti disahno maneh.', 'Menyunting isi yang sudah disahkan (segmen, momen, ukuran, penampil, keterangan) akan mengembalikan unit ke draf sampai disahkan lagi.');

function statusChips(u, d) {
  const chips = [];
  chips.push(u.status === 'validated' ? badge(L('Wis disahno · ketok nang pelajar', 'Disahkan · tampil bagi pelajar'), 'ok', 'shield') : badge(L('Draf · durung ketok nang pelajar', 'Draf · belum tampil bagi pelajar'), 'warn', 'edit'));
  if (u.is_demo) chips.push(badge(L('Conto uji', 'Contoh uji'), 'demo'));
  chips.push(u.access === 'public' ? badge(L('Terbuka', 'Terbuka'), '', 'globe') : badge(L('Kudu mlebu', 'Perlu masuk'), '', 'lock'));
  if (u.data_use === 'riset') chips.push(badge(L('Oleh dipakai riset', 'Boleh dipakai riset'), 'info', 'layers'));
  if (u.analysis_status === 'pending' || u.analysis_status === 'running') chips.push(badge(STATUS.running(), 'info', 'refresh'));
  else if (u.analysis_status === 'failed') chips.push(badge(L('Analisis gagal', 'Analisis gagal'), 'danger', 'alert'));
  if (u.skill) chips.push(badge(u.skill, 'gold', 'target'));
  if (d.analysis && d.analysis.warnings && d.analysis.warnings.length) chips.push(badge(`${d.analysis.warnings.length} ${L('peringatan analisis', 'peringatan analisis')}`, 'warn', 'alert'));
  return chips;
}

function readinessCard(ctx) {
  const { d, u, goTab } = ctx;
  const a = d.analysis, rd = d.readiness || { ok: false, problems: [] };
  const segs = d.segments, segOk = segs.filter((s) => s.status === 'validated').length, mkOk = d.markers.filter((m) => m.status === 'validated').length;
  const avail = new Set(d.available_metrics || []), unavail = d.rubric.filter((r) => !avail.has(r.metric));
  const ast = u.analysis_status, running = ast === 'pending' || ast === 'running', nWarn = a && a.warnings ? a.warnings.length : 0;
  const items = [];
  items.push({ st: ast === 'done' ? 'ok' : ast === 'failed' ? 'bad' : 'wait', short: L('Analisis klip', 'Analisis klip'), val: '',
    n: running ? L('Lagi mlaku… biasane sak-menitan.', 'Sedang berjalan… biasanya hitungan menit.') : ast === 'failed' ? (u.analysis_error || L('Analisis gagal.', 'Analisis gagal.')) : '', jump: ast === 'done' ? null : 3 });
  if (a && a.persons && a.persons.count_median >= 2 && u.is_video) items.push({ st: u.performer_track ? 'ok' : 'bad', short: L('Penampil utama', 'Penampil utama'), val: '', n: u.performer_track ? '' : L('Ono luwih saka siji wong nang video; pilih sing diukur.', 'Ada lebih dari satu orang di video; pilih yang diukur.'), jump: 3 });
  items.push({ st: d.rubric.length && !unavail.length ? 'ok' : 'bad', short: L('Ukuran', 'Ukuran'), val: d.rubric.length ? String(d.rubric.length) : '',
    n: !d.rubric.length ? L('Pilih paling ora siji ukuran.', 'Pilih paling tidak satu ukuran.') : unavail.length ? L(`${unavail.length} ukuran ora andal nang klip iki; copot utowo analisis ulang.`, `${unavail.length} ukuran tidak andal pada klip ini; lepas atau analisis ulang.`) : '', jump: 2 });
  items.push({ st: segOk ? 'ok' : 'bad', short: L('Transkrip', 'Transkrip'), val: segs.length ? `${segOk}/${segs.length}` : '', n: !segs.length ? L('Durung enek segmen; tulis utowo tempel transkrip.', 'Belum ada segmen; tulis atau tempel transkrip.') : !segOk ? L('Durung enek segmen sing disahno.', 'Belum ada segmen yang disahkan.') : segOk < segs.length ? L(`${segs.length - segOk} draf durung disahno; mung sing disahno ketok nang pelajar.`, `${segs.length - segOk} draf belum disahkan; hanya yang disahkan tampil bagi pelajar.`) : '', jump: 0, softPart: !!segOk && segOk < segs.length });
  items.push({ st: mkOk ? 'ok' : 'soft', short: L('Momen', 'Momen'), val: mkOk ? String(mkOk) : '', n: mkOk ? '' : L('Disaranno: tulis paling ora siji momen lan alasane.', 'Disarankan: tulis paling tidak satu momen dan alasannya.'), jump: 1 });
  const mark = { ok: () => icon('check'), bad: () => icon('alert'), wait: () => h('span', { class: 'spinner', 'aria-hidden': 'true' }), soft: () => icon('info') };
  const sr = { ok: L('sudah', 'sudah'), bad: L('belum', 'belum'), wait: L('berjalan', 'berjalan'), soft: L('disarankan', 'disarankan') };
  const validated = u.status === 'validated';
  const blocking = (rd.problems || []).filter((p) => !p.includes('segmen transkrip belum disahkan'));
  const confirm = h('div', { class: 'stack', style: { '--gap': '.6rem' } },
    h('p', null, LC('Aku nyahno transkrip, momen, lan ukuran iki minangka carane aku mbawakno. Sak wise disahno, pelajar isok ndelok lan nyoba. Pengesahan dicatet nang buku jejak, lan aku isok nyunting utowo narik unit iki kapan wae.', 'Saya mengesahkan transkrip, momen, dan ukuran ini sebagai cara saya membawakan. Setelah disahkan, pelajar dapat melihat dan mencoba. Pengesahan dicatat di buku jejak, dan saya dapat menyunting atau menarik unit ini kapan saja.')),
    h('p', { class: 'muted' }, u.access === 'public' ? L('Akses: terbuka kanggo umum.', 'Akses: terbuka untuk umum.') : L('Akses: mung sing wis mlebu.', 'Akses: hanya yang sudah masuk.')));
  const action = validated
    ? h('div', { class: 'ready__done' }, badge(`${L('Disahno', 'Disahkan')} ${fmtDate(u.validated_at, false)}`, 'ok', 'shield'), h('a', { class: 'btn btn--line btn--sm', href: `#/unit/${u.id}` }, icon('eye'), L('Delok kaya pelajar', 'Lihat sebagai pelajar')))
    : mbtn(L('Sahno unit iki', 'Sahkan unit ini'), async () => { await POST(`/api/units/${u.id}/validate`); toast(L('Unit disahno. Saiki ketok nang pelajar.', 'Unit disahkan. Kini tampil bagi pelajar.')); await ctx.reload(); },
      { cls: 'btn btn--primary', ic: 'shield', disabled: !rd.ok, confirmTitle: L('Sahno unit iki?', 'Sahkan unit ini?'), confirm });
  const pill = (it) => {
    const inner = [h('span', { class: 'ck__ic' }, mark[it.st]()), h('span', null, it.short, h('span', { class: 'sr' }, ` (${sr[it.st]})`)), it.val ? h('span', { class: 'ck__val tnum' }, it.val) : null];
    return h('li', { class: 'ck', 'data-st': it.st }, it.jump != null ? h('button', { type: 'button', class: 'ck__pill', onclick: () => goTab(it.jump), title: `${L('Buka', 'Buka')}: ${it.short}` }, inner) : h('span', { class: 'ck__pill' }, inner));
  };
  const todo = items.filter((it) => it.n && (it.st !== 'ok' || it.softPart));
  return h('section', { class: 'card ready', 'aria-labelledby': 'rdy-h' },
    h('div', { class: 'ready__top' },
      h('div', null, h('h2', { id: 'rdy-h', class: 'h-sm' }, icon('shield'), L('Kesiapan disahno', 'Kesiapan disahkan')),
        h('p', { class: 'hint' }, validated ? REOPEN() : rd.ok ? L('Kabeh syarat wis kecukupan. Unit isok disahno.', 'Semua syarat terpenuhi. Unit dapat disahkan.') : `${L('Durung isok disahno', 'Belum dapat disahkan')}${blocking.length ? `: ${blocking[0]}.` : '.'}`)),
      action),
    h('ul', { class: 'ck-row', 'aria-label': L('Syarat pengesahan', 'Syarat pengesahan') }, items.map(pill)),
    todo.length ? h('ul', { class: 'ck-todo' }, todo.map((it) => h('li', { 'data-st': it.softPart ? 'soft' : it.st }, it.st === 'wait' ? h('span', { class: 'spinner', 'aria-hidden': 'true' }) : icon(it.st === 'bad' ? 'alert' : 'info', { cls: 'icon--sm' }), h('span', null, h('strong', null, `${it.short}: `), it.n),
      it.jump != null ? h('button', { type: 'button', class: 'btn btn--ghost btn--sm', onclick: () => goTab(it.jump) }, L('Buka', 'Buka'), icon('chevron-right', { cls: 'icon--sm' })) : null))) : null);
}

export async function render({ id }) {
  let d = await GET(`/api/units/${id}`);
  if (!d.unit.can_manage) return h('div', { class: 'wrap wrap--narrow pad' }, h('h1', null, L('Ora entuk ngelola', 'Tidak dapat mengelola')), notice(L('Mung maestro pemilik unit sing isok ngelola unit iki.', 'Hanya maestro pemilik unit yang dapat mengelola unit ini.'), 'warn'), h('a', { class: 'btn btn--line', href: `#/unit/${id}` }, L('Delok unite', 'Lihat unitnya')));
  if (d.unit.status === 'withdrawn') return h('div', { class: 'wrap wrap--narrow pad' }, h('h1', null, L('Unit wis ditarik', 'Unit sudah ditarik')), notice(L('Klip lan analisis unit iki wis dibusak. Catetan nang buku jejak tetep ono.', 'Klip dan analisis unit ini sudah dihapus. Catatan di buku jejak tetap ada.'), 'info'), h('a', { class: 'btn btn--primary', href: '#/maestro' }, L('Bali nang ruang maestro', 'Kembali ke ruang maestro')));
  const [mt, att] = await Promise.all([GET('/api/metrics').catch(() => ({ metrics: [] })), GET(`/api/units/${id}/attempts`).catch(() => ({ attempts: [] }))]);
  const cat = Object.fromEntries((mt.metrics || []).map((m) => [m.key, m])), about = S.about || {}, attempts = att.attempts || [];
  let persons = null, timer = 0, polls = 0, poseKey = '';
  const needPersons = () => !!(d.unit.is_video && d.analysis && d.analysis.persons && d.analysis.persons.n_tracks > 1);
  const loadPersons = async () => { persons = needPersons() ? await GET(`/api/units/${id}/persons`).catch(() => null) : null; };
  await loadPersons();

  const u0 = d.unit;
  const player = u0.has_clip ? createPlayer({ src: `/api/units/${u0.id}/clip`, isVideo: u0.is_video, duration: u0.duration_s || 0, segments: d.segments, markers: d.markers, label: pick(u0, 'title'), unit: u0, rhythm: d.analysis && d.analysis.audio && d.analysis.audio.speech_segments }) : null;
  onLeave(() => { clearTimeout(timer); if (player) player.destroy(); });

  const chipsHost = h('div', { class: 'chips' }), readyHost = h('div');
  const hosts = { tx: h('div'), mk: h('div'), rb: h('div'), set: h('div') };
  const tabsEl = tabs([
    { label: L('Transkrip', 'Transkrip'), icon: 'caption', count: 0, panel: hosts.tx }, { label: L('Momen', 'Momen'), icon: 'flag', count: 0, panel: hosts.mk },
    { label: L('Ukuran', 'Ukuran'), icon: 'sliders', count: 0, panel: hosts.rb }, { label: L('Pengaturan', 'Pengaturan'), icon: 'settings', panel: hosts.set },
  ], { label: L('Isi unit', 'Isi unit') });
  const goTab = (i) => { tabsEl.select(i); tabsEl.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' }); };
  const ctx = () => ({ d, u: d.unit, player, cat, about, persons, attempts, reload, goTab });

  const syncPose = () => {
    const key = `${d.unit.analysis_status}:${d.unit.performer_track || ''}`;
    if (!player || key === poseKey) return; poseKey = key;
    if (d.unit.is_video && d.analysis && d.analysis.pose && d.analysis.pose.frames_detected) GET(`/api/units/${id}/pose`).then((r) => player.setTimeline(r.timeline)).catch(() => {});
  };
  function paintStatus() { chipsHost.replaceChildren(...statusChips(d.unit, d)); readyHost.replaceChildren(readinessCard(ctx())); }
  function paintAll() {
    paintStatus();
    hosts.tx.replaceChildren(transcriptPanel(ctx())); hosts.mk.replaceChildren(momentsPanel(ctx())); hosts.rb.replaceChildren(rubricPanel(ctx())); hosts.set.replaceChildren(settingsPanel(ctx()));
    const cs = tabsEl.querySelectorAll('.tabs__count'); cs[0].textContent = d.segments.length; cs[1].textContent = d.markers.length; cs[2].textContent = d.rubric.length;
    if (player) { player.setCaptions(d.segments); player.setMarkers(d.markers); syncPose(); }
  }
  const busyNow = () => ['pending', 'running'].includes(d.unit.analysis_status) || d.unit.media_status === 'running';
  function syncPoll() {
    clearTimeout(timer);
    if (!busyNow() || polls > 150) return;
    timer = setTimeout(poll, 2500);
  }
  async function reload() {
    d = await GET(`/api/units/${id}`);
    await loadPersons();
    paintAll(); syncPoll();
  }
  async function poll() {
    polls += 1;
    try {
      const prev = d.unit; d = await GET(`/api/units/${id}`);
      const changed = prev.analysis_status !== d.unit.analysis_status || prev.media_status !== d.unit.media_status || prev.performer_track !== d.unit.performer_track;
      if (changed) {
        await loadPersons(); paintAll();
        if (player && prev.media_status !== 'done' && d.unit.media_status === 'done') { const t = player.video.currentTime; player.video.src = `/api/units/${id}/clip?v=${Date.now()}`; player.video.addEventListener('loadedmetadata', () => player.seek(t), { once: true }); }
        if (prev.analysis_status !== 'done' && d.unit.analysis_status === 'done') toast(L('Analisis rampung. Saiki isok milih ukuran.', 'Analisis selesai. Kini ukuran dapat dipilih.'));
        else if (prev.analysis_status !== 'failed' && d.unit.analysis_status === 'failed') toast(L('Analisis gagal. Delok keterangane nang Pengaturan.', 'Analisis gagal. Lihat keterangannya di Pengaturan.'), 'err');
      } else paintStatus();
    } catch { /* jaringan putus sebentar: coba lagi */ }
    syncPoll();
  }
  paintAll(); syncPoll();

  const media = player ? player.el : h('div', { class: 'card' }, notice(L('Klip ora kasedhiya.', 'Klip tidak tersedia.'), 'warn'));
  return h('div', { class: 'managepage' },
    pageHead({ eyebrow: L('Kelola unit', 'Kelola unit'), title: pick(u0, 'title'), kind: 'parang', crumbs: [{ label: L('Ruang maestro', 'Ruang maestro'), href: '#/maestro' }, { label: pick(u0, 'title') }], meta: chipsHost,
      actions: [h('a', { class: 'btn btn--line', href: `#/unit/${u0.id}` }, icon('eye'), L('Delok kaya pelajar', 'Lihat sebagai pelajar'))] }),
    h('div', { class: 'wrap manage' },
      h('div', { class: 'manage__side' }, media),
      h('div', { class: 'manage__main' }, readyHost, h('div', { class: 'card manage__panel' }, tabsEl))));
}
void LC;
