"use client";

import { PageHead, Panel, Dot, Chart, HEALTH_COLOR as HC } from "@/components/kit";
import { SERVICES, series } from "@/lib/mock";

export default function MetricsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title="Metrics — Golden Signals" sub="Traffic, latency, errors, and saturation for every service (RED + USE)." crumbs={[{ label: "Services", href: "/crm/service-health" }, { label: "Metrics" }]} />
      <div className="space-y-3">
        {SERVICES.map((s, idx) => (
          <Panel key={s.id} title={s.name} status={s.health} right={<a href={`/crm/service-health/${s.id}`} className="text-2xs text-accent hover:underline cursor-pointer">details →</a>}>
            <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4">
              <Signal label="Traffic" value={`${(s.rpm / 1000).toFixed(1)}k/min`} data={s.spark} health="healthy" />
              <Signal label="Latency P95" value={`${s.p95}ms`} data={series(110 + idx, 30, s.p95, 40)} health={s.p95 > 500 ? "degraded" : "healthy"} />
              <Signal label="Errors" value={`${s.errorRate}%`} data={series(120 + idx, 30, s.errorRate, 0.4)} health={s.errorRate > 1 ? "critical" : "healthy"} />
              <Signal label="Saturation" value={`${s.cpu}%`} data={series(130 + idx, 30, s.cpu, 8)} health={s.cpu > 75 ? "degraded" : "healthy"} />
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

function Signal({ label, value, data, health }: { label: string; value: string; data: number[]; health: "healthy" | "degraded" | "critical" }) {
  return (
    <div className="rounded-md border border-line bg-panel2/40 p-3">
      <div className="flex items-center gap-1.5"><Dot health={health} /><span className="text-2xs uppercase tracking-wider text-muted">{label}</span><span className="ml-auto font-mono text-xs tabular-nums" style={{ color: health === "healthy" ? "rgb(var(--ink))" : HC[health] }}>{value}</span></div>
      <div className="mt-1"><Chart data={data} color={HC[health]} height={40} /></div>
    </div>
  );
}
