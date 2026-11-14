// Penyunting transkrip untuk maestro: segmen berwaktu dua bahasa. Usulan AI/ASR hanya draf; hanya segmen yang disahkan maestro tampil kepada pelajar.
import { h, icon, mmss } from '../core/dom.js';
import { POST, PATCH, DEL } from '../core/api.js';
import { L, STATUS } from '../core/i18n.js';
import { badge, notice, field, empty, toast } from '../core/ui.js';
import { timeField, nowOf, secOrNull, mbtn, ibtn, formModal, fdObj, parseTime, sec1 } from './mkit.js';

const SRC = { ai: () => L('Usulan AI', 'Usulan AI'), asr: () => L('Hasil ASR (draf)', 'Hasil ASR (draf)') };
const REOPEN = () => L('Unit iki wis disahno. Nyunting segmen sing wis disahno bakal mbalekno unit nang draf nganti disahno maneh.', 'Unit ini sudah disahkan. Menyunting segmen yang sudah disahkan akan mengembalikan unit ke draf sampai disahkan lagi.');
const doubtful = (s) => (s.text_id || '').startsWith('[ragu]');
const ready = (s) => s.status !== 'validated' && !!(s.text_id || '').trim() && !doubtful(s);

function segForm({ sg, ctx }) {
  const { u, player, reload } = ctx;
  const start = timeField(player, L('Wiwit (detik)', 'Mulai (detik)'), 'start_sec', { required: true, value: sg ? sg.start_sec : nowOf(player) });
  const end = timeField(player, L('Rampung (detik, opsional)', 'Selesai (detik, opsional)'), 'end_sec', { value: sg && sg.end_sec != null ? sg.end_sec : '' });
  const sby = field(L('Teks Suroboyoan', 'Teks Suroboyoan'), 'text_sby', { type: 'textarea', rows: 3, required: true, maxlength: 1000, value: sg ? sg.text_sby : '', hint: L('Tulisen persis kayak sing diucapno, ojok dibenerno nang basa Indonesia.', 'Tulis persis seperti yang diucapkan, jangan diperbaiki ke bahasa Indonesia.') });
  const idf = field(L('Terjemahan Indonesia', 'Terjemahan Indonesia'), 'text_id', { type: 'textarea', rows: 3, maxlength: 1000, value: sg ? sg.text_id : '', hint: L('Kudu diisi sakdurunge disahno. Nek durung yakin, awali karo [ragu], trus busaken sak wise dipriksa.', 'Wajib diisi sebelum disahkan. Bila belum yakin, awali dengan [ragu], lalu hapus setelah diperiksa.') });
  const warn = sg && sg.status === 'validated' && u.status === 'validated' ? notice(REOPEN(), 'warn') : null;
  return formModal({
    title: sg ? L('Sunting segmen', 'Sunting segmen') : L('Tambah segmen', 'Tambah segmen'), ic: 'check',
    children: [warn, h('div', { class: 'cols-2' }, start, end), sby, idf],
    onSubmit: async (fd) => {
      const o = fdObj(fd), body = { start_sec: Number(o.start_sec), end_sec: secOrNull(o.end_sec), text_sby: o.text_sby.trim(), text_id: (o.text_id || '').trim() };
      if (body.end_sec != null && body.end_sec <= body.start_sec) throw new Error(L('Rampung kudu sak wise wiwit.', 'Selesai harus setelah mulai.'));
      if (sg) await PATCH(`/api/segments/${sg.id}`, body); else await POST(`/api/units/${u.id}/segments`, { segments: [body] });
      toast(sg ? L('Segmen disimpen (dadi draf)', 'Segmen disimpan (menjadi draf)') : L('Segmen ditambah (draf)', 'Segmen ditambahkan (draf)'));
      await reload();
    },
  });
}

