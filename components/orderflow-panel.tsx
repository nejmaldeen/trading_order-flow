"use client";

import { useMemo } from "react";
import type { Candle } from "@/lib/replay";
import {
  computeOrderFlowProfile,
  computeCVDSeries,
  detectBigTradesAndAbsorption,
  evaluateCZTFramework,
} from "@/lib/orderflow";
import {
  ShieldAlert,
  TrendingUp,
  TrendingDown,
  Layers,
  Activity,
  Target,
  Zap,
  CheckCircle2,
  AlertCircle,
  X,
} from "lucide-react";

interface OrderFlowPanelProps {
  candles: Candle[];
  open: boolean;
  onClose: () => void;
  showOverlay: boolean;
  onToggleOverlay: () => void;
  showCvd: boolean;
  onToggleCvd: () => void;
}

export default function OrderFlowPanel({
  candles,
  open,
  onClose,
  showOverlay,
  onToggleOverlay,
  showCvd,
  onToggleCvd,
}: OrderFlowPanelProps) {
  const slice = useMemo(() => candles.slice(-180), [candles]);

  const profile = useMemo(() => {
    return computeOrderFlowProfile(slice, 42, 0.70);
  }, [slice]);

  const cvdEntries = useMemo(() => {
    return computeCVDSeries(slice);
  }, [slice]);

  const bigTrades = useMemo(() => {
    return detectBigTradesAndAbsorption(slice);
  }, [slice]);

  const czt = useMemo(() => {
    return evaluateCZTFramework(slice, profile);
  }, [slice, profile]);

  if (!open) return null;

  const latestCvd = cvdEntries[cvdEntries.length - 1];
  const lastDivergence = [...cvdEntries].reverse().find((e) => e.isDivergence);
  const absorptionCount = bigTrades.filter((b) => b.isAbsorption).length;

  return (
    <div
      className="orderflow-hud-drawer"
      dir="rtl"
      style={{
        position: "absolute",
        top: 48,
        left: 16,
        width: 340,
        maxHeight: "calc(100% - 64px)",
        background: "rgba(18, 18, 22, 0.94)",
        backdropFilter: "blur(12px)",
        border: "1px solid rgba(255, 255, 255, 0.12)",
        borderRadius: 12,
        boxShadow: "0 12px 32px rgba(0, 0, 0, 0.5)",
        zIndex: 20,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: 12,
        padding: 16,
        color: "#e2e8f0",
        fontSize: 13,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
          paddingBottom: 8,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Layers size={18} color="#38bdf8" />
          <strong style={{ fontSize: 14, color: "#f8fafc" }}>
            رادار تدفق الأوامر ومناطق المزاد (CZT)
          </strong>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "transparent",
            border: "none",
            color: "#94a3b8",
            cursor: "pointer",
            padding: 4,
          }}
          aria-label="إغلاق رادار تدفق الأوامر"
        >
          <X size={16} />
        </button>
      </div>

      {/* Auction State (Condition) */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: 8,
          padding: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>1. حالة المزاد المؤسساتي (Condition)</span>
          <span
            style={{
              padding: "2px 8px",
              borderRadius: 4,
              fontSize: 10,
              fontWeight: "bold",
              background:
                czt.condition === "VALUE_UP"
                  ? "rgba(16, 185, 129, 0.2)"
                  : czt.condition === "VALUE_DOWN"
                  ? "rgba(239, 68, 68, 0.2)"
                  : "rgba(245, 158, 11, 0.2)",
              color:
                czt.condition === "VALUE_UP"
                  ? "#34d399"
                  : czt.condition === "VALUE_DOWN"
                  ? "#f87171"
                  : "#fbbf24",
            }}
          >
            {czt.condition}
          </span>
        </div>
        <div style={{ fontWeight: 600, color: "#f1f5f9", marginBottom: 4 }}>
          {czt.conditionLabel}
        </div>
        <p style={{ margin: 0, fontSize: 11, color: "#cbd5e1", lineHeight: 1.4 }}>
          {czt.summary}
        </p>
      </div>

      {/* Key Profile Levels (Zones) */}
      {profile && (
        <div
          style={{
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid rgba(255, 255, 255, 0.06)",
            borderRadius: 8,
            padding: 10,
          }}
        >
          <span style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 6 }}>
            2. المستويات المؤسساتية الحرجة (Zones)
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: "#f59e0b" }}>POC (السيطرة السعرية)</div>
              <strong style={{ fontFamily: "monospace", fontSize: 13 }}>
                {profile.pocPrice.toFixed(2)}
              </strong>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: "#38bdf8" }}>VAH (سقف القيمة 70%)</div>
              <strong style={{ fontFamily: "monospace", fontSize: 13 }}>
                {profile.vahPrice.toFixed(2)}
              </strong>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: "#38bdf8" }}>VAL (قاع القيمة 70%)</div>
              <strong style={{ fontFamily: "monospace", fontSize: 13 }}>
                {profile.valPrice.toFixed(2)}
              </strong>
            </div>
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "6px 8px", borderRadius: 6 }}>
              <div style={{ fontSize: 10, color: "#c084fc" }}>فجوات السيولة (LVN)</div>
              <strong style={{ fontFamily: "monospace", fontSize: 13 }}>
                {profile.lvnLevels.length} مستويات
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* Order Flow & Delta (Trigger) */}
      <div
        style={{
          background: "rgba(255, 255, 255, 0.03)",
          border: "1px solid rgba(255, 255, 255, 0.06)",
          borderRadius: 8,
          padding: 10,
        }}
      >
        <span style={{ color: "#94a3b8", fontSize: 11, display: "block", marginBottom: 6 }}>
          3. زخم تدفق الأوامر (Trigger / CVD)
        </span>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
          <span style={{ color: "#94a3b8", fontSize: 11 }}>الدلتا التراكمية (CVD):</span>
          <strong
            style={{
              fontFamily: "monospace",
              color: (latestCvd?.cumulativeDelta ?? 0) >= 0 ? "#34d399" : "#f87171",
            }}
          >
            {(latestCvd?.cumulativeDelta ?? 0) > 0 ? "+" : ""}
            {(latestCvd?.cumulativeDelta ?? 0).toFixed(1)}
          </strong>
        </div>

        {/* Divergence alert */}
        {lastDivergence && (
          <div
            style={{
              marginTop: 6,
              padding: "6px 8px",
              borderRadius: 6,
              background:
                lastDivergence.divergenceType === "BULLISH_DIVERGENCE"
                  ? "rgba(16, 185, 129, 0.15)"
                  : "rgba(239, 68, 68, 0.15)",
              border: `1px solid ${
                lastDivergence.divergenceType === "BULLISH_DIVERGENCE" ? "#10b981" : "#ef4444"
              }`,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Zap size={14} color={lastDivergence.divergenceType === "BULLISH_DIVERGENCE" ? "#34d399" : "#f87171"} />
            <span style={{ fontSize: 11, fontWeight: "bold" }}>
              {lastDivergence.divergenceType === "BULLISH_DIVERGENCE"
                ? "تنبيه دايفرجنس شرائي (امتصاص بائعين)"
                : "تنبيه دايفرجنس بيعي (امتصاص مشترين)"}
            </span>
          </div>
        )}

        {/* Absorption Trapped Alert */}
        {absorptionCount > 0 && (
          <div
            style={{
              marginTop: 6,
              padding: "6px 8px",
              borderRadius: 6,
              background: "rgba(245, 158, 11, 0.15)",
              border: "1px solid #f59e0b",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <ShieldAlert size={14} color="#fbbf24" />
            <span style={{ fontSize: 11 }}>
              تم رصد <strong>{absorptionCount}</strong> حالات امتصاص ومحاصرة سيولة مؤسساتية!
            </span>
          </div>
        )}
      </div>

      {/* Layer Toggles */}
      <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
        <button
          onClick={onToggleOverlay}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: showOverlay ? "rgba(56, 189, 248, 0.2)" : "rgba(255, 255, 255, 0.05)",
            color: showOverlay ? "#38bdf8" : "#94a3b8",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {showOverlay ? "إخفاء فقاعات الأوامر" : "عرض فقاعات الأوامر"}
        </button>

        <button
          onClick={onToggleCvd}
          style={{
            flex: 1,
            padding: "6px 10px",
            borderRadius: 6,
            border: "1px solid rgba(255, 255, 255, 0.15)",
            background: showCvd ? "rgba(16, 185, 129, 0.2)" : "rgba(255, 255, 255, 0.05)",
            color: showCvd ? "#34d399" : "#94a3b8",
            cursor: "pointer",
            fontSize: 11,
            fontWeight: 600,
          }}
        >
          {showCvd ? "إخفاء مؤشر CVD" : "عرض مؤشر CVD"}
        </button>
      </div>
    </div>
  );
}
