// Central, configurable business-alert threshold definitions (§8). Adapters read
// thresholds from here (single source of truth). Rules whose source KPI is not
// yet implemented are listed with source:"pending" so nothing fires on data we
// don't actually compute. Override any threshold via
//   MONITOR_THRESH_<KPI_ID_UPPER_SNAKE>="warn,crit"  (e.g. MONITOR_THRESH_OUTSTANDING="60000,200000")
export interface AlertRule {
  id: string;            // matches a KPI id when implemented
  label: string;
  rule: string;          // human-readable condition
  warn: number;
  crit: number;
  severityTier: 1 | 2 | 3;
  source: string;        // CRM endpoint, or "pending" if not yet wired
  implemented: boolean;
}

const RAW: AlertRule[] = [
  { id: "outstanding", label: "Outstanding payment spike", rule: "outstanding ≥ threshold", warn: 50000, crit: 150000, severityTier: 1, source: "/api/payment-followup", implemented: true },
  { id: "urgent-followups", label: "Urgent follow-ups", rule: "count ≥ threshold", warn: 5, crit: 20, severityTier: 2, source: "/api/payment-followup", implemented: true },
  { id: "overdue-deadlines", label: "SLA / deadline breach", rule: "overdue cases ≥ threshold", warn: 1, crit: 10, severityTier: 1, source: "/api/tickets/deadlines", implemented: true },
  { id: "stagnant-cases", label: "Stagnant-case spike", rule: "stagnant ≥ threshold", warn: 5, crit: 25, severityTier: 2, source: "/api/governance/stagnant", implemented: true },
  { id: "service-inbox", label: "Service-request backlog", rule: "pending ≥ threshold", warn: 10, crit: 40, severityTier: 3, source: "/api/service-requests/inbox", implemented: true },
  { id: "failed-logins", label: "Failed-login spike", rule: "24h failures ≥ threshold", warn: 25, crit: 100, severityTier: 2, source: "/api/super-admin/security-overview", implemented: true },
  // Defined but not yet wired to a computed KPI (no fabricated firing):
  { id: "revenue-drop", label: "Revenue drop vs previous period", rule: "% drop ≥ threshold", warn: 10, crit: 25, severityTier: 1, source: "pending", implemented: false },
  { id: "conversion-drop", label: "Conversion-rate drop", rule: "% drop ≥ threshold", warn: 10, crit: 25, severityTier: 2, source: "pending (funnel Sankey)", implemented: false },
  { id: "missed-clockins", label: "Missed clock-in spike", rule: "count ≥ threshold", warn: 3, crit: 10, severityTier: 3, source: "pending (hr/attendance)", implemented: false },
  { id: "reconciliation-failure", label: "Payment reconciliation failure", rule: "failures ≥ threshold", warn: 1, crit: 1, severityTier: 1, source: "pending (cron reconcile)", implemented: false },
  { id: "duplicate-spike", label: "Duplicate-record spike", rule: "count ≥ threshold", warn: 5, crit: 20, severityTier: 3, source: "pending (no board-count endpoint)", implemented: false },
  { id: "crm-integration-failure", label: "CRM integration failure", rule: "KPI source unreachable", warn: 1, crit: 1, severityTier: 1, source: "monitor (crmFetch status)", implemented: true },
  { id: "stale-kpi", label: "Stale KPI data", rule: "age ≥ 2× refresh", warn: 1, crit: 1, severityTier: 2, source: "monitor (freshness)", implemented: true },
];

function envOverride(id: string): { warn: number; crit: number } | null {
  const key = "MONITOR_THRESH_" + id.replace(/-/g, "_").toUpperCase();
  const v = process.env[key];
  if (!v) return null;
  const [w, c] = v.split(",").map((n) => Number(n.trim()));
  return Number.isFinite(w) && Number.isFinite(c) ? { warn: w, crit: c } : null;
}

export const ALERT_RULES: AlertRule[] = RAW.map((r) => ({ ...r, ...(envOverride(r.id) ?? {}) }));

export function thresh(id: string): { warn: number; crit: number } {
  const r = ALERT_RULES.find((x) => x.id === id);
  return r ? { warn: r.warn, crit: r.crit } : { warn: Infinity, crit: Infinity };
}
