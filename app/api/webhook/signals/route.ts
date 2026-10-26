import { NextResponse } from "next/server";
import { requestOwner, privateHosting, sameOrigin } from "@/lib/personal-auth";
import { z } from "zod";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    if (!requestOwner(request.headers)) return NextResponse.json({error:"يرجى تسجيل الدخول."},{status:401});
    if (privateHosting() && !sameOrigin(request)) return NextResponse.json({error:"مصدر غير مسموح."},{status:403});
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "بيانات الإشارة غير صالحة أو غير بصيغة JSON." },
        { status: 400 }
      );
    }

    const parsed = z.object({symbol:z.string().max(20).default("BTCUSDT"),side:z.enum(["long","short"]).default("long"),action:z.string().max(20).default("buy"),price:z.number().positive().optional(),message:z.string().max(500).optional()}).safeParse(body);
    if (!parsed.success) return NextResponse.json({error:"إشارة غير صالحة."},{status:400});
    const {symbol,side,action,price,message}=parsed.data;
    // Diagnostic receipt only: never log user-supplied text or place an order.
    return NextResponse.json({
      success: true,
      executed: false,
      receivedAt: new Date().toISOString(),
      signal: {
        symbol,
        side,
        action,
        price: price ? Number(price) : null,
        message: message ?? "تم استلام الإشارة بنجاح",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: "تعذر معالجة الـ Webhook." },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    status: "active",
    endpoint: "/api/webhook/signals",
    description: "نقطة استقبال إشارات التنبيهات من TradingView والمنصات الخارجية",
  });
}
