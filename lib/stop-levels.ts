import type {Trade} from './replay.ts';
export function validateStopLevels(trade:Trade, levels:{price:number;amount:number}[], current:number) {
  const sign=trade.side==='short'?-1:1;
  if(trade.status!=='open'||!trade.entryPrice||!trade.quantity) return 'تتوفر مستويات الوقف بعد تنفيذ الدخول.';
  if(levels.length>5) return 'الحد الأقصى خمسة مستويات.';
  const available=(trade.remainingQuantity??trade.quantity)*trade.entryPrice;
  if(levels.some(x=>!Number.isFinite(x.price)||!Number.isFinite(x.amount)||x.price<=0||x.amount<=0)) return 'أدخل سعرًا ومبلغًا موجبين لكل مستوى.';
  if(levels.reduce((sum,x)=>sum+x.amount,0)>available+1e-8) return 'مجموع مبالغ الإغلاق يتجاوز رأس المال المتبقي في الصفقة.';
  if(new Set(levels.map(x=>x.price)).size!==levels.length) return 'استخدم أسعارًا مختلفة للمستويات.';
  if(levels.some(x=>sign*(current-x.price)<=0||sign*(x.price-trade.stopLoss)<=0||sign*(trade.takeProfit-x.price)<=0)) return 'ضع الوقف الجزئي بين السعر الحالي والوقف النهائي، وقبل الهدف.';
  return null;
}

export function validateTakeProfitLevels(trade: Trade, levels: { price: number; amount: number; percentage?: number }[], current: number) {
  const short = trade.side === "short";
  const sign = short ? -1 : 1;
  if (trade.status !== "open" || !trade.entryPrice || !trade.quantity) return "تتوفر مستويات جني الأرباح بعد تفعيل الصفقة.";
  if (levels.length > 5) return "الحد الأقصى خمسة مستويات لسحب الأرباح.";
  const available = (trade.remainingQuantity ?? trade.quantity) * trade.entryPrice;
  if (levels.some((x) => !Number.isFinite(x.price) || !Number.isFinite(x.amount) || x.price <= 0 || x.amount <= 0))
    return "أدخل سعرًا ومبلغًا موجبين لكل مستوى.";
  if (levels.reduce((sum, x) => sum + x.amount, 0) > available + 1e-8)
    return "مجموع مبالغ جني الأرباح يتجاوز رأس المال المتبقي في الصفقة.";
  if (new Set(levels.map((x) => x.price)).size !== levels.length)
    return "استخدم أسعارًا مختلفة لمستويات جني الأرباح.";
  const entry = trade.entryPrice ?? current;
  if (levels.some((x) => sign * (x.price - entry) <= 0))
    return short
      ? "يجب أن تكون مستويات جني أرباح البيع أدنى من سعر الدخول."
      : "يجب أن تكون مستويات جني أرباح الشراء أعلى من سعر الدخول.";
  if (trade.takeProfit && levels.some((x) => sign * (trade.takeProfit - x.price) < -1e-8))
    return short
      ? "يجب أن تكون مستويات جني الأرباح أعلى من أو مساوية للهدف النهائي."
      : "يجب أن تكون مستويات جني الأرباح أدنى من أو مساوية للهدف النهائي.";
  return null;
}
