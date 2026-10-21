import type { Candle } from "@/lib/replay";

export type VolumeProfileBucket = {
  price: number;
  totalVolume: number;
  buyVolume: number;
  sellVolume: number;
  isPoc: boolean;
  isValueArea: boolean;
  isHvn: boolean;
};

export type VolumeProfileResult = {
  buckets: VolumeProfileBucket[];
  pocPrice: number;
  pocVolume: number;
  vahPrice: number; // Value Area High (70%)
  valPrice: number; // Value Area Low (70%)
  totalVolume: number;
  minPrice: number;
  maxPrice: number;
  step: number;
};

/**
 * Computes Order Flow Volume Profile from an array of candles.
 * Divides price range into `bucketCount` horizontal levels,
 * calculates volume distribution, POC (Point of Control), and Value Area (70%).
 */
export function computeVolumeProfile(
  candles: Candle[],
  bucketCount = 48,
  valueAreaRatio = 0.70
): VolumeProfileResult | null {
  if (!candles.length) return null;

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalVolume = 0;

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
  const rawBuckets: { price: number; buy: number; sell: number; total: number }[] = [];
  for (let i = 0; i < bucketCount; i++) {
    rawBuckets.push({
      price: minPrice + (i + 0.5) * step,
      buy: 0,
      sell: 0,
      total: 0,
    });
  }

  // Distribute each candle's volume across intersected buckets
  for (const c of candles) {
    if (c.volume <= 0) continue;
    const cHigh = Math.min(c.high, maxPrice);
    const cLow = Math.max(c.low, minPrice);
    const candleSpan = Math.max(cHigh - cLow, step * 0.5);

    // Estimate buy vs sell volume based on close vs open and range
    const isBullish = c.close >= c.open;
    const bodySize = Math.abs(c.close - c.open);
    const totalSpan = Math.max(c.high - c.low, 1e-9);
    const deltaRatio = Math.min(0.85, 0.5 + (bodySize / totalSpan) * 0.35);
    const buyVol = isBullish ? c.volume * deltaRatio : c.volume * (1 - deltaRatio);
    const sellVol = c.volume - buyVol;

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
    }
  }

  // Find POC (Point of Control)
  let pocIdx = 0;
  let pocVolume = 0;
  for (let i = 0; i < bucketCount; i++) {
    if (rawBuckets[i].total > pocVolume) {
      pocVolume = rawBuckets[i].total;
      pocIdx = i;
    }
  }

  const pocPrice = rawBuckets[pocIdx].price;

  // Calculate Value Area (70% total volume centered around POC)
  const targetVaVolume = totalVolume * valueAreaRatio;
  let currentVaVolume = rawBuckets[pocIdx].total;
  let upIdx = pocIdx;
  let downIdx = pocIdx;

  while (currentVaVolume < targetVaVolume && (upIdx < bucketCount - 1 || downIdx > 0)) {
    const nextUpVol = upIdx < bucketCount - 1 ? rawBuckets[upIdx + 1].total : -1;
    const nextDownVol = downIdx > 0 ? rawBuckets[downIdx - 1].total : -1;

    if (nextUpVol >= nextDownVol && nextUpVol > 0) {
      upIdx++;
      currentVaVolume += nextUpVol;
    } else if (nextDownVol > 0) {
      downIdx--;
      currentVaVolume += nextDownVol;
    } else {
      break;
    }
  }

  const vahPrice = rawBuckets[upIdx].price + step * 0.5;
  const valPrice = rawBuckets[downIdx].price - step * 0.5;

  // Detect High Volume Nodes (peaks in histogram)
  const buckets: VolumeProfileBucket[] = rawBuckets.map((b, i) => {
    const prev = i > 0 ? rawBuckets[i - 1].total : 0;
    const next = i < bucketCount - 1 ? rawBuckets[i + 1].total : 0;
    const isPeak = b.total > prev && b.total > next && b.total > pocVolume * 0.45;

    return {
      price: b.price,
      totalVolume: b.total,
      buyVolume: b.buy,
      sellVolume: b.sell,
      isPoc: i === pocIdx,
      isValueArea: i >= downIdx && i <= upIdx,
      isHvn: isPeak,
    };
  });

  return {
    buckets,
    pocPrice,
    pocVolume,
    vahPrice,
    valPrice,
    totalVolume,
    minPrice,
    maxPrice,
    step,
  };
}
