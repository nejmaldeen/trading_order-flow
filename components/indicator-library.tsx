"use client";
import { useEffect, useRef, useState } from "react";
import { Search, Star, X, ChartNoAxesCombined, SlidersHorizontal } from "lucide-react";
import type { IndicatorKey, IndicatorSettings } from "@/lib/indicators";
import type { InstitutionalChartConfig } from "@/lib/institutional-chart-types";

const catalog = [
  { id: "session_profile", name: "بروفايل سيولة الجلسات اليومية", code: "SVP · Session Profile", description: "توزيع السيولة الأفقي لكل يوم، منطقة القيمة (70%)، وخط السيطرة (POC).", category: "orderflow" },
  { id: "inst_liq", name: "برك التصفية المغناطيسية", code: "Coinglass Liq", description: "خطوط نيون أفقية على الشارت لمناطق تصفية الشورت واللونج الضخمة.", category: "orderflow" },
  { id: "inst_walls", name: "جدران السيولة والعمق", code: "Bookmap L3", description: "أشرطة أفقية مشعة على يمين الشارت توضح عروض الشراء والبيع المعلقة الكبرى.", category: "orderflow" },
  { id: "inst_bubbles", name: "فقاعات التدفق الحجمي", code: "Volume Bubbles", description: "فقاعات نيون متوهجة على الشموع تكبر ديناميكياً مع الصفقات السوقية الكبرى.", category: "orderflow" },
  { id: "inst_absorb", name: "علامات الامتصاص المؤسساتي", code: "Absorption ✦", description: "شارات ماسية متوهجة عند ذيول الشموع توضح ابتلاع السيولة من صانع السوق.", category: "orderflow" },
  { id: "inst_poc", name: "منطقة القيمة والمزاد", code: "ATAS POC / VA", description: "خط POC الذهبي وتظليل منطقة الـ 70% من التداولات المؤسساتية.", category: "orderflow" },
  // Standard Indicators
  { id: "sma", name: "المتوسط المتحرك البسيط", code: "SMA", description: "متوسط الإغلاق لعدد الشموع المختار.", category: "standard" },
  { id: "ema", name: "المتوسط المتحرك الأُسّي", code: "EMA", description: "متوسط يمنح الشموع الحديثة وزنًا أكبر.", category: "standard" },
  { id: "bands", name: "نطاقات بولينجر", code: "Bollinger Bands", description: "متوسط متحرك ونطاقان بانحرافين معياريين.", category: "standard" },
  { id: "vwap", name: "متوسط السعر المرجّح بالحجم", code: "VWAP", description: "متوسط السعر الموزون بالحجم؛ يدعم نافذة الشموع المتحركة (Rolling) أو بداية اليوم UTC.", category: "standard" },
  { id: "volume", name: "أحجام التداول", code: "Volume", description: "حجم التداول لكل شمعة أسفل الشارت، مع خط متوسط الحجم المتحرك (Volume MA).", category: "standard" },
] as const;

type Props = {
  open: boolean;
  onClose: () => void;
  settings: IndicatorSettings;
  onChange: (v: IndicatorSettings) => void;
  vwap: boolean;
  onVwap: (v: boolean) => void;
  vwapPeriod?: number;
  onVwapPeriodChange?: (v: number) => void;
  vwapMode?: "rolling" | "daily";
  onVwapModeChange?: (m: "rolling" | "daily") => void;
  volume: boolean;
  onVolume: (v: boolean) => void;
  volumeMaPeriod?: number;
  onVolumeMaPeriodChange?: (v: number) => void;
  showVolumeMa?: boolean;
  onShowVolumeMaChange?: (v: boolean) => void;
  sessionVolumeProfile?: boolean;
  onSessionVolumeProfile?: (v: boolean) => void;
  sessionProfileGrouping?: string;
  institutionalConfig?: InstitutionalChartConfig;
  onInstitutionalChange?: (v: InstitutionalChartConfig) => void;
  onOpenInstitutionalSettings?: () => void;
};

