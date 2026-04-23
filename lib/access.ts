import crypto from "node:crypto";

export const ACCESS_COOKIE_NAME = "api_scanner_access";
export const ACCESS_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

interface AccessTokenPayload {
  email: string;
  exp: number;
}

function getAccessSecret(): string {
  return process.env.STRIPE_WEBHOOK_SECRET || "development-access-secret-change-me";
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

export function createAccessToken(email: string): string {
  const payload: AccessTokenPayload = {
    email: normalizeEmail(email),
    exp: Math.floor(Date.now() / 1000) + ACCESS_COOKIE_MAX_AGE
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  const signature = crypto.createHmac("sha256", getAccessSecret()).update(encodedPayload).digest("base64url");

  return `${encodedPayload}.${signature}`;
}

export function verifyAccessToken(token?: string | null): AccessTokenPayload | null {
  if (!token) {
    return null;
  }

  const [payloadPart, signaturePart] = token.split(".");
  if (!payloadPart || !signaturePart) {
    return null;
  }

  const expectedSignature = crypto.createHmac("sha256", getAccessSecret()).update(payloadPart).digest("base64url");
  const safeEqual =
    expectedSignature.length === signaturePart.length &&
    crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signaturePart));

  if (!safeEqual) {
    return null;
  }

  try {
    const payload = JSON.parse(fromBase64Url(payloadPart)) as AccessTokenPayload;
    if (!payload.email || payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
