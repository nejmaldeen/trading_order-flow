import test from "node:test";
import assert from "node:assert/strict";
import { SYMBOLS, SYMBOL_INFO, INITIAL_BALANCE } from "../lib/replay.ts";

test("SYMBOLS includes all 4 supported assets", () => {
  assert.deepEqual(Array.from(SYMBOLS), ["BTCUSDT", "ETHUSDT", "SOLUSDT", "XAUTUSDT"]);
});

test("SYMBOL_INFO provides complete Arabic and metadata configuration for all symbols", () => {
  for (const sym of SYMBOLS) {
    const info = SYMBOL_INFO[sym];
    assert.ok(info, `Metadata should exist for ${sym}`);
    assert.ok(info.name, `English name should exist for ${sym}`);
    assert.ok(info.arabicName, `Arabic name should exist for ${sym}`);
    assert.ok(info.base, `Base currency should exist for ${sym}`);
    assert.equal(info.quote, "USDT");
    assert.ok(info.icon, `Icon should exist for ${sym}`);
    assert.ok(info.badgeColor, `Badge color should exist for ${sym}`);
    assert.ok(info.description, `Description should exist for ${sym}`);
  }

  assert.equal(SYMBOL_INFO.BTCUSDT.base, "BTC");
  assert.equal(SYMBOL_INFO.ETHUSDT.base, "ETH");
  assert.equal(SYMBOL_INFO.SOLUSDT.base, "SOL");
  assert.equal(SYMBOL_INFO.XAUTUSDT.base, "XAUT");

  assert.equal(SYMBOL_INFO.BTCUSDT.icon, "₿");
  assert.equal(SYMBOL_INFO.ETHUSDT.icon, "Ξ");
  assert.equal(SYMBOL_INFO.SOLUSDT.icon, "◎");
  assert.equal(SYMBOL_INFO.XAUTUSDT.icon, "🪙");
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
