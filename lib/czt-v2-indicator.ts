import type { Candle } from './replay.ts';

export interface CztV2Config {
  lookback: number;     // Value Area Lookback (default: 20)
  vaRatio: number;      // Value Area Ratio (default: 0.70)
  atrLen: number;       // ATR Period (default: 14)
  volMult: number;      // Prime Volume Multiplier (default: 1.5)
  tp1R: number;         // Breakout TP1 R Multiple (default: 1.5)
  trendLen: number;     // Macro Trend Filter Length (default: 100)
  filterTrend: boolean; // Veto Signals in Downtrends (default: true)
  filterChop: boolean;  // Filter Dead & Small Candles (default: true)
}

export const DEFAULT_CZT_V2_CONFIG: CztV2Config = {
  lookback: 20,
  vaRatio: 0.70,
  atrLen: 14,
  volMult: 1.5,
  tp1R: 1.5,
  trendLen: 100,
  filterTrend: true,
  filterChop: true,
};

export interface CztV2BarResult {
  time: number;          // UTC timestamp in seconds for lightweight-charts
  openTimeMs: number;
  vah: number;
  poc: number;
  val: number;
  trendEma: number;
  atr: number;
  volSma: number;
  stopLoss: number | null;
  tp1: number | null;
  isPrime: boolean;
  isRebound: boolean;
  isBreakout: boolean;
}

export interface CztV2SeriesOutput {
  bars: CztV2BarResult[];
  vahSeries: { time: number; value: number }[];
  pocSeries: { time: number; value: number }[];
  valSeries: { time: number; value: number }[];
  trendSeries: { time: number; value: number }[];
  slSeries: { time: number; value: number }[];
  tpSeries: { time: number; value: number }[];
  markers: {
    time: number;
    position: 'belowBar' | 'aboveBar';
    color: string;
    shape: 'arrowUp' | 'arrowDown' | 'circle';
    text: string;
  }[];
  latest: CztV2BarResult | null;
}

/**
 * Calculates the CZT V2 Institutional Master Indicator.
 * Includes:
 * 1. Steidlmayer Volume Profile levels (VAH, VAL, POC) over lookback=20 with va_ratio=0.70.
 * 2. Macro Trend Filter (EMA100).
 * 3. Volatility Filter (Range >= 0.65 * ATR14).
 * 4. Micro-Stop Loss (Low - 0.1 * ATR - 0.05% Close).
 * 5. Breakout TP1 Target (Entry + 1.5 * Risk).
 * 6. PRIME BUY (1.5x Volume Breakout) and VAL REBOUND signals.
 */
