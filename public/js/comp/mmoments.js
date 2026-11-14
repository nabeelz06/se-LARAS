// Penyunting momen: penanda waktu pada klip acuan beserta penjelasan maestro ("kenapa"). Usulan otomatis hanyalah draf; pengetahuan baru ada setelah maestro menulis alasannya lalu mengesahkan.
import { h, icon, mmss } from '../core/dom.js';
import { POST, PATCH, DEL } from '../core/api.js';
import { L, PB, STATUS } from '../core/i18n.js';
import { badge, notice, field, empty, toast } from '../core/ui.js';
import { timeField, nowOf, mbtn, ibtn, formModal, fdObj, sec1 } from './mkit.js';

export const KIND_IC = { jeda: 'clock', gerak: 'body', lain: 'flag' };
export const KIND_TX = { jeda: () => L('Mandeg', 'Jeda'), gerak: () => L('Obahan', 'Gerak'), lain: () => L('Penting', 'Penting') };
const hasWhy = (m) => !!((m.why_id || '').trim() || (m.why_sby || '').trim());
const ready = (m) => m.status !== 'validated' && hasWhy(m) && !!(m.title_id || '').trim();
const REOPEN = () => L('Unit iki wis disahno. Nyunting momen sing wis disahno bakal mbalekno unit nang draf nganti disahno maneh.', 'Unit ini sudah disahkan. Menyunting momen yang sudah disahkan akan mengembalikan unit ke draf sampai disahkan lagi.');

function momentForm({ m, ctx }) {
  const { u, player, reload } = ctx;
  const kind = field(L('Jenis', 'Jenis'), 'kind', { options: [['jeda', L('Mandeg (jeda)', 'Jeda')], ['gerak', L('Obahan (gerak)', 'Gerak')], ['lain', L('Penting liyane', 'Penting lainnya')]], value: m ? m.kind : 'lain' });
  const t = timeField(player, L('Wektu (detik)', 'Waktu (detik)'), 't_sec', { required: true, value: m ? m.t_sec : nowOf(player) });
  const tsby = field(L('Judul (Suroboyoan)', 'Judul (Suroboyoan)'), 'title_sby', { maxlength: 120, value: m ? m.title_sby : '' });
  const tid = field(L('Judul (Indonesia)', 'Judul (Indonesia)'), 'title_id', { required: true, maxlength: 120, value: m ? m.title_id : '' });
  const wsby = field(L('Kenek opo? (Suroboyoan)', 'Kenapa? (Suroboyoan)'), 'why_sby', { type: 'textarea', rows: 4, maxlength: 800, value: m ? m.why_sby : '', hint: L('Iki isine ngelmu maestro: kenek opo momen iki penting, apa sing dirasakno penonton, apa sing ojok ditiru.', 'Inilah isi pengetahuan maestro: mengapa momen ini penting, apa yang dirasakan penonton, apa yang jangan ditiru.') });
  const wid = field(L('Kenapa? (Indonesia)', 'Kenapa? (Indonesia)'), 'why_id', { type: 'textarea', rows: 4, maxlength: 800, value: m ? m.why_id : '', hint: L('Isi salah siji basa wis cukup. Tanpa alasan, momen ora isok disahno.', 'Mengisi salah satu bahasa sudah cukup. Tanpa alasan, momen tidak dapat disahkan.') });
  return formModal({
    title: m ? L('Sunting momen', 'Sunting momen') : L('Tambah momen', 'Tambah momen'), ic: 'check',
    children: [m && m.status === 'validated' && u.status === 'validated' ? notice(REOPEN(), 'warn') : null, m && m.source === 'ai' ? notice(L('Iki usulan otomatis saka analisis klip (jeda dowo/puncak obahan tangan). Dadi ngelmu mung nek kowe nulis alasane.', 'Ini usulan otomatis dari analisis klip (jeda panjang/puncak gerak tangan). Baru menjadi pengetahuan jika kamu menulis alasannya.'), 'info', 'target') : null,
      h('div', { class: 'cols-2' }, kind, t), h('div', { class: 'cols-2' }, tsby, tid), h('div', { class: 'cols-2' }, wsby, wid)],
    onSubmit: async (fd) => {
      const o = fdObj(fd), body = { t_sec: Number(o.t_sec), kind: o.kind, title_sby: (o.title_sby || '').trim(), title_id: o.title_id.trim(), why_sby: (o.why_sby || '').trim(), why_id: (o.why_id || '').trim() };
      if (m) await PATCH(`/api/markers/${m.id}`, body); else await POST(`/api/units/${u.id}/markers`, body);
      toast(m ? L('Momen disimpen (dadi draf)', 'Momen disimpan (menjadi draf)') : L('Momen ditambah (draf)', 'Momen ditambahkan (draf)'));
      await reload();
    },
  });
}

