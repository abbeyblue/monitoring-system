import { describe, it, expect, vi, afterEach } from "vitest";

// §4 registry corrections + §5 "never becomes zero/healthy" at the adapter layer.
async function fresh(base = "") {
  vi.resetModules();
  vi.stubEnv("CRM_BASE_URL", base);      // unset -> not-configured, no network
  vi.stubEnv("MONITOR_SESSION_COOKIE", "");
  vi.stubEnv("MONITOR_ROLE", "super-admin");
  return await import("@/lib/adapters");
}
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe("unimplemented adapters return NOTHING (never fabricated zeros)", () => {
  it("sales/team/data-integrity are empty until a verified source exists", async () => {
    const a = await fresh();
    expect(await a.getSalesKpis()).toEqual([]);
    expect(await a.getTeamKpis()).toEqual([]);
    expect(await a.getDataIntegrityKpis()).toEqual([]);
  });
});

describe("implemented adapters keep raw=null on non-ok (never 0-on-error)", () => {
  it("executive/support/financial/security → status not-configured, raw null, value —", async () => {
    const a = await fresh();
    const all = [
      ...(await a.getExecutiveKpis()), ...(await a.getSupportKpis()),
      ...(await a.getFinancialKpis()), ...(await a.getSecurityKpis()),
    ];
    expect(all.length).toBeGreaterThan(0);
    for (const k of all) {
      expect(k.status).toBe("not-configured");
      expect(k.raw).toBeNull();      // NOT 0
      expect(k.value).toBe("—");
      expect(k.health).toBe("unknown"); // NOT healthy
    }
  });
});
