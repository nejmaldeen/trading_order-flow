import TradingLab from "@/components/trading-lab";
import { headers } from "next/headers";
import { privateHosting, requestOwner, authConfigured } from "@/lib/personal-auth";
export const dynamic = 'force-dynamic';

export default async function Home({searchParams}: {searchParams: Promise<{login?: string}>}) {
  const privateAccess = privateHosting();
  if (privateAccess && !requestOwner(await headers())) {
    const failed = (await searchParams).login === 'failed';
    return <main dir="rtl" style={{minHeight:'100vh',display:'grid',placeItems:'center',background:'#101820',color:'#e5edf5'}}>
      <form action="/api/auth" method="post" style={{width:'min(90vw,380px)',display:'grid',gap:18,padding:28,border:'1px solid #314457',borderRadius:12}}>
        <h1>مختبر التداول الخاص</h1>
        <p>أدخل كلمة الدخول للوصول إلى جلساتك.</p>
        {authConfigured() ? <><label htmlFor="password">كلمة الدخول</label><input id="password" name="password" type="password" autoComplete="current-password" required minLength={20} maxLength={200} style={{padding:12,border:'1px solid #52657a',borderRadius:6}}/><button type="submit" style={{padding:12,background:'#197455',borderRadius:6}}>دخول</button></> : <p>الدخول الخاص لم يُهيأ بعد. اضبط كلمة الدخول في إعدادات الخادم.</p>}
        {failed && <p role="alert">كلمة الدخول غير صحيحة.</p>}
      </form>
    </main>;
  }
  return <><TradingLab />{privateAccess && <form action="/api/auth" method="post" style={{position:'fixed',bottom:28,left:8,zIndex:10000}}><input type="hidden" name="action" value="logout"/><button style={{background:'#253445',color:'white',padding:'4px 9px',borderRadius:4,fontSize:11}}>تسجيل الخروج</button></form>}</>;
}
