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

const CRM_ONLY = [
  "/crm/business-health", "/crm/customers", "/crm/leads",
  "/crm/opportunities", "/crm/background-jobs", "/crm/webhooks",
];

describe("nav", () => {
  it("every nav href resolves to a real page", () => {
    expect(ALL_HREFS.filter((h) => !existsSync(fileFor(h)))).toEqual([]);
  });

  it("every page on disk is reachable from the nav", () => {
    expect(routesOnDisk().filter((r) => !ALL_HREFS.includes(r))).toEqual([]);
  });

  it("only CRM-specific pages live under /crm/", () => {
    const under = ALL_HREFS.filter((h) => h.startsWith("/crm/")).sort();
    expect(under).toEqual([...CRM_ONLY].sort());
  });

  it("the overview is the root and the CRM has its own overview", () => {
    expect(SECTIONS[0].href).toBe("/");
    expect(SECTIONS.find((s) => s.id === "crm")!.href).toBe("/crm");
  });

  it("resolves a path to its owning section and tab", () => {
    expect(sectionFor("/").id).toBe("overview");
    expect(sectionFor("/crm").id).toBe("crm");
    expect(sectionFor("/crm/customers").id).toBe("crm");
    expect(sectionFor("/apis").id).toBe("services");
    expect(sectionFor("/apis/post-customers").id).toBe("services");  // detail route
    expect(sectionFor("/audit-logs").id).toBe("users");
    expect(sectionFor("/cost").id).toBe("settings");
    expect(tabFor(sectionFor("/traces"), "/traces")?.label).toBe("Traces");
  });

  it("neither / nor /crm swallows its children", () => {
    // Both are landing pages whose children are registered separately; a prefix
    // match on either would drag every page into the wrong section.
    expect(sectionFor("/logs").id).toBe("logs");
    expect(sectionFor("/crm/leads").id).toBe("crm");
    expect(sectionFor("/incidents").id).toBe("incidents");
  });
});

describe("legacy URL redirects", () => {
  it("moves interim /crm/* URLs back to the root", () => {
    expect(canonicalPath("/crm/incidents")).toBe("/incidents");
    expect(canonicalPath("/crm/logs")).toBe("/logs");
    expect(canonicalPath("/crm/cost")).toBe("/cost");
    expect(canonicalPath("/crm/incidents/INC-1042")).toBe("/incidents/INC-1042");
  });

  it("moves CRM-specific root URLs under /crm", () => {
    expect(canonicalPath("/customers")).toBe("/crm/customers");
    expect(canonicalPath("/leads")).toBe("/crm/leads");
    expect(canonicalPath("/webhooks")).toBe("/crm/webhooks");
  });

  it("leaves canonical paths alone — this is what prevents a redirect loop", () => {
    for (const p of ["/", "/crm", "/incidents", "/crm/customers", "/incidents/INC-1042", "/service-health/customer"]) {
      expect(canonicalPath(p), `${p} must not redirect`).toBeNull();
    }
  });

  it("never redirects into a loop", () => {
    // Whatever a path maps to must itself be terminal.
    for (const p of [...ALL_HREFS, "/crm/incidents", "/customers", "/crm/logs"]) {
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
    expect(routeAllowed("sales", "/cost")).toBe(false);
    expect(routeAllowed("sales", "/security-events")).toBe(false);
    expect(routeAllowed("finance", "/audit-logs")).toBe(false);
    expect(routeAllowed("finance", "/cost")).toBe(true);
  });
});
