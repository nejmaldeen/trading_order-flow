"use client";

import React, { useState } from "react";
import { Palette, Check, X, RotateCcw, Sparkles } from "lucide-react";
import { CHART_THEMES, type ChartTheme, type ChartThemeId } from "@/lib/chart-themes";

interface ChartThemeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: ChartTheme;
  onApplyTheme: (theme: ChartTheme) => void;
}

export default function ChartThemeModal({
  isOpen,
  onClose,
  currentTheme,
  onApplyTheme,
}: ChartThemeModalProps) {
  const [selectedId, setSelectedId] = useState<ChartThemeId>(currentTheme.id);
  const [customUp, setCustomUp] = useState(currentTheme.upColor);
  const [customDown, setCustomDown] = useState(currentTheme.downColor);
  const [customBg, setCustomBg] = useState(currentTheme.background);

  if (!isOpen) return null;

  const handleSelectPreset = (id: ChartThemeId) => {
    setSelectedId(id);
    if (id === "custom") {
      const customTheme: ChartTheme = {
        ...CHART_THEMES.custom,
        upColor: customUp,
        downColor: customDown,
        upWickColor: customUp,
        downWickColor: customDown,
        upBorderColor: customUp,
        downBorderColor: customDown,
        background: customBg,
        volumeUp: `${customUp}55`,
        volumeDown: `${customDown}55`,
      };
      onApplyTheme(customTheme);
    } else {
      onApplyTheme(CHART_THEMES[id]);
    }
  };

  const handleCustomChange = (part: "up" | "down" | "bg", color: string) => {
    setSelectedId("custom");
    const nextUp = part === "up" ? color : customUp;
    const nextDown = part === "down" ? color : customDown;
    const nextBg = part === "bg" ? color : customBg;

    if (part === "up") setCustomUp(color);
    if (part === "down") setCustomDown(color);
    if (part === "bg") setCustomBg(color);

    const customTheme: ChartTheme = {
      ...CHART_THEMES.custom,
      upColor: nextUp,
      downColor: nextDown,
      upWickColor: nextUp,
      downWickColor: nextDown,
      upBorderColor: nextUp,
      downBorderColor: nextDown,
      background: nextBg,
      volumeUp: `${nextUp}55`,
      volumeDown: `${nextDown}55`,
    };
    onApplyTheme(customTheme);
  };

  const handleResetToDefault = () => {
    setSelectedId("blue-white");
    onApplyTheme(CHART_THEMES["blue-white"]);
  };

  return (
    <div className="account-balance-overlay" dir="rtl" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="account-balance-card theme-modal-card" role="dialog" aria-modal="true" aria-labelledby="theme-modal-title">
        <header className="balance-modal-header">
          <div className="title-row">
            <div className="modal-icon-wrap" style={{ background: "rgba(56, 189, 248, 0.15)", color: "#38bdf8" }}>
              <Palette size={18} />
            </div>
            <div>
              <h3 id="theme-modal-title">مظهر وألوان الشارت والشموع</h3>
              <small>اختر نسق ألوان هادئ ومريح للعين أو خصص ألوانك المفضلة</small>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="إغلاق">
            <X size={16} />
          </button>
        </header>

        <div className="balance-modal-body">
          {/* Preset Cards Grid */}
          <div className="theme-presets-grid">
            {(Object.keys(CHART_THEMES) as ChartThemeId[]).filter(id => id !== "custom").map((id) => {
              const th = CHART_THEMES[id];
              const isSelected = selectedId === id;
              return (
                <button
                  key={id}
                  type="button"
                  className={`theme-card ${isSelected ? "active" : ""}`}
                  onClick={() => handleSelectPreset(id)}
                >
                  <div className="theme-card-top">
                    <strong>{th.name}</strong>
                    {isSelected && <span className="theme-active-tag"><Check size={11} /> نشط</span>}
                    {id === "blue-white" && <span className="theme-rec-tag"><Sparkles size={10} /> الموصى به</span>}
                  </div>
                  <p className="theme-desc">{th.description}</p>
                  <div className="theme-preview-strip" style={{ background: th.background }}>
                    <div className="preview-candle" style={{ background: th.upColor, borderColor: th.upBorderColor }}>
                      <span className="wick" style={{ background: th.upWickColor }} />
                    </div>
                    <div className="preview-candle" style={{ background: th.downColor, borderColor: th.downBorderColor }}>
                      <span className="wick" style={{ background: th.downWickColor }} />
                    </div>
                    <span className="preview-label">
                      <b style={{ color: th.upColor }}>صاعد</b> / <b style={{ color: th.downColor }}>هابط</b>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Custom Color Pickers Section */}
          <div className="custom-palette-section">
            <div className="section-header-row">
              <strong>تخصيص الألوان يدويًا (Custom)</strong>
              {selectedId === "custom" && <span className="custom-indicator">مفعّل حاليًا</span>}
            </div>
            <div className="custom-pickers-row">
              <label className="picker-item">
                <span>الشموع الصاعدة</span>
                <div className="color-input-wrap">
                  <input
                    type="color"
                    value={customUp}
                    onChange={(e) => handleCustomChange("up", e.target.value)}
                  />
                  <span className="hex-val" dir="ltr">{customUp}</span>
                </div>
              </label>

              <label className="picker-item">
                <span>الشموع الهابطة</span>
                <div className="color-input-wrap">
                  <input
                    type="color"
                    value={customDown}
                    onChange={(e) => handleCustomChange("down", e.target.value)}
                  />
                  <span className="hex-val" dir="ltr">{customDown}</span>
                </div>
              </label>

              <label className="picker-item">
                <span>خلفية الشارت</span>
                <div className="color-input-wrap">
                  <input
                    type="color"
                    value={customBg}
                    onChange={(e) => handleCustomChange("bg", e.target.value)}
                  />
                  <span className="hex-val" dir="ltr">{customBg}</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <footer className="balance-modal-footer">
          <button
            type="button"
            className="btn-default-reset"
            onClick={handleResetToDefault}
            title="استعادة نسق الشموع الزرقاء والبيضاء الهادئ (الأصلي)"
          >
            <RotateCcw size={13} />
            <span>النسق الأزرق الهادئ (الافتراضي)</span>
          </button>

          <button
            type="button"
            className="btn-save"
            onClick={onClose}
          >
            <Check size={14} />
            <span>تم واعتماد المظهر</span>
          </button>
        </footer>
      </div>
    </div>
  );
}
