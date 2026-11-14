// Penyusun ukuran maestro (rubrik). Hanya ukuran yang tersedia dan andal pada klip acuan yang bisa dipilih, maksimal 6, tanpa skor gabungan.
// Maestro menamai ukuran dengan bahasanya sendiri dan menetapkan toleransi; pelajar hanya melihat selisih terhadap acuan itu.
import { h, icon, num } from '../core/dom.js';
import { PUT } from '../core/api.js';
import { L } from '../core/i18n.js';
import { badge, notice, field, form, toast, nid } from '../core/ui.js';

const MAX = 6;
const SRC = { audio: () => L('suara', 'suara'), pose: () => L('gerak badan', 'gerak badan'), 'pose+audio': () => L('gerak + suara', 'gerak + suara') };
const REOPEN = () => L('Unit iki wis disahno. Nyimpen ukuran anyar bakal mbalekno unit nang draf nganti disahno maneh.', 'Unit ini sudah disahkan. Menyimpan ukuran baru akan mengembalikan unit ke draf sampai disahkan lagi.');

export function rubricPanel(ctx) {
  const { d, u, cat, reload } = ctx;
  const keys = Object.keys(cat);
  const have = new Map(d.rubric.map((r) => [r.metric, r]));
  const avail = new Set(d.available_metrics || []);
  const a = d.analysis;
  const refOf = (k) => { const v = (a && a.audio && a.audio[k] != null ? a.audio[k] : null) ?? (a && a.pose && a.pose[k] != null ? a.pose[k] : null); return typeof v === 'number' ? v : null; };
  const st = {};
  for (const k of keys) { const r = have.get(k); st[k] = { on: !!r, label_sby: r ? r.label_sby : cat[k].sby, label_id: r ? r.label_id : cat[k].id, hint_sby: r ? r.hint_sby : '', hint_id: r ? r.hint_id : '', tol: r ? r.tolerance_pct : 25 }; }
  const count = h('p', { class: 'mcount', role: 'status' });
  const onN = () => keys.filter((k) => st[k].on).length;
  const cards = [];
  const sync = () => { count.textContent = `${onN()} ${L('saka', 'dari')} ${MAX} ${L('ukuran dipilih', 'ukuran dipilih')}`; cards.forEach((c) => c.sync()); };

  function card(k) {
    const c = cat[k], s = st[k], ref = refOf(k), can = avail.has(k);
    const cbId = nid('rd');
    const cb = h('input', { type: 'checkbox', id: cbId, checked: s.on, class: 'rdim__cb' });
    const detail = h('div', { class: 'rdim__detail' });
    const band = () => `${num(Math.max(Math.abs(ref == null ? 0 : ref) * s.tol / 100, c.floor || 0), c.digits)} ${c.unit}`;
    function paint() {
      detail.replaceChildren();
      if (!s.on) return;
      const tolOut = h('output', { class: 'tnum rdim__tolout' });
      const tid = nid('tl');
      const range = h('input', { type: 'range', class: 'range', id: tid, min: '5', max: '100', step: '5', value: String(s.tol) });
      const note = h('p', { class: 'hint' });
      const upd = () => { tolOut.textContent = `±${s.tol}%`; note.textContent = `${L('Dianggep "cedhak" nek selisihe ≤ ', 'Dianggap "dekat" bila selisih ≤ ')}±${band()}${c.floor ? ` (${L('paling cilik', 'minimal')} ±${num(c.floor, c.digits)} ${c.unit} ${L('amergo batas ukur', 'karena batas ukur')})` : ''}.`; };
      range.addEventListener('input', () => { s.tol = Number(range.value); upd(); });
      upd();
      const inp = (name, label, o = {}) => { const f = field(label, `${k}_${name}`, { ...o, value: s[name] }); f.querySelector('input,textarea').addEventListener('input', (e) => { s[name] = e.target.value; }); return f; };
      detail.append(h('div', { class: 'cols-2' }, inp('label_sby', L('Jeneng ukuran (Suroboyoan)', 'Nama ukuran (Suroboyoan)'), { required: true, maxlength: 80 }), inp('label_id', L('Nama ukuran (Indonesia)', 'Nama ukuran (Indonesia)'), { required: true, maxlength: 80 })),
        h('div', { class: 'cols-2' }, inp('hint_sby', L('Pitutur kanggo pelajar (Suroboyoan)', 'Petunjuk untuk pelajar (Suroboyoan)'), { type: 'textarea', rows: 2, maxlength: 400 }), inp('hint_id', L('Petunjuk untuk pelajar (Indonesia)', 'Petunjuk untuk pelajar (Indonesia)'), { type: 'textarea', rows: 2, maxlength: 400 })),
        h('div', { class: 'rdim__tol' }, h('label', { for: tid }, L('Toleransi', 'Toleransi')), range, tolOut), note);
    }
    cb.addEventListener('change', () => { s.on = cb.checked; paint(); sync(); });
    const el = h('article', { class: ['rdim', s.on ? 'is-on' : '', !can && !s.on ? 'is-off' : ''] },
      h('label', { class: 'rdim__head', for: cbId }, cb, h('span', { class: 'rdim__name' }, h('strong', null, L(c.sby, c.id)), h('small', null, L(c.id, c.sby))),
        ref != null ? h('span', { class: 'rdim__ref tnum' }, h('small', null, L('Acuan klip iki', 'Acuan klip ini')), `${num(ref, c.digits)} ${c.unit}`) : null),
      h('div', { class: 'chips rdim__chips' }, badge(SRC[c.src] ? SRC[c.src]() : c.src, '', c.src === 'audio' ? 'mic' : 'body'), c.proxy ? badge(L('perkiraan', 'perkiraan'), 'warn') : null, c.fragile_to_noise ? badge(L('rapuh nek rame', 'rapuh bila berisik'), 'info') : null,
        !can ? badge(s.on ? L('ora andal maneh', 'tidak andal lagi') : L('ora tersedia nang klip iki', 'tidak tersedia pada klip ini'), 'danger', 'alert') : null),
      c.proxy && c.proxy_note ? h('p', { class: 'hint' }, c.proxy_note) : null, detail);
    paint();
    el.sync = () => { cb.disabled = (!s.on && (!can || onN() >= MAX)); el.classList.toggle('is-on', s.on); el.classList.toggle('is-off', !can && !s.on); };
    cards.push(el);
    return el;
  }

  const items = keys.map(card);
  sync();
  const f = form([count, h('div', { class: 'rdims' }, items)], async () => {
    const dims = keys.filter((k) => st[k].on).map((k) => ({ metric: k, label_sby: st[k].label_sby.trim(), label_id: st[k].label_id.trim(), hint_sby: (st[k].hint_sby || '').trim(), hint_id: (st[k].hint_id || '').trim(), tolerance_pct: st[k].tol }));
    const bad = dims.find((x) => !avail.has(x.metric));
    if (bad) throw new Error(L(`Ukuran "${cat[bad.metric].sby}" ora andal nang klip iki; copot centange sik.`, `Ukuran "${cat[bad.metric].id}" tidak andal pada klip ini; lepas centangnya dulu.`));
    await PUT(`/api/units/${u.id}/rubric`, { dims });
    toast(dims.length ? L('Ukuran disimpen', 'Ukuran disimpan') : L('Ukuran dikosongno', 'Ukuran dikosongkan'));
    await reload();
  }, { submit: L('Simpen ukuran', 'Simpan ukuran'), ic: 'check', cls: 'form rform' });
  return h('div', { class: 'stack mpanel', style: { '--gap': '.9rem' } },
    notice(L('Pilih ukuran sing menurutmu ngewakili carane maestro mbawakno. se-LARAS mung nuduhno selisih latihan pelajar karo acuanmu, tanpa skor lan tanpa "bener-salah".', 'Pilih ukuran yang menurutmu mewakili cara maestro membawakan. se-LARAS hanya menunjukkan selisih latihan pelajar dari acuanmu, tanpa skor dan tanpa "benar-salah".'), 'info', 'sliders'),
    u.status === 'validated' ? notice(REOPEN(), 'warn') : null,
    !avail.size ? notice(u.analysis_status === 'failed' ? L('Analisis klip gagal, dadi durung enek ukuran sing isok dipilih.', 'Analisis klip gagal, sehingga belum ada ukuran yang dapat dipilih.') : L('Ukuran isok dipilih sak wise analisis klip rampung.', 'Ukuran dapat dipilih setelah analisis klip selesai.'), 'warn') : null,
    f);
}
void icon;
