// Composes the read-only KPI adapters into one role-scoped, cached snapshot.
// Presentation code consumes this — never CRM response shapes directly (§4).
import { crmConfigured, crmAuthConfigured, crmBase } from "@/lib/crm";
import { getRole, kpiGroupsFor, type MonitorRole } from "@/lib/roles";
import {
  getExecutiveKpis, getSupportKpis, getFinancialKpis, getSecurityKpis,
  getSalesKpis, getTeamKpis, getDataIntegrityKpis,
} from "@/lib/adapters";
import type { KpiResult } from "@/lib/contract";

export const BIZ_REFRESH_MS = 60_000;
const TTL = 60_000;

export interface BizSnapshot {
  configured: boolean; authConfigured: boolean; crmBase: string | null;
  generatedAt: string; fromCache: boolean; refreshMs: number; period: string; kpis: KpiResult[];
}

const cache = new Map<string, { at: number; snap: BizSnapshot }>();

export async function getBusinessSnapshot(period = "month", role: MonitorRole = getRole()): Promise<BizSnapshot> {
  const key = `biz:${period}:${role}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return { ...hit.snap, fromCache: true };

  const groups = await Promise.all([
    getExecutiveKpis(period), getSupportKpis(), getFinancialKpis(), getSecurityKpis(),
    getSalesKpis(), getTeamKpis(), getDataIntegrityKpis(),
  ]);
  const all = groups.flat();

  // role-based scoping: a role only receives its permitted KPI groups (§9).
  const allowed = kpiGroupsFor(role);
  const kpis = allowed === "all" ? all : all.filter((k) => k.groups.some((g) => (allowed as string[]).includes(g)));

  const snap: BizSnapshot = {
    configured: crmConfigured(), authConfigured: crmAuthConfigured(), crmBase: crmBase() || null,
    generatedAt: new Date().toISOString(), fromCache: false, refreshMs: TTL, period, kpis,
  };
  cache.set(key, { at: Date.now(), snap });
  return snap;
}

// Map a KPI health to the alerting engine's 4-state (real data only).
export function kpiAlertHealth(h: "healthy" | "degraded" | "critical" | "unknown"): "ok" | "warn" | "down" | "idle" {
  return h === "healthy" ? "ok" : h === "degraded" ? "warn" : h === "critical" ? "down" : "idle";
}
