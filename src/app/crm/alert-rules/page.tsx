"use client";

import { PageHead, Panel, Dot, Sev } from "@/components/kit";

const RULES = [
  { id: "r1", target: "API · /api/v1/customers", cond: "5xx > 5% for 5m", sev: "P1", enabled: true, fires: "ALT-8801" },
  { id: "r2", target: "API · all", cond: "P95 latency > 1s for 10m", sev: "P2", enabled: true },
  { id: "r3", target: "API · availability", cond: "< 99.9%", sev: "P1", enabled: true },
  { id: "r4", target: "DB · crm-prod-db", cond: "CPU > 90% for 10m", sev: "P2", enabled: true, fires: "ALT-8803" },
  { id: "r5", target: "DB · crm-prod-db", cond: "free storage < 15%", sev: "P2", enabled: true },
  { id: "r6", target: "DB · crm-prod-db", cond: "connection utilization > 85%", sev: "P1", enabled: true, fires: "ALT-8802" },
  { id: "r7", target: "DB · replicas", cond: "replication lag > 3s", sev: "P3", enabled: true, fires: "ALT-8806" },
  { id: "r8", target: "Queue · all", cond: "depth > 10,000 or oldest > 10m", sev: "P2", enabled: true, fires: "ALT-8805" },
  { id: "r9", target: "Lambda · all", cond: "error rate > 5% or throttles > 0", sev: "P2", enabled: true },
  { id: "r10", target: "Backup", cond: "no successful backup within window", sev: "P1", enabled: false },
];

export default function AlertRulesPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title="Alert Rules" sub="Threshold and condition rules across APIs, database, queues, Lambda, and backups." crumbs={[{ label: "Operations", href: "/crm" }, { label: "Alert Rules" }]} />
      <Panel title="Rules" count={`${RULES.length}`}>
        <div className="divide-y divide-line">
          {RULES.map((r) => (
            <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
              <Sev level={r.sev} />
              <span className="min-w-0 flex-1"><span className="block truncate font-medium">{r.cond}</span><span className="text-2xs text-muted">{r.target}</span></span>
              {r.fires && <a href="/crm/alerts" className="rounded border border-line px-1.5 py-0.5 text-2xs text-muted hover:text-ink cursor-pointer">{r.fires}</a>}
              <span className="flex items-center gap-1.5 text-2xs" style={{ color: r.enabled ? "rgb(var(--ok))" : "rgb(var(--idle))" }}><span className="h-1.5 w-1.5 rounded-full" style={{ background: r.enabled ? "rgb(var(--ok))" : "rgb(var(--idle))" }} />{r.enabled ? "enabled" : "disabled"}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
