import test from 'node:test';
import assert from 'node:assert/strict';
import { getHistoricalImpact, HISTORICAL_IMPACT_PROFILES } from '../lib/news-impact.ts';

test('getHistoricalImpact correctly categorizes CPI events with rich academic context', () => {
  const impact = getHistoricalImpact({
    id: 'cpi-20260113',
    title: 'التضخم الأمريكي CPI',
    summary: 'The Consumer Price Index rose 0.3 percent.',
  });
  assert.equal(impact.category, 'cpi');
  assert.ok(impact.quickTakeaway.includes('مؤشر التضخم'));
  assert.equal(impact.volatilityLevel, 'عالي جداً (Extremely High)');
  assert.ok(impact.scenarios.bullish.detail.length > 0);
  assert.ok(impact.scenarios.bearish.detail.length > 0);
  assert.ok(impact.academicReferences.some(ref => ref.platform.includes('SSRN')));
});

test('getHistoricalImpact correctly categorizes PPI events', () => {
  const impact = getHistoricalImpact({
    id: 'ppi-20260814',
    title: 'أسعار المنتجين الأمريكي PPI',
    summary: 'The Producer Price Index for final demand rose 0.9 percent.',
  });
  assert.equal(impact.category, 'ppi');
  assert.ok(impact.categoryName.includes('أسعار المنتجين'));
  assert.ok(impact.scenarios.bullish.traderTip.length > 0);
});

test('getHistoricalImpact correctly categorizes Fed / FOMC events', () => {
  const impact = getHistoricalImpact({
    id: 'fed-20260128',
    title: 'بيان الاحتياطي الفيدرالي',
    summary: 'ثبّت الاحتياطي الفيدرالي نطاق الفائدة عند 3.50–3.75%',
  });
  assert.equal(impact.category, 'fed');
  assert.ok(impact.quickTakeaway.includes('الفائدة'));
  assert.ok(impact.academicReferences.some(ref => ref.authors.includes('Corbet')));
});

test('getHistoricalImpact correctly categorizes NFP / jobs events', () => {
  const impact = getHistoricalImpact({
    id: 'empsit-20260109',
    title: 'الوظائف الأمريكية',
    summary: 'Total nonfarm payroll employment rose by 50,000.',
  });
  assert.equal(impact.category, 'empsit');
  assert.ok(impact.categoryName.includes('الوظائف'));
});

test('getHistoricalImpact correctly categorizes market reports', () => {
  const impact = getHistoricalImpact({
    id: 'coindesk-20260820-0410',
    title: 'تقرير سوق: صعود BTC وETH',
    summary: 'تصفيات مراكز البيع وتحسن شهية المخاطرة',
  });
  assert.equal(impact.category, 'market');
  assert.ok(impact.scenarios.bullish.biasLabel.includes('استمرار'));
});

test('all impact profiles contain structured scenarios and empirical stats', () => {
  for (const [key, profile] of Object.entries(HISTORICAL_IMPACT_PROFILES)) {
    assert.ok(profile.quickTakeaway, `profile ${key} missing quickTakeaway`);
    assert.ok(profile.scenarios.bullish.traderTip, `profile ${key} missing bullish traderTip`);
    assert.ok(profile.scenarios.bearish.traderTip, `profile ${key} missing bearish traderTip`);
    assert.ok(profile.scenarios.intradayVolatility.detail, `profile ${key} missing volatility detail`);
    assert.ok(profile.empiricalStats.averageWindowMove, `profile ${key} missing averageWindowMove`);
    assert.ok(profile.academicReferences.length > 0, `profile ${key} missing academic references`);
  }
});
