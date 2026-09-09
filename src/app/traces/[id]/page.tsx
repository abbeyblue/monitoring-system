"use client";

import { use, useState } from "react";
import { notFound } from "next/navigation";
import { PageHead, Panel, Dot, Pill, Related, HEALTH_COLOR } from "@/components/kit";
import { FLAGSHIP_TRACE, TRACES, LOGS, INCIDENTS, type Span, type Health } from "@/lib/mock";

function buildTrace(id: string) {
  if (id === FLAGSHIP_TRACE.id) return FLAGSHIP_TRACE;
  const meta = TRACES.find((t) => t.id === id);
  if (!meta) return null;
  const bad = meta.status >= 500;
  const spans: Span[] = [
    { id: "s1", label: "CloudFront", kind: "cdn", start: 0, dur: 8, health: "healthy" },
    { id: "s2", label: "API Gateway", kind: "gateway", start: 8, dur: 14, health: "healthy" },
    { id: "s3", label: `CRM API (${meta.service})`, kind: "service", start: 22, dur: meta.total - 30, health: meta.health },
    { id: "s4", label: "Redis", kind: "cache", start: 30, dur: 11, health: "healthy" },
    { id: "s5", label: "PostgreSQL", kind: "db", start: 50, dur: Math.round(meta.total * (bad ? 0.7 : 0.4)), health: bad ? "critical" : "degraded", detail: bad ? "slow query / timeout" : "query ok" },
  ];
  return { ...meta, spans };
}

export default function TraceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const t = buildTrace(id);
  const [sel, setSel] = useState<string | null>(null);
  if (!t) return notFound();
  const total = t.total;
  const selSpan = t.spans.find((s) => s.id === sel);
  const relLogs = LOGS.filter((l) => l.traceId === t.id);
  const incident = INCIDENTS.find((i) => i.trace === t.id);

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title={`Trace ${t.id}`} sub={`${t.endpoint} · ${t.total}ms · ${t.ts}`}
        crumbs={[{ label: "Traces", href: "/traces" }, { label: t.id }]}
        right={<span className="font-mono font-bold" style={{ color: t.status >= 500 ? "rgb(var(--down))" : "rgb(var(--ok))" }}>HTTP {t.status}</span>} />

      <div className="mb-3">
        <Related items={[
          { label: `Service ${t.service}`, href: `/service-health/${t.service}` },
          { label: "Logs", href: "/logs" },
          ...(incident ? [{ label: `Incident ${incident.id}`, href: `/incidents/${incident.id}` }] : []),
          { label: "Database", href: "/databases/crm-prod-db" },
        ]} />
      </div>

      <Panel title="Span waterfall">
        <div className="overflow-x-auto p-3">
         <div className="min-w-[520px]">
          {t.spans.map((s) => {
            const left = (s.start / total) * 100;
            const width = Math.max(1.5, (s.dur / total) * 100);
            const active = sel === s.id;
            return (
              <button key={s.id} onClick={() => setSel(active ? null : s.id)} className="group flex w-full items-center gap-3 rounded px-1 py-1 text-left transition-colors hover:bg-panel2 cursor-pointer">
                <span className="flex w-40 shrink-0 items-center gap-2 text-xs sm:w-56">
                  <Dot health={s.health} />
                  <span className="truncate">{s.label}</span>
                </span>
                <span className="relative h-4 flex-1 rounded bg-panel2">
                  <span className="absolute top-0 h-4 rounded" style={{ left: `${left}%`, width: `${width}%`, background: HEALTH_COLOR[s.health], opacity: active ? 1 : 0.75 }} />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-2xs tabular-nums" style={{ color: s.dur > total * 0.4 ? "rgb(var(--down))" : "rgb(var(--muted))" }}>{s.dur}ms</span>
              </button>
            );
          })}
         </div>
        </div>
        {selSpan && (
          <div className="border-t border-line bg-panel2/40 px-4 py-3 text-xs">
            <div className="mb-1 flex items-center gap-2"><Dot health={selSpan.health} /><span className="font-semibold">{selSpan.label}</span><span className="font-mono text-2xs text-muted">{selSpan.kind} · {selSpan.dur}ms</span></div>
            {selSpan.detail && <p className="font-mono text-2xs text-muted">{selSpan.detail}</p>}
            {selSpan.kind === "db" && <a href="/databases/crm-prod-db" className="mt-1 inline-block text-2xs text-accent hover:underline cursor-pointer">→ Open database dashboard</a>}
          </div>
        )}
      </Panel>

      <div className="mt-3">
        <Panel title="Logs for this trace" count={`${relLogs.length}`}>
          {relLogs.length === 0 ? <p className="px-4 py-3 text-xs text-muted">No correlated logs.</p> : (
            <div className="divide-y divide-line">
              {relLogs.map((l, i) => (
                <div key={i} className="flex gap-3 px-4 py-2 font-mono text-2xs">
                  <span className="shrink-0 text-muted">{l.ts}</span>
                  <span className="shrink-0 font-bold" style={{ color: l.level === "ERROR" ? "rgb(var(--down))" : l.level === "WARN" ? "rgb(var(--warn))" : "rgb(var(--muted))" }}>{l.level}</span>
                  <span className="break-all">{l.msg}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