/** Baris "waktu | teks Suroboyoan | terjemahan" -> segmen; mengembalikan {rows, errors}. */
export function parseLines(text, duration) {
  const rows = [], errors = [];
  text.split(/\r?\n/).forEach((raw, i) => {
    const line = raw.trim(); if (!line) return;
    const cells = line.split(/\s*\|\s*|\t+/);
    const n = i + 1;
    const [a, b] = (cells[0] || '').split(/\s*[–—-]\s*/);
    const st = parseTime(a), en = b ? parseTime(b) : null;
    if (st == null || (b && en == null)) return errors.push(`${L('Baris', 'Baris')} ${n}: ${L('wektu ora kewaca (conto 0:12 utowo 0:12-0:15)', 'waktu tidak terbaca (contoh 0:12 atau 0:12-0:15)')}`);
    if (en != null && en <= st) return errors.push(`${L('Baris', 'Baris')} ${n}: ${L('rampung kudu sak wise wiwit', 'selesai harus setelah mulai')}`);
    if (duration && st > duration + 0.5) return errors.push(`${L('Baris', 'Baris')} ${n}: ${L('wektune ngluwihi dowone klip', 'waktunya melebihi panjang klip')}`);
    if (!cells[1] || !cells[1].trim()) return errors.push(`${L('Baris', 'Baris')} ${n}: ${L('teks Suroboyoan kosong', 'teks Suroboyoan kosong')}`);
    rows.push({ start_sec: st, end_sec: en, text_sby: cells[1].trim().slice(0, 1000), text_id: (cells[2] || '').trim().slice(0, 1000) });
  });
  return { rows, errors };
}

function pasteForm(ctx) {
  const { u, reload } = ctx;
  const ta = field(L('Tempelno baris-baris', 'Tempel baris-baris'), 'lines', { type: 'textarea', rows: 9, required: true,
    hint: L('Siji baris = siji segmen: wektu | teks Suroboyoan | terjemahan Indonesia. Conto: 0:12 | Cak, awakmu iku ngomong opo? | Mas, kamu itu bicara apa?', 'Satu baris = satu segmen: waktu | teks Suroboyoan | terjemahan Indonesia. Contoh: 0:12 | Cak, awakmu iku ngomong opo? | Mas, kamu itu bicara apa?') });
  const out = h('p', { class: 'hint', role: 'status', 'aria-live': 'polite' });
  const area = ta.querySelector('textarea');
  area.addEventListener('input', () => {
    const { rows, errors } = parseLines(area.value, u.duration_s);
    out.textContent = errors.length ? errors.slice(0, 3).join(' · ') : rows.length ? `${rows.length} ${L('segmen kewaca', 'segmen terbaca')}.` : '';
    out.classList.toggle('is-bad', errors.length > 0);
  });
  return formModal({
    title: L('Tempel akeh segmen', 'Tempel banyak segmen'), ic: 'check', submit: L('Tambah kabeh', 'Tambahkan semua'), children: [ta, out],
    onSubmit: async (fd) => {
      const { rows, errors } = parseLines(fdObj(fd).lines, u.duration_s);
      if (errors.length) throw new Error(errors[0]);
      if (!rows.length) throw new Error(L('Ora enek baris sing isok dibaca', 'Tidak ada baris yang dapat dibaca'));
      if (rows.length > 200) throw new Error(L('Maksimal 200 segmen sepisan', 'Maksimal 200 segmen sekaligus'));
      await POST(`/api/units/${u.id}/segments`, { segments: rows });
      toast(`${rows.length} ${L('segmen ditambah (draf)', 'segmen ditambahkan (draf)')}`);
      await reload();
    },
  });
}

function suggestForm(ctx) {
  const { u, reload } = ctx;
  const ta = field(L('Teks mentah', 'Teks mentah'), 'text', { type: 'textarea', rows: 8, required: true, maxlength: 4000, hint: L('Tempelno transkrip kasar utowo catetanmu. AI mung nyuwek lan nerjemahno dadi draf; wektune kudu kok atur dewe (kabeh diwiwiti saka 0:00).', 'Tempel transkrip kasar atau catatanmu. AI hanya memecah dan menerjemahkan menjadi draf; waktunya harus kamu atur sendiri (semua dimulai dari 0:00).') });
  return formModal({ title: L('Usulan AI saka teks', 'Usulan AI dari teks'), ic: 'check', submit: L('Gawe draf', 'Buat draf'), children: [notice(L('Hasil AI mesti dipriksa. Terjemahan sing ragu ditandai [ragu] lan ora isok disahno sak durunge dibusak.', 'Hasil AI harus diperiksa. Terjemahan yang ragu ditandai [ragu] dan tidak dapat disahkan sebelum dihapus.'), 'warn'), ta],
    onSubmit: async (fd) => { const r = await POST(`/api/units/${u.id}/segments/suggest`, { text: fdObj(fd).text }); toast(`${r.added} ${L('draf AI ditambah', 'draf AI ditambahkan')}`); await reload(); } });
}

