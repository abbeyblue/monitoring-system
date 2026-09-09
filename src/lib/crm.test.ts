import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { classify } from "@/lib/crm";

// ---- P10 contract tests: response classification (pure, no network) ----
describe("classify()", () => {
  it("maps auth/permission/rate/not-found/5xx codes", () => {
    expect(classify(401, undefined)).toBe("unauthorized");
    expect(classify(403, undefined)).toBe("forbidden");
    expect(classify(404, undefined)).toBe("not-found");
    expect(classify(429, undefined)).toBe("rate-limited");
    expect(classify(500, undefined)).toBe("error");
    expect(classify(503, undefined)).toBe("error");
    expect(classify(302, undefined)).toBe("error"); // non-2xx redirect
  });
  it("detects empty 2xx bodies", () => {
    expect(classify(200, null)).toBe("empty");
    expect(classify(200, [])).toBe("empty");
    expect(classify(200, {})).toBe("empty");
  });
  it("returns ok for non-empty 2xx bodies", () => {
    expect(classify(200, { revenue: 1 })).toBe("ok");
    expect(classify(200, [1, 2])).toBe("ok");
  });
});

// ---- crmFetch normalization with a mocked fetch (no real CRM) ----
async function freshCrm(base = "https://crm.test") {
  vi.resetModules();
  vi.stubEnv("CRM_BASE_URL", base);
  vi.stubEnv("MONITOR_SESSION_COOKIE", "");
  return await import("@/lib/crm");
}
const jsonRes = (status: number, body: unknown) =>
  ({ status, json: async () => body } as unknown as Response);

describe("crmFetch() normalization", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it("returns not-configured when CRM_BASE_URL is unset/placeholder", async () => {
    const m = await freshCrm("https://your-crm-host.example.com");
    expect((await m.crmFetch("/x")).status).toBe("not-configured");
  });
  it("returns ok with data on 200", async () => {
    const m = await freshCrm();
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(200, { a: 1 })));
    const r = await m.crmFetch<{ a: number }>("/x");
    expect(r.status).toBe("ok"); expect(r.data).toEqual({ a: 1 });
  });
  it("returns empty on 200 with empty object", async () => {
    const m = await freshCrm();
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(200, {})));
    expect((await m.crmFetch("/x")).status).toBe("empty");
  });
  it("maps 401/403/404/429/500 without parsing body", async () => {
    const m = await freshCrm();
    for (const [code, want] of [[401, "unauthorized"], [403, "forbidden"], [404, "not-found"], [429, "rate-limited"], [500, "error"]] as const) {
      vi.stubGlobal("fetch", vi.fn(async () => jsonRes(code, "err")));
      expect((await m.crmFetch("/x")).status).toBe(want);
    }
  });
  it("returns malformed on invalid JSON", async () => {
    const m = await freshCrm();
    vi.stubGlobal("fetch", vi.fn(async () => ({ status: 200, json: async () => { throw new Error("bad"); } } as unknown as Response)));
    expect((await m.crmFetch("/x")).status).toBe("malformed");
  });
  it("returns error on network failure", async () => {
    const m = await freshCrm();
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network"); }));
    expect((await m.crmFetch("/x")).status).toBe("error");
  });
  it("returns timeout on abort", async () => {
    const m = await freshCrm();
    vi.stubGlobal("fetch", vi.fn(async () => { const e = new Error("aborted"); e.name = "AbortError"; throw e; }));
    expect((await m.crmFetch("/x")).status).toBe("timeout");
  });
  it("never coerces an error into a numeric value (data stays undefined)", async () => {
    const m = await freshCrm();
    vi.stubGlobal("fetch", vi.fn(async () => jsonRes(500, "err")));
    const r = await m.crmFetch("/x");
    expect(r.data).toBeUndefined();
  });
});
