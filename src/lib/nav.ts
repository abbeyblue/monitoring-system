// Single source of truth for navigation, page titles and route authorization.
//
// Pure data (no JSX) so the server, the client shell and the vitest suite can
// all import it — vitest globs src/**/*.test.ts in a node environment, so this
// deliberately lives in lib/ rather than inside the shell component.
//
// The eight sections mirror the Apple design's sidebar. Every page the app had
// before the /crm move is still here: pages that aren't a section landing page
// are reachable as a tab within their section.

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
    href: "/crm", kind: "overall", tabs: [],
  },
  {
    id: "crm", label: "CRM", group: "Monitoring",
    title: "CRM Monitoring", sub: "Availability, performance and activity for the Abbey Blue CRM.",
    href: "/crm/business-health", kind: "business",
    tabs: [
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
    href: "/crm/users", kind: "none",
    tabs: [
      { href: "/crm/users", label: "Sessions", kind: "none" },
      { href: "/crm/security-events", label: "Security Events", kind: "mock" },
      { href: "/crm/audit-logs", label: "Audit Logs", kind: "mock" },
    ],
  },
  {
    id: "websites", label: "Websites", group: "Monitoring",
    title: "Website Monitoring", sub: "Outward-facing sites checked on every status poll.",
    href: "/crm/websites", kind: "none", tabs: [],
  },
  {
    id: "services", label: "Services", group: "Monitoring",
    title: "Services", sub: "Supporting services and third-party integrations.",
    href: "/crm/service-health", kind: "probes",
    tabs: [
      { href: "/crm/service-health", label: "Service Health", kind: "probes" },
      { href: "/crm/apis", label: "APIs", kind: "probes" },
      { href: "/crm/metrics", label: "Metrics", kind: "mock" },
      { href: "/crm/infrastructure", label: "Infrastructure", kind: "mock" },
      { href: "/crm/databases", label: "Databases", kind: "mock" },
      { href: "/crm/queues", label: "Queues", kind: "mock" },
      { href: "/crm/integrations", label: "Integrations", kind: "mock" },
      { href: "/crm/slo", label: "SLO / SLA", kind: "mock" },
      { href: "/crm/capacity", label: "Capacity", kind: "mock" },
    ],
  },
  {
    id: "incidents", label: "Incidents", group: "Operations",
    title: "Incidents", sub: "Detected automatically from health checks and thresholds.",
    href: "/crm/incidents", kind: "incidents",
    tabs: [
      { href: "/crm/incidents", label: "Incidents", kind: "incidents" },
      { href: "/crm/alerts", label: "Alerts", kind: "mock" },
      { href: "/crm/alert-rules", label: "Alert Rules", kind: "mock" },
      { href: "/crm/deployments", label: "Deployments", kind: "mock" },
      { href: "/crm/runbooks", label: "Runbooks", kind: "mock" },
    ],
  },
  {
    id: "logs", label: "Logs", group: "Operations",
    title: "Logs", sub: "Operational events across all monitored systems.",
    href: "/crm/logs", kind: "mock",
    tabs: [
      { href: "/crm/logs", label: "Logs", kind: "mock" },
      { href: "/crm/traces", label: "Traces", kind: "mock" },
    ],
  },
  {
    id: "settings", label: "Settings", group: "Operations",
    title: "Settings", sub: "Monitored endpoints, thresholds and notifications.",
    href: "/crm/settings", kind: "none",
    tabs: [
      { href: "/crm/settings", label: "Settings", kind: "none" },
      { href: "/crm/diagnostics", label: "Diagnostics", kind: "none" },
      { href: "/crm/monitoring-health", label: "Monitoring Health", kind: "mock" },
      { href: "/crm/cost", label: "Cost", kind: "mock" },
    ],
  },
];

/** Every routable href, section landings and tabs, de-duplicated. */
export const ALL_HREFS: string[] = Array.from(
  new Set(SECTIONS.flatMap((s) => [s.href, ...s.tabs.map((t) => t.href)])),
);

const matches = (path: string, href: string) =>
  href === "/crm" ? path === "/crm" : path === href || path.startsWith(href + "/");

/** Section owning a pathname — longest href wins so /crm/apis beats /crm. */
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

// ---- Route authorization (single source of truth) ----
// Consumed by roles.ts (server guard in proxy.ts, the real boundary) AND by the
// client shell for hiding links. Kept here, free of process.env access, so the
// client can import it without pulling secret-reading code into the bundle.
// Paths are /crm-prefixed: they must match real routes or the guard silently
// stops matching and restricted pages become reachable. nav.test.ts pins this.
export const HIDDEN_NAV: Record<MonitorRole, string[]> = {
  "super-admin": [],
  finance: ["/crm/security-events", "/crm/audit-logs"],
  sales: ["/crm/cost", "/crm/security-events", "/crm/audit-logs", "/crm/monitoring-health"],
  marketing: ["/crm/cost", "/crm/security-events", "/crm/audit-logs", "/crm/monitoring-health"],
  hr: ["/crm/cost", "/crm/security-events", "/crm/audit-logs", "/crm/monitoring-health"],
  support: ["/crm/cost", "/crm/security-events", "/crm/audit-logs", "/crm/monitoring-health"],
};
