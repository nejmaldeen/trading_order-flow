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

import { blank, appendReplayCandle, type SymbolName, type Timeframe, type Candle, type Session, type Trade, type Workspace, type OrderType } from "@/lib/replay";
import IndicatorLibrary from "@/components/indicator-library";
import { defaultIndicators, indicatorValues, type IndicatorSettings, type IndicatorKey } from "@/lib/indicators";
import { cashPreview } from "@/lib/order-preview";
import { FEE_RATE } from "@/lib/replay";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
const orderLabels = { market: "سوق", limit: "محدد", stop: "وقف شراء" };
const periods: { key: Timeframe; label: string }[] = [
  { key: "1m", label: "1د" },
  { key: "5m", label: "5د" },
  { key: "15m", label: "15د" },
  { key: "1h", label: "1س" },
  { key: "4h", label: "4س" },
  { key: "1d", label: "ي" },
];

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
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [historyAvailable, setHistoryAvailable] = useState(true);
  const historyBusy = useRef(false);
  const historyAbort = useRef<AbortController | null>(null);
  const historyEpoch = useRef(0);
  const olderLoadRef = useRef<() => void>(()=>{});
  const candlesRef = useRef<Candle[]>([]);
  const renderedFirst = useRef<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
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
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [orderPrice, setOrderPrice] = useState("");
  const [source, setSource] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorSettings>(defaultIndicators);
  const [showGrid, setShowGrid] = useState(true);
  const [layout, setLayout] = useState({ orderOpen: false, historyOpen: false, width: 320, height: 160 });
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const workspaceRef = useRef(workspace);
  const followChart = useRef(true);
  const playingRef = useRef(false);
  const resizeRef = useRef<{kind: "order" | "history"; x: number; y: number; size: number} | null>(null);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem("replay-layout-v2") || "null");
      if (saved) setLayout({orderOpen: saved.orderOpen !== false, historyOpen: saved.historyOpen === true,
        width: Math.max(280, Math.min(460, Number(saved.width) || 320)), height: Math.max(100, Math.min(300, Number(saved.height) || 160))});
    } catch { /* Browser storage is optional. */ }
    try { const visual = JSON.parse(localStorage.getItem("replay-visual-v1") || "null");
      if(visual) { setShowGrid(visual.grid !== false); setShowVolume(visual.volume !== false); }
    } catch {}
    try { const saved = JSON.parse(localStorage.getItem("replay-indicators-v1")||"null");
      if(saved) setIndicators(Object.fromEntries(Object.entries(defaultIndicators).map(([key,value])=>[key,{enabled:saved[key]?.enabled===true,period:Number.isInteger(saved[key]?.period)&&saved[key].period>=2&&saved[key].period<=200?saved[key].period:value.period}])) as IndicatorSettings);
    } catch {}
    setPrefsLoaded(true);
  }, []);
  useEffect(() => { if(prefsLoaded) { try { localStorage.setItem("replay-layout-v2", JSON.stringify(layout)); } catch {} } }, [layout,prefsLoaded]);
  useEffect(() => { if(prefsLoaded) { try { localStorage.setItem("replay-visual-v1",JSON.stringify({grid:showGrid,volume:showVolume})); } catch {} } }, [showGrid,showVolume,prefsLoaded]);
  useEffect(()=>{if(prefsLoaded)try{localStorage.setItem("replay-indicators-v1",JSON.stringify(indicators));}catch{}},[indicators,prefsLoaded]);
  const resizeStart = (e: ReactPointerEvent<HTMLDivElement>, kind: "order" | "history") => {
    e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault();
    resizeRef.current = {kind, x:e.clientX, y:e.clientY, size:kind === "order" ? layout.width : layout.height};
  };
  const resizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeRef.current; if(!drag) return;
    setLayout(old => drag.kind === "order" ? {...old,width:Math.max(280,Math.min(460,drag.size+e.clientX-drag.x))}
      : {...old,height:Math.max(100,Math.min(300,drag.size+drag.y-e.clientY))});
  };
  const stopPlaying = () => { playingRef.current=false; setPlaying(false); };
  const zoom = (factor: number) => { const scale=chartRef.current?.timeScale(); const range=scale?.getVisibleLogicalRange();
    if(range && scale) { const center=(range.from+range.to)/2; const half=(range.to-range.from)*factor/2; scale.setVisibleLogicalRange({from:center-half,to:center+half}); followChart.current=false; } };
  const resetView = () => { chartRef.current?.priceScale("right").applyOptions({autoScale:true}); chartRef.current?.timeScale().fitContent(); followChart.current=true; };

  const stageRef = useRef<HTMLElement>(null);
  const chartHost = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);
  const vwapSeries = useRef<ISeriesApi<"Line"> | null>(null);
  const overlaySeries = useRef<ISeriesApi<"Line">[]>([]);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);
  const priceLinesRef = useRef<IPriceLine[]>([]);
  const riskLinesRef = useRef<{
    stop: { line: IPriceLine; price: number } | null;
    target: { line: IPriceLine; price: number } | null;
  }>({ stop: null, target: null });
  const draggingRiskRef = useRef<"stop" | "target" | null>(null);
  const dragStartRiskRef = useRef<{ stop: number; target: number } | null>(null);
  const riskSubmitRef = useRef<((stop: number, target: number) => Promise<boolean>) | null>(null);
  const drawingRef = useRef(false);
  const actionBusy = useRef(false);
  const stepBusy = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const advanceStepRef = useRef<(count?: number) => Promise<void>>(async () => undefined);

  const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId) ?? null;
  candlesRef.current=candles;
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


  useEffect(() => {
    const updateFullscreen = () => setIsFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener("fullscreenchange", updateFullscreen);
    return () => document.removeEventListener("fullscreenchange", updateFullscreen);
  }, []);

  const load = useCallback(async (_showSpinner = false) => {
    if (actionBusy.current) return;
    historyEpoch.current++; historyAbort.current?.abort(); setHistoryAvailable(true); setHistoryError("");
    actionBusy.current = true;
    setLoading(true); setDataReady(false); setPlaying(false); playingRef.current=false;
    try {
      const response = await fetch(`/api/lab?timeframe=${timeframe}`, {cache:"no-store",signal:AbortSignal.timeout(60000)});
      const payload = await response.json() as {error?:string;state?:Workspace;candles?:Candle[];source?:string};
      const nextWorkspace=payload.state ?? blank;
      if(payload.state) { workspaceRef.current=nextWorkspace; setWorkspace(nextWorkspace); }
      const nextSession=nextWorkspace.sessions.find(item=>item.id===nextWorkspace.activeSessionId);
      if(nextSession) { if(!startDateTouched.current) setStartDate(dateTimeInputValue(nextSession.startTime)); setSymbol(nextSession.symbol); }
      if(!response.ok) throw new Error(payload.error || "تعذر تحميل الجلسة.");
      setCandles(payload.candles ?? []); setSource(payload.source ?? "");
      setDataReady(Boolean(payload.candles?.length)); setError(""); followChart.current=true;
    } catch(err) { setError(err instanceof Error ? err.message : "تعذر الاتصال بالخادم."); }
    finally { actionBusy.current=false; setLoading(false); }
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

  useEffect(()=>{
    historyEpoch.current++;historyAbort.current?.abort();historyBusy.current=false;
    setHistoryLoading(false);setHistoryError("");setHistoryAvailable(true);
    return ()=>{historyEpoch.current++;historyAbort.current?.abort();};
  },[session?.id,timeframe]);

  const loadOlder = useCallback(async()=>{
    const first=candlesRef.current[0];
    if(!session||!first||!dataReady||historyBusy.current||!historyAvailable||actionBusy.current)return;
    historyBusy.current=true;setHistoryLoading(true);setHistoryError("");
    const epoch=historyEpoch.current, controller=new AbortController();historyAbort.current=controller;
    const timer=window.setTimeout(()=>controller.abort(),60000);
    try {
      const response=await fetch(`/api/lab?timeframe=${timeframe}&sessionId=${session.id}&before=${first.openTime}`,{cache:"no-store",signal:controller.signal});
      const payload=await response.json() as {sessionId?:string;candles?:Candle[];hasMore?:boolean;error?:string};
      if(epoch!==historyEpoch.current)return;
      if(!response.ok)throw new Error(payload.error||"تعذر تحميل التاريخ الأقدم.");
      if(payload.sessionId!==session.id)return;
      const older=(payload.candles??[]).filter(c=>c.openTime<first.openTime&&c.closeTime<first.openTime);
      followChart.current=false;
      setCandles(current=>{if(!current.length||current[0].openTime!==first.openTime)return current;return [...older,...current];});
      setHistoryAvailable(payload.hasMore===true);
    } catch(err) { if(epoch===historyEpoch.current)setHistoryError(err instanceof Error&&err.name!=="AbortError"?err.message:"انتهت مهلة تحميل التاريخ؛ أعد المحاولة."); }
    finally {window.clearTimeout(timer);if(historyAbort.current===controller){historyBusy.current=false;setHistoryLoading(false);}}
  },[session?.id,timeframe,dataReady,historyAvailable]);
  olderLoadRef.current=()=>{if(!historyError)void loadOlder();};

  const act = useCallback(async (body: Record<string, unknown>) => {
    if (actionBusy.current) return false;
    if(body.action==="start") {historyEpoch.current++;historyAbort.current?.abort();setHistoryAvailable(true);setHistoryError("");}
    actionBusy.current = true;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({...body, revision: workspaceRef.current.revision, timeframe}),
        signal: AbortSignal.timeout(60000),
      });
      const payload = (await response.json()) as { error?: string; state?: Workspace; candles?: Candle[]; source?: string; conflict?: boolean };
      if (!response.ok) { if(payload.conflict) setDataReady(false); throw new Error(payload.error ?? "لم يكتمل الإجراء."); }
      if (payload.state) { workspaceRef.current=payload.state; setWorkspace(payload.state); }
      if (payload.source) setSource(payload.source);
      if (body.action === "start") { setCandles(payload.candles ?? []); setDataReady(Boolean(payload.candles?.length)); followChart.current=true; }

      if (body.action === "step" && payload.candles?.length) {
        setDataReady(true);
        setCandles((current) => payload.candles!.reduce(
          (visible, candle) => appendReplayCandle(visible, candle, timeframe),
          current,
        ));
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع.");
      playingRef.current=false; setPlaying(false);
      if (body.action === "step") setDataReady(false);
      return false;
    } finally {
      actionBusy.current = false;
      setLoading(false);
    }
  }, [timeframe]);

  riskSubmitRef.current = openTrade && ["pending", "open"].includes(openTrade.status)
    ? (stop, target) => act({ action: "risk", tradeId: openTrade.id, stopLoss: stop, takeProfit: target })
    : null;

  const advanceStep = useCallback(async (count = 1) => {
    if (!session || stepBusy.current || actionBusy.current) return;
    stepBusy.current = true;
    setLoading(true);
    try {
      await act({ action: "step", count });
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر تحميل الشمعة التالية.");
      setPlaying(false);
    } finally {
      stepBusy.current = false;
      setLoading(false);
    }
  }, [session, act]);

  useEffect(() => {
    advanceStepRef.current = advanceStep;
  }, [advanceStep]);

  useEffect(() => {
    if (!playing || workspace.activeSessionId === null) return;
    let cancelled = false;
    let timer = 0;
    const playBatch = async () => {
      await advanceStepRef.current(replaySpeed);
      if (!cancelled && playingRef.current) timer = window.setTimeout(playBatch, 850);
    };
    timer = window.setTimeout(playBatch, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [playing, workspace.activeSessionId, replaySpeed]);

  useEffect(() => {
    const host = chartHost.current;
    if (!host) return;
    const chart = createChart(host, {
      width: host.clientWidth,
      height: host.clientHeight,
      layout: { background: { color: "#101012" }, textColor: "#7f8b99", fontFamily: "Inter, Arial, sans-serif", fontSize: 12 },
      grid: { vertLines: { color: "#242429", style: 4 }, horzLines: { color: "#242429", style: 4 } },
      crosshair: { mode: 0, vertLine: { color: "#6f7e8d", labelBackgroundColor: "#293746" }, horzLine: { color: "#6f7e8d", labelBackgroundColor: "#293746" } },
      rightPriceScale: { borderColor: "#26313d", scaleMargins: { top: 0.08, bottom: 0.24 } },
      timeScale: { borderColor: "#26313d", timeVisible: true, secondsVisible: false, rightOffset: 8, barSpacing: 8, minBarSpacing: 3, tickMarkFormatter: formatLocalTick },
      localization: { priceFormatter: formatAxis, timeFormatter: formatLocalChartTime },
      handleScroll: { mouseWheel: true, pressedMouseMove: true },
      handleScale: { axisPressedMouseMove: true, mouseWheel: true, pinch: true },
    });
    const candlesRef = chart.addSeries(CandlestickSeries, {
      upColor: "#00b89c", downColor: "#ef4355", borderUpColor: "#00b89c", borderDownColor: "#ef4355", wickUpColor: "#00b89c", wickDownColor: "#ef4355",
    });
    const volumeRef = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" }, priceScaleId: "volume", lastValueVisible: false, priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({ scaleMargins: { top: 0.82, bottom: 0 }, visible: false });
    const vwapRef = chart.addSeries(LineSeries, { color: "#eab85b", lineWidth: 2, priceLineVisible: false, lastValueVisible: false });
    overlaySeries.current = ['#e8b45b','#9f8cff','#68b9e8','#68b9e8','#68b9e8'].map(color=>chart.addSeries(LineSeries,{color,lineWidth:1,priceLineVisible:false,lastValueVisible:false}));
    const markerPlugin = createSeriesMarkers(candlesRef, []);
    chart.subscribeClick((param) => {
      if (!drawingRef.current || !param.point || !candleSeries.current) return;
      const selected = candleSeries.current.coordinateToPrice(param.point.y);
      if (selected !== null) setDrawnPrice(selected);
      setDrawing(false);
    });
    let historyTimer:number|undefined;
    const olderRange=(range:{from:number;to:number}|null)=>{
      window.clearTimeout(historyTimer);
      if(range&&range.from<40&&!followChart.current){historyTimer=window.setTimeout(()=>olderLoadRef.current(),200);}
    };
    chart.timeScale().subscribeVisibleLogicalRangeChange(olderRange);
    const browsing=()=>{followChart.current=false;};
    host.addEventListener('wheel',browsing,{passive:true});
    const resize = new ResizeObserver(() => chart.applyOptions({ width: host.clientWidth, height: host.clientHeight }));
    resize.observe(host);
    chartRef.current = chart;
    candleSeries.current = candlesRef;
    volumeSeries.current = volumeRef;
    vwapSeries.current = vwapRef;
    markersRef.current = markerPlugin;
    return () => {
      window.clearTimeout(historyTimer);chart.timeScale().unsubscribeVisibleLogicalRangeChange(olderRange);host.removeEventListener("wheel",browsing);
      resize.disconnect();
      chart.remove();
      chartRef.current = null;
      candleSeries.current = null;
      volumeSeries.current = null;
      vwapSeries.current = null;
      markersRef.current = null;
      overlaySeries.current = [];
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
    const previousFirst=renderedFirst.current;
    const inserted=previousFirst===null?0:candles.findIndex(c=>c.openTime===previousFirst);
    const visibleRange=!followChart.current&&inserted>0?chartRef.current.timeScale().getVisibleLogicalRange():null;
    candleSeries.current.setData(chartData);
    renderedFirst.current=candles[0]?.openTime??null;
    if(visibleRange)chartRef.current.timeScale().setVisibleLogicalRange({from:visibleRange.from+inserted,to:visibleRange.to+inserted});
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
        { time: (Math.floor((trade.entryTime ?? session?.cursorTime ?? 0) / ({"1m":60000,"5m":300000,"15m":900000,"1h":3600000,"4h":14400000,"1d":86400000}[timeframe])) * ({"1m":60,"5m":300,"15m":900,"1h":3600,"4h":14400,"1d":86400}[timeframe])) as UTCTimestamp, position: "belowBar", color: "#6ea8fe", shape: "arrowUp", text: "شراء" },
      ]);
    } else markersRef.current?.setMarkers([]);
    if (candles.length && followChart.current) chartRef.current.timeScale().scrollToPosition(8, false);
  }, [candles, showVwap, showVolume, longAvg, workspace.trades, session?.id, session?.cursorTime]);

  useEffect(() => {
    setStopLoss(openTrade ? String(openTrade.stopLoss) : "");
    setTakeProfit(openTrade ? String(openTrade.takeProfit) : "");
    if(openTrade) { setOrderType(openTrade.orderType ?? "market"); setOrderPrice(openTrade.orderPrice ? String(openTrade.orderPrice) : ""); }
  }, [openTrade?.id, openTrade?.stopLoss, openTrade?.takeProfit]);

  useEffect(()=>{
    let index=0;
    for(const key of ['sma','ema','bands'] as IndicatorKey[]){
      const values=indicators[key].enabled?indicatorValues(candles,indicators[key].period,key):[];
      const fields=key==='bands'?['value','upper','lower'] as const:['value'] as const;
      for(const field of fields)overlaySeries.current[index++]?.setData(values.map(v=>({time:v.time as UTCTimestamp,value:v[field]})));
    }
  },[candles,indicators]);

  const activeRiskTrade = openTrade && ["pending", "open"].includes(openTrade.status) ? openTrade : null;
  const expectedEntry = activeRiskTrade?.entryPrice ?? (orderType !== "market" && Number(orderPrice) > 0 ? Number(orderPrice) : latest?.close ?? 0);
  const previewStop = latest ? Number(stopLoss) || expectedEntry * 0.99 : null;
  const previewTarget = latest ? Number(takeProfit) || expectedEntry * 1.02 : null;
  const orderAmount = openTrade?.notional ?? Number(notional);
  const cash = cashPreview(orderAmount, expectedEntry, previewStop ?? 0, previewTarget ?? 0,
    openTrade?.orderType ?? orderType, openTrade?.entryPrice, openTrade?.quantity, openTrade?.entryPrice ? openTrade.entryFee : undefined);
  const availableCash = equity - (openTrade ? openTrade.notional + (openTrade.entryPrice ? openTrade.entryFee : openTrade.notional * FEE_RATE) : 0);
  const signedCash = (value: number) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))} USDT`;
  useEffect(() => { chartRef.current?.applyOptions({grid:{vertLines:{visible:showGrid},horzLines:{visible:showGrid}}}); }, [showGrid]);
  const chartStop = activeRiskTrade?.stopLoss ?? previewStop;
  const chartTarget = activeRiskTrade?.takeProfit ?? previewTarget;
  const lineCash = cashPreview(orderAmount, expectedEntry, chartStop ?? 0, chartTarget ?? 0,
    openTrade?.orderType ?? orderType, openTrade?.entryPrice, openTrade?.quantity, openTrade?.entryPrice ? openTrade.entryFee : undefined);

  useEffect(() => {
    const series = candleSeries.current;
    if (!series) return;
    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];
    riskLinesRef.current = { stop: null, target: null };
    if (activeRiskTrade?.status === "open" && activeRiskTrade.entryPrice !== null) {
      priceLinesRef.current.push(series.createPriceLine({ price: activeRiskTrade.entryPrice, color: "#6ea8fe", lineWidth: 1, lineStyle: 2, axisLabelVisible: true, title: `دخول · ${money(activeRiskTrade.notional)} USDT` }));
    }
    if (chartStop !== null && chartTarget !== null) {
      const stopLine = series.createPriceLine({ price: chartStop, color: "#f05b68", lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: `وقف ${lineCash ? signedCash(lineCash.stopNet) : ""} ≈` });
      const targetLine = series.createPriceLine({ price: chartTarget, color: "#12b886", lineWidth: 2, lineStyle: 0, axisLabelVisible: true, title: `هدف ${lineCash ? signedCash(lineCash.targetNet) : ""} ≈` });
      riskLinesRef.current = {
        stop: { line: stopLine, price: chartStop },
        target: { line: targetLine, price: chartTarget },
      };
      priceLinesRef.current.push(stopLine, targetLine);
    }
    if (drawnPrice !== null) priceLinesRef.current.push(series.createPriceLine({ price: drawnPrice, color: "#a78bfa", lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: "مستوى" }));
  }, [activeRiskTrade?.id, activeRiskTrade?.status, activeRiskTrade?.entryPrice, activeRiskTrade?.stopLoss, activeRiskTrade?.takeProfit, chartStop, chartTarget, drawnPrice, lineCash?.stopNet, lineCash?.targetNet]);

  useEffect(() => {
    const host = chartHost.current;
    if (!host) return;
    const restoreDrag = (pointerId?: number) => {
      if (pointerId !== undefined && host.hasPointerCapture(pointerId)) host.releasePointerCapture(pointerId);
      draggingRiskRef.current = null;
      chartRef.current?.applyOptions({handleScroll:true,handleScale:true});
      host.classList.remove("risk-dragging");
    };
    const onPointerDown = (event: PointerEvent) => {
      const series = candleSeries.current;
      const lines = riskLinesRef.current;
      if (actionBusy.current || !series || drawingRef.current || !lines.stop || !lines.target) return;
      followChart.current=false;
      const y = event.clientY - host.getBoundingClientRect().top;
      const candidates = (["stop", "target"] as const)
        .map((kind) => {
          const line = lines[kind];
          const coordinate = line ? series.priceToCoordinate(line.price) : null;
          return { kind, distance: coordinate === null ? Infinity : Math.abs(coordinate - y) };
        })
        .sort((a, b) => a.distance - b.distance);
      const selected = candidates[0];
      if (!selected || selected.distance > 13) return;
      playingRef.current=false; setPlaying(false);
      chartRef.current?.applyOptions({handleScroll:false,handleScale:false});
      draggingRiskRef.current = selected.kind;
      dragStartRiskRef.current = { stop: lines.stop.price, target: lines.target.price };
      host.classList.add("risk-dragging");
      host.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
    };
    const onPointerMove = (event: PointerEvent) => {
      const kind = draggingRiskRef.current;
      const series = candleSeries.current;
      const line = kind ? riskLinesRef.current[kind] : null;
      if (!kind || !series || !line) return;
      const nextPrice = series.coordinateToPrice(event.clientY - host.getBoundingClientRect().top);
      if (nextPrice === null || !Number.isFinite(nextPrice) || nextPrice <= 0) return;
      line.price = nextPrice;
      line.line.applyOptions({ price: nextPrice });
      event.preventDefault();
    };
    const onPointerUp = async (event: PointerEvent) => {
      if (!draggingRiskRef.current) return;
      restoreDrag(event.pointerId);
      const lines = riskLinesRef.current;
      const stop = lines.stop ? Number(lines.stop.price.toFixed(2)) : undefined;
      const target = lines.target ? Number(lines.target.price.toFixed(2)) : undefined;
      if (stop === undefined || target === undefined) return;
      const formatDraft = (value: number) => value.toFixed(latest?.close && latest.close >= 1000 ? 2 : 4);
      setStopLoss(formatDraft(stop));
      setTakeProfit(formatDraft(target));
      if (riskSubmitRef.current) {
        const accepted = await riskSubmitRef.current(stop, target);
        if (!accepted) {
          const original = dragStartRiskRef.current;
          if (original) {
            if (riskLinesRef.current.stop) {
              riskLinesRef.current.stop.price = original.stop;
              riskLinesRef.current.stop.line.applyOptions({ price: original.stop });
            }
            if (riskLinesRef.current.target) {
              riskLinesRef.current.target.price = original.target;
              riskLinesRef.current.target.line.applyOptions({ price: original.target });
            }
            setStopLoss(formatDraft(original.stop));
            setTakeProfit(formatDraft(original.target));
          }
        }
      }
      dragStartRiskRef.current = null;
    };
    const onPointerCancel = (event: PointerEvent) => {
      const original = dragStartRiskRef.current;
      if (original) {
        const stop = riskLinesRef.current.stop;
        const target = riskLinesRef.current.target;
        if (stop) { stop.price = original.stop; stop.line.applyOptions({ price: original.stop }); }
        if (target) { target.price = original.target; target.line.applyOptions({ price: original.target }); }
      }
      restoreDrag(event.pointerId);
      dragStartRiskRef.current = null;
    };
    host.addEventListener("pointerdown", onPointerDown, true);
    host.addEventListener("pointermove", onPointerMove, true);
    host.addEventListener("pointerup", onPointerUp, true);
    host.addEventListener("pointercancel", onPointerCancel, true);
    return () => {
      host.removeEventListener("pointerdown", onPointerDown, true);
      host.removeEventListener("pointermove", onPointerMove, true);
      host.removeEventListener("pointerup", onPointerUp, true);
      host.removeEventListener("pointercancel", onPointerCancel, true);
    };
  }, [latest?.close]);

  const startReplay = async (autoPlay = false) => {
    const rawStartTime = new Date(startDate).getTime();
    if (!Number.isFinite(rawStartTime)) {
      setError("أدخل تاريخًا ووقتًا صحيحين للبداية.");
      return;
    }
    const startTime = Math.floor(rawStartTime / 60_000) * 60_000;
    setPlaying(false);
    const confirmReplace = sessionTrades.length > 0;
    if(confirmReplace && !window.confirm("بدء جلسة جديدة؟ سيبقى سجل الجلسة السابقة محفوظًا، وتتوقف متابعة أوامرها. يمكنك تنزيل السجل من لوحة الصفقات.")) return;
    playingRef.current=false;
    const ok = await act({ action: "start", symbol, startTime, confirmReplace });
    if (ok) {
      setDrawnPrice(null);
      setStopLoss(""); setTakeProfit("");
      if (autoPlay) { playingRef.current=true; setPlaying(true); }
    }
  };
  const submitLong = async () => {
    const close = latest?.close;
    if (!close) return setError("ابدأ المحاكاة حتى تظهر الشموع قبل وضع الأمر.");
    const reference = orderType === "market" ? close : Number(orderPrice);
    const stop = Number(stopLoss || (reference * 0.99).toFixed(close < 100 ? 4 : 2));
    const target = Number(takeProfit || (reference * 1.02).toFixed(close < 100 ? 4 : 2));
    const ok = await act({ action: "buy", notional: Number(notional), stopLoss: stop, takeProfit: target, orderType, orderPrice: orderType === "market" ? null : Number(orderPrice), reason });
    if (ok) setReason("");
  };
  const updateStartDatePart = (part: "date" | "time", value: string) => {
    startDateTouched.current = true;
    setStartDate((current) => {
      const fallback = dateTimeInputValue(Date.now());
      const date = current.slice(0, 10) || fallback.slice(0, 10);
      const time = current.slice(11, 16) || "12:00";
      return part === "date" ? `${value}T${time}` : `${date}T${value}`;
    });
  };
  const toggleFullscreen = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    try {
      if (document.fullscreenElement === stage) await document.exitFullscreen();
      else await stage.requestFullscreen();
    } catch {
      setError("تعذر تفعيل ملء الشاشة في هذا المتصفح.");
    }
  };

  return (
    <main className={`trading-shell ${layout.orderOpen ? "" : "orders-collapsed"} ${layout.historyOpen ? "" : "history-collapsed"}`} style={{"--order-width":`${layout.width}px`,"--history-height":`${layout.height}px`} as CSSProperties} dir="rtl">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Activity size={17} /></div><div><strong>مختبر التداول</strong><small>REPLAY LAB <span>·</span> تجريبي</small></div></div>
        <div className="asset-head">
          <button className="pair-select" disabled={loading || playing} title="اختيار أصل للجلسة الجديدة" onClick={() => setSymbol(symbol === "BTCUSDT" ? "ETHUSDT" : "BTCUSDT")}><span className="coin-icon">{currentSymbol === "BTCUSDT" ? "₿" : "Ξ"}</span><span><b>{currentSymbol.slice(0, -4)} <i>/ USDT</i></b><small>{currentSymbol === symbol ? "Binance Spot" : `الجلسة الجديدة: ${symbol.slice(0, -4)}`}</small></span><ChevronDown size={13} /></button>
          <div className="asset-price"><strong>{latest ? price(latest.close) : "—"}</strong><span className={change >= 0 ? "positive" : "negative"}>{latest ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "بانتظار بدء Replay"}</span></div>
        </div>
        <div className="top-actions"><div className="account-summary"><small>حساب تدريبي</small><b dir="ltr">{money(equity)} USDT</b></div><button className="icon-button" title="إعدادات العرض" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(!settingsOpen)}><Settings2 size={18}/></button><span className="connection"><i /> بيانات تاريخية</span><button className="layout-button" onClick={() => setLayout(v=>({...v,orderOpen:!v.orderOpen}))}>{layout.orderOpen ? "طي الأوامر" : "لوحة الأوامر"}</button><button className="icon-button" title="طريقة الاستخدام" onClick={() => setHelpOpen(!helpOpen)}><CircleHelp size={18}/></button><div className="avatar">م</div></div>
      </header>

      {settingsOpen && <section className="display-settings" aria-label="إعدادات العرض"><header><strong>إعدادات العرض</strong><button onClick={()=>setSettingsOpen(false)} aria-label="إغلاق الإعدادات"><X size={18}/></button></header><label><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/> شبكة الأسعار</label><label><input type="checkbox" checked={showVolume} onChange={e=>setShowVolume(e.target.checked)}/> أحجام التداول</label><label><input type="checkbox" checked={layout.orderOpen} onChange={e=>setLayout(v=>({...v,orderOpen:e.target.checked}))}/> لوحة الأوامر</label><label><input type="checkbox" checked={layout.historyOpen} onChange={e=>setLayout(v=>({...v,historyOpen:e.target.checked}))}/> سجل الصفقات</label><button onClick={()=>{setLayout({orderOpen:true,historyOpen:false,width:300,height:160});setShowGrid(true);setShowVolume(true);resetView();}}>استعادة العرض الافتراضي</button></section>}
      {helpOpen && <section className="help-panel" aria-label="طريقة الاستخدام"><button onClick={()=>setHelpOpen(false)}>إغلاق الشرح ×</button><h2>تدرّب خطوة بخطوة</h2><p>اختر الأصل والتاريخ ثم «جلسة جديدة». تشغيل يستأنف الجلسة الحالية، وتقدم دقيقة يعالج دقيقة واحدة مهما كان إطار الشارت.</p><p>حرّك الشارت بالسحب، وكبّره بعجلة الفأرة أو اللمس بإصبعين. اسحب خط الوقف أو الهدف، أو أدخل السعر واضغط تحديث. اسحب الفاصل بجانب الأوامر أو فوق السجل لتغيير حجمهما.</p><p>محدد: شراء بالسعر المحدد أو أقل. وقف شراء: تفعيل فوق السعر الحالي ثم شراء سوق؛ يختلف عن وقف الخسارة.</p><p>الرسوم 0.15% لكل جهة، والانزلاق 0.02% مع احترام سعر الأمر المحدد. فجوة تجعل الوقف أو الهدف غير صالح تُلغي الأمر. عند دخول داخل الدقيقة نحتسب الوقف أولًا ولا نحتسب ربح هدف تلك الدقيقة لعدم معرفة ترتيب الحركة. R = صافي النتيجة ÷ المخاطرة السعرية الأصلية.</p><p>VWAP تقريبي من الشموع المعروضة، واليوم بتوقيت UTC؛ يتغير تقديره حسب الإطار.</p></section>}
      <div className="workspace-grid">
        <nav className="toolrail" aria-label="أدوات الرسم"><button className={!drawing ? "rail-active" : ""} onClick={()=>setDrawing(false)} title="المؤشر والتحريك"><Crosshair size={18}/></button><button className={drawing ? "rail-active" : ""} onClick={()=>setDrawing(!drawing)} title="رسم مستوى أفقي"><Minus size={18}/></button><button onClick={()=>setDrawnPrice(null)} disabled={drawnPrice===null} title="حذف المستوى المرسوم"><X size={18}/></button><button onClick={()=>setShowVwap(!showVwap)} title="VWAP تقريبي"><Activity size={18}/></button><button onClick={()=>setHelpOpen(!helpOpen)} title="المساعدة"><CircleHelp size={18}/></button></nav>

        <section className="main-stage" ref={stageRef}>
          <IndicatorLibrary open={indicatorsOpen} onClose={()=>setIndicatorsOpen(false)} settings={indicators} onChange={setIndicators} vwap={showVwap} onVwap={setShowVwap} volume={showVolume} onVolume={setShowVolume}/>
          <div className="chart-toolbar">
            <div className="symbol-meta"><span className="market-icon">{currentSymbol === "BTCUSDT" ? "₿" : "Ξ"}</span><div><strong>{currentSymbol.slice(0, -4)} / TetherUS</strong><small>Binance · السوق الفوري</small></div><span className="market-state"><i /> السوق مغلق · تاريخي</span></div>
            <div className="periods">{periods.map((period) => <button key={period.key} disabled={loading || playing} onClick={() => { setDataReady(false); setCandles([]); setTimeframe(period.key); }} className={timeframe === period.key ? "selected" : ""}>{period.label}</button>)}<span className="toolbar-separator" /><button title="المؤشرات" onClick={() => setIndicatorsOpen(true)}><LineChart size={17} /><span>المؤشرات</span></button><button title={isFullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"} aria-label={isFullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"} onClick={() => void toggleFullscreen()}><Maximize2 size={15} /></button></div>
          </div>
          <div className="chart-navigation"><button disabled={historyLoading||!historyAvailable||!dataReady||loading} onClick={()=>void loadOlder()}>{historyLoading?"جار تحميل الشموع…":historyAvailable?"تحميل 500 شمعة أقدم":"بداية التاريخ المتاح"}</button><span className="history-count">{candles.length.toLocaleString("en-US")} شمعة</span>{historyError&&<span className="older-error" role="alert">{historyError}</span>}<button onClick={()=>zoom(.8)} aria-label="تكبير الشارت">＋ تكبير</button><button onClick={()=>zoom(1.25)} aria-label="تصغير الشارت">− تصغير</button><button onClick={()=>{followChart.current=true;chartRef.current?.timeScale().scrollToPosition(8, false);}}>آخر شمعة</button><button onClick={resetView}>ضبط العرض</button><button onClick={()=>setLayout(v=>({...v,historyOpen:!v.historyOpen}))}>{layout.historyOpen?"طي السجل":"السجل والصفقات"}</button></div>
          <div className="ohlc-strip"><span>{fmtDate(session?.cursorTime ?? null)}</span>{latest && <><span>فتح <b>{price(latest.open)}</b></span><span>أعلى <b className="positive">{price(latest.high)}</b></span><span>أدنى <b className="negative">{price(latest.low)}</b></span><span>إغلاق <b>{price(latest.close)}</b></span><span>حجم <b>{money(latest.volume, 2)}</b></span></>}</div>
          <div className="chart-area"><div className="chart-caption"><div className="active-indicators">{(Object.keys(indicators) as IndicatorKey[]).filter(k=>indicators[k].enabled).map(k=><button key={k} onClick={()=>setIndicatorsOpen(true)}>{k=== "bands" ? "BB" : k.toUpperCase()} {indicators[k].period}</button>)}</div><span>{currentSymbol.slice(0, -4)} / TetherUS · {periods.find((p) => p.key === timeframe)?.label} · Binance</span><div><span className="risk-drag-hint">اسحب خط الوقف أو الهدف لتعديله</span><button onClick={() => setShowVolume(!showVolume)} className={showVolume ? "caption-active" : ""}><BarChart3 size={13} /> الحجم</button>{showVwap && <span className="vwap-key"><i /> VWAP يومي*</span>}</div></div><div className={`chart-host ${drawing ? "drawing-mode" : ""}`} ref={chartHost} onWheel={()=>{followChart.current=false;}}>{loading && candles.length === 0 ? <div className="chart-empty chart-loading"><span className="loading-spinner"><Activity size={18} /></span><strong>جار استعادة الجلسة والشموع</strong><span>نحمّل بيانات السوق حتى نقطة Replay المحفوظة.</span></div> : (!session || candles.length === 0) && <div className="chart-empty"><div className="empty-icon"><CalendarDays size={21} /></div><strong>{session ? "لا توجد شموع لهذه الفترة" : "اختر لحظة تاريخية وابدأ التدريب"}</strong><span>{session ? "قد لا تتوفر بيانات Binance لهذا الأصل والتاريخ. اختر تاريخًا ضمن فترة تداول الأصل." : "ستظهر الشموع تدريجيًا مع تحريك Replay، دون كشف بيانات لاحقة."}</span>{!session && <button onClick={() => void startReplay()} disabled={loading}><Play size={14} fill="currentColor" /> ابدأ Replay</button>}</div>}{drawing && <span className="drawing-tip">انقر على الشارت لإضافة مستوى سعري</span>}</div><div className="chart-footer"><span><span className="legend-candle green" /> صاعد <span className="legend-candle red" /> هابط</span><span>TradingView Lightweight Charts™</span><span className="timezone">التوقيت المحلي <ChevronDown size={12} /></span></div></div>

          <section className="replay-panel">
            <div className="replay-title"><strong>إعادة تشغيل السوق</strong><span className="replay-status" role="status">{loading ? "جار التحميل…" : !dataReady ? "بانتظار البيانات" : playing ? "قيد التشغيل" : "متوقف مؤقتًا"}</span><b className="cursor-time">{fmtDate(session?.cursorTime ?? null)}</b></div>
            <div className="replay-controls"><button className="play-button" onClick={()=>{if(playing)stopPlaying();else {playingRef.current=true;setPlaying(true);}}} disabled={!playing && (loading || !session || !dataReady)} aria-label={playing?"إيقاف مؤقت":"تشغيل Replay"}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?"إيقاف مؤقت":"تشغيل"}</button><button className="step-button" onClick={()=>{stopPlaying();void advanceStep();}} disabled={loading || !session || !dataReady} title="تقدم دقيقة واحدة"><SkipForward size={16}/> تقدم دقيقة</button><label>السرعة <select aria-label="سرعة التشغيل" value={replaySpeed} onChange={e=>setReplaySpeed(Number(e.target.value))}>{[1,2,4,8,16,32,64].map(v=><option key={v} value={v}>{v}×</option>)}</select></label><span className="bar-count">{session?.advancedBars ?? 0} دقيقة</span><div className="replay-ticket"><label>مبلغ الدخول <input aria-label="مبلغ الدخول السريع USDT" type="number" min="1" step="0.01" disabled={Boolean(openTrade)} value={openTrade?.notional ?? notional} onChange={e=>setNotional(e.target.value)}/><span>USDT</span></label><button className="ticket-open" onClick={()=>setLayout(v=>({...v,orderOpen:!v.orderOpen}))}>{openTrade?'الصفقة الحالية':'إعداد الصفقة'}</button>{openTrade?.status==='open'&&<button disabled={loading} onClick={()=>void act({action:"close"})}>إغلاق الصفقة</button>}<button onClick={()=>{setLayout(v=>({...v,orderOpen:true}));setStatsOpen(true);}}>الأداء</button></div></div>
            <details className="replay-session"><summary>التاريخ · جلسة جديدة</summary><div className="replay-date"><label className="date-input-wrap"><small>تاريخ الجلسة الجديدة</small><input type="date" aria-label="تاريخ بداية Replay" value={startDate.slice(0,10)} max={dateTimeInputValue(Date.now()).slice(0,10)} onChange={e=>updateStartDatePart("date",e.target.value)}/></label><label className="date-input-wrap time-input-wrap"><small>الوقت المحلي</small><input type="time" aria-label="وقت بداية Replay" step={60} value={startDate.slice(11,16)} onChange={e=>updateStartDatePart("time",e.target.value)}/></label><button onClick={()=>void startReplay()} disabled={loading}>جلسة جديدة · {symbol.slice(0,-4)}</button></div></details>
            <p className="replay-explanation">{replaySpeed>=16 ? "تسريع الوقت: تُتجاوز فرص القرار بين الدقائق. " : ""}كل خطوة = دقيقة؛ شمعة {periods.find(p=>p.key===timeframe)?.label} تتحدّث حتى يكتمل إطارها.</p>
            {error && <div className="replay-error" role="alert"><span>{error}</span><button disabled={loading} onClick={()=>void load(true)}>إعادة تحميل الجلسة</button></div>}
          </section>

          <div className="history-resizer" role="separator" tabIndex={0} aria-label="تغيير ارتفاع السجل" aria-orientation="horizontal" aria-valuemin={100} aria-valuemax={300} aria-valuenow={layout.height} onPointerDown={e=>resizeStart(e,"history")} onPointerMove={resizeMove} onPointerUp={()=>{resizeRef.current=null;}} onPointerCancel={()=>{resizeRef.current=null;}} onKeyDown={e=>{if(e.key==="ArrowUp"||e.key==="ArrowDown") {e.preventDefault();setLayout(v=>({...v,height:Math.max(100,Math.min(300,v.height+(e.key==="ArrowUp"?20:-20)))}));}}}/>
          <section className="history-panel"><div className="history-head"><div className="history-tabs"><button onClick={() => setTab("trades")} className={tab === "trades" ? "active" : ""}>الصفقات <span>{sessionTrades.length}</span></button><button onClick={() => setTab("journal")} className={tab === "journal" ? "active" : ""}><BookOpenCheck size={14} /> دفتر التداول</button></div><button className="export-button" onClick={()=>{const blob=new Blob([JSON.stringify(workspace,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="replay-journal.json";link.click();URL.revokeObjectURL(url);}}>تنزيل السجل</button></div>{tab === "trades" ? <div className="table-wrap"><table><thead><tr><th>الأصل</th><th>النوع</th><th>الدخول</th><th>الخروج</th><th>مبلغ الدخول</th><th>النتيجة</th><th>الحالة</th><th>الوقت</th></tr></thead><tbody>{sessionTrades.length ? sessionTrades.slice().reverse().map((trade) => <tr key={trade.id}><td><span className="tiny-coin">{trade.symbol === "BTCUSDT" ? "₿" : "Ξ"}</span>{trade.symbol.slice(0, -4)}/USDT</td><td><span className="side-long">شراء {orderLabels[trade.orderType ?? "market"]}</span></td><td>{trade.entryPrice ? price(trade.entryPrice) : trade.orderPrice ? price(trade.orderPrice) : "الافتتاح التالي"}</td><td>{trade.exitPrice ? price(trade.exitPrice) : "—"}</td><td>{money(trade.notional)} USDT</td><td className={trade.realizedPnl >= 0 ? "positive" : "negative"}>{trade.status === "closed" ? `${trade.realizedPnl >= 0 ? "+" : ""}${money(trade.realizedPnl)} USDT` : "—"}</td><td><span className={`status-pill ${trade.status}`}>{trade.status === "pending" ? "معلق" : trade.status === "open" ? "مفتوح" : trade.status === "close_pending" ? "إغلاق معلّق" : trade.status === "closed" ? "مغلق" : "ملغى"}</span></td><td>{fmtDate(trade.entryTime ?? trade.createdAt)}</td></tr>) : <tr><td colSpan={8} className="table-empty">لا توجد صفقات في هذه الجلسة بعد. استخدم لوحة الأوامر للتدرب.</td></tr>}</tbody></table></div> : <div className="journal-list">{sessionTrades.length ? sessionTrades.slice().reverse().map((trade) => <article key={trade.id}><div><BookOpenCheck size={14} /><span>{fmtDate(trade.entryTime ?? trade.createdAt)}</span><b className={trade.realizedPnl >= 0 ? "positive" : "negative"}>{trade.status === "closed" ? `${trade.realizedPnl >= 0 ? "+" : ""}${money(trade.realizedPnl)} USDT` : "قيد المتابعة"}</b></div><p>{trade.reason}</p><details><summary>أحداث الأمر · R {trade.rMultiple?.toFixed(2) ?? "—"}</summary>{trade.events?.map((event,index)=><p key={index}>{fmtDate(event.time)} · {event.detail}</p>)}</details></article>) : <div className="journal-empty"><BookOpenCheck size={18} /><span>لم تُسجّل مبررات دخول بعد. أضف مبررًا قبل تنفيذ صفقة.</span><button onClick={() => setLayout(v=>({...v,orderOpen:true}))}>فتح لوحة الأمر</button></div>}</div>}</section>
        </section>

        <div className="order-resizer" role="separator" tabIndex={0} aria-label="تغيير عرض لوحة الأوامر" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={460} aria-valuenow={layout.width} onPointerDown={e=>resizeStart(e,"order")} onPointerMove={resizeMove} onPointerUp={()=>{resizeRef.current=null;}} onPointerCancel={()=>{resizeRef.current=null;}} onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight") {e.preventDefault();setLayout(v=>({...v,width:Math.max(280,Math.min(460,v.width+(e.key==="ArrowRight"?20:-20)))}));}}}/>
        <aside className="right-panel">
          <div className="panel-top"><span>لوحة التداول</span><button title="إغلاق اللوحة" onClick={()=>setLayout(v=>({...v,orderOpen:false}))}><X size={15} /></button></div>
          <div className="balance-card"><div className="balance-label"><Wallet size={14} /><span>رصيد المحاكاة</span></div><strong>{money(equity)} <small>USDT</small></strong><div className="balance-bottom"><span>ربح/خسارة محققة</span><b className={netPnl >= 0 ? "positive" : "negative"}>{netPnl >= 0 ? "+" : ""}{money(netPnl)} USDT</b></div></div>
          <div className="panel-tabs"><button className={!statsOpen?"active":""} onClick={()=>setStatsOpen(false)}>أوامر الشراء</button><button onClick={() => setStatsOpen(!statsOpen)}>الأداء <Activity size={13} /></button></div>
          {statsOpen ? <div className="stats-content"><div><span>الصفقات المغلقة</span><b>{closedTrades.length}</b></div><div><span>نسبة الفوز</span><b>{winRate.toFixed(1)}%</b></div><div><span>رابحة / خاسرة</span><b><i className="positive">{wins}</i> / <i className="negative">{losses}</i></b></div><div><span>صافي الأداء</span><b className={netPnl >= 0 ? "positive" : "negative"}>{netPnl >= 0 ? "+" : ""}{money(netPnl)} USDT</b></div><p>الرسوم 0.15% لكل تنفيذ · انزلاق سعري 0.02% · Spot فقط</p></div> : <>
            <div className="order-type">{(["market","limit","stop"] as const).map(kind=><button key={kind} disabled={Boolean(openTrade)} className={orderType===kind?"active":""} onClick={()=>{setOrderType(kind);setOrderPrice(latest ? (latest.close*(kind==="limit"?.995:1.005)).toFixed(2) : "");setStopLoss("");setTakeProfit("");}}>{orderLabels[kind]}</button>)}</div>
            <div className="order-body">{orderType!=="market" && <label className="entry-price-field">{orderType==="limit"?"سعر الشراء المحدد":"سعر تفعيل وقف الشراء"}<input aria-label="سعر الأمر" type="number" step="any" min="0" value={openTrade?.orderPrice ?? orderPrice} disabled={Boolean(openTrade)} onChange={e=>setOrderPrice(e.target.value)}/></label>}<p className="order-explanation">{orderType==="market"?"شراء عند افتتاح الدقيقة التالية." : orderType==="limit"?"شراء عند بلوغ السعر المحدد أو أقل." : "شراء سوق عند اختراق سعر التفعيل؛ ليس وقف خسارة."}</p><div className="order-field"><label htmlFor="entry-amount">مبلغ الدخول · USDT</label><div className="input-with-unit"><input id="entry-amount" type="number" min="1" step="0.01" disabled={Boolean(openTrade)} value={openTrade?.notional ?? notional} onChange={(e) => setNotional(e.target.value)} /><span>USDT</span></div><div className="quick-sizes">{[50, 100, 250, 500].map((amount) => <button key={amount} disabled={Boolean(openTrade)} className={orderAmount === amount ? "picked" : ""} onClick={() => setNotional(String(amount))}>{amount} USDT</button>)}</div><small className="cash-available">المتاح للدخول <b dir="ltr">{money(availableCash)} USDT</b></small></div>
              <div className="risk-fields"><label><span><i className="risk-dot stop" /> وقف الخسارة</span><input type="number" step="any" value={stopLoss || (activeRiskTrade ? String(activeRiskTrade.stopLoss) : "")} onChange={(e) => setStopLoss(e.target.value)} placeholder={latest ? price(expectedEntry * 0.99) : "السعر"} /></label><label><span><i className="risk-dot target" /> جني الأرباح</span><input type="number" step="any" value={takeProfit || (activeRiskTrade ? String(activeRiskTrade.takeProfit) : "")} onChange={(e) => setTakeProfit(e.target.value)} placeholder={latest ? price(expectedEntry * 1.02) : "السعر"} /></label></div>
              <button className="buy-button" onClick={submitLong} disabled={loading || !session || !dataReady || Boolean(openTrade)}><span>شراء {currentSymbol.slice(0, -4)}</span><b dir="ltr">{Number.isFinite(orderAmount) && orderAmount > 0 ? money(orderAmount) : "—"} USDT</b></button>
              <div className="cash-breakdown" aria-label="ملخص الصفقة بالدولار"><div><span>مبلغ الصفقة</span><b dir="ltr">{Number.isFinite(orderAmount) && orderAmount > 0 ? money(orderAmount) : "—"} USDT</b></div><div><span>رسوم الدخول</span><b dir="ltr">{cash ? money(cash.fee) : "—"} USDT</b></div><div className="cash-total"><span>الإجمالي مع الرسوم</span><b dir="ltr">{cash ? money(cash.total) : "—"} USDT</b></div><div><span>صافي النتيجة عند الوقف ≈</span><b dir="ltr" className={cash && cash.stopNet >= 0 ? "positive" : "negative"}>{cash ? signedCash(cash.stopNet) : "—"}</b></div><div><span>صافي النتيجة عند الهدف ≈</span><b dir="ltr" className={cash && cash.targetNet >= 0 ? "positive" : "negative"}>{cash ? signedCash(cash.targetNet) : "—"}</b></div><small>تقدير بعد الرسوم؛ قد يتغير التنفيذ مع فجوات السعر والانزلاق.</small></div>
              <div className="risk-summary"><span>المخاطرة / العائد</span><b>{latest ? (expectedEntry > (Number(stopLoss) || expectedEntry * .99) ? (((Number(takeProfit) || expectedEntry * 1.02) - expectedEntry) / (expectedEntry - (Number(stopLoss) || expectedEntry * .99))).toFixed(2) : "—") : "—"} R</b></div>
              <label className="reason-label">مبرر الدخول<textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ما سبب دخولك؟ اكتب شروط الاستراتيجية…" maxLength={500} /></label>

              {openTrade?.status === "pending" && <div className="notice-pending"><Activity size={14} /> الأمر ينتظر {orderLabels[openTrade.orderType]} {openTrade.orderPrice ? price(openTrade.orderPrice) : "الدقيقة التالية"} <button onClick={() => void act({ action: "cancel" })} title="إلغاء الأمر المعلّق"><X size={13} /></button></div>}
              {openTrade?.status === "open" && <><div className="open-trade-card"><div><span><i className="open-dot" /> مبلغ الصفقة المفتوحة</span><b dir="ltr">{money(openTrade.notional)} USDT</b></div><p>سعر الدخول {openTrade.entryPrice ? price(openTrade.entryPrice) : "—"} · وقف {price(openTrade.stopLoss)} <span>·</span> هدف {price(openTrade.takeProfit)}</p><button onClick={() => void act({ action: "close" })} disabled={loading}><ArrowDownRight size={14} /> إغلاق مع الشمعة التالية</button></div><button className="update-risk-button" onClick={() => void act({ action: "risk", tradeId: openTrade.id, stopLoss: Number(stopLoss) || openTrade.stopLoss, takeProfit: Number(takeProfit) || openTrade.takeProfit })} disabled={loading}><Target size={13} /> تحديث الوقف والهدف</button></>}
              {openTrade?.status === "pending" && <button className="update-risk-button" onClick={() => void act({ action: "risk", tradeId: openTrade.id, stopLoss: Number(stopLoss) || openTrade.stopLoss, takeProfit: Number(takeProfit) || openTrade.takeProfit })} disabled={loading}><Target size={13} /> تحديث الوقف والهدف المعلّق</button>}
              {openTrade?.status === "close_pending" && <p className="notice-pending">الإغلاق ينتظر افتتاح الدقيقة التالية.</p>}
              {!session && <p className="side-hint">ابدأ Replay حتى تصبح أوامر المحاكاة متاحة.</p>}
            </div>
          </>}

          <div className="market-card"><div className="market-card-title"><span>نظرة على السوق</span><span className="demo-badge">DEMO</span></div><div className="market-mini"><span>BTC</span><b>{currentSymbol === "BTCUSDT" && latest ? price(latest.close) : "—"}</b><small className={change >= 0 ? "positive" : "negative"}>{currentSymbol === "BTCUSDT" && latest ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}</small></div><div className="market-mini"><span>ETH</span><b>{currentSymbol === "ETHUSDT" && latest ? price(latest.close) : "—"}</b><small className={change >= 0 ? "positive" : "negative"}>{currentSymbol === "ETHUSDT" && latest ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "—"}</small></div><div className="market-note"><Sparkles size={13} /> الأسعار من شموع Binance التاريخية</div></div>
          <div className="risk-note"><ShieldCheck size={14} /><p>محاكاة تعليمية فقط. لا يتم إرسال أي أوامر إلى Binance.</p></div>
        </aside>
      </div>
      <footer className="statusbar"><span>{loading ? "جار تحميل البيانات" : !dataReady ? "البيانات غير جاهزة" : source || "بيانات تاريخية"}</span><span>جلساتك تحفظ تلقائيًا</span><span><DollarSign size={12} /> الرصيد {money(equity)} USDT · المتاح {money(availableCash)} USDT</span><span className="statusbar-right">{error ? "راجع رسالة الخطأ" : session ? "جلسة محفوظة" : "ابدأ جلسة تدريب"}</span></footer>
    </main>
  );
}
