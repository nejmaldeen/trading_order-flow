import { AUTH_COOKIE, AUTH_TTL, privateHosting, passwordMatches, sameOrigin, sessionToken } from '@/lib/personal-auth';
import { getDb } from '@/db';
import { allowLoginAttempt } from '@/lib/login-throttle';

export const dynamic = 'force-dynamic';
export async function POST(request: Request) {
  if (!privateHosting()) return new Response(null, { status: 404 });
  if (!sameOrigin(request)) return new Response(null, { status: 403 });
  if (Number(request.headers.get('content-length') ?? 0) > 4096) return new Response(null, { status: 413 });
  if (!request.headers.get('content-type')?.startsWith('application/x-www-form-urlencoded')) return new Response(null,{status:415});
  let form: URLSearchParams;
  try {
    const reader=request.body?.getReader(),chunks:Uint8Array[]=[];let size=0;
    if(reader) for(;;) {
      const {done,value}=await reader.read();if(done)break;
      size+=value.byteLength;if(size>4096){await reader.cancel();return new Response(null,{status:413});}chunks.push(value);
    }
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
    form=new URLSearchParams(new TextDecoder().decode(bytes));
  } catch { return new Response(null,{status:400}); }
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  const common = `${AUTH_COOKIE}=; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=0`;
  if (form.get('action') === 'logout') return new Response(null, {status:303,headers:{Location:'/', 'Set-Cookie':common, 'Cache-Control':'no-store'}});
  try {
    if (!await allowLoginAttempt(await getDb())) return new Response('محاولات كثيرة؛ انتظر دقيقة ثم أعد المحاولة.', {status:429,headers:{'Retry-After':'60','Cache-Control':'no-store'}});
  } catch { return new Response('تعذر التحقق من الدخول؛ أعد المحاولة لاحقًا.',{status:503}); }
  const candidate = form.get('password');
  if (typeof candidate !== 'string' || !passwordMatches(candidate)) {
    await new Promise(r => setTimeout(r, 500));
    return new Response(null, {status:303,headers:{Location:'/?login=failed','Cache-Control':'no-store'}});
  }
  return new Response(null, {status:303,headers:{Location:'/', 'Cache-Control':'no-store', 'Set-Cookie':`${AUTH_COOKIE}=${sessionToken()}; Path=/; HttpOnly; SameSite=Strict${secure}; Max-Age=${AUTH_TTL}`}});
}
