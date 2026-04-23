"use client";

import type { Alert } from "@/lib/database";

interface AlertsListProps {
  alerts: Alert[];
}

function severityClass(severity: Alert["severity"]): string {
  if (severity === "high") {
    return "badge badge-high";
  }
  if (severity === "medium") {
    return "badge badge-medium";
  }
  return "badge badge-low";
}

export function AlertsList({ alerts }: AlertsListProps) {
  return (
    <section className="surface p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Recent Alerts</h2>
        <span className="text-xs text-slate-400">{alerts.length} total</span>
      </div>

      {alerts.length === 0 ? (
        <p className="mt-4 text-sm text-slate-300">No alerts yet. Run your first scan to build baseline API change data.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {alerts.map((alert) => (
            <li className="rounded-xl border border-slate-700/70 bg-slate-900/35 p-4" key={alert.id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-semibold text-slate-100">{alert.title}</h3>
                <span className={severityClass(alert.severity)}>{alert.severity}</span>
              </div>
              <p className="mt-2 text-sm text-slate-300">{alert.message}</p>
              {alert.details && <p className="mt-2 text-xs text-slate-400">{alert.details}</p>}
              <p className="mt-2 text-xs text-slate-500">{new Date(alert.createdAt).toLocaleString()}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
