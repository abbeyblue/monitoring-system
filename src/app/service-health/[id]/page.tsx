"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { useMonitor } from "@/components/monitor-context";
import { PageHead, Panel, Dot, StateBadge, Related } from "@/components/kit";
import { LiveRows, liveWorst } from "@/components/live";
import { SERVICES, LIVE_PROBE_MAP } from "@/lib/mock";

export default function ServiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, latency } = useMonitor();
  const s = SERVICES.find((x) => x.id === id);
  if (!s) return notFound();
  const allLive = data ? [...data.endpoints, ...data.authed] : [];
  const liveProbes = allLive.filter((e) => (LIVE_PROBE_MAP[id] ?? []).includes(e.id));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead title={s.name} sub="Health is from live probes where mapped. Golden signals and dependency health need an APM/tracing integration (not configured)."
        crumbs={[{ label: "Service Health", href: "/service-health" }, { label: s.name }]}
        right={liveProbes.length ? <StateBadge state="live" /> : <StateBadge state="not-configured" />} />

      <div className="mb-3"><Related items={[{ label: "APIs", href: "/apis" }, { label: "Logs", href: "/logs" }]} /></div>

      {/* golden signals: honest NOT CONFIGURED, no fabricated numbers */}
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        {["Traffic (RPM)", "Latency P95", "Error rate", "Saturation (CPU/mem)"].map((label) => (
          <div key={label} className="flex flex-col rounded-lg border border-line bg-panel p-3 shadow-panel">
            <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</span>
            <span className="mt-2 text-lg font-semibold text-muted">—</span>
            <span className="mt-1"><StateBadge state="not-configured" label="NEEDS APM" /></span>
          </div>
        ))}
      </div>

      {liveProbes.length > 0 ? (
        <div className="mt-3">
          <Panel title="Live probes" status={liveWorst(liveProbes)} right={<StateBadge state="live" />}>
            <LiveRows items={liveProbes} latency={latency} />
          </Panel>
        </div>
      ) : (
        <div className="mt-3 rounded-lg border border-line bg-panel px-4 py-3 text-xs text-muted">No live probe is mapped to this service.</div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Latency & error trend" right={<StateBadge state="not-configured" />} pad>
          <p className="text-xs text-muted">Per-service latency/error time-series requires an APM or metrics backend. Not fabricated.</p>
        </Panel>
        <Panel title="Dependencies" right={<StateBadge state="not-configured" />} pad>
          <p className="text-xs text-muted">Dependency health (DB / Redis / SQS per service) requires a tracing backend. Not fabricated.</p>
        </Panel>
      </div>
    </div>
  );
}
