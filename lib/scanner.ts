import crypto from "node:crypto";
import axios, { AxiosResponse } from "axios";
import * as cheerio from "cheerio";
import { CronJob } from "cron";
import {
  createAlert,
  type Alert,
  type CreateAlertInput,
  type Monitor,
  updateMonitorScanSnapshot
} from "@/lib/database";
import { sendAlertNotifications } from "@/lib/notifications";

export type Severity = "low" | "medium" | "high";

export interface ScanFinding {
  type: "deprecation" | "breaking" | "version" | "warning";
  severity: Severity;
  title: string;
  message: string;
  source: string;
}

export interface ScanOutcome {
  scannedAt: string;
  version: string | null;
  fingerprint: string;
  findings: ScanFinding[];
  summary: string;
  status: "healthy" | "warning" | "critical";
}

export interface ScanExecutionResult {
  monitorId: string;
  monitorName: string;
  scannedAt: string;
  changed: boolean;
  status: ScanOutcome["status"];
  summary: string;
  version: string | null;
  alertsCreated: number;
}

const deprecatedPattern = /\bdeprecated\b|\bsunset\b|\bend-of-life\b/i;
const breakingPattern = /\bbreaking\s+change\b|\bincompatible\b|\bno\s+longer\s+supported\b|\bremoved?\b/i;
const warningPattern = /\bwarn(?:ing)?\b|\bwill\s+be\s+removed\b|\bmigrate\s+to\b/i;

const semverPattern = /\b(v?\d+\.\d+(?:\.\d+)?)\b/;

function getHighestSeverity(findings: ScanFinding[]): Severity {
  if (findings.some((item) => item.severity === "high")) {
    return "high";
  }
  if (findings.some((item) => item.severity === "medium")) {
    return "medium";
  }
  return "low";
}

function toStatus(severity: Severity): ScanOutcome["status"] {
  if (severity === "high") {
    return "critical";
  }
  if (severity === "medium") {
    return "warning";
  }
  return "healthy";
}

function computeFingerprint(payload: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(payload)).digest("hex");
}

function parseVersion(value?: string | null): string | null {
  if (!value) {
    return null;
  }
  const match = value.match(semverPattern);
  return match ? match[1] : null;
}

function compareSemver(previous: string, current: string): Severity {
  const previousParts = previous.replace(/^v/i, "").split(".").map((part) => Number(part));
  const currentParts = current.replace(/^v/i, "").split(".").map((part) => Number(part));

  const [prevMajor = 0, prevMinor = 0] = previousParts;
  const [nextMajor = 0, nextMinor = 0] = currentParts;

  if (nextMajor > prevMajor) {
    return "high";
  }
  if (nextMinor > prevMinor) {
    return "medium";
  }
  return "low";
}

function extractBodyText(response: AxiosResponse): string {
  const contentType = String(response.headers["content-type"] || "").toLowerCase();

  if (typeof response.data === "string") {
    if (contentType.includes("text/html")) {
      const $ = cheerio.load(response.data);
      return $.text().replace(/\s+/g, " ").trim();
    }
    return response.data;
  }

  if (typeof response.data === "object" && response.data !== null) {
    return JSON.stringify(response.data);
  }

  return "";
}

function detectHeaders(source: string, response: AxiosResponse): { findings: ScanFinding[]; version: string | null } {
  const findings: ScanFinding[] = [];

  const deprecationHeader = response.headers.deprecation;
  const sunsetHeader = response.headers.sunset;
  const warningHeader = response.headers.warning;
  const versionHeader =
    response.headers["api-version"] || response.headers["x-api-version"] || response.headers["x-version"];

  if (deprecationHeader) {
    findings.push({
      type: "deprecation",
      severity: "medium",
      title: "Deprecation header detected",
      message: `Response includes deprecation signal: ${String(deprecationHeader)}`,
      source
    });
  }

  if (sunsetHeader) {
    findings.push({
      type: "breaking",
      severity: "high",
      title: "Sunset header detected",
      message: `Response includes sunset date: ${String(sunsetHeader)}`,
      source
    });
  }

  if (warningHeader) {
    findings.push({
      type: "warning",
      severity: "medium",
      title: "Warning header detected",
      message: `Response warning header: ${String(warningHeader)}`,
      source
    });
  }

  return {
    findings,
    version: parseVersion(String(versionHeader || ""))
  };
}

function detectBodySignals(source: string, text: string): ScanFinding[] {
  const findings: ScanFinding[] = [];
  if (!text) {
    return findings;
  }

  const compact = text.slice(0, 8000);

  if (breakingPattern.test(compact)) {
    findings.push({
      type: "breaking",
      severity: "high",
      title: "Breaking-change language detected",
      message: "Detected wording that indicates incompatible API behavior changes.",
      source
    });
  }

  if (deprecatedPattern.test(compact)) {
    findings.push({
      type: "deprecation",
      severity: "medium",
      title: "Deprecation language detected",
      message: "Detected deprecation or sunset language in the scanned source.",
      source
    });
  }

  if (warningPattern.test(compact)) {
    findings.push({
      type: "warning",
      severity: "medium",
      title: "Migration warning language detected",
      message: "Detected warning/migration language that may require implementation changes.",
      source
    });
  }

  return findings;
}

