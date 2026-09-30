import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { workspaces } from "@/db/schema";

export const dynamic = "force-dynamic";

const FEE_RATE = 0.0015;
const SLIPPAGE = 0.0002;
const INITIAL_BALANCE = 1000;
const SYMBOLS = ["BTCUSDT", "ETHUSDT"] as const;

type SymbolName = (typeof SYMBOLS)[number];
type Kline = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
type ReplaySession = {
  id: string;
  symbol: SymbolName;
  startTime: number;
  cursorTime: number;
  advancedBars: number;
  createdAt: string;
};
type PaperTrade = {
  id: string;
  sessionId: string;
  symbol: SymbolName;
  status: "pending" | "open" | "close_pending" | "closed" | "cancelled";
  notional: number;
  quantity: number | null;
  entryPrice: number | null;
  stopLoss: number;
  takeProfit: number;
  exitPrice: number | null;
  entryFee: number;
  exitFee: number;
  realizedPnl: number;
  rMultiple: number | null;
  initialRisk: number | null;
  reason: string;
  entryTime: number | null;
  exitTime: number | null;
  createdAt: string;
};
type WorkspaceState = {
  activeSessionId: string | null;
  sessions: ReplaySession[];
  trades: PaperTrade[];
};

const emptyState: WorkspaceState = {
  activeSessionId: null,
  sessions: [],
  trades: [],
};

const actionSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("start"),
    symbol: z.enum(SYMBOLS),
    startTime: z.number().int().positive(),
  }),
  z.object({ action: z.literal("step"), count: z.number().int().min(1).max(64).default(1) }),
  z.object({
    action: z.literal("buy"),
    notional: z.number().positive().max(100_000),
    stopLoss: z.number().positive(),
    takeProfit: z.number().positive(),
    referencePrice: z.number().positive(),
    reason: z.string().max(500).default(""),
  }),
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("cancel") }),
  z.object({
    action: z.literal("risk"),
    tradeId: z.string().uuid(),
    stopLoss: z.number().positive(),
    takeProfit: z.number().positive(),
  }),
]);

function json(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

async function ownerId() {
  const requestHeaders = await headers();
  const id = requestHeaders.get("oai-authenticated-user-id");
  if (id) return id;
  if (process.env.NODE_ENV !== "production") return "preview-owner";
  return null;
}

async function readWorkspace(id: string): Promise<WorkspaceState> {
  const rows = await getDb()
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, id))
    .limit(1);
  if (!rows[0]) return structuredClone(emptyState);
  try {
    const parsed = JSON.parse(rows[0].stateJson) as WorkspaceState;
    return {
      activeSessionId: parsed.activeSessionId ?? null,
      sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      trades: Array.isArray(parsed.trades) ? parsed.trades : [],
    };
  } catch {
    return structuredClone(emptyState);
  }
}

async function saveWorkspace(id: string, state: WorkspaceState) {
  const now = new Date().toISOString();
  await getDb()
    .insert(workspaces)
    .values({ ownerId: id, stateJson: JSON.stringify(state), updatedAt: now })
    .onConflictDoUpdate({
      target: workspaces.ownerId,
      set: { stateJson: JSON.stringify(state), updatedAt: now },
    })
    .run();
}

function activeSession(state: WorkspaceState) {
  return state.sessions.find((session) => session.id === state.activeSessionId) ?? null;
}

function finishTrade(trade: PaperTrade, fill: number, closeTime: number) {
  if (trade.entryPrice === null || trade.quantity === null) return;
  trade.exitPrice = fill;
  trade.exitTime = closeTime;
  trade.exitFee = fill * trade.quantity * FEE_RATE;
  trade.realizedPnl =
    (fill - trade.entryPrice) * trade.quantity - trade.entryFee - trade.exitFee;
  const initialRisk = trade.initialRisk ?? (trade.entryPrice - trade.stopLoss) * trade.quantity;
  trade.rMultiple = initialRisk > 0 ? trade.realizedPnl / initialRisk : null;
  trade.status = "closed";
}

