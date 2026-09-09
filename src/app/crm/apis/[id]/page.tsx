"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { PageHead, Panel, Stat, Dot, Pill, Chart, Related, HEALTH_COLOR as HC } from "@/components/kit";
import { APIS, API_ERROR_CLASSES, SERVICES, INCIDENTS, DEPLOYMENTS, TRACES, series } from "@/lib/mock";

export default function ApiDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const a = APIS.find((x) => x.id === id);
  if (!a) return notFound();
  const svc = SERVICES.find((s) => s.id === a.service);
  const errs = API_ERROR_CLASSES.filter((e) => e.endpoint === a.endpoint || e.service === a.service);
  const incidentId = errs.find((e) => e.incident)?.incident;
  const incident = incidentId ? INCIDENTS.find((i) => i.id === incidentId) : undefined;
  const deploy = DEPLOYMENTS.find((d) => d.version === a.lastDeploy);
  const trace = TRACES.find((t) => t.endpoint === `${a.method} ${a.endpoint}`) ?? TRACES.find((t) => t.service === a.service);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title={`${a.method} ${a.endpoint}`} sub={`${svc?.name} · ${a.version} · owner ${a.owner} · last deploy ${a.lastDeploy}`}
        crumbs={[{ label: "APIs", href: "/crm/apis" }, { label: a.endpoint }]} right={<Pill health={a.health} />} />

      <div className="mb-3">
        <Related items={[
          ...(svc ? [{ label: svc.name, href: `/crm/service-health/${svc.id}` }] : []),
          ...(trace ? [{ label: `Trace ${trace.id}`, href: `/crm/traces/${trace.id}` }] : []),
          ...(incident ? [{ label: `Incident ${incident.id}`, href: `/crm/incidents/${incident.id}` }] : []),
          ...(deploy ? [{ label: `Deploy ${deploy.version}`, href: `/crm/deployments/${deploy.id}` }] : []),
          { label: "Logs", href: "/crm/logs" },
        ]} />
      </div>

      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4 xl:grid-cols-8">
        <Stat label="Req/min" value={a.requests.toLocaleString()} />
        <Stat label="Success" value={`${a.successRate}%`} health={a.successRate < 99 ? "degraded" : "healthy"} />
        <Stat label="Error" value={`${a.errorRate}%`} health={a.errorRate > 1 ? "critical" : "healthy"} />
        <Stat label="Avg" value={`${a.avg}ms`} />
        <Stat label="P95" value={`${a.p95}ms`} health={a.p95 > 500 ? "degraded" : "healthy"} />
        <Stat label="P99" value={`${a.p99}ms`} health={a.p99 > 1000 ? "degraded" : "healthy"} />
        <Stat label="Timeouts" value={String(a.timeouts)} health={a.timeouts > 10 ? "degraded" : "healthy"} />
        <Stat label="Rate-limit" value={String(a.rateLimits)} />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Latency P95" pad><Chart data={series(91, 40, a.p95, 60, a.health === "critical" ? 400 : 0)} color={HC[a.health]} height={140} threshold={500} unit="ms" /></Panel>
        <Panel title="Error rate" pad><Chart data={series(92, 40, a.errorRate, 0.5, a.health === "critical" ? 4 : 0)} color={HC[a.health]} height={140} threshold={1} unit="%" /></Panel>
      </div>

      <div className="mt-3">
        <Panel title="Errors by class" count={`${errs.length}`}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead><tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-muted">
                <th className="px-3 py-2">Status</th><th className="px-3 py-2">Count</th><th className="px-3 py-2">Rate</th><th className="px-3 py-2">First</th><th className="px-3 py-2">Last</th><th className="px-3 py-2">Correlated</th>
              </tr></thead>
              <tbody>
                {errs.map((e) => (
                  <tr key={e.code} className="border-b border-line/60 last:border-0">
                    <td className="px-3 py-2"><span className="rounded px-1.5 py-0.5 font-mono text-2xs font-bold" style={{ color: e.code >= 500 ? "rgb(var(--down))" : "rgb(var(--warn))", background: e.code >= 500 ? "rgb(var(--down)/0.12)" : "rgb(var(--warn)/0.12)" }}>{e.code}</span> <span className="text-muted">{e.label}</span></td>
                    <td className="px-3 py-2 font-mono tabular-nums">{e.count.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{e.rate}%</td>
                    <td className="px-3 py-2 text-muted">{e.firstSeen}</td>
                    <td className="px-3 py-2 text-muted">{e.lastSeen}</td>
                    <td className="px-3 py-2">
                      {e.incident && <a href={`/crm/incidents/${e.incident}`} className="mr-1 rounded border border-down/40 px-1 text-2xs text-down hover:bg-down/10 cursor-pointer">{e.incident}</a>}
                      {e.deployment && <span className="rounded border border-line px-1 text-2xs text-muted">{e.deployment}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
