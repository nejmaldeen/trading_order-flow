import type {NewsRecord} from './news-archive';
// Manually verified report, not a general news feed. Available only from publication time.
export const verifiedReports:NewsRecord[]=[{
 id:'coindesk-20260820-0410',title:'تقرير سوق: صعود BTC وETH مع تحسن السيولة وتصفيات البيع',
 time:Date.parse('2026-08-20T04:10:00Z'),
 source:'https://www.coindesk.com/markets/2026/08/20/ether-jumps-18-to-usd2-250-as-bitcoin-tops-usd69-000-in-broad-crypto-rally',
 summary:'ربط تقرير CoinDesk الصعود بتوسيع إعادة شراء السندات الأمريكية وتحسن شهية المخاطرة وتصفيات مراكز البيع. هذا تفسير صحفي منشور بعد بدء الحركة، وليس إثباتًا لسبب وحيد أو تنبيهًا سابقًا لها. الوقت المعروض وقت نشر التقرير.'
}];
