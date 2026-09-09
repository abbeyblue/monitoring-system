"use client";

import { PageHead, Panel, Sev } from "@/components/kit";
import { ALERTS } from "@/lib/mock";

const ST: Record<string, string> = { firing: "rgb(var(--down))", acknowledged: "rgb(var(--warn))", resolved: "rgb(var(--ok))" };

export default function AlertsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title="Alerts" sub="Active and recent alerts. Symptoms are correlated into incidents so one failure doesn't page ten times." crumbs={[{ label: "Incidents", href: "/crm/incidents" }, { label: "Alerts" }]} />
      <Panel title="Alerts" count={`${ALERTS.length}`}>
        <div className="divide-y divide-line">
          {ALERTS.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-xs">
              <Sev level={a.severity} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{a.title}</span>
                <span className="text-2xs text-muted">{a.id} · {a.service} · {a.value} vs {a.threshold} · {a.start}</span>
              </span>
              {a.runbook && <a href={`/crm/runbooks#${a.runbook}`} className="rounded border border-line px-1.5 py-0.5 text-2xs text-muted hover:text-ink cursor-pointer">runbook</a>}
              {a.incident && <a href={`/crm/incidents/${a.incident}`} className="rounded border border-down/40 px-1.5 py-0.5 text-2xs text-down cursor-pointer">{a.incident}</a>}
              <span className="w-24 text-right text-2xs font-semibold uppercase" style={{ color: ST[a.status] }}>{a.status}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
