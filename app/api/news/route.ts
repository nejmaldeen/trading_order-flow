import {headers} from 'next/headers';
import {getDb} from '@/db';
import {workspaces} from '@/db/schema';
import {eq} from 'drizzle-orm';
import {activeSession,normalizeWorkspace} from '@/lib/replay';
import {archiveMonth} from '@/lib/news-store';
import {verifiedReports} from '@/lib/news-reports';
import {monthsFor,selectNews,type NewsRecord,type NewsCoverage} from '@/lib/news-archive';
export const dynamic='force-dynamic';
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store'}});
export async function GET(request:Request){
 try{
  const h=await headers(),id=h.get('oai-authenticated-user-id')||(process.env.NODE_ENV!=='production'?'preview-owner':null);
  if(!id)return json({error:'يرجى تسجيل الدخول'},401);
  const q=new URL(request.url).searchParams,cursor=Number(q.get('cursor')),hours=Number(q.get('hours')||24);
  if(!Number.isSafeInteger(cursor)||cursor<Date.UTC(2017,0,1)||cursor>Date.now()||![1,6,24,72,168].includes(hours))return json({error:'وقت فحص غير صالح'},400);
  const row=await getDb().select().from(workspaces).where(eq(workspaces.ownerId,id)).limit(1);
  const session=row[0]?activeSession(normalizeWorkspace(JSON.parse(row[0].stateJson))):null;
  if(!session||session.id!==q.get('sessionId')||cursor>session.cursorTime)return json({error:'تغيرت الجلسة؛ أعد الفحص'},409);
  const records:NewsRecord[]=[...verifiedReports],coverage:NewsCoverage[]=[];
  await Promise.all(monthsFor(cursor,hours).flatMap(month=>(['cpi','empsit','fed'] as const).map(async source=>{
   const result=await archiveMonth(source,month);records.push(...result.records);coverage.push({source,month,ok:!result.error,...(result.error?{error:result.error}:{})});
  })));
  return json({cursor,sessionId:session.id,hours,events:selectNews(records,cursor,hours),coverage});
 }catch{return json({error:'تعذر تحميل أرشيف الأخبار. يمكنك إعادة المحاولة؛ تشغيل الشارت مستقل.'},503);}
}
