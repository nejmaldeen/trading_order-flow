"use client";
import {useEffect,useRef,useState} from 'react';
import {Search,Star,X,ChartNoAxesCombined} from 'lucide-react';
import type {IndicatorKey,IndicatorSettings} from '@/lib/indicators';
const catalog = [
  {id:'sma',name:'المتوسط المتحرك البسيط',code:'SMA',description:'متوسط الإغلاق لعدد الشموع المختار.'},
  {id:'ema',name:'المتوسط المتحرك الأُسّي',code:'EMA',description:'متوسط يمنح الشموع الحديثة وزنًا أكبر.'},
  {id:'bands',name:'نطاقات بولينجر',code:'Bollinger Bands',description:'متوسط متحرك ونطاقان بانحرافين معياريين.'},
  {id:'vwap',name:'متوسط السعر المرجّح بالحجم',code:'VWAP',description:'تقدير يومي من الشموع المعروضة؛ بداية اليوم UTC.'},
  {id:'volume',name:'أحجام التداول',code:'Volume',description:'حجم التداول لكل شمعة أسفل الشارت.'},
] as const;
type Props={open:boolean;onClose:()=>void;settings:IndicatorSettings;onChange:(v:IndicatorSettings)=>void;vwap:boolean;onVwap:(v:boolean)=>void;volume:boolean;onVolume:(v:boolean)=>void};
export default function IndicatorLibrary(p:Props){
 const ref=useRef<HTMLDialogElement>(null);
 const [search,setSearch]=useState('');
 const [category,setCategory]=useState('all');
 const [favorites,setFavorites]=useState<string[]>([]);
 const [ready,setReady]=useState(false);
 useEffect(()=>{try{const v=JSON.parse(localStorage.getItem('replay-indicator-favorites')||'[]');if(Array.isArray(v))setFavorites(v.filter(x=>typeof x==='string'));}catch{}setReady(true);},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem('replay-indicator-favorites',JSON.stringify(favorites));}catch{}},[favorites,ready]);
 useEffect(()=>{if(p.open&&!ref.current?.open)ref.current?.showModal();else if(!p.open&&ref.current?.open)ref.current?.close();},[p.open]);
 const active=(id:string)=>id==='vwap'?p.vwap:id==='volume'?p.volume:p.settings[id as IndicatorKey].enabled;
 const toggle=(id:string)=>{if(id==='vwap')p.onVwap(!p.vwap);else if(id==='volume')p.onVolume(!p.volume);else {const key=id as IndicatorKey;p.onChange({...p.settings,[key]:{...p.settings[key],enabled:!p.settings[key].enabled}});}};
 const rows=catalog.filter(x=>(`${x.name} ${x.code}`.toLowerCase().includes(search.toLowerCase()))&&(category==='all'||category==='favorites'&&favorites.includes(x.id)||category==='active'&&active(x.id)));
 return <dialog ref={ref} className="indicator-dialog" aria-labelledby="indicator-title" onCancel={p.onClose} onClose={p.onClose} dir="rtl">
  <header><h2 id="indicator-title"><ChartNoAxesCombined size={22}/> المؤشرات</h2><button onClick={p.onClose} aria-label="إغلاق المؤشرات"><X/></button></header>
  <label className="indicator-search"><Search size={20}/><input placeholder="ابحث عن مؤشر…" aria-label="البحث عن مؤشر" value={search} onChange={e=>setSearch(e.target.value)}/></label>
  <div className="indicator-browser"><nav aria-label="فئات المؤشرات">{[['all','كل المؤشرات'],['favorites','المفضلة'],['active','على الشارت']].map(([id,label])=><button key={id} aria-pressed={category===id} onClick={()=>setCategory(id)}>{label}</button>)}<p>تُحسب من الشموع المتاحة حتى وقت Replay فقط.</p></nav>
  <div className="indicator-results">{rows.map(x=><article key={x.id}><button className="favorite-indicator" aria-label={`تفضيل ${x.code}`} aria-pressed={favorites.includes(x.id)} onClick={()=>setFavorites(v=>v.includes(x.id)?v.filter(id=>id!==x.id):[...v,x.id])}><Star size={18} fill={favorites.includes(x.id)?'currentColor':'none'}/></button><div><h3>{x.name} <small>{x.code}</small></h3><p>{x.description}</p>{x.id in p.settings&&<label className="indicator-period">الفترة <input aria-label={`فترة ${x.code}`} type="number" min={2} max={200} value={p.settings[x.id as IndicatorKey].period} onChange={e=>{const value=Number(e.target.value);if(Number.isInteger(value)&&value>=2&&value<=200)p.onChange({...p.settings,[x.id]:{...p.settings[x.id as IndicatorKey],period:value}});}}/> شمعة</label>}</div><button className="toggle-indicator" aria-pressed={active(x.id)} onClick={()=>toggle(x.id)}>{active(x.id)?'إزالة':'إضافة'}</button></article>)}{!rows.length&&<div className="indicator-empty">لا توجد مؤشرات هنا. ابحث باسم آخر أو أضف مؤشرًا إلى المفضلة.</div>}<p className="indicator-footnote">المتوسطات تعتمد على التاريخ المحمّل؛ يتحدث آخر جزء منها أثناء تكوّن الشمعة.</p></div></div>
 </dialog>;
}
