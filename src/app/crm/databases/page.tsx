"use client";

import Link from "next/link";
import { PageHead, Panel, Dot, Pill } from "@/components/kit";
import { DATABASES } from "@/lib/mock";

export default function DatabasesPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title="Databases" sub="CRM databases with CPU, storage, and connection saturation. Open one for the full dashboard." crumbs={[{ label: "Services", href: "/crm/service-health" }, { label: "Databases" }]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DATABASES.map((d) => (
          <Link key={d.id} href={`/crm/databases/${d.id}`} className="block cursor-pointer">
            <div className="rounded-lg border border-line bg-panel p-4 shadow-panel transition-colors hover:border-accent/50">
              <div className="flex items-center gap-2">
                <Dot health={d.health} /><span className="text-sm font-semibold">{d.name}</span>
                <span className="ml-auto"><Pill health={d.health} /></span>
              </div>
              <p className="mt-1 text-2xs text-muted">{d.engine} · {d.region}</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <Bar label="CPU" pct={d.cpu} />
                <Bar label="Storage" pct={d.storagePct} />
                <Bar label="Conns" pct={d.connectionsPct} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Bar({ label, pct }: { label: string; pct: number }) {
  const c = pct >= 90 ? "down" : pct >= 75 ? "warn" : "ok";
  return (
    <div>
      <div className="flex justify-between text-2xs"><span className="text-muted">{label}</span><span className="font-mono tabular-nums">{pct}%</span></div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel2"><span className="block h-full rounded-full" style={{ width: `${pct}%`, background: `rgb(var(--${c}))` }} /></div>
    </div>
  );
}
