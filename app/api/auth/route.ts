import { AUTH_COOKIE, AUTH_TTL, privateHosting, passwordMatches, sameOrigin, sessionToken } from '@/lib/personal-auth';

export const dynamic = 'force-dynamic';
let attempts = 0, windowStart = 0;
export async function POST(request: Request) {
  if (!privateHosting()) return new Response(null, { status: 404 });
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (Number(request.headers.get('content-length') ?? 0) > 4096) return new Response(null, { status: 413 });
  const form = await request.formData();
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const common = `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=0`;
  if (form.get('action') === 'logout') return new Response(null, {status:303,headers:{Location:'/', 'Set-Cookie':common, 'Cache-Control':'no-store'}});
  const now = Date.now();
  if (now - windowStart > 60000) { attempts = 0; windowStart = now; }
  // Best-effort per-instance throttling, in addition to a long private password.
  if (++attempts > 10) return new Response('محاولات كثيرة؛ انتظر دقيقة ثم أعد المحاولة.', {status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}});
  const candidate = form.get('password');
  if (typeof candidate !== 'string' || !passwordMatches(candidate)) {
    await new Promise(r => setTimeout(r, 500));
    return new Response(null, {status:303,headers:{Location:'/?login=failed','Cache-Control':'no-store'}});
  }
  return new Response(null, {status:303,headers:{Location:'/', 'Cache-Control':'no-store', 'Set-Cookie':`${AUTH_COOKIE}=${sessionToken()}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${AUTH_TTL}`}});
}
