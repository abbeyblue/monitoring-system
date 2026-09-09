"use client";

import { PageHead, Panel, Dot } from "@/components/kit";
import { CAPACITY } from "@/lib/mock";

export default function CapacityPage() {
  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHead mock title="Capacity" sub="Resource utilization and forecasts — when each resource is projected to reach its limit." crumbs={[{ label: "Services", href: "/service-health" }, { label: "Capacity" }]} />
      <Panel title="Resources" count={`${CAPACITY.length}`}>
        <div className="divide-y divide-line">
          {CAPACITY.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-4 py-3 text-xs">
              <Dot health={c.health} />
              <span className="w-44 shrink-0 font-medium">{c.name}</span>
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-panel2"><span className="block h-full rounded-full" style={{ width: `${c.used}%`, background: c.used >= 90 ? "rgb(var(--down))" : c.used >= 75 ? "rgb(var(--warn))" : "rgb(var(--ok))" }} /></span>
              <span className="w-12 shrink-0 text-right font-mono tabular-nums">{c.used}%</span>
              <span className="w-52 shrink-0 text-right text-2xs text-muted">{c.forecast}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
