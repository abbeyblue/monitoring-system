// Central registry of every CRM data source the monitoring board consumes.
// Existence, HTTP method, and guard were VERIFIED against the CRM codebase
// (~/Desktop/Abbey-blue-crm/src/app/api/**/route.ts). `requiredPermission` is
// the guard the CRM enforces — it defines the minimum the read-only monitoring
// identity needs. `shapeVerified` = the JSON response shape was read from source.
// `liveVerified` is ALWAYS false here: no live CRM has been connected.

export type Domain = "executive" | "support" | "governance" | "sales" | "team" | "financial" | "security";

export interface CrmEndpoint {
  path: string;
  method: "GET" | "POST";
  requiredPermission: string;   // CRM guard (requireService key / roles / task-assigner)
  domain: Domain;
  purpose: string;
  kpis: string[];               // KPI ids derived from this endpoint
  refreshMs: number;
  cache: "60s" | "300s" | "none";
  historical: boolean;          // should snapshots be persisted for trends?
  implemented: boolean;         // adapter reads it today
  shapeVerified: boolean;       // response shape read from CRM source
  liveVerified: boolean;        // true ONLY after a live response + values reconciled
  note?: string;
}

export const CRM_ENDPOINTS: CrmEndpoint[] = [
  // ---- Executive ----
  { path: "/api/analytics/revenue", method: "GET", requiredPermission: 'service:"revenue"', domain: "executive",
    purpose: "Revenue totals & outstanding", kpis: ["revenue-mtd", "outstanding-revenue"], refreshMs: 60000, cache: "60s", historical: true, implemented: true, shapeVerified: true, liveVerified: false },
  { path: "/api/analytics/revenue/trends", method: "GET", requiredPermission: 'service:"revenue"', domain: "executive",
    purpose: "Revenue trend series", kpis: ["revenue-trend"], refreshMs: 300000, cache: "300s", historical: true, implemented: false, shapeVerified: false, liveVerified: false, note: "shape not yet read" },
  { path: "/api/analytics/forecast", method: "GET", requiredPermission: 'service:"revenue"', domain: "executive",
    purpose: "Revenue forecast", kpis: ["revenue-forecast"], refreshMs: 300000, cache: "300s", historical: false, implemented: false, shapeVerified: false, liveVerified: false, note: "shape not yet read" },

  // ---- Support ----
  { path: "/api/tickets/board", method: "GET", requiredPermission: 'service:"caseBoard"', domain: "support",
    purpose: "Case kanban (approved/rejected)", kpis: [], refreshMs: 60000, cache: "60s", historical: false, implemented: false, shapeVerified: true, liveVerified: false, note: "board=approved+rejected, not 'active cases'" },
  { path: "/api/tickets/deadlines", method: "GET", requiredPermission: 'service:"deadlines"', domain: "support",
    purpose: "Active cases with deadlines", kpis: ["overdue-deadlines", "active-cases"], refreshMs: 60000, cache: "60s", historical: true, implemented: true, shapeVerified: true, liveVerified: true, note: "live-verified 2026-09-08 (sandbox): 3 active / 1 overdue reconciled against CRM" },
  { path: "/api/tickets/coverage", method: "GET", requiredPermission: "role:SUPER_ADMIN|SEMI_SUPER_ADMIN|ADMIN_MANAGER", domain: "support",
    purpose: "Case coverage", kpis: ["case-coverage"], refreshMs: 300000, cache: "300s", historical: false, implemented: false, shapeVerified: false, liveVerified: false },
  { path: "/api/service-requests/inbox", method: "GET", requiredPermission: "task-assigner", domain: "support",
    purpose: "Service-request triage backlog", kpis: ["service-inbox"], refreshMs: 60000, cache: "60s", historical: true, implemented: true, shapeVerified: true, liveVerified: false, note: "guard=task-assigner; super-admin service account may 403" },

  // ---- Governance ----
  { path: "/api/governance/stagnant", method: "GET", requiredPermission: "role:SUPER_ADMIN|SEMI_SUPER_ADMIN", domain: "governance",
    purpose: "Cases not updated 5+ days", kpis: ["stagnant-cases"], refreshMs: 60000, cache: "60s", historical: true, implemented: true, shapeVerified: true, liveVerified: false },
  { path: "/api/governance/duplicates", method: "POST", requiredPermission: "role:SALES|SUPER_ADMIN|SEMI_SUPER_ADMIN", domain: "governance",
    purpose: "Per-record duplicate lookup (NOT a board count)", kpis: [], refreshMs: 0, cache: "none", historical: false, implemented: false, shapeVerified: true, liveVerified: false, note: "POST per phone/email — no org-wide duplicate count available" },

  // ---- Sales ----
  { path: "/api/analytics/marketing/funnel", method: "GET", requiredPermission: 'service:"marketingOverview"', domain: "sales",
    purpose: "Source→caseType→status Sankey", kpis: ["conversion"], refreshMs: 300000, cache: "300s", historical: true, implemented: false, shapeVerified: true, liveVerified: false, note: "Sankey nodes/links; conversion must be derived" },
  { path: "/api/leads", method: "POST", requiredPermission: "authenticated", domain: "sales",
    purpose: "Create lead (NOT a list)", kpis: [], refreshMs: 0, cache: "none", historical: false, implemented: false, shapeVerified: true, liveVerified: false, note: "POST only — cannot source lead counts here" },
  { path: "/api/analytics/leads-forecast", method: "GET", requiredPermission: "authenticated", domain: "sales",
    purpose: "Lead volume & forecast", kpis: ["lead-volume", "lead-forecast"], refreshMs: 300000, cache: "300s", historical: true, implemented: false, shapeVerified: false, liveVerified: false, note: "shape not yet read" },
  { path: "/api/analytics/marketing/source-attribution", method: "GET", requiredPermission: 'service:"leadSources"', domain: "sales",
    purpose: "Lead source attribution", kpis: ["source-attribution"], refreshMs: 300000, cache: "300s", historical: false, implemented: false, shapeVerified: false, liveVerified: false },
  { path: "/api/sales/commission-summary", method: "GET", requiredPermission: "authenticated", domain: "sales",
    purpose: "Commission summary", kpis: ["commission"], refreshMs: 300000, cache: "300s", historical: false, implemented: false, shapeVerified: false, liveVerified: false },
  { path: "/api/sales/commission-statement", method: "GET", requiredPermission: "authenticated", domain: "sales",
    purpose: "Commission statement", kpis: [], refreshMs: 300000, cache: "300s", historical: false, implemented: false, shapeVerified: false, liveVerified: false },

  // ---- Team / HR ----
  { path: "/api/hr/attendance", method: "GET", requiredPermission: "role:any-authenticated", domain: "team",
    purpose: "Attendance / clock-ins", kpis: ["attendance-compliance", "missed-clockins"], refreshMs: 300000, cache: "300s", historical: true, implemented: false, shapeVerified: false, liveVerified: false, note: "594-line handler; shape not yet read" },
  { path: "/api/hr/leave", method: "GET", requiredPermission: "authenticated", domain: "team",
    purpose: "Leave", kpis: ["on-leave"], refreshMs: 300000, cache: "300s", historical: false, implemented: false, shapeVerified: false, liveVerified: false },
  { path: "/api/hr/flex-hours", method: "GET", requiredPermission: "role:SUPER_ADMIN|SEMI_SUPER_ADMIN", domain: "team",
    purpose: "Flex hours", kpis: ["flex-hours"], refreshMs: 300000, cache: "300s", historical: false, implemented: false, shapeVerified: false, liveVerified: false },
  { path: "/api/hr/evaluations", method: "GET", requiredPermission: "role:UPLOAD_ROLES", domain: "team",
    purpose: "Evaluations", kpis: ["evaluations"], refreshMs: 300000, cache: "300s", historical: false, implemented: false, shapeVerified: false, liveVerified: false },

  // ---- Financial ----
  { path: "/api/payment-followup", method: "GET", requiredPermission: 'service:"paymentFollowup"', domain: "financial",
    purpose: "Outstanding & follow-ups", kpis: ["outstanding", "urgent-followups"], refreshMs: 60000, cache: "60s", historical: true, implemented: true, shapeVerified: true, liveVerified: false },
  { path: "/api/refunds", method: "GET", requiredPermission: 'service:"refunds"', domain: "financial",
    purpose: "Refunds", kpis: ["refunds"], refreshMs: 300000, cache: "300s", historical: true, implemented: false, shapeVerified: false, liveVerified: false },
  { path: "/api/finance/expenses", method: "GET", requiredPermission: 'service:"finance"', domain: "financial",
    purpose: "Expenses", kpis: ["expenses"], refreshMs: 300000, cache: "300s", historical: true, implemented: false, shapeVerified: false, liveVerified: false },
  { path: "/api/payroll/commission", method: "GET", requiredPermission: 'service:"payroll"', domain: "financial",
    purpose: "Payroll commission", kpis: ["payroll-commission"], refreshMs: 300000, cache: "300s", historical: false, implemented: false, shapeVerified: false, liveVerified: false, note: "payroll — super-admin/finance only" },
  { path: "/api/payroll/history", method: "GET", requiredPermission: 'service:"payroll"', domain: "financial",
    purpose: "Payroll history", kpis: [], refreshMs: 300000, cache: "300s", historical: false, implemented: false, shapeVerified: false, liveVerified: false },

  // ---- Security ----
  { path: "/api/analytics/audit-logs", method: "GET", requiredPermission: 'service:"auditLogs"', domain: "security",
    purpose: "Audit trail", kpis: ["audit-events"], refreshMs: 300000, cache: "300s", historical: true, implemented: false, shapeVerified: false, liveVerified: false },
  { path: "/api/super-admin/security-overview", method: "GET", requiredPermission: 'service:"security"', domain: "security",
    purpose: "Auth failures & sessions", kpis: ["failed-logins", "active-sessions"], refreshMs: 60000, cache: "60s", historical: true, implemented: true, shapeVerified: true, liveVerified: false },
];

/** The distinct CRM read-permissions the monitoring identity must be granted. */
export function requiredReadPermissions(): string[] {
  return Array.from(new Set(CRM_ENDPOINTS.filter((e) => e.implemented).map((e) => e.requiredPermission))).sort();
}
