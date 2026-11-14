// Hasil Tedean: selisih deskriptif latihan pemain terhadap contoh satu maestro. Tidak ada skor gabungan, tidak ada "benar/salah".
import { h, icon, num, fmtDate, fmtDateTime } from '../core/dom.js';
import { GET, POST, PATCH, DEL } from '../core/api.js';
import { S } from '../core/state.js';
import { L, LB, pick, STATUS } from '../core/i18n.js';
import { badge, notice, toast, switchEl, field, form, confirmDialog, empty, hooks, busy } from '../core/ui.js';
import { createPlayer } from '../comp/player.js';
import { SKEL_COLORS } from '../comp/skeleton.js';
import { tuner } from '../comp/tuner.js';
import { rhythmCompare } from '../comp/rhythm.js';
import { createDancer } from '../art/dancer.js';
import { warnText } from '../core/warnings.js';
import { onLeave, go } from '../core/router.js';
import { pageHead } from '../comp/pagehead.js';
import { personPicker } from '../comp/personpick.js';

/** Waktu latihan -> waktu maestro lewat jalur DTW [t_acuan, t_latihan]. Tanpa jalur andal tidak ada bayangan. */
function ghostMap(path) {
  const ta = path.map((p) => p[1]), tr = path.map((p) => p[0]);
  return (t) => {
    if (t <= ta[0]) return tr[0];
    if (t >= ta[ta.length - 1]) return tr[tr.length - 1];
    let i = 1; while (i < ta.length && ta[i] < t) i++;
    const a = ta[i - 1], b = ta[i];
    return b > a ? tr[i - 1] + ((t - a) / (b - a)) * (tr[i] - tr[i - 1]) : (tr[i - 1] + tr[i]) / 2;
  };
}
const expiry = (created, days) => { const t = new Date(`${created.replace(' ', 'T')}Z`).getTime() + days * 86400000; return Number.isNaN(t) ? '' : fmtDate(new Date(t).toISOString()); };

function tempoLines(al) {
  if (!al || !al.reliable || al.tempo_ratio == null) return [];
  const r = al.tempo_ratio, x = `${num(r, 2)}×`;
  const out = [Math.abs(r - 1) <= 0.1
    ? L(`Tempo ujaranmu cedhak karo maestro (${x}).`, `Tempo ujaran Anda dekat dengan maestro (${x}).`)
    : r > 1 ? L(`Ujaranmu luwih alon: ${x} dowone maestro.`, `Ujaran Anda lebih lambat: ${x} dari durasi maestro.`)
      : L(`Ujaranmu luwih cepet: ${x} dowone maestro.`, `Ujaran Anda lebih cepat: ${x} dari durasi maestro.`)];
  if (al.local_tempo_min != null && al.local_tempo_max != null) out.push(L(`Nang bagian-bagian tertentu, tempomu ana nang kisaran ${num(al.local_tempo_min, 2)}× nganti ${num(al.local_tempo_max, 2)}× dibanding maestro (kurang saka 1 = luwih cepet).`, `Pada bagian-bagian tertentu, tempo Anda berada di kisaran ${num(al.local_tempo_min, 2)}× hingga ${num(al.local_tempo_max, 2)}× dibanding maestro (kurang dari 1 = lebih cepat).`));
  return out;
}

