import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);

    if (!body) {
      return NextResponse.json(
        { error: "بيانات الإشارة غير صالحة أو غير بصيغة JSON." },
        { status: 400 }
      );
    }

    const data = body as Record<string, any>;
    const {
      symbol = "BTCUSDT",
      side = "long",
      action = "buy",
      price,
      secret,
      message,
    } = data;

    // Log the incoming signal for diagnostic/audit
    console.log(`[TradingView Webhook Signal Received] ${side.toUpperCase()} ${symbol} @ ${price ?? "Market"}: ${message ?? ""}`);

    return NextResponse.json({
      success: true,
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
      { error: error instanceof Error ? error.message : "تعذر معالجة الـ Webhook." },
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
