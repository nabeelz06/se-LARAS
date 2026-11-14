"""Semua rute: tanpa galat konsol, tanpa luber horizontal, dan nol pelanggaran axe-core (terang/gelap, desktop/ponsel)."""
import json

from common import ROOT, Watch, login, shot

AXE = ROOT / 'node_modules' / 'axe-core' / 'axe.min.js'
# (nama, rute, peran)
ROUTES = [
    ('beranda', '/', None), ('unit', '/unit', None), ('cari', '/cari', None), ('kamus', '/kamus', None),
    ('jejak', '/jejak', None), ('tentang', '/tentang', None), ('masuk', '/masuk', None), ('daftar', '/daftar', None),
    ('404', '/tidak-ada', None),
    ('unit-1', '/unit/1', 'murid'), ('studio', '/unit/1/latihan', 'murid'), ('kemajuan', '/kemajuan', 'murid'),
    ('kelas', '/kelas', 'murid'), ('saya', '/saya', 'murid'),
    ('maestro', '/maestro', 'maestro'), ('kelola', '/maestro/1', 'maestro'), ('kelas-1', '/kelas/1', 'maestro'),
    ('admin', '/admin', 'admin'),
]
# (label, lebar, tema, jalankan axe?)
VIEWS = [('desktop-terang', 1360, 'light', True), ('desktop-gelap', 1360, 'dark', True), ('ponsel-terang', 390, 'light', True), ('ponsel-gelap', 390, 'dark', True)]
# Jarak kiri-kanan pada ponsel. Dua pemeriksaan:
#  1) setiap .wrap harus punya padding kiri/kanan >= 12 px (pernah rusak: .pad menimpa padding-inline milik .wrap, sehingga isi halaman
#     menempel ke tepi layar ponsel dan meleset 36 px dari header di desktop);
#  2) teks polos di dalam <main> tidak boleh berada < 8 px dari tepi kiri layar.
EDGE_CHECK = """(() => {
  const out = [];
  for (const e of document.querySelectorAll('main .wrap, .wrap')) {
    const cs = getComputedStyle(e);
    if (parseFloat(cs.paddingLeft) < 12 || parseFloat(cs.paddingRight) < 12) out.push({ wrap: String(e.className).slice(0, 40), pl: cs.paddingLeft, pr: cs.paddingRight });
  }
  const w = document.createTreeWalker(document.querySelector('main') || document.body, NodeFilter.SHOW_TEXT);
  for (let n; (n = w.nextNode());) {
    if (!n.nodeValue.trim()) continue;
    const el = n.parentElement; if (!el || el.closest('.sr, [aria-hidden=true]')) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const b of r.getClientRects()) { if (b.width > 0 && b.height > 0 && b.left < 8) { out.push({ teks: n.nodeValue.trim().slice(0, 28), left: Math.round(b.left) }); break; } }
  }
  return out.slice(0, 5);
})()"""
RUN_AXE = "axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}}).then(r=>r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.slice(0,3).map(n=>n.target.join(' '))})))"
OVERFLOW = """(()=>{const W=window.innerWidth;
const clipped=(e)=>{for(let a=e.parentElement;a&&a!==document.body&&a!==document.documentElement;a=a.parentElement){const o=getComputedStyle(a).overflowX;if(o!=='visible'&&a.getBoundingClientRect().right<=W+1)return true}return false};
const bad=[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.right>W+1&&!e.closest('.sr')&&getComputedStyle(e).position!=='fixed'&&!e.closest('[aria-hidden=true]')&&!clipped(e)}).slice(0,4).map(e=>e.tagName.toLowerCase()+'.'+e.className);
return {sw:document.documentElement.scrollWidth,W,bad}})()"""


def run(pw, base):
    if not AXE.exists():
        raise RuntimeError('axe-core tidak terpasang: jalankan `npm ci` (devDependency)')
    axe_src = AXE.read_text(encoding='utf-8')
    b = pw.chromium.launch()
    problems = []
    checked = 0
    try:
        for label, width, scheme, use_axe in VIEWS:
            ctxs = {}
            for name, route, role in ROUTES:
                if role not in ctxs:
                    c = b.new_context(viewport={'width': width, 'height': 900}, color_scheme=scheme)
                    if role:
                        login(c, base, role)
                    ctxs[role] = c
                page = ctxs[role].new_page()
                watch = Watch(page, f'{label}/{name}')
                page.goto(f'{base}/#{route}')
                page.wait_for_timeout(1800)
                ov = page.evaluate(OVERFLOW)
                if ov['sw'] > ov['W'] or ov['bad']:
                    problems.append(f"{label}/{name}: luber horizontal sw={ov['sw']} lebar={ov['W']} {ov['bad']}")
                if width <= 480:
                    for b in page.evaluate(EDGE_CHECK):
                        problems.append(f"{label}/{name}: jarak kiri-kanan hilang {b}")
                if use_axe:
                    page.evaluate(axe_src)
                    for v in page.evaluate(RUN_AXE):
                        problems.append(f"{label}/{name}: axe {v['impact']} {v['id']} {v['nodes']}")
                if watch.errors:
                    problems.append(f"{label}/{name}: {watch.errors[:2]}")
                checked += 1
                if name in ('beranda', 'maestro', 'admin') and width == 1360 and scheme == 'light':
                    shot(page, f'halaman_{name}', full_page=True)
                page.close()
            for c in ctxs.values():
                c.close()
        assert not problems, f'{len(problems)} masalah dari {checked} pemeriksaan halaman:\n  ' + '\n  '.join(problems[:25])
        return {'halaman_diperiksa': checked}
    finally:
        b.close()
