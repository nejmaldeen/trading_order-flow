import { macroAt } from "@/lib/macro";
import { validateStopLevels, validateTakeProfitLevels } from "@/lib/stop-levels";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { workspaces } from "@/db/schema";
import { activeSession, advance, blank, event, FEE_RATE, INITIAL_BALANCE, normalizeWorkspace, SYMBOLS, DURATIONS, finishTrade, SLIPPAGE, type Workspace, type Trade, type Session, type Timeframe } from "@/lib/replay";
import { chartHistory, olderHistory, marketData, MarketError } from "@/lib/market-data";
import { offlineMarketData, getOfflineSummary, getOfflineDateBounds } from "@/lib/offline-market";

export const dynamic = "force-dynamic";

const getProvider = (session?: Session | null) => (session?.isOffline ? offlineMarketData : marketData);

const reflectionSchema = z.object({
  setupGrade: z.string().optional(),
  strategy: z.string().optional(),
  emotion: z.string().optional(),
  confidence: z.string().optional(),
  notes: z.string().optional(),
  audioNote: z.string().optional(),
});

const actionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("start"),symbol:z.enum(SYMBOLS),startTime:z.number().int().positive(),confirmReplace:z.boolean().default(false),offline:z.boolean().optional()}),
  z.object({action:z.literal("step"),unit:z.enum(["minute","bar"]).default("minute"),count:z.number().int().min(1).max(64).default(1)}),
  z.object({action:z.literal("buy"),side:z.enum(["long","short"]).default("long"),orderType:z.enum(["market","limit","stop"]).default("market"),orderPrice:z.number().positive().nullable().optional(),notional:z.number().positive().max(100000),stopLoss:z.number().positive(),takeProfit:z.number().positive(),previewOriginal:z.object({entry:z.number().positive(),stop:z.number().positive(),target:z.number().positive()}).nullish(),reason:z.string().max(500).default(""),reflection:reflectionSchema.optional()}),
  z.object({action:z.literal("stops"),tradeId:z.string(),levels:z.array(z.object({price:z.number().positive(),amount:z.number().positive()})).max(5)}),
  z.object({action:z.literal("takeProfits"),tradeId:z.string(),levels:z.array(z.object({price:z.number().positive(),amount:z.number().positive(),percentage:z.number().positive().optional()})).max(5)}),
  z.object({action:z.literal("scale_in"),tradeId:z.string(),amount:z.number().positive().max(100000)}),
  z.object({action:z.literal("close"),tradeId:z.string().optional(),all:z.boolean().optional()}),
  z.object({action:z.literal("cancel"),tradeId:z.string().optional(),all:z.boolean().optional()}),
  z.object({action:z.literal("risk"),tradeId:z.string(),stopLoss:z.number().positive(),takeProfit:z.number().positive()}),
  z.object({action:z.literal("selectSession"),sessionId:z.string()}),
  z.object({action:z.literal("reflect"),tradeId:z.string(),reflection:reflectionSchema}),
  z.object({action:z.literal("deleteTrade"),tradeId:z.string()}),
  z.object({action:z.literal("clearTrades"),scope:z.enum(["session","all","current"]).default("session")}),
  z.object({action:z.literal("setBalance"),balance:z.number().positive().max(10000000),resetTrades:z.boolean().default(false)})
]);
const json=(body:unknown,status=200)=>Response.json(body,{status,headers:{"Cache-Control":"no-store, max-age=0"}});
async function ownerId(){const h=await headers();return h.get("oai-authenticated-user-id")||(process.env.NODE_ENV!=="production"?"preview-owner":null);}
async function readWorkspace(id:string){
  const rows=await getDb().select().from(workspaces).where(eq(workspaces.ownerId,id)).limit(1);
  const previous=rows[0]?.stateJson ?? null;
  return {previous,state:previous===null?structuredClone(blank):normalizeWorkspace(JSON.parse(previous))};
}
async function saveWorkspace(id:string,state:Workspace,previous:string|null){
  state.revision++;
  const values={stateJson:JSON.stringify(state),updatedAt:new Date().toISOString()};
  const rows=previous===null
    ? await getDb().insert(workspaces).values({ownerId:id,...values}).onConflictDoNothing().returning({id:workspaces.ownerId})
    : await getDb().update(workspaces).set(values).where(and(eq(workspaces.ownerId,id),eq(workspaces.stateJson,previous))).returning({id:workspaces.ownerId});
  return rows.length===1;
}
export async function GET(request:Request){
  try{
    const id=await ownerId();if(!id)return json({error:"يرجى تسجيل الدخول."},401);
    const {state}=await readWorkspace(id);
    const query=new URL(request.url).searchParams;
    if (query.has("offlineSummary")) {
      return json({ summary: getOfflineSummary() });
    }
    if(query.has("timeframe")){
      const timeframe=query.get("timeframe") as Timeframe;
      if(!Object.hasOwn(DURATIONS,timeframe))return json({error:"إطار زمني غير صالح."},400);
      const session=activeSession(state);if(!session)return json({state,candles:[],source:null});
      const provider = getProvider(session);
      if(query.has("before")) {
        if(query.get("sessionId")!==session.id)return json({error:"تغيرت الجلسة؛ تجاهل التاريخ السابق."},409);
        const before=Number(query.get("before"));
        if(!Number.isSafeInteger(before)||before<0||before%DURATIONS[timeframe]!==0||before>session.cursorTime+1)
          return json({error:"حد التاريخ غير صالح."},400);
        try {return json({sessionId:session.id,...await olderHistory(session,timeframe,before,provider)});}
        catch(err){return json({error:err instanceof Error?err.message:"تعذر تحميل التاريخ الأقدم."},502);}
      }
      try { const history=await chartHistory(session,timeframe,provider); return json({state,...history,macro:macroAt(session.cursorTime)}); }
      catch(err) { return json({state,error:err instanceof Error?err.message:"تعذر تحميل الشموع.",candles:[],source:null},502); }
    }
    return json({state});
  }catch(err){return json({error:err instanceof Error?err.message:"تعذر تحميل الجلسة."},err instanceof MarketError?502:500);}
}
export async function POST(request:Request){
  try{
    const id=await ownerId();if(!id)return json({error:"يرجى تسجيل الدخول."},401);
    const envelope=z.object({revision:z.number().int().nonnegative(),timeframe:z.enum(["1m","5m","15m","1h","4h","1d"]).optional(),offline:z.boolean().optional()}).passthrough().safeParse(await request.json());
    if(!envelope.success)return json({error:"حدّث الصفحة ثم أعد المحاولة."},400);
    const body=envelope.data;const input=actionSchema.safeParse(body);
    if(!input.success)return json({error:"الطلب غير مكتمل أو يحتوي قيمًا غير صالحة."},400);
    const {state,previous}=await readWorkspace(id);
    if(body.revision!==state.revision)return json({error:"تغيرت الجلسة. أعد تحميلها قبل تكرار الإجراء.",conflict:true},409);
    const data=input.data;
    let session=activeSession(state);
    let extra:Record<string,unknown>={};
    if(data.action==="start"){
      if(session && state.trades.some(t=>t.sessionId===session!.id) && !data.confirmReplace)return json({error:"أكد بدء جلسة جديدة؛ يبقى السجل القديم محفوظًا."},409);
      const isOffline = Boolean(data.offline ?? body.offline);
      const provider = isOffline ? offlineMarketData : marketData;
      let startTime = Math.floor(data.startTime / 60000) * 60000;
      if (isOffline) {
        const bounds = getOfflineDateBounds(data.symbol, body.timeframe ?? "15m");
        if (bounds) {
          if (startTime > bounds.end) startTime = bounds.end;
          if (startTime < bounds.start) startTime = bounds.start + 60000;
        }
      } else {
        const latestAllowed = Math.floor(Date.now() / 60000) * 60000 - 60000;
        if (startTime > latestAllowed) {
          startTime = latestAllowed;
        }
        if(startTime < Date.UTC(2017, 7, 17) || startTime > latestAllowed) return json({error:"اختر وقتًا تاريخيًا مكتملًا ضمن فترة توفر Binance."},400);
      }
      const next:Session={id:crypto.randomUUID(),symbol:data.symbol,startTime,cursorTime:startTime-1,advancedBars:0,createdAt:new Date().toISOString(),isOffline};
      const timeframe=body.timeframe ?? "15m";
      extra=await chartHistory(next,timeframe,provider);
      state.sessions.unshift(next);state.activeSessionId=next.id;session=next;
    }else if(data.action==="selectSession"){
      const target=state.sessions.find(s=>s.id===data.sessionId);
      if(!target)return json({error:"الجلسة غير موجودة."},404);
      state.activeSessionId=target.id;
      session=target;
      const timeframe=body.timeframe ?? "15m";
      const provider = getProvider(target);
      extra=await chartHistory(target,timeframe,provider);
    }else{
      if(!session)return json({error:"ابدأ جلسة Replay أولًا."},409);
      const provider = getProvider(session);
      if(data.action==="step"){
        const first=session.cursorTime+1;
        const latest = session.isOffline
          ? (getOfflineDateBounds(session.symbol, "1m")?.end ?? Math.floor(Date.now()/60000)*60000-60000)
          : Math.floor(Date.now()/60000)*60000-60000;
        if(first>latest)return json({error: session.isOffline ? "وصلت إلى آخر شمعة مخزنة محلياً في وضع عدم الاتصال." : "وصلت إلى آخر شمعة مكتملة متاحة."},409);
        const requested=data.unit==="bar"?DURATIONS[body.timeframe??"15m"]/60000:data.count;
        const count=Math.min(requested,Math.floor((latest-first)/60000)+1);
        const result=await provider(session.symbol,"1m",first,first+count*60000-1);
        advance(state,result.candles,count);extra=result;
      }
      if(data.action==="buy"){
        const equity=(state.initialBalance ?? INITIAL_BALANCE)+state.trades.filter(t=>t.status==="closed").reduce((s,t)=>s+t.realizedPnl,0);
        const tiedMargin=state.trades.filter(t=>t.sessionId===session!.id&&["pending","open","close_pending"].includes(t.status)).reduce((s,t)=>s+(t.notional??0)*(1+FEE_RATE),0);
        const availableCash=Math.max(0, equity - tiedMargin);
        if(data.notional*(1+FEE_RATE)>availableCash)return json({error:`حجم الأمر مع رسوم الدخول يتجاوز الرصيد الحر المتاح (${availableCash.toFixed(2)} USDT).`},400);

        const last=await provider(session.symbol,"1m",session.cursorTime-59999,session.cursorTime);
        const current=last.candles.at(-1)?.close;
        if(!current)throw new MarketError("تعذر التحقق من السعر الحالي؛ لم يُرسل الأمر.");
        const level=data.orderType==="market"?current:data.orderPrice;
        const sign=data.side==="short"?-1:1;
        if(!level || sign*(level-data.stopLoss)<=0 || sign*(data.takeProfit-level)<=0)return json({error:"الوقف والهدف لا يناسبان اتجاه الصفقة: الشراء هدفه أعلى، والبيع هدفه أدنى."},400);
        if(data.orderType==="limit" && sign*(level-current)>0)return json({error:"سعر المحدد: تحت السعر الحالي للشراء، وفوقه للبيع."},400);
        if(data.orderType==="stop" && sign*(level-current)<=0)return json({error:"سعر التفعيل: فوق السعر الحالي للشراء، وتحته للبيع."},400);

        const trade:Trade={
          id:crypto.randomUUID(),sessionId:session.id,symbol:session.symbol,status:"pending",side:data.side,
          referencePrice:level,orderType:data.orderType,orderPrice:data.orderType==="market"?null:level,
          eligibleTime:session.cursorTime+1,triggeredAt:null,notional:data.notional,quantity:null,entryPrice:null,
          stopLoss:data.stopLoss,takeProfit:data.takeProfit,initialStop:null,initialTarget:null,exitPrice:null,
          entryFee:0,exitFee:0,realizedPnl:0,rMultiple:null,initialRisk:null,reason:data.reason,entryTime:null,
          exitTime:null,exitReason:null,createdAt:new Date().toISOString(),events:[],
          reflection:data.reflection ? {...data.reflection, createdAt: Date.now()} : undefined
        };
        event(trade,"created",session.cursorTime,`${data.side} · ${data.orderType} · ${level} · وقف ${data.stopLoss} · هدف ${data.takeProfit}`);
        if(data.previewOriginal) event(trade,"preview",session.cursorTime,`معاينة أولية: دخول ${data.previewOriginal.entry} · وقف ${data.previewOriginal.stop} · هدف ${data.previewOriginal.target}؛ تأكيد: دخول ${level} · وقف ${data.stopLoss} · هدف ${data.takeProfit}`);
        state.trades.unshift(trade);extra.source=last.source;
      }
      if(data.action==="scale_in"){
        const trade=state.trades.find(t=>t.id===data.tradeId&&t.sessionId===session!.id&&t.status==="open");
        if(!trade)return json({error:"الصفقة المفتوحة للتعزيز غير موجودة."},404);
        if(!data.amount || data.amount<=0)return json({error:"حدد مبلغ تعزيز صحيح."},400);

        const equity=(state.initialBalance ?? INITIAL_BALANCE)+state.trades.filter(t=>t.status==="closed").reduce((s,t)=>s+t.realizedPnl,0);
        const tiedMargin=state.trades.filter(t=>t.sessionId===session!.id&&["pending","open","close_pending"].includes(t.status)).reduce((s,t)=>s+(t.notional??0)*(1+FEE_RATE),0);
        const availableCash=Math.max(0, equity - tiedMargin);
        if(data.amount*(1+FEE_RATE)>availableCash)return json({error:`مبلغ التعزيز مع الرسوم يتجاوز الرصيد الحر المتاح (${availableCash.toFixed(2)} USDT).`},400);

        const last=await provider(session.symbol,"1m",session.cursorTime-59999,session.cursorTime);
        const current=last.candles.at(-1)?.close;
        if(!current)throw new MarketError("تعذر التحقق من السعر الحالي للتعزيز.");
        const sign=trade.side==="short"?-1:1;
        const fillPrice=current*(1+sign*SLIPPAGE);
        const addedQty=data.amount/fillPrice;
        const oldQty=trade.remainingQuantity ?? trade.quantity ?? (trade.notional/(trade.entryPrice??current));
        const oldTotalQty=trade.quantity ?? oldQty;
        const newTotalQty=oldTotalQty+addedQty;
        const newRemainingQty=oldQty+addedQty;
        const newWeightedEntry=((trade.entryPrice??current)*oldTotalQty + fillPrice*addedQty)/newTotalQty;
        const addedFee=data.amount*FEE_RATE;

        trade.entryPrice=newWeightedEntry;
        trade.quantity=newTotalQty;
        trade.remainingQuantity=newRemainingQty;
        trade.notional+=data.amount;
        trade.entryFee+=addedFee;
        trade.initialRisk = Math.abs(newWeightedEntry - trade.stopLoss) * newTotalQty;
        event(trade,"scaled_in",session.cursorTime,`تعزيز الصفقة: إضافة ${data.amount} USDT بسعر ${fillPrice.toFixed(2)} · متوسط الدخول الجديد: ${newWeightedEntry.toFixed(2)}`);
      }
      if(data.action==="cancel"||data.action==="close"){
        const activeTrades=state.trades.filter(t=>t.sessionId===session!.id&&["pending","open","close_pending"].includes(t.status));
        if(!activeTrades.length)return json({error:"لا توجد صفقات أو أوامر نشطة للإلغاء أو الإغلاق."},409);

        const targets = data.all
          ? activeTrades
          : data.tradeId
          ? activeTrades.filter(t=>t.id===data.tradeId)
          : [activeTrades[0]];

        if(!targets.length)return json({error:"الصفقة المحددة غير موجودة أو تم إغلاقها بالفعل."},404);

        const last=await provider(session.symbol,"1m",session.cursorTime-59999,session.cursorTime);
        const current=last.candles.at(-1)?.close;

        for(const trade of targets){
          if(trade.status==="pending"){
            trade.status="cancelled";
            event(trade,trade.status,session.cursorTime,"إلغاء الأمر فوراً");
          } else {
            const sign=trade.side==="short"?-1:1;
            const fillPrice=current?current*(1-sign*SLIPPAGE):(trade.entryPrice??trade.orderPrice??1);
            finishTrade(trade,fillPrice,session.cursorTime,data.action==="cancel"?"إلغاء وخروج فوري":"إغلاق يدوي فوري");
          }
        }
      }
      if(data.action==="stops"){
        const trade=state.trades.find(t=>t.id===data.tradeId&&t.sessionId===session!.id);
        if(!trade)return json({error:"الصفقة غير موجودة."},404);
        const last=await provider(session.symbol,"1m",session.cursorTime-59999,session.cursorTime);
        const current=last.candles.at(-1)?.close;
        if(!current)throw new MarketError("تعذر التحقق من السعر الحالي.");
        const issue=validateStopLevels(trade,data.levels,current);
        if(issue)return json({error:issue},400);
        event(trade,"stop-levels",session.cursorTime,`تعديل الوقف الجزئي: ${JSON.stringify(trade.stopLevels??[])} ← ${JSON.stringify(data.levels)}`);
        trade.stopLevels=[...(trade.stopLevels??[]).filter(x=>x.filled),...data.levels.map(x=>({...x,id:crypto.randomUUID(),eligibleTime:session!.cursorTime+1,filled:false}))];
      }
      if(data.action==="takeProfits"){
        const trade=state.trades.find(t=>t.id===data.tradeId&&t.sessionId===session!.id);
        if(!trade)return json({error:"الصفقة غير موجودة."},404);
        const last=await provider(session.symbol,"1m",session.cursorTime-59999,session.cursorTime);
        const current=last.candles.at(-1)?.close;
        if(!current)throw new MarketError("تعذر التحقق من السعر الحالي.");
        const issue=validateTakeProfitLevels(trade,data.levels,current);
        if(issue)return json({error:issue},400);
        event(trade,"take-profit-levels",session.cursorTime,`تعديل سحب الأرباح: ${JSON.stringify(trade.takeProfitLevels??[])} ← ${JSON.stringify(data.levels)}`);
        trade.takeProfitLevels=[...(trade.takeProfitLevels??[]).filter(x=>x.filled),...data.levels.map(x=>({...x,id:crypto.randomUUID(),eligibleTime:session!.cursorTime+1,filled:false}))];
      }
      if(data.action==="risk"){
        const trade=state.trades.find(t=>t.id===data.tradeId&&t.sessionId===session!.id&&["pending","open"].includes(t.status));
        if(!trade)return json({error:"الأمر أو الصفقة غير موجودة."},404);
        const entry=trade.entryPrice??trade.orderPrice??trade.referencePrice??null;
        const sign=trade.side==="short"?-1:1;
        if(sign*(data.takeProfit-data.stopLoss)<=0 || (entry!==null&&sign*(data.takeProfit-entry)<=0) || (trade.status==="pending"&&entry!==null&&sign*(entry-data.stopLoss)<=0))return json({error:"مستويات الوقف والهدف غير صالحة لاتجاه الصفقة."},400);
        event(trade,"risk",session.cursorTime,`وقف ${trade.stopLoss} ← ${data.stopLoss} · هدف ${trade.takeProfit} ← ${data.takeProfit}`);
        trade.stopLoss=data.stopLoss;trade.takeProfit=data.takeProfit;
        const superseded=(trade.stopLevels??[]).filter(x=>!x.filled&&sign*(x.price-data.stopLoss)<=0);
        if(superseded.length){event(trade,"stop-levels-superseded",session.cursorTime,"ألغى الوقف النهائي الأشد حماية المستويات: "+superseded.map(x=>x.price).join(", "));trade.stopLevels=trade.stopLevels?.filter(x=>x.filled||sign*(x.price-data.stopLoss)>0);}
      }
      if(data.action==="reflect"){
        const trade=state.trades.find(t=>t.id===data.tradeId&&t.sessionId===session!.id);
        if(!trade)return json({error:"الصفقة غير موجودة."},404);
        trade.reflection={...trade.reflection,...data.reflection,createdAt:Date.now()};
        event(trade,"reflection",session.cursorTime,`تحديث تحليل الدخول: إعداد ${data.reflection.setupGrade??"—"} · استراتيجية ${data.reflection.strategy??"—"}`);
      }
      if(data.action==="deleteTrade"){
        const idx=state.trades.findIndex(t=>t.id===data.tradeId);
        if(idx===-1)return json({error:"الصفقة غير موجودة."},404);
        state.trades.splice(idx,1);
      }
      if(data.action==="clearTrades"){
        if((data.scope==="session" || data.scope==="current") && session){
          const currentSessionId = session.id;
          state.trades=state.trades.filter(t=>t.sessionId!==currentSessionId);
        }else if(data.scope==="all"){
          state.trades=[];
        }
      }
      if(data.action==="setBalance"){
        state.initialBalance=data.balance;
        if(data.resetTrades){
          state.trades=[];
        }
      }
    }
    if(!await saveWorkspace(id,state,previous))return json({error:"حُفظ إجراء آخر بالتزامن. أعد تحميل الجلسة.",conflict:true},409);
    return json({state,...extra,macro:session?macroAt(session.cursorTime):null});
  }catch(err){return json({error:err instanceof Error?err.message:"تعذر إكمال الإجراء."},err instanceof MarketError?502:500);}
}
