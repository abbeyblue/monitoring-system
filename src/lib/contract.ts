// Shared monitoring-data contract. Every monitoring API response carries
// freshness + source metadata so the UI can render honest state and never show
// a cached/old value as if it were live. An error is NEVER coerced to a number.
import type { CrmStatus } from "@/lib/crm";

export type SourceState = "live" | "cached" | "stale" | "not-configured" | "error";

export interface Freshness {
  source: string;
  generatedAt: string;   // ISO — when this snapshot was computed
  fromCache: boolean;
  refreshMs: number;
  configured: boolean;
}

export function freshnessState(f: Freshness, now = Date.now()): SourceState {
  if (!f.configured) return "not-configured";
  const ageMs = now - new Date(f.generatedAt).getTime();
  if (ageMs > f.refreshMs * 2) return "stale";
  return f.fromCache ? "cached" : "live";
}

// ---- the common per-KPI result adapters return (§4) ----
export type Health = "healthy" | "degraded" | "critical" | "unknown";

export interface KpiResult {
  id: string;
  label: string;
  value: string;         // display value, "—" when not available
  sub?: string;          // secondary caption
  raw: number | null;    // numeric value, or null (never 0-on-error)
  unit?: string;
  health: Health;
  status: CrmStatus;     // ok | empty | not-configured | unauthorized | ... | error
  source: string;        // which CRM endpoint produced it
  lastUpdated: string;   // ISO
  cachedAt?: string | null;
  stale: boolean;
  refreshInterval: number;
  error?: string;
  groups: string[];      // KPI groups for RBAC scoping
  tier: 1 | 2 | 3;
  drillPath?: string;    // CRM page path for drill-down
}

/** True when a status means "we have no trustworthy value" (UI shows "—"). */
export const isUnavailable = (s: CrmStatus) => s !== "ok";
