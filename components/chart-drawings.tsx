"use client";

import { useEffect, useRef, useState, useCallback, type RefObject } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { Candle } from "@/lib/replay";
import { computeVolumeProfile } from "@/lib/volume-profile";
import {
  Trash2,
  Undo2,
  Eye,
  EyeOff,
  Move,
  PenTool,
  TrendingUp,
  Square,
  Minus,
  Sparkles,
  GitCommit,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export type ChartPoint = {
  time: number;
  price: number;
};

export type DrawingType =
  | "butterfly" // Harmonic Butterfly (XABCD)
  | "brush" // Freehand Pen / Brush
  | "trend" // Trendline
  | "rectangle" // Order Block / Area
  | "horizontal" // Horizontal Ray / Level
  | "fib" // Fibonacci Retracement
  | "anchored_volume_profile" // Anchored Volume Profile (AVP)
  | "fixed_volume_profile" // Fixed Range Volume Profile (FRVP)
  | "price_range" // Price Range (Δ Price, %)
  | "date_range"; // Date Range (Bars, Duration)

export type DrawingShape = {
  id: string;
  type: DrawingType;
  color?: string;
  lineWidth?: number;
  lineStyle?: "solid" | "dashed" | "dotted";
  points: ChartPoint[]; // 5 for butterfly, 2 for trend/rect/fib, 1 for horizontal, N for brush
  text?: string;
};

const DRAWING_COLORS = [
  "#e2e8f0", // Institutional White (Calm & Clear)
  "#38bdf8", // Sky / Ice Blue (Subtle)
  "#f59e0b", // Amber / Warm Gold (Muted)
];

const FIB_LEVELS = [
  { ratio: 0, color: "#787b86", fill: "rgba(120, 123, 134, 0.08)" },
  { ratio: 0.236, color: "#f23645", fill: "rgba(242, 54, 69, 0.08)" },
  { ratio: 0.382, color: "#ff9800", fill: "rgba(255, 152, 0, 0.08)" },
  { ratio: 0.5, color: "#4caf50", fill: "rgba(76, 175, 80, 0.08)" },
  { ratio: 0.618, color: "#089981", fill: "rgba(8, 153, 129, 0.12)" },
  { ratio: 0.786, color: "#2962ff", fill: "rgba(41, 98, 255, 0.10)" },
  { ratio: 1.0, color: "#787b86", fill: "transparent" },
];

const getStrokeDash = (style?: "solid" | "dashed" | "dotted") => {
  if (style === "dashed") return "6 4";
  if (style === "dotted") return "2 3";
  return undefined;
};

const LINE_WIDTHS = [
  { label: "1px", value: 1.0 },
  { label: "2px", value: 1.8 },
  { label: "3px", value: 2.6 },
];

const LINE_STYLES: { label: string; value: "solid" | "dashed" | "dotted"; title: string }[] = [
  { label: "──", value: "solid", title: "مستمر (صلب)" },
  { label: "┄┄", value: "dashed", title: "متقطع (شرط)" },
  { label: "···", value: "dotted", title: "منقط" },
];

export interface ChartDrawingsProps {
  chart: RefObject<IChartApi | null>;
  series: RefObject<ISeriesApi<"Candlestick"> | null>;
  candles: Candle[];
  storageKey: string;
  activeTool?: DrawingType | null;
  onActiveToolChange?: (tool: DrawingType | null) => void;
  onActive?: (isActive: boolean) => void;
}

export default function ChartDrawings({
  chart,
  series,
  candles,
  storageKey,
  activeTool: externalActiveTool,
  onActiveToolChange,
  onActive,
}: ChartDrawingsProps) {
  const [internalTool, setInternalTool] = useState<DrawingType | null>(null);
  const activeTool = externalActiveTool !== undefined ? externalActiveTool : internalTool;

  const setActiveTool = useCallback(
    (tool: DrawingType | null) => {
      setInternalTool(tool);
      onActiveToolChange?.(tool);
      onActive?.(Boolean(tool));
    },
    [onActiveToolChange, onActive]
  );

  const [shapes, setShapes] = useState<DrawingShape[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [currentColor, setCurrentColor] = useState<string>("#e2e8f0");
  const [currentWidth, setCurrentWidth] = useState<number>(1.0);
  const [currentStyle, setCurrentStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [hidden, setHidden] = useState<boolean>(false);
  const [toolbarCollapsed, setToolbarCollapsed] = useState<boolean>(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("replay-drawings-collapsed") === "true") {
        setToolbarCollapsed(true);
      }
    } catch {}
  }, []);

  const toggleToolbar = useCallback(() => {
    setToolbarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("replay-drawings-collapsed", String(next));
      } catch {}
      return next;
    });
  }, []);

  // In-progress drawing draft state
  const pendingPoints = useRef<ChartPoint[]>([]);
  const [draftPointsCount, setDraftPointsCount] = useState<number>(0);
  const isDraggingBrush = useRef<boolean>(false);
  const currentBrushPoints = useRef<ChartPoint[]>([]);
  const [liveBrushPoints, setLiveBrushPoints] = useState<ChartPoint[]>([]);

  // Dragging existing handle
  const draggingHandle = useRef<{
    shapeId: string;
    pointIndex: number;
  } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const candlesRef = useRef(candles);
  candlesRef.current = candles;

  // Load shapes from storage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setShapes(parsed);
        }
      }
    } catch {
      setShapes([]);
    }
  }, [storageKey]);

  // Persist shapes
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(shapes));
    } catch {}
  }, [shapes, storageKey]);

  // Coordinate helper: time & price to screen X & Y (supports projection beyond last candle)
  const getCoordinates = useCallback(
    (point: ChartPoint): { x: number; y: number } | null => {
      const c = chart.current;
      const s = series.current;
      const data = candlesRef.current;
      if (!c || !s || !data.length) return null;

      const lastBar = data[data.length - 1];
      const firstBar = data[0];
      const interval = data.length > 1 ? lastBar.openTime - data[data.length - 2].openTime : 60000;

      let logicalIdx: number;
      if (point.time > lastBar.openTime) {
        // Projected into future blank space beyond the last candle
        logicalIdx = (data.length - 1) + (point.time - lastBar.openTime) / interval;
      } else if (point.time < firstBar.openTime) {
        logicalIdx = (point.time - firstBar.openTime) / interval;
      } else {
        const exact = data.findIndex((b) => b.openTime === point.time);
        if (exact >= 0) {
          logicalIdx = exact;
        } else {
          const next = data.findIndex((b) => b.openTime > point.time);
          if (next > 0) {
            const prevBar = data[next - 1];
            const span = data[next].openTime - prevBar.openTime;
            logicalIdx = (next - 1) + (point.time - prevBar.openTime) / (span || interval);
          } else {
            logicalIdx = data.length - 1;
          }
        }
      }

      const x = c.timeScale().logicalToCoordinate(logicalIdx as never);
      const y = s.priceToCoordinate(point.price);
      if (x === null || y === null) return null;
      return { x, y };
    },
    [chart, series]
  );

  // Coordinate helper: screen X & Y to time & price (supports drawing beyond last candle)
  const screenToChart = useCallback(
    (clientX: number, clientY: number): ChartPoint | null => {
      const c = chart.current;
      const s = series.current;
      const data = candlesRef.current;
      const svg = svgRef.current;
      if (!c || !s || !data.length || !svg) return null;

      const rect = svg.getBoundingClientRect();
      const relX = clientX - rect.left;
      const relY = clientY - rect.top;

      const logical = c.timeScale().coordinateToLogical(relX);
      const price = s.coordinateToPrice(relY);
      if (logical === null || price === null || price <= 0) return null;

      const lastBar = data[data.length - 1];
      const firstBar = data[0];
      const interval = data.length > 1 ? lastBar.openTime - data[data.length - 2].openTime : 60000;

      let time: number;
      if (logical < 0) {
        time = firstBar.openTime + logical * interval;
      } else if (logical > data.length - 1) {
        // User clicked/drew in the future space to the right of the latest candle!
        time = lastBar.openTime + (logical - (data.length - 1)) * interval;
      } else {
        const baseIdx = Math.max(0, Math.min(data.length - 1, Math.floor(logical)));
        const frac = logical - baseIdx;
        const currentBar = data[baseIdx];
        const nextBar = data[baseIdx + 1];
        const span = nextBar ? nextBar.openTime - currentBar.openTime : interval;
        time = currentBar.openTime + frac * span;
      }

      return { time, price: Number(price.toFixed(4)) };
    },
    [chart, series]
  );

  // Handle pointer down (drawing start or handle selection)
  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (hidden) return;

      // Check if clicked on a drag handle
      const target = e.target as HTMLElement;
      const handleData = target.closest<SVGCircleElement>("[data-handle]");
      if (handleData) {
        e.stopPropagation();
        e.preventDefault();
        const sId = handleData.dataset.shapeId!;
        const pIdx = Number(handleData.dataset.pointIndex!);
        draggingHandle.current = { shapeId: sId, pointIndex: pIdx };
        setSelectedId(sId);
        target.setPointerCapture?.(e.pointerId);
        return;
      }

      // Check if clicked on an existing shape
      const shapeData = target.closest<SVGElement>("[data-shape-id]");
      if (shapeData && !activeTool) {
        e.stopPropagation();
        const sId = shapeData.dataset.shapeId!;
        setSelectedId(sId);
        const sh = shapes.find((s) => s.id === sId);
        if (sh) {
          if (sh.color) setCurrentColor(sh.color);
          if (sh.lineWidth) setCurrentWidth(sh.lineWidth);
          if (sh.lineStyle) setCurrentStyle(sh.lineStyle);
        }
        return;
      }

      if (!activeTool) {
        setSelectedId(null);
        return;
      }

      const pt = screenToChart(e.clientX, e.clientY);
      if (!pt) return;

      if (activeTool === "brush") {
        isDraggingBrush.current = true;
        currentBrushPoints.current = [pt];
        setLiveBrushPoints([pt]);
        target.setPointerCapture?.(e.pointerId);
        return;
      }

      if (activeTool === "horizontal" || activeTool === "anchored_volume_profile") {
        const newShape: DrawingShape = {
          id: crypto.randomUUID(),
          type: activeTool,
          color: currentColor,
          lineWidth: currentWidth,
          lineStyle: currentStyle,
          points: [pt],
        };
        setShapes((prev) => [...prev, newShape]);
        setSelectedId(newShape.id);
        setActiveTool(null);
        return;
      }

      // Multi-point tools: butterfly (5), others (2)
      pendingPoints.current.push(pt);
      const required = activeTool === "butterfly" ? 5 : 2;
      setDraftPointsCount(pendingPoints.current.length);

      if (pendingPoints.current.length >= required) {
        const newShape: DrawingShape = {
          id: crypto.randomUUID(),
          type: activeTool,
          color: currentColor,
          lineWidth: currentWidth,
          lineStyle: currentStyle,
          points: [...pendingPoints.current],
        };
        setShapes((prev) => [...prev, newShape]);
        setSelectedId(newShape.id);
        pendingPoints.current = [];
        setDraftPointsCount(0);
        setActiveTool(null);
      }
    },
    [activeTool, currentColor, currentWidth, currentStyle, hidden, screenToChart, setActiveTool]
  );

  // Handle pointer move
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (hidden) return;

      // Dragging a handle
      if (draggingHandle.current) {
        const pt = screenToChart(e.clientX, e.clientY);
        if (!pt) return;
        const { shapeId, pointIndex } = draggingHandle.current;
        setShapes((prev) =>
          prev.map((s) => {
            if (s.id !== shapeId) return s;
            const nextPts = [...s.points];
            nextPts[pointIndex] = pt;
            return { ...s, points: nextPts };
          })
        );
        return;
      }

      // Freehand brush dragging (Real-time live stroke)
      if (isDraggingBrush.current && activeTool === "brush") {
        const pt = screenToChart(e.clientX, e.clientY);
        if (!pt) return;
        const last = currentBrushPoints.current.at(-1);
        if (!last || Math.abs(last.price - pt.price) > 0.0001 || Math.abs(last.time - pt.time) > 50) {
          currentBrushPoints.current.push(pt);
          setLiveBrushPoints([...currentBrushPoints.current]);
        }
      }
    },
    [activeTool, hidden, screenToChart]
  );

  // Handle pointer up
  const handlePointerUp = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (draggingHandle.current) {
        draggingHandle.current = null;
      }

      if (isDraggingBrush.current && activeTool === "brush") {
        isDraggingBrush.current = false;
        if (currentBrushPoints.current.length > 1) {
          const newShape: DrawingShape = {
            id: crypto.randomUUID(),
            type: "brush",
            color: currentColor,
            lineWidth: currentWidth,
            lineStyle: currentStyle,
            points: [...currentBrushPoints.current],
          };
          setShapes((prev) => [...prev, newShape]);
          setSelectedId(newShape.id);
        }
        currentBrushPoints.current = [];
        setLiveBrushPoints([]);
        setDraftPointsCount(0);
        // Retain activeTool as "brush" so user can continuously draw more strokes!
      }
    },
    [activeTool, currentColor, currentWidth, currentStyle]
  );

  // Delete selected drawing on Delete / Backspace key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea") return;
        setShapes((prev) => prev.filter((s) => s.id !== selectedId));
        setSelectedId(null);
      }
      if (e.key === "Escape") {
        pendingPoints.current = [];
        setDraftPointsCount(0);
        setActiveTool(null);
        setSelectedId(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, setActiveTool]);

  // RENDER SVG ELEMENTS
  // We use requestAnimationFrame render loop to ensure drawings stick with the chart during panning/zooming
  const [renderTrigger, setRenderTrigger] = useState(0);

  useEffect(() => {
    let frameId = 0;
    const loop = () => {
      setRenderTrigger((v) => (v + 1) % 1000000);
      frameId = requestAnimationFrame(loop);
    };
    frameId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frameId);
  }, []);

  const chartWidth = chart.current?.timeScale().width() ?? 800;
  const chartHeight = svgRef.current?.clientHeight || 600;

  // Selected shape helper
  const selectedShape = shapes.find((s) => s.id === selectedId);

  return (
    <>
      {/* Floating Drawing Tool Bar */}
      {toolbarCollapsed ? (
        <div className="drawing-toolbar-collapsed" dir="rtl">
          <button
            type="button"
            className="drawing-expand-btn"
            onClick={toggleToolbar}
            title="فتح شريط أدوات الرسم والتحليل"
          >
            <PenTool size={14} />
            <span>أدوات التحليل</span>
            <ChevronDown size={14} />
          </button>
        </div>
      ) : (
        <div className="drawing-toolbar-floating" dir="rtl">
          <button
            type="button"
            className="tool-btn collapse-btn"
            onClick={toggleToolbar}
            title="طي شريط أدوات التحليل"
          >
            <ChevronUp size={14} />
          </button>
          <div className="tool-divider" />
        <button
          className={activeTool === null ? "tool-btn active" : "tool-btn"}
          title="المؤشر العادي"
          onClick={() => {
            setActiveTool(null);
            pendingPoints.current = [];
            setDraftPointsCount(0);
          }}
        >
          <Move size={15} />
        </button>

        <button
          className={activeTool === "butterfly" ? "tool-btn active highlight" : "tool-btn"}
          title="أداة الفراشة الهارمونيك (XABCD Pattern)"
          onClick={() => {
            setActiveTool(activeTool === "butterfly" ? null : "butterfly");
            pendingPoints.current = [];
            setDraftPointsCount(0);
          }}
        >
          <Sparkles size={15} />
          <span>الفراشة XABCD</span>
        </button>

        <button
          className={activeTool === "brush" ? "tool-btn active" : "tool-btn"}
          title="الفرشاة / قلم رسم حر"
          onClick={() => {
            setActiveTool(activeTool === "brush" ? null : "brush");
            pendingPoints.current = [];
            setDraftPointsCount(0);
          }}
        >
          <PenTool size={15} />
          <span>قلم حر</span>
        </button>

        <button
          className={activeTool === "trend" ? "tool-btn active" : "tool-btn"}
          title="خط اتجاه (Trendline)"
          onClick={() => {
            setActiveTool(activeTool === "trend" ? null : "trend");
            pendingPoints.current = [];
            setDraftPointsCount(0);
          }}
        >
          <TrendingUp size={15} />
          <span>خط اتجاه</span>
        </button>

        <button
          className={activeTool === "rectangle" ? "tool-btn active" : "tool-btn"}
          title="منطقة سعرية / Order Block"
          onClick={() => {
            setActiveTool(activeTool === "rectangle" ? null : "rectangle");
            pendingPoints.current = [];
            setDraftPointsCount(0);
          }}
        >
          <Square size={15} />
          <span>منطقة</span>
        </button>

        <button
          className={activeTool === "fib" ? "tool-btn active" : "tool-btn"}
          title="فيبوناتشي ارتدادي (Fibonacci)"
          onClick={() => {
            setActiveTool(activeTool === "fib" ? null : "fib");
            pendingPoints.current = [];
            setDraftPointsCount(0);
          }}
        >
          <GitCommit size={15} />
          <span>فيبوناتشي</span>
        </button>

        <button
          className={activeTool === "horizontal" ? "tool-btn active" : "tool-btn"}
          title="خط أفقي (Horizontal Level)"
          onClick={() => {
            setActiveTool(activeTool === "horizontal" ? null : "horizontal");
            pendingPoints.current = [];
            setDraftPointsCount(0);
          }}
        >
          <Minus size={15} />
          <span>أفقي</span>
        </button>

        <div className="tool-divider" />

        {/* Volume Profile Tools */}
        <button
          className={activeTool === "anchored_volume_profile" ? "tool-btn highlight active" : "tool-btn"}
          title="بروفايل الحجم المثبّت (Anchored Volume Profile)"
          onClick={() => {
            setActiveTool(activeTool === "anchored_volume_profile" ? null : "anchored_volume_profile");
            pendingPoints.current = [];
            setDraftPointsCount(0);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="5" cy="12" r="3" />
            <path d="M8 12h3" />
            <path d="M11 6h8v3h-8z" fill="currentColor" fillOpacity="0.35" />
            <path d="M11 10h12v4h-12z" fill="currentColor" fillOpacity="0.75" />
            <path d="M11 15h6v3h-6z" fill="currentColor" fillOpacity="0.35" />
          </svg>
          <span>بروفايل مثبت</span>
        </button>

        <button
          className={activeTool === "fixed_volume_profile" ? "tool-btn highlight active" : "tool-btn"}
          title="بروفايل الحجم بنطاق ثابت (Fixed Range Volume Profile)"
          onClick={() => {
            setActiveTool(activeTool === "fixed_volume_profile" ? null : "fixed_volume_profile");
            pendingPoints.current = [];
            setDraftPointsCount(0);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 4v16M21 4v16" strokeDasharray="2 2" />
            <path d="M3 6h10v3H3z" fill="currentColor" fillOpacity="0.35" />
            <path d="M3 10h16v4H3z" fill="currentColor" fillOpacity="0.75" />
            <path d="M3 15h8v3H3z" fill="currentColor" fillOpacity="0.35" />
          </svg>
          <span>نطاق ثابت</span>
        </button>

        <div className="tool-divider" />

        {/* Measurement Tools */}
        <button
          className={activeTool === "price_range" ? "tool-btn active" : "tool-btn"}
          title="نطاق السعر (Price Range)"
          onClick={() => {
            setActiveTool(activeTool === "price_range" ? null : "price_range");
            pendingPoints.current = [];
            setDraftPointsCount(0);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 4h14M5 20h14" />
            <path d="M12 4v16" />
            <path d="m9 7 3-3 3 3M9 17l3 3 3-3" />
          </svg>
          <span>نطاق السعر</span>
        </button>

        <button
          className={activeTool === "date_range" ? "tool-btn active" : "tool-btn"}
          title="نطاق التاريخ (Date / Time Range)"
          onClick={() => {
            setActiveTool(activeTool === "date_range" ? null : "date_range");
            pendingPoints.current = [];
            setDraftPointsCount(0);
          }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 5v14M20 5v14" />
            <path d="M4 12h16" />
            <path d="m7 9-3 3 3 3M17 9l3 3-3 3" />
          </svg>
          <span>نطاق التاريخ</span>
        </button>

        <div className="tool-divider" />

        {/* Color picker */}
        <div className="color-palette">
          {DRAWING_COLORS.map((c) => (
            <button
              key={c}
              className={`color-dot ${currentColor === c ? "picked" : ""}`}
              style={{ backgroundColor: c }}
              onClick={() => {
                setCurrentColor(c);
                if (selectedId) {
                  setShapes((prev) =>
                    prev.map((s) => (s.id === selectedId ? { ...s, color: c } : s))
                  );
                }
              }}
              title="تغيير اللون"
            />
          ))}
        </div>

        <div className="tool-divider" />

        {/* Line Width Controls */}
        <div className="line-options-group" title="سُمك الخط">
          {LINE_WIDTHS.map((w) => (
            <button
              key={w.label}
              className={`line-opt-btn ${Math.abs(currentWidth - w.value) < 0.1 ? "active" : ""}`}
              onClick={() => {
                setCurrentWidth(w.value);
                if (selectedId) {
                  setShapes((prev) =>
                    prev.map((s) => (s.id === selectedId ? { ...s, lineWidth: w.value } : s))
                  );
                }
              }}
              title={`سُمك الخط: ${w.label}`}
            >
              {w.label}
            </button>
          ))}
        </div>

        <div className="tool-divider" />

        {/* Line Style Controls */}
        <div className="line-options-group" title="نمط الخط (مستمر / شرط / منقط)">
          {LINE_STYLES.map((st) => (
            <button
              key={st.value}
              className={`line-opt-btn ${currentStyle === st.value ? "active" : ""}`}
              onClick={() => {
                setCurrentStyle(st.value);
                if (selectedId) {
                  setShapes((prev) =>
                    prev.map((s) => (s.id === selectedId ? { ...s, lineStyle: st.value } : s))
                  );
                }
              }}
              title={st.title}
            >
              {st.label}
            </button>
          ))}
        </div>

        <div className="tool-divider" />
        <button
          className="tool-btn"
          disabled={!shapes.length}
          onClick={() => {
            setShapes((prev) => prev.slice(0, -1));
            setSelectedId(null);
          }}
          title="تراجع عن آخر رسم"
        >
          <Undo2 size={15} />
        </button>

        <button
          className="tool-btn"
          onClick={() => setHidden(!hidden)}
          title={hidden ? "إظهار الرسوم" : "إخفاء الرسوم"}
        >
          {hidden ? <EyeOff size={15} /> : <Eye size={15} />}
        </button>

        {selectedShape && (
          <button
            className="tool-btn delete-btn"
            onClick={() => {
              setShapes((prev) => prev.filter((s) => s.id !== selectedId));
              setSelectedId(null);
            }}
            title="حذف الرسم المحدد"
          >
            <Trash2 size={15} />
          </button>
        )}
      </div>
      )}

      {/* Guide Banner for active tool */}
      {activeTool && (
        <div className="drawing-status-hint">
          {activeTool === "butterfly" && (
            <span>
              أداة الفراشة XABCD: انقر لتحديد النقطة{" "}
              {["X", "A", "B", "C", "D"][draftPointsCount] || "X"} ({draftPointsCount}/5)
            </span>
          )}
          {activeTool === "brush" && <span>انقر واسحب بالفأرة بحرية للرسم على الشارت</span>}
          {activeTool === "trend" && (
            <span>انقر نقطة البداية ثم نقطة النهاية لرسم خط الاتجاه ({draftPointsCount}/2)</span>
          )}
          {activeTool === "rectangle" && (
            <span>انقر الزاوية الأولى ثم الزاوية المقابلة للمنطقة ({draftPointsCount}/2)</span>
          )}
          {activeTool === "fib" && (
            <span>انقر قمة / قاع الموجة ثم الطرف الآخر ({draftPointsCount}/2)</span>
          )}
          {activeTool === "horizontal" && <span>انقر عند المستوى السعري المطلوب لتثبيت الخط</span>}
          {activeTool === "anchored_volume_profile" && (
            <span>بروفايل الحجم المثبّت: انقر على شمعة البداية لتثبيت بروفايل الحجم عندها</span>
          )}
          {activeTool === "fixed_volume_profile" && (
            <span>بروفايل الحجم بنطاق ثابت: انقر نقطة البداية ثم نقطة النهاية ({draftPointsCount}/2)</span>
          )}
          {activeTool === "price_range" && (
            <span>نطاق السعر: انقر مستوى السعر الأول ثم المستوى الثاني لقياس الفارق والنسبة ({draftPointsCount}/2)</span>
          )}
          {activeTool === "date_range" && (
            <span>نطاق التاريخ: انقر شمعة البداية ثم شمعة النهاية لقياس الوقت والشموع ({draftPointsCount}/2)</span>
          )}
          <button
            onClick={() => {
              pendingPoints.current = [];
              setDraftPointsCount(0);
              setActiveTool(null);
            }}
          >
            إلغاء الرسم ×
          </button>
        </div>
      )}

      {/* SVG Canvas for drawings */}
      <svg
        ref={svgRef}
        className={`chart-drawings-svg ${activeTool ? "drawing-active" : ""}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        {!hidden && (
          <>
            {shapes.map((shape) => {
              const isSelected = shape.id === selectedId;
              const color = shape.color || "#38bdf8";

              // 1. HARMONIC BUTTERFLY (XABCD)
              if (shape.type === "butterfly" && shape.points.length === 5) {
                const [X, A, B, C, D] = shape.points.map(getCoordinates);
                if (!X || !A || !B || !C || !D) return null;

                // Ratios
                const pX = shape.points[0].price;
                const pA = shape.points[1].price;
                const pB = shape.points[2].price;
                const pC = shape.points[3].price;
                const pD = shape.points[4].price;

                const xa = Math.abs(pA - pX) || 1e-6;
                const ab = Math.abs(pB - pA) || 1e-6;
                const bc = Math.abs(pC - pB) || 1e-6;

                const bRet = (Math.abs(pB - pA) / xa).toFixed(3); // B retracement of XA
                const cRet = (Math.abs(pC - pB) / ab).toFixed(3); // C retracement of AB
                const dExtBc = (Math.abs(pD - pC) / bc).toFixed(3); // D extension of BC
                const dExtXa = (Math.abs(pD - pA) / xa).toFixed(3); // D extension of XA

                const labels = ["X", "A", "B", "C", "D"];
                const pts = [X, A, B, C, D];

                return (
                  <g key={shape.id} data-shape-id={shape.id} className="shape-group">
                    {/* Wing 1: Triangle X-A-B */}
                    <polygon
                      points={`${X.x},${X.y} ${A.x},${A.y} ${B.x},${B.y}`}
                      fill={color}
                      fillOpacity={0.18}
                      stroke={color}
                      strokeWidth={shape.lineWidth ? (isSelected ? shape.lineWidth + 0.8 : shape.lineWidth) : (isSelected ? 2.5 : 1.8)}
                      strokeDasharray={getStrokeDash(shape.lineStyle)}
                    />

                    {/* Wing 2: Triangle B-C-D */}
                    <polygon
                      points={`${B.x},${B.y} ${C.x},${C.y} ${D.x},${D.y}`}
                      fill={color}
                      fillOpacity={0.22}
                      stroke={color}
                      strokeWidth={shape.lineWidth ? (isSelected ? shape.lineWidth + 0.8 : shape.lineWidth) : (isSelected ? 2.5 : 1.8)}
                      strokeDasharray={getStrokeDash(shape.lineStyle)}
                    />

                    {/* Dotted Harmonic Connections */}
                    <line
                      x1={X.x}
                      y1={X.y}
                      x2={B.x}
                      y2={B.y}
                      stroke={color}
                      strokeWidth={1.2}
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={A.x}
                      y1={A.y}
                      x2={C.x}
                      y2={C.y}
                      stroke={color}
                      strokeWidth={1.2}
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={B.x}
                      y1={B.y}
                      x2={D.x}
                      y2={D.y}
                      stroke={color}
                      strokeWidth={1.2}
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={X.x}
                      y1={X.y}
                      x2={D.x}
                      y2={D.y}
                      stroke={color}
                      strokeWidth={1.2}
                      strokeDasharray="4 4"
                      opacity={0.8}
                    />

                    {/* Fibonacci ratio badges */}
                    <g className="ratio-tag">
                      <rect
                        x={(X.x + B.x) / 2 - 24}
                        y={(X.y + B.y) / 2 - 10}
                        width={48}
                        height={18}
                        rx={4}
                        fill="#0c1117dd"
                        stroke={color}
                        strokeWidth={0.8}
                      />
                      <text
                        x={(X.x + B.x) / 2}
                        y={(X.y + B.y) / 2 + 3}
                        fill={color}
                        fontSize={10}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {bRet}
                      </text>
                    </g>

                    <g className="ratio-tag">
                      <rect
                        x={(A.x + C.x) / 2 - 24}
                        y={(A.y + C.y) / 2 - 10}
                        width={48}
                        height={18}
                        rx={4}
                        fill="#0c1117dd"
                        stroke={color}
                        strokeWidth={0.8}
                      />
                      <text
                        x={(A.x + C.x) / 2}
                        y={(A.y + C.y) / 2 + 3}
                        fill={color}
                        fontSize={10}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {cRet}
                      </text>
                    </g>

                    <g className="ratio-tag">
                      <rect
                        x={(B.x + D.x) / 2 - 24}
                        y={(B.y + D.y) / 2 - 10}
                        width={48}
                        height={18}
                        rx={4}
                        fill="#0c1117dd"
                        stroke={color}
                        strokeWidth={0.8}
                      />
                      <text
                        x={(B.x + D.x) / 2}
                        y={(B.y + D.y) / 2 + 3}
                        fill={color}
                        fontSize={10}
                        fontWeight="bold"
                        textAnchor="middle"
                      >
                        {dExtBc}
                      </text>
                    </g>

                    {/* Point labels & draggable handles */}
                    {pts.map((pt, i) => (
                      <g key={i}>
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r={isSelected ? 6 : 4}
                          fill={isSelected ? "#fff" : color}
                          stroke={color}
                          strokeWidth={2}
                          data-handle="true"
                          data-shape-id={shape.id}
                          data-point-index={i}
                          style={{ cursor: "grab" }}
                        />
                        <text
                          x={pt.x + 8}
                          y={pt.y - 8}
                          fill="#ffffff"
                          fontSize={12}
                          fontWeight="bold"
                          filter="drop-shadow(0px 1px 2px rgba(0,0,0,0.8))"
                        >
                          {labels[i]}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              }

              // 2. FREEHAND BRUSH
              if (shape.type === "brush" && shape.points.length > 1) {
                const coords = shape.points.map(getCoordinates).filter(Boolean) as {
                  x: number;
                  y: number;
                }[];
                if (coords.length < 2) return null;

                const pathData = coords.reduce(
                  (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
                  ""
                );

                return (
                  <g key={shape.id} data-shape-id={shape.id} className="shape-group">
                    <path
                      d={pathData}
                      fill="none"
                      stroke={color}
                      strokeWidth={shape.lineWidth ? (isSelected ? shape.lineWidth + 0.6 : shape.lineWidth) : (isSelected ? 1.6 : 1.0)}
                      strokeDasharray={getStrokeDash(shape.lineStyle)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </g>
                );
              }

              // 3. TRENDLINE
              if (shape.type === "trend" && shape.points.length >= 2) {
                const p1 = getCoordinates(shape.points[0]);
                const p2 = getCoordinates(shape.points[1]);
                if (!p1 || !p2) return null;

                return (
                  <g key={shape.id} data-shape-id={shape.id} className="shape-group">
                    <line
                      x1={p1.x}
                      y1={p1.y}
                      x2={p2.x}
                      y2={p2.y}
                      stroke={color}
                      strokeWidth={shape.lineWidth ? (isSelected ? shape.lineWidth + 0.8 : shape.lineWidth) : (isSelected ? 2.5 : 1.8)}
                      strokeDasharray={getStrokeDash(shape.lineStyle)}
                    />
                    {[p1, p2].map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6 : 4}
                        fill={isSelected ? "#fff" : color}
                        stroke={color}
                        strokeWidth={2}
                        data-handle="true"
                        data-shape-id={shape.id}
                        data-point-index={i}
                        style={{ cursor: "grab" }}
                      />
                    ))}
                  </g>
                );
              }

              // 4. RECTANGLE (ORDER BLOCK)
              if (shape.type === "rectangle" && shape.points.length >= 2) {
                const p1 = getCoordinates(shape.points[0]);
                const p2 = getCoordinates(shape.points[1]);
                if (!p1 || !p2) return null;

                const minX = Math.min(p1.x, p2.x);
                const minY = Math.min(p1.y, p2.y);
                const width = Math.abs(p2.x - p1.x);
                const height = Math.abs(p2.y - p1.y);

                return (
                  <g key={shape.id} data-shape-id={shape.id} className="shape-group">
                    <rect
                      x={minX}
                      y={minY}
                      width={width}
                      height={height}
                      fill={color}
                      fillOpacity={0.16}
                      stroke={color}
                      strokeWidth={shape.lineWidth ? (isSelected ? shape.lineWidth + 0.8 : shape.lineWidth) : (isSelected ? 2 : 1.4)}
                      strokeDasharray={getStrokeDash(shape.lineStyle)}
                    />
                    {[p1, p2].map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6 : 4}
                        fill={isSelected ? "#fff" : color}
                        stroke={color}
                        strokeWidth={2}
                        data-handle="true"
                        data-shape-id={shape.id}
                        data-point-index={i}
                        style={{ cursor: "grab" }}
                      />
                    ))}
                  </g>
                );
              }

              // 5. FIBONACCI RETRACEMENT
              if (shape.type === "fib" && shape.points.length >= 2) {
                const p1 = getCoordinates(shape.points[0]);
                const p2 = getCoordinates(shape.points[1]);
                if (!p1 || !p2) return null;

                const minX = Math.min(p1.x, p2.x);
                const maxX = Math.max(p1.x, p2.x);
                const y1 = p1.y;
                const y2 = p2.y;
                const priceDiff = shape.points[1].price - shape.points[0].price;

                return (
                  <g key={shape.id} data-shape-id={shape.id} className="shape-group">
                    {/* Shaded bands between levels */}
                    {FIB_LEVELS.map((lvl, i) => {
                      if (i === FIB_LEVELS.length - 1) return null;
                      const nextLvl = FIB_LEVELS[i + 1];
                      const curY = y1 + (y2 - y1) * lvl.ratio;
                      const nextY = y1 + (y2 - y1) * nextLvl.ratio;
                      const topY = Math.min(curY, nextY);
                      const bHeight = Math.abs(nextY - curY);

                      return (
                        <rect
                          key={`band-${i}`}
                          x={minX}
                          y={topY}
                          width={maxX - minX}
                          height={bHeight}
                          fill={lvl.fill}
                          stroke="none"
                        />
                      );
                    })}

                    {/* Level lines and labels */}
                    {FIB_LEVELS.map((lvl) => {
                      const y = y1 + (y2 - y1) * lvl.ratio;
                      const lvlPrice = shape.points[0].price + priceDiff * lvl.ratio;

                      return (
                        <g key={lvl.ratio}>
                          <line
                            x1={minX}
                            y1={y}
                            x2={maxX}
                            y2={y}
                            stroke={lvl.color}
                            strokeWidth={lvl.ratio === 0.618 ? 1.8 : 1}
                            strokeDasharray={lvl.ratio === 0 || lvl.ratio === 1 ? undefined : "3 2"}
                          />
                          <text
                            x={maxX + 5}
                            y={y + 3}
                            fill={lvl.color}
                            fontSize={10}
                            fontFamily="monospace"
                            fontWeight={lvl.ratio === 0.618 ? "bold" : "normal"}
                          >
                            {lvl.ratio} ({lvlPrice.toFixed(2)})
                          </text>
                        </g>
                      );
                    })}

                    {[p1, p2].map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6 : 4}
                        fill={isSelected ? "#fff" : color}
                        stroke={color}
                        strokeWidth={2}
                        data-handle="true"
                        data-shape-id={shape.id}
                        data-point-index={i}
                        style={{ cursor: "grab" }}
                      />
                    ))}
                  </g>
                );
              }

              // 6. HORIZONTAL RAY / LINE
              if (shape.type === "horizontal" && shape.points.length >= 1) {
                const p = getCoordinates(shape.points[0]);
                if (!p) return null;

                return (
                  <g key={shape.id} data-shape-id={shape.id} className="shape-group">
                    <line
                      x1={0}
                      y1={p.y}
                      x2={chartWidth}
                      y2={p.y}
                      stroke={color}
                      strokeWidth={shape.lineWidth ? (isSelected ? shape.lineWidth + 0.8 : shape.lineWidth) : (isSelected ? 2.2 : 1.5)}
                      strokeDasharray={getStrokeDash(shape.lineStyle) ?? "4 3"}
                    />
                    <rect
                      x={chartWidth - 85}
                      y={p.y - 10}
                      width={80}
                      height={20}
                      rx={3}
                      fill="#141923"
                      stroke={color}
                      strokeWidth={1}
                    />
                    <text
                      x={chartWidth - 45}
                      y={p.y + 4}
                      fill={color}
                      fontSize={11}
                      fontWeight="bold"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {shape.points[0].price.toFixed(2)}
                    </text>
                    <circle
                      cx={p.x}
                      cy={p.y}
                      r={isSelected ? 6 : 4}
                      fill={isSelected ? "#fff" : color}
                      stroke={color}
                      strokeWidth={2}
                      data-handle="true"
                      data-shape-id={shape.id}
                      data-point-index={0}
                      style={{ cursor: "grab" }}
                    />
                  </g>
                );
              }

              // 7. ANCHORED VOLUME PROFILE (AVP - بروفايل الحجم المثبّت)
              if (shape.type === "anchored_volume_profile" && shape.points.length >= 1) {
                const anchor = getCoordinates(shape.points[0]);
                if (!anchor) return null;

                const slice = candlesRef.current.filter((c) => c.openTime >= shape.points[0].time);
                const dataSlice = slice.length >= 2 ? slice : candlesRef.current.slice(-20);
                const vp = computeVolumeProfile(dataSlice, 32, 0.70);
                if (!vp) return null;

                const histWidth = Math.min(180, Math.max(90, (chartWidth - anchor.x) * 0.45));
                const startX = anchor.x;
                const maxVol = Math.max(...vp.buckets.map((b) => b.totalVolume), 1e-6);

                const minPriceY = series.current?.priceToCoordinate(vp.minPrice) ?? anchor.y + 60;
                const maxPriceY = series.current?.priceToCoordinate(vp.maxPrice) ?? anchor.y - 60;
                const topY = Math.min(minPriceY, maxPriceY);
                const botY = Math.max(minPriceY, maxPriceY);

                const pocY = series.current?.priceToCoordinate(vp.pocPrice) ?? null;
                const vahY = series.current?.priceToCoordinate(vp.vahPrice) ?? null;
                const valY = series.current?.priceToCoordinate(vp.valPrice) ?? null;

                return (
                  <g key={shape.id} data-shape-id={shape.id} className="shape-group">
                    {/* Anchor vertical dashed stem */}
                    <line
                      x1={startX}
                      y1={topY - 8}
                      x2={startX}
                      y2={botY + 8}
                      stroke={color}
                      strokeWidth={1.5}
                      strokeDasharray="4 3"
                      opacity={0.85}
                    />

                    {/* Value Area Shaded Zone */}
                    {vahY !== null && valY !== null && (
                      <rect
                        x={startX}
                        y={Math.min(vahY, valY)}
                        width={histWidth + 20}
                        height={Math.max(2, Math.abs(valY - vahY))}
                        fill="rgba(56, 189, 248, 0.05)"
                        stroke="none"
                      />
                    )}

                    {/* Volume Profile Horizontal Bars */}
                    {vp.buckets.map((b, i) => {
                      const bY = series.current?.priceToCoordinate(b.price);
                      if (bY == null || bY < -20 || bY > chartHeight + 20) return null;
                      const nextY = series.current?.priceToCoordinate(b.price + vp.step) ?? bY - 4;
                      const bHeight = Math.max(2, Math.abs(nextY - bY) - 0.5);

                      const totalW = (b.totalVolume / maxVol) * histWidth;
                      const buyRatio = b.totalVolume > 0 ? b.buyVolume / b.totalVolume : 0.5;
                      const buyW = totalW * buyRatio;
                      const sellW = Math.max(0, totalW - buyW);

                      const inVA = b.isValueArea;
                      const buyFill = inVA ? "#0284c7" : "rgba(2, 132, 199, 0.4)";
                      const sellFill = inVA ? "#f59e0b" : "rgba(245, 158, 11, 0.4)";

                      return (
                        <g key={i}>
                          <rect
                            x={startX}
                            y={bY - bHeight / 2}
                            width={buyW}
                            height={bHeight}
                            fill={buyFill}
                            opacity={inVA ? 0.9 : 0.4}
                          />
                          <rect
                            x={startX + buyW}
                            y={bY - bHeight / 2}
                            width={sellW}
                            height={bHeight}
                            fill={sellFill}
                            opacity={inVA ? 0.9 : 0.4}
                          />
                        </g>
                      );
                    })}

                    {/* VAH & VAL Rays */}
                    {vahY !== null && (
                      <>
                        <line
                          x1={startX}
                          y1={vahY}
                          x2={startX + histWidth + 40}
                          y2={vahY}
                          stroke="#38bdf8"
                          strokeWidth={1}
                          strokeDasharray="3 2"
                        />
                        <text
                          x={startX + histWidth + 44}
                          y={vahY + 3}
                          fill="#7dd3fc"
                          fontSize={9}
                          fontFamily="monospace"
                        >
                          VAH {vp.vahPrice.toFixed(2)}
                        </text>
                      </>
                    )}
                    {valY !== null && (
                      <>
                        <line
                          x1={startX}
                          y1={valY}
                          x2={startX + histWidth + 40}
                          y2={valY}
                          stroke="#38bdf8"
                          strokeWidth={1}
                          strokeDasharray="3 2"
                        />
                        <text
                          x={startX + histWidth + 44}
                          y={valY + 3}
                          fill="#7dd3fc"
                          fontSize={9}
                          fontFamily="monospace"
                        >
                          VAL {vp.valPrice.toFixed(2)}
                        </text>
                      </>
                    )}

                    {/* Golden POC Line across chart */}
                    {pocY !== null && (
                      <>
                        <line
                          x1={startX}
                          y1={pocY}
                          x2={chartWidth - 85}
                          y2={pocY}
                          stroke="#f59e0b"
                          strokeWidth={1.8}
                          strokeDasharray="6 3"
                        />
                        <rect
                          x={chartWidth - 90}
                          y={pocY - 9}
                          width={85}
                          height={18}
                          rx={3}
                          fill="#181206"
                          stroke="#f59e0b"
                          strokeWidth={1}
                        />
                        <text
                          x={chartWidth - 47}
                          y={pocY + 4}
                          fill="#fde68a"
                          fontSize={9.5}
                          fontFamily="monospace"
                          fontWeight="bold"
                          textAnchor="middle"
                        >
                          ⭐ POC {vp.pocPrice.toFixed(1)}
                        </text>
                      </>
                    )}

                    {/* Top Anchor Tag */}
                    <rect
                      x={startX}
                      y={topY - 22}
                      width={130}
                      height={18}
                      rx={3}
                      fill="#0c1422"
                      stroke={color}
                      strokeWidth={0.8}
                      opacity={0.95}
                    />
                    <text
                      x={startX + 65}
                      y={topY - 10}
                      fill="#bae6fd"
                      fontSize={9.5}
                      fontFamily="system-ui, monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      ⚓ بروفايل مثبت ({dataSlice.length} شمعة)
                    </text>

                    {/* Anchor Drag Handle */}
                    <circle
                      cx={anchor.x}
                      cy={anchor.y}
                      r={isSelected ? 7 : 5}
                      fill={isSelected ? "#fff" : color}
                      stroke={color}
                      strokeWidth={2}
                      data-handle="true"
                      data-shape-id={shape.id}
                      data-point-index={0}
                      style={{ cursor: "grab" }}
                    />
                  </g>
                );
              }

              // 8. FIXED RANGE VOLUME PROFILE (FRVP - بروفايل الحجم بنطاق ثابت)
              if (shape.type === "fixed_volume_profile" && shape.points.length >= 2) {
                const p1 = getCoordinates(shape.points[0]);
                const p2 = getCoordinates(shape.points[1]);
                if (!p1 || !p2) return null;

                const tMin = Math.min(shape.points[0].time, shape.points[1].time);
                const tMax = Math.max(shape.points[0].time, shape.points[1].time);
                const slice = candlesRef.current.filter((c) => c.openTime >= tMin && c.openTime <= tMax);
                const dataSlice = slice.length >= 2 ? slice : candlesRef.current.slice(-20);
                const vp = computeVolumeProfile(dataSlice, 32, 0.70);
                if (!vp) return null;

                const leftX = Math.min(p1.x, p2.x);
                const rightX = Math.max(p1.x, p2.x);
                const spanW = Math.max(20, rightX - leftX);

                const minPriceY = series.current?.priceToCoordinate(vp.minPrice) ?? Math.max(p1.y, p2.y);
                const maxPriceY = series.current?.priceToCoordinate(vp.maxPrice) ?? Math.min(p1.y, p2.y);
                const topY = Math.min(minPriceY, maxPriceY);
                const botY = Math.max(minPriceY, maxPriceY);
                const boxHeight = Math.max(20, botY - topY);

                const histWidth = Math.min(spanW * 0.8, 140);
                const maxVol = Math.max(...vp.buckets.map((b) => b.totalVolume), 1e-6);

                const pocY = series.current?.priceToCoordinate(vp.pocPrice) ?? null;
                const vahY = series.current?.priceToCoordinate(vp.vahPrice) ?? null;
                const valY = series.current?.priceToCoordinate(vp.valPrice) ?? null;

                return (
                  <g key={shape.id} data-shape-id={shape.id} className="shape-group">
                    {/* Bounding Box with dashed borders */}
                    <rect
                      x={leftX}
                      y={topY}
                      width={spanW}
                      height={boxHeight}
                      fill="rgba(56, 189, 248, 0.03)"
                      stroke={color}
                      strokeWidth={0.9}
                      strokeDasharray="4 3"
                    />

                    {/* Left & Right boundary vertical lines */}
                    <line x1={leftX} y1={topY} x2={leftX} y2={botY} stroke={color} strokeWidth={1.4} />
                    <line x1={rightX} y1={topY} x2={rightX} y2={botY} stroke={color} strokeWidth={1.4} />

                    {/* Value Area Shaded Zone */}
                    {vahY !== null && valY !== null && (
                      <rect
                        x={leftX}
                        y={Math.min(vahY, valY)}
                        width={spanW}
                        height={Math.max(2, Math.abs(valY - vahY))}
                        fill="rgba(56, 189, 248, 0.05)"
                        stroke="none"
                      />
                    )}

                    {/* Histogram Bars inside range */}
                    {vp.buckets.map((b, i) => {
                      const bY = series.current?.priceToCoordinate(b.price);
                      if (bY == null || bY < -20 || bY > chartHeight + 20) return null;
                      const nextY = series.current?.priceToCoordinate(b.price + vp.step) ?? bY - 4;
                      const bHeight = Math.max(2, Math.abs(nextY - bY) - 0.5);

                      const totalW = (b.totalVolume / maxVol) * histWidth;
                      const buyRatio = b.totalVolume > 0 ? b.buyVolume / b.totalVolume : 0.5;
                      const buyW = totalW * buyRatio;
                      const sellW = Math.max(0, totalW - buyW);

                      const inVA = b.isValueArea;
                      const buyFill = inVA ? "#0284c7" : "rgba(2, 132, 199, 0.4)";
                      const sellFill = inVA ? "#f59e0b" : "rgba(245, 158, 11, 0.4)";

                      return (
                        <g key={i}>
                          <rect
                            x={leftX}
                            y={bY - bHeight / 2}
                            width={buyW}
                            height={bHeight}
                            fill={buyFill}
                            opacity={inVA ? 0.9 : 0.4}
                          />
                          <rect
                            x={leftX + buyW}
                            y={bY - bHeight / 2}
                            width={sellW}
                            height={bHeight}
                            fill={sellFill}
                            opacity={inVA ? 0.9 : 0.4}
                          />
                        </g>
                      );
                    })}

                    {/* POC Line across range */}
                    {pocY !== null && (
                      <>
                        <line
                          x1={leftX}
                          y1={pocY}
                          x2={rightX + 45}
                          y2={pocY}
                          stroke="#f59e0b"
                          strokeWidth={1.8}
                          strokeDasharray="6 3"
                        />
                        <text
                          x={rightX + 50}
                          y={pocY + 4}
                          fill="#fde68a"
                          fontSize={9.5}
                          fontFamily="monospace"
                          fontWeight="bold"
                        >
                          ⭐ POC {vp.pocPrice.toFixed(1)}
                        </text>
                      </>
                    )}

                    {/* VAH & VAL lines */}
                    {vahY !== null && (
                      <line
                        x1={leftX}
                        y1={vahY}
                        x2={rightX}
                        y2={vahY}
                        stroke="#38bdf8"
                        strokeWidth={1}
                        strokeDasharray="3 2"
                      />
                    )}
                    {valY !== null && (
                      <line
                        x1={leftX}
                        y1={valY}
                        x2={rightX}
                        y2={valY}
                        stroke="#38bdf8"
                        strokeWidth={1}
                        strokeDasharray="3 2"
                      />
                    )}

                    {/* Top Summary Tag */}
                    <rect
                      x={leftX}
                      y={topY - 20}
                      width={125}
                      height={18}
                      rx={3}
                      fill="#0c1422"
                      stroke={color}
                      strokeWidth={0.8}
                      opacity={0.95}
                    />
                    <text
                      x={leftX + 62}
                      y={topY - 8}
                      fill="#7dd3fc"
                      fontSize={9.5}
                      fontFamily="system-ui, monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      📊 نطاق ثابت ({dataSlice.length} شمعة)
                    </text>

                    {/* Handles at p1 and p2 */}
                    {[p1, p2].map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6 : 4}
                        fill={isSelected ? "#fff" : color}
                        stroke={color}
                        strokeWidth={2}
                        data-handle="true"
                        data-shape-id={shape.id}
                        data-point-index={i}
                        style={{ cursor: "grab" }}
                      />
                    ))}
                  </g>
                );
              }

              // 9. PRICE RANGE (المقياس: نطاق السعر)
              if (shape.type === "price_range" && shape.points.length >= 2) {
                const p1 = getCoordinates(shape.points[0]);
                const p2 = getCoordinates(shape.points[1]);
                if (!p1 || !p2) return null;

                const priceDiff = shape.points[1].price - shape.points[0].price;
                const percent = shape.points[0].price > 0 ? (priceDiff / shape.points[0].price) * 100 : 0;
                const isUp = priceDiff >= 0;
                const rangeColor = isUp ? "#10b981" : "#ef4444";

                const leftX = Math.min(p1.x, p2.x);
                const rightX = Math.max(p1.x, p2.x);
                const boxWidth = Math.max(90, rightX - leftX);

                const topY = Math.min(p1.y, p2.y);
                const botY = Math.max(p1.y, p2.y);
                const boxHeight = Math.max(4, botY - topY);
                const midY = (topY + botY) / 2;
                const midX = leftX + boxWidth / 2;

                return (
                  <g key={shape.id} data-shape-id={shape.id} className="shape-group">
                    {/* Shaded Area between levels */}
                    <rect
                      x={leftX}
                      y={topY}
                      width={boxWidth}
                      height={boxHeight}
                      fill={rangeColor}
                      fillOpacity={0.12}
                      stroke={rangeColor}
                      strokeWidth={1}
                      strokeDasharray="4 3"
                    />

                    {/* Upper and Lower Horizontal Cap Brackets */}
                    <line x1={leftX} y1={topY} x2={leftX + boxWidth} y2={topY} stroke={rangeColor} strokeWidth={2} />
                    <line x1={leftX} y1={botY} x2={leftX + boxWidth} y2={botY} stroke={rangeColor} strokeWidth={2} />

                    {/* Vertical Measure Stem */}
                    <line x1={midX} y1={topY} x2={midX} y2={botY} stroke={rangeColor} strokeWidth={1.5} />

                    {/* Central Measurement Badge */}
                    <rect
                      x={midX - 65}
                      y={midY - 14}
                      width={130}
                      height={28}
                      rx={6}
                      fill="#0c131f"
                      stroke={rangeColor}
                      strokeWidth={1.2}
                      filter="drop-shadow(0 2px 8px rgba(0,0,0,0.6))"
                    />
                    <text
                      x={midX}
                      y={midY + 4}
                      fill={isUp ? "#6ee7b7" : "#fca5a5"}
                      fontSize={11}
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      {isUp ? "▲ +" : "▼ "}{Math.abs(priceDiff).toFixed(2)} ({isUp ? "+" : ""}{percent.toFixed(2)}%)
                    </text>

                    {/* Handles at p1 and p2 */}
                    {[p1, p2].map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6 : 4}
                        fill={isSelected ? "#fff" : rangeColor}
                        stroke={rangeColor}
                        strokeWidth={2}
                        data-handle="true"
                        data-shape-id={shape.id}
                        data-point-index={i}
                        style={{ cursor: "grab" }}
                      />
                    ))}
                  </g>
                );
              }

              // 10. DATE RANGE (المقياس: نطاق التاريخ)
              if (shape.type === "date_range" && shape.points.length >= 2) {
                const p1 = getCoordinates(shape.points[0]);
                const p2 = getCoordinates(shape.points[1]);
                if (!p1 || !p2) return null;

                const tMin = Math.min(shape.points[0].time, shape.points[1].time);
                const tMax = Math.max(shape.points[0].time, shape.points[1].time);
                const slice = candlesRef.current.filter((c) => c.openTime >= tMin && c.openTime <= tMax);
                const barCount = slice.length;

                const durationMs = Math.abs(shape.points[1].time - shape.points[0].time);
                const totalMins = Math.round(durationMs / 60000);
                const hours = Math.floor(totalMins / 60);
                const mins = totalMins % 60;
                const days = Math.floor(hours / 24);
                const remHours = hours % 24;

                let durStr = "";
                if (days > 0) durStr = `${days}ي ${remHours}س`;
                else if (hours > 0) durStr = `${hours}س ${mins}د`;
                else durStr = `${mins}د`;

                const leftX = Math.min(p1.x, p2.x);
                const rightX = Math.max(p1.x, p2.x);
                const width = Math.max(10, rightX - leftX);
                const midX = (leftX + rightX) / 2;
                const midY = (p1.y + p2.y) / 2;

                return (
                  <g key={shape.id} data-shape-id={shape.id} className="shape-group">
                    {/* Vertical Shaded Band across the chart height */}
                    <rect
                      x={leftX}
                      y={0}
                      width={width}
                      height={chartHeight}
                      fill="rgba(56, 189, 248, 0.07)"
                      stroke="#38bdf8"
                      strokeWidth={0.8}
                      strokeDasharray="4 4"
                    />

                    {/* Left and Right Vertical Cap Brackets */}
                    <line x1={leftX} y1={midY - 22} x2={leftX} y2={midY + 22} stroke="#38bdf8" strokeWidth={2.5} />
                    <line x1={rightX} y1={midY - 22} x2={rightX} y2={midY + 22} stroke="#38bdf8" strokeWidth={2.5} />

                    {/* Horizontal Measurement Stem */}
                    <line x1={leftX} y1={midY} x2={rightX} y2={midY} stroke="#38bdf8" strokeWidth={1.5} />

                    {/* Central Measurement Badge */}
                    <rect
                      x={midX - 70}
                      y={midY - 14}
                      width={140}
                      height={28}
                      rx={6}
                      fill="#0c131f"
                      stroke="#38bdf8"
                      strokeWidth={1.2}
                      filter="drop-shadow(0 2px 8px rgba(0,0,0,0.6))"
                    />
                    <text
                      x={midX}
                      y={midY + 4}
                      fill="#7dd3fc"
                      fontSize={11}
                      fontFamily="monospace"
                      fontWeight="bold"
                      textAnchor="middle"
                    >
                      📅 {barCount} شمعة · ${durStr}
                    </text>

                    {/* Handles at p1 and p2 */}
                    {[p1, p2].map((pt, i) => (
                      <circle
                        key={i}
                        cx={pt.x}
                        cy={pt.y}
                        r={isSelected ? 6 : 4}
                        fill={isSelected ? "#fff" : "#38bdf8"}
                        stroke="#38bdf8"
                        strokeWidth={2}
                        data-handle="true"
                        data-shape-id={shape.id}
                        data-point-index={i}
                        style={{ cursor: "grab" }}
                      />
                    ))}
                  </g>
                );
              }

              return null;
            })}

            {/* Live in-progress brush stroke while drawing */}
            {liveBrushPoints.length > 0 && (() => {
              const coords = liveBrushPoints.map(getCoordinates).filter(Boolean) as {
                x: number;
                y: number;
              }[];
              if (coords.length === 0) return null;
              if (coords.length === 1) {
                return (
                  <circle
                    cx={coords[0].x}
                    cy={coords[0].y}
                    r={Math.max(1, currentWidth / 2)}
                    fill={currentColor}
                  />
                );
              }
              const pathData = coords.reduce(
                (acc, pt, i) => (i === 0 ? `M ${pt.x} ${pt.y}` : `${acc} L ${pt.x} ${pt.y}`),
                ""
              );
              return (
                <path
                  d={pathData}
                  fill="none"
                  stroke={currentColor}
                  strokeWidth={currentWidth}
                  strokeDasharray={getStrokeDash(currentStyle)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="live-brush-path"
                />
              );
            })()}

            {/* In-progress draft preview */}
            {pendingPoints.current.length > 0 && (
              <g className="draft-preview">
                {pendingPoints.current.map((pt, i) => {
                  const coord = getCoordinates(pt);
                  if (!coord) return null;
                  return (
                    <g key={i}>
                      <circle
                        cx={coord.x}
                        cy={coord.y}
                        r={5}
                        fill="#f59e0b"
                        stroke="#fff"
                        strokeWidth={1.5}
                      />
                      <text x={coord.x + 8} y={coord.y - 6} fill="#f59e0b" fontSize={11} fontWeight="bold">
                        {activeTool === "butterfly" ? ["X", "A", "B", "C", "D"][i] : i + 1}
                      </text>
                    </g>
                  );
                })}
              </g>
            )}
          </>
        )}
      </svg>
    </>
  );
}
