/** Independent, read-only Binance Spot execution audit. Never places orders. */
export const SCALE = 100000000n;
const MINUTE_US = 60000000n;
const int = (x, name) => { if (!/^\d+$/.test(String(x))) throw Error(`Invalid ${name}: ${x}`); return BigInt(x); };
export function atoms(value) {
  const s = String(value);
  if (!/^\d+(\.\d{1,8})?$/.test(s)) throw Error(`Invalid decimal: ${s}`);
  const [a,b=''] = s.split('.');
  return BigInt(a)*SCALE + BigInt(b.padEnd(8,'0'));
}
export function decimal(value) {
  const sign = value < 0n ? '-' : '';
  const n = value < 0n ? -value : value;
  const f = String(n%SCALE).padStart(8,'0').replace(/0+$/,'');
  return `${sign}${n/SCALE}${f ? '.'+f : ''}`;
}
export function timestampUs(raw) {
  const n = int(raw, 'timestamp');
  if (n >= 1000000000000n && n < 10000000000000n) return n*1000n;
  if (n >= 1000000000000000n && n < 10000000000000000n) return n;
  throw Error(`Timestamp must be epoch milliseconds or microseconds: ${raw}`);
}
function bool(s) { if (/^true$/i.test(s)) return true; if (/^false$/i.test(s)) return false; throw Error(`Invalid maker flag: ${s}`); }
function rows(csv) { return csv.trim().split(/\r?\n/).filter(Boolean).map(x=>x.split(',')); }
export function parseExecutions(csv, kind='trades') {
  if (!['trades','aggTrades'].includes(kind)) throw Error(`Unsupported kind ${kind}`);
  return rows(csv).filter(r=>/^\d+$/.test(r[0])).map((r,i)=>{
    if (r.length < (kind==='trades' ? 6 : 7)) throw Error(`Bad ${kind} row ${i}`);
    const agg = kind === 'aggTrades';
    const price = atoms(r[1]), qty = atoms(r[2]);
    if (price<=0n || qty<=0n) throw Error(`Nonpositive execution row ${i}`);
    const firstId = int(agg?r[3]:r[0], 'firstId'), lastId = int(agg?r[4]:r[0], 'lastId');
    if (lastId<firstId) throw Error(`Reversed IDs at row ${i}`);
    return { id:int(r[0],'id'), firstId, lastId, price, qty,
      timeUs:timestampUs(r[agg?5:4]), buyerMaker:bool(r[agg?6:5]) };
  });
}
export function parseKlines(csv) {
  return rows(csv).filter(r=>/^\d+$/.test(r[0])).map((r,i)=>{
    if(r.length<11) throw Error(`Bad Kline row ${i}`);
    return {minuteUs:timestampUs(r[0]), open:atoms(r[1]), high:atoms(r[2]),low:atoms(r[3]),close:atoms(r[4]),
      volume:atoms(r[5]), count:Number(r[8]), buy:atoms(r[9])};
  });
}
export function checkIds(records, kind) {
  let gaps=0, duplicates=0, reordered=0;
  for(let i=1;i<records.length;i++) {
    const prev=records[i-1], curr=records[i];
    if(curr.id===prev.id) duplicates++;
    if(curr.id<prev.id || curr.timeUs<prev.timeUs) reordered++;
    if(kind==='trades' && curr.id>prev.id+1n) gaps+=Number(curr.id-prev.id-1n);
    if(kind==='aggTrades' && curr.firstId>prev.lastId+1n) gaps+=Number(curr.firstId-prev.lastId-1n);
    if(kind==='aggTrades' && curr.firstId<=prev.lastId) reordered++;
  }
  return {gaps,duplicates,reordered,rows:records.length};
}
const empty=()=>({buy:0n,sell:0n,count:0,open:null,high:null,low:null,close:null});
const add=(b,p,q,buyerMaker)=>{
  if(b.open===null)b.open=p;
  b.close=p; b.high=b.high===null||p>b.high?p:b.high;
  b.low=b.low===null||p<b.low?p:b.low;
  if(buyerMaker)b.sell+=q;else b.buy+=q;
  b.count++;
};
export function aggregate(records, {tick='1',beforeUs=null}={}) {
  const step=atoms(tick); if(step<=0n)throw Error('Positive tick required');
  const cutoff=beforeUs===null?null:BigInt(beforeUs);
  const byMinute=new Map(), byPrice=new Map(), footprint=new Map();
  let prevTime=-1n, prevId=-1n, included=0;
  for(const r of records){
    if(r.timeUs<prevTime || (r.timeUs===prevTime&&r.id<=prevId)) throw Error('Unsorted executions');
    prevTime=r.timeUs;prevId=r.id;
    if(cutoff!==null && r.timeUs>=cutoff) continue;
    const m=r.timeUs/MINUTE_US*MINUTE_US;
    const p=r.price/step*step;
    if(!byMinute.has(m))byMinute.set(m,empty()); add(byMinute.get(m),r.price,r.qty,r.buyerMaker);
    if(!byPrice.has(p))byPrice.set(p,empty()); add(byPrice.get(p),r.price,r.qty,r.buyerMaker);
    if(!footprint.has(m))footprint.set(m,new Map());
    const fp=footprint.get(m); if(!fp.has(p))fp.set(p,empty()); add(fp.get(p),r.price,r.qty,r.buyerMaker);
    included++;
  }
  return {byMinute,byPrice,footprint,included,tick:step};
}
const volume=b=>b.buy+b.sell;
export function profile(aggregation,{valueAreaBps=7000,maxRows=200000}={}){
  if(!Number.isInteger(valueAreaBps)||valueAreaBps<=0||valueAreaBps>10000)throw Error('Bad Value Area ratio');
  const {byPrice,tick}=aggregation;
  if(!byPrice.size)return null;
  const prices=[...byPrice.keys()].sort((a,b)=>a<b?-1:a>b?1:0);
  const low=prices[0],high=prices.at(-1);
  const rowCount=Number((high-low)/tick+1n);
  if(rowCount>maxRows) throw Error(`Volume profile has ${rowCount} price rows; raise tick explicitly`);
  const bars=Array.from({length:rowCount},(_,i)=>{
    const p=low+BigInt(i)*tick, b=byPrice.get(p)??empty();
    return {price:p,buy:b.buy,sell:b.sell,total:volume(b)};
  });
  let poc=0;
  for(let i=1;i<bars.length;i++)if(bars[i].total>bars[poc].total)poc=i; // deterministic lower-price tie
  const total=bars.reduce((sum,r)=>sum+r.total,0n);
  const goal=(total*BigInt(valueAreaBps)+9999n)/10000n;
  let left=poc,right=poc,acc=bars[poc].total;
  while(acc<goal&&(left>0||right<bars.length-1)) {
    const down=left>0?bars[left-1].total:-1n,up=right<bars.length-1?bars[right+1].total:-1n;
    if(down>=up)acc+=bars[--left].total; else acc+=bars[++right].total;
  }
  const hvn=[],lvn=[];
  for(let i=1;i<bars.length-1;i++){
    const a=bars[i-1].total,b=bars[i].total,c=bars[i+1].total;
    if(b>0n&&b>a&&b>c)hvn.push(bars[i].price);
    if(b<a&&b<c&&a>0n&&c>0n)lvn.push(bars[i].price);
  }
  return {poc:bars[poc].price,vah:bars[right].price,val:bars[left].price,total,goal,acc,
    hvn,lvn,rows:rowCount,tick,method:'Executed volume on configurable price buckets; POC lower-price tie; adjacent 70% expansion; HVN/LVN strict local extrema'};
}
export function cvdByMinute(aggregation) {
  let cvd=0n;
  return [...aggregation.byMinute].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([minuteUs,b])=>{
    const delta=b.buy-b.sell;cvd+=delta;
    return {minuteUs,buy:b.buy,sell:b.sell,delta,cvd,volume:volume(b)};
  });
}
export function reconcile(trades,aggTrades,klines) {
  const a=aggregate(trades,{tick:'1'}),b=aggregate(aggTrades,{tick:'1'});
  const kmap=new Map(klines.map(k=>[k.minuteUs,k]));
  if(kmap.size!==klines.length)throw Error('Duplicate Kline open time');
  for(let i=1;i<klines.length;i++)if(klines[i].minuteUs-klines[i-1].minuteUs!==MINUTE_US)throw Error('Missing or unordered Kline minute');
  const mismatches=[];let matched=0,checked=0;
  const samples=[];
  for(const [minute,t] of a.byMinute){
    const k=kmap.get(minute),g=b.byMinute.get(minute);
    checked++;
    if(!k||!g){mismatches.push({minuteUs:String(minute),reason:!k?'Missing kline':'Missing aggTrades'});continue;}
    matched++;
    const fields=[['kline.volume',volume(t),k.volume],['kline.takerBuy',t.buy,k.buy],['kline.count',BigInt(t.count),BigInt(k.count)],
      ['agg.volume',volume(t),volume(g)],['agg.takerBuy',t.buy,g.buy],
      ['kline.open',t.open,k.open],['kline.high',t.high,k.high],['kline.low',t.low,k.low],['kline.close',t.close,k.close]];
    for(const [field,actual,expected] of fields)if(actual!==expected){
      const item={minuteUs:String(minute),field,actual:String(actual),reference:String(expected)};
      mismatches.push(item);if(samples.length<20)samples.push(item);
    }
  }
  for(const [minute,k] of kmap){if(k.volume>0n&&!a.byMinute.has(minute)){mismatches.push({minuteUs:String(minute),reason:'Nonzero kline without trades'});}}
  for(const minute of b.byMinute.keys())if(!a.byMinute.has(minute))mismatches.push({minuteUs:String(minute),reason:'AggTrades without Trades'});
  return {checkedMinutes:checked,matchedMinutes:matched,totalKlines:klines.length,mismatchCount:mismatches.length,samples,passed:mismatches.length===0,
    tradeIds:checkIds(trades,'trades'),aggTradeIds:checkIds(aggTrades,'aggTrades')};
}
export function auditSummary(records,kind){
  const ids=checkIds(records,kind);const sum=records.reduce((a,x)=>a+x.qty,0n);
  const buy=records.reduce((a,x)=>a+(x.buyerMaker?0n:x.qty),0n);
  return {...ids,volume:decimal(sum),buy:decimal(buy),sell:decimal(sum-buy),
    earliestUs:records.length?String(records[0].timeUs):null,latestUs:records.length?String(records.at(-1).timeUs):null};
}
