"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";
import type { RefObject } from "react";
import type { IChartApi, ISeriesApi } from "lightweight-charts";
import type { Candle } from "@/lib/replay";
import {
  type InstitutionalChartConfig,
} from "@/lib/institutional-chart-types";
import {
  generateInstitutionalSnapshot,
  type InstitutionalHubState,
} from "@/lib/institutional-hub";

interface InstitutionalChartOverlayProps {
  chart: RefObject<IChartApi | null>;
  series: RefObject<ISeriesApi<"Candlestick"> | null>;
  candles: Candle[];
  config: InstitutionalChartConfig;
  currentPrice: number;
}

export default function InstitutionalChartOverlay({
  chart,
  series,
  candles,
  config,
  currentPrice,
}: InstitutionalChartOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Compute live institutional state anchored to real market structure & session volume
  const snapshot: InstitutionalHubState = useMemo(() => {
    return generateInstitutionalSnapshot(candles, currentPrice, config);
  }, [candles, currentPrice, config]);

  // Synchronize SVG elements with chart coordinates on render, scroll, and zoom
  useEffect(() => {
    let frameId = 0;

    const updateRender = () => {
      const c = chart.current;
      const s = series.current;
      const root = containerRef.current;

      if (!c || !s || !root || !candles.length) {
        frameId = requestAnimationFrame(updateRender);
        return;
      }

      const svgEl = root.querySelector("svg");
      if (!svgEl) {
        frameId = requestAnimationFrame(updateRender);
        return;
      }

      const chartWidth = c.timeScale().width();
      const chartHeight = root.clientHeight || 800;
      const elements: string[] = [];

      // -------------------------------------------------------------
      // 0. Session Killzones Shading (Asia, London, New York)
      // -------------------------------------------------------------
      if (config.showSessionZones && candles.length > 0) {
        type SessionKey = "ASIA" | "LONDON" | "NY";
        interface SessionInterval {
          key: SessionKey;
          name: string;
          labelAr: string;
          color: string;
          fill: string;
          stroke: string;
          startIdx: number;
          endIdx: number;
        }

        const getSessionKey = (openTime: number): SessionKey | null => {
          const d = new Date(openTime);
          const time = d.getUTCHours() + d.getUTCMinutes() / 60;
          if (time >= 0 && time < 6) return "ASIA";
          if (time >= 7 && time < 11) return "LONDON";
          if (time >= 12 && time < 16.5) return "NY";
          return null;
        };

        const sessionMeta: Record<SessionKey, { name: string; labelAr: string; color: string; fill: string; stroke: string }> = {
          ASIA: {
            name: "ASIA (00-06 UTC)",
            labelAr: "آسيا",
            color: "#818cf8",
            fill: "rgba(99, 102, 241, 0.045)",
            stroke: "rgba(99, 102, 241, 0.2)",
          },
          LONDON: {
            name: "LONDON (07-11 UTC)",
            labelAr: "لندن",
            color: "#34d399",
            fill: "rgba(16, 185, 129, 0.055)",
            stroke: "rgba(16, 185, 129, 0.25)",
          },
          NY: {
            name: "NEW YORK (12-16:30 UTC)",
            labelAr: "نيويورك",
            color: "#fbbf24",
            fill: "rgba(245, 158, 11, 0.055)",
            stroke: "rgba(245, 158, 11, 0.25)",
          },
        };

        const intervals: SessionInterval[] = [];
        let currentInterval: SessionInterval | null = null;

        for (let i = 0; i < candles.length; i++) {
          const sKey = getSessionKey(candles[i].openTime);
          if (sKey) {
            if (currentInterval && currentInterval.key === sKey) {
              currentInterval.endIdx = i;
            } else {
              if (currentInterval) intervals.push(currentInterval);
              currentInterval = {
                key: sKey,
                startIdx: i,
                endIdx: i,
                ...sessionMeta[sKey],
              };
            }
          } else {
            if (currentInterval) {
              intervals.push(currentInterval);
              currentInterval = null;
            }
          }
        }
        if (currentInterval) intervals.push(currentInterval);

        for (const zone of intervals) {
          const x1 = c.timeScale().logicalToCoordinate(zone.startIdx as never);
          const x2 = c.timeScale().logicalToCoordinate(zone.endIdx as never);

          if (x1 === null && x2 === null) continue;

          const startX = x1 ?? (x2 !== null ? x2 - 50 : 0);
          const endX = x2 ?? (x1 !== null ? x1 + 50 : chartWidth);

          const left = Math.min(startX, endX) - 3;
          const right = Math.max(startX, endX) + 3;
          const width = Math.max(10, right - left);

          if (right < -20 || left > chartWidth + 20) continue;

          // Vertical background shaded band
          elements.push(
            `<rect x="${left}" y="0" width="${width}" height="${chartHeight}" fill="${zone.fill}" stroke="${zone.stroke}" stroke-width="0.8" stroke-dasharray="4 4" />`
          );

          // Top badge
          const badgeWidth = zone.key === "NY" ? 92 : zone.key === "LONDON" ? 82 : 72;
          const badgeX = Math.max(6, Math.min(left + 6, chartWidth - badgeWidth - 6));
          elements.push(
            `<rect x="${badgeX}" y="6" width="${badgeWidth}" height="16" rx="3" fill="#090d16" stroke="${zone.stroke}" stroke-width="0.8" opacity="0.92" />`,
            `<text x="${badgeX + badgeWidth / 2}" y="17" fill="${zone.color}" font-size="8.5" font-family="monospace" font-weight="bold" text-anchor="middle">${zone.name.split(" ")[0]} · ${zone.labelAr}</text>`
          );
        }
      }

      // -------------------------------------------------------------
      // 1. ATAS Value Area & Point of Control (POC)
      // -------------------------------------------------------------
      if (config.showValueArea && snapshot.atas.data) {
        const atas = snapshot.atas.data;
        const pocY = s.priceToCoordinate(atas.pointOfControl);
        const vahY = s.priceToCoordinate(atas.valueAreaHigh);
        const valY = s.priceToCoordinate(atas.valueAreaLow);

        // Value Area Shaded Zone
        if (vahY !== null && valY !== null) {
          const topY = Math.min(vahY, valY);
          const botY = Math.max(vahY, valY);
          elements.push(
            `<rect x="0" y="${topY}" width="${chartWidth}" height="${Math.max(2, botY - topY)}" fill="rgba(245, 158, 11, 0.035)" stroke="none" />`
          );
        }

        // VAH Ray (Cyan dashed)
        if (vahY !== null && vahY >= -20 && vahY <= 2000) {
          elements.push(
            `<line x1="0" y1="${vahY}" x2="${chartWidth}" y2="${vahY}" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.65" />`
          );
          if (config.showPriceBadges) {
            elements.push(
              `<rect x="8" y="${vahY - 8}" width="78" height="16" rx="3" fill="#0c1a29" stroke="#38bdf8" stroke-width="0.8" />`,
              `<text x="47" y="${vahY + 4}" fill="#7dd3fc" font-size="9" font-family="monospace" font-weight="600" text-anchor="middle">VAH ${atas.valueAreaHigh.toFixed(1)}</text>`
            );
          }
        }

        // VAL Ray (Cyan dashed)
        if (valY !== null && valY >= -20 && valY <= 2000) {
          elements.push(
            `<line x1="0" y1="${valY}" x2="${chartWidth}" y2="${valY}" stroke="#38bdf8" stroke-width="1.2" stroke-dasharray="4 3" opacity="0.65" />`
          );
          if (config.showPriceBadges) {
            elements.push(
              `<rect x="8" y="${valY - 8}" width="78" height="16" rx="3" fill="#0c1a29" stroke="#38bdf8" stroke-width="0.8" />`,
              `<text x="47" y="${valY + 4}" fill="#7dd3fc" font-size="9" font-family="monospace" font-weight="600" text-anchor="middle">VAL ${atas.valueAreaLow.toFixed(1)}</text>`
            );
          }
        }

        // Golden POC Line (Calm & Clear)
        if (pocY !== null && pocY >= -20 && pocY <= 2000) {
          elements.push(
            `<line x1="0" y1="${pocY}" x2="${chartWidth}" y2="${pocY}" stroke="#d97706" stroke-width="1.4" stroke-dasharray="8 4" opacity="0.8" />`
          );
          if (config.showPriceBadges) {
            elements.push(
              `<rect x="${chartWidth - 110}" y="${pocY - 10}" width="105" height="20" rx="3" fill="#181e28" stroke="#d97706" stroke-width="0.9" />`,
              `<text x="${chartWidth - 58}" y="${pocY + 4}" fill="#fde68a" font-size="9.5" font-family="monospace" font-weight="600" text-anchor="middle">POC ${atas.pointOfControl.toFixed(1)}</text>`
            );
          }
        }
      }

      // -------------------------------------------------------------
      // 2. Coinglass Magnetic Liquidation Pools
      // -------------------------------------------------------------
      if (config.showLiquidationPools && snapshot.coinglass.data) {
        const pools = snapshot.coinglass.data.topLiquidationPools.filter(
          (p) => p.estimatedVolumeUsd >= config.minLiquidationUsd
        );

        for (const pool of pools) {
          const y = s.priceToCoordinate(pool.price);
          if (y === null || y < -30 || y > 2000) continue;

          const isShort = pool.side === "SHORT_LIQ";
          const lineColor = isShort ? "#ef4444" : "#10b981";
          const volM = (pool.estimatedVolumeUsd / 1e6).toFixed(0);

          // Horizontal neon ray
          elements.push(
            `<line x1="0" y1="${y}" x2="${chartWidth - (config.showPriceBadges ? 135 : 10)}" y2="${y}" stroke="${lineColor}" stroke-width="1.3" stroke-dasharray="6 4" opacity="0.75" />`
          );

          if (config.showPriceBadges) {
            elements.push(
              `<rect x="${chartWidth - 136}" y="${y - 10}" width="130" height="20" rx="4" fill="#0a0f18" stroke="${lineColor}" stroke-width="1" />`,
              `<text x="${chartWidth - 71}" y="${y + 4}" fill="${isShort ? '#fca5a5' : '#86efac'}" font-size="10" font-family="system-ui, monospace" font-weight="600" text-anchor="middle">🎯 ${isShort ? 'Short Liq' : 'Long Liq'} $${volM}M</text>`
            );
          }
        }
      }

      // -------------------------------------------------------------
      // 3. Bookmap Level 3 Depth Liquidity Walls
      // -------------------------------------------------------------
      if (config.showLiquidityWalls && snapshot.bookmap.data) {
        const bands = snapshot.bookmap.data.liquidityBands.filter(
          (b) => b.density >= config.liquidityWallMinDensity
        );

        for (const band of bands) {
          const y = s.priceToCoordinate(band.price);
          if (y === null || y < -30 || y > 2000) continue;

          const isBid = band.side === "BID";
          const wallWidth = Math.min(190, Math.max(40, band.density * 180));
          const color = isBid
            ? `rgba(56, 189, 248, ${0.15 + band.density * 0.4})`
            : `rgba(249, 115, 22, ${0.15 + band.density * 0.4})`;
          const strokeColor = isBid ? "#38bdf8" : "#f97316";

          // Right-docked horizontal liquidity bar
          elements.push(
            `<rect x="${chartWidth - wallWidth}" y="${y - 5}" width="${wallWidth}" height="10" rx="3" fill="${color}" stroke="${strokeColor}" stroke-width="0.8" opacity="0.85" />`,
            `<text x="${chartWidth - wallWidth - 6}" y="${y + 3}" fill="${isBid ? '#7dd3fc' : '#fdba74'}" font-size="9" font-family="monospace" font-weight="bold" text-anchor="end">${band.volume.toFixed(0)} vol</text>`
          );
        }
      }

      // -------------------------------------------------------------
      // 3.5 Session Opens (Daily Open 00:00 UTC, PDH, PDL)
      // -------------------------------------------------------------
      if (config.showSessionOpens && snapshot.sessionOpens) {
        const { dailyOpen, previousDayHigh, previousDayLow } = snapshot.sessionOpens;

        // Daily Open (DO) - Subtle slate/white dashed ray
        if (dailyOpen !== null) {
          const doY = s.priceToCoordinate(dailyOpen);
          if (doY !== null && doY >= -20 && doY <= 2000) {
            elements.push(
              `<line x1="0" y1="${doY}" x2="${chartWidth}" y2="${doY}" stroke="#e2e8f0" stroke-width="1.2" stroke-dasharray="6 4" opacity="0.65" />`
            );
            if (config.showPriceBadges) {
              elements.push(
                `<rect x="8" y="${doY - 8}" width="78" height="16" rx="3" fill="#090d16" stroke="#94a3b8" stroke-width="0.8" />`,
                `<text x="47" y="${doY + 4}" fill="#f1f5f9" font-size="9" font-family="monospace" font-weight="bold" text-anchor="middle">DO ${dailyOpen.toFixed(1)}</text>`
              );
            }
          }
        }

        // Previous Day High (PDH) - Subtle dashed amber ray
        if (previousDayHigh !== null) {
          const pdhY = s.priceToCoordinate(previousDayHigh);
          if (pdhY !== null && pdhY >= -20 && pdhY <= 2000) {
            elements.push(
              `<line x1="0" y1="${pdhY}" x2="${chartWidth}" y2="${pdhY}" stroke="#fbbf24" stroke-width="1.1" stroke-dasharray="4 4" opacity="0.6" />`
            );
            if (config.showPriceBadges) {
              elements.push(
                `<rect x="8" y="${pdhY - 8}" width="84" height="16" rx="3" fill="#171207" stroke="#f59e0b" stroke-width="0.8" />`,
                `<text x="50" y="${pdhY + 4}" fill="#fde68a" font-size="9" font-family="monospace" font-weight="600" text-anchor="middle">PDH ${previousDayHigh.toFixed(1)}</text>`
              );
            }
          }
        }

        // Previous Day Low (PDL) - Subtle dashed amber ray
        if (previousDayLow !== null) {
          const pdlY = s.priceToCoordinate(previousDayLow);
          if (pdlY !== null && pdlY >= -20 && pdlY <= 2000) {
            elements.push(
              `<line x1="0" y1="${pdlY}" x2="${chartWidth}" y2="${pdlY}" stroke="#fbbf24" stroke-width="1.1" stroke-dasharray="4 4" opacity="0.6" />`
            );
            if (config.showPriceBadges) {
              elements.push(
                `<rect x="8" y="${pdlY - 8}" width="84" height="16" rx="3" fill="#171207" stroke="#f59e0b" stroke-width="0.8" />`,
                `<text x="50" y="${pdlY + 4}" fill="#fde68a" font-size="9" font-family="monospace" font-weight="600" text-anchor="middle">PDL ${previousDayLow.toFixed(1)}</text>`
              );
            }
          }
        }
      }

      // -------------------------------------------------------------
      // 4. Volume Bubbles & 5. Absorption Markers on Candles
      // -------------------------------------------------------------
      const lookbackCount = Math.min(candles.length, config.candleLookback);
      if (lookbackCount > 0 && (config.showVolumeBubbles || config.showAbsorptionMarkers)) {
        const slice = candles.slice(-lookbackCount);

        // Compute average volume for relative sizing
        const totalVol = slice.reduce((acc, c) => acc + c.volume, 0);
        const avgVol = totalVol / (slice.length || 1);

        for (const candle of slice) {
          const idx = candles.findIndex((c) => c.openTime === candle.openTime);
          if (idx < 0) continue;

          const x = c.timeScale().logicalToCoordinate(idx as never);
          if (x === null || x < -50 || x > chartWidth + 50) continue;

          const isBull = candle.close >= candle.open;
          const bodyRange = Math.abs(candle.close - candle.open);
          const upperWick = candle.high - Math.max(candle.open, candle.close);
          const lowerWick = Math.min(candle.open, candle.close) - candle.low;

          // ------------------------------------------
          // 4. Volume Bubbles
          // ------------------------------------------
          if (
            config.showVolumeBubbles &&
            avgVol > 0 &&
            candle.volume >= avgVol * config.bubbleVolumeThresholdRatio
          ) {
            // Anchor bubble to aggressive cluster (high for buying, low for selling)
            const targetPrice = isBull
              ? candle.high - (candle.high - candle.close) * 0.5
              : candle.low + (candle.open - candle.low) * 0.5;
            const bubbleY = s.priceToCoordinate(targetPrice);

            if (bubbleY !== null && bubbleY >= -30 && bubbleY <= 2000) {
              const volRatio = candle.volume / avgVol;
              const radius = Math.min(
                26,
                Math.max(6, Math.sqrt(volRatio) * 6 * config.bubbleScaleMultiplier)
              );
              const bubbleColor = isBull ? "#10b981" : "#ef4444";

              elements.push(
                `<circle cx="${x}" cy="${bubbleY}" r="${radius}" fill="${bubbleColor}" fill-opacity="0.2" stroke="${bubbleColor}" stroke-width="1.0" />`,
                `<circle cx="${x}" cy="${bubbleY}" r="${Math.max(2, radius * 0.35)}" fill="${bubbleColor}" fill-opacity="0.6" />`
              );
            }
          }

          // ------------------------------------------
          // 5. Absorption Diamond Markers (✦)
          // ------------------------------------------
          if (config.showAbsorptionMarkers) {
            const minWick = Math.max(bodyRange * 1.2, 0.0001);

            // Bullish Absorption (Aggressive sellers absorbed at the bottom)
            if (
              lowerWick > minWick &&
              lowerWick >= bodyRange * config.absorptionSensitivity &&
              candle.volume >= avgVol * 1.1
            ) {
              const wickLowY = s.priceToCoordinate(candle.low);
              if (wickLowY !== null && wickLowY >= -30 && wickLowY <= 2000) {
                const markY = wickLowY + 12;
                // Soft emerald diamond ◆
                elements.push(
                  `<polygon points="${x},${markY - 5} ${x + 5},${markY} ${x},${markY + 5} ${x - 5},${markY}" fill="#059669" stroke="#10b981" stroke-width="0.9" />`,
                  `<rect x="${x - 18}" y="${markY + 7}" width="36" height="12" rx="2" fill="#042f2e" stroke="#059669" stroke-width="0.7" opacity="0.85" />`,
                  `<text x="${x}" y="${markY + 16}" fill="#6ee7b7" font-size="8" font-family="system-ui" font-weight="bold" text-anchor="middle">امتصاص</text>`
                );
              }
            }

            // Bearish Absorption (Aggressive buyers absorbed at the top)
            if (
              upperWick > minWick &&
              upperWick >= bodyRange * config.absorptionSensitivity &&
              candle.volume >= avgVol * 1.1
            ) {
              const wickHighY = s.priceToCoordinate(candle.high);
              if (wickHighY !== null && wickHighY >= -30 && wickHighY <= 2000) {
                const markY = wickHighY - 12;
                // Soft purple diamond ◆
                elements.push(
                  `<polygon points="${x},${markY - 5} ${x + 5},${markY} ${x},${markY + 5} ${x - 5},${markY}" fill="#7c3aed" stroke="#a855f7" stroke-width="0.9" />`,
                  `<rect x="${x - 18}" y="${markY - 19}" width="36" height="12" rx="2" fill="#1e1b4b" stroke="#7c3aed" stroke-width="0.7" opacity="0.85" />`,
                  `<text x="${x}" y="${markY - 10}" fill="#ddd6fe" font-size="8" font-family="system-ui" font-weight="bold" text-anchor="middle">امتصاص</text>`
                );
              }
            }
          }
        }
      }

      svgEl.innerHTML = elements.join("");
      frameId = requestAnimationFrame(updateRender);
    };

    frameId = requestAnimationFrame(updateRender);
    return () => cancelAnimationFrame(frameId);
  }, [chart, series, candles, config, snapshot]);

  return (
    <div
      ref={containerRef}
      className="institutional-chart-overlay"
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        zIndex: 3,
        overflow: "hidden",
      }}
    >
      <svg style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
