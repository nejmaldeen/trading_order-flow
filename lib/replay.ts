export const FEE_RATE = 0.0015;
export const SLIPPAGE = 0.0002;
export const INITIAL_BALANCE = 1000;
export const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;
export const DURATIONS = { "1m": 60000, "5m": 300000, "15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000 };
export type Timeframe = keyof typeof DURATIONS;
export type SymbolName = typeof SYMBOLS[number];
export type TradeSide = "long" | "short";
export type OrderType = "market" | "limit" | "stop";
export type Candle = { openTime: number; closeTime: number; open: number; high: number; low: number; close: number; volume: number };
export type Session = { id: string; symbol: SymbolName; startTime: number; cursorTime: number; advancedBars: number; createdAt: string };
export type TradeEvent = { kind: string; time: number; detail: string };
export type Trade = {
  id: string; sessionId: string; symbol: SymbolName;
  status: "pending" | "open" | "close_pending" | "closed" | "cancelled";
  side?: TradeSide; referencePrice?: number | null;
  orderType: OrderType; orderPrice: number | null; eligibleTime: number; triggeredAt: number | null;
  notional: number; quantity: number | null; entryPrice: number | null;
  stopLoss: number; takeProfit: number; initialStop: number | null; initialTarget: number | null;
  exitPrice: number | null; entryFee: number; exitFee: number; realizedPnl: number;
  rMultiple: number | null; initialRisk: number | null; reason: string;
  entryTime: number | null; exitTime: number | null; createdAt: string;
  exitReason: string | null; events: TradeEvent[];
};
export type Workspace = { revision: number; activeSessionId: string | null; sessions: Session[]; trades: Trade[] };
export const blank: Workspace = { revision: 0, activeSessionId: null, sessions: [], trades: [] };
export function normalizeWorkspace(raw: Partial<Workspace>): Workspace {
  return { ...blank, ...raw, revision: raw.revision ?? 0, sessions: raw.sessions ?? [],
    trades: (raw.trades ?? []).map(t => ({ ...t, side:t.side ?? "long", referencePrice:t.referencePrice ?? t.orderPrice ?? t.entryPrice ?? null, orderType: t.orderType ?? "market", orderPrice: t.orderPrice ?? null,
      eligibleTime: t.eligibleTime ?? 0, triggeredAt: t.triggeredAt ?? null,
      initialStop: t.initialStop ?? (t.initialRisk != null && t.quantity ? t.entryPrice! - (t.side==="short"?-1:1)*t.initialRisk / t.quantity : null),
      initialTarget: t.initialTarget ?? null, exitReason: t.exitReason ?? null, events: t.events ?? [] })) };
}
export function activeSession(state: Workspace) { return state.sessions.find(s => s.id === state.activeSessionId) ?? null; }
export function event(trade: Trade, kind: string, time: number, detail: string) { trade.events.push({ kind, time, detail }); }
export function validCandle(c: Candle, duration: number) {
  return Object.values(c).every(Number.isFinite) && c.openTime % duration === 0 && c.closeTime === c.openTime + duration - 1 &&
    Math.min(c.open, c.high, c.low, c.close) > 0 && c.volume >= 0 && c.high >= Math.max(c.open,c.close,c.low) && c.low <= Math.min(c.open,c.close,c.high);
}
export function validateMinutes(candles: Candle[], first: number, count: number, now = Date.now()) {
  if (candles.length !== count || candles.some((c,i) => !validCandle(c,60000) || c.openTime !== first+i*60000 || c.closeTime >= now))
    throw new Error("توجد فجوة أو شمعة غير مكتملة في البيانات؛ لم يتغير وقت المحاكاة.");
}
export function appendReplayCandle(current: Candle[], minute: Candle, timeframe: Timeframe) {
  const start = Math.floor(minute.openTime / DURATIONS[timeframe]) * DURATIONS[timeframe];
  const previous = current.at(-1);
  if (previous && minute.closeTime <= previous.closeTime) return current;
  if (previous?.openTime === start) return [...current.slice(0,-1), { ...previous, closeTime: minute.closeTime,
    high: Math.max(previous.high,minute.high), low: Math.min(previous.low,minute.low), close: minute.close, volume: previous.volume+minute.volume }];
  return [...current,{...minute,openTime:start}];
}
export function finishTrade(t: Trade, fill: number, time: number, reason: string) {
  if (t.entryPrice === null || t.quantity === null) return;
  t.exitPrice=fill; t.exitTime=time; t.exitFee=fill*t.quantity*FEE_RATE;
  t.realizedPnl=(t.side==="short"?-1:1)*(fill-t.entryPrice)*t.quantity-t.entryFee-t.exitFee;
  t.rMultiple=t.initialRisk && t.initialRisk>0 ? t.realizedPnl/t.initialRisk : null;
  t.status="closed"; t.exitReason=reason; event(t,"closed",time,`${reason}: ${fill}`);
}
export function applyCandle(state: Workspace, session: Session, c: Candle) {
  for (const t of state.trades) {
    if (t.sessionId !== session.id) continue;
    const short=t.side==="short", sign=short?-1:1;
    let intrabarEntry=false;
    if (t.status === "pending") {
      if (c.openTime < t.eligibleTime) continue;
      let fill=c.open*(1+sign*SLIPPAGE);
      const level=t.orderPrice;
      if (t.orderType === "limit") {
        if (level === null || (short?c.high<level:c.low>level)) continue;
        intrabarEntry=short?c.open<level:c.open>level;
        fill=short?Math.max(level,Math.max(c.open,level)*(1-SLIPPAGE)):Math.min(level,Math.min(c.open,level)*(1+SLIPPAGE));
      } else if (t.orderType === "stop") {
        if (level === null || (short?c.low>level:c.high<level)) continue;
        intrabarEntry=short?c.open>level:c.open<level;
        fill=(short?Math.min(c.open,level):Math.max(c.open,level))*(1+sign*SLIPPAGE);
        t.triggeredAt=c.openTime; event(t,"triggered",c.openTime,"تفعيل أمر الوقف داخل هذه الدقيقة؛ وقت اللمس الدقيق غير معلوم");
      }
      if (sign*(fill-t.stopLoss)<=0 || sign*(t.takeProfit-fill)<=0) {
        t.status="cancelled"; event(t,"cancelled",c.openTime,"فجوة السعر جعلت الوقف أو الهدف غير صالح عند التعبئة"); continue;
      }
      t.entryPrice=fill; t.quantity=t.notional/fill; t.entryFee=t.notional*FEE_RATE;
      t.initialRisk=sign*(fill-t.stopLoss)*t.quantity; t.initialStop=t.stopLoss; t.initialTarget=t.takeProfit;
      t.entryTime=c.openTime; t.status="open";
      event(t,"filled",c.openTime,`${fill}${intrabarEntry ? " · تنفيذ داخل الدقيقة؛ ترتيب الحركة غير معلوم" : " · افتتاح الدقيقة"}`);
    }
    if (t.status === "close_pending") { finishTrade(t,c.open*(1-sign*SLIPPAGE),c.openTime,"إغلاق يدوي"); continue; }
    if (t.status !== "open") continue;
    if (short?c.high>=t.stopLoss:c.low<=t.stopLoss) {
      // For an intrabar entry, the candle open preceded the fill and cannot be an exit fill.
      finishTrade(t,(intrabarEntry ? t.stopLoss : short?Math.max(c.open,t.stopLoss):Math.min(c.open,t.stopLoss))*(1-sign*SLIPPAGE),c.closeTime,"وقف الخسارة");
    } else if (!intrabarEntry && (short?c.low<=t.takeProfit:c.high>=t.takeProfit)) {
      finishTrade(t,t.takeProfit,c.closeTime,"جني الأرباح");
    }
    // Unknown intrabar ordering: stop-first; never credit an entry-bar target for an intrabar fill.
  }
}
export function advance(state: Workspace, candles: Candle[], count: number, now = Date.now()) {
  const session=activeSession(state);
  if (!session) throw new Error("ابدأ جلسة أولًا.");
  validateMinutes(candles,session.cursorTime+1,count,now);
  for (const c of candles) { applyCandle(state,session,c); session.cursorTime=c.closeTime; session.advancedBars++; }
}
