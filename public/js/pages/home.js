import { h, icon, num } from '../core/dom.js';
import { GET } from '../core/api.js';
import { S, isStaff } from '../core/state.js';
import { L, LB } from '../core/i18n.js';
import { badge, notice } from '../core/ui.js';
import { stageCurtain } from '../art/curtain.js';
import { gamelanSilhouette } from '../art/gamelan.js';
import { createDancer } from '../art/dancer.js';
import { aksara, AKSARA, ornamentLine } from '../art/ornament.js';
import { motifBg } from '../art/motif.js';
import { unitCard } from '../comp/unitcard.js';
import { onLeave } from '../core/router.js';

function countUp(el, to) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || to < 2) { el.textContent = String(to); return; }
  const t0 = performance.now();
  const f = (now) => { const k = Math.min(1, (now - t0) / 900); el.textContent = String(Math.round(to * (1 - (1 - k) ** 3))); if (k < 1 && el.isConnected) requestAnimationFrame(f); };
  requestAnimationFrame(f);
}

const STEPS = [
  { ic: 'eye', n: 'Nyebeng', sby: ['Ndelok lan ngrungokno', 'Tonton klip maestro. Takarir Suroboyoan lan Indonesia, momen penting, lan alasane ("kenek opo") sing ditulis maestro dewe.'], id: ['Mengamati dan menyimak', 'Tonton klip maestro. Takarir Suroboyoan dan Indonesia, momen penting, dan alasannya yang ditulis maestro sendiri.'] },
  { ic: 'body', n: 'Tedean', sby: ['Nyoba dewe', 'Rekam utowo unggah latihan sampeyan. se-LARAS mbandingno karo ukuran pilihane maestro: jeda, obahe tangan, tempo.'], id: ['Mencoba sendiri', 'Rekam atau unggah latihan Anda. se-LARAS membandingkan dengan ukuran pilihan maestro: jeda, gerak tangan, tempo.'] },
  { ic: 'scroll', n: 'Ngelmu', sby: ['Mangerteni', 'Delok selisihe, ulangi bagian sing perlu, trus tandai wis ngerti. Maestro isok ndelok kemajuan sampeyan nek sampeyan ngidini.'], id: ['Memahami', 'Lihat selisihnya, ulangi bagian yang perlu, lalu tandai sudah paham. Maestro dapat melihat kemajuan Anda bila Anda mengizinkan.'] },
];
const PILLARS = [
  { ic: 'video', t: ['Dokumentasi audiovisual', 'Dokumentasi audiovisual'], d: ['Klip demonstrasi sing wis diizini ing tulisan.', 'Klip demonstrasi dengan izin tertulis.'] },
  { ic: 'chart', t: ['Analisis berbantuan AI', 'Analisis berbantuan AI'], d: ['Jeda, tempo, obahan, irama: deskriptif, ora nilai.', 'Jeda, tempo, gerak, irama: deskriptif, bukan penilaian.'] },
  { ic: 'shield', t: ['Pengetahuan sing disahno maestro', 'Pengetahuan yang disahkan maestro'], d: ['Transkrip, momen, lan "kenek opo" ora tampil sakdurunge disahno.', 'Transkrip, momen, dan "kenapa" tidak tampil sebelum disahkan.'] },
  { ic: 'stage', t: ['Pengalaman belajar', 'Pengalaman belajar'], d: ['Nyebeng, Tedean, Ngelmu nganggo basa Suroboyoan.', 'Nyebeng, Tedean, Ngelmu berbahasa Suroboyoan.'] },
];
const DOES = [
  ['Nyimpen demonstrasi maestro sing wis diizini', 'Menyimpan demonstrasi maestro yang sudah diizinkan'],
  ['Nulis lan nerjemahno ujarane, maestro sing ngesahno', 'Mentranskrip dan menerjemahkan ujarannya; maestro yang mengesahkan'],
  ['Mbandingno ukuran pilihane maestro: jeda, obahe tangan, tempo', 'Membandingkan ukuran pilihan maestro: jeda, gerak tangan, tempo'],
  ['Nuduhno selisih deskriptif, ditulis apa anane', 'Menunjukkan selisih deskriptif, ditulis apa adanya'],
];
const NOT = [
  ['Ora ngekek skor, ranking, utowo "bener-salah"', 'Tidak memberi skor, peringkat, atau "benar-salah"'],
  ['Ora ngganti maestro lan ora nilai kesenian', 'Tidak menggantikan maestro dan tidak menilai kesenian'],
  ['Durung dilatih nganggo data Ludruk (dataset publik durung enek)', 'Belum dilatih dengan data Ludruk (dataset publik belum ada)'],
  ['Model AI-ne umum, dites nang data publik non-Ludruk', 'Model AI-nya umum, diuji pada data publik non-Ludruk'],
];

