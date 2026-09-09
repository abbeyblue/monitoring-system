"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { PageHead, Panel, Stat, Dot, Pill, Delta, Chart, Related, HEALTH_COLOR as HC } from "@/components/kit";
import { DEPLOYMENTS, INCIDENTS, series } from "@/lib/mock";

export default function DeploymentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const d = DEPLOYMENTS.find((x) => x.id === id);
  if (!d) return notFound();
  const incident = d.incident ? INCIDENTS.find((i) => i.id === d.incident) : undefined;
  // series that jump at deploy time (mid-window)
  const errS = series(101, 40, 0.2, 0.15, d.errDelta > 1 ? 4 : 0);
  const latS = series(102, 40, 380, 40, d.latDelta > 50 ? 300 : 0);
  const cpuS = series(103, 40, 55, 8, d.cpuDelta > 10 ? 30 : 5);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title={`${d.version}`} sub={`${d.commit} · ${d.env} · deployed by ${d.deployer} · ${d.start}–${d.end}`}
        crumbs={[{ label: "Deployments", href: "/deployments" }, { label: d.version }]}
        right={<span className="flex items-center gap-2"><Pill health={d.status} />{d.rollback && <span className="rounded border border-down/40 px-1.5 py-0.5 text-2xs text-down">rolled back</span>}</span>} />

      <div className="mb-3">
        <Related items={[
          { label: `Services: ${d.services.join(", ")}`, href: "/service-health" },
          ...(incident ? [{ label: `Incident ${incident.id}`, href: `/incidents/${incident.id}` }] : []),
          ...(incident?.trace ? [{ label: `Trace ${incident.trace}`, href: `/traces/${incident.trace}` }] : []),
          { label: "Database", href: "/databases/crm-prod-db" },
        ]} />
      </div>

      {/* release health vs previous */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Stat label="Δ Error rate" value={`${d.errDelta > 0 ? "+" : ""}${d.errDelta}%`} health={d.errDelta > 1 ? "critical" : "healthy"} delta={<Delta value={d.errDelta} unit="%" />} />
        <Stat label="Δ P95 latency" value={`${d.latDelta > 0 ? "+" : ""}${d.latDelta}ms`} health={d.latDelta > 50 ? "degraded" : "healthy"} delta={<Delta value={d.latDelta} unit="ms" />} />
        <Stat label="Δ CPU" value={`${d.cpuDelta > 0 ? "+" : ""}${d.cpuDelta}%`} health={d.cpuDelta > 10 ? "degraded" : "healthy"} delta={<Delta value={d.cpuDelta} unit="%" />} />
        <Stat label="Incidents" value={incident ? "1" : "0"} health={incident ? "critical" : "healthy"} />
      </div>

      {d.rollback && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-down/40 bg-down/10 px-4 py-2.5 text-xs text-down">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-1" /></svg>
          Regression detected after deploy → automatically flagged and rolled back. Error rate and latency returned to baseline post-rollback.
        </div>
      )}

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="Error rate (deploy overlay)" pad><Chart data={errS} color={HC[d.status]} height={130} threshold={1} unit="%" /></Panel>
        <Panel title="P95 latency" pad><Chart data={latS} color={HC[d.status]} height={130} unit="ms" /></Panel>
        <Panel title="CPU" pad><Chart data={cpuS} color={HC[d.status]} height={130} unit="%" /></Panel>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Meta label="Commit" value={d.commit} />
        <Meta label="Environment" value={d.env} />
        <Meta label="Window" value={`${d.start}–${d.end}`} />
        <Meta label="Deployer" value={d.deployer} />
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-panel p-3"><div className="text-2xs uppercase tracking-wider text-muted">{label}</div><div className="mt-1 font-mono text-sm">{value}</div></div>;
}
