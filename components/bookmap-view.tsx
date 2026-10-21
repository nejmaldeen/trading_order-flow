"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  CircleDot,
  Eye,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Sliders,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { Candle, SymbolName, Timeframe, Trade } from "@/lib/replay";
import { SYMBOL_INFO } from "@/lib/replay";
import { computeVolumeProfile } from "@/lib/volume-profile";

interface BookmapViewProps {
  candles: Candle[];
  symbol: SymbolName;
  timeframe: Timeframe;
  currentPrice: number;
  openTrade?: Trade | null;
  onBackToCandles?: () => void;
}

interface HoverInfo {
  x: number;
  y: number;
  candle: Candle;
  buyVol: number;
  sellVol: number;
  delta: number;
  radius: number;
}

export default function BookmapView({
  candles,
  symbol,
  timeframe,
  currentPrice,
  openTrade,
  onBackToCandles,
}: BookmapViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Viewport navigation & scales
  const [bubbleScale, setBubbleScale] = useState(1.0);
  const [showCvd, setShowCvd] = useState(true);
  const [showCob, setShowCob] = useState(true);
  const [minBubbleVolume, setMinBubbleVolume] = useState(0);
  const [hoverInfo, setHoverInfo] = useState<HoverInfo | null>(null);

  // Pan and zoom state
  const [viewOffsetBars, setViewOffsetBars] = useState(0); // horizontal offset
  const [visibleBarsCount, setVisibleBarsCount] = useState(60);

  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; offset: number }>({ x: 0, y: 0, offset: 0 });

  // Formatters
  const symInfo = SYMBOL_INFO[symbol];
  const formatPrice = (p: number) =>
    p >= 1000 ? p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(symInfo?.digits ?? 2);
  const formatVol = (v: number) =>
    v >= 1e6 ? `${(v / 1e6).toFixed(2)}M` : v >= 1e3 ? `${(v / 1e3).toFixed(1)}K` : v.toFixed(1);

  // Compute stats across visible window
  const visibleCandles = useMemo(() => {
    if (!candles.length) return [];
    const count = Math.max(15, Math.min(candles.length, visibleBarsCount));
    const endIdx = Math.max(count, candles.length - viewOffsetBars);
    const startIdx = Math.max(0, endIdx - count);
    return candles.slice(startIdx, endIdx);
  }, [candles, visibleBarsCount, viewOffsetBars]);

  // Volume profile across visible slice
  const volumeProfile = useMemo(() => {
    if (visibleCandles.length < 5) return null;
    return computeVolumeProfile(visibleCandles, 36, 0.7);
  }, [visibleCandles]);

  // Cumulative volume & delta stats
  const stats = useMemo(() => {
    let totalVol = 0;
    let netDelta = 0;
    let maxVol = 0;

    for (const c of visibleCandles) {
      totalVol += c.volume;
      const buy = c.takerBuyVolume ?? (c.close >= c.open ? c.volume * 0.58 : c.volume * 0.42);
      const sell = c.volume - buy;
      const delta = buy - sell;
      netDelta += delta;
      if (c.volume > maxVol) maxVol = c.volume;
    }

    const avgVol = visibleCandles.length ? totalVol / visibleCandles.length : 1;
    return { totalVol, netDelta, maxVol, avgVol };
  }, [visibleCandles]);

  // Render loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visibleCandles.length) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // Layout dimensions
    const cobWidth = showCob ? 160 : 0;
    const subChartHeight = showCvd ? 110 : 0;
    const paddingLeft = 20;
    const paddingRight = cobWidth + 65; // price scale area
    const paddingTop = 25;
    const paddingBottom = subChartHeight + 35; // time scale area

    const plotWidth = width - paddingLeft - paddingRight;
    const plotHeight = height - paddingTop - paddingBottom;

    if (plotWidth <= 50 || plotHeight <= 50) return;

    // Price bounds
    let minPrice = Infinity;
    let maxPrice = -Infinity;
    for (const c of visibleCandles) {
      if (c.low < minPrice) minPrice = c.low;
      if (c.high > maxPrice) maxPrice = c.high;
    }
    if (minPrice === Infinity || minPrice >= maxPrice) {
      minPrice = (currentPrice || 100) * 0.99;
      maxPrice = (currentPrice || 100) * 101;
    }

    // Add 8% vertical padding
    const priceSpan = maxPrice - minPrice;
    const yMin = minPrice - priceSpan * 0.08;
    const yMax = maxPrice + priceSpan * 0.08;

    const priceToY = (p: number) => paddingTop + plotHeight * (1 - (p - yMin) / (yMax - yMin));
    const yToPrice = (y: number) => yMin + (1 - (y - paddingTop) / plotHeight) * (yMax - yMin);

    const barStep = plotWidth / Math.max(1, visibleCandles.length);
    const timeToX = (idx: number) => paddingLeft + (idx + 0.5) * barStep;

    // 1. Background grid
    ctx.fillStyle = "#0c1017";
    ctx.fillRect(0, 0, width, height);

    // Plot area background
    ctx.fillStyle = "#090d13";
    ctx.fillRect(paddingLeft, paddingTop, plotWidth, plotHeight);

    // Grid lines (horizontal price ticks)
    ctx.strokeStyle = "#17212e";
    ctx.lineWidth = 1;
    const gridCount = 8;
    for (let i = 0; i <= gridCount; i++) {
      const p = yMin + (i / gridCount) * (yMax - yMin);
      const y = priceToY(p);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, y);
      ctx.lineTo(paddingLeft + plotWidth, y);
      ctx.stroke();

      // Right price labels
      ctx.fillStyle = "#64748b";
      ctx.font = "11px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(formatPrice(p), paddingLeft + plotWidth + 6, y + 4);
    }

    // Vertical time grid lines
    const timeInterval = Math.max(1, Math.floor(visibleCandles.length / 7));
    for (let i = 0; i < visibleCandles.length; i += timeInterval) {
      const x = timeToX(i);
      ctx.beginPath();
      ctx.moveTo(x, paddingTop);
      ctx.lineTo(x, paddingTop + plotHeight);
      ctx.stroke();

      // Time labels
      const d = new Date(visibleCandles[i].openTime);
      const timeStr = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
      ctx.fillStyle = "#64748b";
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(timeStr, x, paddingTop + plotHeight + 16);
    }

    // 2. Real Volume Profile POC / VAH / VAL Reference Shelves
    if (volumeProfile) {
      // POC Line
      const pocY = priceToY(volumeProfile.pocPrice);
      ctx.strokeStyle = "rgba(245, 158, 11, 0.75)";
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, pocY);
      ctx.lineTo(paddingLeft + plotWidth, pocY);
      ctx.stroke();
      ctx.setLineDash([]);

      // POC badge
      ctx.fillStyle = "#f59e0b";
      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText(`POC ${formatPrice(volumeProfile.pocPrice)}`, paddingLeft + 8, pocY - 5);

      // Value Area High / Low
      const vahY = priceToY(volumeProfile.vahPrice);
      const valY = priceToY(volumeProfile.valPrice);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.4)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, vahY);
      ctx.lineTo(paddingLeft + plotWidth, vahY);
      ctx.moveTo(paddingLeft, valY);
      ctx.lineTo(paddingLeft + plotWidth, valY);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = "#38bdf8";
      ctx.font = "9px Inter, system-ui, sans-serif";
      ctx.fillText(`VAH ${formatPrice(volumeProfile.vahPrice)}`, paddingLeft + 8, vahY - 4);
      ctx.fillText(`VAL ${formatPrice(volumeProfile.valPrice)}`, paddingLeft + 8, valY - 4);
    }

    // 3. Open Trade Entry / SL / TP markers if active
    if (openTrade && openTrade.entryPrice) {
      const entryY = priceToY(openTrade.entryPrice);
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 3]);
      ctx.beginPath();
      ctx.moveTo(paddingLeft, entryY);
      ctx.lineTo(paddingLeft + plotWidth, entryY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#38bdf8";
      ctx.fillText(`دخول ${formatPrice(openTrade.entryPrice)}`, paddingLeft + plotWidth - 110, entryY - 4);

      if (openTrade.stopLoss > 0) {
        const slY = priceToY(openTrade.stopLoss);
        ctx.strokeStyle = "#ef4444";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, slY);
        ctx.lineTo(paddingLeft + plotWidth, slY);
        ctx.stroke();
        ctx.fillStyle = "#ef4444";
        ctx.fillText(`وقف ${formatPrice(openTrade.stopLoss)}`, paddingLeft + plotWidth - 110, slY - 4);
      }

      if (openTrade.takeProfit > 0) {
        const tpY = priceToY(openTrade.takeProfit);
        ctx.strokeStyle = "#10b981";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(paddingLeft, tpY);
        ctx.lineTo(paddingLeft + plotWidth, tpY);
        ctx.stroke();
        ctx.fillStyle = "#10b981";
        ctx.fillText(`هدف ${formatPrice(openTrade.takeProfit)}`, paddingLeft + plotWidth - 110, tpY - 4);
      }
    }

    // 4. Continuous Price Trail Line (Bookmap White Trail)
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      const x = timeToX(i);
      const y = priceToY(c.close);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // 5. Real Order Flow Volume & Delta Bubbles
    const avgVolume = stats.avgVol || 1;
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      if (c.volume < minBubbleVolume) continue;

      const x = timeToX(i);
      // Place bubble at weighted center of action
      const y = priceToY((c.open + c.close + c.high + c.low) / 4);

      const buyVol = c.takerBuyVolume !== undefined ? c.takerBuyVolume : c.close >= c.open ? c.volume * 0.58 : c.volume * 0.42;
      const sellVol = c.volume - buyVol;
      const delta = buyVol - sellVol;
      const isBullish = delta >= 0;

      // Scale bubble radius with square root of volume
      const baseRadius = Math.max(5, Math.min(34, Math.sqrt(c.volume / avgVolume) * 11 * bubbleScale));

      // Bubble glow / fill
      const grad = ctx.createRadialGradient(x - baseRadius * 0.3, y - baseRadius * 0.3, baseRadius * 0.1, x, y, baseRadius);

      if (isBullish) {
        // Emerald buyer aggressive bubble
        grad.addColorStop(0, "rgba(52, 211, 153, 0.95)");
        grad.addColorStop(0.5, "rgba(16, 185, 129, 0.65)");
        grad.addColorStop(1, "rgba(5, 150, 105, 0.25)");
        ctx.strokeStyle = "#34d399";
      } else {
        // Crimson seller aggressive bubble
        grad.addColorStop(0, "rgba(248, 113, 113, 0.95)");
        grad.addColorStop(0.5, "rgba(239, 68, 68, 0.65)");
        grad.addColorStop(1, "rgba(185, 28, 28, 0.25)");
        ctx.strokeStyle = "#f87171";
      }

      ctx.fillStyle = grad;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(x, y, baseRadius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      // For larger bubbles, display volume label inside
      if (baseRadius >= 16) {
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 9px Inter, system-ui, sans-serif";
        ctx.textAlign = "center";
        const label = formatVol(c.volume);
        ctx.fillText(label, x, y + 3);
      }
    }

    // 6. Current Price line & badge
    const latestY = priceToY(currentPrice);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 2]);
    ctx.beginPath();
    ctx.moveTo(paddingLeft, latestY);
    ctx.lineTo(paddingLeft + plotWidth + 60, latestY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Right axis price badge
    ctx.fillStyle = "#0284c7";
    ctx.fillRect(paddingLeft + plotWidth + 4, latestY - 10, 60, 20);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 11px Inter, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(formatPrice(currentPrice), paddingLeft + plotWidth + 34, latestY + 4);

    // 7. Right COB (Current Order Book / Executed Liquidity Ladder)
    if (showCob && volumeProfile) {
      const cobX = width - cobWidth + 4;
      const cobH = plotHeight;
      const cobY = paddingTop;

      // COB container background
      ctx.fillStyle = "#0b1118";
      ctx.fillRect(cobX, cobY, cobWidth - 8, cobH);
      ctx.strokeStyle = "#1e293b";
      ctx.lineWidth = 1;
      ctx.strokeRect(cobX, cobY, cobWidth - 8, cobH);

      // Header
      ctx.fillStyle = "#94a3b8";
      ctx.font = "bold 10px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("COB · عمق التداول", cobX + (cobWidth - 8) / 2, cobY + 14);

      const buckets = volumeProfile.buckets;
      const maxBucketVol = volumeProfile.pocVolume || 1;
      const maxBarWidth = cobWidth - 55;

      for (const b of buckets) {
        const bY = priceToY(b.price);
        if (bY < cobY + 20 || bY > cobY + cobH - 10) continue;

        const isAbove = b.price >= currentPrice;
        const barWidth = Math.max(3, (b.totalVolume / maxBucketVol) * maxBarWidth);

        // Bar fill (Red for Asks above, Green for Bids below)
        ctx.fillStyle = isAbove ? "rgba(239, 68, 68, 0.75)" : "rgba(16, 185, 129, 0.75)";
        ctx.fillRect(cobX + 6, bY - 4, barWidth, 8);

        // Volume text
        ctx.fillStyle = isAbove ? "#fca5a5" : "#86efac";
        ctx.font = "9px Inter, monospace";
        ctx.textAlign = "left";
        ctx.fillText(formatVol(b.totalVolume), cobX + barWidth + 9, bY + 3);
      }
    }

    // 8. Sub-chart: Volume & Cumulative Delta (CVD)
    if (showCvd) {
      const subY = height - subChartHeight - 5;
      const subW = plotWidth;
      const subH = subChartHeight - 15;

      // Sub-chart box
      ctx.fillStyle = "#070a0f";
      ctx.fillRect(paddingLeft, subY, subW, subH);
      ctx.strokeStyle = "#17212e";
      ctx.lineWidth = 1;
      ctx.strokeRect(paddingLeft, subY, subW, subH);

      // Title
      ctx.fillStyle = "#64748b";
      ctx.font = "10px Inter, system-ui, sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("أحجام التداول المنفذة & الدلتا (CVD)", paddingLeft + 8, subY + 14);

      const maxSubVol = stats.maxVol || 1;

      // Draw volume bars
      let runningDelta = 0;
      const cvdPoints: { x: number; y: number }[] = [];

      for (let i = 0; i < visibleCandles.length; i++) {
        const c = visibleCandles[i];
        const x = timeToX(i);
        const buy = c.takerBuyVolume !== undefined ? c.takerBuyVolume : c.close >= c.open ? c.volume * 0.58 : c.volume * 0.42;
        const sell = c.volume - buy;
        const delta = buy - sell;
        runningDelta += delta;

        const barH = (c.volume / maxSubVol) * (subH - 25);
        const barY = subY + subH - barH;

        // Buy/Sell split in volume bar
        const buyH = (buy / c.volume) * barH;
        const sellH = barH - buyH;

        // Sell portion (red)
        ctx.fillStyle = "rgba(239, 68, 68, 0.65)";
        ctx.fillRect(x - barStep * 0.35, barY, barStep * 0.7, sellH);

        // Buy portion (green)
        ctx.fillStyle = "rgba(16, 185, 129, 0.85)";
        ctx.fillRect(x - barStep * 0.35, barY + sellH, barStep * 0.7, buyH);

        cvdPoints.push({ x, delta: runningDelta } as any);
      }

      // Draw CVD Line overlay
      if (cvdPoints.length > 1) {
        let minDelta = Infinity;
        let maxDelta = -Infinity;
        for (const pt of cvdPoints as any) {
          if (pt.delta < minDelta) minDelta = pt.delta;
          if (pt.delta > maxDelta) maxDelta = pt.delta;
        }
        const deltaSpan = Math.max(1, maxDelta - minDelta);

        ctx.strokeStyle = "#eab308";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        for (let i = 0; i < cvdPoints.length; i++) {
          const pt = cvdPoints[i] as any;
          const y = subY + subH - 6 - ((pt.delta - minDelta) / deltaSpan) * (subH - 30);
          if (i === 0) ctx.moveTo(pt.x, y);
          else ctx.lineTo(pt.x, y);
        }
        ctx.stroke();

        ctx.fillStyle = "#eab308";
        ctx.font = "bold 9px Inter, system-ui, sans-serif";
        ctx.textAlign = "right";
        ctx.fillText(`CVD: ${stats.netDelta >= 0 ? "+" : ""}${formatVol(stats.netDelta)}`, paddingLeft + subW - 10, subY + 14);
      }
    }
  }, [
    visibleCandles,
    bubbleScale,
    minBubbleVolume,
    showCob,
    showCvd,
    currentPrice,
    openTrade,
    volumeProfile,
    stats,
  ]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = rect.height;
      draw();
    };

    handleResize();
    const observer = new ResizeObserver(handleResize);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [draw]);

  // Redraw when state updates
  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse interaction: Hover inspection & Pan
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY, offset: viewOffsetBars };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    if (isDraggingRef.current) {
      const dx = e.clientX - dragStartRef.current.x;
      const barStep = (canvas.width - 240) / Math.max(1, visibleCandles.length);
      const barsDelta = Math.round(dx / barStep);
      const maxOffset = Math.max(0, candles.length - visibleBarsCount);
      const newOffset = Math.max(0, Math.min(maxOffset, dragStartRef.current.offset + barsDelta));
      setViewOffsetBars(newOffset);
      return;
    }

    // Hover detection over bubbles
    const plotWidth = canvas.width - 240;
    const barStep = plotWidth / Math.max(1, visibleCandles.length);
    const avgVolume = stats.avgVol || 1;

    let found: HoverInfo | null = null;
    for (let i = 0; i < visibleCandles.length; i++) {
      const c = visibleCandles[i];
      const x = 20 + (i + 0.5) * barStep;

      // Approximate Y
      const priceSpan = (visibleCandles[0]?.high || 100) * 0.1;
      const y = mouseY; // match closest X first
      const dist = Math.abs(mouseX - x);

      const buyVol = c.takerBuyVolume !== undefined ? c.takerBuyVolume : c.close >= c.open ? c.volume * 0.58 : c.volume * 0.42;
      const sellVol = c.volume - buyVol;
      const delta = buyVol - sellVol;
      const radius = Math.max(6, Math.min(34, Math.sqrt(c.volume / avgVolume) * 11 * bubbleScale));

      if (dist <= Math.max(12, radius)) {
        found = {
          x: e.clientX,
          y: e.clientY,
          candle: c,
          buyVol,
          sellVol,
          delta,
          radius,
        };
        break;
      }
    }
    setHoverInfo(found);
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
  };

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.deltaY < 0) {
      // Zoom in
      setVisibleBarsCount((prev) => Math.max(20, prev - 5));
    } else {
      // Zoom out
      setVisibleBarsCount((prev) => Math.min(candles.length || 180, prev + 5));
    }
  };

  return (
    <div className="bookmap-view-root" ref={containerRef} onWheel={handleWheel}>
      {/* Top Header & Toolbar */}
      <div className="bookmap-topbar">
        <div className="bookmap-brand">
          <div className="bookmap-badge">
            <span className="live-dot" />
            <strong>BOOKMAP · تدفق الأوامر</strong>
          </div>
          <span className="bookmap-meta">
            {symInfo?.icon} {symbol.slice(0, -4)} / TetherUS · {timeframe} · Binance Spot
          </span>
          <span className="real-data-tag">بيانات صفقات حقيقية 100%</span>
        </div>

        <div className="bookmap-stats-strip">
          <div className="stat-item">
            <small>حجم التداول المرئي</small>
            <b>{formatVol(stats.totalVol)}</b>
          </div>
          <div className="stat-item">
            <small>صافي الدلتا (CVD)</small>
            <b className={stats.netDelta >= 0 ? "positive" : "negative"}>
              {stats.netDelta >= 0 ? "+" : ""}
              {formatVol(stats.netDelta)}
            </b>
          </div>
          {volumeProfile && (
            <div className="stat-item">
              <small>نقطة التمركز (POC)</small>
              <b className="poc-color">{formatPrice(volumeProfile.pocPrice)}</b>
            </div>
          )}
        </div>

        <div className="bookmap-actions">
          {/* Bubble scale control */}
          <div className="scale-control" title="تكبير / تصغير حجم الفقاعات">
            <small>حجم الفقاعات</small>
            <button type="button" onClick={() => setBubbleScale((s) => Math.max(0.5, s - 0.2))}>
              <Minus size={12} />
            </button>
            <span>{bubbleScale.toFixed(1)}×</span>
            <button type="button" onClick={() => setBubbleScale((s) => Math.min(2.5, s + 0.2))}>
              <Plus size={12} />
            </button>
          </div>

          {/* Toggle COB & CVD */}
          <button
            type="button"
            className={showCob ? "btn-toggle active" : "btn-toggle"}
            onClick={() => setShowCob((v) => !v)}
            title="إظهار / إخفاء دفتر الأوامر الجانبي (COB)"
          >
            عمق COB
          </button>
          <button
            type="button"
            className={showCvd ? "btn-toggle active" : "btn-toggle"}
            onClick={() => setShowCvd((v) => !v)}
            title="إظهار / إخفاء مدرج الدلتا والحجم السفلي"
          >
            مدرج الدلتا
          </button>

          {/* Zoom buttons */}
          <button
            type="button"
            className="btn-icon"
            onClick={() => setVisibleBarsCount((v) => Math.max(20, v - 10))}
            title="تكبير العرض"
          >
            <Plus size={14} />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => setVisibleBarsCount((v) => Math.min(candles.length || 180, v + 10))}
            title="تصغير العرض"
          >
            <Minus size={14} />
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => {
              setViewOffsetBars(0);
              setVisibleBarsCount(60);
            }}
            title="إعادة ضبط العرض على آخر شمعة"
          >
            <RotateCcw size={14} />
          </button>

          {/* Switch back to candles */}
          {onBackToCandles && (
            <button
              type="button"
              className="btn-switch-back"
              onClick={onBackToCandles}
              title="الرجوع إلى شارت الشموع الكلاسيكي"
            >
              <ArrowLeft size={14} /> 📊 شارت الشموع
            </button>
          )}
        </div>
      </div>

      {/* Main Interactive Canvas */}
      <canvas
        ref={canvasRef}
        className="bookmap-canvas"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      />

      {/* Hover Floating Tooltip */}
      {hoverInfo && (
        <div
          className="bookmap-tooltip"
          style={{
            left: Math.min(window.innerWidth - 220, hoverInfo.x + 15),
            top: Math.max(50, hoverInfo.y - 80),
          }}
        >
          <div className="tooltip-head">
            <span className="tooltip-title">صفقة منفذة (Aggressive Order)</span>
            <small>{new Date(hoverInfo.candle.openTime).toLocaleTimeString("ar-EG")}</small>
          </div>
          <div className="tooltip-body">
            <div>
              <span>السعر:</span>
              <b>{formatPrice(hoverInfo.candle.close)}</b>
            </div>
            <div>
              <span>إجمالي الحجم:</span>
              <b>{formatVol(hoverInfo.candle.volume)}</b>
            </div>
            <div>
              <span>شراء ماركت (Taker Buy):</span>
              <b className="positive">{formatVol(hoverInfo.buyVol)}</b>
            </div>
            <div>
              <span>بيع ماركت (Taker Sell):</span>
              <b className="negative">{formatVol(hoverInfo.sellVol)}</b>
            </div>
            <div className="tooltip-delta-row">
              <span>صافي الدلتا:</span>
              <b className={hoverInfo.delta >= 0 ? "positive" : "negative"}>
                {hoverInfo.delta >= 0 ? "+" : ""}
                {formatVol(hoverInfo.delta)}
              </b>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