function applyCandle(state: WorkspaceState, session: ReplaySession, candle: Kline) {
  for (const trade of state.trades) {
    if (trade.sessionId !== session.id) continue;
    if (trade.status === "pending") {
      const fill = candle.open * (1 + SLIPPAGE);
      trade.entryPrice = fill;
      trade.quantity = trade.notional / fill;
      trade.entryFee = trade.notional * FEE_RATE;
      trade.initialRisk = Math.max(fill - trade.stopLoss, 0) * trade.quantity;
      trade.entryTime = candle.openTime;
      trade.status = "open";
    }
    if (trade.status === "close_pending" && trade.quantity !== null) {
      finishTrade(trade, candle.open * (1 - SLIPPAGE), candle.openTime);
      continue;
    }
    if (trade.status !== "open" || trade.quantity === null) continue;
    const stopHit = candle.low <= trade.stopLoss;
    const targetHit = candle.high >= trade.takeProfit;
    if (stopHit) {
      const stopFill = Math.min(candle.open, trade.stopLoss) * (1 - SLIPPAGE);
      finishTrade(trade, stopFill, candle.closeTime);
    } else if (targetHit) {
      finishTrade(trade, trade.takeProfit, candle.closeTime);
    }
  }
}

export async function GET() {
  try {
    const id = await ownerId();
    if (!id) return json({ error: "يرجى تسجيل الدخول للوصول إلى جلساتك." }, 401);
    const state = await readWorkspace(id);
    return json({ state });
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
    return json({ error: message }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const id = await ownerId();
    if (!id) return json({ error: "يرجى تسجيل الدخول للوصول إلى جلساتك." }, 401);
    const input = actionSchema.safeParse(await request.json());
    if (!input.success) return json({ error: "الطلب غير مكتمل أو غير صحيح." }, 400);
    const state = await readWorkspace(id);

    if (input.data.action === "start") {
      const startTime = Math.floor(input.data.startTime / 60_000) * 60_000;
      if (startTime >= Date.now() - 60_000) {
        return json({ error: "اختر وقتًا تاريخيًا انتهى بالفعل." }, 400);
      }
      const session: ReplaySession = {
        id: crypto.randomUUID(),
        symbol: input.data.symbol,
        startTime,
        cursorTime: startTime - 1,
        advancedBars: 0,
        createdAt: new Date().toISOString(),
      };
      state.sessions = [session, ...state.sessions].slice(0, 12);
      state.activeSessionId = session.id;
      await saveWorkspace(id, state);
      return json({ state });
    }

    const session = activeSession(state);
    if (!session) return json({ error: "ابدأ جلسة Replay أولًا." }, 409);

    if (input.data.action === "step") {
      const expectedOpen = session.cursorTime + 1;
      const latestCompletedOpen = Math.floor((Date.now() - 60_000) / 60_000) * 60_000;
      if (expectedOpen > latestCompletedOpen) {
        return json({ error: "وصلت إلى أحدث شمعة مكتملة متاحة في Replay." }, 409);
      }
      const availableCount = Math.min(
        input.data.count,
        Math.floor((latestCompletedOpen - expectedOpen) / 60_000) + 1,
      );
      const query = new URLSearchParams({
        symbol: session.symbol,
        interval: "1m",
        startTime: String(expectedOpen),
        endTime: String(expectedOpen + availableCount * 60_000 - 1),
        limit: String(availableCount),
      });
      const response = await fetch(`https://data-api.binance.vision/api/v3/klines?${query}`, {
        cache: "no-store",
      });
      if (!response.ok) return json({ error: `تعذر جلب بيانات Binance (${response.status}).` }, 502);
      const rows = (await response.json()) as Array<Array<string | number>>;
      const candles: Kline[] = rows.map((row) => ({
        openTime: Number(row[0]),
        open: Number(row[1]),
        high: Number(row[2]),
        low: Number(row[3]),
        close: Number(row[4]),
        volume: Number(row[5]),
        closeTime: Number(row[6]),
      }));
      if (!candles.length) return json({ error: "لا توجد شمعة تالية لهذه الفترة." }, 404);
      for (const [index, candle] of candles.entries()) {
        const expectedCandleOpen = expectedOpen + index * 60_000;
        if (
          ![candle.openTime, candle.closeTime, candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite) ||
          candle.open <= 0 || candle.high <= 0 || candle.low <= 0 || candle.close <= 0 || candle.volume < 0 ||
          candle.openTime !== expectedCandleOpen ||
          candle.closeTime !== candle.openTime + 59_999 ||
          candle.high < Math.max(candle.open, candle.close, candle.low) ||
          candle.low > Math.min(candle.open, candle.close, candle.high)
        ) {
          return json({ error: "بيانات الشموع لا تطابق التسلسل الزمني المتوقع." }, 502);
        }
      }
      for (const candle of candles) {
        session.cursorTime = candle.closeTime;
        session.advancedBars += 1;
        applyCandle(state, session, candle);
      }
      await saveWorkspace(id, state);
      return json({ state, candles });
    }

    if (input.data.action === "buy") {
      const price = input.data.referencePrice;
      if (input.data.stopLoss >= price || input.data.takeProfit <= price) {
        return json({ error: "للشراء، يجب أن يكون الوقف تحت السعر والهدف فوقه." }, 400);
      }
      if (
        state.trades.some(
          (trade) =>
            trade.sessionId === session.id &&
            ["pending", "open", "close_pending"].includes(trade.status),
        )
      ) {
        return json({ error: "أغلق الصفقة الحالية أو ألغِ أمرها قبل فتح صفقة أخرى." }, 409);
      }
      const equity =
        INITIAL_BALANCE +
        state.trades
          .filter((trade) => trade.sessionId === session.id && trade.status === "closed")
          .reduce((sum, trade) => sum + trade.realizedPnl, 0);
      if (input.data.notional > equity) {
        return json({ error: "حجم الصفقة أكبر من الرصيد الافتراضي المتاح." }, 400);
      }
      const trade: PaperTrade = {
        id: crypto.randomUUID(),
        sessionId: session.id,
        symbol: session.symbol,
        status: "pending",
        notional: input.data.notional,
        quantity: null,
        entryPrice: null,
        stopLoss: input.data.stopLoss,
        takeProfit: input.data.takeProfit,
        exitPrice: null,
        entryFee: 0,
        exitFee: 0,
        realizedPnl: 0,
        rMultiple: null,
        initialRisk: null,
        reason: input.data.reason,
        entryTime: null,
        exitTime: null,
        createdAt: new Date().toISOString(),
      };
      state.trades = [trade, ...state.trades].slice(0, 1000);
      await saveWorkspace(id, state);
      return json({ state });
    }

    if (input.data.action === "close") {
      const trade = state.trades.find(
        (item) => item.sessionId === session.id && item.status === "open",
      );
      if (!trade) return json({ error: "لا توجد صفقة مفتوحة لإغلاقها." }, 409);
      trade.status = "close_pending";
      await saveWorkspace(id, state);
      return json({ state });
    }

    if (input.data.action === "cancel") {
      const trade = state.trades.find(
        (item) => item.sessionId === session.id && item.status === "pending",
      );
      if (!trade) return json({ error: "لا يوجد أمر معلّق لإلغائه." }, 409);
      trade.status = "cancelled";
      await saveWorkspace(id, state);
      return json({ state });
    }

    if (input.data.action === "risk") {
      const tradeId = input.data.tradeId;
      const trade = state.trades.find(
        (item) =>
          item.id === tradeId &&
          item.sessionId === session.id &&
          ["pending", "open"].includes(item.status),
      );
      if (!trade) {
        return json({ error: "الأمر أو الصفقة المفتوحة غير موجودة." }, 404);
      }
      if (
        input.data.stopLoss >= input.data.takeProfit ||
        (trade.entryPrice !== null && input.data.takeProfit <= trade.entryPrice)
      ) {
        return json({ error: "يجب أن يكون الهدف فوق سعر الدخول والوقف تحت الهدف." }, 400);
      }
      trade.stopLoss = input.data.stopLoss;
      trade.takeProfit = input.data.takeProfit;
      await saveWorkspace(id, state);
      return json({ state });
    }

    return json({ error: "نوع أمر غير مدعوم." }, 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : "حدث خطأ غير متوقع.";
    return json({ error: message }, 500);
  }
}
