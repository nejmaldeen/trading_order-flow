"use client";
import {useEffect,useRef,useState,type RefObject} from 'react';
import type {IChartApi,ISeriesApi,UTCTimestamp} from 'lightweight-charts';
import type {Candle} from '@/lib/replay';
type Point={time:number;price:number};
type Shape={kind:string;a:Point;b:Point;text?:string};
const names:Record<string,string>={horizontal:'خط أفقي',trend:'خط اتجاه',rectangle:'منطقة سعرية',fib:'فيبوناتشي',measure:'قياس',text:'ملاحظة'};
export default function ChartDrawings({chart,series,candles,storageKey,onActive}:{chart:RefObject<IChartApi|null>;series:RefObject<ISeriesApi<'Candlestick'>|null>;candles:Candle[];storageKey:string;onActive:(v:boolean)=>void}){
 const [mode,setMode]=useState(''),[hidden,setHidden]=useState(false),[shapes,setShapes]=useState<Shape[]>([]),[text,setText]=useState('ملاحظة'),[ready,setReady]=useState(false);
 const anchor=useRef<Point|null>(null),svg=useRef<SVGSVGElement>(null), data=useRef(candles);data.current=candles;
 useEffect(()=>{setReady(false);try{const raw=JSON.parse(localStorage.getItem(storageKey)||'[]');setShapes(Array.isArray(raw)?raw.filter(x=>names[x.kind]&&[x.a?.time,x.a?.price,x.b?.time,x.b?.price].every(Number.isFinite)).slice(-100):[]);}catch{setShapes([]);}setReady(true);anchor.current=null;setMode('');},[storageKey]);
 useEffect(()=>{if(ready)try{localStorage.setItem(storageKey,JSON.stringify(shapes));}catch{}},[shapes,storageKey,ready]);
 useEffect(()=>{onActive(Boolean(mode));anchor.current=null;return()=>onActive(false);},[mode,onActive]);
 useEffect(()=>{
  const c=chart.current,s=series.current;if(!c||!s||!mode)return;
  const click=(e:{point?:{x:number;y:number}})=>{
   if(!e.point||!data.current.length)return;
   const logical=c.timeScale().coordinateToLogical(e.point.x),price=s.coordinateToPrice(e.point.y);
   if(logical===null||price===null||price<=0)return;
   const bar=data.current[Math.max(0,Math.min(data.current.length-1,Math.round(logical)))];
   const p={time:bar.openTime,price};
   if(!anchor.current&&mode!=='horizontal'&&mode!=='text'){anchor.current=p;return;}
   const origin=anchor.current??p;
   setShapes(v=>[...v.slice(-99),{kind:mode,a:origin,b:p,text}]);anchor.current=null;setMode('');
  };
  c.subscribeClick(click);return()=>c.unsubscribeClick(click);
 },[mode,chart,series,text,candles.length]);
 useEffect(()=>{
  let frame=0,previous="";
  const render=()=>{

   const c=chart.current,s=series.current,root=svg.current;
   if(c&&s&&root){
    const signature = hidden ? 'hidden' : JSON.stringify([c.timeScale().width(),data.current.length,data.current[0]?.openTime,shapes.map(q=>[c.timeScale().timeToCoordinate(q.a.time/1000 as UTCTimestamp),c.timeScale().timeToCoordinate(q.b.time/1000 as UTCTimestamp),s.priceToCoordinate(q.a.price),s.priceToCoordinate(q.b.price)])]);
    if(signature===previous){frame=requestAnimationFrame(render);return;} previous=signature;
    const times=data.current.map(b=>b.openTime);
    const x=(time:number)=>{const exact=times.indexOf(time);let idx=exact;if(idx<0){idx=times.findIndex(t=>t>time)-1;if(idx===-2)idx=times.length-1;}return idx<0?null:c.timeScale().logicalToCoordinate(idx as never);};
    root.replaceChildren();
    const add=(tag:string,attrs:Record<string,string|number>,content?:string)=>{const el=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const [k,v]of Object.entries(attrs))el.setAttribute(k,String(v));if(content)el.textContent=content;root.appendChild(el);};
    if(!hidden)for(const q of shapes){
     if(q.a.time>times.at(-1)!||q.b.time>times.at(-1)!)continue;
     const ax=x(q.a.time),bx=x(q.b.time),ay=s.priceToCoordinate(q.a.price),by=s.priceToCoordinate(q.b.price);if(ax===null||bx===null||ay===null||by===null)continue;
     const line=(x1:number,y1:number,x2:number,y2:number)=>add('line',{x1,y1,x2,y2,stroke:'#b6a3ef','stroke-width':1.5});
     if(q.kind==='horizontal')line(0,ay,c.timeScale().width(),ay);
     else if(q.kind==='rectangle')add('rect',{x:Math.min(ax,bx),y:Math.min(ay,by),width:Math.abs(bx-ax),height:Math.abs(by-ay),fill:'#9173df18',stroke:'#b6a3ef'});
     else if(q.kind==='fib')for(const ratio of [0,.236,.382,.5,.618,.786,1]){const y=ay+(by-ay)*ratio;line(Math.min(ax,bx),y,Math.max(ax,bx),y);add('text',{x:Math.max(ax,bx)+4,y,fill:'#cbbbf5','font-size':12},`${ratio} · ${(q.a.price+(q.b.price-q.a.price)*ratio).toFixed(2)}`);}
     else if(q.kind==='text')add('text',{x:ax,y:ay,fill:'#eee','font-size':14},q.text);
     else {line(ax,ay,bx,by);if(q.kind==='measure')add('text',{x:(ax+bx)/2,y:(ay+by)/2-8,fill:'#eee','font-size':13},`${(q.b.price-q.a.price).toFixed(2)} · ${((q.b.price/q.a.price-1)*100).toFixed(2)}% · ${Math.abs(q.b.time-q.a.time)/60000}m`);}
    }
   }
   frame=requestAnimationFrame(render);
  };frame=requestAnimationFrame(render);return()=>cancelAnimationFrame(frame);
 },[shapes,hidden,chart,series]);
 return <><details className="drawing-menu"><summary>أدوات التحليل {mode?'· اختر نقاط الرسم':''}</summary><div>{Object.entries(names).map(([key,label])=><button key={key} aria-pressed={mode===key} onClick={()=>setMode(mode===key?'':key)}>{label}</button>)}<input aria-label="نص الملاحظة" value={text} maxLength={100} onChange={e=>setText(e.target.value)}/><button onClick={()=>{setMode('');anchor.current=null;}}>إلغاء الرسم</button><button disabled={!shapes.length} onClick={()=>setShapes(v=>v.slice(0,-1))}>تراجع عن آخر رسم</button><button onClick={()=>setHidden(!hidden)}>{hidden?'إظهار الرسوم':'إخفاء الرسوم'}</button><p>{mode==='horizontal'||mode==='text'?'انقر لتحديد الموضع.':'اختر الأداة ثم انقر نقطة البداية ونقطة النهاية.'}</p></div></details><svg ref={svg} className="chart-drawings" aria-label="رسوم التحليل"/></>;
}

