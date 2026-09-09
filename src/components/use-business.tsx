"use client";

import { useEffect, useState } from "react";
import { Dot, StateBadge, HEALTH_COLOR } from "@/components/kit";
import { freshnessState } from "@/lib/contract";
import type { Health } from "@/lib/mock";

export type BizStatus = "ok" | "empty" | "not-configured" | "unauthorized" | "forbidden" | "not-found" | "rate-limited" | "timeout" | "error" | "malformed";
export interface BizKpi { id: string; label: string; value: string; sub?: string; health: Health; status: BizStatus; groups: string[]; tier: number; drillPath?: string }
export interface BizResp { configured: boolean; authConfigured: boolean; crmBase: string | null; generatedAt: string; fromCache: boolean; refreshMs: number; period: string; kpis: BizKpi[] }

const rel = (iso: string) => { const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`; };

/** P6 — honest freshness for a business snapshot (updated Xs ago / STALE / NOT CONFIGURED). */
export function BizFreshness({ data }: { data: BizResp | null }) {
  if (!data) return <span className="text-2xs text-muted">loading…</span>;
  const state = freshnessState({ source: "CRM analytics", generatedAt: data.generatedAt, fromCache: data.fromCache, refreshMs: data.refreshMs ?? 60000, configured: data.configured });
  return (
    <span className="flex items-center gap-1.5 text-2xs text-muted">
      <StateBadge state={state} />
      {data.configured && <span>updated {rel(data.generatedAt)} ago{state === "stale" ? " · CRM unavailable" : ""}</span>}
    </span>
  );
}

export const STATUS_HINT: Record<BizStatus, string> = {
  ok: "", empty: "No data", "not-configured": "Set CRM_BASE_URL", unauthorized: "Service session needed",
  forbidden: "Service account not permitted", "not-found": "Endpoint not found", "rate-limited": "Rate-limited by CRM",
  timeout: "CRM timed out", error: "CRM error", malformed: "Unexpected response",
};

export function useBusiness(period = "month") {
  const [data, setData] = useState<BizResp | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    const load = () => fetch(`/api/business?period=${period}`, { cache: "no-store" }).then((r) => r.json()).then((j) => { if (alive) { setData(j); setLoading(false); } }).catch(() => alive && setLoading(false));
    load(); const id = setInterval(load, 60_000);
    return () => { alive = false; clearInterval(id); };
  }, [period]);
  return { data, loading };
}

export function BizTile({ k, base }: { k: BizKpi; base: string | null }) {
  const external = k.status === "ok" && base && k.drillPath ? `${base}${k.drillPath}` : null;
  const body = (
    <div className="flex h-full flex-col rounded-lg border border-line bg-panel p-3 shadow-panel transition-colors duration-200 hover:border-accent/50">
      <div className="flex items-center gap-1.5">
        <Dot health={k.health} />
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{k.label}</span>
        {external && <span className="ml-auto text-muted"><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 17 17 7M8 7h9v9" /></svg></span>}
      </div>
      <div className="mt-1.5">
        <div className="text-lg font-semibold tabular-nums leading-none" style={{ color: k.health === "healthy" || k.health === "unknown" ? "rgb(var(--ink))" : HEALTH_COLOR[k.health] }}>{k.value}</div>
        <div className="mt-1 text-2xs text-muted">{k.status === "ok" ? (k.sub ?? "") : STATUS_HINT[k.status]}</div>
      </div>
    </div>
  );
  return external ? <a href={external} target="_blank" rel="noreferrer" className="cursor-pointer">{body}</a> : body;
}

export function BizGrid({ kpis, base, loading }: { kpis: BizKpi[]; base: string | null; loading?: boolean }) {
  if (loading && kpis.length === 0) return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-[74px] animate-pulse rounded-lg border border-line bg-panel" />)}</div>;
  if (kpis.length === 0) return <p className="rounded-lg border border-line bg-panel px-4 py-3 text-xs text-muted">No KPIs in this group.</p>;
  return <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">{kpis.map((k) => <BizTile key={k.id} k={k} base={base} />)}</div>;
}
