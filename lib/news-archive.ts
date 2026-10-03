// Server-only collectors: original releases, never revised time-series values.
export type NewsRecord={id:string;title:string;time:number;source:string;summary:string};
export type NewsCoverage={source:string;month:string;ok:boolean;error?:string};
export type NewsSource='cpi'|'empsit'|'fed';
export const DAY=86400000;
export function plain(html:string){return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();}
export function easternTime(year:number,month:number,day:number,hour:number,minute:number){
 const base=Date.UTC(year,month-1,day,hour,minute);
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(base));
 const local=Number(parts.find(p=>p.type==='hour')!.value);
 return base+((hour-local+24)%24)*3600000;
}
export function releaseLinks(html:string,kind:'cpi'|'empsit',month:string){
 const [y,m]=month.split('-');
 return [...new Set([...html.matchAll(new RegExp(`/news\\.release/archives/${kind}_(\\d{2})(\\d{2})(\\d{4})\\.htm`,'g'))].filter(x=>x[1]===m&&x[3]===y).map(x=>'https://www.bls.gov'+x[0]))];
}
export function parseRelease(html:string,url:string):NewsRecord{
 const text=plain(html), path=/\/(cpi|empsit)_(\d{2})(\d{2})(\d{4})\.htm$/.exec(url);
 if(!path||!text.includes('embargoed until'))throw new Error('تعذر التحقق من الإصدار الأصلي');
 const stamp=/embargoed until.{0,50}?(\d{1,2}):(\d{2})\s*a\.m\.\s*\((?:ET|EST|EDT)\)/i.exec(text);
 if(!stamp)throw new Error('وقت النشر غير موثق');
 const monthNames=['January','February','March','April','May','June','July','August','September','October','November','December'];
 const header=text.slice(text.indexOf('embargoed until'),text.indexOf('embargoed until')+160);
 const printedDate=new RegExp(monthNames[+path[2]-1]+'\\s+'+(+path[3])+',?\\s+'+path[4],'i');
 if(!printedDate.test(header))throw new Error('تاريخ الإصدار لا يطابق رابط الأرشيف');
 const time=easternTime(+path[4],+path[2],+path[3],+stamp[1],+stamp[2]);
 const body=path[1]==='cpi'?/The Consumer Price Index for All Urban Consumers[\s\S]*?(?=Table A\.|The index for|$)/i.exec(text)?.[0]:/(?:Total|Both) nonfarm payroll employment[\s\S]*?(?=This news release|Household Survey|$)/i.exec(text)?.[0];
 if(!body)throw new Error('تعذر قراءة محتوى الإصدار');
 return {id:path[1]+'-'+path[4]+path[2]+path[3],title:path[1]==='cpi'?'التضخم الأمريكي CPI':'الوظائف الأمريكية',time,source:url,summary:'مقتطف الإصدار الأصلي (بالإنجليزية): '+body.slice(0,700)};
}
export async function fetchText(url:string){
 const r=await fetch(url,{signal:AbortSignal.timeout(12000),headers:{Accept:'text/html'}});
 if(!r.ok)throw new Error('المصدر غير متاح ('+r.status+')');
 const text=await r.text();if(text.length>4000000)throw new Error('حجم المصدر غير متوقع');return text;
}
export async function collectMonth(kind:NewsSource,month:string,read=fetchText):Promise<NewsRecord[]>{
 if(kind==='fed'){
  const year=month.slice(0,4),index=await read('https://www.federalreserve.gov/monetarypolicy/'+(+year>=new Date().getUTCFullYear()-5?'fomccalendars.htm':'fomchistorical'+year+'.htm'));
  const links=[...new Set(index.match(/\/newsevents\/pressreleases\/monetary\d{8}a\.htm/g)||[])];
  if(!links.some(l=>l.includes('monetary'+year)))throw new Error('أرشيف الفيدرالي لا يغطي السنة المختارة');
  return Promise.all(links.filter(l=>l.includes('monetary'+month.replace('-',''))).map(async path=>{
   const source='https://www.federalreserve.gov'+path,text=plain(await read(source));
   const stamp=/For release at (\d{1,2}):(\d{2}) p\.m\. (?:EDT|EST)/i.exec(text);
   if(!stamp)throw new Error('تعذر التحقق من وقت بيان الفيدرالي');
   const date=/monetary(\d{4})(\d{2})(\d{2})/.exec(path)!;
   return {id:'fed-'+date[1]+date[2]+date[3],title:'بيان الاحتياطي الفيدرالي',time:easternTime(+date[1],+date[2],+date[3],+stamp[1]%12+12,+stamp[2]),source,summary:'صدر بيان رسمي للفيدرالي. راجع نص البيان الأصلي لتقييم الفائدة والسيولة؛ لا تتوفر توقعات السوق التاريخية للمقارنة.'};
  }));
 }
 const links=releaseLinks(await read('https://www.bls.gov/bls/news-release/'+kind+'.htm'),kind,month);
 if(!links.length)throw new Error('لا توجد إصدارات مؤرشفة موثقة لهذا الشهر في المصدر');
 return Promise.all(links.slice(0,5).map(async url=>parseRelease(await read(url),url)));
}
export function selectNews(records:NewsRecord[],cursor:number,hours:number){
 return [...new Map(records.filter(e=>e.time<=cursor&&e.time>=cursor-hours*3600000).map(e=>[e.id,e])).values()].sort((a,b)=>b.time-a.time);
}
export function monthsFor(cursor:number,hours:number){
 return [...new Set([new Date(cursor-hours*3600000).toISOString().slice(0,7),new Date(cursor).toISOString().slice(0,7)])];
}
