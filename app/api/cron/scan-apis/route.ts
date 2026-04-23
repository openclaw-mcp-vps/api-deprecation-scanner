import { NextRequest, NextResponse } from "next/server";
import { getDueMonitors } from "@/lib/database";
import { scanAndPersistMonitor } from "@/lib/scanner";

export const runtime = "nodejs";

function isAuthorized(request: NextRequest): boolean {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return true;
  }

  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  return headerSecret === configuredSecret || bearerToken === configuredSecret;
}

async function runScanJob(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const dueMonitors = await getDueMonitors();
  const results = [];

  for (const monitor of dueMonitors) {
    results.push(await scanAndPersistMonitor(monitor));
  }

  return NextResponse.json({
    status: "ok",
    scanned: results.length,
    alertsCreated: results.reduce((total, item) => total + item.alertsCreated, 0),
    results
  });
}

export async function GET(request: NextRequest) {
  return runScanJob(request);
}

export async function POST(request: NextRequest) {
  return runScanJob(request);
}
