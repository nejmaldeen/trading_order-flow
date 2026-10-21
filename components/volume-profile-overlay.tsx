"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { Candle } from "@/lib/replay";
import { computeVolumeProfile, type VolumeProfileResult } from "@/lib/volume-profile";

interface VolumeProfileOverlayProps {
  chart: RefObject<IChartApi | null>;
  series: RefObject<ISeriesApi<"Candlestick"> | null>;
  candles: Candle[];
  visible: boolean;
  buyColor?: string;
  sellColor?: string;
}

export default function VolumeProfileOverlay({
  chart,
  series,
  candles,
  visible,
  buyColor = "#2962ff",
  sellColor = "#94a3b8",
}: VolumeProfileOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [profile, setProfile] = useState<VolumeProfileResult | null>(null);

  // Compute profile when candles change
  useEffect(() => {
    if (!visible || !candles.length) {
      setProfile(null);
      return;
    }
    // Take the most relevant range (e.g. up to last 180 bars or all available)
    const slice = candles.slice(-200);
    const result = computeVolumeProfile(slice, 42, 0.70);
    setProfile(result);
  }, [candles, visible]);

  // Synchronize SVG elements with chart coordinates on render/scroll/zoom
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

      const maxVol = profile.pocVolume || 1;
      const chartWidth = c.timeScale().width();
      const profileWidth = Math.min(320, Math.max(120, chartWidth * 0.28));

      // Draw bars
      const elements: string[] = [];

      // Value Area background shading
      const vahY = s.priceToCoordinate(profile.vahPrice);
      const valY = s.priceToCoordinate(profile.valPrice);
      const pocY = s.priceToCoordinate(profile.pocPrice);

      if (vahY !== null && valY !== null) {
        const topY = Math.min(vahY, valY);
        const botY = Math.max(vahY, valY);
        elements.push(
          `<rect x="0" y="${topY}" width="${profileWidth + 8}" height="${Math.max(2, botY - topY)}" fill="rgba(56, 189, 248, 0.04)" stroke="none" />`
        );
      }

      for (const bucket of profile.buckets) {
        const y = s.priceToCoordinate(bucket.price);
        if (y === null || y < -20 || y > 2000) continue;

        const totalWidth = (bucket.totalVolume / maxVol) * profileWidth;
        const buyFraction = bucket.totalVolume > 0 ? bucket.buyVolume / bucket.totalVolume : 0.5;
        const buyWidth = totalWidth * buyFraction;
        const sellWidth = totalWidth - buyWidth;

        const opacity = bucket.isValueArea ? 0.75 : 0.35;
        const height = Math.max(2, Math.abs((s.priceToCoordinate(bucket.price + profile.step * 0.45) ?? y) - y) * 1.8);

        // Buy volume bar
        elements.push(
          `<rect x="0" y="${y - height / 2}" width="${buyWidth}" height="${height}" fill="${buyColor}" opacity="${opacity}" />`
        );
        // Sell volume bar
        elements.push(
          `<rect x="${buyWidth}" y="${y - height / 2}" width="${sellWidth}" height="${height}" fill="${sellColor}" opacity="${opacity}" />`
        );

        if (bucket.isHvn && !bucket.isPoc) {
          elements.push(
            `<circle cx="${totalWidth + 4}" cy="${y}" r="2" fill="#38bdf8" opacity="0.8" />`
          );
        }
      }

      // POC Line (Golden)
      if (pocY !== null) {
        elements.push(
          `<line x1="0" y1="${pocY}" x2="${chartWidth}" y2="${pocY}" stroke="#f59e0b" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.9" />`
        );
        elements.push(
          `<rect x="${profileWidth + 6}" y="${pocY - 9}" width="68" height="18" rx="3" fill="#1c1917" stroke="#f59e0b" stroke-width="1" />`
        );
        elements.push(
          `<text x="${profileWidth + 40}" y="${pocY + 4}" fill="#f59e0b" font-size="10" font-weight="bold" font-family="monospace" text-anchor="middle">POC ${profile.pocPrice.toFixed(2)}</text>`
        );
      }

      // VAH Line
      if (vahY !== null) {
        elements.push(
          `<line x1="0" y1="${vahY}" x2="${profileWidth + 40}" y2="${vahY}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" opacity="0.8" />`
        );
        elements.push(
          `<text x="${profileWidth + 4}" y="${vahY - 3}" fill="#38bdf8" font-size="9" font-family="monospace">VAH ${profile.vahPrice.toFixed(2)}</text>`
        );
      }

      // VAL Line
      if (valY !== null) {
        elements.push(
          `<line x1="0" y1="${valY}" x2="${profileWidth + 40}" y2="${valY}" stroke="#38bdf8" stroke-width="1" stroke-dasharray="2 2" opacity="0.8" />`
        );
        elements.push(
          `<text x="${profileWidth + 4}" y="${valY + 11}" fill="#38bdf8" font-size="9" font-family="monospace">VAL ${profile.valPrice.toFixed(2)}</text>`
        );
      }

      svgEl.innerHTML = elements.join("");
      frameId = requestAnimationFrame(updateCoordinates);
    };

    frameId = requestAnimationFrame(updateCoordinates);
    return () => cancelAnimationFrame(frameId);
  }, [profile, visible, chart, series]);

  if (!visible || !profile) return null;

  return (
    <div
      ref={containerRef}
      className="volume-profile-overlay"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 2,
        overflow: "hidden",
      }}
    >
      <svg style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
