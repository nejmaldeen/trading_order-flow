"use client";
import { useEffect, useState, useCallback } from "react";
import type { MacroSnapshot } from "@/lib/macro";
import type { NewsRecord, NewsCoverage } from "@/lib/news-archive";
import { getHistoricalImpact } from "@/lib/news-impact";
import NewsSound from "./news-sound";
import { ExternalLink, X, RefreshCw, Calendar, AlertTriangle, TrendingUp, TrendingDown, Clock, BookOpen } from "lucide-react";

type Result = {
  cursor: number;
  sessionId: string;
  hours: number;
  events: NewsRecord[];
  coverage: NewsCoverage[];
};

const names: Record<string, string> = {
  cpi: "أسعار المستهلكين CPI",
  ppi: "أسعار المنتجين PPI",
  empsit: "الوظائف الأمريكية NFP",
  fed: "الاحتياطي الفيدرالي FOMC",
};

export default function MacroPanel({
  data,
  cursor,
  sessionId,
  inspectRequest = 0,
  onEvents,
}: {
  data: MacroSnapshot | null;
  cursor: number;
  sessionId?: string;
  inspectRequest?: number;
  onEvents: (events: NewsRecord[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hours, setHours] = useState(24);
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const hourBucket = Math.floor(cursor / 3600000);

  useEffect(() => {
    if (inspectRequest) setOpen(true);
  }, [inspectRequest]);

  // Handle escape key to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    if (!sessionId || !cursor) return;
    const abort = new AbortController();
    setBusy(true);
    setError("");
    setResult(null);
    onEvents([]);

    fetch(`/api/news?cursor=${cursor}&hours=${hours}&sessionId=${encodeURIComponent(sessionId)}`, {
      signal: abort.signal,
    })
      .then(async (response) => {
        const body = (await response.json()) as Result & { error?: string };
        if (!response.ok) throw new Error(body.error || "تعذر الفحص");
        return body;
      })
      .then((body) => {
        if (!abort.signal.aborted) {
          setResult(body);
          onEvents(body.events);
        }
      })
      .catch((e) => {
        if (!abort.signal.aborted) setError(e instanceof Error ? e.message : "تعذر الفحص");
      })
      .finally(() => {
        if (!abort.signal.aborted) setBusy(false);
      });

    return () => abort.abort();
  }, [hourBucket, open, hours, retry, inspectRequest, sessionId, onEvents]);

  const stale = !!result && result.cursor !== cursor;
  const next = data?.cursor === cursor ? data.events.find((e) => e.status === "upcoming") : undefined;
  const nextImpact = next ? getHistoricalImpact(next) : null;

  const format = useCallback((t: number) => {
    return new Intl.DateTimeFormat("ar-SA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Asia/Riyadh",
    }).format(t);
  }, []);

  return (
    <div className="macro-panel">
      <NewsSound data={data?.cursor === cursor ? data : null} />

      {/* Persistent Bottom Bar Toggle */}
      <button className="macro-toggle" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="macro-toggle-title">
          <span className="macro-dot"></span>
          <span>أثر الأخبار الكبرى على BTC</span>
        </span>
        <span className="macro-toggle-status">
          {next ? (
            <span className="next-event-chip" title="الحدث القادم">
              ⚠️ {next.title} · {format(next.time)}
            </span>
          ) : (
            <span className="next-event-chip">BTC Macro Engine</span>
          )}
          <span className="toggle-action-badge">{open ? "إغلاق" : "فحص وتحليل"}</span>
        </span>
      </button>

      {/* Modern Slide-Over Drawer */}
      {open && (
        <>
          <div className="macro-drawer-backdrop" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="macro-drawer-container" role="dialog" aria-modal="true" aria-label="تحليل الأخبار الاقتصادية الكبرى">
            {/* Header */}
            <header className="macro-drawer-header">
              <div className="drawer-title-group">
                <div className="drawer-badge-row">
                  <span className="badge-category">BTC / Macro Intelligence</span>
                  <span className="badge-source">أبحاث SSRN + الفيدرالي + BLS</span>
                </div>
                <h3 className="drawer-main-title">تحليل الأخبار الاقتصادية الكبرى وأثرها</h3>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="إغلاق النافذة"
                className="drawer-close-btn"
                title="إغلاق (Esc)"
              >
                <X size={18} />
              </button>
            </header>

            {/* Quick Simulation Bar & Filter */}
            <div className="drawer-controls-bar">
              <div className="time-indicator">
                <Clock size={13} />
                <span>وقت المحاكاة: <b>{format(cursor)}</b></span>
              </div>

              <div className="filter-actions">
                <select
                  value={hours}
                  onChange={(e) => setHours(Number(e.target.value))}
                  className="drawer-period-select"
                  aria-label="نطاق فحص الأخبار"
                >
                  <option value={1}>آخر ساعة</option>
                  <option value={6}>آخر 6 ساعات</option>
                  <option value={24}>آخر 24 ساعة</option>
                  <option value={72}>آخر 3 أيام</option>
                  <option value={168}>آخر أسبوع</option>
                </select>

                <button
                  type="button"
                  className="drawer-refresh-btn"
                  disabled={busy}
                  onClick={() => setRetry((v) => v + 1)}
                  title="تحديث الأخبار"
                >
                  <RefreshCw size={13} className={busy ? "spin" : ""} />
                  <span>{busy ? "جارِ الفحص…" : "تحديث"}</span>
                </button>
              </div>
            </div>

            {busy && <div className="drawer-notice busy">جارِ استرجاع الإصدارات التاريخية وتحليل الأثر الإحصائي…</div>}
            {error && <div className="drawer-notice error" role="alert">{error}</div>}
            {stale && <div className="drawer-notice stale">تغير وقت المحاكاة. اضغط تحديث للمزامنة اللحظية.</div>}

            {/* Drawer Body Scrollable Content */}
            <div className="drawer-body">
              {/* Upcoming Event Alert Banner (If near) */}
              {next && nextImpact && (
                <div className="drawer-upcoming-card">
                  <div className="upcoming-header">
                    <span className="upcoming-icon">⚠️</span>
                    <div className="upcoming-title-col">
                      <strong>حدث اقتصادي مرتقب: {next.title}</strong>
                      <small>موعد الصدور: {format(next.time)} (توقيت الرياض)</small>
                    </div>
                  </div>
                  <p className="upcoming-takeaway">{nextImpact.quickTakeaway}</p>
                  <div className="upcoming-chips">
                    <span className="chip-item">معدل التذبذب: {nextImpact.volatilityLevel}</span>
                    <span className="chip-item">تكتيك: {nextImpact.scenarios.intradayVolatility.traderTip}</span>
                  </div>
                </div>
              )}

              {result && !stale && (
                <div className="drawer-events-list">
                  {!result.events.length && (
                    <div className="drawer-empty-state">
                      <p>لم تصدر بيانات رسمية كبرى خلال هذه الفترة المحددة ({hours} ساعة).</p>
                      <small>يمكنك توسيع نطاق الفحص إلى 3 أيام أو أسبوع لرؤية الإصدارات السابقة.</small>
                    </div>
                  )}

                  {result.events.map((e) => {
                    const impact = getHistoricalImpact(e);
                    return (
                      <article key={e.id} className="drawer-event-card">
                        {/* Event Title & Meta */}
                        <div className="event-card-header">
                          <div className="event-meta-tags">
                            <span className={`event-cat-tag cat-${impact.category}`}>{impact.categoryName}</span>
                            <span className="event-vol-tag">تذبذب: {impact.volatilityLevel}</span>
                            <span className="event-badge-tag">{impact.badge.label}</span>
                          </div>
                          <h4 className="event-title">{e.title}</h4>
                          <div className="event-release-time">
                            <Calendar size={12} />
                            <span>{format(e.time)}</span>
                          </div>
                        </div>

                        {/* Executive Summary (Quick Takeaway) */}
                        <div className="drawer-quick-verdict">
                          <div className="verdict-label">
                            <span>⚡</span>
                            <b>الخلاصة الإحصائية (الغالب على البيتكوين):</b>
                          </div>
                          <p className="verdict-text">{impact.quickTakeaway}</p>
                          <div className="verdict-regime">
                            <small>الارتباط المالي:</small>
                            <span>{impact.primaryRegime}</span>
                          </div>
                        </div>

                        {/* Clean Scenarios (Bullish / Bearish / First 15m) */}
                        <div className="drawer-scenarios-grid">
                          {/* Bullish */}
                          <div className="drawer-scenario-card bull">
                            <div className="sc-top">
                              <TrendingUp size={14} className="sc-icon" />
                              <b>سيناريو الصعود (Bullish)</b>
                            </div>
                            <div className="sc-cond">
                              <small>الشرط:</small>
                              <p>{impact.scenarios.bullish.condition}</p>
                            </div>
                            <div className="sc-tip">
                              <small>تكتيك المتداول:</small>
                              <p>{impact.scenarios.bullish.traderTip}</p>
                            </div>
                          </div>

                          {/* Bearish */}
                          <div className="drawer-scenario-card bear">
                            <div className="sc-top">
                              <TrendingDown size={14} className="sc-icon" />
                              <b>سيناريو الهبوط (Bearish)</b>
                            </div>
                            <div className="sc-cond">
                              <small>الشرط:</small>
                              <p>{impact.scenarios.bearish.condition}</p>
                            </div>
                            <div className="sc-tip">
                              <small>تكتيك المتداول:</small>
                              <p>{impact.scenarios.bearish.traderTip}</p>
                            </div>
                          </div>
                        </div>

                        {/* First 15-30m Volatility Strip */}
                        <div className="drawer-volatility-warning">
                          <AlertTriangle size={13} />
                          <div>
                            <b>أول 15-30 دقيقة (سحب السيولة):</b>
                            <span> {impact.scenarios.intradayVolatility.detail} - {impact.scenarios.intradayVolatility.traderTip}</span>
                          </div>
                        </div>

                        {/* Collapsible Academic Citations & SSRN Papers */}
                        <details className="drawer-academic-accordion">
                          <summary className="academic-summary">
                            <BookOpen size={13} />
                            <span>سند الأبحاث الأكاديمية والمراجع (SSRN / Glassnode / Fed)</span>
                            <span className="summary-expand-pill">انقر للعرض</span>
                          </summary>
                          <div className="academic-content">
                            <div className="stats-pills-row">
                              <div className="stat-box">
                                <small>متوسط التذبذب</small>
                                <b>{impact.empiricalStats.averageWindowMove}</b>
                              </div>
                              <div className="stat-box">
                                <small>الآلية المؤسساتية</small>
                                <b>{impact.empiricalStats.institutionalMechanic}</b>
                              </div>
                            </div>

                            <div className="academic-papers-list">
                              {impact.academicReferences.map((ref, idx) => (
                                <div key={idx} className="drawer-paper-row">
                                  <div className="paper-top">
                                    <span className="paper-source-badge">{ref.platform}</span>
                                    <span className="paper-authors">{ref.authors}</span>
                                  </div>
                                  <a href={ref.paperUrl} target="_blank" rel="noreferrer" className="paper-link">
                                    <span>"{ref.title}"</span>
                                    <ExternalLink size={11} />
                                  </a>
                                  <p className="paper-finding"><b>النتيجة الإحصائية:</b> {ref.keyFinding}</p>
                                </div>
                              ))}
                            </div>

                            <div className="source-release-footer">
                              <a href={e.source} target="_blank" rel="noreferrer" className="official-source-link">
                                مراجعة الإصدار في المصدر الحكومي الرسمي ↗
                              </a>
                            </div>
                          </div>
                        </details>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
