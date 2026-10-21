"use client";

import { useEffect, useRef, type RefObject } from "react";
import type { IChartApi, ISeriesApi, IPriceLine } from "lightweight-charts";
import type { Trade } from "@/lib/replay";

type Props = {
  chart: RefObject<IChartApi | null>;
  series: RefObject<ISeriesApi<"Candlestick"> | null>;
  levels: RefObject<{
    entry?: { line: IPriceLine; price: number } | null;
    stop: { line: IPriceLine; price: number } | null;
    target: { line: IPriceLine; price: number } | null;
    takeProfits?: { id: string; line: IPriceLine; price: number; amount: number; percentage?: number }[];
  }>;
  orderType: "market" | "limit" | "stop";
  side: "long" | "short";
  entry: number;
  time: number;
  amount: number;
  status: string;
  quantity?: number | null;
  fee?: number;
  filled: boolean;
  openTrade?: Trade | null;
  onAddPartialTp?: (pct: number) => Promise<boolean | void>;
  onRemovePartialTp?: (id: string) => Promise<boolean | void>;
  onCyclePartialTp?: (id: string) => Promise<boolean | void>;
};

export default function RiskRewardOverlay(p: Props) {
  const root = useRef<HTMLDivElement>(null);
  const targetBarRef = useRef<HTMLDivElement>(null);
  const stopBarRef = useRef<HTMLDivElement>(null);
  const entryBarRef = useRef<HTMLDivElement>(null);
  const tpBarsRef = useRef<Map<string, HTMLDivElement>>(new Map());

  // Labels refs to update values smoothly without causing React re-renders on every animation frame
  const targetTextRef = useRef<HTMLSpanElement>(null);
  const targetCashRef = useRef<HTMLSpanElement>(null);
  const targetRRef = useRef<HTMLSpanElement>(null);
  const stopTextRef = useRef<HTMLSpanElement>(null);
  const stopCashRef = useRef<HTMLSpanElement>(null);
  const entryTextRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let frame = 0;

    const render = () => {
      const chart = p.chart.current;
      const series = p.series.current;
      const host = root.current;

      if (chart && series && host) {
        const stop = p.levels.current.stop?.price;
        const target = p.levels.current.target?.price;
        const entry = p.levels.current.entry?.price ?? p.entry;

        const y = series.priceToCoordinate(entry);
        const sy = stop ? series.priceToCoordinate(stop) : null;
        const ty = target ? series.priceToCoordinate(target) : null;
        const chartHeight = chart.timeScale().height();

        // 1. Target Handle Bar
        if (targetBarRef.current) {
          if (ty !== null && ty >= -40 && ty <= chartHeight + 40) {
            targetBarRef.current.style.display = "flex";
            targetBarRef.current.style.top = `${ty}px`;
            if (target && entry) {
              const targetPct = entry > 0 ? (Math.abs(target - entry) / entry) * 100 : 0;
              const targetUsdt = (p.amount * targetPct) / 100;
              const stopDiff = stop ? Math.abs(entry - stop) : 0;
              const targetDiff = Math.abs(target - entry);
              const rRatio = stopDiff > 0 ? (targetDiff / stopDiff).toFixed(2) : "1.00";
              if (targetTextRef.current) targetTextRef.current.textContent = `هدف +${targetPct.toFixed(2)}%`;
              if (targetCashRef.current) targetCashRef.current.textContent = `+${targetUsdt.toFixed(2)}$`;
              if (targetRRef.current) targetRRef.current.textContent = `R:${rRatio}`;
            }
          } else {
            targetBarRef.current.style.display = "none";
          }
        }

        // 2. Stop Loss Handle Bar
        if (stopBarRef.current) {
          if (sy !== null && sy >= -40 && sy <= chartHeight + 40) {
            stopBarRef.current.style.display = "flex";
            stopBarRef.current.style.top = `${sy}px`;
            if (stop && entry) {
              const stopPct = entry > 0 ? (Math.abs(entry - stop) / entry) * 100 : 0;
              const stopUsdt = (p.amount * stopPct) / 100;
              if (stopTextRef.current) stopTextRef.current.textContent = `وقف −${stopPct.toFixed(2)}%`;
              if (stopCashRef.current) stopCashRef.current.textContent = `−${stopUsdt.toFixed(2)}$`;
            }
          } else {
            stopBarRef.current.style.display = "none";
          }
        }

        // 3. Entry Handle Bar
        if (entryBarRef.current) {
          if (y !== null && y >= -40 && y <= chartHeight + 40) {
            entryBarRef.current.style.display = "flex";
            entryBarRef.current.style.top = `${y}px`;
            if (entryTextRef.current) entryTextRef.current.textContent = `دخول $${entry.toFixed(2)}`;
          } else {
            entryBarRef.current.style.display = "none";
          }
        }

        // 4. Partial Take-Profit Levels Handle Bars
        const activeTps = p.openTrade?.takeProfitLevels?.filter((x) => !x.filled) ?? [];
        for (const tp of activeTps) {
          const el = tpBarsRef.current.get(tp.id);
          if (el) {
            const py = series.priceToCoordinate(tp.price);
            if (py !== null && py >= -40 && py <= chartHeight + 40) {
              el.style.display = "flex";
              el.style.top = `${py}px`;
            } else {
              el.style.display = "none";
            }
          }
        }
      }

      frame = requestAnimationFrame(render);
    };

    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [p.chart, p.series, p.levels, p.entry, p.amount, p.openTrade?.takeProfitLevels]);

  const activeTps = p.openTrade?.takeProfitLevels?.filter((x) => !x.filled) ?? [];

  return (
    <div className="risk-reward-overlay minimal-clean" ref={root} aria-label="أدوات إدارة الصفقة على الشارت">
      {/* مقبض وشريط الهدف الرئيسي */}
      <div ref={targetBarRef} className="edge-handle-bar target-bar">
        <button
          type="button"
          data-risk-handle="target"
          aria-label="اسحب الهدف"
          className="edge-pill target-pill"
          title="اسحب بالفأرة لتعديل الهدف مباشرة"
        >
          <span className="pill-drag-icon">↕</span>
          <span ref={targetTextRef} className="pill-title">هدف</span>
          <span ref={targetCashRef} className="pill-cash"></span>
          <span ref={targetRRef} className="pill-r"></span>
        </button>

        {p.openTrade && p.openTrade.status === "open" && (
          <div className="inline-tp-quick-add">
            <button
              type="button"
              className="tp-add-chip"
              onClick={(e) => {
                e.stopPropagation();
                void p.onAddPartialTp?.(20);
              }}
              title="إضافة خط هدف لسحب 20% من الأرباح"
            >
              +20%
            </button>
            <button
              type="button"
              className="tp-add-chip"
              onClick={(e) => {
                e.stopPropagation();
                void p.onAddPartialTp?.(50);
              }}
              title="إضافة خط هدف لسحب 50% من الأرباح"
            >
              +50%
            </button>
          </div>
        )}
      </div>

      {/* مقابض وأشرطة أهداف سحب الأرباح الجزئية */}
      {activeTps.map((level) => (
        <div
          key={level.id}
          ref={(node) => {
            if (node) tpBarsRef.current.set(level.id, node);
            else tpBarsRef.current.delete(level.id);
          }}
          className="edge-handle-bar partial-tp-bar"
        >
          <button
            type="button"
            data-risk-handle={`tp-${level.id}`}
            aria-label={`اسحب هدف سحب ${level.percentage || 20}%`}
            className="edge-pill partial-tp-pill"
            title="اسحب بالفأرة لتعديل مستوى هذا الهدف"
          >
            <span className="pill-drag-icon">↕</span>
            <span
              className="pill-badge-pct"
              onClick={(e) => {
                e.stopPropagation();
                void p.onCyclePartialTp?.(level.id);
              }}
              title="انقر لتبديل نسبة السحب (20% / 33% / 50% / 100%)"
            >
              سحب {level.percentage ? `${level.percentage}%` : "جزئي"}
            </span>
            <span className="pill-cash">+{level.amount.toFixed(2)}$</span>
          </button>
          <button
            type="button"
            className="tp-delete-chip"
            onClick={(e) => {
              e.stopPropagation();
              void p.onRemovePartialTp?.(level.id);
            }}
            title="إلغاء هذا الهدف وحذفه من الصفقة"
          >
            ✕
          </button>
        </div>
      ))}

      {/* مقبض وشريط وقف الخسارة */}
      <div ref={stopBarRef} className="edge-handle-bar stop-bar">
        <button
          type="button"
          data-risk-handle="stop"
          aria-label="اسحب الوقف"
          className="edge-pill stop-pill"
          title="اسحب بالفأرة لتعديل وقف الخسارة مباشرة"
        >
          <span className="pill-drag-icon">↕</span>
          <span ref={stopTextRef} className="pill-title">وقف</span>
          <span ref={stopCashRef} className="pill-cash"></span>
        </button>
      </div>

      {/* مقبض وشريط الدخول */}
      <div ref={entryBarRef} className="edge-handle-bar entry-bar">
        <button
          type="button"
          data-risk-handle="entry"
          disabled={!p.levels.current.entry}
          className="edge-pill entry-pill"
          title={p.levels.current.entry ? "اسحب لتعديل سعر الدخول" : "سعر الدخول"}
        >
          <span ref={entryTextRef} className="pill-title">دخول</span>
          <span className="pill-meta">{p.amount} USDT</span>
        </button>
      </div>
    </div>
  );
}
