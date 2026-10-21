"use client";

import React, { useState, useEffect } from "react";
import { KeyRound, Shield, CheckCircle2, AlertCircle, Eye, EyeOff, Save, Trash2, Webhook, Bot, ExternalLink, X, Activity } from "lucide-react";

export type ApiKeysConfig = {
  binance: {
    apiKey: string;
    apiSecret: string;
    environment: "testnet" | "live";
    enabled: boolean;
  };
  tradingview: {
    webhookSecret: string;
    autoExecute: boolean;
    enabled: boolean;
  };
  aiAssistant: {
    provider: "openai" | "anthropic" | "gemini";
    apiKey: string;
    enabled: boolean;
  };
  institutional: {
    coinglassApiKey: string;
    bookmapWsUrl: string;
    atasBridgeUrl: string;
    enabled: boolean;
  };
};

const DEFAULT_CONFIG: ApiKeysConfig = {
  binance: {
    apiKey: "",
    apiSecret: "",
    environment: "testnet",
    enabled: false,
  },
  tradingview: {
    webhookSecret: "",
    autoExecute: false,
    enabled: false,
  },
  aiAssistant: {
    provider: "openai",
    apiKey: "",
    enabled: false,
  },
  institutional: {
    coinglassApiKey: "",
    bookmapWsUrl: "ws://127.0.0.1:9000",
    atasBridgeUrl: "http://127.0.0.1:8080",
    enabled: true,
  },
};

const STORAGE_KEY = "replay_platform_integrations_v1";

