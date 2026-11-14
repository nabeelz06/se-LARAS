// Klien API: JSON, FormData, dan unggahan dengan kemajuan (XHR).
export async function api(method, url, body) {
  const opt = { method, headers: {}, credentials: 'same-origin' };
  if (body instanceof FormData) opt.body = body;
  else if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
  let res;
  try { res = await fetch(url, opt); } catch { const e = new Error('Tidak dapat terhubung ke server'); e.offline = true; throw e; }
  let data = null;
  try { data = await res.json(); } catch { /* bukan JSON */ }
  if (!res.ok) { const e = new Error((data && data.error) || `Kesalahan ${res.status}`); e.status = res.status; throw e; }
  return data;
}
export const GET = (u) => api('GET', u);
export const POST = (u, b) => api('POST', u, b === undefined ? {} : b);
export const PUT = (u, b) => api('PUT', u, b);
export const PATCH = (u, b) => api('PATCH', u, b);
export const DEL = (u) => api('DELETE', u);

/** Unggah FormData dengan laporan kemajuan 0..1. Mengembalikan {promise, abort}. */
export function upload(url, formData, onProgress) {
  const xhr = new XMLHttpRequest();
  const promise = new Promise((resolve, reject) => {
    xhr.open('POST', url);
    xhr.withCredentials = true;
    xhr.responseType = 'json';
    xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total); };
    xhr.onerror = () => reject(Object.assign(new Error('Tidak dapat terhubung ke server'), { offline: true }));
    xhr.onabort = () => reject(Object.assign(new Error('Unggahan dibatalkan'), { aborted: true }));
    xhr.onload = () => {
      const data = xhr.response;
      if (xhr.status >= 200 && xhr.status < 300) return resolve(data);
      reject(Object.assign(new Error((data && data.error) || `Kesalahan ${xhr.status}`), { status: xhr.status }));
    };
    xhr.send(formData);
  });
  return { promise, abort: () => xhr.abort() };
}
