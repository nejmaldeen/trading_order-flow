/**
 * Institutional Order Flow & Auction Market Theory Engine for Replay-Site.
 * Implements CVD, Volume Profile (POC/VAH/VAL/LVN), Big Trades, Absorption, and the CZT Framework.
 */

import type { Candle } from "./replay";

export type AuctionCondition = "VALUE_UP" | "VALUE_DOWN" | "VALUE_INSIDE";
export type ProfileShape = "D_SHAPE" | "P_SHAPE" | "B_SHAPE" | "THIN_TREND";

export interface OrderFlowBucket {
  price: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  delta: number;
  isPoc: boolean;
  isValueArea: boolean;
  isLvn: boolean;
}

export interface OrderFlowProfileResult {
  buckets: OrderFlowBucket[];
  pocPrice: number;
  pocVolume: number;
  vahPrice: number;
  valPrice: number;
  lvnLevels: number[];
  shape: ProfileShape;
  condition: AuctionCondition;
  totalVolume: number;
  totalDelta: number;
  minPrice: number;
  maxPrice: number;
  step: number;
}

export interface CVDEntry {
  time: number;
  delta: number;
  cumulativeDelta: number;
  buyVolume: number;
  sellVolume: number;
  isDivergence: boolean;
  divergenceType?: "BULLISH_DIVERGENCE" | "BEARISH_DIVERGENCE";
}

export interface BigTradeMarker {
  time: number;
  price: number;
  volume: number;
  delta: number;
  side: "BUY" | "SELL";
  isAbsorption: boolean;
  trappedSide?: "TRAPPED_BUYERS" | "TRAPPED_SELLERS";
}

export interface CZTStatus {
  condition: AuctionCondition;
  conditionLabel: string;
  nearestZone: {
    name: string;
    price: number;
    distance: number;
  } | null;
  activePlaybook: "TREND_CONTINUATION" | "VALUE_REVERSAL" | "WAITING";
  summary: string;
}

/**
 * Computes intra-candle estimated buy & sell volume using price action & wick analysis.
 * Body ratio and close position relative to high/low determine the delta aggression.
 */
export function estimateCandleDelta(c: Candle): { buyVol: number; sellVol: number; delta: number } {
  if (c.volume <= 0) return { buyVol: 0, sellVol: 0, delta: 0 };
  const span = Math.max(c.high - c.low, 1e-8);
  const body = c.close - c.open;
  const isBull = body >= 0;

  // Fraction of volume dominated by buyers
  const closePosition = (c.close - c.low) / span; // 0 (closed at low) to 1 (closed at high)
  const bodyFraction = Math.abs(body) / span;

  let buyRatio: number;
  if (isBull) {
    buyRatio = 0.5 + 0.35 * bodyFraction + 0.1 * closePosition;
  } else {
    buyRatio = 0.5 - 0.35 * bodyFraction - 0.1 * (1 - closePosition);
  }
  buyRatio = Math.max(0.05, Math.min(0.95, buyRatio));

  const buyVol = c.volume * buyRatio;
  const sellVol = c.volume * (1 - buyRatio);
  return {
    buyVol,
    sellVol,
    delta: buyVol - sellVol,
  };
}

/**
 * Calculates Cumulative Volume Delta (CVD) series and detects divergences.
 */
export function computeCVDSeries(candles: Candle[]): CVDEntry[] {
  let runningCvd = 0;
  const entries: CVDEntry[] = [];

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const { buyVol, sellVol, delta } = estimateCandleDelta(c);
    runningCvd += delta;

    entries.push({
      time: c.openTime / 1000,
      delta,
      cumulativeDelta: runningCvd,
      buyVolume: buyVol,
      sellVolume: sellVol,
      isDivergence: false,
    });
  }

  // Detect CVD Divergences over the last 15-30 bars
  const lookback = 20;
  for (let i = lookback; i < entries.length; i++) {
    const cCurr = candles[i];
    const cPrev = candles[i - lookback];
    const cvdCurr = entries[i].cumulativeDelta;
    const cvdPrev = entries[i - lookback].cumulativeDelta;

    // Bullish Divergence: Price lower low, CVD higher low
    if (cCurr.low < cPrev.low && cvdCurr > cvdPrev && entries[i].delta > 0) {
      entries[i].isDivergence = true;
      entries[i].divergenceType = "BULLISH_DIVERGENCE";
    }
    // Bearish Divergence: Price higher high, CVD lower high
    else if (cCurr.high > cPrev.high && cvdCurr < cvdPrev && entries[i].delta < 0) {
      entries[i].isDivergence = true;
      entries[i].divergenceType = "BEARISH_DIVERGENCE";
    }
  }

  return entries;
}

/**
 * Computes Institutional Order Flow Volume Profile, POC, VAH, VAL, and LVN.
 */
