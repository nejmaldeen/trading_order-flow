import type { OrderType, TradeSide } from './replay.ts';

// Moving entry chooses a future conditional order, never a historical fill.
export function draftOrderType(side: TradeSide, entry: number, reference: number): OrderType {
  if (Math.abs(entry-reference)<0.005) return 'market';
  return (side==='long'?entry<reference:entry>reference)?'limit':'stop';
}
export function draftError(amount:number, entry:number, stop:number, target:number, side:TradeSide, available:number) {
  if (![amount,entry,stop,target].every(v=>Number.isFinite(v)&&v>0)) return 'أدخل مبلغًا وأسعارًا موجبة وصحيحة.';
  if(amount<1||amount*1.0015>available) return 'المبلغ مع رسوم الدخول يتجاوز الرصيد المتاح أو أقل من 1 USDT.';
  const sign=side==='short'?-1:1;
  if(sign*(entry-stop)<=0||sign*(target-entry)<=0) return 'ضع الوقف في جهة الخسارة والهدف في جهة الربح بالنسبة للدخول.';
  return null;
}
