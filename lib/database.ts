import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import postgres from "postgres";

export type Severity = "low" | "medium" | "high";

export interface Monitor {
  id: string;
  ownerEmail: string;
  name: string;
  apiUrl: string;
  docsUrl: string | null;
  changelogUrl: string | null;
  webhookUrl: string | null;
  scanIntervalMinutes: number;
  lastScannedAt: string | null;
  lastKnownVersion: string | null;
  lastFingerprint: string | null;
  lastScanStatus: string | null;
  lastScanMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Alert {
  id: string;
  monitorId: string;
  ownerEmail: string;
  type: "deprecation" | "breaking" | "version" | "warning";
  severity: Severity;
  title: string;
  message: string;
  details: string | null;
  acknowledged: boolean;
  createdAt: string;
}

export interface PurchaseRecord {
  email: string;
  sourceSessionId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMonitorInput {
  ownerEmail: string;
  name: string;
  apiUrl: string;
  docsUrl?: string | null;
  changelogUrl?: string | null;
  webhookUrl?: string | null;
  scanIntervalMinutes: number;
}

export interface CreateAlertInput {
  monitorId: string;
  ownerEmail: string;
  type: Alert["type"];
  severity: Severity;
  title: string;
  message: string;
  details?: string | null;
}

interface Store {
  monitors: Monitor[];
  alerts: Alert[];
  purchases: PurchaseRecord[];
}

interface MonitorRow {
  id: string;
  owner_email: string;
  name: string;
  api_url: string;
  docs_url: string | null;
  changelog_url: string | null;
  webhook_url: string | null;
  scan_interval_minutes: number;
  last_scanned_at: Date | string | null;
  last_known_version: string | null;
  last_fingerprint: string | null;
  last_scan_status: string | null;
  last_scan_message: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface AlertRow {
  id: string;
  monitor_id: string;
  owner_email: string;
  type: Alert["type"];
  severity: Severity;
  title: string;
  message: string;
  details: string | null;
  acknowledged: boolean;
  created_at: Date | string;
}

interface PurchaseRow {
  email: string;
  source_session_id: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

const databaseUrl = process.env.DATABASE_URL;
const sql = databaseUrl
  ? postgres(databaseUrl, {
      ssl: databaseUrl.includes("localhost") ? false : "require"
    })
  : null;

const storePath = path.join(process.cwd(), ".data", "api-deprecation-scanner.json");
let schemaReady: Promise<void> | null = null;

function iso(value: Date | string | null): string | null {
  if (!value) {
    return null;
  }
  return new Date(value).toISOString();
}

function mapMonitorRow(row: MonitorRow): Monitor {
  return {
    id: row.id,
    ownerEmail: row.owner_email,
    name: row.name,
    apiUrl: row.api_url,
    docsUrl: row.docs_url,
    changelogUrl: row.changelog_url,
    webhookUrl: row.webhook_url,
    scanIntervalMinutes: row.scan_interval_minutes,
    lastScannedAt: iso(row.last_scanned_at),
    lastKnownVersion: row.last_known_version,
    lastFingerprint: row.last_fingerprint,
    lastScanStatus: row.last_scan_status,
    lastScanMessage: row.last_scan_message,
    createdAt: iso(row.created_at) || new Date().toISOString(),
    updatedAt: iso(row.updated_at) || new Date().toISOString()
  };
}

function mapAlertRow(row: AlertRow): Alert {
  return {
    id: row.id,
    monitorId: row.monitor_id,
    ownerEmail: row.owner_email,
    type: row.type,
    severity: row.severity,
    title: row.title,
    message: row.message,
    details: row.details,
    acknowledged: row.acknowledged,
    createdAt: iso(row.created_at) || new Date().toISOString()
  };
}

async function ensureSchema(): Promise<void> {
  if (!sql) {
    return;
  }
  if (schemaReady) {
    return schemaReady;
  }

  schemaReady = (async () => {
    await sql`
      CREATE TABLE IF NOT EXISTS monitors (
        id TEXT PRIMARY KEY,
        owner_email TEXT NOT NULL,
        name TEXT NOT NULL,
        api_url TEXT NOT NULL,
        docs_url TEXT,
        changelog_url TEXT,
        webhook_url TEXT,
        scan_interval_minutes INTEGER NOT NULL DEFAULT 720,
        last_scanned_at TIMESTAMPTZ,
        last_known_version TEXT,
        last_fingerprint TEXT,
        last_scan_status TEXT,
        last_scan_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS monitors_owner_idx
      ON monitors (owner_email)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS alerts (
        id TEXT PRIMARY KEY,
        monitor_id TEXT NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
        owner_email TEXT NOT NULL,
        type TEXT NOT NULL,
        severity TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,
        acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;

    await sql`
      CREATE INDEX IF NOT EXISTS alerts_owner_created_idx
      ON alerts (owner_email, created_at DESC)
    `;

    await sql`
      CREATE TABLE IF NOT EXISTS purchases (
        email TEXT PRIMARY KEY,
        source_session_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `;
  })();

  return schemaReady;
}

async function readStore(): Promise<Store> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });

  try {
    const raw = await fs.readFile(storePath, "utf8");
    const parsed = JSON.parse(raw) as Store;
    return {
      monitors: parsed.monitors ?? [],
      alerts: parsed.alerts ?? [],
      purchases: parsed.purchases ?? []
    };
  } catch {
    const empty: Store = { monitors: [], alerts: [], purchases: [] };
    await fs.writeFile(storePath, JSON.stringify(empty, null, 2), "utf8");
    return empty;
  }
}

async function writeStore(store: Store): Promise<void> {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), "utf8");
}

export async function listMonitors(ownerEmail: string): Promise<Monitor[]> {
  if (sql) {
    await ensureSchema();
    const rows = await sql<MonitorRow[]>`
      SELECT *
      FROM monitors
      WHERE owner_email = ${ownerEmail}
      ORDER BY created_at DESC
    `;

    return rows.map(mapMonitorRow);
  }

  const store = await readStore();
  return store.monitors.filter((item) => item.ownerEmail === ownerEmail).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function getMonitorById(id: string, ownerEmail?: string): Promise<Monitor | null> {
  if (sql) {
    await ensureSchema();

    const rows = ownerEmail
      ? await sql<MonitorRow[]>`
          SELECT *
          FROM monitors
          WHERE id = ${id} AND owner_email = ${ownerEmail}
          LIMIT 1
        `
      : await sql<MonitorRow[]>`
          SELECT *
          FROM monitors
          WHERE id = ${id}
          LIMIT 1
        `;

    return rows.length ? mapMonitorRow(rows[0]) : null;
  }

  const store = await readStore();
  const found = store.monitors.find((item) => item.id === id && (!ownerEmail || item.ownerEmail === ownerEmail));
  return found ?? null;
}

export async function createMonitor(input: CreateMonitorInput): Promise<Monitor> {
  const now = new Date().toISOString();
  const monitor: Monitor = {
    id: crypto.randomUUID(),
    ownerEmail: input.ownerEmail,
    name: input.name,
    apiUrl: input.apiUrl,
    docsUrl: input.docsUrl ?? null,
    changelogUrl: input.changelogUrl ?? null,
    webhookUrl: input.webhookUrl ?? null,
    scanIntervalMinutes: input.scanIntervalMinutes,
    lastScannedAt: null,
    lastKnownVersion: null,
    lastFingerprint: null,
    lastScanStatus: null,
    lastScanMessage: null,
    createdAt: now,
    updatedAt: now
  };

  if (sql) {
    await ensureSchema();
    await sql`
      INSERT INTO monitors (
        id, owner_email, name, api_url, docs_url, changelog_url, webhook_url,
        scan_interval_minutes, last_scanned_at, last_known_version, last_fingerprint,
        last_scan_status, last_scan_message, created_at, updated_at
      )
      VALUES (
        ${monitor.id}, ${monitor.ownerEmail}, ${monitor.name}, ${monitor.apiUrl}, ${monitor.docsUrl}, ${monitor.changelogUrl},
        ${monitor.webhookUrl}, ${monitor.scanIntervalMinutes}, ${monitor.lastScannedAt}, ${monitor.lastKnownVersion}, ${monitor.lastFingerprint},
        ${monitor.lastScanStatus}, ${monitor.lastScanMessage}, ${monitor.createdAt}, ${monitor.updatedAt}
      )
    `;
    return monitor;
  }

  const store = await readStore();
  store.monitors.push(monitor);
  await writeStore(store);
  return monitor;
}

export async function updateMonitorScanSnapshot(params: {
  monitorId: string;
  lastScannedAt: string;
  lastKnownVersion: string | null;
  lastFingerprint: string;
  lastScanStatus: string;
  lastScanMessage: string;
}): Promise<void> {
  if (sql) {
    await ensureSchema();
    await sql`
      UPDATE monitors
      SET last_scanned_at = ${params.lastScannedAt},
          last_known_version = ${params.lastKnownVersion},
          last_fingerprint = ${params.lastFingerprint},
          last_scan_status = ${params.lastScanStatus},
          last_scan_message = ${params.lastScanMessage},
          updated_at = NOW()
      WHERE id = ${params.monitorId}
    `;
    return;
  }

  const store = await readStore();
  const monitor = store.monitors.find((item) => item.id === params.monitorId);
  if (!monitor) {
    return;
  }

  monitor.lastScannedAt = params.lastScannedAt;
  monitor.lastKnownVersion = params.lastKnownVersion;
  monitor.lastFingerprint = params.lastFingerprint;
  monitor.lastScanStatus = params.lastScanStatus;
  monitor.lastScanMessage = params.lastScanMessage;
  monitor.updatedAt = new Date().toISOString();

  await writeStore(store);
}

export async function listAlerts(ownerEmail: string, limit = 100): Promise<Alert[]> {
  if (sql) {
    await ensureSchema();
    const rows = await sql<AlertRow[]>`
      SELECT *
      FROM alerts
      WHERE owner_email = ${ownerEmail}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return rows.map(mapAlertRow);
  }

  const store = await readStore();
  return store.alerts
    .filter((item) => item.ownerEmail === ownerEmail)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limit);
}

export async function createAlert(input: CreateAlertInput): Promise<Alert> {
  const alert: Alert = {
    id: crypto.randomUUID(),
    monitorId: input.monitorId,
    ownerEmail: input.ownerEmail,
    type: input.type,
    severity: input.severity,
    title: input.title,
    message: input.message,
    details: input.details ?? null,
    acknowledged: false,
    createdAt: new Date().toISOString()
  };

  if (sql) {
    await ensureSchema();
    await sql`
      INSERT INTO alerts (
        id, monitor_id, owner_email, type, severity, title, message, details, acknowledged, created_at
      )
      VALUES (
        ${alert.id}, ${alert.monitorId}, ${alert.ownerEmail}, ${alert.type}, ${alert.severity},
        ${alert.title}, ${alert.message}, ${alert.details}, ${alert.acknowledged}, ${alert.createdAt}
      )
    `;
    return alert;
  }

  const store = await readStore();
  store.alerts.push(alert);
  await writeStore(store);
  return alert;
}

export async function acknowledgeAlert(alertId: string, ownerEmail: string): Promise<boolean> {
  if (sql) {
    await ensureSchema();
    const rows = await sql<AlertRow[]>`
      UPDATE alerts
      SET acknowledged = TRUE
      WHERE id = ${alertId} AND owner_email = ${ownerEmail}
      RETURNING *
    `;
    return rows.length > 0;
  }

  const store = await readStore();
  const alert = store.alerts.find((item) => item.id === alertId && item.ownerEmail === ownerEmail);
  if (!alert) {
    return false;
  }

  alert.acknowledged = true;
  await writeStore(store);
  return true;
}

export async function getDueMonitors(now = new Date()): Promise<Monitor[]> {
  if (sql) {
    await ensureSchema();
    const rows = await sql<MonitorRow[]>`
      SELECT *
      FROM monitors
      WHERE last_scanned_at IS NULL
         OR last_scanned_at <= NOW() - (scan_interval_minutes || ' minutes')::interval
      ORDER BY COALESCE(last_scanned_at, TO_TIMESTAMP(0)) ASC
      LIMIT 200
    `;
    return rows.map(mapMonitorRow);
  }

  const store = await readStore();
  return store.monitors.filter((monitor) => {
    if (!monitor.lastScannedAt) {
      return true;
    }
    const lastScanMs = Date.parse(monitor.lastScannedAt);
    const nextDueMs = lastScanMs + monitor.scanIntervalMinutes * 60_000;
    return Number.isFinite(nextDueMs) ? nextDueMs <= now.getTime() : true;
  });
}

export async function recordPurchase(email: string, sourceSessionId: string | null): Promise<void> {
  const normalizedEmail = email.trim().toLowerCase();

  if (sql) {
    await ensureSchema();
    await sql`
      INSERT INTO purchases (email, source_session_id, created_at, updated_at)
      VALUES (${normalizedEmail}, ${sourceSessionId}, NOW(), NOW())
      ON CONFLICT (email)
      DO UPDATE SET
        source_session_id = EXCLUDED.source_session_id,
        updated_at = NOW()
    `;
    return;
  }

  const store = await readStore();
  const existing = store.purchases.find((item) => item.email === normalizedEmail);
  const nowIso = new Date().toISOString();

  if (existing) {
    existing.sourceSessionId = sourceSessionId;
    existing.updatedAt = nowIso;
  } else {
    store.purchases.push({
      email: normalizedEmail,
      sourceSessionId,
      createdAt: nowIso,
      updatedAt: nowIso
    });
  }

  await writeStore(store);
}

export async function hasPurchase(email: string): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();

  if (sql) {
    await ensureSchema();
    const rows = await sql<PurchaseRow[]>`
      SELECT *
      FROM purchases
      WHERE email = ${normalizedEmail}
      LIMIT 1
    `;
    return rows.length > 0;
  }

  const store = await readStore();
  return store.purchases.some((item) => item.email === normalizedEmail);
}