async function scanUrl(url: string, source: string): Promise<{ findings: ScanFinding[]; version: string | null }> {
  const response = await axios.get(url, {
    timeout: 15_000,
    validateStatus: () => true,
    maxRedirects: 4,
    headers: {
      "User-Agent": "api-deprecation-scanner/1.0",
      Accept: "application/json,text/html,application/xml;q=0.9,*/*;q=0.8"
    }
  });

  const bodyText = extractBodyText(response);
  const headerScan = detectHeaders(source, response);
  const bodyFindings = detectBodySignals(source, bodyText);
  const findings = [...headerScan.findings, ...bodyFindings];

  if (response.status >= 500) {
    findings.push({
      type: "warning",
      severity: "medium",
      title: "Endpoint stability warning",
      message: `Target returned HTTP ${response.status}, which can hide deprecation data and impact reliability.`,
      source
    });
  }

  const derivedVersion = parseVersion(bodyText);
  const version = headerScan.version || derivedVersion;

  return { findings, version };
}

function dedupeFindings(findings: ScanFinding[]): ScanFinding[] {
  const seen = new Set<string>();
  const deduped: ScanFinding[] = [];

  for (const finding of findings) {
    const key = `${finding.type}:${finding.severity}:${finding.title}:${finding.source}`;
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(finding);
    }
  }

  return deduped;
}

function mapFindingToAlertType(type: ScanFinding["type"]): Alert["type"] {
  if (type === "breaking") {
    return "breaking";
  }
  if (type === "version") {
    return "version";
  }
  if (type === "warning") {
    return "warning";
  }
  return "deprecation";
}

function buildSummary(findings: ScanFinding[], status: ScanOutcome["status"]): string {
  if (findings.length === 0) {
    return "No deprecation or breaking-change signals were detected in this scan.";
  }

  const high = findings.filter((item) => item.severity === "high").length;
  const medium = findings.filter((item) => item.severity === "medium").length;
  const low = findings.filter((item) => item.severity === "low").length;

  return `Scan status: ${status}. Findings: ${high} high, ${medium} medium, ${low} low.`;
}

export async function scanMonitor(monitor: Monitor): Promise<ScanOutcome> {
  const scannedAt = new Date().toISOString();
  const scanTargets: Array<Promise<{ findings: ScanFinding[]; version: string | null }>> = [
    scanUrl(monitor.apiUrl, "api-endpoint")
  ];

  if (monitor.docsUrl) {
    scanTargets.push(scanUrl(monitor.docsUrl, "documentation"));
  }

  if (monitor.changelogUrl) {
    scanTargets.push(scanUrl(monitor.changelogUrl, "changelog"));
  }

  const settled = await Promise.allSettled(scanTargets);
  const allFindings: ScanFinding[] = [];
  let detectedVersion: string | null = null;

  for (const result of settled) {
    if (result.status === "fulfilled") {
      allFindings.push(...result.value.findings);
      if (!detectedVersion && result.value.version) {
        detectedVersion = result.value.version;
      }
    } else {
      allFindings.push({
        type: "warning",
        severity: "medium",
        title: "Scanner could not reach one source",
        message: result.reason instanceof Error ? result.reason.message : "Unknown network error during scan.",
        source: "scanner"
      });
    }
  }

  if (monitor.lastKnownVersion && detectedVersion && monitor.lastKnownVersion !== detectedVersion) {
    allFindings.push({
      type: "version",
      severity: compareSemver(monitor.lastKnownVersion, detectedVersion),
      title: "API version changed",
      message: `Version changed from ${monitor.lastKnownVersion} to ${detectedVersion}.`,
      source: "version-tracker"
    });
  }

  const findings = dedupeFindings(allFindings);
  const severity = getHighestSeverity(findings);
  const status = toStatus(severity);
  const summary = buildSummary(findings, status);
  const fingerprint = computeFingerprint({ version: detectedVersion, findings });

  return {
    scannedAt,
    version: detectedVersion,
    fingerprint,
    findings,
    summary,
    status
  };
}

function toAlertInputs(monitor: Monitor, outcome: ScanOutcome): CreateAlertInput[] {
  return outcome.findings.slice(0, 5).map((finding) => ({
    monitorId: monitor.id,
    ownerEmail: monitor.ownerEmail,
    type: mapFindingToAlertType(finding.type),
    severity: finding.severity,
    title: `${monitor.name}: ${finding.title}`,
    message: finding.message,
    details: `Source: ${finding.source}`
  }));
}

export async function scanAndPersistMonitor(monitor: Monitor): Promise<ScanExecutionResult> {
  const outcome = await scanMonitor(monitor);
  const changed = outcome.fingerprint !== monitor.lastFingerprint;

  const createdAlerts: Alert[] = [];
  if (changed && outcome.findings.length > 0) {
    const alertInputs = toAlertInputs(monitor, outcome);
    for (const input of alertInputs) {
      createdAlerts.push(await createAlert(input));
    }
  }

  await updateMonitorScanSnapshot({
    monitorId: monitor.id,
    lastScannedAt: outcome.scannedAt,
    lastKnownVersion: outcome.version,
    lastFingerprint: outcome.fingerprint,
    lastScanStatus: outcome.status,
    lastScanMessage: outcome.summary
  });

  if (createdAlerts.length > 0) {
    await sendAlertNotifications(monitor, createdAlerts);
  }

  return {
    monitorId: monitor.id,
    monitorName: monitor.name,
    scannedAt: outcome.scannedAt,
    changed,
    status: outcome.status,
    summary: outcome.summary,
    version: outcome.version,
    alertsCreated: createdAlerts.length
  };
}

export function validateCronExpression(expression: string): boolean {
  try {
    CronJob.from({
      cronTime: expression,
      onTick: () => undefined,
      start: false
    });
    return true;
  } catch {
    return false;
  }
}
