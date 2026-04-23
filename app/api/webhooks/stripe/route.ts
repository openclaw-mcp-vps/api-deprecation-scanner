import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { recordPurchase } from "@/lib/database";

export const runtime = "nodejs";

interface StripeEvent {
  type?: string;
  data?: {
    object?: {
      id?: string;
      customer_email?: string;
      customer_details?: {
        email?: string;
      };
    };
  };
}

function verifyStripeSignature(payload: string, signatureHeader: string | null, secret: string): boolean {
  if (!signatureHeader) {
    return false;
  }

  const pairs = signatureHeader.split(",").map((chunk) => chunk.split("="));
  const timestamp = pairs.find(([key]) => key === "t")?.[1];
  const signatures = pairs.filter(([key]) => key === "v1").map(([, value]) => value);

  if (!timestamp || signatures.length === 0) {
    return false;
  }

  const signedPayload = `${timestamp}.${payload}`;
  const expected = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  return signatures.some((signature) => {
    if (signature.length !== expected.length) {
      return false;
    }
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  });
}

export async function POST(request: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET is not configured." }, { status: 500 });
  }

  const payload = await request.text();
  const signatureHeader = request.headers.get("stripe-signature");

  if (!verifyStripeSignature(payload, signatureHeader, webhookSecret)) {
    return NextResponse.json({ error: "Invalid Stripe webhook signature." }, { status: 400 });
  }

  const event = JSON.parse(payload) as StripeEvent;

  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    const email = event.data?.object?.customer_details?.email || event.data?.object?.customer_email;
    const sessionId = event.data?.object?.id || null;

    if (email) {
      await recordPurchase(email, sessionId);
    }
  }

  return NextResponse.json({ received: true });
}
