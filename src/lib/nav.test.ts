import { describe, it, expect } from "vitest";
import { readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { SECTIONS, ALL_HREFS, sectionFor, tabFor, HIDDEN_NAV } from "./nav";
import { routeAllowed, ROLES } from "./roles";

const APP = join(process.cwd(), "src/app");
const fileFor = (href: string) => join(APP, href, "page.tsx");

/** Every static route on disk under src/app/crm, as a URL path. */
function routesOnDisk(dir = join(APP, "crm"), base = "/crm"): string[] {
  const out: string[] = [];
  if (existsSync(join(dir, "page.tsx"))) out.push(base);
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (!e.isDirectory()) continue;
    if (e.name.startsWith("[")) continue; // detail routes are reached by link, not nav
    out.push(...routesOnDisk(join(dir, e.name), `${base}/${e.name}`));
  }
  return out;
}

describe("nav", () => {
  it("every nav href resolves to a real page", () => {
    const missing = ALL_HREFS.filter((h) => !existsSync(fileFor(h)));
    expect(missing).toEqual([]);
  });

  it("every page on disk is reachable from the nav", () => {
    const orphans = routesOnDisk().filter((r) => !ALL_HREFS.includes(r));
    expect(orphans).toEqual([]);
  });

  it("keeps every route under /crm", () => {
    expect(ALL_HREFS.filter((h) => h !== "/crm" && !h.startsWith("/crm/"))).toEqual([]);
  });

  it("resolves a path to its owning section and tab", () => {
    expect(sectionFor("/crm").id).toBe("overview");
    expect(sectionFor("/crm/apis").id).toBe("services");
    expect(sectionFor("/crm/apis/customer-api").id).toBe("services");   // detail route
    expect(sectionFor("/crm/audit-logs").id).toBe("users");
    expect(tabFor(sectionFor("/crm/traces"), "/crm/traces")?.label).toBe("Traces");
  });

  it("does not let /crm swallow its children", () => {
    // "/" -> "/crm" special case: a prefix match here would make every page
    // resolve to Overview.
    expect(sectionFor("/crm/logs").id).toBe("logs");
  });
});

describe("route authorization survives the /crm move", () => {
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
