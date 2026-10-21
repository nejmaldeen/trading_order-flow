import type { Candle, Timeframe } from "./replay.ts";
import { computeVolumeProfile, type VolumeProfileBucket, type VolumeProfileResult } from "./volume-profile.ts";

export type SessionGrouping = "auto" | "day" | "week" | "month";

export interface DailySessionProfile {
  dateKey: string;
  label: string;
  startTime: number;
  endTime: number;
  firstOpenTime: number;
  lastOpenTime: number;
  candleCount: number;
  profile: VolumeProfileResult;
}

/**
 * Returns a UTC date string key (YYYY-MM-DD) for grouping candles into daily sessions.
 */
export function getUtcDayKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Returns an ISO week key (YYYY-Www) for grouping candles into weekly sessions.
 */
export function getUtcWeekKey(timestamp: number): string {
  const d = new Date(timestamp);
  const day = d.getUTCDay();
  // Adjust to Monday of current week
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), diff));
  
  // Calculate ISO week number
  const target = new Date(Date.UTC(monday.getUTCFullYear(), monday.getUTCMonth(), monday.getUTCDate()));
  const dayNr = (target.getUTCDay() + 6) % 7;
  target.setUTCDate(target.getUTCDate() - dayNr + 3);
  const firstThursday = target.getTime();
  target.setUTCMonth(0, 1);
  if (target.getUTCDay() !== 4) {
    target.setUTCMonth(0, 1 + ((4 - target.getUTCDay()) + 7) % 7);
  }
  const weekNr = 1 + Math.ceil((firstThursday - target.getTime()) / 604800000);

  return `${monday.getUTCFullYear()}-W${String(weekNr).padStart(2, "0")}`;
}

/**
 * Returns a UTC month key (YYYY-MM) for grouping candles into monthly sessions.
 */
export function getUtcMonthKey(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/**
 * Groups an array of candles into sessions (Daily, Weekly, or Monthly) and computes
 * an institutional Session Volume Profile (POC, Value Area 70%, VAH, VAL, LVN)
 * for each individual session.
 * 
 * On Daily timeframe ("1d"), "auto" grouping automatically switches to "week"
 * so profiles do NOT collapse or stack on top of each other, providing wide,
 * comfortable, and spacious analysis space.
 */
export function computeDailySessionProfiles(
  candles: Candle[],
  bucketCount = 36,
  valueAreaRatio = 0.70,
  timeframe: Timeframe = "15m",
  grouping: SessionGrouping = "auto"
): DailySessionProfile[] {
  if (!candles || candles.length === 0) return [];

  // Resolve grouping: on daily timeframe ("1d"), auto-group into weekly sessions
  let resolvedGrouping = grouping;
  if (resolvedGrouping === "auto") {
    resolvedGrouping = timeframe === "1d" ? "week" : "day";
  }

  const sessionMap = new Map<string, Candle[]>();
  for (const c of candles) {
    let key: string;
    if (resolvedGrouping === "week") {
      key = getUtcWeekKey(c.openTime);
    } else if (resolvedGrouping === "month") {
      key = getUtcMonthKey(c.openTime);
    } else {
      key = getUtcDayKey(c.openTime);
    }

    let list = sessionMap.get(key);
    if (!list) {
      list = [];
      sessionMap.set(key, list);
    }
    list.push(c);
  }

  const results: DailySessionProfile[] = [];

  for (const [dateKey, sessionCandles] of sessionMap.entries()) {
    if (sessionCandles.length === 0) continue;

    const profile = computeVolumeProfile(sessionCandles, bucketCount, valueAreaRatio);
    if (!profile) continue;

    const firstCandle = sessionCandles[0];
    const lastCandle = sessionCandles[sessionCandles.length - 1];
    const startTime = firstCandle.openTime;
    const endTime = lastCandle.closeTime;

    // Human-readable Arabic date label
    const dStart = new Date(startTime);
    let label = "";
    if (resolvedGrouping === "week") {
      const dEnd = new Date(lastCandle.openTime);
      const startStr = new Intl.DateTimeFormat("ar", { day: "numeric", month: "short" }).format(dStart);
      const endStr = new Intl.DateTimeFormat("ar", { day: "numeric", month: "short" }).format(dEnd);
      label = `أسبوع ${startStr} - ${endStr}`;
    } else if (resolvedGrouping === "month") {
      label = new Intl.DateTimeFormat("ar", { month: "long", year: "numeric" }).format(dStart);
    } else {
      label = new Intl.DateTimeFormat("ar", { weekday: "short", day: "numeric", month: "short" }).format(dStart);
    }

    results.push({
      dateKey,
      label,
      startTime,
      endTime,
      firstOpenTime: firstCandle.openTime,
      lastOpenTime: lastCandle.openTime,
      candleCount: sessionCandles.length,
      profile,
    });
  }

  results.sort((a, b) => a.startTime - b.startTime);
  return results;
}
