import { createHash, createHmac, timingSafeEqual } from 'node:crypto';

export const AUTH_COOKIE = 'trading_lab_session';
export const AUTH_TTL = 86400;
export function privateHosting() { return Boolean(process.env.VERCEL || process.env.TURSO_DATABASE_URL); }
function password() {
  const value = process.env.TRADING_LAB_PASSWORD;
  return value && value.length >= 20 && value.length <= 200 ? value : null;
}
export function authConfigured() { return password() !== null; }
function equal(a: string, b: string) {
  return timingSafeEqual(createHash('sha256').update(a).digest(), createHash('sha256').update(b).digest());
}
export function passwordMatches(candidate: string) {
  const expected = password();
  return expected !== null && candidate.length <= 200 && equal(candidate, expected);
}
function sign(expires: string, key: string) {
  return createHmac('sha256', key).update(`trading-lab-personal-v1:${expires}`).digest('hex');
}
export function sessionToken(now = Date.now()) {
  const key = password();
  if (!key) throw new Error('Private access is not configured.');
  const expires = String(Math.floor(now / 1000) + AUTH_TTL);
  return `${expires}.${sign(expires, key)}`;
}
export function validSession(token: string | undefined, now = Date.now()) {
  const key = password();
  if (!key || !token || !/^\d{10}\.[a-f0-9]{64}$/.test(token)) return false;
  const [expires, signature] = token.split('.');
  const seconds = Math.floor(now / 1000);
  return Number(expires) > seconds && Number(expires) <= seconds + AUTH_TTL && equal(signature, sign(expires, key));
}
export function requestOwner(h: Headers) {
  if (privateHosting()) {
    const token = h.get('cookie')?.split(';').map(x => x.trim()).find(x => x.startsWith(AUTH_COOKIE + '='))?.slice(AUTH_COOKIE.length + 1);
    // Never trust a caller-supplied Sites identity header on public Vercel URLs.
    return validSession(token) ? 'personal-owner' : null;
  }
  return h.get('oai-authenticated-user-id') || (process.env.NODE_ENV !== 'production' ? 'preview-owner' : null);
}
export function sameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  const target = new URL(request.url);
  // Next may normalize request.url to localhost behind a proxy. Host retains
  // the browser-facing authority; browser cross-site forms cannot forge Host.
  const host = request.headers.get('host') ?? target.host;
  return origin !== null && origin === `${target.protocol}//${host}`;
}
