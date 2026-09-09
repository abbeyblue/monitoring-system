"use client";

import { PageHead, Panel, Dot } from "@/components/kit";
import { JOBS } from "@/lib/mock";

export default function JobsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title="Background Jobs" sub="Async workers — status, duration, retries, and last successful run." crumbs={[{ label: "CRM", href: "/crm" }, { label: "Background Jobs" }]} />
      <Panel title="Jobs" count={`${JOBS.length}`} status="critical">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs">
          <thead><tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-muted"><th className="px-3 py-2">Job</th><th className="px-3 py-2">Last run</th><th className="px-3 py-2">Duration</th><th className="px-3 py-2">Retries</th><th className="px-3 py-2">Worker</th><th className="px-3 py-2">Error</th></tr></thead>
          <tbody>{JOBS.map((j) => (
            <tr key={j.id} className="border-b border-line/60 last:border-0">
              <td className="px-3 py-2"><span className="flex items-center gap-2"><Dot health={j.health} />{j.name}</span></td>
              <td className="px-3 py-2 font-mono text-2xs text-muted">{j.last}</td>
              <td className="px-3 py-2" style={{ color: j.success ? undefined : "rgb(var(--down))" }}>{j.duration}</td>
              <td className="px-3 py-2 font-mono">{j.retries}</td>
              <td className="px-3 py-2 text-muted">{j.worker}</td>
              <td className="px-3 py-2 text-2xs" style={{ color: j.error === "—" ? "rgb(var(--muted))" : "rgb(var(--down))" }}>{j.error}</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}