export function computeOrderFlowProfile(
  candles: Candle[],
  bucketCount = 48,
  valueAreaRatio = 0.70
): OrderFlowProfileResult | null {
  if (!candles.length) return null;

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalVolume = 0;
  let totalDelta = 0;

  for (const c of candles) {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
    totalVolume += c.volume;
  }

  if (minPrice >= maxPrice || totalVolume <= 0 || !Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
    return null;
  }

  const range = maxPrice - minPrice;
  const step = range / bucketCount;

  // Initialize buckets
  const rawBuckets = Array.from({ length: bucketCount }, (_, i) => ({
    price: minPrice + (i + 0.5) * step,
    buy: 0,
    sell: 0,
    total: 0,
    delta: 0,
  }));

  for (const c of candles) {
    if (c.volume <= 0) continue;
    const { buyVol, sellVol, delta } = estimateCandleDelta(c);
    totalDelta += delta;

    const cHigh = Math.min(c.high, maxPrice);
    const cLow = Math.max(c.low, minPrice);

    const minIdx = Math.max(0, Math.min(bucketCount - 1, Math.floor((cLow - minPrice) / step)));
    const maxIdx = Math.max(0, Math.min(bucketCount - 1, Math.floor((cHigh - minPrice) / step)));
    const count = maxIdx - minIdx + 1;

    const volPerBucket = c.volume / count;
    const buyPerBucket = buyVol / count;
    const sellPerBucket = sellVol / count;

    for (let idx = minIdx; idx <= maxIdx; idx++) {
      rawBuckets[idx].total += volPerBucket;
      rawBuckets[idx].buy += buyPerBucket;
      rawBuckets[idx].sell += sellPerBucket;
      rawBuckets[idx].delta += buyPerBucket - sellPerBucket;
    }
  }

  // Find POC
  let pocIdx = 0;
  let pocVolume = 0;
  for (let i = 0; i < bucketCount; i++) {
    if (rawBuckets[i].total > pocVolume) {
      pocVolume = rawBuckets[i].total;
      pocIdx = i;
    }
  }
  const pocPrice = rawBuckets[pocIdx].price;

  // Dual expansion for 70% Value Area
  const targetVolume = totalVolume * valueAreaRatio;
  let currentVolume = pocVolume;
  let upIdx = pocIdx;
  let downIdx = pocIdx;

  while (currentVolume < targetVolume && (upIdx < bucketCount - 1 || downIdx > 0)) {
    const nextUp = upIdx < bucketCount - 1 ? rawBuckets[upIdx + 1].total : 0;
    const nextDown = downIdx > 0 ? rawBuckets[downIdx - 1].total : 0;

    if (nextUp >= nextDown && upIdx < bucketCount - 1) {
      upIdx++;
      currentVolume += rawBuckets[upIdx].total;
    } else if (downIdx > 0) {
      downIdx--;
      currentVolume += rawBuckets[downIdx].total;
    } else if (upIdx < bucketCount - 1) {
      upIdx++;
      currentVolume += rawBuckets[upIdx].total;
    } else {
      break;
    }
  }

  const valPrice = rawBuckets[downIdx].price - step * 0.5;
  const vahPrice = rawBuckets[upIdx].price + step * 0.5;

  // Detect Low Volume Nodes (LVN)
  const lvnLevels: number[] = [];
  const meanVol = totalVolume / bucketCount;
  for (let i = 1; i < bucketCount - 1; i++) {
    const prev = rawBuckets[i - 1].total;
    const curr = rawBuckets[i].total;
    const next = rawBuckets[i + 1].total;
    if (curr < prev && curr < next && curr < meanVol * 0.45) {
      lvnLevels.push(rawBuckets[i].price);
    }
  }

  // Determine Profile Shape
  let shape: ProfileShape = "D_SHAPE";
  const pocRelative = (pocPrice - minPrice) / range;
  if (pocRelative > 0.65) shape = "P_SHAPE";
  else if (pocRelative < 0.35) shape = "B_SHAPE";
  else shape = "D_SHAPE";

  // Auction Condition
  const latestClose = candles[candles.length - 1].close;
  let condition: AuctionCondition = "VALUE_INSIDE";
  if (latestClose > vahPrice) condition = "VALUE_UP";
  else if (latestClose < valPrice) condition = "VALUE_DOWN";
  else condition = "VALUE_INSIDE";

  const buckets: OrderFlowBucket[] = rawBuckets.map((b, idx) => ({
    price: b.price,
    totalVolume: b.total,
    buyVolume: b.buy,
    sellVolume: b.sell,
    delta: b.delta,
    isPoc: idx === pocIdx,
    isValueArea: idx >= downIdx && idx <= upIdx,
    isLvn: lvnLevels.includes(b.price),
  }));

  return {
    buckets,
    pocPrice,
    pocVolume,
    vahPrice,
    valPrice,
    lvnLevels,
    shape,
    condition,
    totalVolume,
    totalDelta,
    minPrice,
    maxPrice,
    step,
  };
}

