"use client";

import Link from "next/link";
import { PageHead, Panel, Dot } from "@/components/kit";
import { TRACES } from "@/lib/mock";

export default function TracesPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title="Traces" sub="Distributed traces across CloudFront → API Gateway → service → cache → database → queue → worker. Open a trace for the span waterfall." crumbs={[{ label: "Observability", href: "/crm" }, { label: "Traces" }]} />
      <Panel title="Recent traces" count={`${TRACES.length}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-xs">
            <thead><tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-muted">
              <th className="px-3 py-2">Trace ID</th><th className="px-3 py-2">Endpoint</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Duration</th><th className="px-3 py-2">Service</th><th className="px-3 py-2">Time</th>
            </tr></thead>
            <tbody>
              {TRACES.map((t) => (
                <tr key={t.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-panel2">
                  <td className="px-3 py-2"><Link href={`/crm/traces/${t.id}`} className="flex items-center gap-2 font-mono text-2xs cursor-pointer"><Dot health={t.health} />{t.id}</Link></td>
                  <td className="px-3 py-2 font-mono text-2xs text-muted">{t.endpoint}</td>
                  <td className="px-3 py-2"><span className="font-mono font-bold" style={{ color: t.status >= 500 ? "rgb(var(--down))" : t.status >= 400 ? "rgb(var(--warn))" : "rgb(var(--ok))" }}>{t.status}</span></td>
                  <td className="px-3 py-2 font-mono tabular-nums" style={{ color: t.total > 1500 ? "rgb(var(--down))" : "rgb(var(--muted))" }}>{t.total}ms</td>
                  <td className="px-3 py-2 text-muted">{t.service}</td>
                  <td className="px-3 py-2 font-mono text-2xs text-muted">{t.ts}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
