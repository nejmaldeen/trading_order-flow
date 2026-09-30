"use client";

import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type IChartApi,
  type IPriceLine,
  type ISeriesMarkersPluginApi,
  type ISeriesApi,
  TickMarkType,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  Activity,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BookOpenCheck,
  CalendarDays,
  Check,
  ChevronDown,
  CircleHelp,
  Crosshair,
  DollarSign,
  Eye,
  Layers,
  LineChart,
  Maximize2,
  Minus,
  MousePointer2,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SkipForward,
  Sparkles,
  Target,
  Wallet,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SymbolName = "BTCUSDT" | "ETHUSDT";
type Timeframe = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
type Candle = {
  openTime: number;
  closeTime: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};
type Session = {
  id: string;
  symbol: SymbolName;
  startTime: number;
  cursorTime: number;
  advancedBars: number;
  createdAt: string;
};
type Trade = {
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
  reason: string;
  entryTime: number | null;
  exitTime: number | null;
  createdAt: string;
};
type Workspace = { activeSessionId: string | null; sessions: Session[]; trades: Trade[] };

const periods: { key: Timeframe; label: string }[] = [
  { key: "1m", label: "1د" },
  { key: "5m", label: "5د" },
  { key: "15m", label: "15د" },
  { key: "1h", label: "1س" },
  { key: "4h", label: "4س" },
  { key: "1d", label: "ي" },
];
const blank: Workspace = { activeSessionId: null, sessions: [], trades: [] };
const riyadhInput = () => {
  const date = new Date("2024-01-01T12:00:00");
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
const dateTimeInputValue = (timestamp: number) => {
  const date = new Date(timestamp);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};
const money = (value: number, digits = 2) =>
  new Intl.NumberFormat("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
const price = (value: number) => (value >= 1000 ? money(value, 1) : money(value, 3));
const fmtDate = (value: number | string | null) => {
  if (value === null) return "—";
  const timestamp = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isFinite(timestamp)
    ? new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(timestamp)
    : "—";
};
const formatAxis = (value: number) => value.toLocaleString("en-US", { maximumFractionDigits: value > 1000 ? 0 : 3 });
const formatLocalChartTime = (time: Time) => {
  if (typeof time !== "number") return "";
  return new Intl.DateTimeFormat("ar", { dateStyle: "medium", timeStyle: "short" }).format(time * 1000);
};
const formatLocalTick = (time: Time, tickType: TickMarkType) => {
  if (typeof time !== "number") return null;
  const date = new Date(time * 1000);
  if (tickType === TickMarkType.Year) return new Intl.DateTimeFormat("ar", { year: "numeric" }).format(date);
  if (tickType === TickMarkType.Month) return new Intl.DateTimeFormat("ar", { month: "short" }).format(date);
  if (tickType === TickMarkType.DayOfMonth) return new Intl.DateTimeFormat("ar", { day: "2-digit", month: "short" }).format(date);
  return new Intl.DateTimeFormat("ar", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date);
};
const exchangeIntervals: Record<Timeframe, string> = {
  "1m": "1m", "5m": "5m", "15m": "15m", "1h": "1h", "4h": "4h", "1d": "1d",
};
const timeframeDuration: Record<Timeframe, number> = {
  "1m": 60_000, "5m": 300_000, "15m": 900_000, "1h": 3_600_000, "4h": 14_400_000, "1d": 86_400_000,
};
async function fetchExchangeKlines(
  symbol: SymbolName,
  interval: string,
  options: { startTime?: number; endTime?: number; limit: number },
): Promise<Candle[]> {
  const query = new URLSearchParams({ symbol, interval, limit: String(options.limit) });
  if (options.startTime !== undefined) query.set("startTime", String(options.startTime));
  if (options.endTime !== undefined) query.set("endTime", String(options.endTime));
  const response = await fetch(`https://data-api.binance.vision/api/v3/klines?${query}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`تعذر جلب بيانات Binance (${response.status}).`);
  const rows = (await response.json()) as Array<Array<string | number>>;
  return rows.map((row) => ({
    openTime: Number(row[0]), open: Number(row[1]), high: Number(row[2]), low: Number(row[3]),
    close: Number(row[4]), volume: Number(row[5]), closeTime: Number(row[6]),
  }));
}
async function fetchChartCandles(session: Session, timeframe: Timeframe): Promise<Candle[]> {
  const duration = timeframeDuration[timeframe];
  const bucketStart = Math.floor((session.cursorTime + (timeframe === "1m" ? 1 : 0)) / duration) * duration;
  const completedPromise = fetchExchangeKlines(session.symbol, exchangeIntervals[timeframe], { endTime: bucketStart - 1, limit: 320 });
  if (timeframe === "1m") return completedPromise;
  const partialPromise = fetchExchangeKlines(session.symbol, "1m", { startTime: bucketStart, endTime: session.cursorTime, limit: 1500 });
  const [completed, minutes] = await Promise.all([completedPromise, partialPromise]);
  if (!minutes.length) return completed;
  const partial: Candle = {
    openTime: bucketStart,
    closeTime: minutes.at(-1)!.closeTime,
    open: minutes[0].open,
    high: Math.max(...minutes.map((bar) => bar.high)),
    low: Math.min(...minutes.map((bar) => bar.low)),
    close: minutes.at(-1)!.close,
    volume: minutes.reduce((sum, bar) => sum + bar.volume, 0),
  };
  return [...completed, partial];
}
function appendReplayCandle(current: Candle[], minute: Candle, timeframe: Timeframe) {
  const bucketStart = Math.floor(minute.openTime / timeframeDuration[timeframe]) * timeframeDuration[timeframe];
  const existing = current.findIndex((candle) => candle.openTime === bucketStart);
  const next = current.slice();
  if (existing >= 0) {
    const previous = next[existing];
    next[existing] = {
      openTime: bucketStart, closeTime: minute.closeTime, open: previous.open,
      high: Math.max(previous.high, minute.high), low: Math.min(previous.low, minute.low),
      close: minute.close, volume: previous.volume + minute.volume,
    };
  } else {
    next.push({ ...minute, openTime: bucketStart });
  }
  return next.slice(-320);
}
function computeDailyVwap(candles: Candle[]) {
  let day = "";
  let pv = 0;
  let vol = 0;
  return candles.map((candle) => {
    const currentDay = new Date(candle.openTime).toISOString().slice(0, 10);
    if (currentDay !== day) {
      day = currentDay;
      pv = 0;
      vol = 0;
    }
    const typicalPrice = (candle.high + candle.low + candle.close) / 3;
    pv += typicalPrice * candle.volume;
    vol += candle.volume;
    return { time: (candle.openTime / 1000) as UTCTimestamp, value: pv / Math.max(vol, 1) };
  });
}

export default function TradingLab() {
  const [symbol, setSymbol] = useState<SymbolName>("BTCUSDT");
  const [timeframe, setTimeframe] = useState<Timeframe>("15m");
  const [workspace, setWorkspace] = useState<Workspace>(blank);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [startDate, setStartDate] = useState(riyadhInput);
  const startDateTouched = useRef(false);
  const [loading, setLoading] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [error, setError] = useState("");
  const [showVolume, setShowVolume] = useState(true);
  const [showVwap, setShowVwap] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawnPrice, setDrawnPrice] = useState<number | null>(null);
  const [notional, setNotional] = useState("100");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [reason, setReason] = useState("");
  const [tab, setTab] = useState<"trades" | "journal">("trades");
  const [statsOpen, setStatsOpen] = useState(false);
  const chartHost = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);
  const vwapSeries = useRef<ISeriesApi<"Line"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const drawingRef = useRef(false);
  const actionBusy = useRef(false);
  const stepBusy = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(() => Promise.resolve());

  const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId) ?? null;
  const currentSymbol = session?.symbol ?? symbol;
  const sessionTrades = workspace.trades.filter((trade) => trade.sessionId === session?.id);
  const openTrade = sessionTrades.find((trade) => ["pending", "open", "close_pending"].includes(trade.status)) ?? null;
  const closedTrades = sessionTrades.filter((trade) => trade.status === "closed");
  const wins = closedTrades.filter((trade) => trade.realizedPnl > 0).length;
  const losses = closedTrades.filter((trade) => trade.realizedPnl <= 0).length;
  const netPnl = closedTrades.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const equity = 1000 + netPnl;
  const winRate = closedTrades.length ? (wins / closedTrades.length) * 100 : 0;
  const latest = candles.at(-1);
  const change = latest ? ((latest.close - latest.open) / latest.open) * 100 : 0;
  const longAvg = useMemo(() => computeDailyVwap(candles), [candles]);
  const parsedStartDate = new Date(startDate).getTime();
  const selectedStartTime = Number.isFinite(parsedStartDate)
    ? Math.floor(parsedStartDate / 60_000) * 60_000
    : null;
  const selectedDateDiffers = Boolean(session && selectedStartTime !== session.startTime);

  const load = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const response = await fetch("/api/lab", { cache: "no-store" });
      const payload = (await response.json()) as { error?: string; state?: Workspace };
      if (!response.ok) throw new Error(payload.error ?? "تعذر تحميل بيانات الجلسة.");
      const nextWorkspace = payload.state ?? blank;
      setWorkspace(nextWorkspace);
      const nextSession = nextWorkspace.sessions.find((item) => item.id === nextWorkspace.activeSessionId);
      if (nextSession) {
        if (!startDateTouched.current) setStartDate(dateTimeInputValue(nextSession.startTime));
        setCandles(await fetchChartCandles(nextSession, timeframe));
      }
      else setCandles([]);
      setError(payload.error ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر الاتصال بالخادم.");
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    refreshRef.current = () => load(false);
  }, [load]);

  useEffect(() => {
    drawingRef.current = drawing;
  }, [drawing]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(true), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const act = useCallback(async (body: Record<string, unknown>) => {
    if (actionBusy.current) return false;
    actionBusy.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await response.json()) as { error?: string; state?: Workspace; candle?: Candle };
      if (!response.ok) throw new Error(payload.error ?? "لم يكتمل الإجراء.");
      if (payload.state) setWorkspace(payload.state);
      if (body.action === "start") await refreshRef.current();
      if (body.action === "step" && payload.candle) {
        setCandles((current) => appendReplayCandle(current, payload.candle!, timeframe));
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع.");
      if (body.action === "step") setPlaying(false);
      return false;
    } finally {
      actionBusy.current = false;
      setLoading(false);
    }
  }, [timeframe]);

  const advanceStep = useCallback(async () => {
    if (!session || stepBusy.current || actionBusy.current) return;
    stepBusy.current = true;
    setLoading(true);
    try {
      const nextOpen = session.cursorTime + 1;
      const [candle] = await fetchExchangeKlines(session.symbol, "1m", {
        startTime: nextOpen,
        endTime: nextOpen + 59_999,
        limit: 1,
      });
      if (!candle) throw new Error("لا توجد شمعة تالية لهذه الفترة.");
      await act({ action: "step", candle });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الشمعة التالية.");
      setPlaying(false);
    } finally {
      stepBusy.current = false;
      setLoading(false);
    }
  }, [session, act]);

  useEffect(() => {
    if (!playing || workspace.activeSessionId === null) return;
    const timer = window.setInterval(() => void advanceStep(), 850 / replaySpeed);
    return () => window.clearInterval(timer);
  }, [playing, workspace.activeSessionId, replaySpeed, advanceStep]);

  useEffect(() => {
    const host = chartHost.current;
    if (!host) return;
    const chart = createChart(host, {
      width: host.clientWidth,
      height: host.clientHeight,
      layout: { background: { color: "#0c1117" }, textColor: "#7f8b99", fontFamily: "Inter, Arial, sans-serif", fontSize: 11 },
      grid: { vertLines: { color: "#17212b" }, horzLines: { color: "#17212b" } },
      crosshair: { mode: 0, vertLine: { color: "#6f7e8d", labelBackgroundColor: "#293746" }, horzLine: { color: "#6f7e8d", labelBackgroundColor: "#293746" } },
      rightPriceScale: { borderColor: "#26313d", scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: "#26313d", timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 8, minBarSpacing: 3, tickMarkFormatter: formatLocalTick },
      localization: { priceFormatter: formatAxis, timeFormatter: formatLocalChartTime },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    const candlesRef = chart.addSeries(CandlestickSeries, {
      upColor: "#12b886", downColor: "#f05b68", borderUpColor: "#12b886", borderDownColor: "#f05b68", wickUpColor: "#12b886", wickDownColor: "#f05b68",
    });
    const volumeRef = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" }, priceScaleId: "volume",
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    const vwapRef = chart.addSeries(LineSeries, { color: "#eab85b", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    const markerPlugin = createSeriesMarkers(candlesRef, []);
    chart.subscribeClick((param) => {
      if (!drawingRef.current || !param.point || !candleSeries.current) return;
      const selected = candleSeries.current.coordinateToPrice(param.point.y);
      if (selected !== null) setDrawnPrice(selected);
      setDrawing(false);
    });
    const resize = new ResizeObserver(() => chart.applyOptions({ width: host.clientWidth, height: host.clientHeight }));
    resize.observe(host);
    chartRef.current = chart;
    candleSeries.current = candlesRef;
    volumeSeries.current = volumeRef;
    vwapSeries.current = vwapRef;
    markersRef.current = markerPlugin;
    return () => {
      resize.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
      vwapSeries.current = null;
      markersRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!chartRef.current || !candleSeries.current) return;
    const chartData = candles.map((candle) => ({
      time: (candle.openTime / 1000) as UTCTimestamp,
      open: candle.open,
      high: candle.high,
      low: candle.low,
      close: candle.close,
    }));
    candleSeries.current.setData(chartData);
    volumeSeries.current?.setData(candles.map((candle) => ({
      time: (candle.openTime / 1000) as UTCTimestamp,
      value: candle.volume,
      color: candle.close >= candle.open ? "#12b88655" : "#f05b6855",
    })));
    vwapSeries.current?.setData(showVwap ? longAvg : []);
    volumeSeries.current?.applyOptions({ visible: showVolume });
    const trade = workspace.trades.find((item) => item.sessionId === session?.id && ["open", "close_pending"].includes(item.status));
    if (trade && candleSeries.current) {
      markersRef.current?.setMarkers([
        { time: ((trade.entryTime ?? session?.cursorTime ?? 0) / 1000) as UTCTimestamp, position: "belowBar", color: "#6ea8fe", shape: "arrowUp", text: "شراء" },
      ]);
    } else markersRef.current?.setMarkers([]);
    if (candles.length) chartRef.current.timeScale().scrollToRealTime();
  }, [candles, showVwap, showVolume, longAvg, workspace.trades, session?.id, session?.cursorTime]);

  useEffect(() => {
    const series = candleSeries.current;
    if (!series) return;
    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];
    if (openTrade?.status === "open") {
      priceLinesRef.current.push(series.createPriceLine({ price: openTrade.entryPrice!, color: "#6ea8fe", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "الدخول" }));
      priceLinesRef.current.push(series.createPriceLine({ price: openTrade.stopLoss, color: "#f05b68", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "وقف" }));
      priceLinesRef.current.push(series.createPriceLine({ price: openTrade.takeProfit, color: "#12b886", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: "هدف" }));
    }
    if (drawnPrice !== null) priceLinesRef.current.push(series.createPriceLine({ price: drawnPrice, color: "#a78bfa", lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: "مستوى" }));
  }, [openTrade, drawnPrice, candles]);

  const startReplay = async (autoPlay = false) => {
    const rawStartTime = new Date(startDate).getTime();
    if (!Number.isFinite(rawStartTime)) {
      setError("أدخل تاريخًا ووقتًا صحيحين للبداية.");
      return;
    }
    const startTime = Math.floor(rawStartTime / 60_000) * 60_000;
    setPlaying(false);
    const ok = await act({ action: "start", symbol, startTime });
    if (ok) {
      setDrawnPrice(null);
      if (autoPlay) setPlaying(true);
    }
  };
  const submitLong = async () => {
    const close = latest?.close;
    if (!close) return setError("ابدأ المحاكاة حتى تظهر الشموع قبل وضع الأمر.");
    const stop = Number(stopLoss || (close * 0.99).toFixed(close < 100 ? 4 : 2));
    const target = Number(takeProfit || (close * 1.02).toFixed(close < 100 ? 4 : 2));
    const ok = await act({ action: "buy", notional: Number(notional), stopLoss: stop, takeProfit: target, referencePrice: close, reason });
    if (ok) setReason("");
  };

  return (
    <main className="trading-shell" dir="rtl">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Activity size={17} /></div><div><strong>مختبر التداول</strong><small>REPLAY LAB <span>·</span> تجريبي</small></div></div>
        <div className="asset-head">
          <button className="pair-select" onClick={() => setSymbol(symbol === "BTCUSDT" ? "ETHUSDT" : "BTCUSDT")}><span className="coin-icon">{currentSymbol === "BTCUSDT" ? "₿" : "Ξ"}</span><span><b>{currentSymbol.slice(0, -4)} <i>/ USDT</i></b><small>{currentSymbol === symbol ? "Binance Spot" : `الجلسة الحالية: ${currentSymbol.slice(0, -4)}`}</small></span><ChevronDown size={13} /></button>
          <div className="asset-price"><strong>{latest ? price(latest.close) : "—"}</strong><span className={change >= 0 ? "positive" : "negative"}>{latest ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "بانتظار بدء Replay"}</span></div>
        </div>
        <div className="top-actions"><span className="connection"><i /> بيانات تاريخية</span><button className="icon-button" title="التنبيهات"><Bell size={16} /></button><button className="icon-button" title="الإعدادات"><Settings2 size={17} /></button><div className="avatar">م</div></div>
      </header>

      <div className="workspace-grid">
        <nav className="toolrail" aria-label="أدوات الرسم"><button className="rail-active" title="المؤشر"><Crosshair size={18} /></button><button title="السهم"><MousePointer2 size={18} /></button><button className={drawing ? "rail-active" : ""} onClick={() => setDrawing(!drawing)} title="رسم مستوى أفقي"><Minus size={18} /></button><button title="مؤشرات"><Activity size={18} /></button><div className="rail-divider" /><button title="الأدوات"><Layers size={18} /></button><button title="المساعدة"><CircleHelp size={18} /></button></nav>

        <section className="main-stage">
          <div className="chart-toolbar">
            <div className="symbol-meta"><span className="market-icon">{currentSymbol === "BTCUSDT" ? "₿" : "Ξ"}</span><div><strong>{currentSymbol.slice(0, -4)} / TetherUS</strong><small>Binance · السوق الفوري</small></div><span className="market-state"><i /> السوق مغلق · تاريخي</span></div>
            <div className="periods">{periods.map((period) => <button key={period.key} onClick={() => setTimeframe(period.key)} className={timeframe === period.key ? "selected" : ""}>{period.label}</button>)}<span className="toolbar-separator" /><button title="المؤشرات" onClick={() => setShowVwap(!showVwap)} className={showVwap ? "selected" : ""}><LineChart size={15} /><span>المؤشرات</span></button><button title="ملء الشاشة"><Maximize2 size={15} /></button></div>
          </div>
          <div className="ohlc-strip"><span>{fmtDate(session?.cursorTime ?? null)}</span>{latest && <><span>فتح <b>{price(latest.open)}</b></span><span>أعلى <b className="positive">{price(latest.high)}</b></span><span>أدنى <b className="negative">{price(latest.low)}</b></span><span>إغلاق <b>{price(latest.close)}</b></span><span>حجم <b>{money(latest.volume, 2)}</b></span></>}</div>
          <div className="chart-area"><div className="chart-caption"><span>{currentSymbol.slice(0, -4)} / TetherUS · {periods.find((p) => p.key === timeframe)?.label} · Binance</span><div><button onClick={() => setShowVolume(!showVolume)} className={showVolume ? "caption-active" : ""}><BarChart3 size={13} /> الحجم</button>{showVwap && <span className="vwap-key"><i /> VWAP يومي*</span>}</div></div><div className={`chart-host ${drawing ? "drawing-mode" : ""}`} ref={chartHost}>{loading && candles.length === 0 ? <div className="chart-empty chart-loading"><span className="loading-spinner"><Activity size={18} /></span><strong>جار استعادة الجلسة والشموع</strong><span>نحمّل بيانات السوق حتى نقطة Replay المحفوظة.</span></div> : (!session || candles.length === 0) && <div className="chart-empty"><div className="empty-icon"><CalendarDays size={21} /></div><strong>{session ? "لا توجد شموع لهذه الفترة" : "اختر لحظة تاريخية وابدأ التدريب"}</strong><span>{session ? "قد لا تتوفر بيانات Binance لهذا الأصل والتاريخ. اختر تاريخًا ضمن فترة تداول الأصل." : "ستظهر الشموع تدريجيًا مع تحريك Replay، دون كشف بيانات لاحقة."}</span>{!session && <button onClick={() => void startReplay()} disabled={loading}><Play size={14} fill="currentColor" /> ابدأ Replay</button>}</div>}{drawing && <span className="drawing-tip">انقر على الشارت لإضافة مستوى سعري</span>}</div><div className="chart-footer"><span><span className="legend-candle green" /> صاعد <span className="legend-candle red" /> هابط</span><span>TradingView Lightweight Charts™</span><span className="timezone">التوقيت المحلي <ChevronDown size={12} /></span></div></div>

          <section className="replay-panel">
            <div className="replay-title"><div className="replay-symbol"><RotateCcw size={15} /></div><div><strong>إعادة تشغيل السوق</strong><small>{session ? `الجلسة بدأت في ${fmtDate(session.startTime)}` : "حدد التاريخ والأصل لبدء جلسة جديدة"}</small></div><span className="replay-status"><i /> Replay</span></div>
            <div className="replay-controls"><button className="play-button" title={selectedDateDiffers ? "ابدأ التشغيل من الوقت المحدد" : playing ? "إيقاف Replay" : "تشغيل Replay"} aria-label={selectedDateDiffers ? "ابدأ Replay من الوقت المحدد" : playing ? "إيقاف Replay" : "تشغيل Replay"} onClick={() => { if (!session || selectedDateDiffers) void startReplay(true); else setPlaying(!playing); }} disabled={loading}>{playing ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}</button><button className="step-button" onClick={() => session ? void advanceStep() : void startReplay()} disabled={loading} title="شمعة واحدة"><SkipForward size={16} /></button><select aria-label="سرعة التشغيل" value={replaySpeed} onChange={(event) => setReplaySpeed(Number(event.target.value))}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option><option value="8">8×</option></select><div className="replay-line"><span className="replay-dot" style={{ left: `${Math.max(0, Math.min(100, ((session?.advancedBars ?? 0) % 120) / 1.2))}%` }} /></div><span className="bar-count">{session?.advancedBars ?? 0} <i>خطوة</i></span><button className="reset-button" onClick={() => { setPlaying(false); startDateTouched.current = false; setStartDate(riyadhInput()); }} title="التاريخ الافتراضي"><RotateCcw size={14} /></button></div>
            <div className="replay-date"><span><CalendarDays size={14} /> تاريخ البداية</span><input type="datetime-local" value={startDate} onChange={(event) => { startDateTouched.current = true; setStartDate(event.target.value); }} /><button onClick={() => void startReplay()} disabled={loading} title="ابدأ جلسة جديدة من التاريخ والوقت المحددين"><Play size={12} fill="currentColor" /> {session ? "ابدأ من التاريخ" : "ابدأ الجلسة"}</button><span className="replay-privacy"><ShieldCheck size={13} /> لا توجد صفقات حقيقية</span></div>
          </section>

          <section className="history-panel"><div className="history-head"><div className="history-tabs"><button onClick={() => setTab("trades")} className={tab === "trades" ? "active" : ""}>الصفقات <span>{sessionTrades.length}</span></button><button onClick={() => setTab("journal")} className={tab === "journal" ? "active" : ""}><BookOpenCheck size={14} /> دفتر التداول</button></div><button className="export-button"><Eye size={13} /> عرض الكل</button></div>{tab === "trades" ? <div className="table-wrap"><table><thead><tr><th>الأصل</th><th>النوع</th><th>الدخول</th><th>الخروج</th><th>الكمية</th><th>النتيجة</th><th>الحالة</th><th>الوقت</th></tr></thead><tbody>{sessionTrades.length ? sessionTrades.slice().reverse().map((trade) => <tr key={trade.id}><td><span className="tiny-coin">{trade.symbol === "BTCUSDT" ? "₿" : "Ξ"}</span>{trade.symbol.slice(0, -4)}/USDT</td><td><span className="side-long">شراء</span></td><td>{trade.entryPrice ? price(trade.entryPrice) : "سعر الشمعة التالية"}</td><td>{trade.exitPrice ? price(trade.exitPrice) : "—"}</td><td>{trade.quantity ? money(trade.quantity, 5) : money(trade.notional, 2) + " USDT"}</td><td className={trade.realizedPnl >= 0 ? "positive" : "negative"}>{trade.status === "closed" ? `${trade.realizedPnl >= 0 ? "+" : ""}${money(trade.realizedPnl)}` : "—"}</td><td><span className={`status-pill ${trade.status}`}>{trade.status === "pending" ? "معلق" : trade.status === "open" ? "مفتوح" : trade.status === "close_pending" ? "إغلاق معلّق" : trade.status === "closed" ? "مغلق" : "ملغى"}</span></td><td>{fmtDate(trade.entryTime ?? trade.createdAt)}</td></tr>) : <tr><td colSpan={8} className="table-empty">لا توجد صفقات في هذه الجلسة بعد. استخدم لوحة الأوامر للتدرب.</td></tr>}</tbody></table></div> : <div className="journal-list">{sessionTrades.filter((trade) => trade.reason.trim()).length ? sessionTrades.filter((trade) => trade.reason.trim()).slice().reverse().map((trade) => <article key={trade.id}><div><BookOpenCheck size={14} /><span>{fmtDate(trade.entryTime ?? trade.createdAt)}</span><b className={trade.realizedPnl >= 0 ? "positive" : "negative"}>{trade.status === "closed" ? `${trade.realizedPnl >= 0 ? "+" : ""}${money(trade.realizedPnl)} USDT` : "قيد المتابعة"}</b></div><p>{trade.reason}</p></article>) : <div className="journal-empty"><BookOpenCheck size={18} /><span>لم تُسجّل مبررات دخول بعد. أضف مبررًا قبل تنفيذ صفقة.</span><button onClick={() => setTab("trades")}>العودة إلى لوحة الأمر</button></div>}</div>}</section>
        </section>

        <aside className="right-panel">
          <div className="panel-top"><span>لوحة التداول</span><button title="إغلاق اللوحة"><X size={15} /></button></div>
          <div className="balance-card"><div className="balance-label"><Wallet size={14} /><span>رصيد المحاكاة</span><button title="الرصيد الافتراضي"><Eye size={13} /></button></div><strong>{money(equity)} <small>USDT</small></strong><div className="balance-bottom"><span>ربح/خسارة محققة</span><b className={netPnl >= 0 ? "positive" : "negative"}>{netPnl >= 0 ? "+" : ""}{money(netPnl)} USDT</b></div></div>
          <div className="panel-tabs"><button className="active">شراء / بيع</button><button onClick={() => setStatsOpen(!statsOpen)}>الأداء <Activity size={13} /></button></div>
          {statsOpen ? <div className="stats-content"><div><span>الصفقات المغلقة</span><b>{closedTrades.length}</b></div><div><span>نسبة الفوز</span><b>{winRate.toFixed(1)}%</b></div><div><span>رابحة / خاسرة</span><b><i className="positive">{wins}</i> / <i className="negative">{losses}</i></b></div><div><span>صافي الأداء</span><b className={netPnl >= 0 ? "positive" : "negative"}>{netPnl >= 0 ? "+" : ""}{money(netPnl)} USDT</b></div><p>الرسوم 0.15% لكل تنفيذ · انزلاق سعري 0.02% · Spot فقط</p></div> : <>
            <div className="order-type"><button className="active"><Activity size={13} /> سوق</button><button disabled title="قيد التطوير">محدد</button><button disabled title="قيد التطوير">وقف</button></div>
            <div className="order-body"><div className="order-field"><label>حجم الأمر</label><div className="input-with-unit"><input type="number" min="1" value={notional} onChange={(e) => setNotional(e.target.value)} /><span>USDT</span></div><div className="quick-sizes">{[50, 100, 250, 500].map((amount) => <button key={amount} className={Number(notional) === amount ? "picked" : ""} onClick={() => setNotional(String(amount))}>{amount}</button>)}</div></div>
              <div className="risk-fields"><label><span><i className="risk-dot stop" /> وقف الخسارة</span><input value={stopLoss} onChange={(e) => setStopLoss(e.target.value)} inputMode="decimal" placeholder={latest ? price(latest.close * 0.99) : "السعر"} /></label><label><span><i className="risk-dot target" /> جني الأرباح</span><input value={takeProfit} onChange={(e) => setTakeProfit(e.target.value)} inputMode="decimal" placeholder={latest ? price(latest.close * 1.02) : "السعر"} /></label></div>
              <div className="risk-summary"><span>المخاطرة / العائد</span><b>{latest ? `${((Number(takeProfit) || latest.close * 1.02) - latest.close) / Math.max(latest.close - (Number(stopLoss) || latest.close * 0.99), 0.0001)}`.slice(0, 4) : "—"} R</b></div>
              <label className="reason-label">مبرر الدخول<textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ما سبب دخولك؟ اكتب شروط الاستراتيجية…" maxLength={500} /></label>
              <button className="buy-button" onClick={submitLong} disabled={loading || !session || Boolean(openTrade)}><ArrowUpRight size={16} /> شراء {currentSymbol.slice(0, -4)} <span>شراء Spot</span></button>
              {openTrade?.status === "pending" && <div className="notice-pending"><Activity size={14} /> الأمر ينتظر افتتاح الشمعة التالية <button onClick={() => void act({ action: "cancel" })} title="إلغاء الأمر المعلّق"><X size={13} /></button></div>}
              {openTrade?.status === "open" && <><div className="open-trade-card"><div><span><i className="open-dot" /> الصفقة مفتوحة</span><b>{openTrade.entryPrice ? price(openTrade.entryPrice) : "—"}</b></div><p>وقف {price(openTrade.stopLoss)} <span>·</span> هدف {price(openTrade.takeProfit)}</p><button onClick={() => void act({ action: "close" })} disabled={loading}><ArrowDownRight size={14} /> إغلاق مع الشمعة التالية</button></div><button className="update-risk-button" onClick={() => void act({ action: "risk", tradeId: openTrade.id, stopLoss: Number(stopLoss) || openTrade.stopLoss, takeProfit: Number(takeProfit) || openTrade.takeProfit })} disabled={loading}><Target size={13} /> تحديث الوقف والهدف</button></>}
              {!session && <p className="side-hint">ابدأ Replay حتى تصبح أوامر المحاكاة متاحة.</p>}
            </div>
          </>}
          {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError("")}><X size={13} /></button></div>}
          <div className="market-card"><div className="market-card-title"><span>نظرة على السوق</span><span className="demo-badge">DEMO</span></div><div className="market-mini"><span>BTC</span><b>{currentSymbol === "BTCUSDT" && latest ? price(latest.close) : "—"}</b><small className={change >= 0 ? "positive" : "negative"}>{currentSymbol === "BTCUSDT" && latest ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}</small></div><div className="market-mini"><span>ETH</span><b>{currentSymbol === "ETHUSDT" && latest ? price(latest.close) : "—"}</b><small className={change >= 0 ? "positive" : "negative"}>{currentSymbol === "ETHUSDT" && latest ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}</small></div><div className="market-note"><Sparkles size={13} /> الأسعار من شموع Binance التاريخية</div></div>
          <div className="risk-note"><ShieldCheck size={14} /><p>محاكاة تعليمية فقط. لا يتم إرسال أي أوامر إلى Binance.</p></div>
        </aside>
      </div>
      <footer className="statusbar"><span><i className="status-live" /> متصل ببيانات Binance</span><span>جلساتك تحفظ تلقائيًا</span><span><DollarSign size={12} /> حساب تجريبي · 1,000 USDT</span><span className="statusbar-right"><Check size={12} /> جميع الأنظمة جاهزة</span></footer>
    </main>
  );
}
