"use client";

import { useState } from "react";
import type { Alert, Monitor } from "@/lib/database";
import { AlertsList } from "@/components/AlertsList";
import { ApiStatusCard } from "@/components/ApiStatusCard";
import { MonitorForm } from "@/components/MonitorForm";

interface DashboardClientProps {
  initialMonitors: Monitor[];
  initialAlerts: Alert[];
}

export function DashboardClient({ initialMonitors, initialAlerts }: DashboardClientProps) {
  const [monitors, setMonitors] = useState(initialMonitors);
  const [alerts, setAlerts] = useState(initialAlerts);
  const [refreshMessage, setRefreshMessage] = useState<string>("");

  const refreshData = async () => {
    setRefreshMessage("Refreshing dashboard data...");
    try {
      const response = await fetch("/api/monitors?include=alerts", {
        method: "GET"
      });
      if (!response.ok) {
        setRefreshMessage("Could not refresh data right now.");
        return;
      }
      const body = (await response.json()) as { monitors: Monitor[]; alerts: Alert[] };
      setMonitors(body.monitors);
      setAlerts(body.alerts);
      setRefreshMessage("Dashboard updated.");
    } catch {
      setRefreshMessage("Could not refresh data right now.");
    }
  };

  return (
    <>
      <MonitorForm onCreated={refreshData} />

      <div className="mt-6 flex items-center gap-3">
        <button className="btn-secondary" onClick={refreshData} type="button">
          Refresh Data
        </button>
        {refreshMessage && <span className="text-sm text-slate-400">{refreshMessage}</span>}
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-2">
        {monitors.length === 0 ? (
          <article className="surface p-5 text-sm text-slate-300">
            Add your first monitor above to start tracking deprecation notices and breaking-change signals.
          </article>
        ) : (
          monitors.map((monitor) => (
            <ApiStatusCard key={monitor.id} monitor={monitor} onScanFinished={refreshData} />
          ))
        )}
      </section>

      <div className="mt-6">
        <AlertsList alerts={alerts} />
      </div>
    </>
  );
}
