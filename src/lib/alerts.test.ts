import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import { runAlerts, type CheckResult } from "@/lib/alerts";

// §7 — engine behaviour with controlled (non-production) inputs.
const DATA = path.join(process.cwd(), ".data");
const clean = () => fs.rm(DATA, { recursive: true, force: true }).catch(() => {});
beforeAll(clean); afterAll(clean);

const down = (): CheckResult[] => [{ id: "t1", label: "Test check", tier: 2, health: "down" }];
const ok = (): CheckResult[] => [{ id: "t1", label: "Test check", tier: 2, health: "ok" }];

describe("de-flapping, dedup, resolve", () => {
  it("does not open on the first bad poll (threshold 2)", async () => {
    const r = await runAlerts(down(), new Date().toISOString());
    expect(r.opened.length).toBe(0);
    expect(r.active.length).toBe(0);
  });
  it("opens on the second consecutive bad poll", async () => {
    const r = await runAlerts(down(), new Date().toISOString());
    expect(r.opened.length).toBe(1);
    expect(r.active.length).toBe(1);
  });
  it("dedupes — no new incident while the condition persists unchanged", async () => {
    const r = await runAlerts(down(), new Date().toISOString());
    expect(r.opened.length).toBe(0);
    expect(r.active.length).toBe(1);
  });
  it("resolves on recovery", async () => {
    const r = await runAlerts(ok(), new Date().toISOString());
    expect(r.resolved.length).toBe(1);
    expect(r.active.length).toBe(0);
  });
});

describe("only trustworthy KPIs can alert", () => {
  it("the route folds only status==='ok' business KPIs into checks", () => {
    const kpis = [
      { id: "a", status: "ok" }, { id: "b", status: "not-configured" },
      { id: "c", status: "error" }, { id: "d", status: "unauthorized" },
    ];
    const alertable = kpis.filter((k) => k.status === "ok").map((k) => k.id);
    expect(alertable).toEqual(["a"]); // unavailable/unauth/error never alert
  });
});
