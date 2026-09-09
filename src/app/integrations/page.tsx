"use client";

import { PageHead, Dot, Pill } from "@/components/kit";
import { INTEGRATIONS } from "@/lib/mock";

export default function IntegrationsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title="Integrations" sub="Third-party and downstream systems — availability, success rate, latency, and sync lag." crumbs={[{ label: "Services", href: "/service-health" }, { label: "Integrations" }]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {INTEGRATIONS.map((it) => (
          <div key={it.id} className="rounded-lg border border-line bg-panel p-4 shadow-panel">
            <div className="flex items-center gap-2"><Dot health={it.health} /><span className="text-sm font-semibold">{it.name}</span><span className="ml-auto"><Pill health={it.health} /></span></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div><div className="text-2xs text-muted">Success</div><div className="font-mono" style={{ color: it.successRate < 95 ? "rgb(var(--down))" : undefined }}>{it.successRate}%</div></div>
              <div><div className="text-2xs text-muted">Latency</div><div className="font-mono">{it.latency}ms</div></div>
              <div><div className="text-2xs text-muted">Last sync</div><div className="font-mono">{it.lastSync}</div></div>
              <div><div className="text-2xs text-muted">Lag</div><div className="font-mono" style={{ color: it.lag.includes("h") ? "rgb(var(--down))" : undefined }}>{it.lag}</div></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
