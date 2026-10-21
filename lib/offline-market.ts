import offlinePack from '../data/offline-pack.json' with { type: 'json' };
import { DURATIONS, type Candle, type SymbolName, type Timeframe } from './replay.ts';
import type { MarketResult } from './market-data.ts';

type RawCandleRow = [number, number, number, number, number, number];

interface OfflineSymbolPack {
  [timeframe: string]: RawCandleRow[];
}

interface OfflinePackData {
  version: number;
  updatedAt: string;
  symbols: Record<string, OfflineSymbolPack>;
}

const pack = offlinePack as unknown as OfflinePackData;

export function parseRawRow(row: RawCandleRow, interval: Timeframe): Candle {
  const duration = DURATIONS[interval];
  const openTime = row[0];
  return {
    openTime,
    open: row[1],
    high: row[2],
    low: row[3],
    close: row[4],
    volume: row[5],
    closeTime: openTime + duration - 1,
  };
}

export function isOfflineDataAvailable(symbol: SymbolName, interval?: Timeframe): boolean {
  const symData = pack.symbols[symbol];
  if (!symData) return false;
  if (interval) return Array.isArray(symData[interval]) && symData[interval].length > 0;
  return Object.values(symData).some(arr => arr.length > 0);
}

export function getOfflineSummary() {
  const summary: Record<string, {
    updatedAt: string;
    timeframes: Record<string, { count: number; start: number; end: number }>;
  }> = {};

  for (const [sym, tfs] of Object.entries(pack.symbols)) {
    summary[sym] = {
      updatedAt: pack.updatedAt,
      timeframes: {},
    };
    for (const [tf, rows] of Object.entries(tfs)) {
      if (rows && rows.length > 0) {
        summary[sym].timeframes[tf] = {
          count: rows.length,
          start: rows[0][0],
          end: rows[rows.length - 1][0] + (DURATIONS[tf as Timeframe] || 60000) - 1,
        };
      }
    }
  }

  return {
    version: pack.version,
    updatedAt: pack.updatedAt,
    symbols: summary,
  };
}

export function getOfflineDateBounds(symbol: SymbolName, interval: Timeframe) {
  const rows = pack.symbols[symbol]?.[interval];
  if (!rows || rows.length === 0) return null;
  const duration = DURATIONS[interval];
  return {
    start: rows[0][0],
    end: rows[rows.length - 1][0] + duration - 1,
    count: rows.length,
  };
}

export async function offlineMarketData(
  symbol: SymbolName,
  interval: Timeframe,
  start: number,
  end: number
): Promise<MarketResult> {
  const duration = DURATIONS[interval];
  const rows = pack.symbols[symbol]?.[interval] ?? [];

  if (rows.length === 0) {
    return { candles: [], source: 'المخزن المحلي · وضع عدم الاتصال (أوفلاين)' };
  }

  // Filter rows within [start, end]
  const matched: Candle[] = [];
  for (const row of rows) {
    const openTime = row[0];
    const closeTime = openTime + duration - 1;
    if (openTime >= start && closeTime <= end) {
      matched.push(parseRawRow(row, interval));
    }
  }

  return {
    candles: matched,
    source: 'المخزن المحلي · وضع عدم الاتصال (أوفلاين)',
  };
}