export default function IndicatorLibrary(p: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("replay-indicator-favorites") || "[]");
      if (Array.isArray(v)) setFavorites(v.filter((x) => typeof x === "string"));
    } catch {}
    setReady(true);
  }, []);

  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem("replay-indicator-favorites", JSON.stringify(favorites));
      } catch {}
    }
  }, [favorites, ready]);

  useEffect(() => {
    if (p.open && !ref.current?.open) ref.current?.showModal();
    else if (!p.open && ref.current?.open) ref.current?.close();
  }, [p.open]);

  const active = (id: string) => {
    if (id === "session_profile") return Boolean(p.sessionVolumeProfile);
    if (id === "vwap") return p.vwap;
    if (id === "volume") return p.volume;
    if (id === "inst_liq") return Boolean(p.institutionalConfig?.showLiquidationPools);
    if (id === "inst_walls") return Boolean(p.institutionalConfig?.showLiquidityWalls);
    if (id === "inst_bubbles") return Boolean(p.institutionalConfig?.showVolumeBubbles);
    if (id === "inst_absorb") return Boolean(p.institutionalConfig?.showAbsorptionMarkers);
    if (id === "inst_poc") return Boolean(p.institutionalConfig?.showValueArea);
    return p.settings[id as IndicatorKey]?.enabled ?? false;
  };

  const toggle = (id: string) => {
    if (id === "session_profile") p.onSessionVolumeProfile?.(!p.sessionVolumeProfile);
    else if (id === "vwap") p.onVwap(!p.vwap);
    else if (id === "volume") p.onVolume(!p.volume);
    else if (id.startsWith("inst_") && p.institutionalConfig && p.onInstitutionalChange) {
      const cfg = { ...p.institutionalConfig };
      if (id === "inst_liq") cfg.showLiquidationPools = !cfg.showLiquidationPools;
      else if (id === "inst_walls") cfg.showLiquidityWalls = !cfg.showLiquidityWalls;
      else if (id === "inst_bubbles") cfg.showVolumeBubbles = !cfg.showVolumeBubbles;
      else if (id === "inst_absorb") cfg.showAbsorptionMarkers = !cfg.showAbsorptionMarkers;
      else if (id === "inst_poc") cfg.showValueArea = !cfg.showValueArea;
      p.onInstitutionalChange(cfg);
    } else {
      const key = id as IndicatorKey;
      p.onChange({ ...p.settings, [key]: { ...p.settings[key], enabled: !p.settings[key].enabled } });
    }
  };

  const rows = catalog.filter((x) => {
    const matchSearch = `${x.name} ${x.code}`.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (category === "all") return true;
    if (category === "orderflow") return x.category === "orderflow";
    if (category === "favorites") return favorites.includes(x.id);
    if (category === "active") return active(x.id);
    return true;
  });

  return (
    <dialog
      ref={ref}
      className="indicator-dialog"
      aria-labelledby="indicator-title"
      onCancel={p.onClose}
      onClose={p.onClose}
      dir="rtl"
    >
      <header>
        <h2 id="indicator-title">
          <ChartNoAxesCombined size={22} /> المؤشرات وبيانات السيولة
        </h2>
        <button onClick={p.onClose} aria-label="إغلاق المؤشرات">
          <X />
        </button>
      </header>

      <label className="indicator-search">
        <Search size={20} />
        <input
          placeholder="ابحث عن مؤشر أو أداة سيولة…"
          aria-label="البحث عن مؤشر"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>

      <div className="indicator-browser">
        <nav aria-label="فئات المؤشرات">
          {[
            ["all", "كل المؤشرات"],
            ["orderflow", "المؤسساتية والسيولة"],
            ["favorites", "المفضلة"],
            ["active", "على الشارت"],
          ].map(([id, label]) => (
            <button key={id} aria-pressed={category === id} onClick={() => setCategory(id)}>
              {label}
            </button>
          ))}
          <p>تُحسب وترسم بصرياً على الشموع ومسطرة الأسعار مباشرة.</p>
        </nav>

        <div className="indicator-results">
          {rows.map((x) => (
            <article key={x.id}>
              <button
                className="favorite-indicator"
                aria-label={`تفضيل ${x.code}`}
                aria-pressed={favorites.includes(x.id)}
                onClick={() =>
                  setFavorites((v) => (v.includes(x.id) ? v.filter((id) => id !== x.id) : [...v, x.id]))
                }
              >
                <Star size={18} fill={favorites.includes(x.id) ? "currentColor" : "none"} />
              </button>
              <div>
                <h3>
                  {x.name} <small>{x.code}</small>
                </h3>
                <p>{x.description}</p>
                {x.id in p.settings && (
                  <label className="indicator-period">
                    الفترة{" "}
                    <input
                      aria-label={`فترة ${x.code}`}
                      type="number"
                      min={2}
                      max={200}
                      value={p.settings[x.id as IndicatorKey].period}
                      onChange={(e) => {
                        const value = Number(e.target.value);
                        if (Number.isInteger(value) && value >= 2 && value <= 200) {
                          p.onChange({
                            ...p.settings,
                            [x.id]: { ...p.settings[x.id as IndicatorKey], period: value },
                          });
                        }
                      }}
                    />{" "}
                    شمعة
                  </label>
                )}
                {x.id === "vwap" && (
                  <div className="vwap-settings-block">
                    <label className="indicator-period">
                      الفترة{" "}
                      <input
                        aria-label="فترة VWAP بالشموع"
                        type="number"
                        min={2}
                        max={500}
                        value={p.vwapPeriod ?? 20}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (Number.isInteger(val) && val >= 2 && val <= 500) {
                            p.onVwapPeriodChange?.(val);
                          }
                        }}
                      />{" "}
                      شمعة
                    </label>
                    <div className="vwap-mode-strip" role="group" aria-label="طريقة حساب VWAP">
                      <button
                        type="button"
                        className={`vwap-mode-btn ${(p.vwapMode ?? "rolling") === "rolling" ? "active" : ""}`}
                        onClick={() => p.onVwapModeChange?.("rolling")}
                        title="حساب VWAP على نافذة متحركة لآخر N شمعة محددة"
                      >
                        نافذة متحركة ({p.vwapPeriod ?? 20} شمعة)
                      </button>
                      <button
                        type="button"
                        className={`vwap-mode-btn ${p.vwapMode === "daily" ? "active" : ""}`}
                        onClick={() => p.onVwapModeChange?.("daily")}
                        title="حساب VWAP تراكمي من بداية اليوم 00:00 UTC"
                      >
                        بداية اليوم UTC
                      </button>
                    </div>
                  </div>
                )}
                {x.id === "volume" && (
                  <div className="volume-settings-block">
                    <label className="indicator-period">
                      متوسط الحجم (Volume MA){" "}
                      <input
                        aria-label="فترة متوسط حجم التداول بالشموع"
                        type="number"
                        min={2}
                        max={200}
                        value={p.volumeMaPeriod ?? 20}
                        onChange={(e) => {
                          const val = Number(e.target.value);
                          if (Number.isInteger(val) && val >= 2 && val <= 200) {
                            p.onVolumeMaPeriodChange?.(val);
                          }
                        }}
                      />{" "}
                      شمعة
                    </label>
                    <label className="volume-ma-checkbox">
                      <input
                        type="checkbox"
                        checked={p.showVolumeMa ?? false}
                        onChange={(e) => p.onShowVolumeMaChange?.(e.target.checked)}
                      />
                      <span>إظهار خط متوسط الحجم على الهستوجرام</span>
                    </label>
                  </div>
                )}
                {x.id === "session_profile" && (
                  <div className="svp-indicator-info">
                    <span className="svp-info-badge">
                      نطاق التجميع الحالي: {p.sessionProfileGrouping === "week" ? "أسبوعي" : p.sessionProfileGrouping === "month" ? "شهري" : p.sessionProfileGrouping === "day" ? "يومي" : "تلقائي (أسبوعي على اليومي)"}
                    </span>
                  </div>
                )}
                {x.category === "orderflow" && p.onOpenInstitutionalSettings && (
                  <button
                    type="button"
                    onClick={() => {
                      p.onClose();
                      p.onOpenInstitutionalSettings?.();
                    }}
                    style={{
                      marginTop: 4,
                      background: "rgba(56, 189, 248, 0.12)",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      borderRadius: 4,
                      color: "#38bdf8",
                      fontSize: 10,
                      padding: "2px 6px",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <SlidersHorizontal size={10} />
                    <span>تخصيص الحساسية والشموع</span>
                  </button>
                )}
              </div>
              <button className="toggle-indicator" aria-pressed={active(x.id)} onClick={() => toggle(x.id)}>
                {active(x.id) ? "إزالة" : "إضافة"}
              </button>
            </article>
          ))}
          {!rows.length && (
            <div className="indicator-empty">لا توجد مؤشرات هنا. ابحث باسم آخر أو أضف مؤشرًا إلى المفضلة.</div>
          )}
          <p className="indicator-footnote">
            جميع المؤشرات المؤسساتية تتزامن لحظياً مع حركة الشموع وأسعار التنفيذ.
          </p>
        </div>
      </div>
    </dialog>
  );
}