export async function render() {
  const [stats, list] = await Promise.all([GET('/api/stats').catch(() => null), GET('/api/units').catch(() => ({ units: [] }))]);
  const dancer = createDancer({ size: 360 });
  onLeave(() => dancer.stop && dancer.stop());
  const hero = h('section', { class: 'hero on-stage', 'aria-labelledby': 'hero-h' },
    h('div', { class: 'hero__bg' }, stageCurtain(), h('div', { class: 'hero__floor' }), gamelanSilhouette({ cls: 'hero__gamelan' })),
    h('div', { class: 'wrap hero__in' },
      h('div', { class: 'hero__text' },
        h('p', { class: 'eyebrow eyebrow--stage' }, aksara(AKSARA.ludruk), ' ', L('Ludruk Suroboyo · Jawa Timur', 'Ludruk Surabaya · Jawa Timur')),
        h('h1', { id: 'hero-h', class: 'hero__title' }, LB('Latihan Ludruk soko maestro, kanggo pemain sakteruse.', 'Latihan Ludruk dari maestro, untuk pemain berikutnya.')),
        h('p', { class: 'hero__lead' }, LB('Maestro ngrekam siji demonstrasi, nentokno opo sing kudu dijogo, lan ngesahno terjemahane. se-LARAS mbantu nyatet, nerjemahno, lan mbandingno latihane arek enom karo conto iku. Tanpa skor, ora ngganti maestro.', 'Maestro merekam satu demonstrasi, menentukan apa yang perlu diperhatikan, dan mengesahkan terjemahannya. se-LARAS membantu mencatat, menerjemahkan, dan membandingkan latihan pemain muda dengan contoh itu. Tanpa skor, tanpa menggantikan maestro.')),
        h('div', { class: 'actions hero__cta' }, h('a', { class: 'btn btn--gold btn--lg', href: '#/unit' }, icon('play'), L('Wiwit nyebeng', 'Mulai menonton')), h('a', { class: 'btn btn--line btn--lg', href: '#/tentang' }, L('Yo opo cara kerjane?', 'Bagaimana cara kerjanya?'))),
        h('ul', { class: 'hero__pledges' }, [['shield', L('Maestro sing ngesahno', 'Maestro yang mengesahkan')], ['target', L('Ora enek skor', 'Tanpa skor')], ['lock', L('Data sampeyan, isok dibusak', 'Data Anda, dapat dihapus')]].map(([ic, t]) => h('li', null, icon(ic), t)))),
      h('figure', { class: 'hero__art' }, dancer, h('figcaption', null, L('Ilustrasi: garis emas = conto maestro; garis teal = bayangan latihan sing telat sithik. Ukurane se-LARAS nang video asli.', 'Ilustrasi: garis emas = contoh maestro; garis teal = bayangan latihan yang sedikit tertinggal. Pengukuran se-LARAS pada video sesungguhnya.')))));

  // tiga langkah
  const steps = h('section', { class: 'section', id: 'cara', 'aria-labelledby': 'steps-h' }, h('div', { class: 'wrap' },
    h('header', { class: 'sechead reveal' }, h('p', { class: 'eyebrow' }, L('Jalur belajar', 'Jalur belajar')), h('h2', { id: 'steps-h' }, LB('Telung langkah: nyebeng, tedean, ngelmu', 'Tiga langkah: nyebeng (mengamati), tedean (mencoba), ngelmu (memahami)')), ornamentLine()),
    h('ol', { class: 'steps' }, STEPS.map((s, i) => h('li', { class: 'step reveal', style: { '--d': `${i * 90}ms` } },
      h('span', { class: 'step__no', 'aria-hidden': 'true' }, i + 1), h('span', { class: 'step__ic' }, icon(s.ic)), h('h3', null, s.n), h('p', { class: 'step__sub' }, L(s.sby[0], s.id[0])), h('p', null, L(s.sby[1], s.id[1]))))),
    h('p', { class: 'hint center', style: { marginTop: '1rem' } }, L('Jalur iki rancangan tim lan durung disahno maestro (lihat Tentang).', 'Jalur ini rancangan tim dan belum disahkan maestro (lihat Tentang).'))));

  // empat unsur
  const pillars = h('section', { class: 'section section--tint pillars', 'aria-labelledby': 'pil-h' }, motifBg('kawung', { cell: 64, cls: 'pillars__bg' }), h('div', { class: 'wrap' },
    h('header', { class: 'sechead reveal' }, h('p', { class: 'eyebrow' }, L('Alur sistem', 'Alur sistem')), h('h2', { id: 'pil-h' }, LB('Papat perkoro, siji urutan', 'Empat unsur, satu alur'))),
    h('ol', { class: 'flow' }, PILLARS.map((p, i) => h('li', { class: 'flow__item reveal', style: { '--d': `${i * 90}ms` } }, h('span', { class: 'flow__ic' }, icon(p.ic)), h('h3', null, L(p.t[0], p.t[1])), h('p', null, L(p.d[0], p.d[1])), i < PILLARS.length - 1 ? h('span', { class: 'flow__arrow', 'aria-hidden': 'true' }, icon('arrow-right')) : null))),
    h('p', { class: 'flow__gate reveal' }, icon('shield'), L('Maestro dadi gerbang: apa sing durung disahno ora tampil nang pelajar.', 'Maestro menjadi gerbang: apa yang belum disahkan tidak tampil bagi pelajar.'))));

  // jujur: apa dan bukan
  const honest = h('section', { class: 'section', 'aria-labelledby': 'hon-h' }, h('div', { class: 'wrap' },
    h('header', { class: 'sechead reveal' }, h('p', { class: 'eyebrow' }, L('Apa anane', 'Apa adanya')), h('h2', { id: 'hon-h' }, LB('Sing dilakoni se-LARAS, lan sing ora', 'Yang dilakukan se-LARAS, dan yang tidak'))),
    h('div', { class: 'cols-2 honest' },
      h('div', { class: 'card honest__do reveal' }, h('h3', null, icon('check'), L('se-LARAS nglakoni', 'se-LARAS melakukan')), h('ul', { class: 'ticks' }, DOES.map(([a, b]) => h('li', null, L(a, b))))),
      h('div', { class: 'card honest__not reveal' }, h('h3', null, icon('x'), L('se-LARAS ora nglakoni', 'se-LARAS tidak melakukan')), h('ul', { class: 'ticks ticks--x' }, NOT.map(([a, b]) => h('li', null, L(a, b))))))));

  // unit
  const feat = (list.units || []).slice(0, 3);
  const units = h('section', { class: 'section section--tint', 'aria-labelledby': 'unit-h' }, h('div', { class: 'wrap' },
    h('header', { class: 'sechead sechead--row reveal' }, h('div', null, h('p', { class: 'eyebrow' }, L('Unit latihan', 'Unit latihan')), h('h2', { id: 'unit-h' }, LB('Wiwiti soko sing wis disahno', 'Mulai dari yang sudah disahkan'))), h('a', { class: 'btn btn--line', href: '#/unit' }, L('Kabeh unit', 'Semua unit'), icon('arrow-right'))),
    feat.length ? h('div', { class: 'grid grid--cards' }, feat.map((u) => unitCard(u))) : h('p', { class: 'muted' }, L('Durung enek unit sing disahno.', 'Belum ada unit yang disahkan.')),
    feat.some((u) => u.is_demo) ? h('div', { style: { marginTop: '1.2rem' } }, notice(L('Unit "conto uji" digawe tim kanggo mbuktekno alur; isine dudu konten maestro, lan audio-ne Inggris. Maestro asli bakal ngganti iki.', 'Unit "contoh uji" dibuat tim untuk membuktikan alur; isinya bukan konten maestro dan audionya berbahasa Inggris. Konten maestro asli akan menggantikannya.'), 'warn')) : null));

  // angka
  const real = stats ? stats.units_validated : 0;
  const nums = stats ? [[real, L('unit maestro', 'unit maestro')], [stats.segments_validated, L('segmen disahno', 'segmen disahkan')], [stats.markers_validated, L('momen + alasan', 'momen + alasan')], [stats.glossary_validated, L('istilah disahno', 'istilah disahkan')], [stats.maestros, L('maestro/praktisi', 'maestro/praktisi')]] : [];
  const statEls = nums.map(([n, label]) => { const b = h('b', { class: 'stat__n tnum' }, '0'); return { n, el: b, node: h('li', { class: 'stat' }, b, h('span', null, label)) }; });
  const statBand = stats ? h('section', { class: 'section statband', 'aria-labelledby': 'stat-h' }, h('div', { class: 'wrap' },
    h('h2', { id: 'stat-h', class: 'sr' }, L('Angka saiki', 'Angka saat ini')), h('ul', { class: 'stats' }, statEls.map((x) => x.node)),
    real === 0 ? h('p', { class: 'statband__note' }, icon('info'), L(`Apa anane: durung enek unit saka maestro asli. Prototipe iki nyedhiyakno ${stats.units_demo} unit conto uji kanggo peragaan.`, `Apa adanya: belum ada unit dari maestro asli. Prototipe ini menyediakan ${stats.units_demo} unit contoh uji untuk peragaan.`)) : null)) : null;
  if (statBand) requestAnimationFrame(() => statEls.forEach((x) => countUp(x.el, x.n)));

  // ajakan
  const cta = h('section', { class: 'section cta on-stage' }, h('div', { class: 'cta__bg' }, motifBg('kawung', { cell: 56, cls: 'cta__motif' })), h('div', { class: 'wrap cta__in' },
    h('div', null, h('h2', null, LB('Sampeyan maestro utowo praktisi Ludruk?', 'Anda maestro atau praktisi Ludruk?')), h('p', null, L('Rekam siji demonstrasi, tentokno ukurane, sahno terjemahane. Karyamu isok digunakno arek-arek enom nang Surabaya lan Jawa Timur. Sampeyan sing nyekel izin lan isok narik kapan wae.', 'Rekam satu demonstrasi, tentukan ukurannya, sahkan terjemahannya. Karya Anda dapat digunakan pemain muda di Surabaya dan Jawa Timur. Anda yang memegang izin dan dapat menariknya kapan saja.'))),
    h('div', { class: 'actions' }, S.user ? (isStaff() ? h('a', { class: 'btn btn--gold btn--lg', href: '#/maestro' }, L('Bukak dasbor maestro', 'Buka dasbor maestro')) : h('a', { class: 'btn btn--gold btn--lg', href: '#/tentang' }, L('Yo opo dadi maestro nang se-LARAS', 'Cara menjadi maestro di se-LARAS'))) : h('a', { class: 'btn btn--gold btn--lg', href: '#/daftar' }, L('Ndaftar', 'Daftar')), h('a', { class: 'btn btn--line btn--lg', href: '#/tentang' }, L('Maca izin lan data', 'Baca soal izin dan data')))));
  void num; void badge;
  return h('div', { class: 'home' }, hero, steps, pillars, honest, units, statBand, cta);
}
