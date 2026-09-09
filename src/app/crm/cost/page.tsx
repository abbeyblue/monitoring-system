"use client";

import { PageHead, Panel, Stat, Delta } from "@/components/kit";
import { COST } from "@/lib/mock";

export default function CostPage() {
  const total = COST.byService.reduce((a, s) => a + s.value, 0);
  const max = Math.max(...COST.byService.map((s) => s.value));
  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHead mock title="Cost" sub="AWS spend by service, anomalies, and unit economics." crumbs={[{ label: "Platform", href: "/crm" }, { label: "Cost" }]} />
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Daily cost" value={`$${COST.daily.toLocaleString()}`} />
        <Stat label="Monthly (MTD)" value={`$${COST.monthly.toLocaleString()}`} delta={<Delta value={COST.mtdDelta} unit="%" />} health={COST.mtdDelta > 5 ? "degraded" : "healthy"} />
        <Stat label="Cost / customer" value={`$${COST.perCustomer}`} />
        <Stat label="Cost / request" value={`$${COST.perRequest}`} />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Spend by service" count={`$${total.toLocaleString()} / mo`}>
          <div className="space-y-2 p-4">
            {COST.byService.map((s) => (
              <div key={s.name} className="text-xs">
                <div className="mb-1 flex justify-between"><span>{s.name}</span><span className="font-mono text-muted">${s.value.toLocaleString()}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-panel2"><span className="block h-full rounded-full bg-accent/70" style={{ width: `${(s.value / max) * 100}%` }} /></div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Cost anomalies" status="degraded">
          <div className="divide-y divide-line">
            {COST.anomalies.map((a, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3 text-xs"><span className="font-mono text-2xs text-muted">{a.at}</span><span>{a.text}</span></div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
