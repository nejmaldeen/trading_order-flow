"use client";

import { useEffect, useState } from "react";
import type { Trade } from "@/lib/replay";
import { TrendingUp, ShieldAlert, Plus, Trash2, CheckCircle2, X } from "lucide-react";

type Props = {
  trade: Trade;
  busy: boolean;
  onSave?: (levels: { price: number; amount: number }[]) => Promise<boolean>;
  onSaveStops?: (levels: { price: number; amount: number }[]) => Promise<boolean>;
  onSaveTakeProfits?: (levels: { price: number; amount: number; percentage?: number }[]) => Promise<boolean>;
  modal?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
};

export default function StopLevelEditor({
  trade,
  busy,
  onSave,
  onSaveStops = onSave,
  onSaveTakeProfits,
  modal = false,
  isOpen = true,
  onClose,
}: Props) {
  const [activeTab, setActiveTab] = useState<"tp" | "sl">("tp");
  const [savedFeedback, setSavedFeedback] = useState("");

  // Take Profit levels state
  const [tpRows, setTpRows] = useState<{ price: string; amount: string; percentage?: number }[]>([]);
  const savedTp = JSON.stringify(trade.takeProfitLevels ?? []);

  useEffect(() => {
    setTpRows(
      (trade.takeProfitLevels ?? [])
        .filter((x) => !x.filled)
        .map((x) => ({
          price: String(x.price),
          amount: String(x.amount),
          percentage: x.percentage,
        }))
    );
  }, [trade.id, savedTp]);

  // Stop loss levels state
  const [slRows, setSlRows] = useState<{ price: string; amount: string }[]>([]);
  const savedSl = JSON.stringify(trade.stopLevels ?? []);

  useEffect(() => {
    setSlRows(
      (trade.stopLevels ?? [])
        .filter((x) => !x.filled)
        .map((x) => ({ price: String(x.price), amount: String(x.amount) }))
    );
  }, [trade.id, savedSl]);

  const entryPrice = trade.entryPrice ?? trade.referencePrice ?? 0;
  const remainingQty = trade.remainingQuantity ?? trade.quantity ?? 0;
  const remainingUsdt = remainingQty * entryPrice;
  const initialNotional = trade.notional || remainingUsdt;

  // Add TP level with percentage helper (20%, 50%, etc.)
  const addTpPercentage = (pct: number) => {
    if (tpRows.length >= 5) return;
    const amountVal = Number((initialNotional * (pct / 100)).toFixed(2));
    // Provide a smart suggested price based on percentage distance
    const distanceMulti = 1 + (pct / 100) * 0.04 + 0.01;
    const suggestedPrice = entryPrice > 0 ? Number((entryPrice * distanceMulti).toFixed(2)) : "";
    setTpRows((prev) => [
      ...prev,
      {
        price: String(suggestedPrice),
        amount: String(Math.min(remainingUsdt, amountVal)),
        percentage: pct,
      },
    ]);
  };

  const handleSaveTp = async () => {
    if (!onSaveTakeProfits) return;
    const formatted = tpRows
      .filter((x) => Number(x.price) > 0 && Number(x.amount) > 0)
      .map((x) => ({
        price: Number(x.price),
        amount: Number(x.amount),
        percentage: x.percentage,
      }));
    const ok = await onSaveTakeProfits(formatted);
    if (ok) {
      setSavedFeedback("✓ تم تفعيل أهداف سحب الأرباح وربطها بالشارت!");
      setTimeout(() => setSavedFeedback(""), 4500);
    }
  };

  const handleSaveSl = async () => {
    if (!onSaveStops) return;
    const formatted = slRows
      .filter((x) => Number(x.price) > 0 && Number(x.amount) > 0)
      .map((x) => ({
        price: Number(x.price),
        amount: Number(x.amount),
      }));
    const ok = await onSaveStops(formatted);
    if (ok) {
      setSavedFeedback("✓ تم تحديث مستويات الوقف الجزئي!");
      setTimeout(() => setSavedFeedback(""), 4500);
    }
  };

  if (modal && !isOpen) return null;

  const content = (
    <div className={`trade-management-card ${modal ? "in-modal" : ""}`} dir="rtl">
      <div className="trade-mgmt-header">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <strong>🎯 إدارة أرباح الصفقة (سحب 20% · 50%)</strong>
          {modal && onClose && (
            <button type="button" onClick={onClose} className="close-btn" aria-label="إغلاق">
              <X size={16} />
            </button>
          )}
        </div>
        <span className="remaining-badge">
          المتبقي بالصفقة: {remainingUsdt.toFixed(2)} USDT ({remainingQty.toFixed(4)} وحدة)
        </span>
      </div>

      <div className="trade-mgmt-tabs">
        <button
          type="button"
          className={activeTab === "tp" ? "active" : ""}
          onClick={() => setActiveTab("tp")}
        >
          <TrendingUp size={14} />
          <span>سحب الأرباح التكتيكي ({tpRows.length})</span>
        </button>
        <button
          type="button"
          className={activeTab === "sl" ? "active" : ""}
          onClick={() => setActiveTab("sl")}
        >
          <ShieldAlert size={14} />
          <span>الوقف الجزئي ({slRows.length})</span>
        </button>
      </div>

      {savedFeedback && (
        <div className="mgmt-feedback-badge" role="status">
          {savedFeedback}
        </div>
      )}

      {activeTab === "tp" && (
        <div className="tp-management-panel">
          <p className="mgmt-hint">
            <strong>كيف تعمل ميزة سحب الأرباح؟</strong>
            <br />
            اختر نسبة سريعة (مثل <b>20%</b> أو <b>50%</b>) لتحديد كمية الخروج، واكتب السعر المستهدف.
            عند تقدم محاكي Replay وملامسة السعر، تُباع تلك النسبة تلقائياً ويُقفل ربحها في رصيدك مباشرة!
          </p>

          <div className="tp-quick-presets">
            <span>سحب نسبة سريعة:</span>
            {[20, 25, 33, 50, 75].map((pct) => (
              <button
                key={pct}
                type="button"
                className="preset-btn"
                disabled={busy || tpRows.length >= 5}
                onClick={() => addTpPercentage(pct)}
                title={`إضافة هدف سحب ${pct}% من رأس مال الصفقة`}
              >
                %{pct}
              </button>
            ))}
          </div>

          <div className="level-rows-container">
            {tpRows.length === 0 ? (
              <div className="empty-levels-hint">
                <span>لم يتم تحديد أهداف سحب أرباح بعد. انقر على <b>%20</b> أو <b>%50</b> أعلاه للبدء.</span>
              </div>
            ) : (
              tpRows.map((row, i) => (
                <div className="level-row" key={i}>
                  <span className="level-index">هدف {i + 1}</span>
                  <label>
                    <span>السعر المستهدف</span>
                    <input
                      aria-label={`سعر جني الأرباح ${i + 1}`}
                      type="number"
                      step="any"
                      value={row.price}
                      placeholder="سعر الهدف"
                      onChange={(e) =>
                        setTpRows((r) =>
                          r.map((v, j) => (j === i ? { ...v, price: e.target.value } : v))
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>المبلغ USDT</span>
                    <input
                      aria-label={`مبلغ سحب الأرباح ${i + 1}`}
                      type="number"
                      step="0.01"
                      value={row.amount}
                      placeholder="USDT"
                      onChange={(e) =>
                        setTpRows((r) =>
                          r.map((v, j) => (j === i ? { ...v, amount: e.target.value } : v))
                        )
                      }
                    />
                  </label>
                  {row.percentage && <span className="pct-badge">%{row.percentage}</span>}
                  <button
                    type="button"
                    className="row-del-btn"
                    disabled={busy}
                    onClick={() => setTpRows((r) => r.filter((_, j) => j !== i))}
                    title="حذف هذا الهدف"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mgmt-actions">
            <button
              type="button"
              className="add-row-btn"
              disabled={busy || tpRows.length >= 5}
              onClick={() => setTpRows((r) => [...r, { price: "", amount: "" }])}
            >
              <Plus size={13} />
              <span>إضافة هدف يدوي</span>
            </button>
            <button
              type="button"
              className="save-levels-btn tp-save"
              disabled={busy || tpRows.length === 0}
              onClick={() => void handleSaveTp()}
            >
              ✓ تفعيل وحفظ أهداف سحب الأرباح
            </button>
          </div>
        </div>
      )}

      {activeTab === "sl" && (
        <div className="sl-management-panel">
          <p className="mgmt-hint">
            حدّد مستويات لتقليص الخسارة تدريجياً. عند لمس المستوى تُباع الكمية المكافئة؛ والوقف النهائي يحمي الباقي.
          </p>

          <div className="level-rows-container">
            {slRows.map((row, i) => (
              <div className="level-row" key={i}>
                <span className="level-index">SL{i + 1}</span>
                <label>
                  <span>سعر الوقف</span>
                  <input
                    aria-label={`سعر الوقف الجزئي ${i + 1}`}
                    type="number"
                    step="any"
                    value={row.price}
                    onChange={(e) =>
                      setSlRows((r) =>
                        r.map((v, j) => (j === i ? { ...v, price: e.target.value } : v))
                      )
                    }
                  />
                </label>
                <label>
                  <span>المبلغ USDT</span>
                  <input
                    aria-label={`مبلغ الوقف الجزئي ${i + 1}`}
                    type="number"
                    step="0.01"
                    value={row.amount}
                    onChange={(e) =>
                      setSlRows((r) =>
                        r.map((v, j) => (j === i ? { ...v, amount: e.target.value } : v))
                      )
                    }
                  />
                </label>
                <button
                  type="button"
                  className="row-del-btn"
                  disabled={busy}
                  onClick={() => setSlRows((r) => r.filter((_, j) => j !== i))}
                  title="حذف هذا المستوى"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="mgmt-actions">
            <button
              type="button"
              className="add-row-btn"
              disabled={busy || slRows.length >= 5}
              onClick={() => setSlRows((r) => [...r, { price: "", amount: "" }])}
            >
              <Plus size={13} />
              <span>إضافة وقف جزئي</span>
            </button>
            <button
              type="button"
              className="save-levels-btn sl-save"
              disabled={busy || slRows.length === 0}
              onClick={() => void handleSaveSl()}
            >
              حفظ مستويات الوقف
            </button>
          </div>
        </div>
      )}

      {(trade.partialExits ?? []).length > 0 && (
        <div className="executed-exits">
          <strong>العمليات والأرباح المسحوبة فعلياً في هذه الصفقة:</strong>
          {trade.partialExits!.map((x, i) => (
            <div key={i} className="executed-exit-item">
              <CheckCircle2 size={13} className={x.pnl >= 0 ? "positive-icon" : "negative-icon"} />
              <span>
                نُفّذ {x.quantity.toFixed(4)} عند {x.price.toFixed(2)}
              </span>
              <b className={x.pnl >= 0 ? "positive" : "negative"}>
                {x.pnl >= 0 ? "+" : ""}
                {x.pnl.toFixed(2)} USDT
              </b>
              {x.type && <span className="exit-type-badge">{x.type === "take-profit-partial" ? "🎯 سحب ربح" : "وقف جزئي"}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  if (modal) {
    return (
      <div className="trade-mgmt-modal-overlay" onClick={onClose}>
        <div className="trade-mgmt-modal-content" onClick={(e) => e.stopPropagation()}>
          {content}
        </div>
      </div>
    );
  }

  return content;
}
