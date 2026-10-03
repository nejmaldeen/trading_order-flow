export type MacroEvent = {id:string;title:string;time:number;status:"upcoming"|"released";source:string;summary?:string};
export type MacroSnapshot = {cursor:number;coverage:string;events:MacroEvent[]};
type Record = {id:string;title:string;time:string;known:string;schedule:string;source:string;summary:string};
// Curated original releases. Never import this data module into a client component.
const records:Record[]=[
 {id:"jobs-20260109",title:"الوظائف الأمريكية",time:"2026-01-09T13:30:00Z",known:"2025-12-16T13:30:00Z",schedule:"https://www.bls.gov/news.release/archives/empsit_12162025.htm",source:"https://www.bls.gov/news.release/archives/empsit_01092026.htm",summary:"القراءة المنشورة آنذاك: إضافة 50 ألف وظيفة، والبطالة 4.4%. لم تُدمج مراجعات لاحقة."},
 {id:"cpi-20260113",title:"التضخم الأمريكي CPI",time:"2026-01-13T13:30:00Z",known:"2025-12-18T13:30:00Z",schedule:"https://www.bls.gov/news.release/archives/cpi_12182025.htm",source:"https://www.bls.gov/news.release/archives/cpi_01132026.htm",summary:"التضخم العام: 0.3% شهريًا و2.7% سنويًا. الأساسي: 0.2% شهريًا و2.6% سنويًا، حسب الإصدار الأصلي."},
 {id:"fed-20260128",title:"قرار الفائدة الأمريكية",time:"2026-01-28T19:00:00Z",known:"2024-08-09T17:30:00Z",schedule:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20240809a.htm",source:"https://www.federalreserve.gov/newsevents/pressreleases/monetary20260128a.htm",summary:"ثبّت الاحتياطي الفيدرالي نطاق الفائدة عند 3.50–3.75%، مع الإشارة إلى استمرار ارتفاع التضخم نسبيًا."}
];
export function macroAt(cursor:number):MacroSnapshot {
 return {cursor,coverage:"افتح الأخبار لفحص الأرشيف الرسمي للفترة المختارة. التغطية محدودة بالمصادر المبينة؛ لا تشمل جميع أخبار السوق.",events:records.filter(e=>Date.parse(e.known)<=cursor&&Math.abs(Date.parse(e.time)-cursor)<=31*86400000).map(e=>{
  const time=Date.parse(e.time), released=time<=cursor;
  return {id:e.id,title:e.title,time,status:released?"released":"upcoming",source:released?e.source:e.schedule,...(released?{summary:e.summary}:{})};
 })};
}
