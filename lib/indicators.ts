import type { Candle } from './replay.ts';
export type IndicatorKey = 'sma' | 'ema' | 'bands';
export type IndicatorSettings = Record<IndicatorKey, { enabled: boolean; period: number }>;
export const defaultIndicators: IndicatorSettings = {sma:{enabled:false,period:20},ema:{enabled:false,period:50},bands:{enabled:false,period:20}};
export function indicatorValues(candles:Candle[], period:number, kind:IndicatorKey) {
  if(!Number.isInteger(period)||period<2||period>200) return [];
  let ema:number|undefined;
  return candles.flatMap((c,i) => {
    if(i+1<period)return [];
    const values=candles.slice(i-period+1,i+1).map(v=>v.close);
    const mean=values.reduce((s,v)=>s+v,0)/period;
    ema=ema===undefined?mean:c.close*(2/(period+1))+ema*(1-2/(period+1));
    const deviation=Math.sqrt(values.reduce((s,v)=>s+(v-mean)**2,0)/period);
    return [{time:c.openTime/1000,value:kind==='ema'?ema:mean,upper:mean+2*deviation,lower:mean-2*deviation}];
  });
}
