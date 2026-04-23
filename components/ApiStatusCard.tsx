"use client";

import { useState } from "react";
import type { Monitor } from "@/lib/database";

interface ApiStatusCardProps {
  monitor: Monitor;
  onScanFinished?: () => void;
}

function SeverityBadge({ status }: { status: string | null }) {
  if (status === "critical") {
    return <span className="badge badge-high">Critical</span>;
  }
  if (status === "warning") {
    return <span className="badge badge-medium">Warning</span>;
  }
  if (status === "healthy") {
    return <span className="badge badge-low">Healthy</span>;
  }
  return <span className="badge badge-low">Not Scanned</span>;
}

export function ApiStatusCard({ monitor, onScanFinished }: ApiStatusCardProps) {
  const [isScanning, setIsScanning] = useState(false);
  const [statusText, setStatusText] = useState<string>(monitor.lastScanMessage || "No scans yet.");

  const scanNow = async () => {
    setIsScanning(true);
    setStatusText("Running scan...");

    try {
      const response = await fetch("/api/scan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ monitorId: monitor.id })
      });

      const body = (await response.json()) as {
        error?: string;
        results?: Array<{ summary: string }>;
      };

      if (!response.ok) {
        setStatusText(body.error || "Scan failed.");
        return;
      }

      const summary = body.results?.[0]?.summary || "Scan complete.";
      setStatusText(summary);
      onScanFinished?.();
    } catch {
      setStatusText("Network error while scanning monitor.");
    } finally {
      setIsScanning(false);
    }
  };

  return (
    <article className="surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-lg font-semibold">{monitor.name}</h3>
        <SeverityBadge status={monitor.lastScanStatus} />
      </div>
      <p className="mt-2 break-all text-sm text-slate-300">{monitor.apiUrl}</p>
      <p className="mt-3 text-sm text-slate-300">{statusText}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <span>Every {monitor.scanIntervalMinutes} minutes</span>
        {monitor.lastScannedAt && <span>Last scan: {new Date(monitor.lastScannedAt).toLocaleString()}</span>}
      </div>
      <button className="btn-secondary mt-4" disabled={isScanning} onClick={scanNow} type="button">
        {isScanning ? "Scanning..." : "Run Scan Now"}
      </button>
    </article>
  );
}
