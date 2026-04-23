import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ACCESS_COOKIE_NAME, verifyAccessToken } from "@/lib/access";
import { getMonitorById, listMonitors } from "@/lib/database";
import { scanAndPersistMonitor } from "@/lib/scanner";

const bodySchema = z.object({
  monitorId: z.string().uuid().optional()
});

function getAccessEmail(request: NextRequest): string | null {
  const token = request.cookies.get(ACCESS_COOKIE_NAME)?.value;
  return verifyAccessToken(token)?.email || null;
}

export async function POST(request: NextRequest) {
  const accessEmail = getAccessEmail(request);
  if (!accessEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(payload);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid scan request." }, { status: 400 });
  }

  let monitorsToScan = await listMonitors(accessEmail);
  if (parsed.data.monitorId) {
    const monitor = await getMonitorById(parsed.data.monitorId, accessEmail);
    if (!monitor) {
      return NextResponse.json({ error: "Monitor not found." }, { status: 404 });
    }
    monitorsToScan = [monitor];
  }

  const results = [];
  for (const monitor of monitorsToScan) {
    results.push(await scanAndPersistMonitor(monitor));
  }

  return NextResponse.json({
    scanned: results.length,
    results
  });
}