/**
 * Scans candles for Big Trades and Return on Effort Absorption (Trapped Traders).
 */
export function detectBigTradesAndAbsorption(candles: Candle[]): BigTradeMarker[] {
  if (candles.length < 5) return [];

  // Compute average candle volume
  const sumVol = candles.reduce((s, c) => s + c.volume, 0);
  const avgVol = sumVol / candles.length;
  const threshold = avgVol * 2.2; // Institutional volume spike

  const markers: BigTradeMarker[] = [];

  for (const c of candles) {
    if (c.volume < threshold) continue;

    const { buyVol, sellVol, delta } = estimateCandleDelta(c);
    const span = Math.max(c.high - c.low, 1e-8);
    const upperWick = c.high - Math.max(c.open, c.close);
    const lowerWick = Math.min(c.open, c.close) - c.low;

    let isAbsorption = false;
    let trappedSide: "TRAPPED_BUYERS" | "TRAPPED_SELLERS" | undefined;

    // Absorption at Top (Trapped Buyers):
    // Heavy volume, large upper wick rejection (> 40% of candle span), close near bottom.
    if (upperWick / span > 0.40 && c.close < c.open) {
      isAbsorption = true;
      trappedSide = "TRAPPED_BUYERS";
    }
    // Absorption at Bottom (Trapped Sellers):
    // Heavy volume, large lower wick rejection (> 40% of candle span), close near top.
    else if (lowerWick / span > 0.40 && c.close > c.open) {
      isAbsorption = true;
      trappedSide = "TRAPPED_SELLERS";
    }

    markers.push({
      time: c.openTime / 1000,
      price: trappedSide === "TRAPPED_BUYERS" ? c.high : trappedSide === "TRAPPED_SELLERS" ? c.low : (c.open + c.close) / 2,
      volume: c.volume,
      delta,
      side: delta >= 0 ? "BUY" : "SELL",
      isAbsorption,
      trappedSide,
    });
  }

  return markers;
}

/**
 * Evaluates the CZT Framework status based on profile, price, and zones.
 */
export function evaluateCZTFramework(
  candles: Candle[],
  profile: OrderFlowProfileResult | null
): CZTStatus {
  if (!candles.length || !profile) {
    return {
      condition: "VALUE_INSIDE",
      conditionLabel: "انتظار البيانات",
      nearestZone: null,
      activePlaybook: "WAITING",
      summary: "جارٍ تجميع بيانات المزاد وتدفق الأوامر...",
    };
  }

  const latest = candles[candles.length - 1];
  const price = latest.close;

  // Key Zones
  const zones = [
    { name: "POC (نقطة السيطرة)", price: profile.pocPrice },
    { name: "VAH (الحد الأعلى للمزاد)", price: profile.vahPrice },
    { name: "VAL (الحد الأدنى للمزاد)", price: profile.valPrice },
    ...profile.lvnLevels.map((lvn, idx) => ({ name: `LVN فجوة سيولة #${idx + 1}`, price: lvn })),
  ];

  // Find nearest zone
  zones.sort((a, b) => Math.abs(a.price - price) - Math.abs(b.price - price));
  const nearest = zones[0];
  const distance = nearest.price - price;

  let conditionLabel = "توازن وسعر عادل (Balance / Range)";
  let activePlaybook: CZTStatus["activePlaybook"] = "WAITING";
  let summary = "";

  if (profile.condition === "VALUE_UP") {
    conditionLabel = "اختراق صاعد وقبول قيمة أعلى (Value Up / Bullish Trend)";
    activePlaybook = "TREND_CONTINUATION";
    summary = `السعر أعلى من VAH (${profile.vahPrice.toFixed(2)}). الاتجاه صاعد مؤسساتياً؛ ابحث عن الشراء عند إعادة اختبار VAH أو اختراق Micro-Balance.`;
  } else if (profile.condition === "VALUE_DOWN") {
    conditionLabel = "كسر هابط وقبول قيمة أدنى (Value Down / Bearish Trend)";
    activePlaybook = "TREND_CONTINUATION";
    summary = `السعر أدنى من VAL (${profile.valPrice.toFixed(2)}). الاتجاه هابط مؤسساتياً؛ ابحث عن البيع عند إعادة اختبار VAL أو كسر Micro-Balance.`;
  } else {
    conditionLabel = "توازن ورينج (Value Inside / Auction Balance)";
    activePlaybook = "VALUE_REVERSAL";
    summary = `السعر داخل منطقة القيمة بين ${profile.valPrice.toFixed(2)} و ${profile.vahPrice.toFixed(2)}. تداول الارتداد نحو POC (${profile.pocPrice.toFixed(2)}).`;
  }

  return {
    condition: profile.condition,
    conditionLabel,
    nearestZone: {
      name: nearest.name,
      price: nearest.price,
      distance,
    },
    activePlaybook,
    summary,
  };
}
