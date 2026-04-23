import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  ACCESS_COOKIE_MAX_AGE,
  ACCESS_COOKIE_NAME,
  createAccessToken,
  normalizeEmail
} from "@/lib/access";
import { hasPurchase } from "@/lib/database";

const schema = z.object({
  email: z.string().email()
});

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = schema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Enter a valid checkout email." }, { status: 400 });
  }

  const email = normalizeEmail(parsed.data.email);
  const purchased = await hasPurchase(email);

  if (!purchased) {
    return NextResponse.json(
      {
        error: "No purchase found for this email yet. Complete checkout, then try again in about 30 seconds."
      },
      { status: 402 }
    );
  }

  const response = NextResponse.json({ message: "Purchase verified. Dashboard unlocked for this browser." });
  response.cookies.set({
    name: ACCESS_COOKIE_NAME,
    value: createAccessToken(email),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: ACCESS_COOKIE_MAX_AGE
  });

  return response;
}
