export type ChartThemeId = "blue-white" | "emerald-rose" | "noir" | "amber-slate" | "custom";

export interface ChartTheme {
  id: ChartThemeId;
  name: string;
  nameEn: string;
  description: string;
  upColor: string;
  downColor: string;
  upWickColor: string;
  downWickColor: string;
  upBorderColor: string;
  downBorderColor: string;
  background: string;
  gridColor: string;
  textColor: string;
  volumeUp: string;
  volumeDown: string;
  accent: string;
}

export const CHART_THEMES: Record<ChartThemeId, ChartTheme> = {
  "blue-white": {
    id: "blue-white",
    name: "أزرق ملكي وفضي هادئ (Institutional)",
    nameEn: "Institutional Blue & Silver",
    description: "مطابق لشاشات التداول المؤسسية الاحترافية (Exness / TradingView Pro) لأقصى درجات التركيز والهدوء البصري",
    upColor: "#2962ff",
    downColor: "#ffffff",
    upWickColor: "#2962ff",
    downWickColor: "#cbd5e1",
    upBorderColor: "#2962ff",
    downBorderColor: "#ffffff",
    background: "#0c1017",
    gridColor: "rgba(255, 255, 255, 0.02)",
    textColor: "#94a3b8",
    volumeUp: "rgba(41, 98, 255, 0.35)",
    volumeDown: "rgba(255, 255, 255, 0.35)",
    accent: "#38bdf8",
  },
  "emerald-rose": {
    id: "emerald-rose",
    name: "زمردي ووردي هادئ (Soft Cyber)",
    nameEn: "Soft Emerald & Rose",
    description: "ألوان خافتة كلاسيكية ناعمة غير فاقعة تحافظ على الدلالة التقليدية بهدوء وسلاسة",
    upColor: "#10b981",
    downColor: "#f43f5e",
    upWickColor: "#10b981",
    downWickColor: "#f43f5e",
    upBorderColor: "#10b981",
    downBorderColor: "#f43f5e",
    background: "#080b11",
    gridColor: "rgba(255, 255, 255, 0.02)",
    textColor: "#64748b",
    volumeUp: "rgba(16, 185, 129, 0.25)",
    volumeDown: "rgba(244, 63, 94, 0.25)",
    accent: "#34d399",
  },
  "noir": {
    id: "noir",
    name: "مونوكروم فاخر (Minimalist Noir)",
    nameEn: "Minimalist Noir",
    description: "أبيض وأسود وفضي نقي مخصص للمتداولين الذين يفضلون البساطة التجريدية الخالصة",
    upColor: "#f8fafc",
    downColor: "#475569",
    upWickColor: "#f8fafc",
    downWickColor: "#64748b",
    upBorderColor: "#ffffff",
    downBorderColor: "#475569",
    background: "#090d16",
    gridColor: "rgba(255, 255, 255, 0.025)",
    textColor: "#94a3b8",
    volumeUp: "rgba(248, 250, 252, 0.3)",
    volumeDown: "rgba(71, 85, 105, 0.4)",
    accent: "#e2e8f0",
  },
  "amber-slate": {
    id: "amber-slate",
    name: "كهرماني ورمادي ليلي (Midnight Amber)",
    nameEn: "Midnight Amber & Slate",
    description: "ألوان دافئة متناسقة ومريحة للغاية في الإضاءة الخافتة ولجلسات التدريب الليلية",
    upColor: "#f59e0b",
    downColor: "#64748b",
    upWickColor: "#f59e0b",
    downWickColor: "#94a3b8",
    upBorderColor: "#d97706",
    downBorderColor: "#64748b",
    background: "#0b0f19",
    gridColor: "rgba(255, 255, 255, 0.02)",
    textColor: "#94a3b8",
    volumeUp: "rgba(245, 158, 11, 0.3)",
    volumeDown: "rgba(100, 116, 139, 0.35)",
    accent: "#fbbf24",
  },
  "custom": {
    id: "custom",
    name: "تخصيص حر (Custom Palette)",
    nameEn: "Custom Palette",
    description: "حدد بحرية تامة ألوان الشموع الصاعدة والهابطة ولون الخلفية بما يلائم شاشتك",
    upColor: "#2962ff",
    downColor: "#ffffff",
    upWickColor: "#2962ff",
    downWickColor: "#cbd5e1",
    upBorderColor: "#2962ff",
    downBorderColor: "#ffffff",
    background: "#0c1017",
    gridColor: "rgba(255, 255, 255, 0.02)",
    textColor: "#94a3b8",
    volumeUp: "rgba(41, 98, 255, 0.35)",
    volumeDown: "rgba(255, 255, 255, 0.35)",
    accent: "#38bdf8",
  },
};

export const DEFAULT_THEME_ID: ChartThemeId = "blue-white";

export function loadSavedChartTheme(): ChartTheme {
  if (typeof window === "undefined") return CHART_THEMES[DEFAULT_THEME_ID];
  try {
    const raw = localStorage.getItem("replay-chart-theme-v2");
    if (!raw) return CHART_THEMES[DEFAULT_THEME_ID];
    const parsed = JSON.parse(raw) as ChartTheme;
    if (parsed && typeof parsed.upColor === "string" && typeof parsed.downColor === "string") {
      return parsed;
    }
  } catch {
    // Ignore storage errors
  }
  return CHART_THEMES[DEFAULT_THEME_ID];
}

export function saveChartTheme(theme: ChartTheme): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem("replay-chart-theme-v2", JSON.stringify(theme));
  } catch {
    // Ignore storage errors
  }
}
