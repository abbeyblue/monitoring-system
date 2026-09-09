import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SECTIONS, ALL_HREFS, sectionFor, tabFor, canonicalPath, HIDDEN_NAV } from "./nav";
import { routeAllowed, ROLES } from "./roles";

const APP = join(process.cwd(), "src/app");
const fileFor = (href: string) => join(APP, href, "page.tsx");

/** Every static route on disk, as a URL path. Skips api/ and [dynamic] segments. */
function routesOnDisk(dir = APP, base = ""): string[] {
  const out: string[] = [];
  if (existsSync(join(dir, "page.tsx"))) out.push(base === "" ? "/" : base);
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name === "api") continue;      // route handlers, not pages
    if (e.name.startsWith("[")) continue; // detail routes are reached by link, not nav
    out.push(...routesOnDisk(join(dir, e.name), `${base}/${e.name}`));
  }
  return out;
}

// The 29 routes the app shipped with, as they must appear under /crm. This is
// the contract the user cares about — it silently broke once when a refactor
// promoted most of them to the root, so it is asserted explicitly rather than
// derived from SECTIONS (which would have moved right along with the bug).
const ORIGINAL_29 = [
  "/crm",
  "/crm/service-health", "/crm/apis", "/crm/logs", "/crm/traces", "/crm/metrics",
  "/crm/infrastructure", "/crm/databases", "/crm/queues", "/crm/customers",
  "/crm/leads", "/crm/opportunities", "/crm/background-jobs", "/crm/integrations",
  "/crm/webhooks", "/crm/business-health", "/crm/alerts", "/crm/alert-rules",
  "/crm/incidents", "/crm/deployments", "/crm/runbooks", "/crm/security-events",
  "/crm/audit-logs", "/crm/diagnostics", "/crm/slo", "/crm/capacity", "/crm/cost",
  "/crm/monitoring-health", "/crm/settings",
];

/** Added by the redesign, deliberately outside /crm. */
const OUTSIDE_CRM = ["/", "/users", "/websites"];

describe("nav", () => {
  it("every nav href resolves to a real page", () => {
    expect(ALL_HREFS.filter((h) => !existsSync(fileFor(h)))).toEqual([]);
  });

  it("every page on disk is reachable from the nav", () => {
    expect(routesOnDisk().filter((r) => !ALL_HREFS.includes(r))).toEqual([]);
  });

  it("keeps all 29 original monitoring routes under /crm", () => {
    expect(ORIGINAL_29).toHaveLength(29);
    const missingFromNav = ORIGINAL_29.filter((r) => !ALL_HREFS.includes(r));
    expect(missingFromNav, "original routes dropped out of the nav").toEqual([]);
    const missingOnDisk = ORIGINAL_29.filter((r) => !existsSync(fileFor(r)));
    expect(missingOnDisk, "original routes missing a page").toEqual([]);
  });

  it("only the new sections live outside /crm", () => {
    const outside = ALL_HREFS.filter((h) => h !== "/crm" && !h.startsWith("/crm/")).sort();
    expect(outside).toEqual([...OUTSIDE_CRM].sort());
  });

  it("the overview is the root and the CRM has its own overview", () => {
    expect(SECTIONS[0].href).toBe("/");
    expect(SECTIONS.find((s) => s.id === "crm")!.href).toBe("/crm");
  });

  it("resolves a path to its owning section and tab", () => {
    expect(sectionFor("/").id).toBe("overview");
    expect(sectionFor("/crm").id).toBe("crm");
    expect(sectionFor("/crm/customers").id).toBe("crm");
    expect(sectionFor("/crm/apis").id).toBe("services");
    expect(sectionFor("/crm/apis/post-customers").id).toBe("services");  // detail route
    expect(sectionFor("/crm/audit-logs").id).toBe("users");  // tab lives under /crm
    expect(sectionFor("/crm/cost").id).toBe("settings");
    expect(sectionFor("/users").id).toBe("users");
    expect(tabFor(sectionFor("/crm/traces"), "/crm/traces")?.label).toBe("Traces");
  });

  it("neither / nor /crm swallows its children", () => {
    // Both are landing pages whose children are registered separately; a prefix
    // match on either would drag every page into the wrong section.
    expect(sectionFor("/crm/logs").id).toBe("logs");
    expect(sectionFor("/crm/leads").id).toBe("crm");
    expect(sectionFor("/crm/incidents").id).toBe("incidents");
  });
});

