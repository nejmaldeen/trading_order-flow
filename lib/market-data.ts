import { isEquity, equityRange, aggregateEquity, equityHistory, EQUITY_SOURCE } from "./equity-market.ts";
import { inflateRawSync } from "node:zlib";
import { DURATIONS, appendReplayCandle, validCandle, validateMinutes, type Candle, type Session, type SymbolName, type Timeframe } from "./replay.ts";
import { offlineMarketData } from "./offline-market.ts";

export type MarketResult = { candles: Candle[]; source: string };
export type MarketProvider = (symbol: SymbolName, interval: Timeframe, start: number, end: number) => Promise<MarketResult>;
export class MarketError extends Error {}
const archiveCache = new Map<string, Candle[]>();
let restRetryAfter = 0;
const DAY=86400000;
export const HISTORY_PAGE_SIZE=500;
export const HISTORY_START=Date.UTC(2017,7,17);
export function parseRow(row: (string|number)[]): Candle {
  const ms=(v: string|number) => Math.floor(Number(v)/(Number(v)>1e14?1000:1));
  const c: Candle = {
    openTime: ms(row[0]),
    open: Number(row[1]),
    high: Number(row[2]),
    low: Number(row[3]),
    close: Number(row[4]),
    volume: Number(row[5]),
    closeTime: ms(row[6]),
  };
  if (row[9] !== undefined) {
    const num = Number(row[9]);
    if (Number.isFinite(num)) c.takerBuyVolume = num;
  }
  if (row[8] !== undefined) {
    const num = Number(row[8]);
    if (Number.isFinite(num)) c.tradeCount = num;
  }
  return c;
}
// Read the single CSV from Binance's ZIP using central-directory sizes (also handles data descriptors).
export function unzipCsv(bytes: Uint8Array): string {
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  for (let pos=bytes.length-22;pos>=Math.max(0,bytes.length-65557);pos--) {
    if(view.getUint32(pos,true)!==0x06054b50) continue;
    if(view.getUint16(pos+10,true)!==1) throw new MarketError("أرشيف غير متوقع.");
    const central=view.getUint32(pos+16,true);
    if(view.getUint32(central,true)!==0x02014b50) break;
    const method=view.getUint16(central+10,true), size=view.getUint32(central+20,true), expanded=view.getUint32(central+24,true);
    const local=view.getUint32(central+42,true);
    if(expanded>16*1024*1024 || view.getUint32(local,true)!==0x04034b50) break;
    const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
    const data=bytes.subarray(start,start+size);
    const result=method===0?data:method===8?inflateRawSync(data,{maxOutputLength:16*1024*1024}):null;
    if(!result || result.length!==expanded) break;
    return new TextDecoder().decode(result);
  }
  throw new MarketError("تعذر قراءة أرشيف الشموع.");
}
async function archive(symbol:SymbolName,interval:Timeframe,part:string,monthly:boolean) {
  const path=`https://data.binance.vision/data/spot/${monthly?"monthly":"daily"}/klines/${symbol}/${interval}/${symbol}-${interval}-${part}.zip`;
  const cached=archiveCache.get(path); if(cached) return cached;
  const response=await fetch(path,{signal:AbortSignal.timeout(15000)});
  if(response.status===404) return null;
  if(!response.ok) throw new MarketError(`تعذر الوصول إلى أرشيف Binance (${response.status}).`);
  const bytes=new Uint8Array(await response.arrayBuffer());
  const check=await fetch(path+".CHECKSUM",{signal:AbortSignal.timeout(15000)});
  if(!check.ok) throw new MarketError("تعذر التحقق من سلامة أرشيف Binance.");
  const expected=(await check.text()).trim().split(/\s+/)[0];
  const digest=Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))).map(b=>b.toString(16).padStart(2,"0")).join("");
  if(digest!==expected) throw new MarketError("فشل التحقق من سلامة أرشيف Binance.");
  const candles=unzipCsv(bytes).trim().split(/\r?\n/).map(line=>parseRow(line.split(",")));
  if(candles.some(c=>!validCandle(c,DURATIONS[interval]))) throw new MarketError("الأرشيف يحتوي شموعًا غير صالحة.");
  if(archiveCache.size>=16) archiveCache.delete(archiveCache.keys().next().value!);
  archiveCache.set(path,candles); return candles;
}
export const NON_BINANCE_SYMBOLS = new Set<SymbolName>(["AAPL", "NVDA", "AMD", "GOOGL", "PAXGUSDT"]);

