// Pemilih penampil: bila ada lebih dari satu orang di video, pilih kotak orang yang diukur. Dipakai untuk klip acuan maestro dan latihan pemain.
import { h, icon, mmss, clamp, debounce } from '../core/dom.js';
import { L } from '../core/i18n.js';
import { toast, busy } from '../core/ui.js';

/** Kotak orang pada waktu t (kotak ringkasan [t,x1,y1,x2,y2] per ~0,4 detik); null bila jejak tidak ada di dekat waktu itu. */
export const boxAt = (box, t) => {
  if (!box.length) return null;
  const tol = Math.max(1.2, box.length > 1 ? (box[box.length - 1][0] - box[0][0]) / (box.length - 1) : 1.2);
  let best = box[0]; for (const b of box) if (Math.abs(b[0] - t) < Math.abs(best[0] - t)) best = b;
  return Math.abs(best[0] - t) <= tol ? best : null;
};

/**
 * @param {object} o
 * @param {{tracks:Array, selected:number|null}} o.persons  hasil /persons
 * @param {number} o.duration  durasi klip (detik)
 * @param {string} o.framePath  mis. /api/units/3/frame  (diberi ?t=)
 * @param {(trackId:number)=>Promise} o.onChoose  dipanggil saat kotak dipilih
 * @param {string} o.id  id unik untuk judul
 * @param {string|Node} o.title @param {string|Node} o.intro @param {string|Node} o.hint @param {string} o.alt
 */
export function personPicker({ persons, duration, framePath, onChoose, id = 'pick', title, intro, hint, alt, doneText }) {
  const tracks = persons.tracks || [];
  const sel = tracks.find((t) => t.id === persons.selected) || tracks[0];
  const span = Math.max(1, duration || Math.max(...tracks.map((t) => t.last_t), 1));
  let t = sel ? clamp((sel.first_t + sel.last_t) / 2, 0, span) : 0;
  const img = h('img', { class: 'pick__img', alt: alt || L('Bingkai saka video', 'Bingkai dari video'), width: 640, height: 360 });
  const layer = h('div', { class: 'pick__layer' });
  const stage = h('div', { class: 'pick__stage' }, img, layer);
  const lbl = h('span', { class: 'tnum' }, mmss(t));
  const range = h('input', { type: 'range', min: '0', max: String(Math.floor(span * 10) / 10), step: '0.2', value: String(t), class: 'range', 'aria-label': L('Wektu bingkai', 'Waktu bingkai') });
  const paintBoxes = () => {
    layer.replaceChildren(...tracks.map((tr, i) => {
      const b = boxAt(tr.boxes, t); if (!b) return null;
      const on = tr.id === persons.selected;
      const btn = h('button', { type: 'button', class: ['pick__box', on ? 'is-on' : ''], 'aria-pressed': String(on), 'aria-label': `${L('Wong', 'Orang')} ${i + 1}${on ? ` (${L('dipilih', 'dipilih')})` : ''}` }, h('span', null, `${L('Wong', 'Orang')} ${i + 1}`));
      btn.style.left = `${b[1] * 100}%`; btn.style.top = `${b[2] * 100}%`; btn.style.width = `${(b[3] - b[1]) * 100}%`; btn.style.height = `${(b[4] - b[2]) * 100}%`;
      btn.addEventListener('click', async () => {
        if (tr.id === persons.selected) return;
        try { await busy(btn, () => onChoose(tr.id)); toast(doneText || L('Wong wis dipilih. Dianalisis maneh…', 'Orang sudah dipilih. Dianalisis ulang…')); } catch (e) { toast(e.message, 'err'); }
      });
      return btn;
    }));
  };
  const setT = () => { img.src = `${framePath}?t=${t.toFixed(1)}`; lbl.textContent = mmss(t); paintBoxes(); };
  const deb = debounce(setT, 160);
  range.addEventListener('input', () => { t = Number(range.value); lbl.textContent = mmss(t); paintBoxes(); deb(); });
  setT();
  return h('section', { class: 'card pick', 'aria-labelledby': `${id}-h` }, h('h2', { id: `${id}-h`, class: 'h-sm' }, icon('users'), title || L('Ono akeh wong nang video', 'Ada banyak orang di video')),
    intro ? h('p', null, intro) : null, stage, h('div', { class: 'pick__ctl' }, icon('clock', { cls: 'icon--sm' }), range, lbl),
    hint ? h('p', { class: 'hint' }, hint) : null);
}
