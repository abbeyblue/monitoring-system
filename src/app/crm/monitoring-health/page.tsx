"use client";

import { PageHead, Panel, Dot, Pill } from "@/components/kit";
import { MONITORING_HEALTH } from "@/lib/mock";

export default function MonitoringHealthPage() {
  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHead mock title="Monitoring Health" sub="The observability platform monitoring itself — ingestion pipelines, alert & notification engines, collectors." crumbs={[{ label: "Platform", href: "/crm" }, { label: "Monitoring Health" }]} />
      <Panel title="Subsystems" count={`${MONITORING_HEALTH.length}`} status={MONITORING_HEALTH.some((m) => m.health === "critical") ? "critical" : "degraded"}>
        <div className="grid grid-cols-1 divide-y divide-line sm:grid-cols-2 sm:divide-y-0">
          {MONITORING_HEALTH.map((m, i) => (
            <div key={m.id} className={`flex items-center gap-2 px-4 py-3 text-xs ${i % 2 === 0 ? "sm:border-r sm:border-line" : ""}`}>
              <Dot health={m.health} /><span className="font-medium">{m.name}</span><span className="ml-auto"><Pill health={m.health} /></span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