function row(sg, ctx, i) {
  const { player, d, reload, u } = ctx;
  const ok = sg.status === 'validated', doubt = doubtful(sg);
  const nx = d.segments.find((x) => x.start_sec > sg.start_sec);
  const end = sg.end_sec != null ? sg.end_sec : nx ? nx.start_sec : sg.start_sec + 4;
  const loop = player ? ibtn(L('Ulangi bagian iki', 'Ulangi bagian ini'), async () => { player.loop(sg.start_sec, end); }, { ic: 'loop' }) : null;
  return h('li', { class: ['mrow', ok ? '' : 'mrow--draft'], 'data-i': i },
    h('button', { type: 'button', class: 'tx__time tnum', title: `${sec1(sg.start_sec)}${sg.end_sec != null ? ` – ${sec1(sg.end_sec)}` : ''}`, 'aria-label': `${L('Mlumpat nang', 'Lompat ke')} ${mmss(sg.start_sec)}`, onclick: () => player && player.seek(sg.start_sec, true) }, mmss(sg.start_sec)),
    h('div', { class: 'mrow__main' },
      h('p', { class: 'mrow__sby', lang: 'jv' }, sg.text_sby),
      sg.text_id ? h('p', { class: ['mrow__id', doubt ? 'is-doubt' : ''], lang: 'id' }, sg.text_id)
        : h('p', { class: 'mrow__miss' }, icon('alert', { cls: 'icon--sm' }), L('Terjemahan Indonesia durung diisi (kudu sakdurunge disahno).', 'Terjemahan Indonesia belum diisi (wajib sebelum disahkan).')),
      h('div', { class: 'chips' }, badge(STATUS[sg.status] ? STATUS[sg.status]() : sg.status, ok ? 'ok' : 'warn', ok ? 'check' : null), SRC[sg.source] ? badge(SRC[sg.source](), 'info') : null, doubt ? badge(L('Enek [ragu]', 'Ada [ragu]'), 'warn', 'alert') : null)),
    h('div', { class: 'mrow__acts' }, loop,
      ibtn(L('Sunting', 'Sunting'), async () => { segForm({ sg, ctx }); }, { ic: 'edit' }),
      ok ? null : ibtn(doubt ? L('Busak [ragu] sik', 'Hapus [ragu] dulu') : sg.text_id ? L('Sahno segmen iki', 'Sahkan segmen ini') : L('Isi terjemahan sik', 'Isi terjemahan dulu'), async () => { await POST(`/api/segments/${sg.id}/validate`); toast(L('Segmen disahno', 'Segmen disahkan')); await reload(); }, { ic: 'check', disabled: !ready(sg) }),
      ibtn(L('Busak segmen', 'Hapus segmen'), async () => { await DEL(`/api/segments/${sg.id}`); toast(L('Segmen dibusak', 'Segmen dihapus')); await reload(); }, { ic: 'trash', danger: true,
        confirm: ok && u.status === 'validated' ? `${L('Segmen iki wis disahno. ', 'Segmen ini sudah disahkan. ')}${REOPEN()}` : L('Segmen iki bakal dibusak.', 'Segmen ini akan dihapus.') })));
}

