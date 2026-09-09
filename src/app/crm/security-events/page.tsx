"use client";

import { PageHead, Panel } from "@/components/kit";
import { SECURITY_EVENTS } from "@/lib/mock";

const SEV: Record<string, string> = { high: "rgb(var(--down))", medium: "rgb(var(--warn))", low: "rgb(var(--idle))" };

export default function SecurityEventsPage() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHead mock title="Security Events" sub="Authentication and authorization anomalies, privilege changes, rate-limit violations, and sensitive-data access." crumbs={[{ label: "Users", href: "/users" }, { label: "Security Events" }]} />
      <Panel title="Events" count={`${SECURITY_EVENTS.length}`} status="degraded">
        <div className="divide-y divide-line">
          {SECURITY_EVENTS.map((e) => (
            <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
              <span className="w-16 shrink-0 text-2xs font-bold uppercase" style={{ color: SEV[e.severity] }}>{e.severity}</span>
              <span className="min-w-0 flex-1"><span className="block font-medium">{e.type}</span><span className="text-2xs text-muted">{e.detail}</span></span>
              <span className="shrink-0 font-mono text-2xs text-muted">{e.at}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
