"use client";

import React, { useMemo } from "react";
import type { Candle } from "@/lib/replay";
import { estimateCandleDelta, computeCVDSeries } from "@/lib/orderflow";
import { Zap, ShieldAlert, BarChart3, TrendingUp, X } from "lucide-react";

interface DeepStatsGridProps {
  candles: Candle[];
  visible: boolean;
  onClose?: () => void;
  maxBars?: number;
}

export interface BarStatItem {
  time: number;
  timeStr: string;
  volume: number;
  volStr: string;
  buyVol: number;
  sellVol: number;
  delta: number;
  deltaStr: string;
  deltaPct: number;
  cvd: number;
  isOutlierVol: boolean;
  isAbsorption: boolean;
  isDeltaFlip: boolean;
  signalTag: string | null;
  candle: Candle;
}

export default function DeepStatsGrid({
  candles,
  visible,
  onClose,
  maxBars = 20,
}: DeepStatsGridProps) {
  const stats = useMemo(() => {
    if (!candles.length) return [];
    const slice = candles.slice(-maxBars);
    const cvdSeries = computeCVDSeries(slice);

    // Compute average volume for outlier detection
    const avgVol = slice.reduce((sum, c) => sum + c.volume, 0) / (slice.length || 1);

    const items: BarStatItem[] = slice.map((c, i) => {
      const { buyVol, sellVol, delta } = estimateCandleDelta(c);
      const cvd = cvdSeries[i]?.cumulativeDelta ?? 0;
      const vol = c.volume;
      const deltaPct = vol > 0 ? (delta / vol) * 100 : 0;

      // Volume formatting (e.g. 8.3K, 12K, 850)
      const volStr = vol >= 1000 ? `${(vol / 1000).toFixed(1)}K` : Math.round(vol).toString();
      const deltaStr = delta > 0 ? `+${Math.round(delta)}` : `${Math.round(delta)}`;

      // Outlier volume: > 1.8x average volume
      const isOutlierVol = vol >= avgVol * 1.8;

      // Absorption: negative delta with flat or bullish close, or long lower wick
      const span = Math.max(c.high - c.low, 1e-8);
      const lowerWick = Math.min(c.open, c.close) - c.low;
      const isAbsorption = delta < -vol * 0.15 && (c.close >= c.open || lowerWick / span > 0.35);

      // Delta Flip: previous bar negative delta, current bar strong positive delta with high volume
      const prevDelta = i > 0 ? estimateCandleDelta(slice[i - 1]).delta : 0;
      const isDeltaFlip = prevDelta < 0 && delta > 0 && isOutlierVol;

      let signalTag: string | null = null;
      if (isDeltaFlip) signalTag = "انقلاب دلتا ⚡";
      else if (isAbsorption) signalTag = "امتصاص بيع 🛡️";
      else if (isOutlierVol && delta > 0) signalTag = "اندفاع شرائي 🚀";
      else if (isOutlierVol && delta < 0) signalTag = "ضغط بيعي 🔴";

      const d = new Date(c.openTime);
      const timeStr = `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;

      return {
        time: c.openTime,
        timeStr,
        volume: vol,
        volStr,
        buyVol,
        sellVol,
        delta,
        deltaStr,
        deltaPct,
        cvd,
        isOutlierVol,
        isAbsorption,
        isDeltaFlip,
        signalTag,
        candle: c,
      };
    });

    return items;
  }, [candles, maxBars]);

  if (!visible || !stats.length) return null;

  return (
    <div
      className="deep-stats-grid-container"
      dir="ltr"
      style={{
        position: "relative",
        background: "rgba(11, 15, 23, 0.95)",
        border: "1px solid #1e293b",
        borderTop: "2px solid #38bdf8",
        borderRadius: "8px",
        padding: "8px 12px",
        margin: "6px 0",
        backdropFilter: "blur(8px)",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5)",
        fontSize: "11px",
        fontFamily: "system-ui, -apple-system, monospace",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "6px",
          paddingBottom: "4px",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <BarChart3 size={14} color="#38bdf8" />
          <strong style={{ color: "#f8fafc", fontSize: "12px", letterSpacing: "0.5px" }}>
            Deep Stats & Footprint Bar Statistics (إحصائيات البارات اللحظية)
          </strong>
          <span style={{ fontSize: "10px", color: "#64748b", background: "#0f172a", padding: "1px 6px", borderRadius: "3px" }}>
            Immery Gams Order Flow HUD
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#60a5fa" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#1d4ed8" }}></span>
              دلتا شراء
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#c084fc" }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: "#6b21a8" }}></span>
              دلتا بيع
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#38bdf8" }}>
              ⚡ Delta Flip
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", color: "#fbbf24" }}>
              🛡️ Absorption
            </span>
          </div>

          {onClose && (
            <button
              type="button"
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: "2px",
              }}
              title="إغلاق شريط Deep Stats"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Tabular Heatmap Grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: `75px repeat(${stats.length}, minmax(48px, 1fr))`,
          overflowX: "auto",
          gap: "2px",
        }}
      >
        {/* Row Headers */}
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontWeight: "bold", color: "#94a3b8" }}>
          <div style={{ height: "24px", display: "flex", alignItems: "center", paddingLeft: "4px" }}>الوقت</div>
          <div style={{ height: "24px", display: "flex", alignItems: "center", paddingLeft: "4px", color: "#cbd5e1" }}>Volume</div>
          <div style={{ height: "24px", display: "flex", alignItems: "center", paddingLeft: "4px" }}>Delta</div>
          <div style={{ height: "20px", display: "flex", alignItems: "center", paddingLeft: "4px", fontSize: "10px" }}>Delta %</div>
          <div style={{ height: "22px", display: "flex", alignItems: "center", paddingLeft: "4px", fontSize: "10px" }}>الإشارة</div>
        </div>

        {/* Bar Columns */}
        {stats.map((stat, i) => {
          const isBullishDelta = stat.delta >= 0;
          // Calculate color intensity based on delta magnitude
          const intensity = Math.min(1, Math.abs(stat.delta) / (Math.max(1, stat.volume * 0.5)));
          const deltaBg = isBullishDelta
            ? `rgba(37, 99, 235, ${0.25 + intensity * 0.65})` // Blue gradient
            : `rgba(147, 51, 234, ${0.25 + intensity * 0.65})`; // Purple/Magenta gradient

          return (
            <div
              key={stat.time}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                textAlign: "center",
                background: stat.isOutlierVol ? "rgba(56, 189, 248, 0.05)" : "transparent",
                border: stat.isDeltaFlip
                  ? "1px solid #38bdf8"
                  : stat.isAbsorption
                  ? "1px solid #f59e0b"
                  : "1px solid transparent",
                borderRadius: "4px",
                padding: "1px",
              }}
              title={`شمعة ${stat.timeStr} | حجم: ${stat.volStr} | دلتا: ${stat.deltaStr} (${stat.deltaPct.toFixed(1)}%)`}
            >
              {/* Time */}
              <div
                style={{
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#64748b",
                  fontSize: "10px",
                }}
              >
                {stat.timeStr}
              </div>

              {/* Volume */}
              <div
                style={{
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: stat.isOutlierVol ? "#1e293b" : "rgba(15, 23, 42, 0.6)",
                  color: stat.isOutlierVol ? "#f8fafc" : "#94a3b8",
                  fontWeight: stat.isOutlierVol ? "bold" : "normal",
                  borderRadius: "2px",
                }}
              >
                {stat.volStr}
              </div>

              {/* Delta with Heatmap Cell */}
              <div
                style={{
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: deltaBg,
                  color: "#ffffff",
                  fontWeight: "bold",
                  borderRadius: "2px",
                  textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                }}
              >
                {stat.deltaStr}
              </div>

              {/* Delta % */}
              <div
                style={{
                  height: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: isBullishDelta ? "#60a5fa" : "#c084fc",
                  fontSize: "9.5px",
                }}
              >
                {stat.deltaPct > 0 ? `+${stat.deltaPct.toFixed(0)}%` : `${stat.deltaPct.toFixed(0)}%`}
              </div>

              {/* Signal Tag */}
              <div
                style={{
                  height: "22px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "9px",
                }}
              >
                {stat.isDeltaFlip && (
                  <span style={{ color: "#38bdf8", fontWeight: "bold" }}>⚡ Flip</span>
                )}
                {!stat.isDeltaFlip && stat.isAbsorption && (
                  <span style={{ color: "#f59e0b", fontWeight: "bold" }}>🛡️ Absorb</span>
                )}
                {!stat.isDeltaFlip && !stat.isAbsorption && stat.isOutlierVol && (
                  <span style={{ color: isBullishDelta ? "#34d399" : "#f87171" }}>★ Spike</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