export function isNonBinanceSymbol(symbol: string): boolean {
  return NON_BINANCE_SYMBOLS.has(symbol as SymbolName);
}

export const marketData: MarketProvider = async (symbol,interval,start,end) => {
  if (isEquity(symbol)) {
    const b = await equityRange(symbol,start,end);
    return {candles:aggregateEquity(b.candles,interval,b.sessions),source:EQUITY_SOURCE};
  }
  const duration=DURATIONS[interval];
  const safeEnd=Math.min(end,Math.floor(Date.now()/duration)*duration-1);
  if(safeEnd<start) return {candles:[],source: isNonBinanceSymbol(symbol) ? "المخزن المحلي · وضع عدم الاتصال (أوفلاين)" : "Binance"};
  if (isNonBinanceSymbol(symbol)) {
    return offlineMarketData(symbol, interval, start, safeEnd);
  }
  // Reuse already verified historical archives before trying the network again.
  const cached:Candle[]=[];
  for(let day=Math.floor(start/DAY)*DAY;day<=safeEnd;day+=DAY) {
    const part=new Date(day).toISOString().slice(0,10);
    const path=`https://data.binance.vision/data/spot/daily/klines/${symbol}/${interval}/${symbol}-${interval}-${part}.zip`;
    const rows=archiveCache.get(path);
    if(!rows){cached.length=0;break;}
    cached.push(...rows.filter(c=>c.openTime>=start&&c.closeTime<=safeEnd));
  }
  if(cached.length && cached[0].openTime===start && cached.at(-1)!.closeTime===safeEnd &&
    cached.every((c,i)=>i===0||c.openTime===cached[i-1].closeTime+1))
    return {candles:cached,source:"Binance · الأرشيف الرسمي"};
  let apiError="واجهة البيانات غير متاحة";
  if(Date.now()>=restRetryAfter) {
    try {
      const result:Candle[]=[];
      for(let next=start;next<=safeEnd;) {
        const query=new URLSearchParams({symbol,interval,startTime:String(next),endTime:String(safeEnd),limit:"1000"});
        let response=await fetch(`https://data-api.binance.vision/api/v3/klines?${query}`,{signal:AbortSignal.timeout(10000)}).catch(()=>null);
        if(!response || !response.ok) {
          response=await fetch(`https://api.binance.com/api/v3/klines?${query}`,{signal:AbortSignal.timeout(10000)});
        }
        if(!response.ok) { if([403,429,451].includes(response.status)) restRetryAfter=Date.now()+60000; throw new Error(`Binance API (${response.status})`); }
        const rows=await response.json() as (string|number)[][];
        const bars=rows.map(parseRow);
        if(bars.some(c=>!validCandle(c,duration))) throw new Error("شموع غير صالحة");
        const visible=bars.filter(c=>c.openTime>=next && c.closeTime<=safeEnd);
        result.push(...visible);
        if(!visible.length || bars.length<1000) break;
        next=visible.at(-1)!.closeTime+1;
      }
      return {candles:result,source:"Binance API"};
    } catch(err) { apiError=err instanceof Error?err.message:apiError; }
  }
  try {
    const result:Candle[]=[];
    let day=Math.floor(start/DAY)*DAY;
    while(day<=safeEnd) {
      const date=new Date(day), month=date.toISOString().slice(0,7);
      const monthEnd=Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,1);
      if(duration>=3600000 && monthEnd<Date.now()-7*DAY) {
        const monthly=await archive(symbol,interval,month,true);
        if(monthly) { result.push(...monthly);day=monthEnd;continue; }
      }
      const daily=await archive(symbol,interval,date.toISOString().slice(0,10),false);
      if(!daily) throw new MarketError("بيانات هذا اليوم غير متاحة في الأرشيف بعد. اختر يومًا أقدم أو أعد المحاولة لاحقًا.");
      result.push(...daily);day+=DAY;
    }
    return {candles:result.filter(c=>c.openTime>=start && c.closeTime<=safeEnd),source:"Binance · الأرشيف الرسمي"};
  } catch(err) {
    try {
      const offline = await offlineMarketData(symbol, interval, start, safeEnd);
      if (offline.candles.length > 0) return offline;
    } catch {}
    throw new MarketError(`${apiError}. ${err instanceof Error?err.message:"تعذر تحميل الأرشيف"} لم يتغير وقت المحاكاة.`);
  }
};
export async function chartHistory(session:Session,timeframe:Timeframe,provider:MarketProvider=marketData) {
  if (isEquity(session.symbol) && session.dataSource!=="alpaca-sip-raw") return {candles:[],source:"جلسة قديمة للقراءة فقط؛ الأسعار الاصطناعية مؤرشفة ونتائج الصفقات محفوظة. ابدأ جلسة SIP جديدة."};
  if (isEquity(session.symbol)) return equityHistory(session,timeframe);
  const duration=DURATIONS[timeframe], cutoff=session.cursorTime;
  const isOfflineOrEquity = session.isOffline || isNonBinanceSymbol(session.symbol);
  const effectiveProvider = isOfflineOrEquity ? offlineMarketData : provider;
  const bucket=Math.floor((cutoff+1)/duration)*duration;
  const completed=await effectiveProvider(session.symbol,timeframe,Math.max(HISTORY_START,bucket-(HISTORY_PAGE_SIZE-1)*duration),bucket-1);
  // Strict close-time filtering even if the upstream endTime only filters open times.
  let candles=completed.candles.filter(c=>c.closeTime<=cutoff && c.closeTime<bucket);
  if(candles.some((c,i)=>!validCandle(c,duration)||(i>0 && !isOfflineOrEquity && c.openTime!==candles[i-1].openTime+duration)))
    throw new MarketError("توجد فجوة في تاريخ الشارت؛ تعذر تحميل العرض بأمان.");
  const sources=new Set([completed.source]);
  if(bucket<=cutoff) {
    if (!isOfflineOrEquity) {
      const part=await effectiveProvider(session.symbol,"1m",bucket,cutoff);
      const minutes=part.candles.filter(c=>c.closeTime<=cutoff);
      validateMinutes(minutes,bucket,Math.floor((cutoff-bucket+1)/60000));
      for(const c of minutes) candles=appendReplayCandle(candles,c,timeframe);
      sources.add(part.source);
    } else {
      try {
        const part=await effectiveProvider(session.symbol,"1m",bucket,cutoff);
        const minutes=part.candles.filter(c=>c.closeTime<=cutoff);
        if (minutes.length > 0) {
          for(const c of minutes) candles=appendReplayCandle(candles,c,timeframe);
          sources.add(part.source);
        }
      } catch {}
    }
  }
  if(!candles.length) throw new MarketError("لا توجد بيانات لهذا التاريخ والأصل.");
  return {candles,source:[...sources].join(" / ")};
}

