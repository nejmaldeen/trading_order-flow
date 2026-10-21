/**
 * Configuration & Data Models for On-Chart Institutional Indicators.
 * Governs Coinglass Liquidations, Bookmap Depth Walls, Order Flow Bubbles,
 * Absorption Diamonds, and ATAS Value Area (POC / VAH / VAL).
 */

export interface InstitutionalChartConfig {
  // Layer visibility toggles
  showLiquidationPools: boolean; // Coinglass horizontal magnetic liquidation bands
  showLiquidityWalls: boolean;   // Bookmap L3 order book depth bars
  showVolumeBubbles: boolean;    // Aggressive market flow bubbles on candles
  showAbsorptionMarkers: boolean;// Diamond markers at candle wicks for passive absorption
  showValueArea: boolean;        // ATAS POC, VAH, VAL lines and shaded region
  showSessionOpens: boolean;     // Daily Open (00:00 UTC), PDH, PDL reference lines
  showSessionZones: boolean;     // Vertical shading for Asia, London, and New York market killzones

  // Candle & Calculation Tuning
  candleLookback: number;         // Number of recent candles to display bubbles/absorptions for (e.g. 20, 50, 100)
  bubbleVolumeThresholdRatio: number; // Multiple of average volume required to spawn a bubble (e.g. 1.4x)
  bubbleScaleMultiplier: number;      // Visual bubble size scale (0.8 to 2.2)
  absorptionSensitivity: number;      // Sensitivity factor for wick absorption detection (1.2 to 2.5)
  minLiquidationUsd: number;          // Min USD size for Coinglass pool lines (e.g. 50_000_000)
  liquidityWallMinDensity: number;    // Min depth intensity for Bookmap walls (0.2 to 0.8)
  valueAreaPercentage: number;        // Percentage for ATAS Value Area (e.g. 70%)

  // Visual & Aesthetic Preferences
  showPriceBadges: boolean;           // Show glowing price & metric badges on the right price scale
  styleTheme: "neon" | "terminal" | "subtle"; // Aesthetic styling preset
}

export const DEFAULT_INSTITUTIONAL_CONFIG: InstitutionalChartConfig = {
  showLiquidationPools: true,
  showLiquidityWalls: true,
  showVolumeBubbles: true,
  showAbsorptionMarkers: true,
  showValueArea: true,
  showSessionOpens: true,
  showSessionZones: true,

  candleLookback: 40,
  bubbleVolumeThresholdRatio: 1.4,
  bubbleScaleMultiplier: 1.2,
  absorptionSensitivity: 1.6,
  minLiquidationUsd: 100_000_000,
  liquidityWallMinDensity: 0.45,
  valueAreaPercentage: 70,

  showPriceBadges: true,
  styleTheme: "neon",
};

const STORAGE_KEY = "replay-lab-institutional-chart-config";

export function loadInstitutionalChartConfig(): InstitutionalChartConfig {
  if (typeof window === "undefined") return DEFAULT_INSTITUTIONAL_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_INSTITUTIONAL_CONFIG;
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_INSTITUTIONAL_CONFIG, ...parsed };
  } catch {
    return DEFAULT_INSTITUTIONAL_CONFIG;
  }
}

export function saveInstitutionalChartConfig(config: InstitutionalChartConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.error("Failed to save institutional chart config", err);
  }
}
