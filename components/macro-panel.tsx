"use client";
import {useState} from "react";
import type {MacroSnapshot} from "@/lib/macro";
export default function MacroPanel({data,cursor}:{data:MacroSnapshot|null;cursor:number}){
 const [open,setOpen]=useState(false);
 if(!data||data.cursor!==cursor)return null;
 const next=data.events.find(e=>e.status==='upcoming');
 const released=data.events.filter(e=>e.status==='released');
 const last=released.at(-1);
 const minutes=next?Math.ceil((next.time-cursor)/60000):null;
 const nearby=minutes!==null&&minutes<=60;
 const fresh=last&&cursor-last.time<3600000;
 const format=(time:number)=>new Intl.DateTimeFormat('ar-SA',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Riyadh'}).format(time);
 return <div className="macro-panel">
  <button className={`macro-toggle ${nearby||fresh?'macro-alert':''}`} aria-expanded={open} onClick={()=>setOpen(!open)}><span>◉ الاقتصاد والأخبار</span><span role="status">{nearby?`${next!.title} بعد ${minutes} د`:fresh?`صدر: ${last.title}`:'BTC · ETH'} <small>{open?'إغلاق':'التفاصيل'}</small></span></button>
  {open&&<section className="macro-details" aria-label="سياق الاقتصاد الكلي">
   <p className="macro-coverage">{data.coverage}</p>
   <div className="macro-answers"><div><small>البيئة العامة</small><strong>غير محسومة</strong><p>لا تكفي هذه الإصدارات وحدها للحكم على اتجاه BTC أو ETH.</p></div><div><small>خطر الحدث</small><strong>{nearby?'حدث قريب · راقب التذبذب':fresh?'خبر حديث · راقب التذبذب':'راجع التقويم المتاح'}</strong><p>غياب تنبيه لا يعني غياب الأخبار أو المخاطر.</p></div><div><small>التوافق مع استراتيجيتك</small><strong>يحتاج تحققًا</strong><p>راجع شروط السيولة وVWAP بعد استقرار الحركة؛ قواعد الاستراتيجية غير مربوطة بعد.</p></div></div>
   {next&&<article><header><b>القادم · {next.title}</b><time>{format(next.time)} · الرياض</time></header><p>موعد معلن وقت المحاكاة. النتيجة مخفية حتى صدورها.</p><a href={next.source} target="_blank" rel="noreferrer">مصدر إعلان الموعد ↗</a></article>}
   {[...released].reverse().map(e=><article key={e.id}><header><b>صدر · {e.title}</b><time>{format(e.time)} · الرياض</time></header><p>{e.summary}</p><p>قراءة تدريبية: قد يعيد الإصدار تسعير توقعات الفائدة والمخاطرة. لا توجد توقعات سوق تاريخية موثقة هنا لتحديد المفاجأة أو استنتاج اتجاه السعر.</p><a href={e.source} target="_blank" rel="noreferrer">الإصدار الرسمي ↗</a></article>)}
   {!data.events.length&&<p>لا تتوفر أحداث موثقة لهذه اللحظة في التغطية الحالية.</p>}
  </section>}
 </div>;
}
