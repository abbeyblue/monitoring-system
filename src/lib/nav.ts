// Single source of truth for navigation, page titles and route authorization.
//
// Pure data (no JSX) so the server, the client shell and the vitest suite can
// all import it — vitest globs src/**/*.test.ts in a node environment, so this
// deliberately lives in lib/ rather than inside the shell component.
//
// Topology: "/" is the cross-service System Overview and "/crm" is the CRM's
// own overview. Sections that span every monitored system live at the root;
// only CRM-specific pages sit under /crm/. Every page the app had before is
// still reachable — pages that aren't a section landing are tabs within one.

import type { MonitorRole } from "./roles";

export type Kind = "overall" | "probes" | "business" | "incidents" | "mock" | "none";

export interface Tab {
  href: string;
  label: string;
  kind: Kind;
}

export interface Section {
  id: string;
  label: string;            // sidebar label
  group: "Monitoring" | "Operations";
  title: string;            // <h1> in the shell header
  sub: string;              // subtitle under the <h1>
  href: string;             // landing route
  kind: Kind;               // drives the live status dot
  tabs: Tab[];              // empty when the section is a single page
}

export const SECTIONS: Section[] = [
  {
    id: "overview", label: "Overview", group: "Monitoring",
    title: "System Overview", sub: "Live operational health across Abbey Blue services.",
    href: "/", kind: "overall", tabs: [],
  },
  {
    id: "crm", label: "CRM", group: "Monitoring",
    title: "CRM Monitoring", sub: "Availability, performance and activity for the Abbey Blue CRM.",
    href: "/crm", kind: "business",
    tabs: [
      { href: "/crm", label: "Overview", kind: "business" },
      { href: "/crm/business-health", label: "Business Health", kind: "business" },
      { href: "/crm/customers", label: "Customers", kind: "business" },
      { href: "/crm/leads", label: "Leads", kind: "mock" },
      { href: "/crm/opportunities", label: "Opportunities", kind: "mock" },
      { href: "/crm/background-jobs", label: "Background Jobs", kind: "mock" },
      { href: "/crm/webhooks", label: "Webhooks", kind: "mock" },
    ],
  },
  {
    id: "users", label: "Users", group: "Monitoring",
    title: "User Monitoring", sub: "Session and authentication activity across the CRM.",
    href: "/users", kind: "none",
    tabs: [
      { href: "/users", label: "Sessions", kind: "none" },
      { href: "/security-events", label: "Security Events", kind: "mock" },
      { href: "/audit-logs", label: "Audit Logs", kind: "mock" },
    ],
  },
  {
    id: "websites", label: "Websites", group: "Monitoring",
    title: "Website Monitoring", sub: "Outward-facing sites checked on every status poll.",
    href: "/websites", kind: "none", tabs: [],
  },
  {
    id: "services", label: "Services", group: "Monitoring",
    title: "Services", sub: "Supporting services and third-party integrations.",
    href: "/service-health", kind: "probes",
    tabs: [
      { href: "/service-health", label: "Service Health", kind: "probes" },
      { href: "/apis", label: "APIs", kind: "probes" },
      { href: "/metrics", label: "Metrics", kind: "mock" },
      { href: "/infrastructure", label: "Infrastructure", kind: "mock" },
      { href: "/databases", label: "Databases", kind: "mock" },
      { href: "/queues", label: "Queues", kind: "mock" },
      { href: "/integrations", label: "Integrations", kind: "mock" },
      { href: "/slo", label: "SLO / SLA", kind: "mock" },
      { href: "/capacity", label: "Capacity", kind: "mock" },
    ],
  },
  {
    id: "incidents", label: "Incidents", group: "Operations",
    title: "Incidents", sub: "Detected automatically from health checks and thresholds.",
    href: "/incidents", kind: "incidents",
    tabs: [
      { href: "/incidents", label: "Incidents", kind: "incidents" },
      { href: "/alerts", label: "Alerts", kind: "mock" },
      { href: "/alert-rules", label: "Alert Rules", kind: "mock" },
      { href: "/deployments", label: "Deployments", kind: "mock" },
      { href: "/runbooks", label: "Runbooks", kind: "mock" },
    ],
  },
  {
    id: "logs", label: "Logs", group: "Operations",
    title: "Logs", sub: "Operational events across all monitored systems.",
    href: "/logs", kind: "mock",
    tabs: [
      { href: "/logs", label: "Logs", kind: "mock" },
      { href: "/traces", label: "Traces", kind: "mock" },
    ],
  },
  {
    id: "settings", label: "Settings", group: "Operations",
    title: "Settings", sub: "Monitored endpoints, thresholds and notifications.",
    href: "/settings", kind: "none",
    tabs: [
      { href: "/settings", label: "Settings", kind: "none" },
      { href: "/diagnostics", label: "Diagnostics", kind: "none" },
      { href: "/monitoring-health", label: "Monitoring Health", kind: "mock" },
      { href: "/cost", label: "Cost", kind: "mock" },
    ],
  },
];

/** Every routable href, section landings and tabs, de-duplicated. */
export const ALL_HREFS: string[] = Array.from(
  new Set(SECTIONS.flatMap((s) => [s.href, ...s.tabs.map((t) => t.href)])),
);

// "/" and "/crm" are landing pages whose children are registered separately, so
// they match exactly. Prefix-matching either would swallow every nested route.
const EXACT = new Set(["/", "/crm"]);
const matches = (path: string, href: string) =>
  EXACT.has(href) ? path === href : path === href || path.startsWith(href + "/");

/** Section owning a pathname — longest href wins so /apis beats /. */
export function sectionFor(path: string): Section {
  let best = SECTIONS[0];
  let bestLen = -1;
  for (const s of SECTIONS) {
    for (const href of [s.href, ...s.tabs.map((t) => t.href)]) {
      if (matches(path, href) && href.length > bestLen) { best = s; bestLen = href.length; }
    }
  }
  return best;
}

/** Active tab within a section, or null when the section is a single page. */
export function tabFor(section: Section, path: string): Tab | null {
  let best: Tab | null = null;
  for (const t of section.tabs) {
    if (matches(path, t.href) && (!best || t.href.length > best.href.length)) best = t;
  }
  return best;
}

/** Does this path resolve to a real route (a landing, a tab, or a detail page)? */
export function isCanonical(path: string): boolean {
  return ALL_HREFS.some((h) => matches(path, h));
}

/**
 * Legacy URL -> its canonical form, or null when no redirect is needed.
 *
 * Covers both directions with one rule: a path that isn't canonical is retried
 * with /crm added or removed, and only accepted if THAT form is real. So
 * /crm/incidents -> /incidents and /customers -> /crm/customers, while
 * /crm/customers, /incidents/INC-1042, / and /crm are left alone. Returning
 * null for anything already canonical is what prevents a redirect loop.
 */
export function canonicalPath(path: string): string | null {
  if (isCanonical(path)) return null;
  const alt = path.startsWith("/crm/") ? path.slice(4) : `/crm${path}`;
  return isCanonical(alt) ? alt : null;
}

// ---- Route authorization (single source of truth) ----
// Consumed by roles.ts (server guard in proxy.ts, the real boundary) AND by the
// client shell for hiding links. Kept here, free of process.env access, so the
// client can import it without pulling secret-reading code into the bundle.
// These must match real routes or the guard silently stops matching and
// restricted pages become reachable. nav.test.ts pins this.
export const HIDDEN_NAV: Record<MonitorRole, string[]> = {
  "super-admin": [],
  finance: ["/security-events", "/audit-logs"],
  sales: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
  marketing: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
  hr: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
  support: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
};
