import {validateStopLevels} from "@/lib/stop-levels";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb } from "@/db";
import { workspaces } from "@/db/schema";
import { activeSession, advance, blank, event, FEE_RATE, INITIAL_BALANCE, normalizeWorkspace, SYMBOLS, DURATIONS, type Workspace, type Trade, type Session, type Timeframe } from "@/lib/replay";
import { chartHistory, olderHistory, marketData, MarketError } from "@/lib/market-data";

export const dynamic = "force-dynamic";
const actionSchema=z.discriminatedUnion("action",[
  z.object({action:z.literal("start"),symbol:z.enum(SYMBOLS),startTime:z.number().int().positive(),confirmReplace:z.boolean().default(false)}),
  z.object({action:z.literal("step"),unit:z.enum(["minute","bar"]).default("minute"),count:z.number().int().min(1).max(64).default(1)}),
  z.object({action:z.literal("buy"),side:z.enum(["long","short"]).default("long"),orderType:z.enum(["market","limit","stop"]).default("market"),orderPrice:z.number().positive().nullable().optional(),notional:z.number().positive().max(100000),stopLoss:z.number().positive(),takeProfit:z.number().positive(),previewOriginal:z.object({entry:z.number().positive(),stop:z.number().positive(),target:z.number().positive()}).nullish(),reason:z.string().max(500).default("")}),
  z.object({action:z.literal("stops"),tradeId:z.string().uuid(),levels:z.array(z.object({price:z.number().positive(),amount:z.number().positive()})).max(5)}),
  z.object({action:z.literal("close")}),z.object({action:z.literal("cancel")}),
  z.object({action:z.literal("risk"),tradeId:z.string().uuid(),stopLoss:z.number().positive(),takeProfit:z.number().positive()})
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
    if(query.has("timeframe")){
      const timeframe=query.get("timeframe") as Timeframe;
      if(!Object.hasOwn(DURATIONS,timeframe))return json({error:"إطار زمني غير صالح."},400);
      const session=activeSession(state);if(!session)return json({state,candles:[],source:null});
      if(query.has("before")) {
        if(query.get("sessionId")!==session.id)return json({error:"تغيرت الجلسة؛ تجاهل التاريخ السابق."},409);
        const before=Number(query.get("before"));
        if(!Number.isSafeInteger(before)||before<0||before%DURATIONS[timeframe]!==0||before>session.cursorTime+1)
          return json({error:"حد التاريخ غير صالح."},400);
        try {return json({sessionId:session.id,...await olderHistory(session,timeframe,before)});}
        catch(err){return json({error:err instanceof Error?err.message:"تعذر تحميل التاريخ الأقدم."},502);}
      }
      try { const history=await chartHistory(session,timeframe); return json({state,...history}); }
      catch(err) { return json({state,error:err instanceof Error?err.message:"تعذر تحميل الشموع.",candles:[],source:null},502); }
    }
    return json({state});
  }catch(err){return json({error:err instanceof Error?err.message:"تعذر تحميل الجلسة."},err instanceof MarketError?502:500);}
}
export async function POST(request:Request){
  try{
    const id=await ownerId();if(!id)return json({error:"يرجى تسجيل الدخول."},401);
    const envelope=z.object({revision:z.number().int().nonnegative(),timeframe:z.enum(["1m","5m","15m","1h","4h","1d"]).optional()}).passthrough().safeParse(await request.json());
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
      const startTime=Math.floor(data.startTime/60000)*60000;
      if(startTime<Date.UTC(2017,7,17)||startTime>=Math.floor(Date.now()/60000)*60000)return json({error:"اختر وقتًا تاريخيًا مكتملًا ضمن فترة توفر Binance."},400);
      const next:Session={id:crypto.randomUUID(),symbol:data.symbol,startTime,cursorTime:startTime-1,advancedBars:0,createdAt:new Date().toISOString()};
      const timeframe=body.timeframe ?? "15m";
      extra=await chartHistory(next,timeframe);
      state.sessions.unshift(next);state.activeSessionId=next.id;session=next;
    }else{
      if(!session)return json({error:"ابدأ جلسة Replay أولًا."},409);
      if(data.action==="step"){
        const first=session.cursorTime+1,latest=Math.floor(Date.now()/60000)*60000-60000;
        if(first>latest)return json({error:"وصلت إلى آخر شمعة مكتملة متاحة."},409);
        const requested=data.unit==="bar"?DURATIONS[body.timeframe??"15m"]/60000:data.count;
        const count=Math.min(requested,Math.floor((latest-first)/60000)+1);
        const result=await marketData(session.symbol,"1m",first,first+count*60000-1);
        advance(state,result.candles,count);extra=result;
      }
      if(data.action==="buy"){
        if(state.trades.some(t=>t.sessionId===session!.id&&["pending","open","close_pending"].includes(t.status)))return json({error:"أغلق الصفقة أو ألغِ الأمر الحالي أولًا."},409);
        const last=await marketData(session.symbol,"1m",session.cursorTime-59999,session.cursorTime);
        const current=last.candles.at(-1)?.close;
        if(!current)throw new MarketError("تعذر التحقق من السعر الحالي؛ لم يُرسل الأمر.");
        const level=data.orderType==="market"?current:data.orderPrice;
        const sign=data.side==="short"?-1:1;
        if(!level || sign*(level-data.stopLoss)<=0 || sign*(data.takeProfit-level)<=0)return json({error:"الوقف والهدف لا يناسبان اتجاه الصفقة: الشراء هدفه أعلى، والبيع هدفه أدنى."},400);
        if(data.orderType==="limit" && sign*(level-current)>0)return json({error:"سعر المحدد: تحت السعر الحالي للشراء، وفوقه للبيع."},400);
        if(data.orderType==="stop" && sign*(level-current)<=0)return json({error:"سعر التفعيل: فوق السعر الحالي للشراء، وتحته للبيع."},400);
        const equity=INITIAL_BALANCE+state.trades.filter(t=>t.sessionId===session!.id&&t.status==="closed").reduce((s,t)=>s+t.realizedPnl,0);
        if(data.notional*(1+FEE_RATE)>equity)return json({error:"حجم الأمر مع رسوم الدخول يتجاوز الرصيد المتاح."},400);
        const trade:Trade={id:crypto.randomUUID(),sessionId:session.id,symbol:session.symbol,status:"pending",side:data.side,referencePrice:level,orderType:data.orderType,orderPrice:data.orderType==="market"?null:level,eligibleTime:session.cursorTime+1,triggeredAt:null,notional:data.notional,quantity:null,entryPrice:null,stopLoss:data.stopLoss,takeProfit:data.takeProfit,initialStop:null,initialTarget:null,exitPrice:null,entryFee:0,exitFee:0,realizedPnl:0,rMultiple:null,initialRisk:null,reason:data.reason,entryTime:null,exitTime:null,exitReason:null,createdAt:new Date().toISOString(),events:[]};
        event(trade,"created",session.cursorTime,`${data.side} · ${data.orderType} · ${level} · وقف ${data.stopLoss} · هدف ${data.takeProfit}`);
        if(data.previewOriginal) event(trade,"preview",session.cursorTime,`معاينة أولية: دخول ${data.previewOriginal.entry} · وقف ${data.previewOriginal.stop} · هدف ${data.previewOriginal.target}؛ تأكيد: دخول ${level} · وقف ${data.stopLoss} · هدف ${data.takeProfit}`);
        state.trades.unshift(trade);extra.source=last.source;
      }
      if(data.action==="cancel"||data.action==="close"){
        const trade=state.trades.find(t=>t.sessionId===session!.id&&t.status===(data.action==="cancel"?"pending":"open"));
        if(!trade)return json({error:"لا توجد صفقة أو أمر مطابق لهذا الإجراء."},409);
        trade.status=data.action==="cancel"?"cancelled":"close_pending";
        event(trade,trade.status,session.cursorTime,data.action==="cancel"?"إلغاء الأمر":"طلب إغلاق عند الافتتاح التالي");
      }
      if(data.action==="stops"){
        const trade=state.trades.find(t=>t.id===data.tradeId&&t.sessionId===session!.id);
        if(!trade)return json({error:"الصفقة غير موجودة."},404);
        const last=await marketData(session.symbol,"1m",session.cursorTime-59999,session.cursorTime);
        const current=last.candles.at(-1)?.close;
        if(!current)throw new MarketError("تعذر التحقق من السعر الحالي.");
        const issue=validateStopLevels(trade,data.levels,current);
        if(issue)return json({error:issue},400);
        event(trade,"stop-levels",session.cursorTime,`تعديل الوقف الجزئي: ${JSON.stringify(trade.stopLevels??[])} ← ${JSON.stringify(data.levels)}`);
        trade.stopLevels=[...(trade.stopLevels??[]).filter(x=>x.filled),...data.levels.map(x=>({...x,id:crypto.randomUUID(),eligibleTime:session!.cursorTime+1,filled:false}))];
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
    }
    if(!await saveWorkspace(id,state,previous))return json({error:"حُفظ إجراء آخر بالتزامن. أعد تحميل الجلسة.",conflict:true},409);
    return json({state,...extra});
  }catch(err){return json({error:err instanceof Error?err.message:"تعذر إكمال الإجراء."},err instanceof MarketError?502:500);}
}
