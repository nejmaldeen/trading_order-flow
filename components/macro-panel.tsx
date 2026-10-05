"use client";
import {useEffect,useState} from 'react';
import type {MacroSnapshot} from '@/lib/macro';
import type {NewsRecord,NewsCoverage} from '@/lib/news-archive';
import NewsSound from './news-sound';
type Result={cursor:number;sessionId:string;hours:number;events:NewsRecord[];coverage:NewsCoverage[]};
const names:Record<string,string>={cpi:'أسعار المستهلكين CPI',ppi:'أسعار المنتجين PPI',empsit:'الوظائف',fed:'الفيدرالي'};
export default function MacroPanel({data,cursor,sessionId,inspectRequest=0,onEvents}:{data:MacroSnapshot|null;cursor:number;sessionId?:string;inspectRequest?:number;onEvents:(events:NewsRecord[])=>void}){
 const [open,setOpen]=useState(false),[hours,setHours]=useState(24),[retry,setRetry]=useState(0);
 const [result,setResult]=useState<Result|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const hourBucket=Math.floor(cursor/3600000);
 useEffect(()=>{if(inspectRequest)setOpen(true);},[inspectRequest]);
 useEffect(()=>{
  if(!sessionId||!cursor)return;
  const abort=new AbortController();setBusy(true);setError('');setResult(null);onEvents([]);
  fetch(`/api/news?cursor=${cursor}&hours=${hours}&sessionId=${encodeURIComponent(sessionId)}`,{signal:abort.signal})
   .then(async response=>{const body=await response.json() as Result&{error?:string};if(!response.ok)throw new Error(body.error||'تعذر الفحص');return body;})
   .then(body=>{if(!abort.signal.aborted){setResult(body);onEvents(body.events);}})
   .catch(e=>{if(!abort.signal.aborted)setError(e instanceof Error?e.message:'تعذر الفحص');})
   .finally(()=>{if(!abort.signal.aborted)setBusy(false);});
  return()=>abort.abort();
  // At most one background refresh per simulation hour; no requests per candle tick.
 },[hourBucket,open,hours,retry,inspectRequest,sessionId,onEvents]);
 const stale=!!result&&result.cursor!==cursor;
 const next=data?.cursor===cursor?data.events.find(e=>e.status==='upcoming'):undefined;
 const format=(t:number)=>new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh'}).format(t);
 return <div className="macro-panel">
  <NewsSound data={data?.cursor===cursor?data:null}/>
  <button className="macro-toggle" aria-expanded={open} onClick={()=>setOpen(!open)}><span>◉ الاقتصاد والأخبار</span><span>{next?`${next.title} · ${format(next.time)}`:'BTC · ETH'} · {open?'إغلاق':'فحص الفترة'}</span></button>
  {open&&<section className="macro-details" aria-label="أخبار فترة المحاكاة">
   <div className="news-inspection"><header><strong>أخبار فترة المحاكاة</strong><button onClick={()=>setOpen(false)} aria-label="إغلاق الأخبار">×</button></header>
    <p>وقت المحاكاة: {format(cursor)} · الرياض</p>
    <label>الفترة السابقة <select value={hours} onChange={e=>setHours(Number(e.target.value))}><option value={1}>ساعة</option><option value={6}>6 ساعات</option><option value={24}>24 ساعة</option><option value={72}>3 أيام</option><option value={168}>7 أيام</option></select></label>
    <button disabled={busy} onClick={()=>setRetry(v=>v+1)}>{busy?'جار فحص الأرشيف…':'فحص الوقت الحالي'}</button>
    {busy&&<p role="status">تحميل الأخبار مستقل عن الشارت. أول فحص للفترة قد يستغرق بضع ثوانٍ.</p>}
    {error&&<p role="alert">{error}</p>}
    {stale&&<p role="status">تغير وقت المحاكاة. أعد الفحص لعرض أخبار اللحظة الحالية.</p>}
   </div>
   <p className="macro-coverage">المصادر: أسعار المستهلكين CPI وأسعار المنتجين PPI والوظائف الأمريكية وبيانات الفيدرالي، وتقارير سوق موثقة محدودة. ليست تغطية شاملة لأخبار الكريبتو؛ لا يُستنتج غياب الأخبار من غياب النتائج.</p>
   {result&&!stale&&<>
    <details><summary>حالة المصادر للفترة المختارة</summary>{result.coverage.map(c=><p key={c.source+c.month}>{names[c.source]} · {c.month}: {c.ok?'تم فحص الأرشيف':`تغطية غير مكتملة — ${c.error}`}</p>)}</details>
    {!result.events.length&&<p role="status">{result.coverage.every(c=>c.ok)?'لم نجد إصدارًا ضمن الفترة المحددة في المصادر التي فُحصت.':'لا يمكن إكمال الفحص: بعض المصادر غير متاحة لهذه الفترة.'}</p>}
    {result.events.map(e=><article key={e.id}><header><b>{e.title}</b><time>{format(e.time)} · الرياض</time></header><p>{e.summary}</p><a href={e.source} target="_blank" rel="noreferrer">قراءة المصدر ↗</a></article>)}
    <p>التزامن مع الخبر لا يثبت أنه سبب الحركة. قارن توقيته مع تحليلك الفني؛ لا توجد إشارة دخول أو خروج مؤكدة هنا.</p>
   </>}
  </section>}
 </div>;
}
