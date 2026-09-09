import { describe, it, expect, vi, afterEach } from "vitest";

// §8 — server-side role scoping: a role only RECEIVES its permitted KPI groups.
// (CRM unset, so KPIs are 'not-configured' but still carry their groups.)
async function snapshotForRole(role: string) {
  vi.resetModules();
  vi.stubEnv("CRM_BASE_URL", "");        // no network, deterministic
  vi.stubEnv("MONITOR_SESSION_COOKIE", "");
  vi.stubEnv("MONITOR_ROLE", role);
  const { getBusinessSnapshot } = await import("@/lib/business");
  const { kpiGroupsFor } = await import("@/lib/roles");
  const snap = await getBusinessSnapshot();
  return { kpis: snap.kpis, allowed: kpiGroupsFor(role as never) };
}
afterEach(() => { vi.unstubAllEnvs(); });

describe("role KPI scoping", () => {
  it("super-admin receives all groups (incl. security + support + financial)", async () => {
    const { kpis } = await snapshotForRole("super-admin");
    const ids = kpis.map((k) => k.id);
    expect(ids).toContain("failed-logins");   // security
    expect(ids).toContain("stagnant-cases");  // support
    expect(ids).toContain("urgent-followups");// financial
  });

  it("finance never receives security- or support-only KPIs", async () => {
    const { kpis, allowed } = await snapshotForRole("finance");
    for (const k of kpis) expect(k.groups.some((g) => (allowed as string[]).includes(g))).toBe(true);
    const ids = kpis.map((k) => k.id);
    expect(ids).not.toContain("failed-logins");   // security blocked
    expect(ids).not.toContain("active-sessions");
    expect(ids).not.toContain("stagnant-cases");  // support-only blocked
    expect(ids).not.toContain("service-inbox");
    expect(ids).toContain("urgent-followups");     // financial allowed
  });

  it("sales never receives financial or security KPIs over the wire", async () => {
    const { kpis } = await snapshotForRole("sales");
    const ids = kpis.map((k) => k.id);
    expect(ids).not.toContain("urgent-followups"); // financial-only blocked
    expect(ids).not.toContain("failed-logins");
    expect(ids).toContain("revenue-mtd");          // executive allowed
  });

  it("hr receives no KPIs today (team group has no implemented source)", async () => {
    const { kpis } = await snapshotForRole("hr");
    expect(kpis.length).toBe(0);
  });
});

describe("per-user identity (MONITOR_USERS)", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("parses users and resolves role from the authenticated user", async () => {
    vi.resetModules();
    vi.stubEnv("MONITOR_USERS", "fin:pw1:finance,sal:pw2:sales,bad:pw:notarole");
    const { parseUsers, verifyUser } = await import("@/lib/roles");
    const users = parseUsers();
    expect(users.size).toBe(2);                     // invalid role entry dropped
    expect(users.get("fin")?.role).toBe("finance");
    expect(verifyUser("sal", "pw2")?.role).toBe("sales");
    expect(verifyUser("sal", "wrong")).toBeNull();  // wrong password rejected
    expect(verifyUser("ghost", "x")).toBeNull();
  });
  it("asRole rejects unknown roles", async () => {
    const { asRole } = await import("@/lib/roles");
    expect(asRole("finance")).toBe("finance");
    expect(asRole("root")).toBeNull();
    expect(asRole(null)).toBeNull();
  });
});
