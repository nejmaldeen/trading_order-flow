import test from "node:test";
import assert from "node:assert/strict";
import { SYMBOLS, SYMBOL_INFO, INITIAL_BALANCE } from "../lib/replay.ts";

test("SYMBOLS includes all 9 supported institutional and crypto assets", () => {
  assert.deepEqual(Array.from(SYMBOLS), [
    "BTCUSDT",
    "ETHUSDT",
    "SOLUSDT",
    "XAUTUSDT",
    "AAPL",
    "NVDA",
    "AMD",
    "GOOGL",
    "PAXGUSDT",
  ]);
});

test("SYMBOL_INFO provides complete Arabic and metadata configuration for all symbols", () => {
  for (const sym of SYMBOLS) {
    const info = SYMBOL_INFO[sym];
    assert.ok(info, `Metadata should exist for ${sym}`);
    assert.ok(info.name, `English name should exist for ${sym}`);
    assert.ok(info.arabicName, `Arabic name should exist for ${sym}`);
    assert.ok(info.base, `Base currency should exist for ${sym}`);
    assert.ok(info.quote === "USDT" || info.quote === "USD");
    assert.ok(info.icon, `Icon should exist for ${sym}`);
    assert.ok(info.badgeColor, `Badge color should exist for ${sym}`);
    assert.ok(info.description, `Description should exist for ${sym}`);
  }

  assert.equal(SYMBOL_INFO.BTCUSDT.base, "BTC");
  assert.equal(SYMBOL_INFO.ETHUSDT.base, "ETH");
  assert.equal(SYMBOL_INFO.SOLUSDT.base, "SOL");
  assert.equal(SYMBOL_INFO.XAUTUSDT.base, "XAUT");
  assert.equal(SYMBOL_INFO.AAPL.base, "AAPL");
  assert.equal(SYMBOL_INFO.NVDA.base, "NVDA");
  assert.equal(SYMBOL_INFO.AMD.base, "AMD");
  assert.equal(SYMBOL_INFO.GOOGL.base, "GOOGL");
  assert.equal(SYMBOL_INFO.PAXGUSDT.base, "PAXG");

  assert.equal(SYMBOL_INFO.BTCUSDT.icon, "₿");
  assert.equal(SYMBOL_INFO.ETHUSDT.icon, "Ξ");
  assert.equal(SYMBOL_INFO.SOLUSDT.icon, "◎");
  assert.equal(SYMBOL_INFO.XAUTUSDT.icon, "🪙");
  assert.equal(SYMBOL_INFO.AAPL.icon, "🍎");
  assert.equal(SYMBOL_INFO.NVDA.icon, "🟢");
  assert.equal(SYMBOL_INFO.AMD.icon, "🔴");
  assert.equal(SYMBOL_INFO.GOOGL.icon, "🔵");
  assert.equal(SYMBOL_INFO.PAXGUSDT.icon, "🪙");
});

test("INITIAL_BALANCE is set to 2500 USDT as requested by user", () => {
  assert.equal(INITIAL_BALANCE, 2500);
});

test("normalizeWorkspace preserves initialBalance and defaults to INITIAL_BALANCE", async () => {
  const { normalizeWorkspace } = await import("../lib/replay.ts");
  const defaultWs = normalizeWorkspace({});
  assert.equal(defaultWs.initialBalance, 2500);

  const customWs = normalizeWorkspace({ initialBalance: 10000 });
  assert.equal(customWs.initialBalance, 10000);
});
