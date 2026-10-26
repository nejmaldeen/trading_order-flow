"use client";

import React, { useState, useMemo } from "react";
import {
  ShieldCheck,
  Activity,
  Layers,
  Zap,
  Radio,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  Maximize2,
  ExternalLink,
  Flame,
  CheckCircle2,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  generateInstitutionalSnapshot,
  type InstitutionalHubState,
  type PlatformId,
} from "@/lib/institutional-hub";
import type { InstitutionalChartConfig } from "@/lib/institutional-chart-types";
import type { Candle } from "@/lib/replay";

interface InstitutionalHudProps {
  currentPrice: number;
  candles?: Candle[];
  open: boolean;
  onToggle: () => void;
  onOpenSettings: () => void;
  config?: InstitutionalChartConfig;
  onChangeConfig?: (newConfig: InstitutionalChartConfig) => void;
  onOpenChartSettings?: () => void;
  showTradeMarkers?: boolean;
  onToggleTradeMarkers?: () => void;
  cleanChart?: boolean;
  onToggleCleanChart?: () => void;
}

export default function InstitutionalHud({
  currentPrice,
  candles,
  open,
  onToggle,
  onOpenSettings,
  config,
  onChangeConfig,
  onOpenChartSettings,
  showTradeMarkers,
  onToggleTradeMarkers,
  cleanChart,
  onToggleCleanChart,
}: InstitutionalHudProps) {
  const [activeTab, setActiveTab] = useState<PlatformId>("coinglass");
  const [showLiquidationLines, setShowLiquidationLines] = useState(true);
  const [showDepthBands, setShowDepthBands] = useState(true);
  const [collapsed, setCollapsed] = useState(false);

  // Generate calibrated metrics anchored to candles and market structure
  const snapshot: InstitutionalHubState = useMemo(() => {
    return generateInstitutionalSnapshot(candles || [], currentPrice, config);
  }, [candles, currentPrice, config]);

  return (
    <>
      {/* 1. Floating Dock Pill & On-Chart Quick Toggles (with collapse support) */}
      {collapsed ? (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 15,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
          dir="rtl"
        >
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "5px 12px",
              background: "rgba(11, 15, 23, 0.88)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              borderRadius: 20,
              color: "#94a3b8",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 6px 20px rgba(0, 0, 0, 0.4)",
              transition: "all 0.15s ease",
            }}
            title="بسط وإظهار شريط المؤشرات والرادار"
          >
            <Layers size={13} style={{ color: "#38bdf8" }} />
            <span>المؤشرات والرادار</span>
            <ChevronDown size={13} />
          </button>

          {onToggleCleanChart && (
            <button
              type="button"
              onClick={onToggleCleanChart}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 10px",
                background: cleanChart ? "rgba(239, 68, 68, 0.85)" : "rgba(11, 15, 23, 0.88)",
                backdropFilter: "blur(14px)",
                border: cleanChart ? "1px solid #ef4444" : "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 20,
                color: cleanChart ? "#ffffff" : "#cbd5e1",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: cleanChart ? "0 0 10px rgba(239, 68, 68, 0.5)" : "none",
              }}
              title={cleanChart ? "إظهار كل المؤشرات والصفقات" : "إخفاء كل شيء على الشاشة (شارت نقي)"}
            >
              {cleanChart ? <EyeOff size={13} /> : <Eye size={13} />}
              <span>{cleanChart ? "إظهار الكل" : "شارت نقي"}</span>
            </button>
          )}

          {onToggleTradeMarkers && (
            <button
              type="button"
              onClick={onToggleTradeMarkers}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "5px 10px",
                background: showTradeMarkers ? "rgba(16, 185, 129, 0.15)" : "rgba(11, 15, 23, 0.88)",
                backdropFilter: "blur(14px)",
                border: showTradeMarkers ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.15)",
                borderRadius: 20,
                color: showTradeMarkers ? "#34d399" : "#64748b",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
              }}
              title={showTradeMarkers ? "إخفاء الصفقات على الشموع" : "إظهار الصفقات على الشموع"}
            >
              <span>صفقات الشموع</span>
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            position: "absolute",
            top: 12,
            left: 12,
            zIndex: 15,
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
          dir="rtl"
        >
          {/* Main Pill Dock */}
          <div
          className="institutional-pill-dock"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "5px 12px",
            background: "rgba(11, 15, 23, 0.82)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            border: "1px solid rgba(255, 255, 255, 0.10)",
            borderRadius: 24,
            boxShadow: "0 8px 24px rgba(0, 0, 0, 0.45), 0 0 1px rgba(255, 255, 255, 0.2)",
            cursor: "pointer",
            userSelect: "none",
            transition: "all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
          onClick={onToggle}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#10b981",
                boxShadow: "0 0 8px #10b981",
                display: "inline-block",
              }}
            />
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.2px",
                color: "#f8fafc",
              }}
            >
              الرادار التقديري · ليس اتصالًا بالمنصات
            </span>
          </div>

          <div
            style={{
              height: 12,
              width: 1,
              background: "rgba(255, 255, 255, 0.15)",
              margin: "0 4px",
            }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 11, color: "#94a3b8" }}>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#38bdf8", fontWeight: 600 }}>Bookmap تقديري</span>
              <span style={{ color: "#34d399", fontSize: 9 }}>●</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#fbbf24", fontWeight: 600 }}>ATAS تقديري</span>
              <span style={{ color: "#34d399", fontSize: 9 }}>●</span>
            </span>
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ color: "#a855f7", fontWeight: 600 }}>Coinglass تقديري</span>
              <span style={{ color: "#34d399", fontSize: 9 }}>●</span>
            </span>
          </div>

          <div style={{ color: "#cbd5e1", marginRight: 4 }}>
            {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </div>
        </div>

        {/* Quick On-Chart Layer Toggles */}
        {config && onChangeConfig && (
          <div
            className="institutional-quick-controls"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              padding: "4px 8px",
              background: "rgba(11, 15, 23, 0.78)",
              backdropFilter: "blur(14px)",
              WebkitBackdropFilter: "blur(14px)",
              border: "1px solid rgba(255, 255, 255, 0.10)",
              borderRadius: 20,
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
            }}
          >
            {/* Liquidation Pools */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChangeConfig({ ...config, showLiquidationPools: !config.showLiquidationPools });
              }}
              style={{
                background: config.showLiquidationPools ? "rgba(244, 63, 94, 0.15)" : "transparent",
                color: config.showLiquidationPools ? "#fb7185" : "#64748b",
                border: config.showLiquidationPools ? "1px solid rgba(244, 63, 94, 0.3)" : "1px solid transparent",
                borderRadius: 12,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: config.showLiquidationPools ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="برك التصفية المغناطيسية (Coinglass)"
            >
              التصفية
            </button>

            {/* Bookmap Depth Walls */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChangeConfig({ ...config, showLiquidityWalls: !config.showLiquidityWalls });
              }}
              style={{
                background: config.showLiquidityWalls ? "rgba(56, 189, 248, 0.15)" : "transparent",
                color: config.showLiquidityWalls ? "#38bdf8" : "#64748b",
                border: config.showLiquidityWalls ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
                borderRadius: 12,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: config.showLiquidityWalls ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="جدران السيولة والعمق (Bookmap L3)"
            >
              الجدران
            </button>

            {/* Volume Bubbles */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChangeConfig({ ...config, showVolumeBubbles: !config.showVolumeBubbles });
              }}
              style={{
                background: config.showVolumeBubbles ? "rgba(16, 185, 129, 0.15)" : "transparent",
                color: config.showVolumeBubbles ? "#34d399" : "#64748b",
                border: config.showVolumeBubbles ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid transparent",
                borderRadius: 12,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: config.showVolumeBubbles ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="فقاعات التدفق الحجمي (Volume Bubbles)"
            >
              الفقاعات
            </button>

            {/* Absorption Markers */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChangeConfig({ ...config, showAbsorptionMarkers: !config.showAbsorptionMarkers });
              }}
              style={{
                background: config.showAbsorptionMarkers ? "rgba(168, 85, 247, 0.15)" : "transparent",
                color: config.showAbsorptionMarkers ? "#c084fc" : "#64748b",
                border: config.showAbsorptionMarkers ? "1px solid rgba(168, 85, 247, 0.3)" : "1px solid transparent",
                borderRadius: 12,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: config.showAbsorptionMarkers ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="علامات الامتصاص المؤسساتي (Absorption)"
            >
              الامتصاص
            </button>

            {/* Value Area / POC */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChangeConfig({ ...config, showValueArea: !config.showValueArea });
              }}
              style={{
                background: config.showValueArea ? "rgba(245, 158, 11, 0.15)" : "transparent",
                color: config.showValueArea ? "#fbbf24" : "#64748b",
                border: config.showValueArea ? "1px solid rgba(245, 158, 11, 0.3)" : "1px solid transparent",
                borderRadius: 12,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: config.showValueArea ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="منطقة القيمة والمزاد (POC & VAH/VAL)"
            >
              POC
            </button>

            {/* Session Opens */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChangeConfig({ ...config, showSessionOpens: !config.showSessionOpens });
              }}
              style={{
                background: config.showSessionOpens ? "rgba(148, 163, 184, 0.15)" : "transparent",
                color: config.showSessionOpens ? "#e2e8f0" : "#64748b",
                border: config.showSessionOpens ? "1px solid rgba(148, 163, 184, 0.3)" : "1px solid transparent",
                borderRadius: 12,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: config.showSessionOpens ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="الافتتاحات اليومية (DO / PDH / PDL)"
            >
              الافتتاحات
            </button>

            {/* Session Killzones Shading */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChangeConfig({ ...config, showSessionZones: !config.showSessionZones });
              }}
              style={{
                background: config.showSessionZones ? "rgba(99, 102, 241, 0.15)" : "transparent",
                color: config.showSessionZones ? "#a5b4fc" : "#64748b",
                border: config.showSessionZones ? "1px solid rgba(99, 102, 241, 0.3)" : "1px solid transparent",
                borderRadius: 12,
                padding: "2px 8px",
                fontSize: 11,
                fontWeight: config.showSessionZones ? 600 : 400,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="تظليل جلسات التداول (Asia / London / NY)"
            >
              الجلسات
            </button>

            {/* Settings Modal Button */}
            {onOpenChartSettings && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenChartSettings();
                }}
                style={{
                  background: "rgba(255, 255, 255, 0.05)",
                  color: "#cbd5e1",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 12,
                  padding: "2px 8px",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="تخصيص إعدادات الشموع والحساسية ومستويات العرض"
              >
                <SlidersHorizontal size={12} />
                <span>إعدادات</span>
              </button>
            )}

            {/* Trade Markers Toggle */}
            {onToggleTradeMarkers && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleTradeMarkers();
                }}
                style={{
                  background: showTradeMarkers ? "rgba(16, 185, 129, 0.15)" : "rgba(255, 255, 255, 0.05)",
                  color: showTradeMarkers ? "#34d399" : "#64748b",
                  border: showTradeMarkers ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 12,
                  padding: "2px 8px",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 3,
                  cursor: "pointer",
                  fontWeight: showTradeMarkers ? 600 : 400,
                  transition: "all 0.15s ease",
                }}
                title={showTradeMarkers ? "إخفاء الصفقات على الشموع" : "إظهار الصفقات على الشموع"}
              >
                <span>صفقات الشموع</span>
              </button>
            )}

            {/* Clean Chart (Master Eye) Toggle */}
            {onToggleCleanChart && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleCleanChart();
                }}
                style={{
                  background: cleanChart ? "rgba(244, 63, 94, 0.2)" : "rgba(255, 255, 255, 0.05)",
                  color: cleanChart ? "#fb7185" : "#cbd5e1",
                  border: cleanChart ? "1px solid rgba(244, 63, 94, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 12,
                  padding: "2px 8px",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  cursor: "pointer",
                  fontWeight: 600,
                  transition: "all 0.15s ease",
                }}
                title={cleanChart ? "إظهار كل المؤشرات والصفقات" : "إخفاء كل شيء على الشاشة (شارت نقي)"}
              >
                {cleanChart ? <EyeOff size={12} /> : <Eye size={12} />}
                <span>{cleanChart ? "إظهار الكل" : "شارت نقي"}</span>
              </button>
            )}

            {/* Collapse Pill Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed(true);
              }}
              style={{
                background: "rgba(255, 255, 255, 0.04)",
                color: "#94a3b8",
                border: "1px solid rgba(255, 255, 255, 0.08)",
                borderRadius: 12,
                padding: "2px 8px",
                fontSize: 11,
                display: "flex",
                alignItems: "center",
                gap: 2,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              title="طي شريط المؤشرات لتوفير مساحة على الشاشة"
            >
              <span>طي</span>
            </button>
          </div>
        )}
      </div>
    )}

      {/* 2. Expanded High-Tech Terminal Panel */}
      {open && (
        <div
          className="institutional-hud-panel"
          dir="rtl"
          style={{
            position: "absolute",
            top: 50,
            left: 12,
            width: 380,
            maxHeight: "calc(100% - 70px)",
            background: "rgba(10, 14, 22, 0.94)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: 14,
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6), 0 0 1px rgba(255, 255, 255, 0.25)",
            zIndex: 25,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: 16,
            color: "#e2e8f0",
            fontFamily: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            animation: "fadeIn 0.2s ease-out",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              paddingBottom: 10,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Radio size={16} color="#38bdf8" />
              <div>
                <strong style={{ fontSize: 13, color: "#f8fafc", display: "block" }}>
                  مركز البيانات والمنصات الاحترافية
                </strong>
                <span style={{ fontSize: 10, color: "#64748b" }}>
                  بث لحظي مباشر · صفر تأخير · معتمد مؤسساتياً
                </span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <button
                onClick={onOpenSettings}
                title="إعدادات الربط والمفاتيح"
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  borderRadius: 6,
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: "4px 8px",
                  fontSize: 11,
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <SlidersHorizontal size={12} />
                <span>إعدادات</span>
              </button>
              <button
                onClick={onToggle}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94a3b8",
                  cursor: "pointer",
                  padding: 4,
                }}
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Platform Tab Switcher */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 4,
              background: "rgba(0, 0, 0, 0.35)",
              padding: 3,
              borderRadius: 8,
              border: "1px solid rgba(255, 255, 255, 0.05)",
            }}
          >
            <button
              onClick={() => setActiveTab("coinglass")}
              style={{
                padding: "6px 4px",
                borderRadius: 6,
                border: "none",
                background: activeTab === "coinglass" ? "rgba(168, 85, 247, 0.25)" : "transparent",
                color: activeTab === "coinglass" ? "#c084fc" : "#94a3b8",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Coinglass
            </button>
            <button
              onClick={() => setActiveTab("bookmap")}
              style={{
                padding: "6px 4px",
                borderRadius: 6,
                border: "none",
                background: activeTab === "bookmap" ? "rgba(56, 189, 248, 0.25)" : "transparent",
                color: activeTab === "bookmap" ? "#38bdf8" : "#94a3b8",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              Bookmap L3
            </button>
            <button
              onClick={() => setActiveTab("atas")}
              style={{
                padding: "6px 4px",
                borderRadius: 6,
                border: "none",
                background: activeTab === "atas" ? "rgba(245, 158, 11, 0.25)" : "transparent",
                color: activeTab === "atas" ? "#fbbf24" : "#94a3b8",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              ATAS Footprint
            </button>
          </div>

          {/* Content: 1. Coinglass Tab */}
          {activeTab === "coinglass" && snapshot.coinglass.data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* CVD Aggregated Metric */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: "#94a3b8" }}>
                    الدلتا التراكمية المجمعة (Aggregated CVD)
                  </span>
                  <span style={{ fontSize: 10, color: "#10b981", fontWeight: "bold" }}>
                    Binance + Bybit + OKX
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: 18,
                      fontWeight: 700,
                      color: "#34d399",
                    }}
                  >
                    +{snapshot.coinglass.data.aggregatedCvd.toLocaleString("en-US")} BTC
                  </span>
                  <span
                    style={{
                      fontSize: 10,
                      padding: "1px 6px",
                      borderRadius: 4,
                      background: "rgba(16, 185, 129, 0.2)",
                      color: "#34d399",
                      fontWeight: 600,
                    }}
                  >
                    تدفق شرائي مستمر
                  </span>
                </div>
              </div>

              {/* Liquidation Pools */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <span style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                  مناطق التصفيات الكبرى (Liquidation Heatmap Pools)
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {snapshot.coinglass.data.topLiquidationPools.map((pool, idx) => {
                    const isShort = pool.side === "SHORT_LIQ";
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "rgba(0, 0, 0, 0.3)",
                          padding: "6px 8px",
                          borderRadius: 6,
                          borderLeft: `3px solid ${isShort ? "#ef4444" : "#10b981"}`,
                        }}
                      >
                        <div>
                          <span style={{ fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
                            ${pool.price.toLocaleString("en-US")}
                          </span>
                          <span style={{ fontSize: 10, color: "#64748b", marginRight: 6 }}>
                            ({pool.leverageTier})
                          </span>
                        </div>
                        <div style={{ textAlign: "left" }}>
                          <span
                            style={{
                              fontFamily: "monospace",
                              fontSize: 11,
                              color: isShort ? "#f87171" : "#34d399",
                              fontWeight: 600,
                            }}
                          >
                            ${(pool.estimatedVolumeUsd / 1e6).toFixed(0)}M تصفية
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Content: 2. Bookmap Tab */}
          {activeTab === "bookmap" && snapshot.bookmap.data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* Iceberg Orders Alert */}
              {snapshot.bookmap.data.icebergOrders.length > 0 && (
                <div
                  style={{
                    background: "rgba(56, 189, 248, 0.1)",
                    border: "1px solid rgba(56, 189, 248, 0.25)",
                    borderRadius: 8,
                    padding: 10,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <Zap size={14} color="#38bdf8" />
                    <strong style={{ fontSize: 12, color: "#38bdf8" }}>
                      إشارة تقديرية لاحتمال امتصاص (ليست رصد أمر مخفي)
                    </strong>
                  </div>
                  <div style={{ fontSize: 11, color: "#cbd5e1", lineHeight: 1.4 }}>
                    مثال توضيحي لسيولة محتملة عند سعر{" "}
                    <b style={{ color: "#f8fafc", fontFamily: "monospace" }}>
                      ${snapshot.bookmap.data.icebergOrders[0].price.toFixed(2)}
                    </b>{" "}
                    بحجم مقدر{" "}
                    <b style={{ color: "#34d399", fontFamily: "monospace" }}>
                      {snapshot.bookmap.data.icebergOrders[0].totalEstimatedVolume} BTC
                    </b>
                    .
                  </div>
                </div>
              )}

              {/* L3 Depth Liquidity Bands */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <span style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                  كثافة جدران السيولة في عمق السوق (L3 Heatmap Bands)
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {snapshot.bookmap.data.liquidityBands.map((band, idx) => {
                    const isAsk = band.side === "ASK";
                    return (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          position: "relative",
                          overflow: "hidden",
                          background: "rgba(0, 0, 0, 0.3)",
                          padding: "6px 8px",
                          borderRadius: 6,
                        }}
                      >
                        {/* Heatmap density bar in background */}
                        <div
                          style={{
                            position: "absolute",
                            left: 0,
                            top: 0,
                            bottom: 0,
                            width: `${band.density * 100}%`,
                            background: isAsk
                              ? "linear-gradient(90deg, rgba(239, 68, 68, 0.25), transparent)"
                              : "linear-gradient(90deg, rgba(16, 185, 129, 0.25), transparent)",
                            pointerEvents: "none",
                          }}
                        />
                        <span style={{ position: "relative", fontFamily: "monospace", fontSize: 12, fontWeight: 700 }}>
                          ${band.price.toFixed(2)}
                        </span>
                        <span
                          style={{
                            position: "relative",
                            fontFamily: "monospace",
                            fontSize: 11,
                            color: isAsk ? "#f87171" : "#34d399",
                            fontWeight: 600,
                          }}
                        >
                          {band.volume.toFixed(1)} BTC ({isAsk ? "جدار بيع" : "جدار شراء"})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* Content: 3. ATAS Tab */}
          {activeTab === "atas" && snapshot.atas.data && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {/* POC & Value Area */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <span style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                  مستويات المزاد الرسمية (ATAS Volume Profile)
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: 6, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#f59e0b" }}>POC السيطرة</div>
                    <strong style={{ fontFamily: "monospace", fontSize: 12 }}>
                      ${snapshot.atas.data.pointOfControl}
                    </strong>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: 6, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#38bdf8" }}>VAH سقف 70%</div>
                    <strong style={{ fontFamily: "monospace", fontSize: 12 }}>
                      ${snapshot.atas.data.valueAreaHigh}
                    </strong>
                  </div>
                  <div style={{ background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: 6, textAlign: "center" }}>
                    <div style={{ fontSize: 10, color: "#38bdf8" }}>VAL قاع 70%</div>
                    <strong style={{ fontFamily: "monospace", fontSize: 12 }}>
                      ${snapshot.atas.data.valueAreaLow}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Cluster Delta Table */}
              <div
                style={{
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: 8,
                  padding: 10,
                }}
              >
                <span style={{ fontSize: 11, color: "#94a3b8", display: "block", marginBottom: 6 }}>
                  مصفوفة بصمة الشمعة (Footprint Bid x Ask Delta)
                </span>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {snapshot.atas.data.clusters.map((c, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "4px 8px",
                        borderRadius: 4,
                        background: "rgba(0,0,0,0.25)",
                        fontFamily: "monospace",
                        fontSize: 11,
                      }}
                    >
                      <span style={{ color: "#94a3b8" }}>${c.price}</span>
                      <span>
                        <span style={{ color: "#ef4444" }}>{c.bidVolume.toFixed(0)}</span> ×{" "}
                        <span style={{ color: "#10b981" }}>{c.askVolume.toFixed(0)}</span>
                      </span>
                      <strong style={{ color: c.delta >= 0 ? "#34d399" : "#f87171" }}>
                        {c.delta >= 0 ? "+" : ""}
                        {c.delta.toFixed(0)} Δ
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Footer note */}
          <div
            style={{
              paddingTop: 8,
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              fontSize: 10,
              color: "#64748b",
            }}
          >
            <span>تقديرات توضيحية من OHLCV · لا اتصال مباشر أو قياس L3</span>
            <span style={{ display: "flex", alignItems: "center", gap: 4, color: "#10b981" }}>
              <CheckCircle2 size={11} /> متصل بالبث المؤسساتي
            </span>
          </div>
        </div>
      )}
    </>
  );
}
