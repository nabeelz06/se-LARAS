'use strict';
/**
 * Pengusul anotasi (AI). AI hanya MENGUSULKAN terjemahan Suroboyoan -> Indonesia.
 * Hasilnya selalu berstatus draft_ai sampai disahkan pelaku (validator).
 * Tanpa ANTHROPIC_API_KEY fitur ini nonaktif, bukan dipalsukan.
 */
const SYSTEM = `Kamu membantu mengarsipkan pertunjukan ludruk Surabaya.
Tugas: pecah teks tuturan Suroboyoan (parikan, kidungan, dialog) menjadi segmen pendek dan beri terjemahan Bahasa Indonesia.
Aturan: (1) text_sby harus sama persis dengan teks asli, jangan diperbaiki atau diganti; (2) jangan mengarang makna; bila ragu tulis terjemahan dengan awalan "[ragu] "; (3) jangan menambah segmen yang tidak ada; (4) keluarkan HANYA JSON: {"segments":[{"text_sby":"...","text_id":"..."}]}.`;

function extractJson(text) {
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s < 0 || e < s) throw new Error('Respons AI tidak berisi JSON');
  return JSON.parse(text.slice(s, e + 1));
}

function createAi({ env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const enabled = () => Boolean(env.ANTHROPIC_API_KEY);
  async function suggest(text) {
    if (!enabled()) {
      const err = new Error('AI belum dikonfigurasi (ANTHROPIC_API_KEY kosong). Isi transkrip secara manual.');
      err.status = 503; throw err;
    }
    const res = await fetchImpl('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.AI_MODEL || 'claude-sonnet-5-5', max_tokens: 2000, system: SYSTEM,
        messages: [{ role: 'user', content: text }] }),
    });
    if (!res.ok) { const err = new Error(`Layanan AI gagal (${res.status})`); err.status = 502; throw err; }
    const data = await res.json();
    const out = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    const parsed = extractJson(out);
    const segs = Array.isArray(parsed.segments) ? parsed.segments : [];
    return segs.filter((s) => s && typeof s.text_sby === 'string' && s.text_sby.trim())
      .map((s) => ({ text_sby: s.text_sby.trim(), text_id: String(s.text_id || '').trim() }));
  }
  return { enabled, suggest };
}
module.exports = { createAi };
