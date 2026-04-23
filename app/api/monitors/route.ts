import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/access";
import { createMonitor, listAlerts, listMonitors } from "@/lib/database";

const createMonitorSchema = z.object({
  name: z.string().min(2).max(120),
  apiUrl: z.string().url(),
  docsUrl: z.string().url().nullable().optional(),
  changelogUrl: z.string().url().nullable().optional(),
  webhookUrl: z.string().url().nullable().optional(),
  scanIntervalMinutes: z.number().int().min(15).max(10080)
});

function getAccessEmail(request: NextRequest): string | null {
  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  return verifyAccessToken(token)?.email || null;
}

export async function GET(request: NextRequest) {
  const accessEmail = getAccessEmail(request);
  if (!accessEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const includeAlerts = request.nextUrl.searchParams.get("include") === "alerts";
  const [monitors, alerts] = await Promise.all([
    listMonitors(accessEmail),
    includeAlerts ? listAlerts(accessEmail, 50) : Promise.resolve([])
  ]);

  return NextResponse.json({ monitors, alerts });
}

export async function POST(request: NextRequest) {
  const accessEmail = getAccessEmail(request);
  if (!accessEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => null);
  const parsed = createMonitorSchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: parsed.error.issues.map((issue) => issue.message).join("; ")
      },
      { status: 400 }
    );
  }

  const created = await createMonitor({
    ownerEmail: accessEmail,
    ...parsed.data
  });

  return NextResponse.json({ monitor: created }, { status: 201 });
}
