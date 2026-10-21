import fs from 'node:fs/promises';
import path from 'node:path';

const SYMBOLS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'XAUTUSDT'];
const TIMEFRAMES = [
  { tf: '1m', limit: 1440 },
  { tf: '5m', limit: 1000 },
  { tf: '15m', limit: 1000 },
  { tf: '1h', limit: 1000 },
  { tf: '4h', limit: 500 },
  { tf: '1d', limit: 500 },
];

async function fetchKlines(symbol, interval, limit) {
  const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance error: ${res.status}`);
  const data = await res.json();
  // Map to compact array: [openTime, open, high, low, close, volume]
  return data.map(row => [
    Number(row[0]),
    Number(row[1]),
    Number(row[2]),
    Number(row[3]),
    Number(row[4]),
    Number(row[5]),
  ]);
}

async function main() {
  console.log('Downloading complete offline candles dataset...');
  const result = {
    version: 1,
    updatedAt: new Date().toISOString(),
    symbols: {},
  };

  for (const sym of SYMBOLS) {
    result.symbols[sym] = {};
    for (const { tf, limit } of TIMEFRAMES) {
      try {
        const klines = await fetchKlines(sym, tf, limit);
        result.symbols[sym][tf] = klines;
        console.log(`✓ ${sym} [${tf}]: ${klines.length} candles (From: ${new Date(klines[0][0]).toISOString().slice(0, 10)} To: ${new Date(klines[klines.length - 1][0]).toISOString().slice(0, 10)})`);
      } catch (err) {
        console.error(`✗ ${sym} [${tf}]:`, err.message);
      }
    }
  }

  const outPath = path.resolve(process.cwd(), 'data', 'offline-pack.json');
  await fs.writeFile(outPath, JSON.stringify(result), 'utf-8');
  const stat = await fs.stat(outPath);
  console.log(`\nSuccessfully created offline pack at ${outPath} (${(stat.size / 1024).toFixed(1)} KB)`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
