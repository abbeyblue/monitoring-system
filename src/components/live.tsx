"use client";

import { Dot, Spark, HEALTH_COLOR, errClass } from "@/components/kit";
import type { Endpoint, Health as LiveHealth } from "@/lib/types";
import type { Health } from "@/lib/mock";

// map the live 4-state health onto the platform's 5-state model
export const mapHealth = (h: LiveHealth): Health =>
  h === "ok" ? "healthy" : h === "warn" ? "degraded" : h === "down" ? "critical" : "unknown";

export const liveWorst = (items: Endpoint[]): Health =>
  items.some((e) => e.health === "down") ? "critical"
  : items.some((e) => e.health === "warn") ? "degraded"
  : items.some((e) => e.health === "ok") ? "healthy" : "unknown";

export function LiveRows({ items, latency }: { items: Endpoint[]; latency: Record<string, number[]> }) {
  if (items.length === 0) return <p className="px-4 py-3 text-xs text-muted">No live probes mapped.</p>;
  return (
    <div className="divide-y divide-line">
      {items.map((e) => {
        const h = mapHealth(e.health);
        const err = e.health === "down" ? (errClass(e.httpStatus) ?? "unreachable") : null;
        return (
          <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
            <Dot health={h} pulse={h === "healthy"} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="font-mono text-2xs text-muted">GET</span>
                <span className="truncate font-medium">{e.label}</span>
                {e.authed && <span className="rounded border border-line px-1 text-[10px] text-muted">authed</span>}
              </span>
              <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">{e.path}</span>
            </span>
            {err && <span className="rounded border border-down/40 bg-down/10 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-down">{err}</span>}
            <span className="w-20 text-right font-mono tabular-nums" style={{ color: e.health === "down" ? "rgb(var(--down))" : "rgb(var(--muted))" }}>
              {e.health === "idle" ? "—" : e.health === "down" ? (e.httpStatus || "×") : `${e.latency}ms`}
            </span>
            <Spark data={latency[e.id] ?? []} color={HEALTH_COLOR[h]} w={64} h={20} />
          </div>
        );
      })}
    </div>
  );
}
