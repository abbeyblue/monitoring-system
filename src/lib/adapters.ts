// Read-only KPI adapters (§4). Each adapter owns the raw CRM response shape for
// its domain and returns the common KpiResult contract, so presentation code
// never sees CRM shapes. Adapters for domains whose response shape is NOT yet
// verified return [] (nothing) rather than fabricated values.
//
// Every shape used here was read from the CRM source (see crm-registry.ts
// shapeVerified=true). raw is null on any non-ok status — an error is never 0.
import { crmFetch, type CrmStatus } from "@/lib/crm";
import { currencySymbol } from "@/lib/config";
import { thresh } from "@/lib/alert-rules";
import type { KpiResult, Health } from "@/lib/contract";

const now = () => new Date().toISOString();
const money = (n: number) => currencySymbol() + Math.round(n).toLocaleString();
// health from the central threshold registry (single source of truth)
const byRule = (id: string, n: number): Health => { const t = thresh(id); return n >= t.crit ? "critical" : n >= t.warn ? "degraded" : "healthy"; };

interface KpiSpec {
  id: string; label: string; groups: string[]; tier: 1 | 2 | 3; drillPath: string; source: string; refreshMs: number;
}
function kpi(spec: KpiSpec, status: CrmStatus, compute: () => { value: string; raw: number | null; sub?: string; health: Health; unit?: string }): KpiResult {
  const base = {
    id: spec.id, label: spec.label, groups: spec.groups, tier: spec.tier, drillPath: spec.drillPath,
    source: spec.source, lastUpdated: now(), cachedAt: null as string | null, refreshInterval: spec.refreshMs,
  };
  if (status !== "ok") return { ...base, status, value: "—", raw: null, health: "unknown", stale: status !== "not-configured" && status !== "empty" };
  const c = compute();
  return { ...base, status, stale: false, ...c };
}

// ---- Executive (real) ----
export async function getExecutiveKpis(period = "month"): Promise<KpiResult[]> {
  const rev = await crmFetch<{ paidRevenue: number; outstanding: number; ticketCount: number }>(`/api/analytics/revenue?period=${encodeURIComponent(period)}`);
  const src = "/api/analytics/revenue";
  return [
    kpi({ id: "revenue-mtd", label: "Revenue (MTD)", groups: ["executive", "financial"], tier: 1, drillPath: "/super-admin/operations/revenue", source: src, refreshMs: 60000 },
      rev.status, () => { const d = rev.data!; return { value: money(d.paidRevenue), raw: d.paidRevenue, sub: `${d.ticketCount} cases · ${money(d.outstanding)} outstanding`, health: "healthy", unit: currencySymbol() }; }),
  ];
}

// ---- Support (real) ----
export async function getSupportKpis(): Promise<KpiResult[]> {
  const [dead, stag, inbox] = await Promise.all([
    crmFetch<{ cases: { deadlineInfo: { daysRemaining: number } | null }[] }>("/api/tickets/deadlines"),
    crmFetch<{ tickets: unknown[] }>("/api/governance/stagnant"),
    crmFetch<{ tasks: unknown[] }>("/api/service-requests/inbox?scope=pending"),
  ]);
  return [
    kpi({ id: "overdue-deadlines", label: "Overdue deadlines", groups: ["executive", "support"], tier: 1, drillPath: "/super-admin/deadlines", source: "/api/tickets/deadlines", refreshMs: 60000 },
      dead.status, () => { const cs = dead.data!.cases; const o = cs.filter((c) => (c.deadlineInfo?.daysRemaining ?? 999) < 0).length; return { value: String(o), raw: o, sub: `${cs.length} active with deadlines`, health: byRule("overdue-deadlines", o) }; }),
    kpi({ id: "active-cases", label: "Active cases (w/ deadline)", groups: ["executive", "support"], tier: 2, drillPath: "/super-admin/deadlines", source: "/api/tickets/deadlines", refreshMs: 60000 },
      dead.status, () => { const n = dead.data!.cases.length; return { value: String(n), raw: n, sub: "open with a deadline", health: "healthy" }; }),
    kpi({ id: "stagnant-cases", label: "Stagnant cases (5d+)", groups: ["support"], tier: 2, drillPath: "/super-admin/case-board", source: "/api/governance/stagnant", refreshMs: 60000 },
      stag.status, () => { const n = stag.data!.tickets.length; return { value: String(n), raw: n, sub: "not updated 5+ days", health: byRule("stagnant-cases", n) }; }),
    kpi({ id: "service-inbox", label: "Service-request inbox", groups: ["support"], tier: 3, drillPath: "/super-admin/request-service", source: "/api/service-requests/inbox", refreshMs: 60000 },
      inbox.status, () => { const n = inbox.data!.tasks.length; return { value: String(n), raw: n, sub: "pending triage", health: byRule("service-inbox", n) }; }),
  ];
}

// ---- Financial (real) ----
export async function getFinancialKpis(): Promise<KpiResult[]> {
  const pay = await crmFetch<{ summary: { totalCases: number; totalOutstanding: number; urgentFollowups: number } }>("/api/payment-followup");
  const src = "/api/payment-followup";
  return [
    kpi({ id: "outstanding", label: "Outstanding payments", groups: ["executive", "financial"], tier: 1, drillPath: "/super-admin/payment-followup", source: src, refreshMs: 60000 },
      pay.status, () => { const s = pay.data!.summary; return { value: money(s.totalOutstanding), raw: s.totalOutstanding, sub: `${s.totalCases} cases`, health: byRule("outstanding", s.totalOutstanding), unit: currencySymbol() }; }),
    kpi({ id: "urgent-followups", label: "Urgent follow-ups", groups: ["financial"], tier: 2, drillPath: "/super-admin/payment-followup", source: src, refreshMs: 60000 },
      pay.status, () => { const s = pay.data!.summary; return { value: String(s.urgentFollowups), raw: s.urgentFollowups, sub: "need chasing", health: byRule("urgent-followups", s.urgentFollowups) }; }),
  ];
}

// ---- Security (real) ----
export async function getSecurityKpis(): Promise<KpiResult[]> {
  const sec = await crmFetch<{ stats: { failed24h: number; activeSessions: number } }>("/api/super-admin/security-overview");
  const src = "/api/super-admin/security-overview";
  return [
    kpi({ id: "failed-logins", label: "Failed logins (24h)", groups: ["security"], tier: 2, drillPath: "/super-admin/system/security", source: src, refreshMs: 60000 },
      sec.status, () => { const st = sec.data!.stats; return { value: String(st.failed24h), raw: st.failed24h, sub: "authentication", health: byRule("failed-logins", st.failed24h) }; }),
    kpi({ id: "active-sessions", label: "Active sessions", groups: ["security"], tier: 3, drillPath: "/super-admin/system/security", source: src, refreshMs: 60000 },
      sec.status, () => { const st = sec.data!.stats; return { value: String(st.activeSessions), raw: st.activeSessions, sub: "signed-in users", health: "healthy" }; }),
  ];
}

// ---- Not yet implemented (shape unverified) — return NOTHING, never fake ----
export async function getSalesKpis(): Promise<KpiResult[]> { return []; }       // funnel(Sankey)/leads-forecast/commission — shapes pending
export async function getTeamKpis(): Promise<KpiResult[]> { return []; }         // hr/attendance/leave/flex — shapes pending
export async function getDataIntegrityKpis(): Promise<KpiResult[]> { return []; } // no board-wide duplicate count endpoint exists
