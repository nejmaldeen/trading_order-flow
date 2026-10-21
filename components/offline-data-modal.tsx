'use client';

import React from 'react';
import { Database, HardDrive, Wifi, WifiOff, X, Zap, CheckCircle2, RefreshCw } from 'lucide-react';
import { SYMBOLS, SYMBOL_INFO, type SymbolName } from '@/lib/replay';

interface OfflineDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  summary: {
    version: number;
    updatedAt: string;
    symbols: Record<string, {
      updatedAt: string;
      timeframes: Record<string, { count: number; start: number; end: number }>;
    }>;
  } | null;
  onStartOfflineSession: (symbol: SymbolName) => void;
  onRefreshPack?: () => void;
  isOfflineMode: boolean;
  onToggleMode: (offline: boolean) => void;
}

const fmtDate = (timestamp: number) => {
  return new Intl.DateTimeFormat('ar', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(timestamp);
};

export default function OfflineDataModal({
  isOpen,
  onClose,
  summary,
  onStartOfflineSession,
  onRefreshPack,
  isOfflineMode,
  onToggleMode,
}: OfflineDataModalProps) {
  if (!isOpen) return null;

  return (
    <div className="offline-modal-backdrop" onClick={onClose}>
      <div className="offline-modal-card" onClick={(e) => e.stopPropagation()} dir="rtl">
        <header className="offline-modal-header">
          <div className="offline-modal-title">
            <div className="offline-modal-icon">
              <HardDrive size={20} />
            </div>
            <div>
              <h3>إدارة وضع عدم الاتصال (Offline Mode)</h3>
              <small>البيانات والشموع المحفوظة محلياً على جهازك للتداول بدون نت</small>
            </div>
          </div>
          <button type="button" className="offline-modal-close" onClick={onClose} title="إغلاق">
            <X size={18} />
          </button>
        </header>

        {/* Mode Status Toggle Banner */}
        <div className={`offline-status-banner ${isOfflineMode ? 'is-offline' : 'is-online'}`}>
          <div className="status-banner-text">
            {isOfflineMode ? (
              <>
                <WifiOff size={18} className="status-icon offline" />
                <div>
                  <strong>أنت الآن في وضع عدم الاتصال (Offline Lab)</strong>
                  <p>تعتمد المنصة 100% على الملفات والشموع المخزنة محلياً باستجابة 0ms.</p>
                </div>
              </>
            ) : (
              <>
                <Wifi size={18} className="status-icon online" />
                <div>
                  <strong>أنت الآن في الوضع المباشر (Online Lab)</strong>
                  <p>المنصة متصلة بالإنترنت وخوادم Binance لجلب أحدث الشموع اللحظية.</p>
                </div>
              </>
            )}
          </div>
          <button
            type="button"
            className={`btn-mode-toggle ${isOfflineMode ? 'switch-to-online' : 'switch-to-offline'}`}
            onClick={() => onToggleMode(!isOfflineMode)}
          >
            {isOfflineMode ? 'التبديل إلى الوضع المتصل (Online)' : 'تفعيل وضع عدم الاتصال (Offline)'}
          </button>
        </div>

        {/* Local Assets Breakdown */}
        <div className="offline-assets-section">
          <h4>الأصول والبيانات المتوفرة محلياً:</h4>
          <div className="offline-assets-grid">
            {SYMBOLS.map((sym) => {
              const info = SYMBOL_INFO[sym];
              const symSummary = summary?.symbols[sym];
              const tfs = symSummary ? Object.keys(symSummary.timeframes) : [];
              const b15m = symSummary?.timeframes['15m'];
              const b1d = symSummary?.timeframes['1d'];
              const totalCandles = symSummary
                ? Object.values(symSummary.timeframes).reduce((acc, t) => acc + t.count, 0)
                : 0;

              return (
                <div key={sym} className="offline-asset-card">
                  <div className="asset-card-top">
                    <span className="asset-icon">{info.icon}</span>
                    <div className="asset-title-block">
                      <strong>{info.arabicName}</strong>
                      <small>{info.base}/USDT</small>
                    </div>
                    <span className="asset-badge-local">
                      <CheckCircle2 size={12} /> جاهز محلياً
                    </span>
                  </div>

                  <div className="asset-stats-row">
                    <div className="stat-pill">
                      <span>إجمالي الشموع:</span>
                      <b>{totalCandles.toLocaleString()} شمعة</b>
                    </div>
                    <div className="stat-pill">
                      <span>الفريمات:</span>
                      <b>{tfs.length ? tfs.join(' · ') : '1د · 5د · 15د · 1س · 4س · ي'}</b>
                    </div>
                  </div>

                  {b1d && (
                    <div className="asset-range-note">
                      <span>تاريخ اليومي:</span>
                      <b>من {fmtDate(b1d.start)} إلى {fmtDate(b1d.end)}</b>
                    </div>
                  )}

                  {b15m && (
                    <div className="asset-range-note">
                      <span>تاريخ الـ 15 دقيقة:</span>
                      <b>من {fmtDate(b15m.start)} إلى {fmtDate(b15m.end)}</b>
                    </div>
                  )}

                  <button
                    type="button"
                    className="btn-launch-offline-asset"
                    onClick={() => {
                      onStartOfflineSession(sym);
                      onClose();
                    }}
                  >
                    <Zap size={13} />
                    <span>بدء جلسة أوفلاين لـ {info.base}</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer info & refresh action */}
        <footer className="offline-modal-footer">
          <div className="footer-last-updated">
            <small>
              آخر تحديث للحزمة المحلية: {summary?.updatedAt ? new Date(summary.updatedAt).toLocaleString('ar') : 'محدثة الآن'}
            </small>
          </div>
          <div className="footer-actions">
            {onRefreshPack && (
              <button
                type="button"
                className="btn-refresh-pack"
                onClick={onRefreshPack}
                title="تنزيل وتحديث حزمة الشموع المحلية (يتطلب اتصالاً بالإنترنت)"
              >
                <RefreshCw size={13} />
                <span>تحديث حزمة الأوفلاين</span>
              </button>
            )}
            <button type="button" className="btn-close-modal" onClick={onClose}>
              إغلاق
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
