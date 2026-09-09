import { NextResponse } from "next/server";
import {
  CRM_BASE_URL, HTTP_CHECKS, AUTHED_CHECKS, MONITOR_SESSION_COOKIE,
  CRON_JOBS, DEPENDENCIES, KNOWN_UNPROBED, type Health,
} from "@/lib/config";
import { nextFire, prevFire } from "@/lib/cron";
import { getCloudWatch } from "@/lib/aws";
import { readHeartbeats, pushLatency, storageKind } from "@/lib/store";
import { runAlerts, type CheckResult } from "@/lib/alerts";
import { getBusinessSnapshot, kpiAlertHealth } from "@/lib/business";
import { appendKpiPoints } from "@/lib/history";

export const dynamic = "force-dynamic";
export const revalidate = 0;

async function probe(url: string, okStatus: number[], keyword?: string, cookie?: string, timeoutMs = 8000) {
  const started = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal, cache: "no-store", redirect: "manual",
      headers: cookie ? { cookie } : undefined,
    });
    const latency = Date.now() - started;
    const statusOk = okStatus.includes(res.status);
    let keywordOk = true;
    if (statusOk && keyword) keywordOk = (await res.text()).includes(keyword);
    const health: Health = statusOk && keywordOk ? "ok" : "down";
    return { health, httpStatus: res.status, latency, detail: keyword && !keywordOk ? `missing "${keyword}"` : undefined };
  } catch (e) {
    return { health: "down" as Health, httpStatus: 0, latency: Date.now() - started,
      detail: e instanceof Error && e.name === "AbortError" ? "timeout" : "unreachable" };
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const now = new Date();
  const nowMs = now.getTime();

  // --- public endpoint checks ---
  const endpoints = await Promise.all(
    HTTP_CHECKS.map(async (c) => {
      const r = await probe(CRM_BASE_URL + c.path, c.okStatus, c.keyword);
      if (r.health !== "down") await pushLatency(c.id, r.latency);
      return { id: c.id, label: c.label, path: c.path, tier: c.tier, note: c.note, authed: false, ...r };
    })
  );

  // --- authenticated staff checks (need synthetic session cookie) ---
  const cookieConfigured = Boolean(MONITOR_SESSION_COOKIE);
  const authed = await Promise.all(
    AUTHED_CHECKS.map(async (c) => {
      if (!cookieConfigured) {
        return { id: c.id, label: c.label, path: c.path, tier: c.tier, authed: true,
          health: "idle" as Health, httpStatus: 0, latency: 0, detail: "session cookie not set" };
      }
      const r = await probe(CRM_BASE_URL + c.path, c.okStatus, c.keyword, MONITOR_SESSION_COOKIE);
      if (r.health !== "down") await pushLatency(c.id, r.latency);
      return { id: c.id, label: c.label, path: c.path, tier: c.tier, authed: true, note: c.note, ...r };
    })
  );

  // --- cron jobs: schedule + optional heartbeat ---
  const heartbeats = await readHeartbeats();
  const crons = CRON_JOBS.map((c) => {
    const last = c.schedule ? prevFire(c.schedule, now)?.toISOString() ?? null : null;
    const next = c.schedule ? nextFire(c.schedule, now)?.toISOString() ?? null : null;
    const beat = heartbeats[c.id] ?? null;
    let health: Health = "idle";
    if (beat && last) health = new Date(beat).getTime() >= new Date(last).getTime() ? "ok" : "down";
    else if (!c.schedule) health = "warn";
    return { id: c.id, label: c.label, path: c.path, tier: c.tier, schedule: c.schedule,
      lastExpected: last, nextExpected: next, lastHeartbeat: beat, health, note: c.note };
  });

  // --- external dependencies ---
  const deps = await Promise.all(
    DEPENDENCIES.map(async (d) => {
      if (!d.statusApi) return { id: d.id, label: d.label, tier: d.tier, health: "idle" as Health, note: d.note };
      try {
        const res = await fetch(d.statusApi, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        const json = await res.json();
        const indicator: string = json?.status?.indicator ?? "unknown";
        const description: string = json?.status?.description ?? "";
        const health: Health = indicator === "none" ? "ok" : indicator === "critical" ? "down" : "warn";
        return { id: d.id, label: d.label, tier: d.tier, health, detail: description, indicator };
      } catch {
        return { id: d.id, label: d.label, tier: d.tier, health: "warn" as Health, detail: "status API unreachable" };
      }
    })
  );

  // --- CloudWatch (alarms, metrics, error logs, failed-cron detection) ---
  const cloudwatch = await getCloudWatch(nowMs);

  // --- business-threshold checks: real CRM KPIs folded into the SAME engine ---
  // Only KPIs with real data (status ok) become alertable; not-configured /
  // unauthorized KPIs are skipped so we never alert on missing data.
  // Alert detection is SYSTEM-WIDE (full scope), independent of any viewer's role.
  const bizSnap = await getBusinessSnapshot("month", "super-admin");
  const bizChecks: CheckResult[] = bizSnap.kpis
    .filter((k) => k.status === "ok")
    .map((k) => ({ id: `biz:${k.id}`, label: k.label, tier: k.tier as 1 | 2 | 3, health: kpiAlertHealth(k.health), detail: k.value }));
  // persist real KPI points for history (no-op until KPIs are actually ok)
  void appendKpiPoints(bizSnap.kpis);

  // --- alerting: fold every signal into the incident engine ---
  const alertInput: CheckResult[] = [
    ...bizChecks,
    ...endpoints.map((e) => ({ id: e.id, label: e.label, tier: e.tier, health: e.health, detail: e.detail })),
    ...authed.map((e) => ({ id: e.id, label: e.label, tier: e.tier, health: e.health, detail: e.detail })),
    ...deps.map((d) => ({ id: `dep:${d.id}`, label: d.label, tier: d.tier, health: d.health, detail: (d as { detail?: string }).detail })),
    ...cloudwatch.cronRuns.map((c) => ({ id: `cron:${c.id}`, label: `cron ${c.label}`, tier: (CRON_JOBS.find((x) => x.id === c.id)?.tier ?? 3), health: c.health, detail: c.evidence })),
    ...cloudwatch.metrics.map((m) => ({ id: `metric:${m.id}`, label: m.label, tier: m.tier as 1 | 2 | 3, health: m.health, detail: m.latest != null ? `${m.latest}${m.unit ?? ""}` : undefined })),
    ...cloudwatch.alarms.map((a) => ({ id: `alarm:${a.name}`, label: `alarm ${a.name}`, tier: 1 as const, health: a.health, detail: a.reason })),
  ];
  const alerts = await runAlerts(alertInput, now.toISOString());

  const all: { health: Health }[] = [...endpoints, ...authed, ...deps, ...crons, ...cloudwatch.metrics, ...cloudwatch.cronRuns, ...cloudwatch.alarms];
  const summary = {
    ok: all.filter((x) => x.health === "ok").length,
    warn: all.filter((x) => x.health === "warn").length,
    down: all.filter((x) => x.health === "down").length,
    idle: all.filter((x) => x.health === "idle").length,
  };

  return NextResponse.json(
    {
      crmBase: CRM_BASE_URL, checkedAt: now.toISOString(), summary,
      endpoints, authed, authConfigured: cookieConfigured,
      crons, deps, cloudwatch,
      incidents: { active: alerts.active, opened: alerts.opened.length, resolved: alerts.resolved.length },
      silences: alerts.silences, storage: storageKind(),
      knownUnprobed: KNOWN_UNPROBED,
    },
    { headers: { "cache-control": "no-store" } }
  );
}
