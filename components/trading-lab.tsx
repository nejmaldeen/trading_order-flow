"use client";
import { draftOrderType, draftError } from "@/lib/draft-order";

import {
  CandlestickSeries,
  HistogramSeries,
  LineSeries,
  createChart,
  createSeriesMarkers,
  type AutoscaleInfo,
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
  Database,
  DollarSign,
  Eye,
  EyeOff,
  KeyRound,
  Layers,
  LineChart,
  Maximize2,
  Minimize2,
  Minus,
  MousePointer2,
  Palette,
  Pause,
  Play,
  RotateCcw,
  Settings2,
  ShieldCheck,
  SkipForward,
  Sliders,
  Sparkles,
  Target,
  Trash2,
  TrendingUp,
  Wallet,
  Wifi,
  WifiOff,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { blank, appendReplayBatch, INITIAL_BALANCE, SYMBOLS, SYMBOL_INFO, type SymbolName, type Timeframe, type Candle, type Session, type Trade, type Workspace, type OrderType } from "@/lib/replay";
import MacroPanel from "@/components/macro-panel";
import type {MacroSnapshot} from "@/lib/macro";
import type {NewsRecord} from "@/lib/news-archive";
import FloatingReplay from "@/components/floating-replay";
import ChartDrawings from "@/components/chart-drawings";
import StopLevelEditor from "@/components/stop-level-editor";
import OfflineDataModal from "@/components/offline-data-modal";
import RiskRewardOverlay from "@/components/risk-reward-overlay";
import IndicatorLibrary from "@/components/indicator-library";
import PlatformIntegrationsModal from "@/components/platform-integrations";
import VolumeProfileOverlay from "@/components/volume-profile-overlay";
import SessionProfileOverlay from "@/components/session-profile-overlay";
import type { SessionGrouping } from "@/lib/session-volume-profile";
import InstitutionalHud from "@/components/institutional-hud";
import InstitutionalChartOverlay from "@/components/institutional-chart-overlay";
import InstitutionalSettingsModal from "@/components/institutional-settings-modal";
import BookmapView from "@/components/bookmap-view";
import AccountBalanceModal from "@/components/account-balance-modal";
import ChartThemeModal from "@/components/chart-theme-modal";
import { CHART_THEMES, loadSavedChartTheme, saveChartTheme, type ChartTheme } from "@/lib/chart-themes";
import {
  type InstitutionalChartConfig,
  DEFAULT_INSTITUTIONAL_CONFIG,
  loadInstitutionalChartConfig,
  saveInstitutionalChartConfig,
} from "@/lib/institutional-chart-types";
import TradeReflectionModal from "@/components/trade-reflection-modal";
import ChartTradeMarkers from "@/components/chart-trade-markers";
import type { TradeReflection } from "@/lib/replay";
import { defaultIndicators, indicatorValues, type IndicatorSettings, type IndicatorKey } from "@/lib/indicators";
import { cashPreview } from "@/lib/order-preview";
import { FEE_RATE } from "@/lib/replay";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
const orderLabels = { market: "سوق", limit: "محدد", stop: "وقف دخول" };
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
  const [macro,setMacro]=useState<MacroSnapshot|null>(null);
  const [archiveEvents,setArchiveEvents]=useState<NewsRecord[]>([]);
  const [inspectNews,setInspectNews]=useState(0);
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
  const renderedCandles = useRef<Candle[]>([]);
  const [floatingReplay,setFloatingReplay]=useState(false);
  const [selectReplayPoint,setSelectReplayPoint]=useState(false);
  const [playing, setPlaying] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [replaySpeed, setReplaySpeed] = useState(1);
  const [error, setError] = useState("");
  const [showVolume, setShowVolume] = useState(true);
  const [volumeScale, setVolumeScale] = useState<number>(0.85);
  const volumeScaleRef = useRef(volumeScale);
  volumeScaleRef.current = volumeScale;
  const [showVwap, setShowVwap] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawnPrice, setDrawnPrice] = useState<number | null>(null);
  const [notional, setNotional] = useState("100");
  const [stopLoss, setStopLoss] = useState("");
  const [takeProfit, setTakeProfit] = useState("");
  const [reason, setReason] = useState("");
  const [tab, setTab] = useState<"trades" | "journal">("trades");
  const [historyScope, setHistoryScope] = useState<"current" | "all">("current");
  const [statsOpen, setStatsOpen] = useState(false);
  const [side,setSide] = useState<"long"|"short">("long");
  const draftOrigin = useRef<{entry:number;stop:number;target:number}|null>(null);
  const [quickDraft,setQuickDraft] = useState<{side:"long"|"short";entry:number;stop:number;target:number;amount:number;time:number}|null>(null);
  const [orderType, setOrderType] = useState<OrderType>("market");
  const [orderPrice, setOrderPrice] = useState("");
  const [source, setSource] = useState("");
  const [dataReady, setDataReady] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [integrationsOpen, setIntegrationsOpen] = useState(false);
  const [indicatorsOpen, setIndicatorsOpen] = useState(false);
  const [indicators, setIndicators] = useState<IndicatorSettings>(defaultIndicators);
  const [showGrid, setShowGrid] = useState(true);
  const [showVolumeProfile, setShowVolumeProfile] = useState(false);
  const [showSessionProfile, setShowSessionProfile] = useState(false);
  const [svpGrouping, setSvpGrouping] = useState<SessionGrouping>("auto");
  const [svpWidthScale, setSvpWidthScale] = useState<number>(1.0);
  const [chartSpaciousMode, setChartSpaciousMode] = useState<boolean>(false);
  const [institutionalHudOpen, setInstitutionalHudOpen] = useState(false);
  const [institutionalConfig, setInstitutionalConfig] = useState<InstitutionalChartConfig>(DEFAULT_INSTITUTIONAL_CONFIG);
  const [institutionalSettingsOpen, setInstitutionalSettingsOpen] = useState(false);
  const [pairMenuOpen, setPairMenuOpen] = useState(false);
  const [reflectionModalTrade, setReflectionModalTrade] = useState<Trade | null>(null);
  const [layout, setLayout] = useState({ orderOpen: false, historyOpen: true, width: 320, height: 220 });
  const [tpModalOpen, setTpModalOpen] = useState(false);
  const [scaleInTrade, setScaleInTrade] = useState<Trade | null>(null);
  const [scaleInAmount, setScaleInAmount] = useState<string>("500");
  const [chartViewMode, setChartViewMode] = useState<"candles" | "bookmap">("candles");
  const [cleanChart, setCleanChart] = useState(false);
  const [showTradeMarkers, setShowTradeMarkers] = useState(true);
  const [showNewsMarkers, setShowNewsMarkers] = useState(true);
  const [balanceModalOpen, setBalanceModalOpen] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [chartTheme, setChartTheme] = useState<ChartTheme>(CHART_THEMES["blue-white"]);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState<boolean>(false);
  const [offlineModalOpen, setOfflineModalOpen] = useState(false);
  const [offlineSummary, setOfflineSummary] = useState<{
    version: number;
    updatedAt: string;
    symbols: Record<string, {
      updatedAt: string;
      timeframes: Record<string, { count: number; start: number; end: number }>;
    }>;
  } | null>(null);

  useEffect(() => {
    try {
      const savedMode = localStorage.getItem("trading_lab_mode");
      if (savedMode === "offline") {
        setIsOfflineMode(true);
      }
    } catch {}

    fetch("/api/lab?offlineSummary=true")
      .then((res) => res.json() as Promise<{ summary?: typeof offlineSummary }>)
      .then((data) => {
        if (data?.summary) setOfflineSummary(data.summary);
      })
      .catch(() => {});
  }, []);

  const workspaceRef = useRef(workspace);
  const followChart = useRef(true);
  const playingRef = useRef(false);
  const resizeRef = useRef<{kind: "order" | "history"; x: number; y: number; size: number} | null>(null);
  useEffect(() => {
    try { const saved = JSON.parse(localStorage.getItem("replay-layout-v3") || "null");
      if (saved) setLayout({orderOpen: saved.orderOpen === true, historyOpen: saved.historyOpen !== false,
        width: Math.max(280, Math.min(460, Number(saved.width) || 320)), height: Math.max(100, Math.min(300, Number(saved.height) || 220))});
    } catch { /* Browser storage is optional. */ }
    try { const visual = JSON.parse(localStorage.getItem("replay-visual-v1") || "null");
      if(visual) { setShowGrid(visual.grid !== false); setShowVolume(visual.volume !== false); }
    } catch {}
    try { const saved = JSON.parse(localStorage.getItem("replay-indicators-v1")||"null");
      if(saved) setIndicators(Object.fromEntries(Object.entries(defaultIndicators).map(([key,value])=>[key,{enabled:saved[key]?.enabled===true,period:Number.isInteger(saved[key]?.period)&&saved[key].period>=2&&saved[key].period<=200?saved[key].period:value.period}])) as IndicatorSettings);
    } catch {}
    try {
      const scope = localStorage.getItem("replay-history-scope-v1");
      if (scope === "all" || scope === "current") setHistoryScope(scope);
    } catch {}
    try {
      const instSaved = loadInstitutionalChartConfig();
      setInstitutionalConfig(instSaved);
    } catch {}
    try {
      const savedMarkers = localStorage.getItem("replay-show-trade-markers");
      if (savedMarkers !== null) setShowTradeMarkers(savedMarkers === "true");
    } catch {}
    try {
      const savedNews = localStorage.getItem("replay-show-news-markers");
      if (savedNews !== null) setShowNewsMarkers(savedNews === "true");
    } catch {}
    try {
      const savedSvp = localStorage.getItem("replay-show-session-profile");
      if (savedSvp !== null) setShowSessionProfile(savedSvp === "true");
      const savedGrouping = localStorage.getItem("replay-svp-grouping") as SessionGrouping;
      if (["auto", "day", "week", "month"].includes(savedGrouping)) setSvpGrouping(savedGrouping);
      const savedWidth = Number(localStorage.getItem("replay-svp-width-scale"));
      if (Number.isFinite(savedWidth) && savedWidth >= 0.5 && savedWidth <= 2.0) setSvpWidthScale(savedWidth);
      const savedSpacious = localStorage.getItem("replay-chart-spacious");
      if (savedSpacious !== null) setChartSpaciousMode(savedSpacious === "true");
    } catch {}
    try {
      const savedTheme = loadSavedChartTheme();
      setChartTheme(savedTheme);
    } catch {}
    try {
      const savedVolScale = localStorage.getItem("replay-volume-scale-v1");
      if (savedVolScale) {
        const val = Number(savedVolScale);
        if (Number.isFinite(val) && val >= 0.5 && val <= 0.95) {
          setVolumeScale(val);
        }
      }
    } catch {}
    setPrefsLoaded(true);
  }, []);
  useEffect(() => {
    if (!pairMenuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".asset-head")) setPairMenuOpen(false);
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPairMenuOpen(false);
    };
    window.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [pairMenuOpen]);
  useEffect(() => { if(prefsLoaded) { try { localStorage.setItem("replay-layout-v3", JSON.stringify(layout)); } catch {} } }, [layout,prefsLoaded]);
  useEffect(() => { if(prefsLoaded) { try { localStorage.setItem("replay-visual-v1",JSON.stringify({grid:showGrid,volume:showVolume})); } catch {} } }, [showGrid,showVolume,prefsLoaded]);
  useEffect(()=>{if(prefsLoaded)try{localStorage.setItem("replay-indicators-v1",JSON.stringify(indicators));}catch{}},[indicators,prefsLoaded]);
  useEffect(()=>{if(prefsLoaded)try{localStorage.setItem("replay-history-scope-v1",historyScope);}catch{}},[historyScope,prefsLoaded]);
  useEffect(()=>{if(prefsLoaded)try{localStorage.setItem("replay-show-trade-markers",String(showTradeMarkers));}catch{}},[showTradeMarkers,prefsLoaded]);
  useEffect(()=>{if(prefsLoaded)try{localStorage.setItem("replay-show-news-markers",String(showNewsMarkers));}catch{}},[showNewsMarkers,prefsLoaded]);
  useEffect(()=>{if(prefsLoaded)try{localStorage.setItem("replay-show-session-profile",String(showSessionProfile));}catch{}},[showSessionProfile,prefsLoaded]);
  useEffect(()=>{if(prefsLoaded)try{localStorage.setItem("replay-svp-grouping",svpGrouping);}catch{}},[svpGrouping,prefsLoaded]);
  useEffect(()=>{if(prefsLoaded)try{localStorage.setItem("replay-svp-width-scale",String(svpWidthScale));}catch{}},[svpWidthScale,prefsLoaded]);
  useEffect(()=>{if(prefsLoaded)try{localStorage.setItem("replay-chart-spacious",String(chartSpaciousMode));}catch{}},[chartSpaciousMode,prefsLoaded]);
  const resizeStart = (e: ReactPointerEvent<HTMLDivElement>, kind: "order" | "history") => {
    e.currentTarget.setPointerCapture(e.pointerId); e.preventDefault();
    resizeRef.current = {kind, x:e.clientX, y:e.clientY, size:kind === "order" ? layout.width : layout.height};
  };
  const resizeMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    const drag = resizeRef.current; if(!drag) return;
    setLayout(old => drag.kind === "order" ? {...old,width:Math.max(280,Math.min(460,drag.size+drag.x-e.clientX))}
      : {...old,height:Math.max(100,Math.min(300,drag.size+drag.y-e.clientY))});
  };
  const stopPlaying = () => { playingRef.current=false; setPlaying(false); };
  const zoom = (factor: number) => {
    const scale = chartRef.current?.timeScale();
    if (!scale) return;
    const range = scale.getVisibleLogicalRange();
    if (range) {
      const center = (range.from + range.to) / 2;
      const half = ((range.to - range.from) * factor) / 2;
      scale.setVisibleLogicalRange({ from: center - half, to: center + half });
    }
    const currentSpacing = scale.options().barSpacing ?? 8;
    const newSpacing = Math.max(0.15, Math.min(75, currentSpacing * (1 / factor)));
    scale.applyOptions({ barSpacing: newSpacing });
    followChart.current = false;
  };
  const resetView = () => {
    chartRef.current?.priceScale("right").applyOptions({ autoScale: true });
    chartRef.current?.timeScale().applyOptions({ barSpacing: (timeframe === "1d" || chartSpaciousMode) ? 26 : 10 });
    chartRef.current?.timeScale().fitContent();
    followChart.current = true;
  };

  const toggleSpaciousSpacing = () => {
    setChartSpaciousMode((prev) => {
      const next = !prev;
      if (chartRef.current) {
        const timeScale = chartRef.current.timeScale();
        const current = timeScale.options().barSpacing || 10;
        const target = next ? Math.max(26, current * 1.8) : Math.max(10, current / 1.8);
        timeScale.applyOptions({ barSpacing: Math.min(65, Math.max(6, target)) });
      }
      return next;
    });
  };

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
    entry?: { line: IPriceLine; price: number } | null;
    stop: { line: IPriceLine; price: number } | null;
    target: { line: IPriceLine; price: number } | null;
    takeProfits?: { id: string; line: IPriceLine; price: number; amount: number; percentage?: number }[];
  }>({ stop: null, target: null });
  const draggingRiskRef = useRef<string | null>(null);
  const draftDragRef = useRef<((kind:"stop"|"target"|"entry",value:number)=>void)|null>(null);
  const dragStartRiskRef = useRef<{ stop: number; target: number; entry?:number; kind?: string; initialPrice?: number } | null>(null);
  const riskSubmitRef = useRef<((stop: number, target: number) => Promise<boolean>) | null>(null);
  const drawingRef = useRef(false);
  const technicalDrawingRef=useRef(false);
  const drawingActive=useCallback((v:boolean)=>{technicalDrawingRef.current=v;},[]);
  const dragOffset=useRef(0);
  const actionBusy = useRef(false);
  const stepBusy = useRef(false);
  const refreshRef = useRef<() => Promise<void>>(() => Promise.resolve());
  const advanceStepRef = useRef<(count?: number) => Promise<void>>(async () => undefined);
  const seekReplayRef = useRef<((time:number)=>void)|null>(null);
  const seekReplayModeRef = useRef(false);
  seekReplayModeRef.current = selectReplayPoint;

  const session = workspace.sessions.find((item) => item.id === workspace.activeSessionId) ?? null;
  candlesRef.current=candles;
  const currentSymbol = session?.symbol ?? symbol;
  const sessionTrades = workspace.trades.filter((trade) => trade.sessionId === session?.id);
  const displayedTrades = historyScope === "all" ? workspace.trades : sessionTrades;
  const activeTrades = useMemo(() => sessionTrades.filter((trade) => ["pending", "open", "close_pending"].includes(trade.status)), [sessionTrades]);
  const [selectedTradeId, setSelectedTradeId] = useState<string | null>(null);
  const selectedTrade = activeTrades.find(t => t.id === selectedTradeId) ?? activeTrades[0] ?? null;
  const openTrade = selectedTrade;
  const closedTrades = sessionTrades.filter((trade) => trade.status === "closed");
  const wins = closedTrades.filter((trade) => trade.realizedPnl > 0).length;
  const losses = closedTrades.filter((trade) => trade.realizedPnl <= 0).length;
  const netPnl = sessionTrades.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const winRate = closedTrades.length ? (wins / closedTrades.length) * 100 : 0;

  const allClosedTrades = workspace.trades.filter((trade) => trade.status === "closed");
  const allWins = allClosedTrades.filter((trade) => trade.realizedPnl > 0).length;
  const allLosses = allClosedTrades.filter((trade) => trade.realizedPnl <= 0).length;
  const allNetPnl = workspace.trades.reduce((sum, trade) => sum + trade.realizedPnl, 0);
  const allWinRate = allClosedTrades.length ? (allWins / allClosedTrades.length) * 100 : 0;
  const startingBalance = workspace.initialBalance ?? INITIAL_BALANCE;
  const equity = startingBalance + allNetPnl;
  const latest = candles.at(-1);
  const change = latest ? ((latest.close - latest.open) / latest.open) * 100 : 0;
  const longAvg = useMemo(() => computeDailyVwap(candles), [candles]);
  const parsedStartDate = new Date(startDate).getTime();
  const selectedStartTime = Number.isFinite(parsedStartDate)
    ? Math.floor(parsedStartDate / 60_000) * 60_000
    : null;
  const isLiveSession = session?.cursorTime
    ? Math.abs(Date.now() - session.cursorTime) < 300_000
    : false;

  useEffect(() => {
    if (!focusMode) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setFocusMode(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [focusMode]);

  const handleSaveBalance = async (newBalance: number, resetTrades: boolean) => {
    const ok = await act({ action: "setBalance", balance: newBalance, resetTrades });
    if (ok === false) {
      throw new Error("تعذر تحديث رصيد الحساب.");
    }
  };

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
      const payload = await response.json() as {error?:string;state?:Workspace;candles?:Candle[];source?:string;macro?:MacroSnapshot};
      const nextWorkspace=payload.state ?? blank;
      if(payload.state) { workspaceRef.current=nextWorkspace; setWorkspace(nextWorkspace); }
      const nextSession=nextWorkspace.sessions.find(item=>item.id===nextWorkspace.activeSessionId);
      if(nextSession) { if(!startDateTouched.current) setStartDate(dateTimeInputValue(nextSession.startTime)); setSymbol(nextSession.symbol); }
      if(!response.ok) throw new Error(payload.error || "تعذر تحميل الجلسة.");
      setMacro(payload.macro??null); setCandles(payload.candles ?? []); setSource(payload.source ?? "");
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

  const confirmationBusy = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const actionFinished = useRef<Promise<boolean> | null>(null);
  const marketClose = useRef(latest?.close);
  marketClose.current = latest?.close;

  const act = useCallback(async (body: Record<string, unknown>) => {
    if (actionBusy.current) return false;
    if(body.action==="start") {historyEpoch.current++;historyAbort.current?.abort();setHistoryAvailable(true);setHistoryError("");}
    actionBusy.current = true;
    let finish!: (ok:boolean) => void;
    let succeeded = false;
    actionFinished.current = new Promise<boolean>(resolve => { finish = resolve; });
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/lab", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ offline: isOfflineMode, ...body, revision: workspaceRef.current.revision, timeframe }),
        signal: AbortSignal.timeout(60000),
      });
      const payload = (await response.json()) as { error?: string; state?: Workspace; candles?: Candle[]; source?: string; macro?:MacroSnapshot; conflict?: boolean };
      if (!response.ok) { if(payload.conflict) setDataReady(false); throw new Error(payload.error ?? "لم يكتمل الإجراء."); }
      if (payload.state) { workspaceRef.current=payload.state; setWorkspace(payload.state); }
      if (payload.source) setSource(payload.source);
      if (body.action === "start" || body.action === "selectSession") {
        setCandles(payload.candles ?? []);
        setDataReady(Boolean(payload.candles?.length));
        followChart.current=true;
        if (body.action === "selectSession") {
          const s = payload.state?.sessions.find(x => x.id === payload.state?.activeSessionId);
          if (s) {
            setSymbol(s.symbol);
            if (!startDateTouched.current) setStartDate(dateTimeInputValue(s.startTime));
          }
        }
      }

      if (body.action === "step" && payload.candles?.length) {
        marketClose.current = payload.candles.at(-1)?.close;
        setDataReady(true);
        setCandles((current) => appendReplayBatch(current, payload.candles!, timeframe));
      }
      succeeded = true;
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "حدث خطأ غير متوقع.");
      playingRef.current=false; setPlaying(false);
      if (body.action === "step") setDataReady(false);
      return false;
    } finally {
      actionBusy.current = false;
      setLoading(false);
      actionFinished.current = null;
      finish(succeeded);
    }
  }, [timeframe, isOfflineMode]);

  riskSubmitRef.current = openTrade && ["pending", "open"].includes(openTrade.status)
    ? (stop, target) => act({ action: "risk", tradeId: openTrade.id, stopLoss: stop, takeProfit: target })
    : null;

  const advanceStep = useCallback(async (count = 1, unit:"minute"|"bar"="minute") => {
    if (!session || stepBusy.current || actionBusy.current || confirmationBusy.current) return;
    stepBusy.current = true;
    setLoading(true);
    try {
      await act({ action: "step", count, unit });
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
      layout: { background: { color: chartTheme.background }, textColor: chartTheme.textColor, fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", fontSize: 11 },
      grid: { vertLines: { color: chartTheme.gridColor, style: 4 }, horzLines: { color: chartTheme.gridColor, style: 4 } },
      crosshair: { mode: 0, vertLine: { color: "rgba(148, 163, 184, 0.22)", labelBackgroundColor: "#1e293b" }, horzLine: { color: "rgba(148, 163, 184, 0.22)", labelBackgroundColor: "#1e293b" } },
      rightPriceScale: { borderColor: "rgba(255, 255, 255, 0.06)", scaleMargins: { top: 0.08, bottom: 0.22 } },
      timeScale: {
        borderColor: "rgba(255, 255, 255, 0.06)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 25,
        barSpacing: (timeframe === "1d" || chartSpaciousMode) ? 26 : 10,
        minBarSpacing: 0.15,
        maxBarSpacing: 75,
        tickMarkFormatter: formatLocalTick,
      },
      localization: { priceFormatter: formatAxis, timeFormatter: formatLocalChartTime },
      handleScroll: { mouseWheel: true, pressedMouseMove: true, horzTouchDrag: true, vertTouchDrag: true },
      handleScale: { axisPressedMouseMove: { time: true, price: true }, mouseWheel: true, pinch: true },
    });
    const candlesRef = chart.addSeries(CandlestickSeries, {
      upColor: chartTheme.upColor,
      downColor: chartTheme.downColor,
      borderUpColor: chartTheme.upBorderColor,
      borderDownColor: chartTheme.downBorderColor,
      wickUpColor: chartTheme.upWickColor,
      wickDownColor: chartTheme.downWickColor,
    });
    const volumeRef = chart.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" }, priceScaleId: "volume", lastValueVisible: false, priceLineVisible: false,
    });
    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: volumeScaleRef.current, bottom: 0 },
      visible: false,
    });
    const vwapRef = chart.addSeries(LineSeries, { color: "rgba(148, 163, 184, 0.75)", lineWidth: 1, priceLineVisible: false, lastValueVisible: false });
    overlaySeries.current = [
      "#94a3b8", // SMA: Calm Institutional Slate
      "#60a5fa", // EMA: Soft Muted Blue
      "rgba(100, 116, 139, 0.45)", // Bollinger Middle: Quiet subtle slate
      "rgba(148, 163, 184, 0.35)", // Bollinger Upper: Soft transparent slate
      "rgba(148, 163, 184, 0.35)", // Bollinger Lower: Soft transparent slate
    ].map((color) => chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false }));
    const markerPlugin = createSeriesMarkers(candlesRef, []);
    chart.subscribeClick((param) => {
      if (seekReplayModeRef.current && param.time) {
        seekReplayRef.current?.(Number(param.time) * 1000);
        return;
      }
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
    chartRef.current.applyOptions({
      layout: { background: { color: chartTheme.background }, textColor: chartTheme.textColor },
      grid: { vertLines: { color: chartTheme.gridColor }, horzLines: { color: chartTheme.gridColor } },
    });
    candleSeries.current.applyOptions({
      upColor: chartTheme.upColor,
      downColor: chartTheme.downColor,
      borderUpColor: chartTheme.upBorderColor,
      borderDownColor: chartTheme.downBorderColor,
      wickUpColor: chartTheme.upWickColor,
      wickDownColor: chartTheme.downWickColor,
    });
    if (volumeSeries.current && candlesRef.current.length) {
      const updatedVol = candlesRef.current.map((c) => ({
        time: (c.openTime / 1000) as UTCTimestamp,
        value: c.volume,
        color: c.close >= c.open ? chartTheme.volumeUp : chartTheme.volumeDown,
      }));
      volumeSeries.current.setData(updatedVol);
    }
    saveChartTheme(chartTheme);
  }, [chartTheme]);

  useEffect(() => {
    if (!chartRef.current) return;
    try {
      chartRef.current.priceScale("volume").applyOptions({
        scaleMargins: { top: volumeScale, bottom: 0 },
        visible: false,
      });
      localStorage.setItem("replay-volume-scale-v1", String(volumeScale));
    } catch (e) {
      console.warn("Failed to update volume scale", e);
    }
  }, [volumeScale]);

  useEffect(() => {
    if (chartRef.current) {
      if (timeframe === "1d") {
        chartRef.current.timeScale().applyOptions({ barSpacing: chartSpaciousMode ? 32 : 24 });
      } else if (chartSpaciousMode) {
        chartRef.current.timeScale().applyOptions({ barSpacing: 22 });
      }
    }
  }, [timeframe, chartSpaciousMode]);

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
    const prior = renderedCandles.current;
    const incremental = prior.length > 0 && candles.length >= prior.length &&
      prior[0] === candles[0] && (prior.length < 2 || prior[prior.length-2] === candles[prior.length-2]);
    if (incremental) {
      for (const bar of chartData.slice(prior.length-1)) candleSeries.current.update(bar);
    } else candleSeries.current.setData(chartData);
    renderedCandles.current = candles;
    renderedFirst.current=candles[0]?.openTime??null;
    if(visibleRange)chartRef.current.timeScale().setVisibleLogicalRange({from:visibleRange.from+inserted,to:visibleRange.to+inserted});
    const volumeData = candles.map((candle) => ({
      time: (candle.openTime / 1000) as UTCTimestamp,
      value: candle.volume,
      color: candle.close >= candle.open ? chartTheme.volumeUp : chartTheme.volumeDown,
    }));
    if(incremental) { for(const bar of volumeData.slice(prior.length-1)) volumeSeries.current?.update(bar); }
    else volumeSeries.current?.setData(volumeData);
    vwapSeries.current?.setData(!cleanChart && showVwap ? longAvg : []);
    volumeSeries.current?.applyOptions({ visible: !cleanChart && showVolume });
    const trade = workspace.trades.find((item) => item.sessionId === session?.id && ["open", "close_pending"].includes(item.status));
    if (!cleanChart && showTradeMarkers && trade && candleSeries.current) {
      markersRef.current?.setMarkers([
        { time: (Math.floor((trade.entryTime ?? session?.cursorTime ?? 0) / ({"1m":60000,"5m":300000,"15m":900000,"1h":3600000,"4h":14400000,"1d":86400000}[timeframe])) * ({"1m":60,"5m":300,"15m":900,"1h":3600,"4h":14400,"1d":86400}[timeframe])) as UTCTimestamp, position: trade.side==="short"?"aboveBar":"belowBar", color: trade.side==="short"?chartTheme.downColor:chartTheme.upColor, shape: trade.side==="short"?"arrowDown":"arrowUp", text: trade.side==="short"?"بيع":"شراء" },
      ]);
    } else markersRef.current?.setMarkers([]);
    if (candles.length && followChart.current) {
      const scale = chartRef.current.timeScale();
      scale.scrollToPosition(openTrade || quickDraft ? Math.max(32, 280 / scale.options().barSpacing) : 8, false);
    }
  }, [candles, showVwap, showVolume, longAvg, workspace.trades, session?.id, session?.cursorTime, cleanChart, showTradeMarkers]);

  // Proactive upcoming macro news engine (anticipates news before the candle arrives)
  const upcomingMacro = useMemo(() => {
    if (!macro || !session?.cursorTime) return null;
    const cursor = session.cursorTime;
    const duration = { "1m": 60000, "5m": 300000, "15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000 }[timeframe];
    const allEvents = [...(macro.events || []), ...(archiveEvents || [])];
    const upcoming = allEvents
      .filter((e) => e.time > cursor && e.time <= cursor + Math.max(7200000, duration * 25))
      .sort((a, b) => a.time - b.time)[0];
    if (!upcoming) return null;
    const diffMs = upcoming.time - cursor;
    const diffMins = Math.max(1, Math.round(diffMs / 60000));
    const diffBars = Math.max(1, Math.round(diffMs / duration));
    return {
      event: upcoming,
      diffMs,
      diffMins,
      diffBars,
    };
  }, [macro, archiveEvents, session?.cursorTime, timeframe]);

  useEffect(() => {
    if (cleanChart || !candleSeries.current || !macro || macro.cursor !== session?.cursorTime) return;
    if (!showNewsMarkers) return;
    const duration = { "1m": 60000, "5m": 300000, "15m": 900000, "1h": 3600000, "4h": 14400000, "1d": 86400000 }[timeframe];

    // Past released events
    const past = [...new Map([...macro.events.filter((e) => e.status === "released"), ...archiveEvents]
      .filter((e) => e.time <= macro.cursor && candles.some((c) => c.openTime === Math.floor(e.time / duration) * duration))
      .map((e) => [e.id, e])).values()].sort((a, b) => a.time - b.time);

    // Upcoming future events projected ahead on timeline
    const upcomingEvents = [...new Map([...macro.events, ...archiveEvents]
      .filter((e) => e.time > macro.cursor && e.time <= macro.cursor + duration * 25)
      .map((e) => [e.id, e])).values()].sort((a, b) => a.time - b.time);

    const pastMarkers = past.map((e) => ({
      time: (Math.floor(e.time / duration) * duration / 1000) as UTCTimestamp,
      position: "aboveBar" as const,
      color: "#94a3b8", // subtle, calm slate
      shape: "circle" as const,
      text: e.title,
    }));

    const futureMarkers = upcomingEvents.map((e) => ({
      time: (Math.floor(e.time / duration) * duration / 1000) as UTCTimestamp,
      position: "aboveBar" as const,
      color: "#f59e0b", // warm amber warning
      shape: "arrowDown" as const,
      text: `⚠️ ترقب: ${e.title}`,
    }));

    const plugin = createSeriesMarkers(candleSeries.current, [...pastMarkers, ...futureMarkers], { autoScale: false });
    return () => plugin.detach();
  }, [macro, archiveEvents, session?.cursorTime, timeframe, candles, cleanChart, showNewsMarkers]);

  useEffect(() => {
    setStopLoss(openTrade ? String(openTrade.stopLoss) : "");
    setTakeProfit(openTrade ? String(openTrade.takeProfit) : "");
    if(openTrade) { setSide(openTrade.side??"long"); setOrderType(openTrade.orderType ?? "market"); setOrderPrice(openTrade.orderPrice ? String(openTrade.orderPrice) : ""); }
  }, [openTrade?.id, openTrade?.stopLoss, openTrade?.takeProfit]);

  useEffect(()=>{
    let index=0;
    for(const key of ['sma','ema','bands'] as IndicatorKey[]){
      const values=(!cleanChart && indicators[key].enabled)?indicatorValues(candles,indicators[key].period,key):[];
      const fields=key==='bands'?['value','upper','lower'] as const:['value'] as const;
      for(const field of fields)overlaySeries.current[index++]?.setData(values.map(v=>({time:v.time as UTCTimestamp,value:v[field]})));
    }
  },[candles,indicators,cleanChart]);

  const isDrafting = Boolean(quickDraft);
  const activeRiskTrade = !isDrafting && selectedTrade && ["pending", "open"].includes(selectedTrade.status) ? selectedTrade : null;
  const selectedSide: "long" | "short" = (quickDraft ? quickDraft.side : (activeRiskTrade?.side ?? side)) || "long";
  const direction = selectedSide === "short" ? -1 : 1;
  const expectedEntry = quickDraft
    ? quickDraft.entry
    : (activeRiskTrade
        ? (activeRiskTrade.entryPrice ?? activeRiskTrade.referencePrice ?? activeRiskTrade.orderPrice ?? latest?.close ?? 0)
        : (orderType !== "market" && Number(orderPrice) > 0 ? Number(orderPrice) : latest?.close ?? 0));
  const previewStop = latest ? (stopLoss === "" ? expectedEntry * (1 - direction * .01) : Number(stopLoss)) : null;
  const previewTarget = latest ? (takeProfit === "" ? expectedEntry * (1 + direction * .02) : Number(takeProfit)) : null;
  const orderAmount = quickDraft ? quickDraft.amount : (activeRiskTrade ? activeRiskTrade.notional : (Number(notional) || 100));
  const cash = cashPreview(
    orderAmount,
    expectedEntry,
    previewStop ?? 0,
    previewTarget ?? 0,
    quickDraft ? (draftOrderType(selectedSide, quickDraft.entry, latest?.close ?? quickDraft.entry)) : (activeRiskTrade?.orderType ?? orderType),
    activeRiskTrade?.entryPrice,
    activeRiskTrade?.remainingQuantity ?? activeRiskTrade?.quantity,
    activeRiskTrade?.entryPrice && activeRiskTrade.quantity ? activeRiskTrade.entryFee * (activeRiskTrade.remainingQuantity ?? activeRiskTrade.quantity) / activeRiskTrade.quantity : undefined,
    selectedSide
  );

  const tiedMargin = activeTrades.reduce((sum, t) => {
    const cost = t.entryPrice
      ? (t.remainingQuantity ?? t.quantity ?? 0) * t.entryPrice + t.entryFee * (t.remainingQuantity ?? t.quantity ?? 0) / (t.quantity || 1)
      : (t.notional ?? 0) * (1 + FEE_RATE);
    return sum + cost;
  }, 0);
  const availableCash = Math.max(0, equity - tiedMargin);

  const signedCash = (value: number) => `${value >= 0 ? "+" : "−"}${money(Math.abs(value))} USDT`;
  const stopDistancePct = expectedEntry > 0 && previewStop !== null ? (Math.abs(expectedEntry - previewStop) / expectedEntry) * 100 : null;
  const targetDistancePct = expectedEntry > 0 && previewTarget !== null ? (Math.abs(previewTarget - expectedEntry) / expectedEntry) * 100 : null;
  const stopGross = stopDistancePct !== null ? (orderAmount * stopDistancePct) / 100 : null;
  const targetGross = targetDistancePct !== null ? (orderAmount * targetDistancePct) / 100 : null;
  const priceRRatio = stopDistancePct && targetDistancePct && stopDistancePct > 0 ? (targetDistancePct / stopDistancePct) : null;
  useEffect(() => { chartRef.current?.applyOptions({grid:{vertLines:{visible:showGrid},horzLines:{visible:showGrid}}}); }, [showGrid]);
  const chartStop = activeRiskTrade ? (Number(stopLoss) > 0 ? Number(stopLoss) : activeRiskTrade.stopLoss) : previewStop;
  const chartTarget = activeRiskTrade ? (Number(takeProfit) > 0 ? Number(takeProfit) : activeRiskTrade.takeProfit) : previewTarget;
  const lineCash = cashPreview(
    orderAmount,
    expectedEntry,
    chartStop ?? 0,
    chartTarget ?? 0,
    quickDraft ? (draftOrderType(selectedSide, quickDraft.entry, latest?.close ?? quickDraft.entry)) : (activeRiskTrade?.orderType ?? orderType),
    activeRiskTrade?.entryPrice,
    activeRiskTrade?.remainingQuantity ?? activeRiskTrade?.quantity,
    activeRiskTrade?.entryPrice && activeRiskTrade.quantity ? activeRiskTrade.entryFee * (activeRiskTrade.remainingQuantity ?? activeRiskTrade.quantity) / activeRiskTrade.quantity : undefined,
    selectedSide
  );

  useEffect(() => {
    const series = candleSeries.current;
    if (!series) return;
    for (const line of priceLinesRef.current) series.removePriceLine(line);
    priceLinesRef.current = [];
    riskLinesRef.current = { stop: null, target: null, takeProfits: [] };
    if (cleanChart) return;
    if ((activeRiskTrade || quickDraft) && expectedEntry > 0) {
      const entryLine = series.createPriceLine({
        price: expectedEntry,
        color: "rgba(56, 189, 248, 0.7)",
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: "دخول",
      });
      priceLinesRef.current.push(entryLine);
      if (quickDraft) riskLinesRef.current.entry = { line: entryLine, price: expectedEntry };
    }
    if ((activeRiskTrade || quickDraft) && chartStop !== null && chartTarget !== null && chartStop > 0 && chartTarget > 0) {
      const targetPct = expectedEntry > 0 ? ((chartTarget - expectedEntry) / expectedEntry) * 100 : 0;
      const stopPct = expectedEntry > 0 ? ((expectedEntry - chartStop) / expectedEntry) * 100 : 0;

      const stopLine = series.createPriceLine({
        price: chartStop,
        color: "rgba(244, 63, 94, 0.8)",
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `وقف −${stopPct.toFixed(1)}%`,
      });
      const targetLine = series.createPriceLine({
        price: chartTarget,
        color: "rgba(16, 185, 129, 0.8)",
        lineWidth: 1,
        lineStyle: 0,
        axisLabelVisible: true,
        title: `هدف +${targetPct.toFixed(1)}%`,
      });
      riskLinesRef.current = {
        entry: riskLinesRef.current.entry,
        stop: { line: stopLine, price: chartStop },
        target: { line: targetLine, price: chartTarget },
        takeProfits: [],
      };
      priceLinesRef.current.push(stopLine, targetLine);
    }
    for (const level of activeRiskTrade?.stopLevels ?? []) {
      if (!level.filled) {
        priceLinesRef.current.push(series.createPriceLine({
          price: level.price,
          color: "rgba(245, 158, 11, 0.8)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `وقف جزئي · ${level.amount}$`,
        }));
      }
    }
    const tps: { id: string; line: IPriceLine; price: number; amount: number; percentage?: number }[] = [];
    for (const level of activeRiskTrade?.takeProfitLevels ?? []) {
      if (!level.filled) {
        const tpLine = series.createPriceLine({
          price: level.price,
          color: "rgba(16, 185, 129, 0.85)",
          lineWidth: 1,
          lineStyle: 2,
          axisLabelVisible: true,
          title: `🎯 سحب ${level.percentage ? level.percentage + '%' : ''}`,
        });
        priceLinesRef.current.push(tpLine);
        tps.push({
          id: level.id,
          line: tpLine,
          price: level.price,
          amount: level.amount,
          percentage: level.percentage,
        });
      }
    }
    if (riskLinesRef.current) riskLinesRef.current.takeProfits = tps;

    // Subtle reference entry lines for other active trades
    for (const other of activeTrades) {
      if (activeRiskTrade && other.id === activeRiskTrade.id) continue;
      if (other.entryPrice) {
        priceLinesRef.current.push(series.createPriceLine({
          price: other.entryPrice,
          color: other.side === "short" ? "rgba(244, 63, 94, 0.45)" : "rgba(34, 197, 94, 0.45)",
          lineWidth: 1,
          lineStyle: 1,
          axisLabelVisible: false,
          title: other.side === "short" ? "دخول S" : "دخول L",
        }));
      }
    }

    if (drawnPrice !== null) priceLinesRef.current.push(series.createPriceLine({ price: drawnPrice, color: "#a78bfa", lineWidth: 1, lineStyle: 1, axisLabelVisible: true, title: "مستوى" }));
  }, [activeRiskTrade?.id, activeRiskTrade?.status, activeRiskTrade?.entryPrice, activeRiskTrade?.stopLoss, activeRiskTrade?.takeProfit, chartStop, chartTarget, drawnPrice, lineCash?.stopNet, lineCash?.targetNet, expectedEntry, orderAmount, quickDraft, activeRiskTrade?.stopLevels, activeRiskTrade?.takeProfitLevels, cleanChart, activeTrades]);

  useEffect(()=>{
    candleSeries.current?.applyOptions({autoscaleInfoProvider: openTrade||quickDraft ? (original:()=>AutoscaleInfo|null)=>{
      const result=original(); if(!result?.priceRange||chartStop===null||chartTarget===null)return result;
      return {...result,priceRange:{minValue:Math.min(result.priceRange.minValue,chartStop,chartTarget,expectedEntry),maxValue:Math.max(result.priceRange.maxValue,chartStop,chartTarget,expectedEntry)}};
    }:undefined});
  },[openTrade?.id,quickDraft,chartStop,chartTarget,expectedEntry]);

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
      if ((event.target as HTMLElement).closest(".floating-replay,.drawing-menu,.tp-add-chip,.tp-delete-chip,.pill-badge-pct")) return;
      const series = candleSeries.current;
      const lines = riskLinesRef.current;
      if ((actionBusy.current && !draftDragRef.current) || !series || drawingRef.current || technicalDrawingRef.current || !lines.stop || !lines.target) return;
      followChart.current = false;
      const y = event.clientY - host.getBoundingClientRect().top;

      const handle = (event.target as HTMLElement).closest<HTMLElement>("[data-risk-handle]")?.dataset.riskHandle;

      const standardCandidates = (["stop", "target", "entry"] as const).map((kind) => {
        const line = lines[kind];
        const coordinate = line ? series.priceToCoordinate(line.price) : null;
        return { kind: kind as string, distance: coordinate === null ? Infinity : Math.abs(coordinate - y), price: line?.price };
      });

      const tpCandidates = (lines.takeProfits ?? []).map((tp) => {
        const coordinate = series.priceToCoordinate(tp.price);
        return { kind: `tp-${tp.id}`, distance: coordinate === null ? Infinity : Math.abs(coordinate - y), price: tp.price };
      });

      const allCandidates = [...standardCandidates, ...tpCandidates].sort((a, b) => a.distance - b.distance);
      const selected = handle ? allCandidates.find(c => c.kind === handle) : allCandidates[0];

      if (!selected || selected.price === undefined || (!handle && selected.distance > 15)) return;
      if (!draftDragRef.current) { playingRef.current = false; setPlaying(false); }
      chartRef.current?.priceScale("right").applyOptions({ autoScale: false });
      chartRef.current?.applyOptions({ handleScroll: false, handleScale: false });
      draggingRiskRef.current = selected.kind;
      dragOffset.current = y - (series.priceToCoordinate(selected.price) ?? y);
      dragStartRiskRef.current = { stop: lines.stop.price, target: lines.target.price, entry: lines.entry?.price, kind: selected.kind, initialPrice: selected.price };
      host.classList.add("risk-dragging");
      host.setPointerCapture(event.pointerId);
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onPointerMove = (event: PointerEvent) => {
      const kind = draggingRiskRef.current;
      const series = candleSeries.current;
      if (!kind || !series) return;
      const nextPrice = series.coordinateToPrice(event.clientY - host.getBoundingClientRect().top - dragOffset.current);
      if (nextPrice === null || !Number.isFinite(nextPrice) || nextPrice <= 0) return;

      if (kind === "stop" || kind === "target" || kind === "entry") {
        const line = riskLinesRef.current[kind];
        if (line) {
          line.price = nextPrice;
          line.line.applyOptions({ price: nextPrice });
        }
        if (draftDragRef.current) draftDragRef.current(kind, Number(nextPrice.toFixed(2)));
        else if (kind === "stop") setStopLoss(nextPrice.toFixed(2));
        else if (kind === "target") setTakeProfit(nextPrice.toFixed(2));
      } else if (kind.startsWith("tp-")) {
        const tpId = kind.slice(3);
        const tp = riskLinesRef.current.takeProfits?.find(x => x.id === tpId);
        if (tp) {
          tp.price = nextPrice;
          tp.line.applyOptions({ price: nextPrice });
        }
      }
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const onPointerUp = async (event: PointerEvent) => {
      const kind = draggingRiskRef.current;
      if (!kind) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      restoreDrag(event.pointerId);
      const lines = riskLinesRef.current;

      if (kind === "stop" || kind === "target" || kind === "entry") {
        if (draftDragRef.current && lines.entry) draftDragRef.current("entry", Number(lines.entry.price.toFixed(2)));
        const stop = lines.stop ? Number(lines.stop.price.toFixed(2)) : undefined;
        const target = lines.target ? Number(lines.target.price.toFixed(2)) : undefined;
        if (stop === undefined || target === undefined) return;
        const formatDraft = (value: number) => value.toFixed(2);
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
      } else if (kind.startsWith("tp-") && openTrade) {
        const tpId = kind.slice(3);
        const tp = lines.takeProfits?.find(x => x.id === tpId);
        if (tp) {
          const updatedLevels = (openTrade.takeProfitLevels ?? []).map(l => {
            if (l.id === tpId) {
              return { price: Number(tp.price.toFixed(2)), amount: l.amount, percentage: l.percentage };
            }
            return { price: l.price, amount: l.amount, percentage: l.percentage };
          });
          await act({ action: "takeProfits", tradeId: openTrade.id, levels: updatedLevels });
        }
      }
      dragStartRiskRef.current = null;
    };
    const onPointerCancel = (event: PointerEvent) => {
      const original = dragStartRiskRef.current;
      if (original) {
        draftDragRef.current?.("stop",original.stop);
        draftDragRef.current?.("target",original.target);
        if(original.entry!==undefined) draftDragRef.current?.("entry",original.entry);
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
  }, []);

  draftDragRef.current = quickDraft ? (kind,value) => {
    if(kind==="entry") {
      setQuickDraft(d=>d?{...d,entry:value}:null);
      setOrderPrice(String(value));
      setOrderType(draftOrderType(selectedSide,value,latest?.close??value));
    } else if(kind==="stop") setStopLoss(String(value));
    else setTakeProfit(String(value));
  } : null;
  const cancelDraft = () => {setQuickDraft(null);setStopLoss("");setTakeProfit("");setOrderPrice("");setOrderType("market");setError("");};
  const selectSymbol = async (nextSym: SymbolName, forceLatest = false) => {
    setPairMenuOpen(false);
    setSymbol(nextSym);
    if (nextSym !== currentSymbol || forceLatest) {
      const confirmReplace = sessionTrades.length > 0;
      if (
        confirmReplace &&
        !window.confirm(
          `بدء جلسة جديدة لعملة ${SYMBOL_INFO[nextSym]?.arabicName || nextSym} (${SYMBOL_INFO[nextSym]?.base || nextSym})؟ سيبقى سجل الجلسة السابقة محفوظاً.`
        )
      ) {
        return;
      }
      let startTime: number;
      if (forceLatest) {
        if (isOfflineMode) {
          const bounds = offlineSummary?.symbols[nextSym]?.timeframes[timeframe]
            ?? offlineSummary?.symbols[nextSym]?.timeframes["15m"];
          startTime = bounds ? bounds.end : Math.floor(Date.now() / 60_000) * 60_000 - 60_000;
        } else {
          startTime = Math.floor(Date.now() / 60_000) * 60_000 - 60_000;
        }
        startDateTouched.current = true;
        setStartDate(dateTimeInputValue(startTime));
      } else {
        const rawStartTime = new Date(startDate).getTime();
        startTime = Number.isFinite(rawStartTime)
          ? Math.floor(rawStartTime / 60_000) * 60_000
          : Date.now() - 7 * 86400000;
        if (isOfflineMode) {
          const bounds = offlineSummary?.symbols[nextSym]?.timeframes[timeframe]
            ?? offlineSummary?.symbols[nextSym]?.timeframes["15m"];
          if (bounds) {
            if (startTime > bounds.end) startTime = bounds.end;
            if (startTime < bounds.start) startTime = bounds.start + 60_000;
            startDateTouched.current = true;
            setStartDate(dateTimeInputValue(startTime));
          }
        } else if (nextSym === "XAUTUSDT" && startTime < Date.UTC(2026, 2, 26)) {
          startTime = Date.UTC(2026, 3, 1, 0, 0);
          startDateTouched.current = true;
          setStartDate(dateTimeInputValue(startTime));
        }
      }
      setPlaying(false);
      playingRef.current = false;
      const ok = await act({ action: "start", symbol: nextSym, startTime, confirmReplace });
      if (ok) {
        setQuickDraft(null);
        setDrawnPrice(null);
        setStopLoss("");
        setTakeProfit("");
      }
    }
  };
  const jumpToLatestSession = async (targetSymbol?: SymbolName) => {
    const sym = targetSymbol || symbol || currentSymbol;
    await selectSymbol(sym, true);
  };
  const selectSession = async (sessionId: string) => {
    if (!sessionId || sessionId === workspace.activeSessionId) return;
    setPlaying(false);
    playingRef.current = false;
    await act({ action: "selectSession", sessionId });
  };
  const startReplay = async (autoPlay = false) => {
    const rawStartTime = new Date(startDate).getTime();
    if (!Number.isFinite(rawStartTime)) {
      setError("أدخل تاريخًا ووقتًا صحيحين للبداية.");
      return;
    }
    const latestAllowed = Math.floor(Date.now() / 60_000) * 60_000 - 60_000;
    let startTime = Math.floor(rawStartTime / 60_000) * 60_000;
    if (startTime > latestAllowed) {
      startTime = latestAllowed;
      startDateTouched.current = true;
      setStartDate(dateTimeInputValue(startTime));
    }
    if (isOfflineMode) {
      const bounds = offlineSummary?.symbols[symbol]?.timeframes[timeframe]
        ?? offlineSummary?.symbols[symbol]?.timeframes["15m"];
      if (bounds) {
        if (startTime > bounds.end) startTime = bounds.end;
        if (startTime < bounds.start) startTime = bounds.start + 60_000;
        startDateTouched.current = true;
        setStartDate(dateTimeInputValue(startTime));
      }
    } else if (symbol === "XAUTUSDT" && startTime < Date.UTC(2026, 2, 26)) {
      startTime = Date.UTC(2026, 3, 1, 0, 0);
      startDateTouched.current = true;
      setStartDate(dateTimeInputValue(startTime));
    }
    setPlaying(false);
    const confirmReplace = sessionTrades.length > 0;
    if(confirmReplace && !window.confirm("بدء جلسة جديدة؟ سيبقى سجل الجلسة السابقة محفوظًا، وتتوقف متابعة أوامرها. يمكنك تنزيل السجل من لوحة الصفقات.")) return;
    playingRef.current=false;
    const ok = await act({ action: "start", symbol, startTime, confirmReplace });
    if (ok) {
      setQuickDraft(null);
      setDrawnPrice(null);
      setStopLoss(""); setTakeProfit("");
      if (autoPlay) { playingRef.current=true; setPlaying(true); }
    }
  };

  const switchToMode = async (offline: boolean) => {
    if (offline === isOfflineMode) return;
    setIsOfflineMode(offline);
    try {
      localStorage.setItem("trading_lab_mode", offline ? "offline" : "online");
    } catch {}

    const confirmSwitch = sessionTrades.length > 0;
    if (
      confirmSwitch &&
      !window.confirm(
        offline
          ? "التبديل إلى وضع عدم الاتصال (أوفلاين)؟ سيبدأ جلسة تدريبية من الشموع المخزنة محلياً على جهازك مع حفظ سجل صفقاتك الحالية."
          : "التبديل إلى وضع الاتصال (Online)؟ سيمكنك الوصول لبيانات وأرشيف Binance الكامل مع حفظ صفقاتك السابقة."
      )
    ) {
      return;
    }

    setPlaying(false);
    playingRef.current = false;

    let startTime: number;
    if (offline) {
      const bounds =
        offlineSummary?.symbols[currentSymbol]?.timeframes[timeframe] ??
        offlineSummary?.symbols[currentSymbol]?.timeframes["15m"];
      startTime = bounds ? bounds.end - 60_000 * 60 : Date.now() - 7 * 86400000;
    } else {
      startTime = Math.floor(Date.now() / 60_000) * 60_000 - 60_000;
    }
    startDateTouched.current = true;
    setStartDate(dateTimeInputValue(startTime));

    await act({
      action: "start",
      symbol: currentSymbol,
      startTime,
      confirmReplace: confirmSwitch,
      offline,
    });
  };

  const handleStartOfflineSession = async (targetSymbol: SymbolName) => {
    setIsOfflineMode(true);
    try {
      localStorage.setItem("trading_lab_mode", "offline");
    } catch {}
    setSymbol(targetSymbol);
    const bounds =
      offlineSummary?.symbols[targetSymbol]?.timeframes[timeframe] ??
      offlineSummary?.symbols[targetSymbol]?.timeframes["15m"];
    const startTime = bounds ? bounds.end - 60_000 * 60 : Date.now() - 7 * 86400000;
    startDateTouched.current = true;
    setStartDate(dateTimeInputValue(startTime));
    setPlaying(false);
    playingRef.current = false;
    await act({
      action: "start",
      symbol: targetSymbol,
      startTime,
      confirmReplace: sessionTrades.length > 0,
      offline: true,
    });
  };
  seekReplayRef.current = (time:number) => {
    setSelectReplayPoint(false);
    const startTime = Math.floor(time / 60_000) * 60_000;
    const replace = sessionTrades.length > 0;
    if (replace && !window.confirm("العودة إلى هذه الشمعة؟ سيبدأ Replay من النقطة المختارة ويحفظ سجل الجلسة السابقة.")) return;
    startDateTouched.current = true;
    setStartDate(dateTimeInputValue(startTime));
    void act({action:"start", symbol: currentSymbol, startTime, confirmReplace: replace});
  };
  const submitLong = async () => {
    if (confirmationBusy.current) return;
    confirmationBusy.current = true;
    setConfirming(true);
    try {
    if (actionFinished.current && !await actionFinished.current) return;
    if (actionBusy.current) return;
    const close = marketClose.current;
    if (!close) return setError("ابدأ المحاكاة حتى تظهر الشموع قبل وضع الأمر.");
    const submitType = quickDraft ? draftOrderType(selectedSide, quickDraft.entry, close) : orderType;
    const reference = quickDraft?.entry ?? (submitType === "market" ? close : Number(orderPrice));
    const stop = Number(stopLoss || (reference * (1-direction*.01)).toFixed(close < 100 ? 4 : 2));
    const target = Number(takeProfit || (reference * (1+direction*.02)).toFixed(close < 100 ? 4 : 2));
    const issue=draftError(Number(notional),reference,stop,target,selectedSide,availableCash);
    if(issue) {setError(issue);return;}
    const ok = await act({ action: "buy", side:selectedSide, notional: Number(notional), stopLoss: stop, takeProfit: target, orderType: submitType, orderPrice: submitType === "market" ? null : reference, reason, previewOriginal:quickDraft?draftOrigin.current:undefined });
    if (ok) {
      setReason("");
      setQuickDraft(null);
      const newTrade = workspaceRef.current.trades[0];
      if (newTrade) setReflectionModalTrade(newTrade);
    }
    } finally { confirmationBusy.current=false; setConfirming(false); }
  };
  const handleSaveReflection = async (reflection: TradeReflection) => {
    if (!reflectionModalTrade) return;
    await act({
      action: "reflect",
      tradeId: reflectionModalTrade.id,
      reflection,
    });
  };
  const quickOrder = async(nextSide:"long"|"short")=>{
    if(!latest||!session||!dataReady||quickDraft)return;
    const amount=Number(notional);
    if(!Number.isFinite(amount)||amount<1||amount*(1+FEE_RATE)>availableCash){setError("أدخل مبلغًا صالحًا ضمن الرصيد المتاح مع الرسوم.");return;}
    setSide(nextSide);setOrderType("market");setOrderPrice("");
    const d=nextSide==="short"?-1:1, stop=Number((latest.close*(1-d*.01)).toFixed(2)), target=Number((latest.close*(1+d*.02)).toFixed(2));
    setStopLoss(String(stop));setTakeProfit(String(target));
    draftOrigin.current={entry:latest.close,stop,target};
    setQuickDraft({side:nextSide,entry:latest.close,stop,target,amount,time:latest.openTime});
    followChart.current=true;chartRef.current?.timeScale().scrollToPosition(32,false);
    setStatsOpen(false);setError("");
  };

  const handleAddPartialTp = async (pct: number) => {
    if (!openTrade || openTrade.status !== "open" || !openTrade.entryPrice) return false;
    const existing = (openTrade.takeProfitLevels ?? []).filter((x) => !x.filled);
    if (existing.length >= 5) {
      setError("الحد الأقصى 5 أهداف لسحب الأرباح.");
      return false;
    }
    const entry = openTrade.entryPrice;
    const remainingQty = openTrade.remainingQuantity ?? openTrade.quantity ?? 0;
    const remainingUsdt = remainingQty * entry;
    const existingSum = existing.reduce((s, x) => s + x.amount, 0);
    const availableUsdt = remainingUsdt - existingSum;
    if (availableUsdt < 1) {
      setError("لا يوجد رأس مال متبقٍ في الصفقة لتقسيم هدف ربح جديد.");
      return false;
    }
    const initialNotional = openTrade.notional || remainingUsdt;
    const amountVal = Math.min(availableUsdt, Number((initialNotional * (pct / 100)).toFixed(2)));
    if (amountVal <= 0) return false;

    let targetPrice = 0;
    if (openTrade.takeProfit && openTrade.takeProfit > entry) {
      const spread = openTrade.takeProfit - entry;
      const fraction = pct <= 25 ? 0.38 : pct <= 50 ? 0.68 : 0.88;
      targetPrice = Number((entry + spread * fraction).toFixed(2));
    } else {
      const distanceMulti = 1 + (pct / 100) * 0.04 + 0.01;
      targetPrice = Number((entry * distanceMulti).toFixed(2));
    }

    while (existing.some((l) => Math.abs(l.price - targetPrice) < 0.05) || targetPrice <= entry) {
      targetPrice = Number((targetPrice * 1.008).toFixed(2));
    }

    const newLevels = [
      ...existing.map((l) => ({ price: l.price, amount: l.amount, percentage: l.percentage })),
      { price: targetPrice, amount: amountVal, percentage: pct },
    ];
    return await act({ action: "takeProfits", tradeId: openTrade.id, levels: newLevels });
  };

  const handleRemovePartialTp = async (id: string) => {
    if (!openTrade) return false;
    const filtered = (openTrade.takeProfitLevels ?? [])
      .filter((x) => !x.filled && x.id !== id)
      .map((l) => ({ price: l.price, amount: l.amount, percentage: l.percentage }));
    return await act({ action: "takeProfits", tradeId: openTrade.id, levels: filtered });
  };

  const handleCyclePartialTp = async (id: string) => {
    if (!openTrade || !openTrade.entryPrice) return false;
    const existingLevel = openTrade.takeProfitLevels?.find((x) => x.id === id);
    if (!existingLevel) return false;
    const cycle = [20, 33, 50, 100];
    const currentPct = existingLevel.percentage ?? 20;
    const nextIdx = (cycle.indexOf(currentPct) + 1) % cycle.length;
    const nextPct = cycle[nextIdx];

    const entry = openTrade.entryPrice;
    const remainingQty = openTrade.remainingQuantity ?? openTrade.quantity ?? 0;
    const remainingUsdt = remainingQty * entry;
    const initialNotional = openTrade.notional || remainingUsdt;
    const otherSum = (openTrade.takeProfitLevels ?? [])
      .filter((x) => !x.filled && x.id !== id)
      .reduce((s, x) => s + x.amount, 0);
    const availableForThis = Math.max(0, remainingUsdt - otherSum);
    const calculatedAmount = Math.min(availableForThis, Number((initialNotional * (nextPct / 100)).toFixed(2)));

    const updated = (openTrade.takeProfitLevels ?? [])
      .filter((x) => !x.filled)
      .map((l) => {
        if (l.id === id) {
          return { price: l.price, amount: calculatedAmount > 0 ? calculatedAmount : l.amount, percentage: nextPct };
        }
        return { price: l.price, amount: l.amount, percentage: l.percentage };
      });
    return await act({ action: "takeProfits", tradeId: openTrade.id, levels: updated });
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
    <main className={`trading-shell simple-layout ${focusMode ? "focus-mode-active" : ""} ${floatingReplay ? "floating-controls" : ""} ${layout.orderOpen ? "" : "orders-collapsed"} ${layout.historyOpen ? "" : "history-collapsed"}`} style={{"--order-width":`${layout.width}px`,"--history-height":`${layout.height}px`} as CSSProperties} dir="rtl">
      <header className="topbar">
        <div className="brand"><div className="brand-mark"><Activity size={17} /></div><div><strong>مختبر التداول</strong><small>REPLAY LAB <span>·</span> تجريبي</small></div></div>
        <div className="asset-head">
          <button
            className={`pair-select ${pairMenuOpen ? "active" : ""}`}
            disabled={loading || playing}
            title="اختيار الأصل للتداول أو الجلسة"
            aria-expanded={pairMenuOpen}
            aria-haspopup="listbox"
            onClick={() => setPairMenuOpen((v) => !v)}
          >
            <span className="coin-icon">{SYMBOL_INFO[currentSymbol]?.icon ?? "🪙"}</span>
            <span>
              <b>{SYMBOL_INFO[currentSymbol]?.base ?? currentSymbol.slice(0, -4)} <i>/ USDT</i></b>
              <small>{SYMBOL_INFO[currentSymbol]?.arabicName ?? currentSymbol}</small>
            </span>
            <ChevronDown size={13} />
          </button>
          {pairMenuOpen && (
            <div className="pair-dropdown-menu" role="listbox" aria-label="قائمة العملات المتاحة">
              <div className="pair-dropdown-header">
                <div>
                  <strong>العملات المتاحة للتداول</strong>
                  <small>4 أصول مدعومة للتدريب والمحاكاة</small>
                </div>
                <button
                  type="button"
                  className="pair-header-now-btn"
                  onClick={() => void jumpToLatestSession()}
                  title="بدء أحدث شمعة وجلسة لحظية للعملة المحددة حالياً"
                >
                  <Zap size={12} /> ⚡ أحدث شمعة للعملة الحالية
                </button>
              </div>
              {SYMBOLS.map((s) => {
                const info = SYMBOL_INFO[s];
                const isCurrent = s === currentSymbol;
                return (
                  <div
                    key={s}
                    role="option"
                    aria-selected={isCurrent}
                    tabIndex={0}
                    className={`pair-dropdown-item ${isCurrent ? "active" : ""}`}
                    onClick={() => void selectSymbol(s)}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") void selectSymbol(s); }}
                  >
                    <span className="coin-icon">{info.icon}</span>
                    <div className="pair-item-info">
                      <div className="pair-item-title">
                        <span><b>{info.base}</b>/USDT</span>
                        <span className="pair-badge" style={{ color: info.badgeColor, borderColor: `${info.badgeColor}55` }}>{info.arabicName}</span>
                      </div>
                      <span className="pair-item-sub">{info.description}</span>
                    </div>
                    <button
                      type="button"
                      className="pair-item-instant-btn"
                      title={`بدء ${info.arabicName} من أحدث شمعة حالية بضغطة زر واحدة (Live)`}
                      onClick={(e) => {
                        e.stopPropagation();
                        void selectSymbol(s, true);
                      }}
                    >
                      <Zap size={11} /> أحدث شمعة
                    </button>
                    {isCurrent && <span className="pair-active-check">✓</span>}
                  </div>
                );
              })}
            </div>
          )}
          <div className="asset-price"><strong>{latest ? price(latest.close) : "—"}</strong><span className={change >= 0 ? "positive" : "negative"}>{latest ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : "بانتظار بدء Replay"}</span></div>
        </div>
        <div className="top-actions">
          {/* Mode Switcher: Online (Binance) vs Offline (Local Data Pack) */}
          <div className="mode-switch-group" role="group" aria-label="وضع التشغيل">
            <button
              type="button"
              className={`mode-btn ${!isOfflineMode ? "active online" : ""}`}
              onClick={() => void switchToMode(false)}
              title="الوضع المتصل (Online): أسعار لحظية، أرشيف Binance الكامل، وأحدث الشموع"
            >
              <Wifi size={13} />
              <span>متصل (Online)</span>
            </button>
            <button
              type="button"
              className={`mode-btn ${isOfflineMode ? "active offline" : ""}`}
              onClick={() => void switchToMode(true)}
              title="وضع عدم الاتصال (أوفلاين): تشغيل كامل 100% بدون اتصال بالنت من المخزن المحلي"
            >
              <WifiOff size={13} />
              <span>أوفلاين (بدون نت)</span>
            </button>
            <button
              type="button"
              className="offline-manage-pill"
              onClick={() => setOfflineModalOpen(true)}
              title="إدارة بيانات الأوفلاين والاطلاع على الشموع المخزنة محلياً"
            >
              <Database size={13} />
              <span>بيانات الأوفلاين</span>
            </button>
          </div>

          <div
            className="account-summary account-summary-clickable"
            onClick={() => setBalanceModalOpen(true)}
            title="انقر لتعديل أو إعادة ضبط رصيد الحساب والمحفظة"
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") setBalanceModalOpen(true); }}
          >
            <div className="summary-text">
              <small>حساب تدريبي · تعديل</small>
              <b dir="ltr">{money(equity)} USDT</b>
            </div>
            <button
              type="button"
              className="balance-edit-btn"
              aria-label="تعديل رصيد الحساب"
              onClick={(e) => { e.stopPropagation(); setBalanceModalOpen(true); }}
              title="تعديل أو إعادة ضبط الرصيد"
            >
              <Sliders size={12} />
            </button>
          </div>
          <button className="icon-button" title="مفاتيح الربط والتكامل مع المنصات" aria-label="مفاتيح الربط والتكامل" onClick={()=>setIntegrationsOpen(true)}><KeyRound size={17}/></button>
          <button className="icon-button" title="إعدادات العرض" aria-expanded={settingsOpen} onClick={()=>setSettingsOpen(!settingsOpen)}><Settings2 size={18}/></button>
          {isOfflineMode ? (
            <span className="connection offline-status" title="أنت تعمل الآن 100% من المخزن المحلي بدون نت">
              <i className="offline-dot" /> محلي (أوفلاين)
            </span>
          ) : (
            <span className="connection" title="متصل بأرشيف ومزودات الأسعار المباشرة">
              <i /> متصل (Online)
            </span>
          )}
          <button className="layout-button" onClick={() => setLayout(v=>({...v,orderOpen:!v.orderOpen}))}>{layout.orderOpen ? "طي الأوامر" : "لوحة الأوامر"}</button>
          <button className="icon-button" title="طريقة الاستخدام" onClick={() => setHelpOpen(!helpOpen)}><CircleHelp size={18}/></button>
          <div className="avatar">م</div>
        </div>
      </header>

      {isOfflineMode && (
        <aside className="offline-active-strip" role="status">
          <div className="offline-strip-content">
            <span className="offline-badge">
              <WifiOff size={13} /> وضع عدم الاتصال نشط (100% بدون نت)
            </span>
            <span className="offline-strip-text">
              تتداول الآن بالاعتماد الكامل على الشموع والمخزن المحلي. التحليل الفني، المؤشرات، وتنفيذ الصفقات تعمل بسرعة فائقة وبدون أي استهلاك للإنترنت.
            </span>
          </div>
          <div className="offline-strip-actions">
            <button
              type="button"
              className="offline-strip-btn"
              onClick={() => setOfflineModalOpen(true)}
            >
              <Database size={12} /> استعراض بيانات الأوفلاين
            </button>
            <button
              type="button"
              className="offline-strip-switch"
              onClick={() => void switchToMode(false)}
            >
              <Wifi size={12} /> العودة إلى الوضع المتصل (Online)
            </button>
          </div>
        </aside>
      )}

      <PlatformIntegrationsModal isOpen={integrationsOpen} onClose={()=>setIntegrationsOpen(false)} />

      {settingsOpen && <section className="display-settings" aria-label="إعدادات العرض"><header><strong>إعدادات العرض</strong><button onClick={()=>setSettingsOpen(false)} aria-label="إغلاق الإعدادات"><X size={18}/></button></header><label><input type="checkbox" checked={showGrid} onChange={e=>setShowGrid(e.target.checked)}/> شبكة الأسعار</label><label><input type="checkbox" checked={showVolume} onChange={e=>setShowVolume(e.target.checked)}/> أحجام التداول</label><label><input type="checkbox" checked={layout.orderOpen} onChange={e=>setLayout(v=>({...v,orderOpen:e.target.checked}))}/> لوحة الأوامر</label><label><input type="checkbox" checked={layout.historyOpen} onChange={e=>setLayout(v=>({...v,historyOpen:e.target.checked}))}/> سجل الصفقات</label><button onClick={()=>{setLayout({orderOpen:false,historyOpen:true,width:300,height:220});setShowGrid(true);setShowVolume(true);resetView();}}>استعادة العرض الافتراضي</button><button style={{marginTop: "8px", background: "#1b2a3a", borderColor: "#35506e", color: "#a5cdf7"}} onClick={()=>{setSettingsOpen(false); setIntegrationsOpen(true);}}><KeyRound size={14} style={{display: "inline-block", verticalAlign: "middle", marginLeft: "6px"}}/> الربط والتكامل (API Keys)</button></section>}
      {helpOpen && <section className="help-panel" aria-label="طريقة الاستخدام"><button onClick={()=>setHelpOpen(false)}>إغلاق الشرح ×</button><h2>تدرّب خطوة بخطوة</h2><p>اختر الأصل والتاريخ ثم «جلسة جديدة». تشغيل يستأنف الجلسة الحالية، والشمعة التالية تتقدم بمقدار إطار الشارت المختار مع معالجة دقائقها بالتسلسل.</p><p>حرّك الشارت بالسحب، وكبّره بعجلة الفأرة أو اللمس بإصبعين. اسحب خط الوقف أو الهدف، أو أدخل السعر واضغط تحديث. اسحب الفاصل بجانب الأوامر أو فوق السجل لتغيير حجمهما.</p><p>محدد: شراء بالسعر المحدد أو أقل. وقف شراء: تفعيل فوق السعر الحالي ثم شراء سوق؛ يختلف عن وقف الخسارة.</p><p>الرسوم 0.15% لكل جهة، والانزلاق 0.02% مع احترام سعر الأمر المحدد. فجوة تجعل الوقف أو الهدف غير صالح تُلغي الأمر. عند دخول داخل الدقيقة نحتسب الوقف أولًا ولا نحتسب ربح هدف تلك الدقيقة لعدم معرفة ترتيب الحركة. R = صافي النتيجة ÷ المخاطرة السعرية الأصلية.</p><p>VWAP تقريبي من الشموع المعروضة، واليوم بتوقيت UTC؛ يتغير تقديره حسب الإطار.</p></section>}
      <div className="workspace-grid">
        <nav className="toolrail" aria-label="أدوات الرسم والتحليل"><button className={!drawing ? "rail-active" : ""} onClick={()=>setDrawing(false)} title="المؤشر والتحريك"><Crosshair size={18}/></button><button className={showSessionProfile ? "rail-active" : ""} onClick={()=>setShowSessionProfile(!showSessionProfile)} title="بروفايل سيولة الجلسات اليومية (Session Volume Profile - POC & Value Area)"><Layers size={18}/></button><button className={showVolumeProfile ? "rail-active" : ""} onClick={()=>setShowVolumeProfile(!showVolumeProfile)} title="مناطق الفوليوم وتمركز السيولة (Order Flow Volume Profile)"><BarChart3 size={18}/></button><button onClick={()=>setShowVwap(!showVwap)} className={showVwap ? "rail-active" : ""} title="VWAP تقريبي"><Activity size={18}/></button><button onClick={()=>setIntegrationsOpen(true)} title="مفاتيح الربط والتكامل"><KeyRound size={18}/></button><button onClick={()=>setHelpOpen(!helpOpen)} title="المساعدة"><CircleHelp size={18}/></button></nav>

        <section className="main-stage" ref={stageRef}>
          <IndicatorLibrary
            open={indicatorsOpen}
            onClose={() => setIndicatorsOpen(false)}
            settings={indicators}
            onChange={setIndicators}
            vwap={showVwap}
            onVwap={setShowVwap}
            volume={showVolume}
            onVolume={setShowVolume}
            sessionVolumeProfile={showSessionProfile}
            onSessionVolumeProfile={setShowSessionProfile}
            institutionalConfig={institutionalConfig}
            onInstitutionalChange={(newCfg) => {
              setInstitutionalConfig(newCfg);
              saveInstitutionalChartConfig(newCfg);
            }}
            onOpenInstitutionalSettings={() => setInstitutionalSettingsOpen(true)}
          />
          <InstitutionalSettingsModal
            isOpen={institutionalSettingsOpen}
            onClose={() => setInstitutionalSettingsOpen(false)}
            config={institutionalConfig}
            onChange={(newCfg) => {
              setInstitutionalConfig(newCfg);
              saveInstitutionalChartConfig(newCfg);
            }}
          />
          {/* Single Unified High-End Chart Control Bar */}
          <div className="chart-toolbar">
            <div className="chart-toolbar-left">
              <div className="symbol-meta">
                <span className="market-icon">{SYMBOL_INFO[currentSymbol]?.icon ?? "B"}</span>
                <div>
                  <strong>{SYMBOL_INFO[currentSymbol]?.base ?? currentSymbol.slice(0, -4)}/USDT</strong>
                  <small>{SYMBOL_INFO[currentSymbol]?.arabicName}</small>
                </div>
              </div>

              <div className="view-mode-toggle" role="group" aria-label="وضع الشارت">
                <button
                  type="button"
                  className={chartViewMode === "candles" ? "active" : ""}
                  onClick={() => setChartViewMode("candles")}
                  title="عرض شارت الشموع اليابانية"
                >
                  الشموع
                </button>
                <button
                  type="button"
                  className={chartViewMode === "bookmap" ? "active" : ""}
                  onClick={() => setChartViewMode("bookmap")}
                  title="منصة تدفق الأوامر والفقاعات الحقيقية"
                >
                  Bookmap
                </button>
              </div>

              {/* Session Volume Profile (SVP) Quick Toggle */}
              <button
                type="button"
                className={`svp-mode-btn ${showSessionProfile ? "active" : ""}`}
                onClick={() => setShowSessionProfile((v) => !v)}
                title="تفعيل/إلغاء بروفايل سيولة الجلسات (Session Volume Profile - POC & Value Area 70%) لكل يوم"
              >
                <Layers size={12} />
                <span>بروفايل الجلسات (SVP)</span>
              </button>

              {/* Session Volume Profile Controls (Grouping & Width Scaling) */}
              {showSessionProfile && (
                <div className="svp-controls-strip" role="group" aria-label="إعدادات بروفايل الجلسات">
                  <div className="svp-grouping-selector" title="نطاق تجميع جلسات البروفايل (على اليومي: التلقائي يجمع أسبوعياً لمنع التكدس)">
                    {(
                      [
                        { key: "auto", label: "تلقائي" },
                        { key: "week", label: "أسبوعي" },
                        { key: "month", label: "شهري" },
                        { key: "day", label: "يومي" },
                      ] as const
                    ).map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`svp-cfg-btn ${svpGrouping === item.key ? "selected" : ""}`}
                        onClick={() => setSvpGrouping(item.key)}
                        title={`تجميع البروفايل: ${item.label}`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div className="svp-scale-controls" title="التحكم بعرض بروفايل الجلسة">
                    <button
                      type="button"
                      className="svp-scale-btn"
                      disabled={svpWidthScale <= 0.6}
                      onClick={() => setSvpWidthScale((s) => Math.max(0.6, Number((s - 0.2).toFixed(1))))}
                      title="تضييق عرض البروفايل"
                    >
                      −
                    </button>
                    <span className="svp-scale-label">{(svpWidthScale * 100).toFixed(0)}%</span>
                    <button
                      type="button"
                      className="svp-scale-btn"
                      disabled={svpWidthScale >= 2.0}
                      onClick={() => setSvpWidthScale((s) => Math.min(2.0, Number((s + 0.2).toFixed(1))))}
                      title="توسيع عرض البروفايل"
                    >
                      +
                    </button>
                  </div>
                </div>
              )}

              <span className="toolbar-separator" />

              {/* Dedicated Timeframe Selector Strip */}
              <div className="timeframe-selector-strip" role="group" aria-label="الإطار الزمني">
                {periods.map((period) => (
                  <button
                    key={period.key}
                    type="button"
                    disabled={loading || playing}
                    onClick={() => {
                      setDataReady(false);
                      setCandles([]);
                      setTimeframe(period.key);
                    }}
                    className={`tf-btn ${timeframe === period.key ? "selected" : ""}`}
                    title={`الإطار الزمني ${period.label}`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>

              {/* Spacious Spacing Toggle Pill */}
              <button
                type="button"
                className={`spacing-toggle-pill ${chartSpaciousMode ? "active" : ""}`}
                onClick={toggleSpaciousSpacing}
                title="تبديل تباعد الشموع لمساحة مريحة وواسعة خالية من التكدس لتحليل البروفايل وحجم التداول براحة"
              >
                <span>↔️ {chartSpaciousMode ? "عرض مضغوط" : "مساحة مريحة"}</span>
              </button>

              {/* Instant 1-Click Latest Candle / Session Button */}
              <button
                type="button"
                className={`latest-candle-pill ${isLiveSession ? "is-live" : ""}`}
                disabled={loading || playing}
                onClick={() => void jumpToLatestSession()}
                title="الانتقال المباشر لأحدث شمعة وجلسة حالية للعملة بضغطة زر واحدة دون الحاجة لتحديد التاريخ يدوياً"
              >
                <span className="live-dot" />
                <Zap size={13} />
                <span>{isLiveSession ? "الجلسة اللحظية (مباشر)" : "أحدث شمعة (الآن)"}</span>
              </button>
            </div>

            <div className="chart-toolbar-right">
              {/* Master Clean Chart (Eye) Button */}
              <button
                type="button"
                className={`clean-chart-btn ${cleanChart ? "active" : ""}`}
                onClick={() => setCleanChart((v) => !v)}
                title={cleanChart ? "إظهار كل المؤشرات والصفقات" : "إخفاء كل شيء على الشاشة (شارت نقي)"}
              >
                {cleanChart ? <EyeOff size={13} /> : <Eye size={13} />}
                <span>{cleanChart ? "إظهار الكل" : "شارت نقي"}</span>
              </button>

              {/* Candle Trades Badges Toggle */}
              <button
                type="button"
                className={`toolbar-toggle-btn ${showTradeMarkers ? "active" : ""}`}
                onClick={() => setShowTradeMarkers((v) => !v)}
                title={showTradeMarkers ? "إخفاء الصفقات على الشموع" : "إظهار الصفقات على الشموع"}
              >
                <Check size={12} style={{ opacity: showTradeMarkers ? 1 : 0.3 }} />
                <span>صفقات الشموع</span>
              </button>

              {/* Candle News Pins Toggle */}
              <button
                type="button"
                className={`toolbar-toggle-btn ${showNewsMarkers ? "active" : ""}`}
                onClick={() => setShowNewsMarkers((v) => !v)}
                title={showNewsMarkers ? "إخفاء علامات الأخبار على الشموع" : "إظهار علامات الأخبار على الشموع"}
              >
                <Check size={12} style={{ opacity: showNewsMarkers ? 1 : 0.3 }} />
                <span>أخبار الشموع</span>
              </button>

              {/* Indicators Library */}
              <button
                type="button"
                className="toolbar-btn"
                title="المؤشرات الفنية وأدوات التحليل"
                onClick={() => setIndicatorsOpen(true)}
              >
                <LineChart size={13} />
                <span>المؤشرات</span>
              </button>

              {/* Focus Mode (الشارت والمؤشرات وأدوات التحليل فقط) */}
              <button
                type="button"
                className={`toolbar-btn focus-toggle-btn ${focusMode ? "active" : ""}`}
                onClick={() => setFocusMode((v) => !v)}
                title={focusMode ? "الخروج من وضع التركيز (Esc)" : "وضع التركيز: تكبير الشارت والمؤشرات فقط وإخفاء باقي الأقسام"}
              >
                {focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                <span>{focusMode ? "خروج من التركيز" : "تركيز الشارت"}</span>
              </button>

              {/* Chart Colors & Appearance */}
              <button
                type="button"
                className="toolbar-btn"
                title="تخصيص مظهر وألوان الشارت والشموع"
                onClick={() => setThemeModalOpen(true)}
              >
                <Palette size={13} />
                <span>الألوان</span>
              </button>

              {/* Floating Replay Bar Toggle */}
              <button
                type="button"
                className="toolbar-btn"
                title="شريط Replay العائم"
                aria-pressed={floatingReplay}
                onClick={() => setFloatingReplay((v) => !v)}
              >
                <SkipForward size={13} />
                <span>Replay</span>
              </button>

              {/* Macro News Inspect */}
              <button
                type="button"
                className="toolbar-btn inspect-news"
                disabled={loading || !session || !macro || macro.cursor !== session.cursorTime}
                onClick={() => setInspectNews((v) => v + 1)}
                title="فحص الأحداث الاقتصادية والأخبار لهذه الشمعة"
              >
                <span>الأخبار الماكرو</span>
              </button>

              <span className="toolbar-separator" />

              <details className="chart-options">
                <summary>عرض</summary>
                <div className="chart-options-popover">
                  <button disabled={historyLoading || !historyAvailable || !dataReady || loading} onClick={() => void loadOlder()}>
                    {historyLoading ? "جار تحميل الشموع…" : historyAvailable ? "تحميل 500 شمعة أقدم" : "بداية التاريخ المتاح"}
                  </button>
                  <span className="history-count">{candles.length.toLocaleString("en-US")} شمعة</span>
                  {historyError && <span className="older-error" role="alert">{historyError}</span>}
                  <button onClick={() => zoom(0.8)}>تكبير</button>
                  <button onClick={() => zoom(1.25)}>تصغير</button>
                  <button onClick={() => { followChart.current = true; chartRef.current?.timeScale().scrollToPosition(8, false); }}>آخر شمعة</button>
                  <button onClick={resetView}>ضبط العرض</button>
                </div>
              </details>

              <button
                type="button"
                className="toolbar-btn"
                onClick={() => setLayout((v) => ({ ...v, historyOpen: !v.historyOpen }))}
              >
                {layout.historyOpen ? "طي السجل" : "السجل"}
              </button>

              <button
                type="button"
                className="toolbar-btn"
                title={isFullscreen ? "الخروج من ملء الشاشة" : "ملء الشاشة"}
                onClick={() => void toggleFullscreen()}
              >
                <Maximize2 size={13} />
              </button>
            </div>
          </div>

          {/* Sub-Header Delicate OHLC & Context Strip */}
          <div className="ohlc-strip">
            <span className="ohlc-time">{fmtDate(session?.cursorTime ?? null)}</span>
            {latest && (
              <div className="ohlc-values">
                <span>O <b dir="ltr">{price(latest.open)}</b></span>
                <span>H <b dir="ltr">{price(latest.high)}</b></span>
                <span>L <b dir="ltr">{price(latest.low)}</b></span>
                <span>C <b dir="ltr" className={latest.close >= latest.open ? "positive" : "negative"}>{price(latest.close)}</b></span>
                <span>Vol <b dir="ltr">{money(latest.volume, 2)}</b></span>
                <span className={change >= 0 ? "positive" : "negative"}>({change >= 0 ? "+" : ""}{change.toFixed(2)}%)</span>
              </div>
            )}
            <div className="ohlc-extras">
              {openTrade?.status === 'open' && (
                <button type="button" className="caption-tp-btn" onClick={() => setTpModalOpen(true)} title="إدارة وسحب الأرباح التكتيكية (20% · 50%)">
                  <TrendingUp size={11} /> سحب الأرباح ({(openTrade.takeProfitLevels?.filter(x => !x.filled).length ?? 0)})
                </button>
              )}
              <button onClick={() => setShowVolumeProfile(!showVolumeProfile)} className={showVolumeProfile ? "ohlc-pill active" : "ohlc-pill"} title="مناطق الفوليوم وتمركز السيولة">
                <BarChart3 size={11} /> سيولة
              </button>
              <div className="volume-control-group">
                <button
                  type="button"
                  onClick={() => setShowVolume(!showVolume)}
                  className={showVolume ? "ohlc-pill active" : "ohlc-pill"}
                  title="إظهار / إخفاء مؤشر حجم التداول"
                >
                  حجم
                </button>
                {showVolume && (
                  <div className="volume-scale-strip" title="تزويم وتحكم مستقل في ارتفاع حجم التداول">
                    <button
                      type="button"
                      className="vol-step-btn"
                      onClick={() => setVolumeScale((v) => Math.min(0.94, Number((v + 0.05).toFixed(2))))}
                      title="تصغير ارتفاع مؤشر الحجم"
                      disabled={volumeScale >= 0.94}
                    >
                      −
                    </button>
                    <span
                      className="vol-scale-label"
                      suppressHydrationWarning
                      title="نسبة ارتفاع مؤشر الحجم من الشارت (انقر للتبديل بين 15%، 30%، 45%)"
                      onClick={() => {
                        setVolumeScale((v) => {
                          if (v <= 0.6) return 0.85; // 15%
                          if (v <= 0.75) return 0.55; // 45%
                          return 0.70; // 30%
                        });
                      }}
                    >
                      {Math.round((1 - volumeScale) * 100)}%
                    </span>
                    <button
                      type="button"
                      className="vol-step-btn"
                      onClick={() => setVolumeScale((v) => Math.max(0.45, Number((v - 0.05).toFixed(2))))}
                      title="تكبير ارتفاع مؤشر الحجم لمساحة أوسع"
                      disabled={volumeScale <= 0.45}
                    >
                      +
                    </button>
                  </div>
                )}
              </div>
              {showVwap && <span className="vwap-key"><i /> VWAP</span>}
            </div>
          </div>

          <div className="chart-area" style={{ display: chartViewMode === "candles" ? "flex" : "none" }}>
            {focusMode && (
              <div className="focus-mode-exit-pill" role="status" aria-live="polite">
                <span>وضع التركيز (الشارت ومؤشرات التحليل فقط)</span>
                <button
                  type="button"
                  onClick={() => setFocusMode(false)}
                  title="الخروج من وضع التركيز (Esc)"
                >
                  <Minimize2 size={13} />
                  <span>خروج (Esc)</span>
                </button>
              </div>
            )}

            {/* Proactive Pre-News Alert Banner (Before News Candle Arrives) */}
            {upcomingMacro && (
              <div
                className="chart-pre-news-pill"
                onClick={() => setInspectNews((v) => v + 1)}
                title="ترقب حدث اقتصادي كبرى - انقر لعرض التحليل والسيناريوهات"
                role="button"
                tabIndex={0}
              >
                <span className="pill-dot" />
                <span className="pill-title">⚠️ ترقب: {upcomingMacro.event.title}</span>
                <span className="pill-time">
                  بعد {upcomingMacro.diffBars} {upcomingMacro.diffBars === 1 ? "شمعة" : "شموع"} ({upcomingMacro.diffMins} دقيقة)
                </span>
                <span className="pill-badge">فحص الأثر ↗</span>
              </div>
            )}

            {/* On-Chart Quick Trading HUD */}
            <div className="onchart-quick-hud" role="region" aria-label="أدوات الدخول والتداول السريع على الشارت">
              {!quickDraft ? (
                <div className="hud-buttons-row">
                  <button
                    type="button"
                    className="hud-trade-btn hud-buy"
                    disabled={confirming || !session || !dataReady || availableCash < 10}
                    onClick={() => void quickOrder("long")}
                    title="شراء فوري أو إعداد صفقة صعود (Long) على الشارت"
                  >
                    <span className="hud-badge buy">شراء L</span>
                    <b className="hud-price" dir="ltr">{latest ? price(latest.close) : "—"}</b>
                  </button>

                  <button
                    type="button"
                    className="hud-trade-btn hud-setup"
                    disabled={confirming || !session || !dataReady || availableCash < 10}
                    onClick={() => void quickOrder(side || "long")}
                    title="إسقاط إعداد الصفقة والهدف والوقف على الشارت مباشرة"
                  >
                    <Target size={12} />
                    <span>إعداد صفقة 🎯</span>
                  </button>

                  <button
                    type="button"
                    className="hud-trade-btn hud-sell"
                    disabled={confirming || !session || !dataReady || availableCash < 10}
                    onClick={() => void quickOrder("short")}
                    title="بيع فوري أو إعداد صفقة هبوط (Short) على الشارت"
                  >
                    <span className="hud-badge sell">بيع S</span>
                    <b className="hud-price" dir="ltr">{latest ? price(latest.close) : "—"}</b>
                  </button>
                </div>
              ) : (
                <div className="hud-draft-active-bar">
                  <span className={`hud-draft-side ${quickDraft.side}`}>
                    {quickDraft.side === "long" ? "📈 مسودة شراء L" : "📉 مسودة بيع S"}
                  </span>
                  <span className="hud-draft-amount">{money(quickDraft.amount)} USDT</span>
                  <button
                    type="button"
                    className="hud-draft-confirm-btn"
                    disabled={confirming}
                    onClick={() => void submitLong()}
                    title="تأكيد ودخول الصفقة فوراً"
                  >
                    {confirming ? "جار الدخول…" : "دخول الصفقة ✓"}
                  </button>
                  <button
                    type="button"
                    className="hud-draft-cancel-btn"
                    disabled={confirming}
                    onClick={cancelDraft}
                    title="إلغاء الإعداد"
                  >
                    ✕
                  </button>
                </div>
              )}

              {/* Active Trades Strip (when 1 or more trades are open or pending) */}
              {activeTrades.length > 0 && (
                <div className="hud-active-trades-strip" role="group" aria-label="الصفقات المفتوحة حالياً">
                  <div className="hud-trades-scroll">
                    {activeTrades.map((t) => {
                      const isSelected = selectedTrade?.id === t.id;
                      const isShort = t.side === "short";
                      const currentP = latest?.close ?? t.entryPrice ?? t.orderPrice ?? 0;
                      const refP = t.entryPrice ?? t.orderPrice ?? currentP;
                      const pnlPct = refP > 0 ? ((currentP - refP) / refP) * 100 * (isShort ? -1 : 1) : 0;
                      const pnlUsdt = t.entryPrice ? (t.remainingQuantity ?? t.quantity ?? 0) * (currentP - t.entryPrice) * (isShort ? -1 : 1) : 0;
                      const isPending = t.status === "pending";

                      return (
                        <div
                          key={t.id}
                          className={`hud-trade-chip ${isSelected ? "selected" : ""} ${t.side}`}
                          onClick={() => setSelectedTradeId(t.id)}
                          title={`صفقة ${isShort ? "بيع Short" : "شراء Long"} · انقر للتركيز عليها وتعديل أهدافها`}
                        >
                          <span className={`chip-badge ${t.side}`}>
                            {isShort ? "S" : "L"}
                          </span>
                          <span className="chip-size">{money(t.notional)}$</span>
                          {!isPending ? (
                            <span className={`chip-pnl ${pnlUsdt >= 0 ? "pos" : "neg"}`} dir="ltr">
                              {pnlUsdt >= 0 ? "+" : ""}{money(pnlUsdt)}$ ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                            </span>
                          ) : (
                            <span className="chip-pnl pending">معلق</span>
                          )}

                          {t.status === "open" && (
                            <button
                              type="button"
                              className="chip-scale-btn"
                              disabled={loading || availableCash < 5}
                              onClick={(e) => {
                                e.stopPropagation();
                                setScaleInTrade(t);
                                setScaleInAmount(String(Math.min(t.notional, Math.max(50, Math.floor(availableCash)))));
                              }}
                              title="تعزيز الصفقة وزيادة اللوت / المبلغ"
                            >
                              + تعزيز
                            </button>
                          )}

                          <button
                            type="button"
                            className="chip-close-btn"
                            disabled={loading}
                            onClick={(e) => {
                              e.stopPropagation();
                              void act({ action: isPending ? "cancel" : "close", tradeId: t.id });
                            }}
                            title={isPending ? "إلغاء هذا الأمر فوراً" : "إغلاق هذه الصفقة فوراً"}
                          >
                            ✕
                          </button>
                        </div>
                      );
                    })}
                  </div>

                  {activeTrades.length > 1 && (
                    <button
                      type="button"
                      className="hud-close-all-btn"
                      disabled={loading}
                      onClick={() => {
                        if (window.confirm("هل تريد إغلاق جميع الصفقات المفتوحة فوراً؟")) {
                          void act({ action: "close", all: true });
                        }
                      }}
                      title="إغلاق جميع الصفقات المفتوحة دفعة واحدة"
                    >
                      إغلاق الكل ({activeTrades.length}) ✕
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className={`chart-host ${drawing ? "drawing-mode" : ""} ${selectReplayPoint ? "select-replay-mode" : ""}`} ref={chartHost} onWheel={()=>{followChart.current=false;}}>
              {floatingReplay&&<FloatingReplay playing={playing} disabled={!session||!dataReady} speed={replaySpeed} time={fmtDate(session?.cursorTime??null)} selecting={selectReplayPoint} onToggle={()=>{if(playing)stopPlaying();else{playingRef.current=true;setPlaying(true);}}} onStep={()=>{stopPlaying();void advanceStep(1,"bar");}} onSpeed={setReplaySpeed} onClose={()=>setFloatingReplay(false)} onLatest={()=>{followChart.current=true;chartRef.current?.timeScale().scrollToPosition(32,false);}} onSelect={()=>{stopPlaying();setSelectReplayPoint(v=>!v);}}/>}
              {!cleanChart && <InstitutionalChartOverlay chart={chartRef} series={candleSeries} candles={candles} config={institutionalConfig} currentPrice={latest?.close ?? 0}/>}
              <VolumeProfileOverlay chart={chartRef} series={candleSeries} candles={candles} visible={!cleanChart && showVolumeProfile} buyColor={chartTheme.upColor} sellColor={chartTheme.downColor}/>
              <SessionProfileOverlay
                chart={chartRef}
                series={candleSeries}
                candles={candles}
                timeframe={timeframe}
                visible={!cleanChart && showSessionProfile}
                grouping={svpGrouping}
                widthScale={svpWidthScale}
              />
              <InstitutionalHud
                currentPrice={latest?.close ?? 0}
                candles={candles}
                open={institutionalHudOpen}
                onToggle={() => setInstitutionalHudOpen(!institutionalHudOpen)}
                onOpenSettings={() => setIntegrationsOpen(true)}
                config={institutionalConfig}
                onChangeConfig={(newCfg) => { setInstitutionalConfig(newCfg); saveInstitutionalChartConfig(newCfg); }}
                onOpenChartSettings={() => setInstitutionalSettingsOpen(true)}
                showTradeMarkers={showTradeMarkers}
                onToggleTradeMarkers={() => setShowTradeMarkers(v => !v)}
                cleanChart={cleanChart}
                onToggleCleanChart={() => setCleanChart(v => !v)}
              />
              <ChartTradeMarkers chart={chartRef} series={candleSeries} candles={candles} trades={displayedTrades} onOpenReflection={trade=>setReflectionModalTrade(trade)} visible={!cleanChart && showTradeMarkers}/>
              {!cleanChart && <ChartDrawings key={`${currentSymbol}-${session?.id}`} chart={chartRef} series={candleSeries} candles={candles} storageKey={`replay-drawings-${currentSymbol}-${session?.id}`} onActive={drawingActive}/>}
              {!cleanChart && (activeRiskTrade || quickDraft) && latest && expectedEntry > 0 && (
                <RiskRewardOverlay
                  chart={chartRef}
                  series={candleSeries}
                  levels={riskLinesRef}
                  side={selectedSide}
                  entry={expectedEntry}
                  time={Math.floor(((activeRiskTrade?.entryTime ?? latest.openTime)) / ({"1m":60000,"5m":300000,"15m":900000,"1h":3600000,"4h":14400000,"1d":86400000}[timeframe])) * ({"1m":60000,"5m":300000,"15m":900000,"1h":3600000,"4h":14400000,"1d":86400000}[timeframe])}
                  amount={orderAmount}
                  status={quickDraft ? "معاينة — اسحب وعدل بحرية" : activeRiskTrade?.status === "pending" ? "معلق للدقيقة التالية" : activeRiskTrade?.status === "close_pending" ? "إغلاق معلق" : "مفتوحة"}
                  quantity={activeRiskTrade?.remainingQuantity ?? activeRiskTrade?.quantity}
                  fee={activeRiskTrade?.entryPrice && activeRiskTrade.quantity ? activeRiskTrade.entryFee * (activeRiskTrade.remainingQuantity ?? activeRiskTrade.quantity) / activeRiskTrade.quantity : undefined}
                  orderType={activeRiskTrade?.orderType ?? orderType}
                  filled={!!activeRiskTrade?.entryPrice}
                  openTrade={activeRiskTrade}
                  onAddPartialTp={handleAddPartialTp}
                  onRemovePartialTp={handleRemovePartialTp}
                  onCyclePartialTp={handleCyclePartialTp}
                />
              )}
              {loading && candles.length === 0 ? <div className="chart-empty chart-loading"><span className="loading-spinner"><Activity size={18} /></span><strong>جار استعادة الجلسة والشموع</strong><span>نحمّل بيانات السوق حتى نقطة Replay المحفوظة.</span></div> : (!session || candles.length === 0) && <div className="chart-empty"><div className="empty-icon"><CalendarDays size={21} /></div><strong>{session ? "لا توجد شموع لهذه الفترة" : "اختر لحظة تاريخية وابدأ التدريب"}</strong><span>{session ? "قد لا تتوفر بيانات Binance لهذا الأصل والتاريخ. اختر تاريخًا ضمن فترة تداول الأصل." : "ستظهر الشموع تدريجيًا مع تحريك Replay، دون كشف بيانات لاحقة."}</span>{!session && <button onClick={() => void startReplay()} disabled={loading}><Play size={14} fill="currentColor" /> ابدأ Replay</button>}</div>}
              {selectReplayPoint && <span className="drawing-tip">انقر شمعة للبداية من موضعها · اضغط الزر مجددًا للإلغاء</span>}
              {drawing && <span className="drawing-tip">انقر على الشارت لإضافة مستوى سعري</span>}
            </div>
            <div className="chart-footer">
              <span>
                <span className="legend-candle" style={{ background: chartTheme.upColor, borderColor: chartTheme.upBorderColor }} /> صاعد
                <span className="legend-candle" style={{ background: chartTheme.downColor, borderColor: chartTheme.downBorderColor }} /> هابط
              </span>
              <button
                type="button"
                className="footer-theme-link"
                onClick={() => setThemeModalOpen(true)}
                title="تخصيص مظهر وألوان الشارت والشموع"
              >
                <Palette size={11} />
                <span>المظهر: {chartTheme.name.split(" ")[0]}</span>
              </button>
              <span>TradingView Lightweight Charts™</span>
              <span className="timezone">التوقيت المحلي <ChevronDown size={12} /></span>
            </div>
          </div>

          {chartViewMode === "bookmap" && (
            <div style={{ flex: 1, minHeight: 480, position: "relative", display: "flex", flexDirection: "column" }}>
              <BookmapView
                candles={candles}
                symbol={currentSymbol}
                timeframe={timeframe}
                currentPrice={latest?.close ?? 0}
                openTrade={openTrade}
                onBackToCandles={() => setChartViewMode("candles")}
              />
            </div>
          )}

          <section className="replay-panel">
            <MacroPanel key={session?.id} data={macro} cursor={session?.cursorTime??0} sessionId={session?.id} inspectRequest={inspectNews} onEvents={setArchiveEvents}/>
            <div className="replay-title"><strong>إعادة تشغيل السوق</strong><span className="replay-status" role="status">{loading ? "جار التحميل…" : !dataReady ? "بانتظار البيانات" : playing ? "قيد التشغيل" : "متوقف مؤقتًا"}</span><b className="cursor-time">{fmtDate(session?.cursorTime ?? null)}</b></div>
            <div className="replay-controls"><button className="play-button" onClick={()=>{if(playing)stopPlaying();else {playingRef.current=true;setPlaying(true);}}} disabled={!playing && (!session || !dataReady)} aria-label={playing?"إيقاف مؤقت":"تشغيل Replay"}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?"إيقاف مؤقت":"تشغيل"}</button><button className="step-button" onClick={()=>{stopPlaying();void advanceStep(1,"bar");}} disabled={loading || !session || !dataReady} title="تقدم شمعة واحدة حسب الفريم المختار"><SkipForward size={16}/> الشمعة التالية</button><label>السرعة <select aria-label="سرعة التشغيل" value={replaySpeed} onChange={e=>setReplaySpeed(Number(e.target.value))}>{[1,2,4,8,16,32,64].map(v=><option key={v} value={v}>{v}×</option>)}</select></label><button className="seek-chart" disabled={!session||!dataReady} aria-pressed={selectReplayPoint} onClick={()=>{stopPlaying();setSelectReplayPoint(v=>!v);}}>{selectReplayPoint?"اختر شمعة من الشارت…":"ابدأ من الشارت"}</button><button type="button" className={`replay-latest-btn ${isLiveSession ? "active" : ""}`} disabled={loading} onClick={() => void jumpToLatestSession()} title="بدء الجلسة فوراً عند أحدث شمعة حالية في السوق بدون تحديد التاريخ"><Zap size={15}/> أحدث شمعة (الآن)</button><div className="replay-ticket"><label>مبلغ الدخول <input aria-label="مبلغ الدخول السريع USDT" type="number" min="1" step="0.01" value={notional} onChange={e=>setNotional(e.target.value)}/><span>USDT</span></label><button className="quick-long" aria-label="معاينة شراء" title="معاينة شراء قبل التأكيد" disabled={!dataReady||!session||availableCash<10} onClick={()=>void quickOrder("long")}><ArrowUpRight size={20}/> شراء</button>{quickDraft&&<><button className="quick-long" disabled={confirming} onClick={()=>void submitLong()}>{confirming?"جار تأكيد الدخول…":"تأكيد الدخول"}</button><button disabled={confirming} onClick={cancelDraft}>إلغاء المعاينة</button></>}{selectedTrade?.status==="pending"&&<button disabled={loading} onClick={()=>void act({action:"cancel", tradeId: selectedTrade.id})}>إلغاء الأمر</button>}<button className="ticket-open" onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();setLayout(v=>({...v,orderOpen:!v.orderOpen}));}}>{activeTrades.length > 0 ? `الصفقات (${activeTrades.length})` : 'إعداد الصفقة'}</button>{selectedTrade?.status==='open'&&<button disabled={loading} onClick={()=>void act({action:"close", tradeId: selectedTrade.id})}>إغلاق الصفقة</button>}{selectedTrade?.status==='open' && (<><button type="button" className="ticket-scale-btn" disabled={loading || availableCash < 5} onClick={() => { setScaleInTrade(selectedTrade); setScaleInAmount(String(Math.min(selectedTrade.notional, Math.max(50, Math.floor(availableCash))))); }} title="تعزيز الصفقة وزيادة اللوت">+ تعزيز</button><button type="button" className="ticket-tp-quick-btn" onClick={() => void handleAddPartialTp(20)} title="إضافة هدف لسحب 20% مباشرة على الشارت">+20% ربح</button><button type="button" className="ticket-tp-quick-btn" onClick={() => void handleAddPartialTp(50)} title="إضافة هدف لسحب 50% مباشرة على الشارت">+50% ربح</button><button type="button" className="ticket-tp-btn" onClick={() => setTpModalOpen(true)} title="أداة سحب الأرباح التكتيكية"><TrendingUp size={15} /> 🎯 سحب الأرباح {(selectedTrade.takeProfitLevels?.filter(x => !x.filled).length ?? 0) > 0 && (<b className="tp-count-pill">{selectedTrade.takeProfitLevels!.filter(x => !x.filled).length}</b>)}</button></>)}{activeTrades.length > 1 && (<button type="button" className="ticket-close-all-btn" disabled={loading} onClick={() => { if (window.confirm("هل تريد إغلاق جميع الصفقات المفتوحة فوراً؟")) { void act({ action: "close", all: true }); } }}>إغلاق الكل ({activeTrades.length})</button>)}<button onClick={()=>{if(document.fullscreenElement)void document.exitFullscreen();setLayout(v=>({...v,orderOpen:true}));setStatsOpen(true);}}>الأداء</button></div></div>
            <details className="replay-session"><summary>التاريخ · جلسة جديدة</summary><div className="replay-date"><div className="replay-quick-now-banner"><button type="button" className="btn-jump-now" disabled={loading} onClick={() => void jumpToLatestSession()} title="تخطي التاريخ والوقت والبدء فوراً من أحدث شمعة في السوق بضغطة زر واحدة"><Zap size={14} /> <strong>الانتقال فوراً لأحدث شمعة حالية (الآن)</strong></button><span className="quick-now-desc">تجاوز اختيار التاريخ والوقت يدوياً والذهاب لآخر شمعة مباشرة</span></div><div className="replay-date-or"><span>أو حدد تاريخًا ووقتًا يدويًا للبداية:</span></div><label className="date-input-wrap"><small>تاريخ الجلسة الجديدة</small><input type="date" aria-label="تاريخ بداية Replay" value={startDate.slice(0,10)} max={dateTimeInputValue(Date.now()).slice(0,10)} onChange={e=>updateStartDatePart("date",e.target.value)}/></label><label className="date-input-wrap time-input-wrap"><small>الوقت المحلي</small><input type="time" aria-label="وقت بداية Replay" step={60} value={startDate.slice(11,16)} onChange={e=>updateStartDatePart("time",e.target.value)}/></label><button onClick={()=>void startReplay()} disabled={loading}>جلسة جديدة بالتاريخ المختار · {SYMBOL_INFO[symbol]?.base ?? symbol.slice(0,-4)}</button></div></details>
            <details className="replay-guide"><summary>كيف تعمل المحاكاة؟</summary><p className="replay-explanation">{replaySpeed>=16 ? "تسريع الوقت: تُتجاوز فرص القرار بين الدقائق. " : ""}الخطوة = شمعة حسب الفريم؛ التشغيل المتواصل بالدقائق. شمعة {periods.find(p=>p.key===timeframe)?.label} تتحدّث حتى يكتمل إطارها.</p></details>
            {error && <div className="replay-error" role="alert"><span>{error}</span><button disabled={loading} onClick={()=>void load(true)}>إعادة تحميل الجلسة</button></div>}
          </section>

          {openTrade?.status === "open" && tpModalOpen && (
            <StopLevelEditor
              trade={openTrade}
              busy={loading}
              modal={true}
              isOpen={tpModalOpen}
              onClose={() => setTpModalOpen(false)}
              onSaveStops={(levels) => act({ action: "stops", tradeId: openTrade.id, levels })}
              onSaveTakeProfits={(levels) => act({ action: "takeProfits", tradeId: openTrade.id, levels })}
            />
          )}

          {scaleInTrade && latest && (
            <div className="scale-in-modal-backdrop" onClick={() => setScaleInTrade(null)}>
              <div className="scale-in-modal" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <div className="modal-title-row">
                    <TrendingUp size={18} className="modal-icon" />
                    <h3>تعزيز الصفقة وزيادة اللوت (Scale-In)</h3>
                  </div>
                  <button
                    type="button"
                    className="modal-close-btn"
                    onClick={() => setScaleInTrade(null)}
                    title="إغلاق"
                  >
                    ✕
                  </button>
                </div>

                <div className="scale-trade-summary">
                  <div className="summary-col">
                    <span className="summary-label">نوع الصفقة</span>
                    <b className={`summary-side ${scaleInTrade.side}`}>
                      {scaleInTrade.side === "long" ? "🟢 شراء (Long)" : "🔴 بيع (Short)"}
                    </b>
                  </div>
                  <div className="summary-col">
                    <span className="summary-label">سعر الدخول الحالي</span>
                    <b dir="ltr">${price(scaleInTrade.entryPrice ?? scaleInTrade.orderPrice ?? 0)}</b>
                  </div>
                  <div className="summary-col">
                    <span className="summary-label">السعر اللحظي الآن</span>
                    <b dir="ltr">${price(latest.close)}</b>
                  </div>
                  <div className="summary-col">
                    <span className="summary-label">حجم الصفقة الحالي</span>
                    <b dir="ltr">{money(scaleInTrade.notional)} USDT</b>
                  </div>
                </div>

                <div className="scale-input-section">
                  <label htmlFor="scale-amount-input">
                    <span>مبلغ التعزيز الإضافي (USDT)</span>
                    <small>الرصيد المتاح: <b dir="ltr">{money(availableCash)} USDT</b></small>
                  </label>
                  <div className="scale-input-wrap">
                    <input
                      id="scale-amount-input"
                      type="number"
                      min="1"
                      max={availableCash}
                      step="10"
                      value={scaleInAmount}
                      onChange={(e) => setScaleInAmount(e.target.value)}
                      autoFocus
                    />
                    <span className="unit">USDT</span>
                  </div>

                  <div className="scale-presets">
                    {[25, 50, 100].map((pct) => {
                      const addVal = Math.min(Math.floor(availableCash / (1 + FEE_RATE)), Math.round(scaleInTrade.notional * (pct / 100)));
                      return (
                        <button
                          key={pct}
                          type="button"
                          className="scale-preset-btn"
                          disabled={addVal <= 0 || addVal * (1 + FEE_RATE) > availableCash}
                          onClick={() => setScaleInAmount(String(addVal))}
                        >
                          +{pct}% ({addVal}$)
                        </button>
                      );
                    })}
                    {[100, 250, 500].map((fixVal) => (
                      <button
                        key={fixVal}
                        type="button"
                        className="scale-preset-btn"
                        disabled={fixVal * (1 + FEE_RATE) > availableCash}
                        onClick={() => setScaleInAmount(String(fixVal))}
                      >
                        +{fixVal}$
                      </button>
                    ))}
                    <button
                      type="button"
                      className="scale-preset-btn max"
                      disabled={availableCash < 5}
                      onClick={() => setScaleInAmount(String(Math.floor(availableCash / (1 + FEE_RATE))))}
                    >
                      أقصى متاح
                    </button>
                  </div>
                </div>

                {(() => {
                  const added = Number(scaleInAmount) || 0;
                  const sign = scaleInTrade.side === "short" ? -1 : 1;
                  const estFill = latest.close * (1 + sign * 0.0002);
                  const addedQty = added > 0 ? added / estFill : 0;
                  const oldQty = scaleInTrade.remainingQuantity ?? scaleInTrade.quantity ?? (scaleInTrade.notional / (scaleInTrade.entryPrice ?? latest.close));
                  const newTotalQty = oldQty + addedQty;
                  const newWeightedEntry = newTotalQty > 0
                    ? ((scaleInTrade.entryPrice ?? latest.close) * oldQty + estFill * addedQty) / newTotalQty
                    : (scaleInTrade.entryPrice ?? latest.close);
                  const totalNotional = scaleInTrade.notional + added;
                  const fee = added * FEE_RATE;
                  const isExceeding = (added * (1 + FEE_RATE)) > availableCash;
                  const isValid = added > 0 && !isExceeding;

                  return (
                    <div className="scale-simulation-box">
                      <div className="sim-row">
                        <span>متوسط سعر الدخول الجديد المتوقع:</span>
                        <div className="sim-entry-val">
                          <span className="old-entry">${price(scaleInTrade.entryPrice ?? 0)}</span>
                          <span className="arrow">←</span>
                          <b className="new-entry" dir="ltr">${price(newWeightedEntry)}</b>
                        </div>
                      </div>
                      <div className="sim-row">
                        <span>إجمالي حجم الصفقة بعد التعزيز:</span>
                        <b dir="ltr">{money(totalNotional)} USDT</b>
                      </div>
                      <div className="sim-row">
                        <span>رسوم التنفيذ المقدرة (0.15%):</span>
                        <span dir="ltr">~{money(fee)} USDT</span>
                      </div>
                      {isExceeding && (
                        <p className="scale-error-msg">⚠️ المبلغ يتجاوز الرصيد المتاح مع الرسوم ({money(availableCash)} USDT).</p>
                      )}

                      <div className="modal-actions-row">
                        <button
                          type="button"
                          className="scale-cancel-btn"
                          onClick={() => setScaleInTrade(null)}
                        >
                          إلغاء
                        </button>
                        <button
                          type="button"
                          className="scale-submit-btn"
                          disabled={!isValid || loading}
                          onClick={async () => {
                            const ok = await act({
                              action: "scale_in",
                              tradeId: scaleInTrade.id,
                              amount: added,
                            });
                            if (ok) {
                              setScaleInTrade(null);
                            }
                          }}
                        >
                          {loading ? "جار التنفيذ…" : `تأكيد التعزيز (+${money(added)} USDT)`}
                        </button>
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          <div className="history-resizer" role="separator" tabIndex={0} aria-label="تغيير ارتفاع السجل" aria-orientation="horizontal" aria-valuemin={100} aria-valuemax={300} aria-valuenow={layout.height} onPointerDown={e=>resizeStart(e,"history")} onPointerMove={resizeMove} onPointerUp={()=>{resizeRef.current=null;}} onPointerCancel={()=>{resizeRef.current=null;}} onKeyDown={e=>{if(e.key==="ArrowUp"||e.key==="ArrowDown") {e.preventDefault();setLayout(v=>({...v,height:Math.max(100,Math.min(300,v.height+(e.key==="ArrowUp"?20:-20)))}));}}}/>
          <section className="history-panel"><div className="history-head"><div className="history-tabs"><button onClick={() => { setTab("trades"); setHistoryScope("current"); }} className={tab === "trades" && historyScope === "current" ? "active" : ""}>صفقات الجلسة <span>{sessionTrades.length}</span></button><button onClick={() => { setTab("trades"); setHistoryScope("all"); }} className={tab === "trades" && historyScope === "all" ? "active" : ""}>كل الصفقات <span>{workspace.trades.length}</span></button><button onClick={() => setTab("journal")} className={tab === "journal" ? "active" : ""}><BookOpenCheck size={14} /> دفتر التداول والتحليل</button></div><div style={{ display: "flex", alignItems: "center", gap: "8px" }}>{workspace.sessions.length > 1 && (<select className="session-selector" value={workspace.activeSessionId ?? ""} onChange={(e) => void selectSession(e.target.value)} style={{ background: "#162330", color: "#b4d0ef", border: "1px solid #314a66", borderRadius: "4px", fontSize: "11px", padding: "3px 6px", cursor: "pointer", maxWidth: "240px" }} title="التنقل إلى جلسة سابقة">{workspace.sessions.map((s, idx) => { const count = workspace.trades.filter(t => t.sessionId === s.id).length; return (<option key={s.id} value={s.id}>جلسة {workspace.sessions.length - idx} ({s.symbol.slice(0, -4)} · {new Date(s.startTime).toLocaleDateString("ar")} · {count} صفقات)</option>); })}</select>)}<button className="export-button" onClick={()=>{const blob=new Blob([JSON.stringify(workspace,null,2)],{type:"application/json"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download="replay-journal.json";link.click();URL.revokeObjectURL(url);}}>تنزيل السجل</button>{displayedTrades.length > 0 && (<button className="export-button" style={{ background: "#261618", borderColor: "#4d2327", color: "#fca5a5" }} onClick={() => { const scopeLabel = historyScope === "all" ? "جميع الصفقات في كل الجلسات" : "صفقات هذه الجلسة"; if (window.confirm(`هل أنت متأكد من مسح ${scopeLabel}؟ لا يمكن التراجع عن هذا الإجراء.`)) { void act({ action: "clearTrades", scope: historyScope }); } }} title="مسح الصفقات"><Trash2 size={12} style={{ display: "inline-block", verticalAlign: "middle", marginLeft: "4px" }} />{historyScope === "all" ? "مسح كل الصفقات" : "مسح صفقات الجلسة"}</button>)}</div></div>{tab === "trades" ? <div className="table-wrap"><table><thead><tr><th>الأصل</th><th>النوع</th><th>الدخول</th><th>الخروج</th><th>مبلغ الدخول</th><th>ربح السعر (إجمالي)</th><th>الرسوم المخصومة</th><th>الصافي النهائي</th><th>التقييم</th><th>الحالة</th><th>الوقت</th><th>حذف</th></tr></thead><tbody>{displayedTrades.length ? displayedTrades.slice().reverse().map((trade) => { const totalFees = (trade.entryFee ?? 0) + (trade.exitFee ?? 0); const grossPnl = trade.status === "closed" ? trade.realizedPnl + totalFees : 0; const pricePct = trade.entryPrice && trade.exitPrice && trade.entryPrice > 0 ? ((trade.exitPrice - trade.entryPrice) / trade.entryPrice) * 100 * (trade.side === "short" ? -1 : 1) : 0; return (<tr key={trade.id}><td><span className="tiny-coin">{SYMBOL_INFO[trade.symbol as SymbolName]?.icon ?? "🪙"}</span>{trade.symbol.slice(0, -4)}/USDT</td><td><span className={trade.side==="short"?"negative":"positive"}>{trade.side==="short"?"بيع":"شراء"} {orderLabels[trade.orderType ?? "market"]}</span></td><td>{trade.entryPrice ? price(trade.entryPrice) : trade.orderPrice ? price(trade.orderPrice) : "الافتتاح التالي"}</td><td>{trade.exitPrice ? price(trade.exitPrice) : "—"}</td><td>{money(trade.notional)} USDT</td><td className={grossPnl >= 0 ? "positive" : "negative"} title={`حركة السعر الصافية بدون رسوم: ${pricePct >= 0 ? "+" : ""}${pricePct.toFixed(2)}%`}>{trade.status === "closed" ? `${grossPnl >= 0 ? "+" : ""}${money(grossPnl)} USDT (${pricePct >= 0 ? "+" : ""}${pricePct.toFixed(2)}%)` : "—"}</td><td style={{ color: "#f87171" }} title={`رسوم الدخول: ${money(trade.entryFee ?? 0)}$ · رسوم الخروج: ${money(trade.exitFee ?? 0)}$`}>{trade.status === "closed" ? (totalFees > 0 ? `-${money(totalFees)} USDT` : "0.00 USDT") : "—"}</td><td className={trade.realizedPnl >= 0 ? "positive" : "negative"} style={{ fontWeight: "bold" }} title="الصافي المحقق المضاف للمحفظة بعد خصم الرسوم">{trade.status === "closed" ? `${trade.realizedPnl >= 0 ? "+" : ""}${money(trade.realizedPnl)} USDT` : "—"}</td><td><button onClick={()=>setReflectionModalTrade(trade)} style={{cursor:"pointer",border:"1px solid #374b60",background:"#162332",color:"#b5d4f4",borderRadius:"4px",padding:"2px 6px",fontSize:"10px"}} title="تحليل الدخول">{trade.reflection?.setupGrade ?? "تقييم"} {trade.reflection?.audioNote ? "🎙️" : ""}</button></td><td><span className={`status-pill ${trade.status}`}>{trade.status === "pending" ? "معلق" : trade.status === "open" ? "مفتوح" : trade.status === "close_pending" ? "إغلاق معلّق" : trade.status === "closed" ? "مغلق" : "ملغى"}</span></td><td>{fmtDate(trade.entryTime ?? trade.createdAt)}</td><td><button onClick={() => { if (window.confirm("حذف هذه الصفقة من السجل؟")) { void act({ action: "deleteTrade", tradeId: trade.id }); } }} style={{ cursor: "pointer", border: "1px solid #4a282b", background: "#281719", color: "#f87171", borderRadius: "4px", padding: "2px 5px", display: "inline-flex", alignItems: "center", justifyContent: "center" }} title="حذف الصفقة من السجل"><Trash2 size={12} /></button></td></tr>); }) : <tr><td colSpan={12} className="table-empty">{historyScope === "all" ? "لا توجد صفقات في السجل بعد. استخدم لوحة الأوامر للتدرب." : "لا توجد صفقات في هذه الجلسة بعد. انقر على 'كل الصفقات' لعرض صفقات الجلسات السابقة."}</td></tr>}</tbody></table></div> : <div className="journal-list">{displayedTrades.length ? displayedTrades.slice().reverse().map((trade) => { const totalFees = (trade.entryFee ?? 0) + (trade.exitFee ?? 0); const grossPnl = trade.status === "closed" ? trade.realizedPnl + totalFees : 0; return (<article key={trade.id} style={{padding:"12px",marginBottom:"10px",background:"#141c26",border:"1px solid #283748",borderRadius:"8px"}}><div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"6px"}}><div style={{display:"flex",alignItems:"center",gap:"8px",flexWrap:"wrap"}}><BookOpenCheck size={14} /><span>{fmtDate(trade.entryTime ?? trade.createdAt)}</span><b className={trade.realizedPnl >= 0 ? "positive" : "negative"}>{trade.status === "closed" ? `${trade.realizedPnl >= 0 ? "+" : ""}${money(trade.realizedPnl)} USDT صافي` : "قيد المتابعة"}</b>{trade.status === "closed" && (<span style={{ fontSize: "11px", color: "#8fa3b7", background: "#162332", padding: "1px 7px", borderRadius: "4px", border: "1px solid #283748" }}>ربح حركة السعر: <b className={grossPnl >= 0 ? "positive" : "negative"}>{grossPnl >= 0 ? "+" : ""}{money(grossPnl)}$</b> · الرسوم: <b style={{ color: "#f87171" }}>-{money(totalFees)}$</b></span>)}</div><div style={{ display: "flex", alignItems: "center", gap: "6px" }}><button onClick={()=>setReflectionModalTrade(trade)} style={{background:"#1d2d3e",border:"1px solid #3a536e",color:"#8bc0f8",borderRadius:"4px",fontSize:"11px",padding:"2px 8px",cursor:"pointer"}}>تعديل التحليل / الصوت 🎙️</button><button onClick={() => { if (window.confirm("حذف هذه الصفقة وتقريرها من دفتر التداول؟")) { void act({ action: "deleteTrade", tradeId: trade.id }); } }} style={{ background: "#281719", border: "1px solid #4a282b", color: "#f87171", borderRadius: "4px", fontSize: "11px", padding: "2px 6px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }} title="حذف الصفقة"><Trash2 size={12} /></button></div></div>{trade.reflection && <div style={{display:"flex",gap:"8px",flexWrap:"wrap",margin:"6px 0",fontSize:"11px"}}><span style={{background:"#372611",color:"#fbbf24",border:"1px solid #f59e0b",borderRadius:"4px",padding:"1px 6px",fontWeight:"bold"}}>إعداد: {trade.reflection.setupGrade ?? "—"}</span><span style={{background:"#122822",color:"#34d399",border:"1px solid #10b981",borderRadius:"4px",padding:"1px 6px"}}>استراتيجية: {trade.reflection.strategy ?? "—"}</span><span style={{background:"#261932",color:"#c084fc",border:"1px solid #a855f7",borderRadius:"4px",padding:"1px 6px"}}>نفسية: {trade.reflection.emotion ?? "—"}</span><span style={{background:"#172635",color:"#60a5fa",border:"1px solid #3b82f6",borderRadius:"4px",padding:"1px 6px"}}>ثقة: {trade.reflection.confidence ?? "—"}</span></div>}{trade.reflection?.audioNote && <div style={{marginTop:"6px"}}><audio src={trade.reflection.audioNote} controls style={{height:"30px",maxWidth:"280px"}} /></div>}<p style={{margin:"6px 0",color:"#b6c7d8"}}>{trade.reflection?.notes || trade.reason || "بدون مبرر مكتوب"}</p><details><summary>أحداث الأمر · R {trade.rMultiple?.toFixed(2) ?? "—"}</summary>{trade.events?.map((event,index)=><p key={index}>{fmtDate(event.time)} · {event.detail}</p>)}</details></article>); }) : <div className="journal-empty"><BookOpenCheck size={18} /><span>لم تُسجّل مبررات دخول بعد. أضف مبررًا قبل تنفيذ صفقة.</span><button onClick={() => setLayout(v=>({...v,orderOpen:true}))}>فتح لوحة الأمر</button></div>}</div>}</section>
        </section>

        <div className="order-resizer" role="separator" tabIndex={0} aria-label="تغيير عرض لوحة الأوامر" aria-orientation="vertical" aria-valuemin={280} aria-valuemax={460} aria-valuenow={layout.width} onPointerDown={e=>resizeStart(e,"order")} onPointerMove={resizeMove} onPointerUp={()=>{resizeRef.current=null;}} onPointerCancel={()=>{resizeRef.current=null;}} onKeyDown={e=>{if(e.key==="ArrowLeft"||e.key==="ArrowRight") {e.preventDefault();setLayout(v=>({...v,width:Math.max(280,Math.min(460,v.width+(e.key==="ArrowRight"?20:-20)))}));}}}/>
        <aside className="right-panel">
          <div className="panel-top"><span>لوحة التداول</span><button title="إغلاق اللوحة" onClick={()=>setLayout(v=>({...v,orderOpen:false}))}><X size={15} /></button></div>
          <div className="balance-card">
            <div className="balance-card-header">
              <div className="balance-label"><Wallet size={14} /><span>رصيد المحاكاة التراكمي</span></div>
              <button
                type="button"
                className="balance-reset-btn"
                onClick={() => setBalanceModalOpen(true)}
                title="تعديل رأس المال أو إعادة الضبط"
              >
                <Sliders size={12} />
                <span>تعديل الرصيد</span>
              </button>
            </div>
            <strong>{money(equity)} <small>USDT</small></strong>
            <div className="balance-bottom"><span>ربح/خسارة الجلسة</span><b className={netPnl >= 0 ? "positive" : "negative"}>{netPnl >= 0 ? "+" : ""}{money(netPnl)} USDT</b></div>
          </div>
          <div className="panel-tabs"><button className={!statsOpen?"active":""} onClick={()=>setStatsOpen(false)}>الأوامر</button><button onClick={() => setStatsOpen(!statsOpen)}>الأداء <Activity size={13} /></button></div>
          {statsOpen ? <div className="stats-content">
            <div style={{marginBottom: "6px", borderBottom: "1px solid #233140", paddingBottom: "4px"}}>
              <span style={{color: "#8fa3b7", fontSize: "11px", fontWeight: "bold"}}>أداء الجلسة الحالية</span>
            </div>
            <div><span>الصفقات المغلقة</span><b>{closedTrades.length}</b></div>
            <div><span>نسبة الفوز</span><b>{winRate.toFixed(1)}%</b></div>
            <div><span>رابحة / خاسرة</span><b><i className="positive">{wins}</i> / <i className="negative">{losses}</i></b></div>
            <div><span>إجمالي رسوم الجلسة</span><b style={{ color: "#f87171" }}>-{money(closedTrades.reduce((acc, t) => acc + (t.entryFee ?? 0) + (t.exitFee ?? 0), 0))} USDT</b></div>
            <div><span>صافي أرباح الجلسة</span><b className={netPnl >= 0 ? "positive" : "negative"}>{netPnl >= 0 ? "+" : ""}{money(netPnl)} USDT</b></div>
            {workspace.sessions.length > 1 && (
              <>
                <div style={{marginTop: "10px", marginBottom: "6px", borderBottom: "1px solid #233140", paddingBottom: "4px"}}>
                  <span style={{color: "#8fa3b7", fontSize: "11px", fontWeight: "bold"}}>الإجمالي التراكمي (كل الجلسات)</span>
                </div>
                <div><span>إجمالي الصفقات المغلقة</span><b>{allClosedTrades.length}</b></div>
                <div><span>نسبة الفوز الكلية</span><b>{allWinRate.toFixed(1)}%</b></div>
                <div><span>رابحة / خاسرة</span><b><i className="positive">{allWins}</i> / <i className="negative">{allLosses}</i></b></div>
                <div><span>إجمالي رسوم كل الجلسات</span><b style={{ color: "#f87171" }}>-{money(allClosedTrades.reduce((acc, t) => acc + (t.entryFee ?? 0) + (t.exitFee ?? 0), 0))} USDT</b></div>
                <div><span>صافي الأرباح الكلي</span><b className={allNetPnl >= 0 ? "positive" : "negative"}>{allNetPnl >= 0 ? "+" : ""}{money(allNetPnl)} USDT</b></div>
              </>
            )}
            <p>الرسوم 0.15% لكل تنفيذ · انزلاق سعري 0.02% · شراء وبيع محاكى دون رافعة</p>
          </div> : <>
            {activeTrades.length > 0 && (
              <div className="active-trades-section">
                <div className="active-trades-header">
                  <span>الصفقات النشطة ({activeTrades.length})</span>
                  {activeTrades.length > 1 && (
                    <button
                      type="button"
                      className="close-all-trades-btn"
                      disabled={loading}
                      onClick={() => {
                        if (window.confirm("إغلاق جميع الصفقات المفتوحة فوراً؟")) {
                          void act({ action: "close", all: true });
                        }
                      }}
                      title="إغلاق جميع الصفقات المفتوحة"
                    >
                      إغلاق الكل ✕
                    </button>
                  )}
                </div>
                <div className="active-trades-list">
                  {activeTrades.map((trade) => {
                    const isSelected = selectedTrade?.id === trade.id;
                    const isShort = trade.side === "short";
                    const currentPrice = latest?.close ?? trade.entryPrice ?? trade.orderPrice ?? 0;
                    const refPrice = trade.entryPrice ?? trade.orderPrice ?? currentPrice;
                    const pricePct = refPrice > 0 ? ((currentPrice - refPrice) / refPrice) * 100 * (isShort ? -1 : 1) : 0;
                    const pnl = trade.entryPrice ? (trade.remainingQuantity ?? trade.quantity ?? 0) * (currentPrice - trade.entryPrice) * (isShort ? -1 : 1) : 0;
                    const isPending = trade.status === "pending";

                    return (
                      <div
                        key={trade.id}
                        className={`active-trade-card ${isSelected ? "selected" : ""} ${trade.side}`}
                        onClick={() => setSelectedTradeId(trade.id)}
                      >
                        <div className="card-top-row">
                          <span className={`side-badge ${trade.side}`}>
                            {isShort ? "🔴 بيع Short" : "🟢 شراء Long"}
                          </span>
                          <span className="card-symbol">{SYMBOL_INFO[trade.symbol as SymbolName]?.base ?? trade.symbol.slice(0, -4)}</span>
                          <span className={`status-pill ${trade.status}`}>
                            {trade.status === "pending" ? "معلق" : trade.status === "open" ? "مفتوح" : "قيد الإغلاق"}
                          </span>
                        </div>

                        <div className="card-metrics-grid">
                          <div>
                            <small>الدخول</small>
                            <b dir="ltr">{trade.entryPrice ? price(trade.entryPrice) : trade.orderPrice ? price(trade.orderPrice) : "الافتتاح"}</b>
                          </div>
                          <div>
                            <small>الحجم</small>
                            <b dir="ltr">{money(trade.notional)} $</b>
                          </div>
                          {!isPending && (
                            <div>
                              <small>الربح اللحظي</small>
                              <b className={pnl >= 0 ? "positive" : "negative"} dir="ltr">
                                {pnl >= 0 ? "+" : ""}{money(pnl)} $ ({pricePct >= 0 ? "+" : ""}{pricePct.toFixed(2)}%)
                              </b>
                            </div>
                          )}
                        </div>

                        <div className="card-sl-tp-row">
                          <span>وقف: <b dir="ltr">{trade.stopLoss ? price(trade.stopLoss) : "—"}</b></span>
                          <span>هدف: <b dir="ltr">{trade.takeProfit ? price(trade.takeProfit) : "—"}</b></span>
                        </div>

                        <div className="card-actions-row">
                          {trade.status === "open" && (
                            <button
                              type="button"
                              className="card-scale-btn"
                              disabled={loading || availableCash < 5}
                              onClick={(e) => {
                                e.stopPropagation();
                                setScaleInTrade(trade);
                                setScaleInAmount(String(Math.min(trade.notional, Math.max(50, Math.floor(availableCash)))));
                              }}
                              title="تعزيز الصفقة وزيادة اللوت"
                            >
                              <TrendingUp size={12} /> + تعزيز
                            </button>
                          )}
                          {trade.status === "open" && (
                            <button
                              type="button"
                              className="card-tp-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTradeId(trade.id);
                                setTpModalOpen(true);
                              }}
                              title="سحب أرباح جزئية"
                            >
                              <Target size={12} /> سحب أرباح
                            </button>
                          )}
                          <button
                            type="button"
                            className="card-close-btn"
                            disabled={loading}
                            onClick={(e) => {
                              e.stopPropagation();
                              void act({ action: isPending ? "cancel" : "close", tradeId: trade.id });
                            }}
                            title={isPending ? "إلغاء الأمر" : "إغلاق فوري"}
                          >
                            <X size={12} /> {isPending ? "إلغاء" : "إغلاق"}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="new-order-divider">
              <span>{activeTrades.length > 0 ? "إعداد ودخول صفقة جديدة" : "إعداد الصفقة"}</span>
            </div>

            <div className="side-selector-row">
              <button
                type="button"
                className={`side-sel-btn long ${side === "long" ? "active" : ""}`}
                onClick={() => setSide("long")}
              >
                📈 شراء (Long)
              </button>
              <button
                type="button"
                className={`side-sel-btn short ${side === "short" ? "active" : ""}`}
                onClick={() => setSide("short")}
              >
                📉 بيع (Short)
              </button>
            </div>

            <div className="order-type">
              {(["market", "limit", "stop"] as const).map(kind => (
                <button
                  key={kind}
                  disabled={Boolean(quickDraft)}
                  className={orderType === kind ? "active" : ""}
                  onClick={() => {
                    setOrderType(kind);
                    setOrderPrice(latest ? (latest.close * (kind === "limit" ? 1 - direction * .005 : 1 + direction * .005)).toFixed(2) : "");
                    setStopLoss("");
                    setTakeProfit("");
                  }}
                >
                  {orderLabels[kind]}
                </button>
              ))}
            </div>

            <div className="order-body">
              {(quickDraft || orderType !== "market") && (
                <label className="entry-price-field">
                  {quickDraft ? "سعر الدخول · يتحدد نوع الأمر تلقائيًا" : orderType === "limit" ? "سعر الأمر المحدد" : "سعر تفعيل أمر الوقف"}
                  <input
                    aria-label="سعر الأمر"
                    type="number"
                    step="any"
                    min="0"
                    value={quickDraft?.entry ?? orderPrice}
                    onChange={e => {
                      setOrderPrice(e.target.value);
                      if (quickDraft) {
                        const value = Number(e.target.value);
                        setQuickDraft({ ...quickDraft, entry: value });
                        setOrderType(draftOrderType(selectedSide, value, latest?.close ?? value));
                      }
                    }}
                  />
                </label>
              )}
              <p className="order-explanation">
                {orderType === "market" ? "تنفيذ عند افتتاح الدقيقة التالية." : orderType === "limit" ? "تنفيذ بسعر الحد أو أفضل وفق اتجاه الصفقة." : "أمر سوق عند بلوغ سعر التفعيل؛ ليس وقف خسارة."}
              </p>
              <div className="order-field">
                <label htmlFor="entry-amount">مبلغ الدخول · USDT</label>
                <div className="input-with-unit">
                  <input
                    id="entry-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    value={notional}
                    onChange={(e) => setNotional(e.target.value)}
                  />
                  <span>USDT</span>
                </div>
                <div className="quick-sizes">
                  {[50, 100, 250, 500].map((amount) => (
                    <button
                      key={amount}
                      className={Number(notional) === amount ? "picked" : ""}
                      onClick={() => setNotional(String(amount))}
                    >
                      {amount} USDT
                    </button>
                  ))}
                </div>
                <small className="cash-available">المتاح للدخول <b dir="ltr">{money(availableCash)} USDT</b></small>
              </div>
              <div className="risk-fields">
                <label>
                  <span><i className="risk-dot stop" /> وقف الخسارة {stopDistancePct !== null ? `(−${stopDistancePct.toFixed(2)}%)` : ""}</span>
                  <input
                    type="number"
                    step="any"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder={latest ? price(expectedEntry * (1 - direction * .01)) : "السعر"}
                  />
                </label>
                <label>
                  <span><i className="risk-dot target" /> جني الأرباح {targetDistancePct !== null ? `(+${targetDistancePct.toFixed(2)}%)` : ""}</span>
                  <input
                    type="number"
                    step="any"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder={latest ? price(expectedEntry * (1 + direction * .02)) : "السعر"}
                  />
                </label>
              </div>
              <button
                className={`buy-button ${side}`}
                onClick={submitLong}
                disabled={confirming || !session || !dataReady || availableCash < 10}
              >
                <span>{quickDraft ? "تأكيد الدخول" : (side === "short" ? "بيع (Short)" : "شراء (Long)")} {SYMBOL_INFO[currentSymbol]?.base ?? currentSymbol.slice(0, -4)}</span>
                <b dir="ltr">{Number.isFinite(orderAmount) && orderAmount > 0 ? money(orderAmount) : "—"} USDT</b>
              </button>
              <div className="cash-breakdown" aria-label="ملخص الصفقة بالدولار">
                <div><span>مبلغ الصفقة</span><b dir="ltr">{Number.isFinite(orderAmount) && orderAmount > 0 ? money(orderAmount) : "—"} USDT</b></div>
                <div><span>رسوم الدخول (0.15%)</span><b dir="ltr">{cash ? money(cash.fee) : "—"} USDT</b></div>
                <div className="cash-total"><span>الإجمالي مع الرسوم</span><b dir="ltr">{cash ? money(cash.total) : "—"} USDT</b></div>
                <div><span>حركة السعر عند الوقف</span><b dir="ltr" className="negative">{stopGross !== null ? `−${money(stopGross)} USDT (−${stopDistancePct?.toFixed(2)}%)` : "—"}</b></div>
                <div><span>صافي النتيجة عند الوقف (مع الرسوم) ≈</span><b dir="ltr" className={cash && cash.stopNet >= 0 ? "positive" : "negative"}>{cash ? signedCash(cash.stopNet) : "—"}</b></div>
                <div><span>حركة السعر عند الهدف</span><b dir="ltr" className="positive">{targetGross !== null ? `+${money(targetGross)} USDT (+${targetDistancePct?.toFixed(2)}%)` : "—"}</b></div>
                <div><span>صافي النتيجة عند الهدف (مع الرسوم) ≈</span><b dir="ltr" className={cash && cash.targetNet >= 0 ? "positive" : "negative"}>{cash ? signedCash(cash.targetNet) : "—"}</b></div>
                <small>حركة السعر مجردة بالنسبة المئوية ($)، والصافي يخصم رسوم بينانس (0.15% دخول + 0.15% خروج) والانزلاق 0.02%.</small>
              </div>
              <div className="risk-summary">
                <span>المخاطرة ≈ {cash && equity > 0 ? (Math.max(0, -cash.stopNet) / equity * 100).toFixed(2) : "—"}% من الرصيد · نسبة العائد / المخاطرة (R)</span>
                <b>{priceRRatio ? `${priceRRatio.toFixed(2)} R (1 : ${priceRRatio.toFixed(2)})` : "—"}</b>
              </div>
              <label className="reason-label">
                مبرر الدخول
                <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ما سبب دخولك؟ اكتب شروط الاستراتيجية…" maxLength={500} />
              </label>

              {selectedTrade && (
                <button
                  type="button"
                  className="update-risk-button"
                  onClick={() => void act({ action: "risk", tradeId: selectedTrade.id, stopLoss: Number(stopLoss) || selectedTrade.stopLoss, takeProfit: Number(takeProfit) || selectedTrade.takeProfit })}
                  disabled={loading}
                >
                  <Target size={13} /> تطبيق الوقف والهدف على الصفقة المحددة
                </button>
              )}

              {!session && <p className="side-hint">ابدأ Replay حتى تصبح أوامر المحاكاة متاحة.</p>}
            </div>
          </>}

          <div className="market-card">
            <div className="market-card-title"><span>نظرة على الأصول المتاحة</span><span className="demo-badge">4 أصول</span></div>
            {SYMBOLS.map((s) => {
              const info = SYMBOL_INFO[s];
              const isCurrent = currentSymbol === s;
              return (
                <button
                  key={s}
                  type="button"
                  className={`market-mini ${isCurrent ? "current" : ""}`}
                  onClick={() => void selectSymbol(s)}
                  title={`التبديل إلى ${info.arabicName}`}
                  style={{
                    width: "100%",
                    background: isCurrent ? "#172738" : "transparent",
                    border: isCurrent ? "1px solid #33547a" : "1px solid transparent",
                    borderRadius: "6px",
                    cursor: "pointer",
                    textAlign: "inherit",
                    padding: "5px 8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    marginBottom: "4px",
                    transition: "all 0.15s ease",
                  }}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "14px" }}>{info.icon}</span>
                    <b style={{ color: "#dbe7f3" }}>{info.base}</b>
                    <small style={{ color: "#7f98b1", fontSize: "11px" }}>{info.arabicName}</small>
                  </span>
                  <b>{isCurrent && latest ? price(latest.close) : "—"}</b>
                  <small className={isCurrent && change >= 0 ? "positive" : isCurrent ? "negative" : ""}>
                    {isCurrent && latest ? `${change >= 0 ? "+" : ""}${change.toFixed(2)}%` : isCurrent ? "—" : "اختر"}
                  </small>
                </button>
              );
            })}
            <div className="market-note"><Sparkles size={13} /> الأسعار من شموع Binance التاريخية</div>
          </div>
          <div className="risk-note"><ShieldCheck size={14} /><p>محاكاة تعليمية فقط. لا يتم إرسال أي أوامر إلى Binance.</p></div>
        </aside>
      </div>
      <footer className="statusbar"><span>{loading ? "جار تحميل البيانات" : !dataReady ? "البيانات غير جاهزة" : source || "بيانات تاريخية"}</span><span>جلساتك تحفظ تلقائيًا</span><span><DollarSign size={12} /> الرصيد {money(equity)} USDT · المتاح {money(availableCash)} USDT</span><span className="statusbar-right">{error ? "راجع رسالة الخطأ" : session ? "جلسة محفوظة" : "ابدأ جلسة تدريب"}</span></footer>

      <TradeReflectionModal
        key={reflectionModalTrade?.id ?? "none"}
        isOpen={Boolean(reflectionModalTrade)}
        onClose={() => setReflectionModalTrade(null)}
        onSave={handleSaveReflection}
        initialData={reflectionModalTrade?.reflection}
        tradeSummary={
          reflectionModalTrade
            ? {
                symbol: reflectionModalTrade.symbol,
                side: reflectionModalTrade.side ?? "long",
                price: reflectionModalTrade.entryPrice ?? reflectionModalTrade.orderPrice,
                amount: reflectionModalTrade.notional,
              }
            : undefined
        }
      />

      <AccountBalanceModal
        isOpen={balanceModalOpen}
        onClose={() => setBalanceModalOpen(false)}
        currentInitialBalance={workspace.initialBalance ?? INITIAL_BALANCE}
        currentEquity={equity}
        onSaveBalance={handleSaveBalance}
      />

      <ChartThemeModal
        isOpen={themeModalOpen}
        onClose={() => setThemeModalOpen(false)}
        currentTheme={chartTheme}
        onApplyTheme={(th) => setChartTheme(th)}
      />

      <OfflineDataModal
        isOpen={offlineModalOpen}
        onClose={() => setOfflineModalOpen(false)}
        summary={offlineSummary}
        onStartOfflineSession={(sym) => void handleStartOfflineSession(sym)}
        onRefreshPack={() => {
          fetch("/api/lab?offlineSummary=true")
            .then((res) => res.json() as Promise<{ summary?: typeof offlineSummary }>)
            .then((data) => {
              if (data?.summary) setOfflineSummary(data.summary);
            })
            .catch(() => {});
        }}
        isOfflineMode={isOfflineMode}
        onToggleMode={(off) => void switchToMode(off)}
      />
    </main>
  );
}
