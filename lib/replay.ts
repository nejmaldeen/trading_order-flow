export const FEE_RATE = 0.0015;
export const SLIPPAGE = 0.0002;
export const INITIAL_BALANCE = 2500;
export const SYMBOLS = ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XAUTUSDT", "AAPL", "NVDA", "AMD", "GOOGL", "PAXGUSDT"] as const;
export const DURATIONS = { "1m": 60000, "5m": 300000, "15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000 };
export type Timeframe = keyof typeof DURATIONS;
export type SymbolName = typeof SYMBOLS[number];

export const SYMBOL_INFO: Record<
  SymbolName,
  {
    name: string;
    arabicName: string;
    base: string;
    quote: string;
    icon: string;
    badgeColor: string;
    digits: number;
    description: string;
  }
> = {
  BTCUSDT: {
    name: "Bitcoin",
    arabicName: "بيتكوين",
    base: "BTC",
    quote: "USDT",
    icon: "₿",
    badgeColor: "#f59e0b",
    digits: 2,
    description: "العملة المشفرة الأولى والأكبر",
  },
  ETHUSDT: {
    name: "Ethereum",
    arabicName: "إيثيريوم",
    base: "ETH",
    quote: "USDT",
    icon: "Ξ",
    badgeColor: "#60a5fa",
    digits: 2,
    description: "شبكة العقود الذكية واللامركزية",
  },
  SOLUSDT: {
    name: "Solana",
    arabicName: "سولانا",
    base: "SOL",
    quote: "USDT",
    icon: "◎",
    badgeColor: "#a855f7",
    digits: 2,
    description: "بلوكتشين عالي السرعة ومنخفض الرسوم",
  },
  XAUTUSDT: {
    name: "Tether Gold",
    arabicName: "ذهب تيزر (XAUT)",
    base: "XAUT",
    quote: "USDT",
    icon: "🪙",
    badgeColor: "#eab308",
    digits: 2,
    description: "ذهب رقمي معتمد مدعوم بأونصة ذهب حقيقي",
  },
  AAPL: {
    icon: "🍎",
    name: "Apple Inc.",
    arabicName: "أبل",
    base: "AAPL",
    quote: "USD",
    digits: 2,
    badgeColor: "#a1a1aa",
    description: "عملاق التكنولوجيا وأعلى سيولة مؤسسية متوازنة",
  },
  NVDA: {
    icon: "🟢",
    name: "NVIDIA Corporation",
    arabicName: "إنفيديا",
    base: "NVDA",
    quote: "USD",
    digits: 2,
    badgeColor: "#22c55e",
    description: "محرك الذكاء الاصطناعي وصفقات الكسر المؤسسي",
  },
  AMD: {
    icon: "🔴",
    name: "Advanced Micro Devices",
    arabicName: "إيه إم دي",
    base: "AMD",
    quote: "USD",
    digits: 2,
    badgeColor: "#ef4444",
    description: "سهم الزخم عالي التذبذب والألفا السريعة",
  },
  GOOGL: {
    icon: "🔵",
    name: "Alphabet Inc.",
    arabicName: "جوجل / ألفابت",
    base: "GOOGL",
    quote: "USD",
    digits: 2,
    badgeColor: "#3b82f6",
    description: "عملاق البحث والسيولة المستقرة",
  },
  PAXGUSDT: {
    icon: "🪙",
    name: "Paxos Gold",
    arabicName: "ذهب باكسوس الفوري (PAXG)",
    base: "PAXG",
    quote: "USDT",
    digits: 2,
    badgeColor: "#eab308",
    description: "ذهب فوري رقمي معتمد مدعوم بأونصة ذهب فيزيائي حقيقي",
  },
};
export type TradeSide = "long" | "short";
export type OrderType = "market" | "limit" | "stop";
export type Candle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  takerBuyVolume?: number;
  tradeCount?: number;
};
export type Session = { id: string; symbol: SymbolName; startTime: number; cursorTime: number; advancedBars: number; createdAt: string; isOffline?: boolean; engineVersion?: 2; dataSource?: string };
export type TradeEvent = { kind: string; time: number; detail: string };

export type TradeReflection = {
  setupGrade?: "A+" | "A" | "B+" | "B" | "C+" | string;
  strategy?: string;
  emotion?: string;
  confidence?: string;
  notes?: string;
  audioNote?: string;
  createdAt?: number;
};

