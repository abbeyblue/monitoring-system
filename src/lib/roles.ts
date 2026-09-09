// Role-based data scoping. The monitor authenticates to the CRM as ONE service
// account, so per-viewer authorization is enforced HERE. This is the scoping
// model; wiring real per-user login (mapping a CRM login/SSO identity to one of
// these roles) is the remaining piece — until then MONITOR_ROLE sets the single
// operator's role (default super-admin). Roles mirror the CRM's own roles.
export type KpiGroup = "executive" | "financial" | "support" | "security" | "sales" | "team";

export type MonitorRole = "super-admin" | "finance" | "sales" | "marketing" | "hr" | "support";
export const ROLES: MonitorRole[] = ["super-admin", "finance", "sales", "marketing", "hr", "support"];

// Which business-KPI groups each role may receive (server-enforced).
const KPI_GROUPS: Record<MonitorRole, KpiGroup[] | "all"> = {
  "super-admin": "all",
  finance: ["executive", "financial"],
  sales: ["executive", "sales"],
  marketing: ["executive", "sales"],
  hr: ["team"],
  support: ["executive", "support"],
};

// Nav hrefs hidden per role (sensitive areas). super-admin sees everything.
const HIDDEN_NAV: Record<MonitorRole, string[]> = {
  "super-admin": [],
  finance: ["/security-events", "/audit-logs"],
  sales: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
  marketing: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
  hr: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
  support: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
};

export function getRole(): MonitorRole {
  const r = (process.env.MONITOR_ROLE ?? "super-admin") as MonitorRole;
  return ROLES.includes(r) ? r : "super-admin";
}

export function asRole(s: string | null | undefined): MonitorRole | null {
  return s && (ROLES as string[]).includes(s) ? (s as MonitorRole) : null;
}

// ---- Per-user identity (smallest step beyond global MONITOR_ROLE) ----
// MONITOR_USERS = "user:pass:role,user2:pass2:role2" (passwords may not contain ':').
// When set, the authenticated Basic-Auth user determines the role — so route
// access AND data scoping derive from the SAME authenticated identity, rather
// than one global env var. (Still monitor-local identity, not CRM SSO.)
export interface MonitorUser { user: string; pass: string; role: MonitorRole; }
export function parseUsers(): Map<string, MonitorUser> {
  const map = new Map<string, MonitorUser>();
  for (const entry of (process.env.MONITOR_USERS ?? "").split(",").map((s) => s.trim()).filter(Boolean)) {
    const [user, pass, role] = entry.split(":");
    const r = asRole(role);
    if (user && pass && r) map.set(user, { user, pass, role: r });
  }
  return map;
}
export function verifyUser(user: string, pass: string): MonitorUser | null {
  const u = parseUsers().get(user);
  return u && u.pass === pass ? u : null;
}

export function kpiGroupsFor(role: MonitorRole): KpiGroup[] | "all" {
  return KPI_GROUPS[role];
}

export function canSeeNav(role: MonitorRole, href: string): boolean {
  return !HIDDEN_NAV[role].includes(href);
}

// Server-side route authorization (used by middleware — the real boundary).
// A path is blocked if it equals, or is nested under, any hidden nav href.
export function routeAllowed(role: MonitorRole, path: string): boolean {
  return !HIDDEN_NAV[role].some((h) => path === h || path.startsWith(h + "/"));
}
