import crypto from "node:crypto";
import { lemonSqueezySetup } from "@lemonsqueezy/lemonsqueezy.js";

export interface LemonSqueezyWebhookEvent {
  meta?: {
    event_name?: string;
    custom_data?: {
      email?: string;
    };
  };
  data?: {
    id?: string;
    attributes?: {
      user_email?: string;
    };
  };
}

export function verifyLemonSqueezySignature(payload: string, signature: string | null, secret: string): boolean {
  if (!signature) {
    return false;
  }

  const digest = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return digest.length === signature.length && crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}

export function setupLemonSqueezyClient(): void {
  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  if (!apiKey) {
    return;
  }

  lemonSqueezySetup({
    apiKey,
    onError: () => undefined
  });
}
