"use client";

import { PageHead, Panel, Chart, HEALTH_COLOR as HC } from "@/components/kit";
import { SLOS } from "@/lib/mock";

export default function SloPage() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHead mock title="SLO / SLA" sub="Service-level objectives with error-budget tracking and burn rate." crumbs={[{ label: "Services", href: "/crm/service-health" }, { label: "SLO / SLA" }]} />
      <div className="space-y-3">
        {SLOS.map((s) => {
          const remainingPct = Math.round(((s.budgetTotalMin - s.budgetUsedMin) / s.budgetTotalMin) * 100);
          const met = s.status !== "critical";
          return (
            <Panel key={s.id} title={s.name} status={s.status} right={<span className="text-2xs" style={{ color: met ? "rgb(var(--ok))" : "rgb(var(--down))" }}>{met ? "on track" : "at risk"}</span>}>
              <div className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[1fr_1.4fr]">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <KV k="Target" v={`${s.target}${s.unit}`} />
                  <KV k="Current" v={`${s.current}${s.unit}`} bad={!met} />
                  <KV k="Budget total" v={`${s.budgetTotalMin} min`} />
                  <KV k="Budget used" v={`${s.budgetUsedMin} min`} bad={s.budgetUsedMin / s.budgetTotalMin > 0.6} />
                  <div className="col-span-2">
                    <div className="mb-1 flex justify-between text-2xs"><span className="text-muted">Error budget remaining</span><span className="font-mono">{remainingPct}%</span></div>
                    <div className="h-2 overflow-hidden rounded-full bg-panel2"><span className="block h-full rounded-full" style={{ width: `${remainingPct}%`, background: remainingPct < 30 ? "rgb(var(--down))" : remainingPct < 60 ? "rgb(var(--warn))" : "rgb(var(--ok))" }} /></div>
                    {remainingPct < 40 && <p className="mt-1.5 text-2xs text-warn">Burning error budget quickly — {remainingPct}% remaining this window.</p>}
                  </div>
                </div>
                <Chart data={s.series} color={HC[s.status]} height={120} threshold={s.target} unit={s.unit} />
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}

function KV({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return <div><div className="text-2xs text-muted">{k}</div><div className="font-mono text-sm" style={{ color: bad ? "rgb(var(--down))" : undefined }}>{v}</div></div>;
}
