"use client";

import React, { useState, useEffect } from "react";
import {
  SlidersHorizontal,
  Flame,
  Layers,
  CircleDot,
  Sparkles,
  Award,
  RotateCcw,
  Check,
  X,
  Eye,
  Activity,
  Sliders,
} from "lucide-react";
import {
  type InstitutionalChartConfig,
  DEFAULT_INSTITUTIONAL_CONFIG,
  saveInstitutionalChartConfig,
} from "@/lib/institutional-chart-types";

interface InstitutionalSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  config: InstitutionalChartConfig;
  onChange: (newConfig: InstitutionalChartConfig) => void;
}

export default function InstitutionalSettingsModal({
  isOpen,
  onClose,
  config,
  onChange,
}: InstitutionalSettingsModalProps) {
  const [localConfig, setLocalConfig] = useState<InstitutionalChartConfig>(config);
  const [activeTab, setActiveTab] = useState<"layers" | "candles" | "thresholds">("layers");

  useEffect(() => {
    setLocalConfig(config);
  }, [config, isOpen]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof InstitutionalChartConfig) => {
    const updated = {
      ...localConfig,
      [key]: !localConfig[key],
    };
    setLocalConfig(updated);
    onChange(updated);
    saveInstitutionalChartConfig(updated);
  };

  const handleChange = <K extends keyof InstitutionalChartConfig>(
    key: K,
    value: InstitutionalChartConfig[K]
  ) => {
    const updated = {
      ...localConfig,
      [key]: value,
    };
    setLocalConfig(updated);
    onChange(updated);
    saveInstitutionalChartConfig(updated);
  };

  const handleReset = () => {
    setLocalConfig(DEFAULT_INSTITUTIONAL_CONFIG);
    onChange(DEFAULT_INSTITUTIONAL_CONFIG);
    saveInstitutionalChartConfig(DEFAULT_INSTITUTIONAL_CONFIG);
  };

  return (
    <div
      className="institutional-settings-backdrop"
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(3, 7, 18, 0.75)",
        backdropFilter: "blur(8px)",
        WebkitBackdropFilter: "blur(8px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      dir="rtl"
    >
      <div
        className="institutional-settings-card"
        style={{
          width: "100%",
          maxWidth: "580px",
          background: "#0c131f",
          border: "1px solid rgba(56, 189, 248, 0.25)",
          borderRadius: "16px",
          boxShadow: "0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(56, 189, 248, 0.12)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          color: "#f1f5f9",
          fontFamily: "system-ui, -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(15, 23, 42, 0.6)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#ffffff",
                boxShadow: "0 0 15px rgba(56, 189, 248, 0.4)",
              }}
            >
              <SlidersHorizontal size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: "700", margin: 0, color: "#f8fafc" }}>
                إعدادات المؤشرات المؤسساتية على الشارت
              </h2>
              <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                تخصيص كامل للطبقات، دقة الشموع، وحساسية الكشف التلقائي
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "6px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
            }}
            title="إغلاق"
          >
            <X size={18} />
          </button>
        </header>

        {/* Tab Navigation */}
        <div
          style={{
            display: "flex",
            padding: "8px 16px",
            gap: "8px",
            borderBottom: "1px solid rgba(255, 255, 255, 0.06)",
            background: "rgba(2, 6, 23, 0.4)",
          }}
        >
          {[
            { id: "layers", label: "الطبقات البصرية", icon: Layers },
            { id: "candles", label: "نطاق الشموع والحجم", icon: Activity },
            { id: "thresholds", label: "حساسية التصفية والمزاد", icon: Award },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: active ? 600 : 500,
                  color: active ? "#38bdf8" : "#94a3b8",
                  background: active ? "rgba(56, 189, 248, 0.12)" : "transparent",
                  border: active ? "1px solid rgba(56, 189, 248, 0.3)" : "1px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
              >
                <Icon size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Modal Body */}
        <div style={{ padding: "20px", maxHeight: "380px", overflowY: "auto" }}>
          {/* TAB 1: Visual Layers Toggles */}
          {activeTab === "layers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "12px", color: "#94a3b8" }}>
                اختر المؤشرات التي ترغب في رسمها مباشرة فوق الشموع وعلى مسطرة الأسعار:
              </p>

              {/* Coinglass Liquidation Pools */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: localConfig.showLiquidationPools
                    ? "rgba(239, 68, 68, 0.08)"
                    : "rgba(15, 23, 42, 0.4)",
                  border: localConfig.showLiquidationPools
                    ? "1px solid rgba(239, 68, 68, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      background: "rgba(239, 68, 68, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#ef4444",
                    }}
                  >
                    <Flame size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>برك التصفية (Coinglass)</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      خطوط مغناطيسية نيون بالأعلى والأسفل لمناطق تصفية الشورت واللونج الضخمة
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localConfig.showLiquidationPools}
                  onChange={() => handleToggle("showLiquidationPools")}
                  style={{ width: "18px", height: "18px", accentColor: "#ef4444", cursor: "pointer" }}
                />
              </div>

              {/* Bookmap Liquidity Walls */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: localConfig.showLiquidityWalls
                    ? "rgba(56, 189, 248, 0.08)"
                    : "rgba(15, 23, 42, 0.4)",
                  border: localConfig.showLiquidityWalls
                    ? "1px solid rgba(56, 189, 248, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      background: "rgba(56, 189, 248, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#38bdf8",
                    }}
                  >
                    <Layers size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>جدران السيولة والعمق (Bookmap L3)</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      أشرطة أفقية مشعة على يمين الشارت توضح عروض الشراء والبيع المعلقة الكبرى
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localConfig.showLiquidityWalls}
                  onChange={() => handleToggle("showLiquidityWalls")}
                  style={{ width: "18px", height: "18px", accentColor: "#38bdf8", cursor: "pointer" }}
                />
              </div>

              {/* Volume Flow Bubbles */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: localConfig.showVolumeBubbles
                    ? "rgba(16, 185, 129, 0.08)"
                    : "rgba(15, 23, 42, 0.4)",
                  border: localConfig.showVolumeBubbles
                    ? "1px solid rgba(16, 185, 129, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      background: "rgba(16, 185, 129, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#10b981",
                    }}
                  >
                    <CircleDot size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>فقاعات التدفق الحجمي (Volume Bubbles)</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      فقاعات متوهجة على الشموع تكبر تلقائياً مع الصفقات السوقية الاستثنائية
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localConfig.showVolumeBubbles}
                  onChange={() => handleToggle("showVolumeBubbles")}
                  style={{ width: "18px", height: "18px", accentColor: "#10b981", cursor: "pointer" }}
                />
              </div>

              {/* Absorption Diamond Markers */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: localConfig.showAbsorptionMarkers
                    ? "rgba(168, 85, 247, 0.08)"
                    : "rgba(15, 23, 42, 0.4)",
                  border: localConfig.showAbsorptionMarkers
                    ? "1px solid rgba(168, 85, 247, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      background: "rgba(168, 85, 247, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#c084fc",
                    }}
                  >
                    <Sparkles size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>علامات الامتصاص المؤسساتي (✦ Absorption)</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      شارات ماسية ذكية عند ذيول الشموع تدل على ابتلاع السيولة والارتداد الوشيك
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localConfig.showAbsorptionMarkers}
                  onChange={() => handleToggle("showAbsorptionMarkers")}
                  style={{ width: "18px", height: "18px", accentColor: "#a855f7", cursor: "pointer" }}
                />
              </div>

              {/* ATAS Value Area & POC */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: localConfig.showValueArea
                    ? "rgba(245, 158, 11, 0.08)"
                    : "rgba(15, 23, 42, 0.4)",
                  border: localConfig.showValueArea
                    ? "1px solid rgba(245, 158, 11, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      background: "rgba(245, 158, 11, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#f59e0b",
                    }}
                  >
                    <Award size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>منطقة القيمة والمزاد (ATAS POC & VAH/VAL)</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      خط الـ POC الذهبي وحدود منطقة الـ 70% المظللة بدقة ناعمة
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localConfig.showValueArea}
                  onChange={() => handleToggle("showValueArea")}
                  style={{ width: "18px", height: "18px", accentColor: "#f59e0b", cursor: "pointer" }}
                />
              </div>

              {/* Session Opens (Daily Open, PDH, PDL) */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: localConfig.showSessionOpens
                    ? "rgba(148, 163, 184, 0.08)"
                    : "rgba(15, 23, 42, 0.4)",
                  border: localConfig.showSessionOpens
                    ? "1px solid rgba(148, 163, 184, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      background: "rgba(148, 163, 184, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#e2e8f0",
                    }}
                  >
                    <Sliders size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>الافتتاحات اليومية (Daily Open / PDH / PDL)</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      خط افتتاح اليوم 00:00 UTC وأعلى وأدنى سعر لليوم السابق كمرجع للسيولة
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localConfig.showSessionOpens}
                  onChange={() => handleToggle("showSessionOpens")}
                  style={{ width: "18px", height: "18px", accentColor: "#38bdf8", cursor: "pointer" }}
                />
              </div>

              {/* Session Killzones Shading */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: localConfig.showSessionZones
                    ? "rgba(99, 102, 241, 0.08)"
                    : "rgba(15, 23, 42, 0.4)",
                  border: localConfig.showSessionZones
                    ? "1px solid rgba(99, 102, 241, 0.3)"
                    : "1px solid rgba(255, 255, 255, 0.05)",
                  borderRadius: "10px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <div
                    style={{
                      width: "30px",
                      height: "30px",
                      borderRadius: "8px",
                      background: "rgba(99, 102, 241, 0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#818cf8",
                    }}
                  >
                    <Activity size={16} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "13px" }}>تظليل جلسات التداول (Asia / London / NY Zones)</div>
                    <div style={{ fontSize: "11px", color: "#94a3b8" }}>
                      مناطق تظليل عمودية على الشارت توضح ساعات نشاط آسيا ولندن ونيويورك
                    </div>
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={localConfig.showSessionZones}
                  onChange={() => handleToggle("showSessionZones")}
                  style={{ width: "18px", height: "18px", accentColor: "#818cf8", cursor: "pointer" }}
                />
              </div>
            </div>
          )}

          {/* TAB 2: Candles & Lookback Tuning */}
          {activeTab === "candles" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Candle Lookback Scope */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
                  نطاق فحص الشموع (Candle Lookback):
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                  {[
                    { val: 15, label: "آخر 15 شمعة" },
                    { val: 30, label: "آخر 30 شمعة" },
                    { val: 50, label: "آخر 50 شمعة" },
                    { val: 100, label: "آخر 100 شمعة" },
                  ].map((item) => (
                    <button
                      key={item.val}
                      onClick={() => handleChange("candleLookback", item.val)}
                      style={{
                        padding: "8px 6px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        background:
                          localConfig.candleLookback === item.val
                            ? "#0284c7"
                            : "rgba(15, 23, 42, 0.6)",
                        border:
                          localConfig.candleLookback === item.val
                            ? "1px solid #38bdf8"
                            : "1px solid rgba(255, 255, 255, 0.08)",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontWeight: localConfig.candleLookback === item.val ? 600 : 400,
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <span style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px", display: "block" }}>
                  يحدد عدد الشموع الأخيرة التي يتم احتساب فقاعات الحجم وعلامات الامتصاص عليها لتجنب التشويش.
                </span>
              </div>

              {/* Bubble Volume Multiplier */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>حساسية تدفق الفقاعات (Volume Multiple):</label>
                  <span style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "bold" }}>
                    {localConfig.bubbleVolumeThresholdRatio}x من متوسط الحجم
                  </span>
                </div>
                <input
                  type="range"
                  min="1.1"
                  max="3.0"
                  step="0.1"
                  value={localConfig.bubbleVolumeThresholdRatio}
                  onChange={(e) => handleChange("bubbleVolumeThresholdRatio", parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#0284c7", cursor: "pointer" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#64748b" }}>
                  <span>حساس جداً (1.1x)</span>
                  <span>متوسط (1.5x)</span>
                  <span>صفقات عملاقة فقط (3.0x)</span>
                </div>
              </div>

              {/* Bubble Scale Multiplier */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>حجم وتكبير الفقاعات على الشمعة:</label>
                  <span style={{ fontSize: "12px", color: "#10b981", fontWeight: "bold" }}>
                    {localConfig.bubbleScaleMultiplier}x
                  </span>
                </div>
                <input
                  type="range"
                  min="0.6"
                  max="2.4"
                  step="0.2"
                  value={localConfig.bubbleScaleMultiplier}
                  onChange={(e) => handleChange("bubbleScaleMultiplier", parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#10b981", cursor: "pointer" }}
                />
              </div>

              {/* Absorption Sensitivity */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>حساسية اكتشاف الامتصاص المؤسساتي:</label>
                  <span style={{ fontSize: "12px", color: "#c084fc", fontWeight: "bold" }}>
                    {localConfig.absorptionSensitivity}x معامل الابتلاع
                  </span>
                </div>
                <input
                  type="range"
                  min="1.1"
                  max="2.5"
                  step="0.1"
                  value={localConfig.absorptionSensitivity}
                  onChange={(e) => handleChange("absorptionSensitivity", parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#a855f7", cursor: "pointer" }}
                />
                <span style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginTop: "4px" }}>
                  كلما زاد المعامل، اقتصرت علامات الامتصاص الماسية على أقوى مناطق الارتداد ورفض الأسعار.
                </span>
              </div>
            </div>
          )}

          {/* TAB 3: Liquidity & Value Area Thresholds */}
          {activeTab === "thresholds" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
              {/* Coinglass Min Liquidation Filter */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
                  الحد الأدنى لبرك التصفية المغناطيسية (Coinglass Filter):
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  {[
                    { val: 50_000_000, label: "+50 مليون $" },
                    { val: 100_000_000, label: "+100 مليون $" },
                    { val: 250_000_000, label: "+250 مليون $" },
                  ].map((tier) => (
                    <button
                      key={tier.val}
                      onClick={() => handleChange("minLiquidationUsd", tier.val)}
                      style={{
                        padding: "8px 6px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        background:
                          localConfig.minLiquidationUsd === tier.val
                            ? "#ef4444"
                            : "rgba(15, 23, 42, 0.6)",
                        border:
                          localConfig.minLiquidationUsd === tier.val
                            ? "1px solid #f87171"
                            : "1px solid rgba(255, 255, 255, 0.08)",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontWeight: localConfig.minLiquidationUsd === tier.val ? 600 : 400,
                      }}
                    >
                      {tier.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bookmap Depth Wall Density */}
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>كثافة جدران السيولة المعلقة (Bookmap Density):</label>
                  <span style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "bold" }}>
                    {(localConfig.liquidityWallMinDensity * 100).toFixed(0)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="0.8"
                  step="0.05"
                  value={localConfig.liquidityWallMinDensity}
                  onChange={(e) => handleChange("liquidityWallMinDensity", parseFloat(e.target.value))}
                  style={{ width: "100%", accentColor: "#0284c7", cursor: "pointer" }}
                />
                <span style={{ fontSize: "11px", color: "#94a3b8", display: "block", marginTop: "4px" }}>
                  فلترة جدران الأوامر وإظهار الجدران الضخمة فقط لحماية الشارت من الازدحام.
                </span>
              </div>

              {/* ATAS Value Area % */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 600, marginBottom: "8px" }}>
                  نسبة منطقة القيمة بالمزاد (Value Area %):
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                  {[
                    { val: 68, label: "68% (1 StdDev)" },
                    { val: 70, label: "70% (معياري ATAS)" },
                    { val: 80, label: "80% (منطقة موسعة)" },
                  ].map((p) => (
                    <button
                      key={p.val}
                      onClick={() => handleChange("valueAreaPercentage", p.val)}
                      style={{
                        padding: "8px 6px",
                        borderRadius: "8px",
                        fontSize: "12px",
                        background:
                          localConfig.valueAreaPercentage === p.val
                            ? "#f59e0b"
                            : "rgba(15, 23, 42, 0.6)",
                        border:
                          localConfig.valueAreaPercentage === p.val
                            ? "1px solid #fbbf24"
                            : "1px solid rgba(255, 255, 255, 0.08)",
                        color: "#ffffff",
                        cursor: "pointer",
                        fontWeight: localConfig.valueAreaPercentage === p.val ? 600 : 400,
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price Badges Toggle */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "rgba(15, 23, 42, 0.4)",
                  border: "1px solid rgba(255, 255, 255, 0.06)",
                  borderRadius: "8px",
                }}
              >
                <div>
                  <div style={{ fontSize: "12px", fontWeight: 600 }}>شارات الأسعار على المسطرة اليمنى</div>
                  <div style={{ fontSize: "10px", color: "#94a3b8" }}>عرض أرقام المستويات وأحجام التصفية بجانب مسطرة الأسعار</div>
                </div>
                <input
                  type="checkbox"
                  checked={localConfig.showPriceBadges}
                  onChange={() => handleToggle("showPriceBadges")}
                  style={{ width: "16px", height: "16px", accentColor: "#0284c7", cursor: "pointer" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 20px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            background: "rgba(15, 23, 42, 0.8)",
          }}
        >
          <button
            onClick={handleReset}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "6px",
              background: "transparent",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              color: "#94a3b8",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            <RotateCcw size={13} />
            <span>الإعدادات الافتراضية</span>
          </button>

          <button
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 18px",
              borderRadius: "8px",
              background: "linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)",
              border: "none",
              color: "#ffffff",
              fontSize: "12px",
              fontWeight: 600,
              cursor: "pointer",
              boxShadow: "0 0 12px rgba(56, 189, 248, 0.4)",
            }}
          >
            <Check size={14} />
            <span>تطبيق وحفظ التعديلات</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
