// Server-only provider: never import this module into a client component.
import { DURATIONS, validCandle, type Candle, type Session, type SymbolName, type Timeframe } from './replay.ts';

export const EQUITIES = new Set<string>(['AAPL', 'NVDA', 'AMD', 'GOOGL']);
export const isEquity = (symbol: string) => EQUITIES.has(symbol);
export const EQUITY_SOURCE = 'Alpaca SIP · 1m raw · RTH';
const DAY = 86400000, MINUTE = 60000;
export const EQUITY_START = Date.UTC(2016, 0, 1);
export type MarketSession = { date: string; open: number; close: number };
type Block = { sessions: MarketSession[]; candles: Candle[] };
const cache = new Map<string, { expires: number; value: Block }>();
const pending = new Map<string, Promise<Block>>();
let gate = Promise.resolve();
let lastRequest = 0;
export function newYorkDate(time: number) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(time);
}
export function newYorkTime(date: string, clock: string) {
  const nominal = Date.parse(`${date}T${clock.length === 5 ? clock + ':00' : clock}Z`);
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hourCycle: 'h23', hour: '2-digit' }).formatToParts(Date.parse(date + 'T12:00:00Z'));
  const offset = 12 - Number(parts.find(p => p.type === 'hour')!.value);
  return nominal + offset * 3600000;
}
export function latestEquityMinute(now = Date.now()) { return Math.floor((now - 16 * MINUTE) / MINUTE) * MINUTE; }
async function request(path: string, calendar = false): Promise<unknown> {
  const key = process.env.ALPACA_API_KEY, secret = process.env.ALPACA_API_SECRET;
  if (!key || !secret) throw new Error('مفاتيح Alpaca غير مهيأة على الخادم؛ لا يمكن تحميل الأسهم.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const wait = gate.then(async () => { await new Promise(r => setTimeout(r, Math.max(0, lastRequest + 350 - Date.now()))); lastRequest = Date.now(); });
    gate = wait.catch(() => {}); await wait;
    let response: Response;
    try { response = await fetch((calendar ? 'https://paper-api.alpaca.markets' : 'https://data.alpaca.markets') + path, {
      headers: { 'APCA-API-KEY-ID': key, 'APCA-API-SECRET-KEY': secret }, signal: AbortSignal.timeout(15000), cache: 'no-store',
    });
      if (response.ok) return await response.json();
    } catch { if (attempt < 2) continue; throw new Error('انقطع اتصال Alpaca أو انتهت المهلة؛ لم يتغير وقت المحاكاة.'); }
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      const delay = Number(response.headers.get('Retry-After'));
      await new Promise(r => setTimeout(r, Math.min(3000, Number.isFinite(delay) && delay > 0 ? delay * 1000 : 500 * 2 ** attempt))); continue;
    }
    // Do not relay upstream bodies, credentials or account details to the browser.
    throw new Error(`تعذر جلب Alpaca (${response.status})${response.status === 403 ? '؛ تحقق من صلاحية SIP للحساب' : ''}؛ لم يتغير وقت المحاكاة.`);
  }
  throw new Error('تعذر جلب Alpaca.');
}
export function validateEquityMinutes(candles: Candle[], expected: number[], now = Date.now()) {
  const missing = expected.find((t,i) => candles[i]?.openTime !== t);
  if (missing !== undefined || candles.length !== expected.length) throw new Error(`دقيقة RTH غير متاحة عند ${new Date(missing ?? expected.at(-1) ?? 0).toISOString()}: المتوقع ${expected.length} والمستلم ${candles.length}. قد لا توجد صفقات مؤهلة أو تكون البيانات ناقصة؛ لا يمكن الجزم من الشموع وحدها. أوقفت المحاكاة دون توليد شموع أو تغيير الوقت.`);
  for (let i = 0; i < candles.length; i++) if (!validCandle(candles[i], MINUTE) || candles[i].openTime !== expected[i] || candles[i].closeTime >= now)
    throw new Error(`دقيقة أسهم مفقودة أو غير صالحة عند ${new Date(expected[i]).toISOString()}؛ لم يتغير وقت المحاكاة.`);
}
function expectedMinutes(sessions: MarketSession[], start: number, end: number) {
  return sessions.flatMap(s => { const times: number[] = []; for(let t=Math.max(s.open,Math.ceil(start/MINUTE)*MINUTE); t<s.close && t+MINUTE-1<=end; t+=MINUTE) times.push(t); return times; });
}
async function block(symbol: SymbolName, start: number): Promise<Block> {
  const id = `${symbol}:${start}`, hit = cache.get(id);
  if (hit && hit.expires > Date.now()) return hit.value;
  if (pending.has(id)) return pending.get(id)!;
  const job = (async () => {
    const end = Math.min(start + 7 * DAY - 1, latestEquityMinute() + MINUTE - 1);
    const firstDate = new Date(start).toISOString().slice(0, 10), lastDate = new Date(end).toISOString().slice(0, 10);
    const rawSessions = await request(`/v2/calendar?start=${firstDate}&end=${lastDate}`, true);
    if (!Array.isArray(rawSessions)) throw new Error('استجابة تقويم Alpaca غير صالحة.');
    const sessions: MarketSession[] = rawSessions.map(s => ({ date: s.date, open: newYorkTime(s.date, s.open), close: newYorkTime(s.date, s.close) }));
    if (sessions.some((s, i) => !Number.isFinite(s.open) || s.close <= s.open || (i > 0 && s.open <= sessions[i - 1].close))) throw new Error('تقويم جلسات غير صالح.');
    const query = new URLSearchParams({ feed: 'sip', timeframe: '1Min', adjustment: 'raw', sort: 'asc', limit: '10000', start: new Date(start).toISOString(), end: new Date(end).toISOString() });
    const candles: Candle[] = [], tokens = new Set<string>(); let previous = -Infinity;
    for (let page = 0; ; page++) {
      if (page >= 20) throw new Error('تجاوز نطاق الطلب حد الصفحات الآمن.');
      const body = await request(`/v2/stocks/${symbol}/bars?${query}`) as { bars?: Record<string, unknown>[] | null; next_page_token?: string | null };
      if (body.bars !== null && !Array.isArray(body.bars)) throw new Error('استجابة شموع Alpaca غير صالحة.');
      for (const row of body.bars ?? []) {
        const t = typeof row.t === 'string' ? Date.parse(row.t) : NaN;
        const c: Candle = { openTime: t, closeTime: t + MINUTE - 1, open: row.o as number, high: row.h as number, low: row.l as number, close: row.c as number, volume: row.v as number };
        if (!validCandle(c, MINUTE) || t <= previous || t < start || t > end) throw new Error('استجابة Alpaca تحتوي شموعًا غير صالحة أو مكررة أو غير مرتبة.');
        previous = t;
        if (sessions.some(s => t >= s.open && c.closeTime < s.close) && c.closeTime <= end) candles.push(c);
      }
      if (!body.next_page_token) break;
      if (tokens.has(body.next_page_token)) throw new Error('تكررت صفحة Alpaca؛ رفض البيانات غير المكتملة.');
      tokens.add(body.next_page_token); query.set('page_token', body.next_page_token);
    }
    // Cache validated rows, but assess absent minutes only in the requested range.
    // A later gap must not block an earlier complete replay step.
    const value = { sessions, candles };
    // A 90-day chart needs 13-14 weekly blocks; 12 caused complete cache churn.
    if (cache.size >= 24) cache.delete(cache.keys().next().value!);
    cache.set(id, { value, expires: Date.now() + 5 * 60000 }); return value;
  })();
  pending.set(id, job);
  try { return await job; } finally { pending.delete(id); }
}
export async function equityRange(symbol: SymbolName, start: number, end: number): Promise<Block> {
  if (!isEquity(symbol)) throw new Error('أصل غير مدعوم في Alpaca.');
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < EQUITY_START || end < start || end - start > 100 * DAY) throw new Error('نطاق الأسهم غير صالح؛ اختر فترة منذ 2016 لا تتجاوز 100 يوم.');
  end = Math.min(end, latestEquityMinute() + MINUTE - 1);
  const candles: Candle[] = [], sessions: MarketSession[] = [];
  for (let t = Math.floor(start / (7 * DAY)) * 7 * DAY; t <= end; t += 7 * DAY) {
    const b = await block(symbol, t); sessions.push(...b.sessions); candles.push(...b.candles.filter(c => c.openTime >= start && c.closeTime <= end));
  }
  return { candles, sessions };
}
export function aggregateEquity(minutes: Candle[], timeframe: Timeframe, sessions: MarketSession[]) {
  const result: Candle[] = [];
  for (const c of minutes) {
    const s = sessions.find(s => c.openTime >= s.open && c.openTime < s.close);
    if (!s) throw new Error('شمعة خارج الجلسة النظامية.');
    const start = s.open + Math.floor((c.openTime - s.open) / DURATIONS[timeframe]) * DURATIONS[timeframe];
    const last = result.at(-1);
    if (last?.openTime === start) { last.high = Math.max(last.high, c.high); last.low = Math.min(last.low, c.low); last.close = c.close; last.closeTime = c.closeTime; last.volume += c.volume; }
    else result.push({ ...c, openTime: start });
  }
  return result;
}
export async function equityHistory(session: Session, timeframe: Timeframe, before = session.cursorTime + 1) {
  const days = { '1m': 4, '5m': 10, '15m': 30, '1h': 60, '4h': 90, '1d': 90 }[timeframe];
  const end = Math.min(before - 1, session.cursorTime);
  const start = Math.max(EQUITY_START, Math.floor((end - days * DAY) / DAY) * DAY);
  const b = await equityRange(session.symbol, start, end);
  validateEquityMinutes(b.candles,expectedMinutes(b.sessions,start,end));
  return { candles: aggregateEquity(b.candles, timeframe, b.sessions).filter(c => c.openTime < before).slice(-500), source: EQUITY_SOURCE, hasMore: start > EQUITY_START };
}
export async function equityStep(session: Session, count: number, timeframe?: Timeframe) {
  const first = session.cursorTime + 1;
  let b: Block = { candles: [], sessions: [] };
  let planned: number[] = [];
  // Most advances stay in the current cached week. Expand only across closures.
  for (const days of [1, 4, 14]) {
    const end = Math.min(Math.floor(first/DAY)*DAY + days*DAY - 1,latestEquityMinute()+MINUTE-1);
    b = await equityRange(session.symbol, Math.max(EQUITY_START, first), end);
    planned = expectedMinutes(b.sessions,first,end);
    if (timeframe && planned.length) {
      const next = planned[0];
      const day = b.sessions.find(s => next >= s.open && next < s.close)!;
      const boundary = Math.min(day.close, day.open + (Math.floor((next-day.open)/DURATIONS[timeframe])+1)*DURATIONS[timeframe]);
      count = (boundary-next)/MINUTE;
    }
    if (planned.length >= count) break;
  }
  const candles = b.candles.slice(0, count);
  const expected = planned.slice(0,count);
  if (expected.length !== count) throw new Error('لا تتوفر دقائق تنفيذ مكتملة كافية؛ اختر تاريخًا أقدم.');
  validateEquityMinutes(candles, expected);
  return { candles, expected, count, source: EQUITY_SOURCE };
}
export async function checkEquityStart(symbol: SymbolName, time: number) {
  if (time < EQUITY_START || time > latestEquityMinute()) throw new Error('اختر جلسة أسهم منذ 2016 وأقدم من 16 دقيقة؛ التغطية الفعلية تُفحص قبل البدء.');
  let b = await equityRange(symbol, time, Math.floor(time/DAY)*DAY+DAY-1);
  if (b.sessions.some(s=>time>=s.open && time<s.close)) {
    validateEquityMinutes(b.candles.filter(c=>c.openTime===time),[time]);
    return;
  }
  if (!b.candles.length) b = await equityRange(symbol,time,time+7*DAY);
  const first = b.candles[0];
  if (!first) throw new Error('لا توجد بيانات تنفيذ متاحة لهذه البداية.');
  if (first.openTime !== time) throw new Error(`الوقت خارج جلسة متاحة. البداية المقترحة: ${new Date(first.openTime).toISOString()} (UTC).`);
  validateEquityMinutes([first],[time]);
}

export async function latestEquityStart(symbol: SymbolName) {
  const end = latestEquityMinute() + MINUTE - 1;
  const data = await equityRange(symbol, end - 14 * DAY + 1, end);
  const last = data.candles.at(-1);
  if (!last) throw new Error('لا توجد دقيقة نظامية مكتملة حديثة لهذا الأصل.');
  return last.openTime;
}
