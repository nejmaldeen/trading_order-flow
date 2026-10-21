"use client";

import React, { useState } from "react";
import { Wallet, RotateCcw, Check, X, ShieldAlert, Sparkles, DollarSign } from "lucide-react";

interface AccountBalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentInitialBalance: number;
  currentEquity: number;
  onSaveBalance: (newBalance: number, resetTrades: boolean) => Promise<boolean | void>;
}

const PRESETS = [1000, 2500, 5000, 10000, 25000, 50000, 100000];

export default function AccountBalanceModal({
  isOpen,
  onClose,
  currentInitialBalance,
  currentEquity,
  onSaveBalance,
}: AccountBalanceModalProps) {
  const [balanceInput, setBalanceInput] = useState<string>(String(currentInitialBalance));
  const [resetTrades, setResetTrades] = useState<boolean>(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleApply = async (amount: number, resetHistory: boolean) => {
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10_000_000) {
      setError("أدخل مبلغًا صحيحًا بين 1 و 10,000,000 USDT.");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await onSaveBalance(amount, resetHistory);
      onClose();
    } catch {
      setError("تعذر تحديث رصيد الحساب. يرجى المحاولة ثانية.");
    } finally {
      setLoading(false);
    }
  };

  const currentVal = Number(balanceInput) || 0;

  return (
    <div className="account-balance-overlay" dir="rtl" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="account-balance-card" role="dialog" aria-modal="true" aria-labelledby="modal-title">
        <header className="balance-modal-header">
          <div className="title-row">
            <div className="modal-icon-wrap">
              <Wallet size={18} />
            </div>
            <div>
              <h3 id="modal-title">تعديل وإعادة ضبط رصيد الحساب</h3>
              <small>خصص رأس المال لبدء تدريب أو اختبار محفظة جديدة</small>
            </div>
          </div>
          <button type="button" className="close-btn" onClick={onClose} aria-label="إغلاق">
            <X size={16} />
          </button>
        </header>

        <div className="balance-modal-body">
          {/* Current Stats */}
          <div className="current-stats-strip">
            <div>
              <span>الرصيد الأساسي الأصلي</span>
              <strong dir="ltr">{currentInitialBalance.toLocaleString("en-US")} USDT</strong>
            </div>
            <div>
              <span>الرصيد التراكمي الحالي</span>
              <strong dir="ltr" className={currentEquity >= currentInitialBalance ? "positive" : "negative"}>
                {currentEquity.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USDT
              </strong>
            </div>
          </div>

          {/* Input field */}
          <div className="balance-input-field">
            <label htmlFor="custom-balance-input">مبلغ الرصيد الجديد (USDT)</label>
            <div className="input-wrap">
              <input
                id="custom-balance-input"
                type="number"
                min="10"
                max="10000000"
                step="100"
                value={balanceInput}
                onChange={(e) => {
                  setBalanceInput(e.target.value);
                  setError("");
                }}
                placeholder="2500"
                autoFocus
              />
              <span className="unit-label">USDT</span>
            </div>
            {error && <p className="balance-error-msg">{error}</p>}
          </div>

          {/* Quick Presets */}
          <div className="balance-presets-section">
            <span className="section-subtitle">أو اختر رصيدًا سريعًا جاهزًا:</span>
            <div className="presets-chips">
              {PRESETS.map((amt) => (
                <button
                  key={amt}
                  type="button"
                  className={`preset-chip ${currentVal === amt ? "active" : ""}`}
                  onClick={() => {
                    setBalanceInput(String(amt));
                    setError("");
                  }}
                >
                  {amt.toLocaleString("en-US")}$
                  {amt === 2500 && <span className="default-tag">الافتراضي</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Reset trades option */}
          <label className="reset-trades-checkbox">
            <input
              type="checkbox"
              checked={resetTrades}
              onChange={(e) => setResetTrades(e.target.checked)}
            />
            <div className="checkbox-text">
              <strong>تصفير سجل الصفقات والبدء من جديد</strong>
              <small>مسح الصفقات السابقة حتى يبدأ التقرير ونسبة الفوز من الصفر مع الرصيد الجديد</small>
            </div>
          </label>
        </div>

        <footer className="balance-modal-footer">
          <button
            type="button"
            className="btn-default-reset"
            disabled={loading}
            onClick={() => void handleApply(2500, true)}
            title="إعادة ضبط الرصيد وسجل الصفقات للوضع الافتراضي (2500 USDT)"
          >
            <RotateCcw size={13} />
            <span>إعادة ضبط افتراضي (2,500$)</span>
          </button>

          <div className="main-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={loading}>
              إلغاء
            </button>
            <button
              type="button"
              className="btn-save"
              disabled={loading || !currentVal || currentVal <= 0}
              onClick={() => void handleApply(currentVal, resetTrades)}
            >
              <Check size={14} />
              <span>{loading ? "جار الحفظ…" : "حفظ وتعيين الرصيد"}</span>
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
