"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { Trade, Candle } from "@/lib/replay";
import { Mic, Award, X, Sparkles, Brain } from "lucide-react";

interface ChartTradeMarkersProps {
  chart: RefObject<IChartApi | null>;
  series: RefObject<ISeriesApi<"Candlestick"> | null>;
  candles: Candle[];
  trades: Trade[];
  visible?: boolean;
  onOpenReflection?: (trade: Trade) => void;
}

export default function ChartTradeMarkers({
  chart,
  series,
  candles,
  trades,
  visible = true,
  onOpenReflection,
}: ChartTradeMarkersProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activePopoverTrade, setActivePopoverTrade] = useState<Trade | null>(null);
  const [positions, setPositions] = useState<{ id: string; x: number; y: number }[]>([]);

  // Calculate coordinates for entry candles on chart render / scroll / zoom
  useEffect(() => {
    if (!visible) {
      setPositions([]);
      return;
    }
    let frameId = 0;
    const updatePositions = () => {
      const c = chart.current;
      const s = series.current;
      if (!c || !s || !candles.length) {
        frameId = requestAnimationFrame(updatePositions);
        return;
      }

      const nextPositions: { id: string; x: number; y: number }[] = [];

      for (const trade of trades) {
        if (!trade.entryTime || !trade.entryPrice) continue;

        // Find candle index
        let idx = candles.findIndex((b) => b.openTime === trade.entryTime);
        if (idx < 0) {
          idx = candles.findIndex((b) => b.openTime >= trade.entryTime!) - 1;
        }
        if (idx < 0) continue;

        const x = c.timeScale().logicalToCoordinate(idx as never);
        const y = s.priceToCoordinate(trade.entryPrice);

        if (x !== null && y !== null && x >= -50 && x <= c.timeScale().width() + 50) {
          nextPositions.push({ id: trade.id, x, y });
        }
      }

      setPositions(nextPositions);
      frameId = requestAnimationFrame(updatePositions);
    };

    frameId = requestAnimationFrame(updatePositions);
    return () => cancelAnimationFrame(frameId);
  }, [chart, series, candles, trades, visible]);

  if (!visible) return null;

  return (
    <div
      ref={containerRef}
      className="chart-trade-markers-container"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 4,
        overflow: "hidden",
      }}
    >
      {positions.map((pos) => {
        const trade = trades.find((t) => t.id === pos.id);
        if (!trade) return null;

        const reflection = trade.reflection;
        const grade = reflection?.setupGrade || "دخول";
        const hasAudio = Boolean(reflection?.audioNote);
        const isLong = trade.side !== "short";

        return (
          <div
            key={trade.id}
            className={`chart-trade-badge ${isLong ? "badge-long" : "badge-short"} ${
              reflection ? "has-reflection" : ""
            }`}
            style={{
              position: "absolute",
              left: `${pos.x}px`,
              top: `${isLong ? pos.y + 14 : pos.y - 32}px`,
              transform: "translateX(-50%)",
              pointerEvents: "auto",
            }}
            onClick={() => setActivePopoverTrade(trade)}
            title="انقر لعرض تفاصيل سبب الدخول والتسجيل الصوتي"
          >
            <span className="grade-text">{grade}</span>
            {hasAudio && <Mic size={11} className="badge-mic-icon" />}
          </div>
        );
      })}

      {/* Popover modal when badge is clicked */}
      {activePopoverTrade && (
        <div
          className="chart-marker-popover"
          style={{
            position: "absolute",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "auto",
          }}
          dir="rtl"
        >
          <header>
            <div className="popover-title">
              <Award size={15} className="popover-gold" />
              <strong>تحليل الصفقة {activePopoverTrade.side === "short" ? "بيع" : "شراء"}</strong>
            </div>
            <button
              className="popover-close"
              onClick={() => setActivePopoverTrade(null)}
              aria-label="إغلاق"
            >
              <X size={15} />
            </button>
          </header>

          <div className="popover-content">
            {activePopoverTrade.reflection ? (
              <>
                <div className="popover-row">
                  <span>جودة الإعداد:</span>
                  <b className="grade-tag">{activePopoverTrade.reflection.setupGrade ?? "—"}</b>
                </div>
                <div className="popover-row">
                  <span>الاستراتيجية:</span>
                  <b>{activePopoverTrade.reflection.strategy ?? "—"}</b>
                </div>
                <div className="popover-row">
                  <span>الحالة النفسية:</span>
                  <b>{activePopoverTrade.reflection.emotion ?? "—"}</b>
                </div>
                <div className="popover-row">
                  <span>الثقة:</span>
                  <b>{activePopoverTrade.reflection.confidence ?? "—"}</b>
                </div>
                {activePopoverTrade.reflection.notes && (
                  <p className="popover-notes">{activePopoverTrade.reflection.notes}</p>
                )}
                {activePopoverTrade.reflection.audioNote && (
                  <div className="popover-audio">
                    <audio src={activePopoverTrade.reflection.audioNote} controls />
                  </div>
                )}
              </>
            ) : (
              <p className="no-reflection-text">لم يتم تسجيل تحليل دخول لهذه الصفقة بعد.</p>
            )}

            <button
              className="edit-reflection-btn"
              onClick={() => {
                const tr = activePopoverTrade;
                setActivePopoverTrade(null);
                onOpenReflection?.(tr);
              }}
            >
              {activePopoverTrade.reflection ? "تعديل الملاحظات والصوت" : "إضافة تحليل وتسجيل صوتي"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
