'use strict';
const crypto = require('crypto');

function hashPassword(pw) {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(pw, salt, 64);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}
function verifyPassword(pw, stored) {
  const [alg, saltHex, keyHex] = String(stored).split('$');
  if (alg !== 'scrypt') return false;
  const key = crypto.scryptSync(pw, Buffer.from(saltHex, 'hex'), 64);
  const expect = Buffer.from(keyHex, 'hex');
  return key.length === expect.length && crypto.timingSafeEqual(key, expect);
}
const b64 = (b) => Buffer.from(b).toString('base64url');
function sign(payload, secret, ttlSec = 7 * 24 * 3600) {
  const body = b64(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec }));
  const mac = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${mac}`;
}
function verify(token, secret) {
  if (typeof token !== 'string') return null;
  const [body, mac] = token.split('.');
  if (!body || !mac) return null;
  const good = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  const a = Buffer.from(mac), c = Buffer.from(good);
  if (a.length !== c.length || !crypto.timingSafeEqual(a, c)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() / 1000 ? p : null;
  } catch { return null; }
}
function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
module.exports = { hashPassword, verifyPassword, sign, verify, parseCookies };
