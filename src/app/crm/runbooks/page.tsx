"use client";

import { PageHead, Panel } from "@/components/kit";
import { RUNBOOKS } from "@/lib/mock";

export default function RunbooksPage() {
  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHead mock title="Runbooks" sub="Step-by-step remediation guides, linked directly from alerts and incidents." crumbs={[{ label: "Incidents", href: "/crm/incidents" }, { label: "Runbooks" }]} />
      <div className="space-y-3">
        {RUNBOOKS.map((rb) => (
          <div key={rb.id} id={rb.id} className="scroll-mt-20">
            <Panel title={rb.title}>
              <ol className="divide-y divide-line">
                {rb.steps.map((s, i) => (
                  <li key={i} className="flex gap-3 px-4 py-2 text-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent/15 font-mono text-2xs font-bold text-accent">{i + 1}</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ol>
            </Panel>
          </div>
        ))}
      </div>
    </div>
  );
}