describe("legacy URL redirects", () => {
  it("moves bare monitoring URLs under /crm", () => {
    expect(canonicalPath("/incidents")).toBe("/crm/incidents");
    expect(canonicalPath("/logs")).toBe("/crm/logs");
    expect(canonicalPath("/settings")).toBe("/crm/settings");
    expect(canonicalPath("/customers")).toBe("/crm/customers");
    expect(canonicalPath("/incidents/INC-1042")).toBe("/crm/incidents/INC-1042");
  });

  it("keeps the new root sections at the root", () => {
    expect(canonicalPath("/users")).toBeNull();
    expect(canonicalPath("/websites")).toBeNull();
    // These lived under /crm during an earlier iteration, so the symmetric
    // rule sends those URLs back up rather than 404ing them.
    expect(canonicalPath("/crm/users")).toBe("/users");
    expect(canonicalPath("/crm/websites")).toBe("/websites");
  });

  it("leaves canonical paths alone — this is what prevents a redirect loop", () => {
    for (const p of ["/", "/crm", "/users", "/websites", "/crm/incidents", "/crm/customers", "/crm/incidents/INC-1042", "/crm/service-health/customer"]) {
      expect(canonicalPath(p), `${p} must not redirect`).toBeNull();
    }
  });

  it("never redirects into a loop", () => {
    // Whatever a path maps to must itself be terminal.
    for (const p of [...ALL_HREFS, "/incidents", "/customers", "/logs", "/crm/users"]) {
      const once = canonicalPath(p);
      if (once) expect(canonicalPath(once), `${p} -> ${once} -> ?`).toBeNull();
    }
  });

  it("does not invent routes for unknown paths", () => {
    expect(canonicalPath("/nonsense")).toBeNull();
    expect(canonicalPath("/crm/nonsense")).toBeNull();
  });
});

describe("route authorization survives the move", () => {
  it("blocks every hidden path for its role", () => {
    for (const role of ROLES) {
      for (const hidden of HIDDEN_NAV[role]) {
        expect(routeAllowed(role, hidden), `${role} must not reach ${hidden}`).toBe(false);
        expect(routeAllowed(role, `${hidden}/nested`)).toBe(false);
      }
    }
  });

  it("hidden paths point at routes that exist", () => {
    // A stale path silently stops matching and re-opens a restricted page.
    for (const role of ROLES) {
      for (const hidden of HIDDEN_NAV[role]) {
        expect(existsSync(fileFor(hidden)), `${hidden} has no page`).toBe(true);
        expect(ALL_HREFS).toContain(hidden);
      }
    }
  });

  it("never hides a section landing page", () => {
    for (const role of ROLES) {
      for (const s of SECTIONS) {
        expect(routeAllowed(role, s.href), `${role} lost the ${s.id} landing page`).toBe(true);
      }
    }
  });

  it("super-admin reaches everything", () => {
    for (const h of ALL_HREFS) expect(routeAllowed("super-admin", h)).toBe(true);
  });

  it("sales cannot reach cost or the security pages", () => {
    expect(routeAllowed("sales", "/crm/cost")).toBe(false);
    expect(routeAllowed("sales", "/crm/security-events")).toBe(false);
    expect(routeAllowed("finance", "/crm/audit-logs")).toBe(false);
    expect(routeAllowed("finance", "/crm/cost")).toBe(true);
  });
});
