"use client";
import {useEffect,useRef,type RefObject} from 'react';
import type {IChartApi,ISeriesApi,UTCTimestamp} from 'lightweight-charts';
import {cashPreview} from '@/lib/order-preview';
type Props={chart:RefObject<IChartApi|null>;series:RefObject<ISeriesApi<'Candlestick'>|null>;
  levels:RefObject<{entry?:{price:number}|null;stop:{price:number}|null;target:{price:number}|null}>;
  orderType:'market'|'limit'|'stop';side:'long'|'short';entry:number;time:number;amount:number;status:string;quantity?:number|null;fee?:number;filled:boolean};
export default function RiskRewardOverlay(p:Props){
 const root=useRef<HTMLDivElement>(null),gain=useRef<HTMLDivElement>(null),loss=useRef<HTMLDivElement>(null),entryLabel=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  let frame=0,previous="";
  const render=()=>{
   const chart=p.chart.current,series=p.series.current,host=root.current;
   if(chart&&series&&host&&gain.current&&loss.current&&entryLabel.current){
    const stop=p.levels.current.stop?.price,target=p.levels.current.target?.price;
    const entry=p.levels.current.entry?.price??p.entry;
    const x=chart.timeScale().timeToCoordinate((p.time/1000) as UTCTimestamp),y=series.priceToCoordinate(entry);
    const sy=stop?series.priceToCoordinate(stop):null,ty=target?series.priceToCoordinate(target):null;
    const right=chart.timeScale().width();
    const signature=JSON.stringify([x,y,sy,ty,right,stop,target,entry,!!p.levels.current.entry]);
    if(signature===previous){frame=requestAnimationFrame(render);return;} previous=signature;
    host.style.display=x===null||y===null||sy===null||ty===null||x>right||x+260<0?'none':'block';
    if(x!==null&&y!==null&&sy!==null&&ty!==null&&stop&&target){
     const left=Math.max(0,x),width=Math.max(0,Math.min(260,right-left-8));
     const cash=cashPreview(p.amount,entry,stop,target,p.orderType,p.filled?entry:null,p.quantity,p.fee,p.side);
     const label=(v:number)=>`${v>=0?'+':'−'}${Math.abs(v).toFixed(2)} USDT`;
     for(const [el,end,text] of [[gain.current,ty,`↕ هدف ≈ ${cash?label(cash.targetNet):'—'} · اسحب الحد`],[loss.current,sy,`↕ وقف ≈ ${cash?label(cash.stopNet):'—'} · اسحب الحد`]] as const){
      Object.assign(el.style,{left:`${left}px`,top:`${Math.min(y,end)}px`,width:`${width}px`,height:`${Math.max(1,Math.abs(end-y))}px`});
      const tag=el.firstElementChild as HTMLElement;tag.textContent=text;tag.style.top=end<y?'0':'auto';tag.style.bottom=end<y?'auto':'0';
     }
     Object.assign(entryLabel.current.style,{left:`${left}px`,top:`${y}px`,width:`${width}px`});
     entryLabel.current.disabled=!p.levels.current.entry;
     entryLabel.current.textContent=`${p.side==='short'?'بيع':'شراء'} · ${p.amount.toFixed(2)} USDT · ${p.status}`;
    }
   }
   frame=requestAnimationFrame(render);
  };
  frame=requestAnimationFrame(render);return()=>cancelAnimationFrame(frame);
 },[p.chart,p.series,p.levels,p.entry,p.time,p.amount,p.status,p.side,p.quantity,p.fee,p.filled,p.orderType]);
 return <div className="risk-reward-overlay" ref={root} aria-label="منطقة المخاطرة والعائد"><div ref={gain} className="reward-zone"><button type="button" data-risk-handle="target" aria-label="اسحب الهدف"/></div><div ref={loss} className="risk-zone"><button type="button" data-risk-handle="stop" aria-label="اسحب الوقف"/></div><button type="button" data-risk-handle="entry" aria-label="اسحب سعر الدخول قبل التأكيد" ref={entryLabel} className="zone-entry"/></div>;
}
