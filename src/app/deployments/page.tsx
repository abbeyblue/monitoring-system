"use client";

import Link from "next/link";
import { PageHead, Panel, Dot, Delta } from "@/components/kit";
import { DEPLOYMENTS } from "@/lib/mock";

export default function DeploymentsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title="Deployments" sub="Every release correlated with error rate, latency, and resource deltas against the prior version." crumbs={[{ label: "Incidents", href: "/incidents" }, { label: "Deployments" }]} />
      <Panel title="Deployments" count={`${DEPLOYMENTS.length}`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-xs">
            <thead><tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-muted">
              <th className="px-3 py-2">Version</th><th className="px-3 py-2">Env</th><th className="px-3 py-2">Services</th><th className="px-3 py-2">Deployer</th><th className="px-3 py-2">Time</th><th className="px-3 py-2">Δ Error</th><th className="px-3 py-2">Δ P95</th><th className="px-3 py-2">Status</th>
            </tr></thead>
            <tbody>
              {DEPLOYMENTS.map((d) => (
                <tr key={d.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-panel2">
                  <td className="px-3 py-2"><Link href={`/deployments/${d.id}`} className="flex items-center gap-2 cursor-pointer"><Dot health={d.status} /><span className="font-medium">{d.version}</span><span className="font-mono text-2xs text-muted">{d.commit}</span>{d.rollback && <span className="rounded border border-down/40 px-1 text-[10px] text-down">rollback</span>}</Link></td>
                  <td className="px-3 py-2 text-muted">{d.env}</td>
                  <td className="px-3 py-2 text-muted">{d.services.join(", ")}</td>
                  <td className="px-3 py-2 text-muted">{d.deployer}</td>
                  <td className="px-3 py-2 font-mono text-2xs text-muted">{d.start}</td>
                  <td className="px-3 py-2"><Delta value={d.errDelta} unit="%" /></td>
                  <td className="px-3 py-2"><Delta value={d.latDelta} unit="ms" /></td>
                  <td className="px-3 py-2">{d.incident ? <a href={`/incidents/${d.incident}`} className="rounded border border-down/40 px-1 text-2xs text-down cursor-pointer">{d.incident}</a> : <span className="text-2xs text-ok">clean</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}