export function transcriptPanel(ctx) {
  const { d, u, about, reload } = ctx;
  const segs = d.segments, okN = segs.filter((s) => s.status === 'validated').length, rd = segs.filter(ready);
  const tools = h('div', { class: 'mtools' },
    h('button', { type: 'button', class: 'btn btn--line btn--sm', onclick: () => segForm({ sg: null, ctx }) }, icon('plus'), L('Tambah segmen', 'Tambah segmen')),
    h('button', { type: 'button', class: 'btn btn--line btn--sm', onclick: () => pasteForm(ctx) }, icon('list'), L('Tempel akeh', 'Tempel banyak')),
    about.asr_enabled ? mbtn(L('Transkrip otomatis (ASR)', 'Transkrip otomatis (ASR)'), async () => { const r = await POST(`/api/units/${u.id}/segments/transcribe`); toast(`${r.added} ${L('draf ASR ditambah', 'draf ASR ditambahkan')}`); await reload(); },
      { ic: 'mic', confirm: L('Pengenal ujaran iki ora dilatih nggo Ludruk/Suroboyoan, dadi hasile mesti enek sing salah. Hasile mung ditambahno dadi draf; kowe kudu mriksa lan mbenerno saben baris.', 'Pengenal ujaran ini tidak dilatih untuk Ludruk/Suroboyoan, jadi hasilnya pasti ada yang salah. Hasilnya hanya ditambahkan sebagai draf; kamu harus memeriksa dan memperbaiki tiap baris.'), confirmTitle: L('Transkrip otomatis', 'Transkrip otomatis') }) : null,
    about.ai_text_enabled ? h('button', { type: 'button', class: 'btn btn--line btn--sm', onclick: () => suggestForm(ctx) }, icon('caption'), L('Usulan AI saka teks', 'Usulan AI dari teks')) : null,
    mbtn(`${L('Sahno', 'Sahkan')} ${rd.length} ${L('sing wis siap', 'yang siap')}`, async () => {
      let ok = 0, bad = 0;
      for (const s of rd) { try { await POST(`/api/segments/${s.id}/validate`); ok += 1; } catch { bad += 1; } }
      toast(`${ok} ${L('segmen disahno', 'segmen disahkan')}${bad ? `, ${bad} ${L('gagal', 'gagal')}` : ''}`, bad ? 'err' : 'ok'); await reload();
    }, { ic: 'check', cls: 'btn btn--primary btn--sm', disabled: !rd.length, title: rd.length ? '' : L('Ora enek draf sing wis lengkap', 'Belum ada draf yang lengkap'), confirmTitle: L('Sahno segmen', 'Sahkan segmen'),
      confirm: L(`Sahno ${rd.length} segmen? Pengesahan tegese kowe wis maca lan mriksa teks lan terjemahane. Saben pengesahan dicatet nang buku jejak.`, `Sahkan ${rd.length} segmen? Pengesahan berarti kamu sudah membaca dan memeriksa teks dan terjemahannya. Setiap pengesahan dicatat di buku jejak.`) }));
  return h('div', { class: 'stack mpanel', style: { '--gap': '.9rem' } },
    h('div', { class: 'mhead' }, h('p', { class: 'mcount', role: 'status' }, segs.length ? `${segs.length} ${L('segmen', 'segmen')} · ${okN} ${L('disahno', 'disahkan')} · ${segs.length - okN} ${L('draf', 'draf')}` : L('Durung enek segmen', 'Belum ada segmen')), tools),
    !about.asr_enabled && !about.ai_text_enabled ? notice(L('Transkrip diisi nganggo tangan. se-LARAS ora nggawa model pengenal ujaran Suroboyoan; usulan AI/ASR mung urip nek dipasang admin.', 'Transkrip diisi dengan tangan. se-LARAS tidak membawa model pengenal ujaran Suroboyoan; usulan AI/ASR hanya aktif bila dipasang admin.'), 'info', 'caption') : null,
    segs.length ? h('ol', { class: 'mlist' }, segs.map((s, i) => row(s, ctx, i)))
      : empty(L('Durung enek transkrip', 'Belum ada transkrip'), L('Tulis ucapan nang klip nganggo basa Suroboyoan, trus terjemahno. Tempel akeh baris sepisan isok nggawe luwih cepet.', 'Tulis ucapan di klip dalam bahasa Suroboyoan, lalu terjemahkan. Tempel banyak baris sekaligus bisa lebih cepat.')));
}