function row(m, ctx) {
  const { player, reload, u } = ctx;
  const ok = m.status === 'validated', why = hasWhy(m);
  return h('li', { class: ['mrow', 'mrow--moment', ok ? '' : 'mrow--draft'] },
    h('div', { class: 'mrow__lead' },
      h('span', { class: ['moment__kind', `moment__kind--${m.kind}`] }, icon(KIND_IC[m.kind] || 'flag'), KIND_TX[m.kind] ? KIND_TX[m.kind]() : m.kind),
      h('button', { type: 'button', class: 'tx__time tnum', title: sec1(m.t_sec), 'aria-label': `${L('Mlumpat nang', 'Lompat ke')} ${mmss(m.t_sec)}`, onclick: () => player && player.seek(m.t_sec, true) }, mmss(m.t_sec))),
    h('div', { class: 'mrow__main' },
      h('h4', { class: 'moment__title' }, PB(m, 'title')),
      why ? h('div', { class: 'moment__why' }, h('span', { class: 'moment__whylabel' }, icon('scroll', { cls: 'icon--sm' }), L('Kenek opo? (jare maestro)', 'Kenapa? (kata maestro)')), PB(m, 'why', { tag: 'p' }))
        : h('p', { class: 'mrow__miss' }, icon('alert', { cls: 'icon--sm' }), L('Durung enek alasane. Tanpa "kenek opo", momen ora isok disahno.', 'Belum ada alasannya. Tanpa "kenapa", momen tidak dapat disahkan.')),
      h('div', { class: 'chips' }, badge(STATUS[m.status] ? STATUS[m.status]() : m.status, ok ? 'ok' : 'warn', ok ? 'check' : null), m.source === 'ai' ? badge(L('Usulan otomatis', 'Usulan otomatis'), 'info', 'target') : null)),
    h('div', { class: 'mrow__acts' },
      ibtn(L('Sunting', 'Sunting'), async () => { momentForm({ m, ctx }); }, { ic: 'edit' }),
      ok ? null : ibtn(why ? L('Sahno momen iki', 'Sahkan momen ini') : L('Tulis alasane sik', 'Tulis alasannya dulu'), async () => { await POST(`/api/markers/${m.id}/validate`); toast(L('Momen disahno', 'Momen disahkan')); await reload(); }, { ic: 'check', disabled: !ready(m) }),
      ibtn(L('Busak momen', 'Hapus momen'), async () => { await DEL(`/api/markers/${m.id}`); toast(L('Momen dibusak', 'Momen dihapus')); await reload(); }, { ic: 'trash', danger: true,
        confirm: ok && u.status === 'validated' ? `${L('Momen iki wis disahno. ', 'Momen ini sudah disahkan. ')}${REOPEN()}` : L('Momen iki bakal dibusak.', 'Momen ini akan dihapus.') })));
}

export function momentsPanel(ctx) {
  const { d, player, reload } = ctx;
  const ms = d.markers, okN = ms.filter((m) => m.status === 'validated').length, rd = ms.filter(ready), proposals = ms.filter((m) => m.source === 'ai' && m.status === 'draft_ai').length;
  const tools = h('div', { class: 'mtools' },
    h('button', { type: 'button', class: 'btn btn--line btn--sm', onclick: () => momentForm({ m: null, ctx }) }, icon('plus'), player ? L('Tambah momen nang wektu saiki', 'Tambah momen di waktu sekarang') : L('Tambah momen', 'Tambah momen')),
    mbtn(`${L('Sahno', 'Sahkan')} ${rd.length} ${L('sing wis siap', 'yang siap')}`, async () => {
      let ok = 0, bad = 0;
      for (const m of rd) { try { await POST(`/api/markers/${m.id}/validate`); ok += 1; } catch { bad += 1; } }
      toast(`${ok} ${L('momen disahno', 'momen disahkan')}${bad ? `, ${bad} ${L('gagal', 'gagal')}` : ''}`, bad ? 'err' : 'ok'); await reload();
    }, { ic: 'check', cls: 'btn btn--primary btn--sm', disabled: !rd.length, title: rd.length ? '' : L('Ora enek momen sing wis ono alasane', 'Belum ada momen yang punya alasan'), confirmTitle: L('Sahno momen', 'Sahkan momen'),
      confirm: L(`Sahno ${rd.length} momen? Pengesahan tegese kowe setuju karo judul lan alasane. Dicatet nang buku jejak.`, `Sahkan ${rd.length} momen? Pengesahan berarti kamu setuju dengan judul dan alasannya. Dicatat di buku jejak.`) }));
  return h('div', { class: 'stack mpanel', style: { '--gap': '.9rem' } },
    h('div', { class: 'mhead' }, h('p', { class: 'mcount', role: 'status' }, ms.length ? `${ms.length} ${L('momen', 'momen')} · ${okN} ${L('disahno', 'disahkan')}` : L('Durung enek momen', 'Belum ada momen')), tools),
    notice(L('Ukuran otomatis mung nuduhno wektu (jeda dowo, puncak obahan). Sing dadi ngelmu iku alasane maestro: kenek opo nang kono penting.', 'Ukuran otomatis hanya menunjuk waktu (jeda panjang, puncak gerak). Yang menjadi pengetahuan adalah alasan maestro: mengapa di situ penting.'), 'info', 'flag'),
    proposals ? notice(L(`${proposals} usulan otomatis nunggu alasanmu. Klik "Sunting" kanggo nulis alasane; sing ora penting dibusak wae.`, `${proposals} usulan otomatis menunggu alasanmu. Klik "Sunting" untuk menulis alasannya; yang tidak penting hapus saja.`), 'warn', 'target') : null,
    ms.length ? h('ol', { class: 'mlist' }, ms.map((m) => row(m, ctx)))
      : empty(L('Durung enek momen', 'Belum ada momen'), L('Putar klip, mandeg nang wektu sing penting, trus klik "Tambah momen". Tulis kenek opo nang kono penting.', 'Putar klip, jeda di waktu yang penting, lalu klik "Tambah momen". Tulis mengapa di situ penting.')));
}