export async function render({ id }) {
  let data = await GET(`/api/attempts/${id}`);
  const ud = await GET(`/api/units/${data.attempt.unit_id}`).catch(() => null);
  const unit = ud && ud.unit;
  const days = (S.about && S.about.retention_days) || 30;
  const root = h('div', { class: 'result' });
  const bodyEl = h('div', { class: 'wrap pad result__body stack', style: { '--gap': '2.4rem' } });
  const headEl = h('div', null);
  root.append(headEl, bodyEl);
  let players = [], timer = 0, tick = 0, gone = false, shown = null;
  const killPlayers = () => { players.forEach((p) => p.destroy()); players = []; };
  onLeave(() => { gone = true; clearTimeout(timer); clearInterval(tick); killPlayers(); });
  const waiting = (st) => st === 'pending' || st === 'running';

  async function refetch() {
    try { data = await GET(`/api/attempts/${id}`); } catch (e) { if (!gone) toast(e.message, 'err'); }
    if (gone) return;
    if (waiting(data.attempt.status)) { if (shown !== 'wait') paint(); timer = setTimeout(refetch, 1800); } else if (shown !== data.attempt.status) paint();
  }
  const reloadSoon = () => { clearTimeout(timer); timer = setTimeout(refetch, 700); };

  // ---------- kepala ----------
  function head(a) {
    return pageHead({
      eyebrow: L('Tedean · hasil', 'Tedean · hasil'),
      title: a.is_owner ? LB('Hasil Tedean sampeyan', 'Hasil Tedean Anda') : LB('Latihan pemain (dibagikan)', 'Latihan pemain (dibagikan)'),
      crumbs: [{ href: '#/unit', label: 'Unit Latihan' }, unit ? { href: `#/unit/${unit.id}`, label: pick(unit, 'title') } : { label: L('Unit ditarik maestro', 'Unit ditarik maestro') }, { label: L('Hasil', 'Hasil') }],
      meta: [icon('clock', { cls: 'icon--sm' }), fmtDateTime(`${a.created_at.replace(' ', 'T')}Z`), ' ', a.share_with_maestro ? badge(L('Dibagi nang maestro', 'Dibagikan ke maestro'), 'gold', 'share') : badge(L('Mung sampeyan', 'Hanya Anda'), '', 'lock'), ' ', badge(STATUS[a.status](), a.status === 'done' ? 'ok' : a.status === 'failed' ? 'danger' : '')],
    });
  }

  // ---------- menunggu ----------
  function waitView(a) {
    const dancer = createDancer({ ghost: true, size: 220 });
    const sec = h('span', { class: 'tnum' }, '0');
    const t0 = Date.now() - Math.max(0, Date.now() - new Date(`${a.created_at.replace(' ', 'T')}Z`).getTime());
    const upd = () => { sec.textContent = String(Math.max(0, Math.round((Date.now() - t0) / 1000))); };
    upd(); tick = setInterval(upd, 1000);
    onLeave(() => { dancer.stop && dancer.stop(); });
    return h('section', { class: 'wait card', role: 'status', 'aria-live': 'polite' }, h('div', { class: 'wait__art' }, dancer),
      h('div', { class: 'wait__txt' }, h('h2', null, a.status === 'pending' ? L('Antri nang analisis…', 'Antre untuk dianalisis…') : L('se-LARAS lagi nyawang latihanmu…', 'se-LARAS sedang mengamati latihan Anda…')),
        h('p', null, L('Swara, jeda, lan obahan diukur nang server iki. Biasane ora nganti sak menit.', 'Suara, jeda, dan gerak diukur di server ini. Biasanya tidak sampai satu menit.')),
        h('p', { class: 'hint' }, L('Wis', 'Sudah'), ' ', sec, ' ', L('detik', 'detik'), '. ', L('Kaca iki mbarui dewe.', 'Halaman ini memperbarui diri sendiri.'))));
  }

  // ---------- gagal ----------
  function failedView(a) {
    return h('section', { class: 'stack' }, notice(h('div', null, h('p', null, h('strong', null, L('Analisis ora isok rampung.', 'Analisis tidak dapat diselesaikan.'))), h('p', null, a.error || L('Sebabe ora dingerteni.', 'Penyebabnya tidak diketahui.')), h('p', { class: 'hint' }, L('Rekaman sampeyan ora kebuang; coba rekam maneh utowo unggah berkas liyane.', 'Rekaman Anda tidak hilang; coba rekam ulang atau unggah berkas lain.'))), 'danger'),
      h('div', { class: 'actions' }, unit ? h('a', { class: 'btn btn--primary', href: `#/unit/${unit.id}/latihan` }, icon('refresh'), L('Nyoba maneh', 'Coba lagi')) : null, a.is_owner ? deleteBtn(a) : null));
  }
  function deleteBtn(a) {
    const b = h('button', { type: 'button', class: 'btn btn--danger btn--sm' }, icon('trash'), L('Busak latihan iki', 'Hapus latihan ini'));
    b.addEventListener('click', async () => {
      if (!(await confirmDialog({ title: L('Busak latihan iki?', 'Hapus latihan ini?'), body: L('Rekaman lan hasil analisise bakal dibusak saiki lan ora isok dibalekno.', 'Rekaman dan hasil analisisnya akan dihapus sekarang dan tidak dapat dikembalikan.'), confirm: L('Busak', 'Hapus'), danger: true }))) return;
      try { await busy(b, () => DEL(`/api/attempts/${a.id}`)); toast(L('Latihan wis dibusak', 'Latihan sudah dihapus')); go(unit ? `/unit/${unit.id}` : '/kemajuan'); } catch (e) { toast(e.message, 'err'); }
    });
    return b;
  }

  // ---------- pilih penampil ----------
  const pickerFor = (a, persons) => personPicker({ persons, duration: a.duration_s, framePath: `/api/attempts/${a.id}/frame`, id: 'pick',
    alt: L('Bingkai saka video latihan sampeyan', 'Bingkai dari video latihan Anda'),
    intro: L('se-LARAS ngukur obahan wong sing paling gedhe nang bingkai. Nek iku udu sampeyan, klik kothak sampeyan.', 'se-LARAS mengukur gerak orang yang paling besar di bingkai. Bila itu bukan Anda, klik kotak diri Anda.'),
    hint: L('Geser wektu kanggo ngganti bingkai. Pilihan nggawe analisis diulang.', 'Geser waktu untuk mengganti bingkai. Pilihan membuat analisis diulang.'),
    onChoose: async (trackId) => { await POST(`/api/attempts/${a.id}/performer`, { track_id: trackId }); reloadSoon(); } });

  // ---------- hasil ----------
  function doneView(d) {
    const a = d.attempt, an = d.analysis || {}, al = d.alignment, rows = (d.comparison && d.comparison.rows) || [];
    const kids = [];
    const reliable = !!(al && al.reliable && al.path && al.path.length > 2);
    // kerangka hanya digambar bila deteksi cukup andal (ambang sama dengan analyzer: 60% bingkai); jangan menggambar "badan" di atas bukan-orang
    const poseOk = !!(a.is_video && an.pose && an.pose.detection_rate >= 0.6 && d.timeline && d.timeline.length >= 8);

    // pemutar berdampingan
    const learner = createPlayer({ src: `/api/attempts/${a.id}/clip`, isVideo: a.is_video, duration: a.duration_s || 0, timeline: poseOk ? d.timeline : null, color: SKEL_COLORS.murid, label: L('Latihan sampeyan', 'Latihan Anda') });
    players.push(learner);
    let master = null;
    if (unit && unit.has_clip) {
      master = createPlayer({ src: `/api/units/${unit.id}/clip`, isVideo: unit.is_video, duration: unit.duration_s || 0, segments: ud.segments, markers: ud.markers, label: `${L('Contone maestro', 'Contoh maestro')}: ${pick(unit, 'title')}`, unit, rhythm: ud.analysis && ud.analysis.audio && ud.analysis.audio.speech_segments });
      players.push(master);
      if (unit.is_video && ud.analysis && ud.analysis.pose && ud.analysis.pose.frames_detected) {
        GET(`/api/units/${unit.id}/pose`).then((r) => {
          if (gone || !master) return;
          master.setTimeline(r.timeline); master.showSkeleton(true);
          if (reliable && poseOk) learner.setGhost(r.timeline, ghostMap(al.path), SKEL_COLORS.maestro);
        }).catch(() => {});
      }
      if (poseOk) learner.showSkeleton(true);
    }
    const both = h('button', { type: 'button', class: 'btn btn--line btn--sm' }, icon('play'), L('Muter bareng', 'Putar bersamaan'));
    both.addEventListener('click', () => { const playing = !learner.video.paused || (master && !master.video.paused); if (playing) { learner.video.pause(); if (master) master.video.pause(); } else { learner.seek(0, true); if (master) master.seek(0, true); } });
    const versus = h('div', { class: 'versus', role: 'group', 'aria-label': L('Mbandingno klip', 'Perbandingan klip') },
      master ? h('figure', { class: 'versus__col' }, h('figcaption', null, h('i', { class: 'dot dot--gold' }), L('Contone maestro', 'Contoh maestro')), master.el) : notice(L('Unit asale wis ditarik maestro, mula contone ora isok dimuter. Hasil ukuran isih isok dideleng.', 'Unit asalnya sudah ditarik maestro sehingga contohnya tidak dapat diputar. Hasil ukuran masih dapat dilihat.'), 'warn'),
      h('figure', { class: 'versus__col' }, h('figcaption', null, h('i', { class: 'dot dot--teal' }), a.is_owner ? L('Latihan sampeyan', 'Latihan Anda') : L('Latihan pemain', 'Latihan pemain')), learner.el));
    kids.push(h('section', { class: 'stack', style: { '--gap': '.9rem' } }, versus, h('div', { class: 'versus__bar' }, master ? both : null,
      poseOk && master ? h('p', { class: 'hint legend' }, h('i', { class: 'dot dot--gold' }), L('Kerangka emas: obahan maestro', 'Kerangka emas: gerak maestro'), reliable ? L(' (disejajarno karo wektumu)', ' (disejajarkan dengan waktu Anda)') : '', ' · ', h('i', { class: 'dot dot--teal' }), L('Teal: sampeyan', 'Teal: Anda'), ' · ', icon('body', { cls: 'icon--sm' }), L('Klik ikon awak nang pemutar kanggo nampilno', 'Klik ikon tubuh pada pemutar untuk menampilkan')) : null)));

    // ringkasan + laras
    const cnt = (k) => rows.filter((r) => r.status === k).length;
    kids.push(h('section', { class: 'stack', 'aria-labelledby': 'laras-h' },
      h('div', { class: 'sechead sechead--left' }, h('p', { class: 'eyebrow' }, L('Laras', 'Laras')), h('h2', { id: 'laras-h' }, LB('Selisih nang ukuran pilihane maestro', 'Selisih pada ukuran pilihan maestro'))),
      rows.length ? h('p', { class: 'chips' }, [['cedhak', 'near'], ['luwih_dhuwur', 'high'], ['luwih_endhek', 'low'], ['tidak_andal', 'na']].filter(([k]) => cnt(k)).map(([k, c]) => h('span', { class: ['statchip', `statchip--${c}`] }, h('b', { class: 'tnum' }, cnt(k)), STATUS[k]()))) : null,
      rows.length ? h('div', { class: 'tuner-grid' }, rows.map((r) => tuner(r))) : empty(L('Durung enek ukuran sing dibandingno', 'Belum ada ukuran yang dibandingkan'), L('Maestro durung milih ukuran nang unit iki, utowo ora enek ukuran sing andal.', 'Maestro belum memilih ukuran pada unit ini, atau tidak ada ukuran yang andal.')),
      ...((d.comparison && d.comparison.cautions) || []).map((c) => notice(c, 'info'))));

    // irama
    const refA = ud && ud.analysis && ud.analysis.audio, attA = an.audio;
    if (refA && attA && refA.speech_segments && refA.speech_segments.length && attA.speech_segments && attA.speech_segments.length) {
      const lines = tempoLines(al);
      kids.push(h('section', { class: 'stack', 'aria-labelledby': 'irama-h' },
        h('div', { class: 'sechead sechead--left' }, h('p', { class: 'eyebrow' }, L('Irama', 'Irama')), h('h2', { id: 'irama-h' }, LB('Bagian ujaran lan jeda', 'Bagian ujaran dan jeda'))),
        h('div', { class: 'card' }, rhythmCompare({ ref: { segs: refA.speech_segments, duration: refA.duration_s }, att: { segs: attA.speech_segments, duration: attA.duration_s }, alignment: reliable ? al : null }),
          h('p', { class: 'hint' }, L('Batang = bagian sing diomongno; celah = mandeg. Garis lengkung nyambung bagian sing padha isine.', 'Batang = bagian yang diucapkan; celah = jeda. Garis lengkung menghubungkan bagian yang sama isinya.')),
          lines.length ? h('ul', { class: 'plain' }, lines.map((x) => h('li', null, x))) : null)));
    }

    // peringatan analisis
    const warns = (an.warnings || []).filter((w) => w !== 'banyak_orang_terdeteksi' || !d.persons);
    if (warns.length) kids.push(h('section', { class: 'stack', 'aria-label': L('Catetan analisis', 'Catatan analisis') }, h('h2', { class: 'h-sm' }, icon('info'), L('Catetan analisis', 'Catatan analisis')), h('ul', { class: 'plain' }, warns.map((w) => h('li', null, warnText(w))))));

    // pilih penampil
    if (a.is_owner && d.persons && d.persons.count_median >= 2 && a.is_video) kids.push(pickerFor(a, d.persons));

    // milik pemilik: catatan, berbagi, hapus
    if (a.is_owner) {
      const noteForm = form([field(L('Catetan dewe (opsional)', 'Catatan sendiri (opsional)'), 'self_note', { type: 'textarea', rows: 3, maxlength: 1000, value: a.self_note, hint: L('Mung sampeyan sing isok moco. Contone: "jeda kudu dilawakno".', 'Hanya Anda yang dapat membaca. Contoh: "jeda perlu diperpanjang".') })],
        async (f) => { await PATCH(`/api/attempts/${a.id}`, { self_note: f.get('self_note') || '' }); toast(L('Catetan disimpen', 'Catatan disimpan')); }, { submit: L('Simpen catetan', 'Simpan catatan'), ic: 'check' });
      const share = switchEl(L('Bagikno marang maestro', 'Bagikan kepada maestro'), 'share', { checked: a.share_with_maestro, onchange: async (e) => { try { await POST(`/api/attempts/${a.id}/share`, { share: e.target.checked }); toast(e.target.checked ? L('Dibagi nang maestro', 'Dibagikan ke maestro') : L('Pembagian dicabut', 'Pembagian dicabut')); } catch (er) { e.target.checked = !e.target.checked; toast(er.message, 'err'); } } });
      kids.push(h('section', { class: 'grid grid--2 result__own', 'aria-label': L('Latihan iki', 'Latihan ini') },
        h('div', { class: 'card stack' }, h('h2', { class: 'h-sm' }, icon('edit'), L('Catetan', 'Catatan')), noteForm),
        h('div', { class: 'card stack' }, h('h2', { class: 'h-sm' }, icon('shield'), L('Data sampeyan', 'Data Anda')), share,
          h('p', { class: 'hint' }, L(`Rekaman iki bakal kebusak otomatis tanggal ${expiry(a.created_at, days)} (${days} dino). Isok dibusak saiki.`, `Rekaman ini otomatis terhapus pada ${expiry(a.created_at, days)} (${days} hari). Dapat dihapus sekarang.`)),
          h('div', { class: 'actions' }, unit ? h('a', { class: 'btn btn--primary btn--sm', href: `#/unit/${unit.id}/latihan` }, icon('refresh'), L('Nyoba maneh', 'Coba lagi')) : null, deleteBtn(a)))));
    } else kids.push(notice(L('Sampeyan ndelok latihan iki amargo pemaine mbagekno marang sampeyan. Iki selisih deskriptif, dudu nilai.', 'Anda melihat latihan ini karena pemainnya membagikannya kepada Anda. Ini selisih deskriptif, bukan nilai.'), 'info'));

    kids.push(notice(L('Cathetan jujur: se-LARAS mung mbandingno karo SATU contone maestro, nganggo ukuran sing dipilih maestro. Angka iki ora ngomong sampeyan bener utowo salah; sing nemtokno tetep maestro.', 'Catatan jujur: se-LARAS hanya membandingkan dengan SATU contoh maestro, memakai ukuran yang dipilih maestro. Angka ini tidak menyatakan Anda benar atau salah; yang menentukan tetap maestro.'), 'info', 'shield'));
    return kids;
  }

  function paint() {
    clearInterval(tick); clearTimeout(timer); killPlayers();
    const a = data.attempt;
    shown = waiting(a.status) ? 'wait' : a.status;
    const body = waiting(a.status) ? [waitView(a)] : a.status === 'failed' ? [failedView(a)] : doneView(data);
    headEl.replaceChildren(head(a)); bodyEl.replaceChildren(...body);
    if (waiting(a.status)) timer = setTimeout(refetch, 1800);
    void hooks;
  }
  paint();
  return root;
}
