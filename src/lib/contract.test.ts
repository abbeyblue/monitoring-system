import { describe, it, expect } from "vitest";
import { freshnessState, isUnavailable, type Freshness } from "@/lib/contract";

// §6 — freshness labelling transitions.
const f = (over: Partial<Freshness>): Freshness => ({ source: "x", generatedAt: new Date().toISOString(), fromCache: false, refreshMs: 60000, configured: true, ...over });

describe("freshnessState", () => {
  it("not-configured when upstream not configured", () => {
    expect(freshnessState(f({ configured: false }))).toBe("not-configured");
  });
  it("live when fresh and not from cache", () => {
    expect(freshnessState(f({ fromCache: false }))).toBe("live");
  });
  it("cached when fresh but served from cache", () => {
    expect(freshnessState(f({ fromCache: true }))).toBe("cached");
  });
  it("stale when older than 2× refresh", () => {
    const old = new Date(Date.now() - 200_000).toISOString();
    expect(freshnessState(f({ generatedAt: old, refreshMs: 60000 }))).toBe("stale");
  });
});

describe("isUnavailable", () => {
  it("only 'ok' is available; everything else is unavailable", () => {
    expect(isUnavailable("ok")).toBe(false);
    for (const s of ["empty", "not-configured", "unauthorized", "forbidden", "not-found", "rate-limited", "timeout", "error", "malformed"] as const) {
      expect(isUnavailable(s)).toBe(true);
    }
  });
});
