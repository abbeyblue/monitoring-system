"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import { PageHead, Panel, Sev, Dot, Related } from "@/components/kit";
import { INCIDENTS, ALERTS, DEPLOYMENTS } from "@/lib/mock";

const KIND_COLOR: Record<string, string> = { deploy: "rgb(var(--accent))", alert: "rgb(var(--warn))", incident: "rgb(var(--down))", action: "rgb(var(--ink))", recovery: "rgb(var(--ok))", note: "rgb(var(--muted))" };

export default function IncidentDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const inc = INCIDENTS.find((i) => i.id === id);
  if (!inc) return notFound();
  const alerts = ALERTS.filter((a) => inc.alerts.includes(a.id));
  const deploy = inc.deployment ? DEPLOYMENTS.find((d) => d.id === inc.deployment) : undefined;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title={inc.title} sub={`${inc.id} · started ${inc.start} · ${inc.duration} · ${inc.impact}`}
        crumbs={[{ label: "Incidents", href: "/crm/incidents" }, { label: inc.id }]}
        right={<span className="flex items-center gap-2"><Sev level={inc.severity} /><span className="rounded-md border border-line px-2 py-0.5 text-2xs text-muted">{inc.status}</span></span>} />

      <div className="mb-3">
        <Related items={[
          ...(deploy ? [{ label: `Deploy ${deploy.version}`, href: `/crm/deployments/${deploy.id}` }] : []),
          ...(inc.trace ? [{ label: `Trace ${inc.trace}`, href: `/crm/traces/${inc.trace}` }] : []),
          { label: "Database", href: "/crm/databases/crm-prod-db" },
          { label: "Logs", href: "/crm/logs" },
          ...(inc.runbook ? [{ label: `Runbook`, href: `/crm/runbooks#${inc.runbook}` }] : []),
        ]} />
      </div>

      {/* meta strip */}
      <div className="mb-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Meta label="Affected users" value={inc.affectedUsers.toLocaleString()} />
        <Meta label="Services" value={inc.services.join(", ")} />
        <Meta label="Owner" value={inc.owner} />
        <Meta label="Confidence" value={`${inc.confidence}%`} />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* root cause chain */}
        <Panel title="Root-cause analysis" status="critical" right={<span className="text-2xs text-muted">{inc.confidence}% confidence · {inc.confirmedCause ? "confirmed" : "inferred"}</span>}>
          <div className="p-4">
            {inc.rootChain.map((r, i) => (
              <div key={i} className="relative pl-6">
                <span className="absolute left-1 top-1 h-2 w-2 rounded-full" style={{ background: i === inc.rootChain.length - 1 ? "rgb(var(--down))" : "rgb(var(--warn))" }} />
                {i < inc.rootChain.length - 1 && <span className="absolute left-[7px] top-3 h-full w-px bg-line" />}
                <div className="pb-3">
                  <div className="text-xs font-medium">{r.label}</div>
                  <div className="text-2xs text-muted">{r.detail}</div>
                </div>
              </div>
            ))}
            <div className="mt-1 rounded-md border border-line bg-panel2/50 p-2.5 text-2xs">
              <div className="text-muted">Suspected cause</div>
              <div className="mt-0.5">{inc.suspectedCause}</div>
              {inc.confirmedCause && <><div className="mt-2 text-muted">Confirmed cause</div><div className="mt-0.5 text-ok">{inc.confirmedCause}</div></>}
            </div>
          </div>
        </Panel>

        {/* timeline */}
        <Panel title="Timeline">
          <div className="p-4">
            {inc.timeline.map((t, i) => (
              <div key={i} className="relative flex gap-3 pl-1 pb-3 last:pb-0">
                <span className="w-12 shrink-0 pt-0.5 text-right font-mono text-2xs text-muted">{t.at}</span>
                <span className="relative">
                  <span className="block h-2 w-2 translate-y-1 rounded-full" style={{ background: KIND_COLOR[t.kind] }} />
                  {i < inc.timeline.length - 1 && <span className="absolute left-[3px] top-3 h-full w-px bg-line" />}
                </span>
                <span className="text-xs">{t.text}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* alerts + responders */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Correlated alerts" count={`${alerts.length}`}>
          <div className="divide-y divide-line">
            {alerts.map((a) => (
              <a key={a.id} href="/crm/alerts" className="flex items-center gap-2 px-4 py-2.5 text-xs transition-colors hover:bg-panel2 cursor-pointer">
                <Sev level={a.severity} /><span className="truncate">{a.title}</span>
                <span className="ml-auto text-2xs text-muted">{a.status} · {a.start}</span>
              </a>
            ))}
          </div>
        </Panel>
        <Panel title="Responders & notifications">
          <div className="p-4 text-xs">
            <div className="mb-2"><span className="text-2xs uppercase tracking-wider text-muted">Responders</span>
              <div className="mt-1 flex flex-wrap gap-1.5">{inc.responders.map((r) => <span key={r} className="rounded-md border border-line bg-panel2 px-2 py-0.5 text-2xs">{r}</span>)}</div>
            </div>
            <div className="mt-3 space-y-1.5 text-2xs text-muted">
              <div className="flex items-center gap-2"><Dot health="healthy" /> On-call notified via PagerDuty + Slack at {inc.start}</div>
              <div className="flex items-center gap-2"><Dot health="healthy" /> Acknowledged by {inc.owner}</div>
              <div className="flex items-center gap-2"><Dot health="degraded" /> Slack channel #inc-{inc.id.toLowerCase()} opened</div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-line bg-panel p-3"><div className="text-2xs uppercase tracking-wider text-muted">{label}</div><div className="mt-1 text-sm font-semibold">{value}</div></div>;
}
