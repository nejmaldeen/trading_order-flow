"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import type { RefObject } from "react";
import type { IChartApi, ISeriesApi, UTCTimestamp } from "lightweight-charts";
import type { Candle, Timeframe } from "@/lib/replay";
import {
  computeDailySessionProfiles,
  type DailySessionProfile,
  type SessionGrouping,
} from "@/lib/session-volume-profile";

interface SessionProfileOverlayProps {
  chart: RefObject<IChartApi | null>;
  series: RefObject<ISeriesApi<"Candlestick"> | null>;
  candles: Candle[];
  timeframe?: Timeframe;
  visible: boolean;
  opacity?: number;
  highlightPoc?: boolean;
  grouping?: SessionGrouping;
  widthScale?: number;
}

export default function SessionProfileOverlay({
  chart,
  series,
  candles,
  timeframe = "15m",
  visible,
  opacity = 0.85,
  highlightPoc = true,
  grouping = "auto",
  widthScale = 1.0,
}: SessionProfileOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [hoveredInfo, setHoveredInfo] = useState<{
    x: number;
    y: number;
    session: DailySessionProfile;
  } | null>(null);

  // Compute session profiles whenever candles or grouping change
  const sessions = useMemo(() => {
    if (!visible || !candles.length) return [];
    // Compute profiles with 36 price buckets and standard 70% Value Area
    return computeDailySessionProfiles(candles, 36, 0.70, timeframe, grouping);
  }, [candles, visible, timeframe, grouping]);

  // Synchronize SVG elements with chart coordinates on render, pan, and zoom
  useEffect(() => {
    if (!visible || sessions.length === 0) return;

    let frameId = 0;

    const updateRender = () => {
      const c = chart.current;
      const s = series.current;
      const root = containerRef.current;

      if (!c || !s || !root || sessions.length === 0) {
        frameId = requestAnimationFrame(updateRender);
        return;
      }

      const svgEl = root.querySelector("svg");
      if (!svgEl) {
        frameId = requestAnimationFrame(updateRender);
        return;
      }

      const chartWidth = c.timeScale().width();
      const chartHeight = root.clientHeight || 700;
      const timeScale = c.timeScale();
      const options = timeScale.options();
      const barSpacing = options.barSpacing || 10;

      const elements: string[] = [];

      for (let sIdx = 0; sIdx < sessions.length; sIdx++) {
        const session = sessions[sIdx];
        const { profile } = session;

        // Find coordinates for first candle and last candle in session
        const tStart = Math.floor(session.firstOpenTime / 1000) as UTCTimestamp;
        const tEnd = Math.floor(session.lastOpenTime / 1000) as UTCTimestamp;

        const xStart = timeScale.timeToCoordinate(tStart);
        const xEnd = timeScale.timeToCoordinate(tEnd);

        if (xStart === null && xEnd === null) continue;

        // Calculate session width in pixels cleanly without crowding
        let leftX: number;
        let sessionWidth: number;

        if (xStart !== null && xEnd !== null) {
          leftX = Math.min(xStart, xEnd) - barSpacing * 0.4;
          if (session.candleCount > 1) {
            sessionWidth = Math.max(50, (Math.abs(xEnd - xStart) + barSpacing * 1.4));
          } else {
            // Single bar session (e.g. daily frame with daily grouping)
            sessionWidth = Math.max(35, barSpacing * 2.4);
          }
        } else if (xStart !== null) {
          leftX = xStart - barSpacing * 0.4;
          const barsCount = Math.max(1, session.candleCount);
          sessionWidth = Math.max(40, barSpacing * (barsCount > 1 ? barsCount * 1.1 : 2.4));
        } else {
          const barsCount = Math.max(1, session.candleCount);
          leftX = (xEnd ?? 0) - barSpacing * (barsCount > 1 ? barsCount * 1.1 : 2.4);
          sessionWidth = Math.max(40, barSpacing * (barsCount > 1 ? barsCount * 1.1 : 2.4));
        }

        // Apply width scaling for comfortable, spacious viewing
        const effectiveWidth = sessionWidth * Math.max(0.6, Math.min(2.0, widthScale));

        // Culling: Skip sessions completely off-screen
        if (leftX + effectiveWidth < -40 || leftX > chartWidth + 40) continue;

        // Max profile width leaves slight breathing room
        const maxBarWidth = Math.max(28, effectiveWidth * 0.86);

        // Session subtle boundary guideline
        elements.push(
          `<line x1="${leftX.toFixed(1)}" y1="0" x2="${leftX.toFixed(1)}" y2="${chartHeight}" stroke="rgba(255, 255, 255, 0.06)" stroke-width="1" stroke-dasharray="2 4" />`
        );

        // 1. Draw horizontal volume bars for each price bucket
        const step = profile.step;
        const pocVol = profile.pocVolume || 1;

        for (const bucket of profile.buckets) {
          if (bucket.totalVolume <= 0) continue;

          const pTop = bucket.price + step * 0.5;
          const pBottom = bucket.price - step * 0.5;

          const yTop = s.priceToCoordinate(pTop);
          const yBottom = s.priceToCoordinate(pBottom);

          if (yTop === null || yBottom === null) continue;

          const y = Math.min(yTop, yBottom);
          const h = Math.max(1.8, Math.abs(yBottom - yTop) - 0.35);

          // Length proportional to volume
          const volRatio = bucket.totalVolume / pocVol;
          const barLen = Math.max(3, volRatio * maxBarWidth);

          // Institutional Colors matching exact photos:
          // Value Area (70%): Warm institutional amber/orange (#f59e0b)
          // Rejection / Outside Value Area: Sleek muted slate gray (#64748b)
          const fillColor = bucket.isValueArea
            ? `rgba(245, 158, 11, ${opacity})`
            : `rgba(100, 116, 139, ${opacity * 0.65})`;

          const strokeColor = bucket.isValueArea
            ? "rgba(217, 119, 6, 0.45)"
            : "rgba(71, 85, 105, 0.35)";

          elements.push(
            `<rect x="${leftX.toFixed(1)}" y="${y.toFixed(1)}" width="${barLen.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${fillColor}" stroke="${strokeColor}" stroke-width="0.5" />`
          );
        }

        // 2. Value Area Boundaries (VAH & VAL) dashed lines
        const yVah = s.priceToCoordinate(profile.vahPrice);
        const yVal = s.priceToCoordinate(profile.valPrice);

        if (yVah !== null && yVah >= 0 && yVah <= chartHeight) {
          elements.push(
            `<line x1="${leftX.toFixed(1)}" y1="${yVah.toFixed(1)}" x2="${(leftX + effectiveWidth).toFixed(1)}" y2="${yVah.toFixed(1)}" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.8" />`,
            `<text x="${(leftX + effectiveWidth - 4).toFixed(1)}" y="${(yVah - 3).toFixed(1)}" fill="#f59e0b" font-size="8.5" font-family="Inter, sans-serif" font-weight="600" text-anchor="end" opacity="0.85">VAH</text>`
          );
        }

        if (yVal !== null && yVal >= 0 && yVal <= chartHeight) {
          elements.push(
            `<line x1="${leftX.toFixed(1)}" y1="${yVal.toFixed(1)}" x2="${(leftX + effectiveWidth).toFixed(1)}" y2="${yVal.toFixed(1)}" stroke="#f59e0b" stroke-width="1.2" stroke-dasharray="3 3" opacity="0.8" />`,
            `<text x="${(leftX + effectiveWidth - 4).toFixed(1)}" y="${(yVal + 9).toFixed(1)}" fill="#f59e0b" font-size="8.5" font-family="Inter, sans-serif" font-weight="600" text-anchor="end" opacity="0.85">VAL</text>`
          );
        }

        // 3. Point of Control (POC) Line in vivid Magenta / Purple (#d946ef)
        if (highlightPoc) {
          const yPoc = s.priceToCoordinate(profile.pocPrice);
          if (yPoc !== null && yPoc >= 0 && yPoc <= chartHeight) {
            elements.push(
              `<line x1="${leftX.toFixed(1)}" y1="${yPoc.toFixed(1)}" x2="${(leftX + effectiveWidth).toFixed(1)}" y2="${yPoc.toFixed(1)}" stroke="#d946ef" stroke-width="2" stroke-linecap="round" />`,
              `<circle cx="${leftX.toFixed(1)}" cy="${yPoc.toFixed(1)}" r="2.5" fill="#d946ef" />`,
              `<text x="${(leftX + 6).toFixed(1)}" y="${(yPoc - 4).toFixed(1)}" fill="#f0abfc" font-size="9" font-family="Inter, sans-serif" font-weight="700">POC</text>`
            );
          }
        }

        // 4. Session Date Tag at top of profile
        const topY = 16;
        const tagWidth = Math.min(105, effectiveWidth - 4);
        if (tagWidth > 30) {
          elements.push(
            `<rect x="${(leftX + 2).toFixed(1)}" y="${topY - 11}" width="${tagWidth.toFixed(1)}" height="14" rx="3" fill="#0b111a" stroke="rgba(245, 158, 11, 0.3)" stroke-width="0.8" opacity="0.9" />`,
            `<text x="${(leftX + 6).toFixed(1)}" y="${topY}" fill="#e2e8f0" font-size="8.5" font-family="Inter, sans-serif" font-weight="600">${session.label}</text>`
          );
        }
      }

      svgEl.innerHTML = elements.join("");
      frameId = requestAnimationFrame(updateRender);
    };

    frameId = requestAnimationFrame(updateRender);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [visible, sessions, opacity, highlightPoc, chart, series, widthScale]);

  if (!visible || sessions.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className="session-profile-overlay-container"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 4,
        overflow: "hidden",
      }}
    >
      <svg
        style={{
          width: "100%",
          height: "100%",
          display: "block",
        }}
      />
    </div>
  );
}
