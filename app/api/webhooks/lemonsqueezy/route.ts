import { NextRequest, NextResponse } from "next/server";
import { recordPurchase } from "@/lib/database";
import { verifyLemonSqueezySignature, type LemonSqueezyWebhookEvent } from "@/lib/lemonsqueezy";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const payload = await request.text();
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;

  if (secret) {
    const signature = request.headers.get("x-signature");
    const valid = verifyLemonSqueezySignature(payload, signature, secret);
    if (!valid) {
      return NextResponse.json({ error: "Invalid LemonSqueezy signature." }, { status: 400 });
    }
  }

  const event = JSON.parse(payload) as LemonSqueezyWebhookEvent;
  const eventName = event.meta?.event_name;

  if (eventName === "order_created" || eventName === "subscription_created") {
    const email = event.data?.attributes?.user_email || event.meta?.custom_data?.email;
    const sessionId = event.data?.id || null;

    if (email) {
      await recordPurchase(email, sessionId);
    }
  }

  return NextResponse.json({ received: true, provider: "lemonsqueezy" });
}
