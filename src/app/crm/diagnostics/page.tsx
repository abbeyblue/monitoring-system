"use client";

import { useEffect, useState } from "react";
import { PageHead, Panel, StateBadge, type DataState } from "@/components/kit";

interface Ep { path: string; domain: string; status: string; httpStatus: number | null; latencyMs: number | null; requiredPermission: string }
interface Diag {
  connectionState: string; crmConfigured: boolean; crmBase: string | null; authConfigured: boolean;
  reachable: boolean; authenticationAccepted: boolean; monitoringIdentityAuthorized: boolean;
  avgLatencyMs: number | null; checkedAt: string; endpoints: Ep[];
  setup: { crmBaseUrl: { set: boolean }; monitoringIdentity: { set: boolean; note: string }; timezone: { value: string }; currency: { value: string; conversion: string }; requiredPermissions: string[]; nonProductionVerificationRequired: boolean; liveVerified: boolean };
  stateLegend: Record<string, string>;
}

const CONN_BADGE: Record<string, { state: DataState; label: string }> = {
  "not-configured": { state: "not-configured", label: "NOT CONFIGURED" },
  unreachable: { state: "error", label: "UNREACHABLE" },
  unauthorized: { state: "error", label: "UNAUTHORIZED" },
  degraded: { state: "stale", label: "DEGRADED" },
  "authorized-unverified": { state: "cached", label: "AUTHORIZED · UNVERIFIED" },
};
const statusColor = (s: string) =>
  s === "ok" || s === "empty" ? "rgb(var(--ok))"
  : s === "unauthorized" || s === "forbidden" || s === "not-found" || s === "rate-limited" ? "rgb(var(--warn))"
  : s === "not-configured" ? "rgb(var(--idle))" : "rgb(var(--down))";

export default function DiagnosticsPage() {
  const [d, setD] = useState<Diag | null>(null);
  const [hist, setHist] = useState<{ backend: string; durable: boolean; multiInstanceSafe: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("/api/diagnostics", { cache: "no-store" }).then((r) => r.json()),
      fetch("/api/history?kpi=revenue-mtd&range=24h", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
    ]).then(([diag, h]) => { if (alive) { setD(diag); setHist(h?.storage ?? null); setLoading(false); } }).catch(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  if (loading || !d) return <div className="mx-auto max-w-[1100px]"><PageHead title="Diagnostics" /><div className="h-40 animate-pulse rounded-lg border border-line bg-panel" /></div>;
  const conn = CONN_BADGE[d.connectionState] ?? { state: "error" as DataState, label: d.connectionState };
  const check = (ok: boolean) => <span style={{ color: ok ? "rgb(var(--ok))" : "rgb(var(--idle))" }}>{ok ? "✓ set" : "✗ not set"}</span>;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHead title="Diagnostics" sub="Read-only connection health for the CRM data sources. No cookies, tokens, headers, or raw payloads are shown."
        crumbs={[{ label: "Platform", href: "/crm" }, { label: "Diagnostics" }]}
        right={<span className="motion-safe:animate-fade"><StateBadge state={conn.state} label={conn.label} /></span>} />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Setup checklist">
          <div className="divide-y divide-line text-xs">
            <Row k="CRM base URL" v={check(d.setup.crmBaseUrl.set)} />
            <Row k="Read-only monitoring identity" v={check(d.setup.monitoringIdentity.set)} note={d.setup.monitoringIdentity.note} />
            <Row k="Timezone" v={<span className="font-mono">{d.setup.timezone.value}</span>} />
            <Row k="Currency" v={<span className="font-mono">{d.setup.currency.value} · {d.setup.currency.conversion}</span>} />
            <Row k="Non-production verification" v={<span className="text-warn">required</span>} />
            <Row k="liveVerified" v={<span className="text-idle">false (never auto-set)</span>} />
          </div>
        </Panel>
        <Panel title="Connection">
          <div className="divide-y divide-line text-xs">
            <Row k="crmConfigured" v={check(d.crmConfigured)} />
            <Row k="authConfigured" v={check(d.authConfigured)} />
            <Row k="reachable" v={check(d.reachable)} />
            <Row k="authentication accepted" v={check(d.authenticationAccepted)} />
            <Row k="identity authorized" v={check(d.monitoringIdentityAuthorized)} />
            <Row k="avg latency" v={<span className="font-mono">{d.avgLatencyMs != null ? `${d.avgLatencyMs}ms` : "—"}</span>} />
            <Row k="history storage" v={<span className="font-mono">{hist ? `${hist.backend} · ${hist.durable ? "durable" : "non-durable"}` : "—"}</span>} />
          </div>
        </Panel>
      </div>

      <div className="mt-3">
        <Panel title="Endpoints" count={`${d.endpoints.length}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead><tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-muted">
                <th className="px-3 py-2">Endpoint</th><th className="px-3 py-2">Domain</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">HTTP</th><th className="px-3 py-2">Latency</th><th className="px-3 py-2">Required permission</th>
              </tr></thead>
              <tbody>
                {d.endpoints.map((e) => (
                  <tr key={e.path} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2 font-mono text-2xs">{e.path}</td>
                    <td className="px-3 py-2 text-muted">{e.domain}</td>
                    <td className="px-3 py-2"><span className="rounded px-1.5 py-0.5 font-mono text-2xs font-semibold" style={{ color: statusColor(e.status), background: `${statusColor(e.status)}18` }}>{e.status}</span></td>
                    <td className="px-3 py-2 font-mono text-muted">{e.httpStatus ?? "—"}</td>
                    <td className="px-3 py-2 font-mono text-muted">{e.latencyMs != null ? `${e.latencyMs}ms` : "—"}</td>
                    <td className="px-3 py-2 font-mono text-2xs text-muted">{e.requiredPermission}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>

      <div className="mt-3">
        <Panel title="State legend">
          <div className="divide-y divide-line text-xs">
            {Object.entries(d.stateLegend).map(([k, v]) => (
              <div key={k} className="flex gap-3 px-4 py-2"><span className="w-40 shrink-0 font-mono text-2xs text-ink">{k}</span><span className="text-muted">{v}</span></div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Row({ k, v, note }: { k: string; v: React.ReactNode; note?: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5">
      <span className="min-w-0"><span className="block font-medium">{k}</span>{note && <span className="block text-2xs text-muted">{note}</span>}</span>
      <span className="ml-auto shrink-0 font-mono">{v}</span>
    </div>
  );
}