// Historical pages never change session time or execute trades.
export async function olderHistory(session:Session,timeframe:Timeframe,before:number,provider:MarketProvider=marketData) {
  if (isEquity(session.symbol) && session.dataSource!=="alpaca-sip-raw") return {candles:[],source:"جلسة قديمة مؤرشفة",hasMore:false};
  if (isEquity(session.symbol)) return equityHistory(session,timeframe,before);
  const duration=DURATIONS[timeframe];
  const isOfflineOrEquity = session.isOffline || isNonBinanceSymbol(session.symbol);
  const effectiveProvider = isOfflineOrEquity ? offlineMarketData : provider;
  if(!Number.isSafeInteger(before)||before%duration!==0||before>session.cursorTime+1)
    throw new MarketError("حد التاريخ غير صالح.");
  const end=Math.min(before-1,Math.floor((session.cursorTime+1)/duration)*duration-1);
  const start=Math.max(HISTORY_START,end+1-HISTORY_PAGE_SIZE*duration);
  if(start>end)return {candles:[],source: isOfflineOrEquity ? "المخزن المحلي · وضع عدم الاتصال (أوفلاين)" : "Binance",hasMore:false};
  const result=await effectiveProvider(session.symbol,timeframe,start,end);
  const candles=result.candles.filter(c=>c.openTime>=start&&c.closeTime<=end&&c.closeTime<=session.cursorTime);
  if(candles.some((c,i)=>!validCandle(c,duration)||(i>0 && !isOfflineOrEquity && c.openTime!==candles[i-1].openTime+duration))||
    (candles.length>0 && !isOfflineOrEquity && candles.at(-1)!.closeTime!==end))throw new MarketError("توجد فجوة في التاريخ الأقدم؛ أعد المحاولة.");
  if(!candles.length&&start>HISTORY_START)throw new MarketError("تعذر الحصول على التاريخ الأقدم؛ أعد المحاولة.");
  return {...result,candles,hasMore:!!candles.length&&candles[0].openTime>HISTORY_START};
}
