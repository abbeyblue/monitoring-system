"use client";

import { PageHead, Panel, Dot, Pill } from "@/components/kit";
import { INFRA } from "@/lib/mock";

export default function InfraPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title="Infrastructure" sub="ECS services, Lambda functions, and EC2 instances." crumbs={[{ label: "Observability", href: "/crm" }, { label: "Infrastructure" }]} />

      <Panel title="ECS services" status="critical">
        <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-xs">
          <thead><tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-muted"><th className="px-3 py-2">Service</th><th className="px-3 py-2">Tasks</th><th className="px-3 py-2">CPU</th><th className="px-3 py-2">Mem</th><th className="px-3 py-2">Restarts</th><th className="px-3 py-2">Status</th></tr></thead>
          <tbody>{INFRA.ecs.map((e) => (
            <tr key={e.id} className="border-b border-line/60 last:border-0"><td className="px-3 py-2 flex items-center gap-2"><Dot health={e.health} />{e.name}</td><td className="px-3 py-2 font-mono">{e.running}/{e.desired}{e.failed ? <span className="text-down"> ({e.failed} failed)</span> : null}</td><td className="px-3 py-2 font-mono">{e.cpu}%</td><td className="px-3 py-2 font-mono">{e.mem}%</td><td className="px-3 py-2 font-mono">{e.restarts}</td><td className="px-3 py-2"><Pill health={e.health} /></td></tr>
          ))}</tbody>
        </table></div>
      </Panel>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Lambda" status="critical">
          <div className="divide-y divide-line">{INFRA.lambda.map((l) => (
            <div key={l.id} className="flex items-center gap-2 px-4 py-2.5 text-xs"><Dot health={l.health} /><span className="font-mono">{l.name}</span><span className="ml-auto flex gap-3 text-2xs text-muted"><span>{l.invocations.toLocaleString()} inv</span><span style={{ color: l.errors > 100 ? "rgb(var(--down))" : undefined }}>{l.errors} err</span><span>p95 {l.p95}ms</span></span></div>
          ))}</div>
        </Panel>
        <Panel title="EC2">
          <div className="divide-y divide-line">{INFRA.ec2.map((e) => (
            <div key={e.id} className="flex items-center gap-2 px-4 py-2.5 text-xs"><Dot health={e.health} /><span className="font-mono">{e.name}</span><span className="ml-auto flex gap-3 text-2xs text-muted"><span>CPU {e.cpu}%</span><span>Mem {e.mem}%</span><span>Disk {e.disk}%</span></span></div>
          ))}</div>
        </Panel>
      </div>
    </div>
  );
}
