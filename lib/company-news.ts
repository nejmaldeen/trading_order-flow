import type {NewsRecord} from './news-archive.ts';

const companies:Record<string,string>={AAPL:'0000320193',NVDA:'0001045810',AMD:'0000002488',GOOGL:'0001652044'};
type Filings={accessionNumber:string[];acceptanceDateTime:string[];form:string[];primaryDocument:string[];items?:string[]};
const cache=new Map<string,{until:number;body:any}>();
const failures=new Map<string,{until:number;message:string}>();
let gate=Promise.resolve();
async function read(path:string){
  const hit=cache.get(path);if(hit&&hit.until>Date.now())return hit.body;
  const failure=failures.get(path);if(failure&&failure.until>Date.now())throw new Error(failure.message);
  const wait=gate.then(()=>new Promise(r=>setTimeout(r,150)));gate=wait.then(()=>{});await wait;
  const r=await fetch('https://data.sec.gov/submissions/'+path,{headers:{'User-Agent':'TradingLab personal research contact https://github.com/nejmaldeen/trading_order-flow'},signal:AbortSignal.timeout(12000)});
  if(!r.ok){const message=`مصدر SEC غير متاح (${r.status})`;failures.set(path,{until:Date.now()+60000,message});throw new Error(message);}
  const body=await r.json();if(cache.size>=16)cache.delete(cache.keys().next().value!);cache.set(path,{until:Date.now()+300000,body});return body;
}
export function filingEvents(symbol:string,cik:string,rows:Filings,cursor:number,hours:number):NewsRecord[]{
  if(!Array.isArray(rows.accessionNumber)||!Array.isArray(rows.acceptanceDateTime))throw new Error('استجابة SEC لا تتضمن وقت نشر موثقًا');
  return rows.accessionNumber.flatMap((accession,i)=>{
    const stamp=rows.acceptanceDateTime[i];
    // Do not guess a timezone or substitute fiscal period / filing date for publication.
    if(!stamp||!/(Z|[+-]\d{2}:\d{2})$/.test(stamp))return [];
    const time=Date.parse(stamp),form=rows.form[i],document=rows.primaryDocument[i];
    if(!Number.isFinite(time)||time>cursor||time<cursor-hours*3600000||!['8-K','10-Q','10-K','8-K/A','10-Q/A','10-K/A'].includes(form))return [];
    if(!/^\d{10}-\d{2}-\d{6}$/.test(accession)||!document||!/^[-\w.]+$/.test(document))throw new Error('رابط إفصاح SEC غير صالح');
    const items=rows.items?.[i]??'';
    const earnings=items.split(',').some(x=>x.trim()==='2.02');
    return [{id:`sec-${symbol}-${accession}`,title:`${symbol} · ${earnings?'إفصاح نتائج الأعمال':form==='10-Q'?'التقرير الربع سنوي':form==='10-K'?'التقرير السنوي':'إفصاح جوهري'} (${form})`,time,
      source:`https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accession.replaceAll('-','')}/${document}`,
      summary:`نُشر إفصاح ${form} للشركة في وقت قبول SEC الموضح.${items?` البنود: ${items}.`:''} لا تتوفر خلاصة مالية موثقة لهذا الإفصاح داخل التطبيق بعد؛ افتح النص الأصلي. وقت القبول قد يأتي بعد إعلان الشركة، وليس موعد الإعلان الأول بالضرورة.`}];
  });
}
export async function companyNews(symbol:string,cursor:number,hours:number){
  const cik=companies[symbol];if(!cik)return null;
  try{
    const root=await read(`CIK${cik}.json`);
    if(!root.filings?.recent)throw new Error('استجابة سجل SEC غير مكتملة');
    const events=filingEvents(symbol,cik,root.filings.recent,cursor,hours);
    const start=new Date(cursor-hours*3600000).toISOString().slice(0,10),end=new Date(cursor).toISOString().slice(0,10);
    for(const file of root.filings.files??[]){
      if(file.filingTo<start||file.filingFrom>end)continue;
      if(!/^CIK\d+-submissions-\d+\.json$/.test(file.name))throw new Error('فهرس SEC تاريخي غير صالح');
      events.push(...filingEvents(symbol,cik,await read(file.name),cursor,hours));
    }
    return {events,coverage:{source:`SEC · ${symbol}`,month:end.slice(0,7),ok:true}};
  }catch(e){return {events:[],coverage:{source:`SEC · ${symbol}`,month:new Date(cursor).toISOString().slice(0,7),ok:false,error:e instanceof Error?e.message:'تعذر تحميل SEC'}};}
}
