"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { Candle } from "@/lib/replay";
import {
  computeOrderFlowProfile,
  detectBigTradesAndAbsorption,
  type OrderFlowProfileResult,
  type BigTradeMarker,
} from "@/lib/orderflow";

interface OrderFlowOverlayProps {
  chart: RefObject<IChartApi | null>;
  series: RefObject<ISeriesApi<"Candlestick"> | null>;
  candles: Candle[];
  visible: boolean;
}

export default function OrderFlowOverlay({
  chart,
  series,
  candles,
  visible,
}: OrderFlowOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<OrderFlowProfileResult | null>(null);
  const [bigTrades, setBigTrades] = useState<BigTradeMarker[]>([]);
  const [hoveredMarker, setHoveredMarker] = useState<BigTradeMarker | null>(null);

  // Compute profile and big trades when candles update
  useEffect(() => {
    if (!visible || !candles.length) {
      setProfile(null);
      setBigTrades([]);
      return;
    }
    const slice = candles.slice(-180);
    const prof = computeOrderFlowProfile(slice, 42, 0.70);
    const trades = detectBigTradesAndAbsorption(slice);
    setProfile(prof);
    setBigTrades(trades);
  }, [candles, visible]);

  // Sync SVG and markers with chart coordinates
  useEffect(() => {
    if (!visible || !profile) return;

    let frameId = 0;
    const updateCoordinates = () => {
      const c = chart.current;
      const s = series.current;
      const root = containerRef.current;
      if (!c || !s || !root) {
        frameId = requestAnimationFrame(updateCoordinates);
        return;
      }

      const svgEl = root.querySelector("svg");
      if (!svgEl) {
        frameId = requestAnimationFrame(updateCoordinates);
        return;
      }

      const chartWidth = c.timeScale().width();
      const elements: string[] = [];

      // 1. Draw LVN (Low Volume Nodes) liquidity void lines
      for (const lvn of profile.lvnLevels) {
        const y = s.priceToCoordinate(lvn);
        if (y !== null && y >= 0 && y <= 2000) {
          elements.push(
            `<line x1="0" y1="${y}" x2="${chartWidth}" y2="${y}" stroke="#a855f7" stroke-width="1" stroke-dasharray="3 3" opacity="0.65" />`
          );
          elements.push(
            `<text x="${chartWidth - 55}" y="${y - 4}" fill="#c084fc" font-size="9" font-family="monospace">LVN ${lvn.toFixed(1)}</text>`
          );
        }
      }

      // 2. Draw Big Trades & Absorption Bubbles on candles
      const slice = candles.slice(-180);
      for (const bt of bigTrades) {
        // Find candle index in chart
        const candleIdx = candles.findIndex((cand) => cand.openTime / 1000 === bt.time);
        if (candleIdx < 0) continue;

        const x = c.timeScale().logicalToCoordinate(candleIdx as never);
        const y = s.priceToCoordinate(bt.price);
        if (x === null || y === null || x < -20 || x > chartWidth + 20) continue;

        const isBuy = bt.side === "BUY";
        const bubbleColor = isBuy ? "#10b981" : "#ef4444";
        const radius = Math.min(18, Math.max(6, 6 + Math.log10(bt.volume + 1) * 3));

        if (bt.isAbsorption) {
          // Trapped Traders Absorption Badge (Star/Pill)
          const ringColor = bt.trappedSide === "TRAPPED_BUYERS" ? "#f59e0b" : "#38bdf8";
          elements.push(
            `<circle cx="${x}" cy="${y}" r="${radius + 4}" fill="none" stroke="${ringColor}" stroke-width="2" stroke-dasharray="2 2" opacity="0.9" />`
          );
          elements.push(
            `<circle cx="${x}" cy="${y}" r="${radius}" fill="${bubbleColor}" fill-opacity="0.75" stroke="#ffffff" stroke-width="1.5" />`
          );
          // Absorption Label
          const labelText = bt.trappedSide === "TRAPPED_BUYERS" ? "امتصاص شراء (محاصرون)" : "امتصاص بيع (محاصرون)";
          elements.push(
            `<rect x="${x - 45}" y="${y - radius - 16}" width="90" height="14" rx="3" fill="#18181b" stroke="${ringColor}" stroke-width="1" opacity="0.95" />`
          );
          elements.push(
            `<text x="${x}" y="${y - radius - 6}" fill="${ringColor}" font-size="8" font-family="sans-serif" font-weight="bold" text-anchor="middle">${labelText}</text>`
          );
        } else {
          // Standard Big Institutional Trade Bubble (ATAS / Bookmap style)
          elements.push(
            `<circle cx="${x}" cy="${y}" r="${radius}" fill="${bubbleColor}" fill-opacity="0.45" stroke="${bubbleColor}" stroke-width="1.5" />`
          );
        }
      }

      svgEl.innerHTML = elements.join("");
      frameId = requestAnimationFrame(updateCoordinates);
    };

    frameId = requestAnimationFrame(updateCoordinates);
    return () => cancelAnimationFrame(frameId);
  }, [profile, bigTrades, visible, chart, series, candles]);

  if (!visible || !profile) return null;

  return (
    <div
      ref={containerRef}
      className="order-flow-overlay"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 5,
        overflow: "hidden",
      }}
    >
      <svg
        style={{
          width: "100%",
          height: "100%",
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
