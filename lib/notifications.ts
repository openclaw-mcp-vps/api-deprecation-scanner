import axios from "axios";
import { Resend } from "resend";
import type { Alert, Monitor } from "@/lib/database";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const fromEmail = process.env.ALERT_FROM_EMAIL || "alerts@api-deprecation-scanner.local";

function buildEmailHtml(monitor: Monitor, alerts: Alert[]): string {
  const rows = alerts
    .map(
      (alert) =>
        `<li><strong>[${alert.severity.toUpperCase()}]</strong> ${alert.title}<br/><span>${alert.message}</span></li>`
    )
    .join("");

  return `
    <div style="font-family:Arial,Helvetica,sans-serif;line-height:1.5;">
      <h2>API Deprecation Alert: ${monitor.name}</h2>
      <p>We detected new change signals for <strong>${monitor.apiUrl}</strong>.</p>
      <ul>${rows}</ul>
      <p>Open your dashboard to review and plan migration work before the next deployment cycle.</p>
    </div>
  `;
}

async function sendEmailAlert(monitor: Monitor, alerts: Alert[]): Promise<void> {
  if (!resend) {
    return;
  }

  await resend.emails.send({
    from: fromEmail,
    to: monitor.ownerEmail,
    subject: `[API Scanner] ${alerts.length} new alert${alerts.length === 1 ? "" : "s"} for ${monitor.name}`,
    html: buildEmailHtml(monitor, alerts)
  });
}

async function sendWebhookAlert(monitor: Monitor, alerts: Alert[]): Promise<void> {
  if (!monitor.webhookUrl) {
    return;
  }

  await axios.post(
    monitor.webhookUrl,
    {
      monitorId: monitor.id,
      monitorName: monitor.name,
      apiUrl: monitor.apiUrl,
      alerts: alerts.map((alert) => ({
        id: alert.id,
        severity: alert.severity,
        title: alert.title,
        message: alert.message,
        createdAt: alert.createdAt,
        type: alert.type
      }))
    },
    {
      timeout: 10_000,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "api-deprecation-scanner/1.0"
      }
    }
  );
}

export async function sendAlertNotifications(monitor: Monitor, alerts: Alert[]): Promise<void> {
  if (alerts.length === 0) {
    return;
  }

  await Promise.allSettled([sendEmailAlert(monitor, alerts), sendWebhookAlert(monitor, alerts)]);
}