export type Trade = {
  pendingScaleIn?: number;
  feeRate?: number;
  remainingQuantity?: number;
  stopLevels?: {id:string;price:number;amount:number;eligibleTime:number;filled:boolean}[];
  takeProfitLevels?: {id:string;price:number;amount:number;percentage?:number;eligibleTime:number;filled:boolean}[];
  partialExits?: {price:number;quantity:number;fee:number;pnl:number;grossPnl?:number;time:number;type?:string}[];
  id: string; sessionId: string; symbol: SymbolName;
  status: "pending" | "open" | "close_pending" | "closed" | "cancelled";
  side?: TradeSide; referencePrice?: number | null;
  orderType: OrderType; orderPrice: number | null; eligibleTime: number; triggeredAt: number | null;
  notional: number; quantity: number | null; entryPrice: number | null;
  stopLoss: number; takeProfit: number; initialStop: number | null; initialTarget: number | null;
  exitPrice: number | null; entryFee: number; exitFee: number; realizedPnl: number;
  grossPnl?: number; totalFees?: number;
  rMultiple: number | null; initialRisk: number | null; reason: string;
  entryTime: number | null; exitTime: number | null; createdAt: string;
  exitReason: string | null; events: TradeEvent[];
  reflection?: TradeReflection;
};
export type Workspace = { revision: number; activeSessionId: string | null; sessions: Session[]; trades: Trade[]; initialBalance?: number };
export const blank: Workspace = { revision: 0, activeSessionId: null, sessions: [], trades: [], initialBalance: INITIAL_BALANCE };
export function normalizeWorkspace(raw: Partial<Workspace>): Workspace {
  return { ...blank, ...raw, revision: raw.revision ?? 0, sessions: raw.sessions ?? [],
    initialBalance: raw.initialBalance ?? INITIAL_BALANCE,
    trades: (raw.trades ?? []).map(t => {
      const totalFees = t.totalFees ?? ((t.entryFee ?? 0) + (t.exitFee ?? 0));
      const grossPnl = t.grossPnl ?? (t.status === "closed" ? t.realizedPnl + totalFees : 0);
      return {
        ...t, side: t.side ?? "long", referencePrice: t.referencePrice ?? t.orderPrice ?? t.entryPrice ?? null, orderType: t.orderType ?? "market", orderPrice: t.orderPrice ?? null,
        eligibleTime: t.eligibleTime ?? 0, triggeredAt: t.triggeredAt ?? null,
        initialStop: t.initialStop ?? (t.initialRisk != null && t.quantity ? t.entryPrice! - (t.side === "short" ? -1 : 1) * t.initialRisk / t.quantity : null),
        initialTarget: t.initialTarget ?? null, exitReason: t.exitReason ?? null, events: t.events ?? [],
        stopLevels: t.stopLevels ?? [], takeProfitLevels: t.takeProfitLevels ?? [],
        totalFees, grossPnl,
        reflection: t.reflection ?? undefined
      };
    }) };
}
export function activeSession(state: Workspace) { return state.sessions.find(s => s.id === state.activeSessionId) ?? null; }
export function event(trade: Trade, kind: string, time: number, detail: string) { trade.events.push({ kind, time, detail }); }
export function validCandle(c: Candle, duration: number) {
  const isAligned = c.openTime % duration === 0 || (duration >= 3600000 && c.openTime % 60000 === 0);
  return [c.openTime, c.closeTime, c.open, c.high, c.low, c.close, c.volume].every(Number.isFinite) &&
    (c.takerBuyVolume === undefined || Number.isFinite(c.takerBuyVolume)) &&
    isAligned && c.closeTime === c.openTime + duration - 1 &&
    Math.min(c.open, c.high, c.low, c.close) > 0 && c.volume >= 0 && c.high >= Math.max(c.open,c.close,c.low) && c.low <= Math.min(c.open,c.close,c.high);
}
export function validateMinutes(candles: Candle[], first: number, count: number, now = Date.now()) {
  if (candles.length !== count || candles.some((c,i) => !validCandle(c,60000) || c.openTime !== first+i*60000 || c.closeTime >= now))
    throw new Error("توجد فجوة أو شمعة غير مكتملة في البيانات؛ لم يتغير وقت المحاكاة.");
}
export function appendReplayCandle(current: Candle[], minute: Candle, timeframe: Timeframe) {
  return appendReplayBatch(current, [minute], timeframe);
}
export function appendReplayBatch(current: Candle[], minutes: Candle[], timeframe: Timeframe, equity = false) {
  const result = current.slice();
  for (const minute of minutes) {
  const parts = equity ? new Intl.DateTimeFormat("en-US", {timeZone:"America/New_York",hourCycle:"h23",hour:"2-digit",minute:"2-digit"}).formatToParts(minute.openTime) : [];
  const origin = equity ? minute.openTime - (Number(parts.find(p=>p.type==="hour")!.value)*60 + Number(parts.find(p=>p.type==="minute")!.value) - 570)*60000 : 0;
  const start = origin + Math.floor((minute.openTime-origin) / DURATIONS[timeframe]) * DURATIONS[timeframe];
  const previous = result.at(-1);
  if (previous && minute.closeTime <= previous.closeTime) continue;
  if (previous?.openTime === start) result[result.length-1] = {
    ...previous,
    closeTime: minute.closeTime,
    high: Math.max(previous.high, minute.high),
    low: Math.min(previous.low, minute.low),
    close: minute.close,
    volume: previous.volume + minute.volume,
    takerBuyVolume: (previous.takerBuyVolume !== undefined || minute.takerBuyVolume !== undefined)
      ? (previous.takerBuyVolume ?? 0) + (minute.takerBuyVolume ?? 0)
      : undefined,
    tradeCount: (previous.tradeCount !== undefined || minute.tradeCount !== undefined)
      ? (previous.tradeCount ?? 0) + (minute.tradeCount ?? 0)
      : undefined,
  };
  else result.push({...minute,openTime:start});
  }
  return result;
}
export function finishTrade(t: Trade, fill: number, time: number, reason: string) {
  if (t.entryPrice === null || t.quantity === null) return;
  const remaining = t.remainingQuantity ?? t.quantity;
  const previous = t.partialExits ?? [];
  const fee = fill * remaining * (t.feeRate ?? FEE_RATE);
  const sign = t.side === "short" ? -1 : 1;
  const grossThisExit = sign * (fill - t.entryPrice) * remaining;
  const allocatedEntryFee = t.entryFee * remaining / t.quantity;
  const netThisExit = grossThisExit - allocatedEntryFee - fee;

  t.exitPrice = (previous.reduce((sum, x) => sum + x.price * x.quantity, 0) + fill * remaining) / t.quantity;
  t.exitTime = time;
  t.exitFee = previous.reduce((sum, x) => sum + x.fee, 0) + fee;
  t.totalFees = t.entryFee + t.exitFee;
  const previousGross = previous.reduce((sum, x) => sum + (x.grossPnl ?? (x.pnl + x.fee + t.entryFee * x.quantity / t.quantity!)), 0);
  t.grossPnl = previousGross + grossThisExit;
  t.realizedPnl = previous.reduce((sum, x) => sum + x.pnl, 0) + netThisExit;
  t.remainingQuantity = 0;
  t.rMultiple = t.initialRisk && t.initialRisk > 0 ? t.realizedPnl / t.initialRisk : null;
  t.status = "closed";
  t.exitReason = reason;
  event(t, "closed", time, `${reason}: تنفيذ ${fill} · ربح السعر: ${t.grossPnl >= 0 ? "+" : ""}${t.grossPnl.toFixed(2)}$ · الرسوم: -${t.totalFees.toFixed(2)}$ · الصافي: ${t.realizedPnl >= 0 ? "+" : ""}${t.realizedPnl.toFixed(2)}$`);
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
      t.entryPrice=fill; t.quantity=t.notional/fill; t.entryFee=t.notional*(t.feeRate ?? FEE_RATE);
      t.initialRisk=sign*(fill-t.stopLoss)*t.quantity; t.initialStop=t.stopLoss; t.initialTarget=t.takeProfit;
      t.entryTime=c.openTime; t.status="open";
      event(t,"filled",c.openTime,`${fill}${intrabarEntry ? " · تنفيذ داخل الدقيقة؛ ترتيب الحركة غير معلوم" : " · افتتاح الدقيقة"}`);
    }
    if (t.status === "close_pending") { finishTrade(t,c.open*(1-sign*SLIPPAGE),c.openTime,"إغلاق يدوي"); continue; }
    if (t.status !== "open") continue;

    if (session.engineVersion === 2 && t.pendingScaleIn) {
      const amount=t.pendingScaleIn; delete t.pendingScaleIn;
      if ((t.partialExits?.length ?? 0)>0) event(t,"scale-cancelled",c.openTime,"ألغي التعزيز بعد خروج جزئي؛ حساب اللوتات غير مدعوم.");
      else {
        const fill=c.open*(1+sign*SLIPPAGE), old=t.quantity!, added=amount/fill;
        t.entryPrice=(t.entryPrice!*old+amount)/(old+added); t.quantity=old+added; t.remainingQuantity=t.quantity;
        t.notional+=amount; t.entryFee+=amount*(t.feeRate??FEE_RATE);
        t.initialRisk=(t.initialRisk??0)+Math.max(0,sign*(fill-t.stopLoss))*added;
        event(t,"scaled-in",c.openTime,"تعزيز عند الافتتاح التالي مع انزلاق تقديري.");
      }
    }
    const conservative = session.engineVersion === 2;
    const stopTouched = short ? c.high>=t.stopLoss : c.low<=t.stopLoss;
    const partialStopTouched = (t.stopLevels??[]).some(x=>!x.filled&&x.eligibleTime<=c.openTime&&(short?c.high>=x.price:c.low<=x.price));
    const targetTouched = (short?c.low<=t.takeProfit:c.high>=t.takeProfit) || (t.takeProfitLevels??[]).some(x=>!x.filled&&x.eligibleTime<=c.openTime&&(short?c.low<=x.price:c.high>=x.price));
    if (conservative && targetTouched && (stopTouched || partialStopTouched || intrabarEntry)) event(t,"ambiguous",c.closeTime,"ترتيب الحركة داخل الدقيقة غير معلوم؛ سياسة محافظة: مخارج الخسارة أولًا ولا أرباح لدخول داخل الدقيقة.");
    if (conservative && stopTouched) {
      finishTrade(t,(intrabarEntry?t.stopLoss:short?Math.max(c.open,t.stopLoss):Math.min(c.open,t.stopLoss))*(1-sign*SLIPPAGE),c.closeTime,"وقف الخسارة"); continue;
    }
    // Partial Take Profit Levels (سحب وجني الأرباح المجزأ)
    const tpLevels=(t.takeProfitLevels??[]).filter(x=>!x.filled&&x.eligibleTime<=c.openTime&&sign*(x.price-(t.entryPrice??0))>0)
      .sort((a,b)=>sign*(a.price-b.price));
    for(const level of tpLevels) {
      if(conservative && (partialStopTouched || intrabarEntry)) continue;
      if(!(short?c.low<=level.price:c.high>=level.price)) continue;
      const remaining=t.remainingQuantity??t.quantity!;
      if(remaining<=1e-12) break;
      const quantity=Math.min(remaining,level.amount/t.entryPrice!);
      const rawFill=(intrabarEntry?level.price:short?Math.min(c.open,level.price):Math.max(c.open,level.price))*(1-sign*SLIPPAGE);
      const fill=conservative?(short?Math.min(level.price,rawFill):Math.max(level.price,rawFill)):rawFill;
      level.filled=true;
      if(quantity>=remaining-1e-12) {finishTrade(t,fill,c.closeTime,`سحب الأرباح بالكامل عند ${level.price}`);break;}
      const gross=sign*(fill-t.entryPrice!)*quantity;
      const fee=fill*quantity*(t.feeRate ?? FEE_RATE);
      const allocatedEntryFee=t.entryFee*quantity/t.quantity!;
      const pnl=gross-allocatedEntryFee-fee;
      (t.partialExits??=[]).push({price:fill,quantity,fee,pnl,grossPnl:gross,time:c.closeTime,type:"take-profit-partial"});
      t.remainingQuantity=remaining-quantity;t.exitFee=(t.exitFee??0)+fee;
      t.totalFees=(t.entryFee??0)+t.exitFee;
      t.grossPnl=(t.grossPnl??0)+gross;
      t.realizedPnl=(t.realizedPnl??0)+pnl;
      event(t,"take-profit-partial",c.closeTime,`سحب أرباح ${level.percentage?level.percentage+'%':''} عند ${level.price} · تنفيذ ${fill} · ربح السعر: ${gross>=0?"+":""}${gross.toFixed(2)}$ · الرسوم: -${(fee+allocatedEntryFee).toFixed(2)}$ · الصافي: ${pnl>=0?"+":""}${pnl.toFixed(2)}$`);
    }
    if (t.status !== "open") continue;

    let partialStopHit=false;
    const levels=(t.stopLevels??[]).filter(x=>!x.filled&&x.eligibleTime<=c.openTime&&sign*(x.price-t.stopLoss)>0)
      .sort((a,b)=>sign*(b.price-a.price));
    for(const level of levels) {
      if(!(short?c.high>=level.price:c.low<=level.price))continue;
      const remaining=t.remainingQuantity??t.quantity!;
      const quantity=Math.min(remaining,level.amount/t.entryPrice!);
      const fill=(intrabarEntry?level.price:short?Math.max(c.open,level.price):Math.min(c.open,level.price))*(1-sign*SLIPPAGE);
      level.filled=true;partialStopHit=true;
      if(quantity>=remaining-1e-12) {finishTrade(t,fill,c.closeTime,"الوقف الجزئي الأخير");break;}
      const gross=sign*(fill-t.entryPrice!)*quantity;
      const fee=fill*quantity*(t.feeRate ?? FEE_RATE);
      const allocatedEntryFee=t.entryFee*quantity/t.quantity!;
      const pnl=gross-allocatedEntryFee-fee;
      (t.partialExits??=[]).push({price:fill,quantity,fee,pnl,grossPnl:gross,time:c.closeTime,type:"partial-stop"});
      t.remainingQuantity=remaining-quantity;t.exitFee=(t.exitFee??0)+fee;
      t.totalFees=(t.entryFee??0)+t.exitFee;
      t.grossPnl=(t.grossPnl??0)+gross;
      t.realizedPnl=(t.realizedPnl??0)+pnl;
      event(t,"partial-stop",c.closeTime,`وقف جزئي عند ${level.price} · تنفيذ ${fill} · حركة السعر: ${gross>=0?"+":""}${gross.toFixed(2)}$ · الرسوم: -${(fee+allocatedEntryFee).toFixed(2)}$ · الصافي: ${pnl>=0?"+":""}${pnl.toFixed(2)}$`);
    }
    if(t.status!=="open")continue;
    if (short?c.high>=t.stopLoss:c.low<=t.stopLoss) {
      // For an intrabar entry, the candle open preceded the fill and cannot be an exit fill.
      finishTrade(t,(intrabarEntry ? t.stopLoss : short?Math.max(c.open,t.stopLoss):Math.min(c.open,t.stopLoss))*(1-sign*SLIPPAGE),c.closeTime,"وقف الخسارة");
    } else if (!partialStopHit && !intrabarEntry && (short?c.low<=t.takeProfit:c.high>=t.takeProfit)) {
      const tpFill = short ? Math.min(c.open, t.takeProfit) : Math.max(c.open, t.takeProfit);
      finishTrade(t,tpFill,c.closeTime,"جني الأرباح");
    }
    // Unknown intrabar ordering: stop-first; never credit an entry-bar target for an intrabar fill.
  }
}
export function advance(state: Workspace, candles: Candle[], count: number, now = Date.now(), expectedTimes?: number[]) {
  const session=activeSession(state);
  if (!session) throw new Error("ابدأ جلسة أولًا.");
  if (session.dataSource === "alpaca-sip-raw") {
    if (!expectedTimes || expectedTimes.length!==count || candles.length!==count || candles.some((c,i)=>!validCandle(c,60000)||c.openTime!==expectedTimes[i]||c.openTime<=session.cursorTime||c.closeTime>=now||(i>0&&c.openTime<=candles[i-1].openTime))) throw new Error("خطة دقائق الأسهم ناقصة أو غير صالحة؛ لم يتغير وقت المحاكاة.");
  } else validateMinutes(candles,session.cursorTime+1,count,now);
  for (const c of candles) { applyCandle(state,session,c); session.cursorTime=c.closeTime; session.advancedBars++; }
}
