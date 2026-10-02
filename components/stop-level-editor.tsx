"use client";
import {useEffect,useState} from 'react';
import type {Trade} from '@/lib/replay';
export default function StopLevelEditor({trade,busy,onSave}:{trade:Trade;busy:boolean;onSave:(levels:{price:number;amount:number}[])=>Promise<boolean>}) {
 const [rows,setRows]=useState<{price:string;amount:string}[]>([]);
 const saved=JSON.stringify(trade.stopLevels??[]);
 useEffect(()=>{setRows((trade.stopLevels??[]).filter(x=>!x.filled).map(x=>({price:String(x.price),amount:String(x.amount)})));},[trade.id,saved]);
 const remaining=(trade.remainingQuantity??trade.quantity??0)*(trade.entryPrice??0);
 return <details className="stop-level-editor"><summary>وقف جزئي متعدد · {rows.length} مستويات</summary>
 <p>حدّد مبلغًا من رأس المال الأصلي لكل مستوى. عند لمسه تُباع كميته المكافئة؛ الوقف النهائي يغلق الباقي. يسري الحفظ من الدقيقة التالية.</p>
 <p>المتبقي {remaining.toFixed(2)} USDT · {(trade.remainingQuantity??trade.quantity??0).toFixed(8)} وحدة</p>
 {rows.map((row,i)=><div className="stop-level-row" key={i}><label>السعر<input aria-label={`سعر الوقف الجزئي ${i+1}`} type="number" step="any" value={row.price} onChange={e=>setRows(r=>r.map((v,j)=>j===i?{...v,price:e.target.value}:v))}/></label><label>المبلغ USDT<input aria-label={`مبلغ الوقف الجزئي ${i+1}`} type="number" step="0.01" value={row.amount} onChange={e=>setRows(r=>r.map((v,j)=>j===i?{...v,amount:e.target.value}:v))}/></label><button disabled={busy} onClick={()=>setRows(r=>r.filter((_,j)=>j!==i))} aria-label={`حذف المستوى ${i+1}`}>×</button></div>)}
 <button disabled={busy||rows.length>=5} onClick={()=>setRows(r=>[...r,{price:'',amount:''}])}>إضافة مستوى</button>
 <button disabled={busy} onClick={()=>void onSave(rows.map(x=>({price:Number(x.price),amount:Number(x.amount)})))}>حفظ مستويات الوقف</button>
 {(trade.partialExits??[]).map((x,i)=><p key={i}>نُفّذ {x.quantity.toFixed(8)} عند {x.price.toFixed(2)} · الصافي {x.pnl.toFixed(2)} USDT</p>)}
 </details>;
}
