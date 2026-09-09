import { describe, it, expect, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { appendKpiPoints, readSeries, historyStatus } from "@/lib/history";
import type { KpiResult } from "@/lib/contract";

// §6 — history stores ONLY successful numeric KPI values; never mock/unavailable/error.
const mk = (id: string, status: KpiResult["status"], raw: number | null): KpiResult => ({
  id, label: id, value: raw == null ? "—" : String(raw), raw, health: status === "ok" ? "healthy" : "unknown",
  status, source: "/api/test", lastUpdated: new Date().toISOString(), cachedAt: null, stale: false,
  refreshInterval: 60000, groups: ["executive"], tier: 2,
});

afterAll(async () => { try { await fs.rm(path.join(process.cwd(), ".data"), { recursive: true, force: true }); } catch { /* noop */ } });

describe("appendKpiPoints", () => {
  it("persists only ok + numeric points, drops not-configured/error/empty and null raw", async () => {
    const n = await appendKpiPoints([
      mk("k-ok", "ok", 42),
      mk("k-notcfg", "not-configured", null),
      mk("k-err", "error", null),
      mk("k-empty", "empty", null),
      mk("k-oknull", "ok", null), // ok but no numeric value → must be dropped
    ]);
    expect(n).toBe(1);
    const okSeries = await readSeries("k-ok", "7d");
    expect(okSeries.length).toBe(1);
    expect(okSeries[0].raw).toBe(42);
    // unavailable/error KPIs never appear in history
    expect((await readSeries("k-notcfg", "7d")).length).toBe(0);
    expect((await readSeries("k-err", "7d")).length).toBe(0);
    expect((await readSeries("k-oknull", "7d")).length).toBe(0);
  });
  it("readSeries is empty for an unknown KPI (available:false)", async () => {
    expect((await readSeries("never-seen", "24h")).length).toBe(0);
  });
  it("file backend is honestly reported as non-durable / not multi-instance safe", () => {
    // no DATABASE_URL in the test env → file backend
    const s = historyStatus();
    expect(s.backend).toBe("file");
    expect(s.durable).toBe(false);
    expect(s.multiInstanceSafe).toBe(false);
  });
});