export function calculateCztV2(
  candles: Candle[],
  config: Partial<CztV2Config> = {}
): CztV2SeriesOutput {
  const cfg: CztV2Config = { ...DEFAULT_CZT_V2_CONFIG, ...config };
  const n = candles.length;
  if (n === 0) {
    return {
      bars: [],
      vahSeries: [],
      pocSeries: [],
      valSeries: [],
      trendSeries: [],
      slSeries: [],
      tpSeries: [],
      markers: [],
      latest: null,
    };
  }

  // 1. Calculate ATR(14)
  const atrValues = new Array<number>(n).fill(0);
  let trSum = 0;
  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const prevClose = i > 0 ? candles[i - 1].close : c.open;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
    if (i < cfg.atrLen) {
      trSum += tr;
      atrValues[i] = trSum / (i + 1);
    } else {
      // Wilder's Smoothing: (prevATR * (len - 1) + tr) / len
      atrValues[i] = (atrValues[i - 1] * (cfg.atrLen - 1) + tr) / cfg.atrLen;
    }
  }

  // 2. Calculate Volume SMA(20)
  const volSmaValues = new Array<number>(n).fill(0);
  let volWindowSum = 0;
  const volPeriod = 20;
  for (let i = 0; i < n; i++) {
    volWindowSum += candles[i].volume;
    if (i >= volPeriod) {
      volWindowSum -= candles[i - volPeriod].volume;
      volSmaValues[i] = volWindowSum / volPeriod;
    } else {
      volSmaValues[i] = volWindowSum / (i + 1);
    }
  }

  // 3. Calculate Trend EMA(100)
  const trendEmaValues = new Array<number>(n).fill(0);
  const alpha = 2 / (cfg.trendLen + 1);
  let currentEma = candles[0].close;
  trendEmaValues[0] = currentEma;
  for (let i = 1; i < n; i++) {
    currentEma = candles[i].close * alpha + currentEma * (1 - alpha);
    trendEmaValues[i] = currentEma;
  }

  const bars: CztV2BarResult[] = [];
  const vahSeries: { time: number; value: number }[] = [];
  const pocSeries: { time: number; value: number }[] = [];
  const valSeries: { time: number; value: number }[] = [];
  const trendSeries: { time: number; value: number }[] = [];
  const slSeries: { time: number; value: number }[] = [];
  const tpSeries: { time: number; value: number }[] = [];
  const markers: CztV2SeriesOutput['markers'] = [];

  let lastActiveSl: number | null = null;
  let lastActiveTp: number | null = null;
  let activeSignalExpiry = 0; // retain SL/TP line projection for up to 10 bars

  for (let i = 0; i < n; i++) {
    const c = candles[i];
    const timeSec = Math.floor(c.openTime / 1000);

    // Lookback window for Steidlmayer profile
    const windowStart = Math.max(0, i - cfg.lookback + 1);
    let highestP = -Infinity;
    let lowestP = Infinity;
    let sumClose = 0;
    let sumVol = 0;
    let sumVolWeightedPrice = 0;
    let count = 0;

    for (let j = windowStart; j <= i; j++) {
      const bar = candles[j];
      if (bar.high > highestP) highestP = bar.high;
      if (bar.low < lowestP) lowestP = bar.low;
      sumClose += bar.close;
      sumVol += bar.volume;
      sumVolWeightedPrice += bar.close * bar.volume;
      count++;
    }

    const midSma = count > 0 ? sumClose / count : c.close;
    // Hybrid Steidlmayer POC: volume weighted price when volume > 0, fallback to midSma
    const poc = sumVol > 0 ? sumVolWeightedPrice / sumVol : midSma;

    const pRange = highestP - lowestP;
    const halfVa = (pRange * cfg.vaRatio) / 2.0;

    const vah = Math.min(highestP, poc + halfVa);
    const val = Math.max(lowestP, poc - halfVa);

    const currentAtr = atrValues[i];
    const currentVolSma = volSmaValues[i];
    const trendVal = trendEmaValues[i];

    // 1. Trend Filter
    const isBullish = !cfg.filterTrend || c.close > trendVal;

    // 2. Volatility & Candle Physics Filter
    const candleRange = c.high - c.low;
    const lowerWick = Math.min(c.open, c.close) - c.low;

    const hasVolatility = !cfg.filterChop || candleRange >= 0.65 * currentAtr;
    const hasVolume = c.volume >= 0.85 * currentVolSma;
    const hasAbsorption = candleRange > 0 && lowerWick >= 0.30 * candleRange;

    // 3. Execution Conditions
    // Breakout above VAH: bullish trend + green candle + volume
    const isBreakout =
      isBullish &&
      c.close > vah &&
      c.close > c.open &&
      hasVolatility &&
      hasVolume;

    const isPrime = isBreakout && c.volume >= cfg.volMult * currentVolSma;

    // VAL Rebound: bullish trend + dip to/below VAL * 1.002 + close >= VAL + absorption/volume
    const isRebound =
      isBullish &&
      c.low <= val * 1.002 &&
      c.close >= val &&
      c.close > c.open &&
      hasVolatility &&
      (hasAbsorption || hasVolume);

    let stopLoss: number | null = null;
    let tp1: number | null = null;

    if (isPrime || isBreakout) {
      stopLoss = c.low - 0.10 * currentAtr - c.close * 0.0005;
      const risk = Math.max(c.close - stopLoss, c.close * 0.001);
      tp1 = c.close + cfg.tp1R * risk;
      lastActiveSl = stopLoss;
      lastActiveTp = tp1;
      activeSignalExpiry = i + 15;
    } else if (isRebound) {
      stopLoss = c.low - 0.10 * currentAtr - c.close * 0.0005;
      const risk = Math.max(c.close - stopLoss, c.close * 0.001);
      tp1 = poc > c.close ? poc : c.close + cfg.tp1R * risk;
      lastActiveSl = stopLoss;
      lastActiveTp = tp1;
      activeSignalExpiry = i + 15;
    } else if (i <= activeSignalExpiry && lastActiveSl !== null && lastActiveTp !== null) {
      // Invalidate if price breaches stop loss
      if (c.low <= lastActiveSl || c.high >= lastActiveTp) {
        lastActiveSl = null;
        lastActiveTp = null;
      }
    } else {
      lastActiveSl = null;
      lastActiveTp = null;
    }

    const barResult: CztV2BarResult = {
      time: timeSec,
      openTimeMs: c.openTime,
      vah,
      poc,
      val,
      trendEma: trendVal,
      atr: currentAtr,
      volSma: currentVolSma,
      stopLoss,
      tp1,
      isPrime,
      isRebound,
      isBreakout,
    };

    bars.push(barResult);

    // Populate Lightweight Charts data series (only if lookback bars have passed)
    if (i >= cfg.lookback - 1) {
      vahSeries.push({ time: timeSec, value: vah });
      pocSeries.push({ time: timeSec, value: poc });
      valSeries.push({ time: timeSec, value: val });
    }
    if (i >= 5) {
      trendSeries.push({ time: timeSec, value: trendVal });
    }
    if (lastActiveSl !== null) {
      slSeries.push({ time: timeSec, value: lastActiveSl });
    }
    if (lastActiveTp !== null) {
      tpSeries.push({ time: timeSec, value: lastActiveTp });
    }

    // Visual Markers
    if (isPrime) {
      markers.push({
        time: timeSec,
        position: 'belowBar',
        color: '#22c55e', // Emerald neon
        shape: 'arrowUp',
        text: '★ PRIME BUY 1.5x',
      });
    } else if (isRebound) {
      markers.push({
        time: timeSec,
        position: 'belowBar',
        color: '#3b82f6', // Cyan/Blue
        shape: 'arrowUp',
        text: '⚡ VAL REBOUND',
      });
    }
  }

  return {
    bars,
    vahSeries,
    pocSeries,
    valSeries,
    trendSeries,
    slSeries,
    tpSeries,
    markers,
    latest: bars.length > 0 ? bars[bars.length - 1] : null,
  };
}