export default function PlatformIntegrationsModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [config, setConfig] = useState<ApiKeysConfig>(DEFAULT_CONFIG);
  const [activeTab, setActiveTab] = useState<"binance" | "tradingview" | "ai" | "institutional">("binance");
  const [showBinanceSecret, setShowBinanceSecret] = useState(false);
  const [showAiKey, setShowAiKey] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        setConfig((prev) => ({
          ...prev,
          ...parsed,
          binance: { ...prev.binance, ...parsed.binance },
          tradingview: { ...prev.tradingview, ...parsed.tradingview },
          aiAssistant: { ...prev.aiAssistant, ...parsed.aiAssistant },
        }));
      }
    } catch {
      // LocalStorage error handling
    }
  }, []);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch {
      alert("تعذر حفظ المفاتيح في المتصفح.");
    }
  };

  const handleClear = () => {
    if (confirm("هل أنت متأكد من رغبتك في مسح كافة المفاتيح المحفوظة؟")) {
      localStorage.removeItem(STORAGE_KEY);
      setConfig(DEFAULT_CONFIG);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
      dir="rtl"
    >
      <div
        style={{
          backgroundColor: "#131c24",
          border: "1px solid #2d4154",
          borderRadius: "12px",
          width: "100%",
          maxWidth: "580px",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.7)",
          color: "#d7e3ee",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #223242",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "8px",
                backgroundColor: "#1c2b3a",
                display: "grid",
                placeItems: "center",
                color: "#5b9ee8",
              }}
            >
              <KeyRound size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "16px", fontWeight: "bold", margin: 0, color: "#eef5fc" }}>
                التكامل ومفاتيح الربط (API Integrations)
              </h2>
              <small style={{ color: "#7a90a4", fontSize: "11px" }}>
                ربط المنصة مع منصات التداول الخارجية وموفري الإشارات
              </small>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: 0,
              color: "#7e93a7",
              cursor: "pointer",
              padding: "6px",
              display: "grid",
              placeItems: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Security Notice */}
        <div
          style={{
            padding: "10px 18px",
            backgroundColor: "#101920",
            borderBottom: "1px solid #1e2c39",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "11px",
            color: "#6da37f",
          }}
        >
          <Shield size={14} />
          <span>المفاتيح يتم تخزينها بأمان محلياً في متصفحك ولا تُشارك مع أي طرف غير مصرح له.</span>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid #223242",
            backgroundColor: "#111820",
          }}
        >
          <button
            onClick={() => setActiveTab("binance")}
            style={{
              flex: 1,
              padding: "12px",
              background: activeTab === "binance" ? "#192634" : "transparent",
              border: 0,
              borderBottom: activeTab === "binance" ? "2px solid #5b9ee8" : "2px solid transparent",
              color: activeTab === "binance" ? "#eef5fc" : "#7d90a1",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: activeTab === "binance" ? "bold" : "normal",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <span style={{ color: "#f3ba2f", fontWeight: "bold" }}>🟡</span>
            <span>Binance Spot</span>
          </button>

          <button
            onClick={() => setActiveTab("tradingview")}
            style={{
              flex: 1,
              padding: "12px",
              background: activeTab === "tradingview" ? "#192634" : "transparent",
              border: 0,
              borderBottom: activeTab === "tradingview" ? "2px solid #5b9ee8" : "2px solid transparent",
              color: activeTab === "tradingview" ? "#eef5fc" : "#7d90a1",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: activeTab === "tradingview" ? "bold" : "normal",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Webhook size={14} color="#2962ff" />
            <span>TradingView Webhook</span>
          </button>

          <button
            onClick={() => setActiveTab("ai")}
            style={{
              flex: 1,
              padding: "12px",
              background: activeTab === "ai" ? "#192634" : "transparent",
              border: 0,
              borderBottom: activeTab === "ai" ? "2px solid #5b9ee8" : "2px solid transparent",
              color: activeTab === "ai" ? "#eef5fc" : "#7d90a1",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: activeTab === "ai" ? "bold" : "normal",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Bot size={14} color="#10a37f" />
            <span>مساعد التداول الذكي</span>
          </button>

          <button
            onClick={() => setActiveTab("institutional")}
            style={{
              flex: 1,
              padding: "12px",
              background: activeTab === "institutional" ? "#192634" : "transparent",
              border: 0,
              borderBottom: activeTab === "institutional" ? "2px solid #a855f7" : "2px solid transparent",
              color: activeTab === "institutional" ? "#eef5fc" : "#7d90a1",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: activeTab === "institutional" ? "bold" : "normal",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
            }}
          >
            <Activity size={14} color="#a855f7" />
            <span>المنصات المؤسساتية (Order Flow)</span>
          </button>
        </div>

        {/* Tab Content */}
        <div style={{ padding: "20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "16px" }}>
          {activeTab === "binance" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "13px", fontWeight: "bold" }}>تفعيل ربط Binance</label>
                <input
                  type="checkbox"
                  checked={config.binance.enabled}
                  onChange={(e) => setConfig({ ...config, binance: { ...config.binance, enabled: e.target.checked } })}
                  style={{ width: "18px", height: "18px", accentColor: "#5b9ee8", cursor: "pointer" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#8da2b6", marginBottom: "6px" }}>بيئة الربط</label>
                <select
                  value={config.binance.environment}
                  onChange={(e) => setConfig({ ...config, binance: { ...config.binance, environment: e.target.value as "testnet" | "live" } })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    backgroundColor: "#162330",
                    border: "1px solid #2d4154",
                    borderRadius: "6px",
                    color: "#dce7f2",
                    fontSize: "12px",
                  }}
                >
                  <option value="testnet">Binance Spot Testnet (حساب تجريبي لا يتطلب أموال حقيقية)</option>
                  <option value="live">Binance Spot Live (حساب حقيقي)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#8da2b6", marginBottom: "6px" }}>API Key</label>
                <input
                  type="text"
                  placeholder="أدخل مفتاح Binance API Key"
                  value={config.binance.apiKey}
                  onChange={(e) => setConfig({ ...config, binance: { ...config.binance, apiKey: e.target.value } })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    backgroundColor: "#162330",
                    border: "1px solid #2d4154",
                    borderRadius: "6px",
                    color: "#dce7f2",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    direction: "ltr",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#8da2b6", marginBottom: "6px" }}>API Secret</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showBinanceSecret ? "text" : "password"}
                    placeholder="أدخل مفتاح Binance API Secret"
                    value={config.binance.apiSecret}
                    onChange={(e) => setConfig({ ...config, binance: { ...config.binance, apiSecret: e.target.value } })}
                    style={{
                      width: "100%",
                      padding: "8px 36px 8px 10px",
                      backgroundColor: "#162330",
                      border: "1px solid #2d4154",
                      borderRadius: "6px",
                      color: "#dce7f2",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      direction: "ltr",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowBinanceSecret(!showBinanceSecret)}
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: "8px",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: 0,
                      color: "#7e93a7",
                      cursor: "pointer",
                      padding: "4px",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {showBinanceSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === "tradingview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "13px", fontWeight: "bold" }}>تفعيل تنبيهات وإشارات TradingView</label>
                <input
                  type="checkbox"
                  checked={config.tradingview.enabled}
                  onChange={(e) => setConfig({ ...config, tradingview: { ...config.tradingview, enabled: e.target.checked } })}
                  style={{ width: "18px", height: "18px", accentColor: "#5b9ee8", cursor: "pointer" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#8da2b6", marginBottom: "6px" }}>عنوان الـ Webhook المقترح</label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="text"
                    readOnly
                    value="http://127.0.0.1:5173/api/webhook/signals"
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      backgroundColor: "#111b24",
                      border: "1px solid #263644",
                      borderRadius: "6px",
                      color: "#9bb0c3",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      direction: "ltr",
                    }}
                  />
                </div>
                <small style={{ color: "#6a7e90", fontSize: "10px", marginTop: "4px", display: "block" }}>
                  استخدم هذا الرابط في خانة Webhook URL داخل إعدادات Alert في TradingView
                </small>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#8da2b6", marginBottom: "6px" }}>Webhook Passphrase / Secret</label>
                <input
                  type="text"
                  placeholder="كلمة مرور التحقق من الإشارات الواردة"
                  value={config.tradingview.webhookSecret}
                  onChange={(e) => setConfig({ ...config, tradingview: { ...config.tradingview, webhookSecret: e.target.value } })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    backgroundColor: "#162330",
                    border: "1px solid #2d4154",
                    borderRadius: "6px",
                    color: "#dce7f2",
                    fontSize: "12px",
                    direction: "ltr",
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "6px" }}>
                <div>
                  <div style={{ fontSize: "12px", fontWeight: "500" }}>تنفيذ تلقائي مباشر للصفقات الافتراضية</div>
                  <small style={{ color: "#748a9c", fontSize: "10px" }}>فتح صفقة Replay فور استلام تنبيه متوافق</small>
                </div>
                <input
                  type="checkbox"
                  checked={config.tradingview.autoExecute}
                  onChange={(e) => setConfig({ ...config, tradingview: { ...config.tradingview, autoExecute: e.target.checked } })}
                  style={{ width: "16px", height: "16px", accentColor: "#5b9ee8", cursor: "pointer" }}
                />
              </div>
            </div>
          )}

          {activeTab === "ai" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "13px", fontWeight: "bold" }}>تفعيل المساعد الذكي لمراجعة الصفقات</label>
                <input
                  type="checkbox"
                  checked={config.aiAssistant.enabled}
                  onChange={(e) => setConfig({ ...config, aiAssistant: { ...config.aiAssistant, enabled: e.target.checked } })}
                  style={{ width: "18px", height: "18px", accentColor: "#5b9ee8", cursor: "pointer" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#8da2b6", marginBottom: "6px" }}>مزود الذكاء الاصطناعي</label>
                <select
                  value={config.aiAssistant.provider}
                  onChange={(e) => setConfig({ ...config, aiAssistant: { ...config.aiAssistant, provider: e.target.value as "openai" | "anthropic" | "gemini" } })}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    backgroundColor: "#162330",
                    border: "1px solid #2d4154",
                    borderRadius: "6px",
                    color: "#dce7f2",
                    fontSize: "12px",
                  }}
                >
                  <option value="openai">OpenAI (GPT-4o / GPT-4o-mini)</option>
                  <option value="gemini">Google Gemini (Gemini 2.5 / 3.0)</option>
                  <option value="anthropic">Anthropic (Claude 3.5 Sonnet)</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: "12px", color: "#8da2b6", marginBottom: "6px" }}>API Key</label>
                <div style={{ position: "relative" }}>
                  <input
                    type={showAiKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={config.aiAssistant.apiKey}
                    onChange={(e) => setConfig({ ...config, aiAssistant: { ...config.aiAssistant, apiKey: e.target.value } })}
                    style={{
                      width: "100%",
                      padding: "8px 36px 8px 10px",
                      backgroundColor: "#162330",
                      border: "1px solid #2d4154",
                      borderRadius: "6px",
                      color: "#dce7f2",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      direction: "ltr",
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAiKey(!showAiKey)}
                    style={{
                      position: "absolute",
                      top: "50%",
                      right: "8px",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: 0,
                      color: "#7e93a7",
                      cursor: "pointer",
                      padding: "4px",
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {showAiKey ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <small style={{ color: "#6a7e90", fontSize: "10px", marginTop: "4px", display: "block" }}>
                  يُستخدم لتحليل أسباب الدخول، تقييم الانضباط بالاستراتيجية، وتقديم نصائح تطوير الأداء.
                </small>
              </div>
            </div>
          )}

          {activeTab === "institutional" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: "13px", fontWeight: "bold" }}>تفعيل الرادار المؤسساتي الموحد</label>
                <input
                  type="checkbox"
                  checked={config.institutional.enabled}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      institutional: { ...prev.institutional, enabled: e.target.checked },
                    }))
                  }
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
              </div>

              {/* Coinglass */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px", border: "1px solid #1e2c39" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "12px", color: "#c084fc", fontWeight: "bold" }}>1. Coinglass API (سحابي مباشر)</label>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>CVD مجمع + خرائط تصفية</span>
                </div>
                <input
                  type="password"
                  placeholder="أدخل مفتاح Coinglass API Key (اختياري للربط السحابي)"
                  value={config.institutional.coinglassApiKey}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      institutional: { ...prev.institutional, coinglassApiKey: e.target.value },
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "#0d131a",
                    border: "1px solid #283748",
                    borderRadius: "6px",
                    color: "#e2e8f0",
                    fontSize: "12px",
                    direction: "ltr",
                  }}
                />
              </div>

              {/* Bookmap */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px", border: "1px solid #1e2c39" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "12px", color: "#38bdf8", fontWeight: "bold" }}>2. Bookmap BrAPI (بث محلي L3)</label>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>عمق السوق L3 + أوامر الآيسبيرج</span>
                </div>
                <input
                  type="text"
                  placeholder="ws://127.0.0.1:9000"
                  value={config.institutional.bookmapWsUrl}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      institutional: { ...prev.institutional, bookmapWsUrl: e.target.value },
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "#0d131a",
                    border: "1px solid #283748",
                    borderRadius: "6px",
                    color: "#e2e8f0",
                    fontSize: "12px",
                    direction: "ltr",
                  }}
                />
              </div>

              {/* ATAS */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", background: "rgba(0,0,0,0.2)", padding: "10px", borderRadius: "8px", border: "1px solid #1e2c39" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <label style={{ fontSize: "12px", color: "#fbbf24", fontWeight: "bold" }}>3. ATAS Open API (جسر محلي)</label>
                  <span style={{ fontSize: "10px", color: "#64748b" }}>شارت البصمة Footprint + دلتا الشمعة</span>
                </div>
                <input
                  type="text"
                  placeholder="http://127.0.0.1:8080"
                  value={config.institutional.atasBridgeUrl}
                  onChange={(e) =>
                    setConfig((prev) => ({
                      ...prev,
                      institutional: { ...prev.institutional, atasBridgeUrl: e.target.value },
                    }))
                  }
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    background: "#0d131a",
                    border: "1px solid #283748",
                    borderRadius: "6px",
                    color: "#e2e8f0",
                    fontSize: "12px",
                    direction: "ltr",
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 20px",
            borderTop: "1px solid #223242",
            backgroundColor: "#101820",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <button
            onClick={handleClear}
            style={{
              background: "transparent",
              border: "1px solid #523136",
              color: "#e88289",
              borderRadius: "6px",
              padding: "7px 12px",
              fontSize: "11px",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "5px",
            }}
          >
            <Trash2 size={13} />
            <span>مسح المفاتيح</span>
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {savedSuccess && (
              <span style={{ color: "#4ecb8c", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
                <CheckCircle2 size={14} />
                تم الحفظ بنجاح!
              </span>
            )}
            <button
              onClick={handleSave}
              style={{
                backgroundColor: "#2074cc",
                border: "1px solid #368ee8",
                color: "#ffffff",
                borderRadius: "6px",
                padding: "7px 18px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Save size={14} />
              <span>حفظ التغييرات</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
