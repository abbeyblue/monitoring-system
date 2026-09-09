"use client";

import Link from "next/link";
import { PageHead, Panel, Sev, Dot } from "@/components/kit";
import { INCIDENTS } from "@/lib/mock";

export default function IncidentsPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock sub="Correlated incidents — symptoms deduplicated into a single root-cause record with timeline and evidence." />
      <Panel title="Incidents" count={`${INCIDENTS.length}`}>
        <div className="divide-y divide-line">
          {INCIDENTS.map((i) => (
            <Link key={i.id} href={`/incidents/${i.id}`} className="flex items-center gap-3 px-4 py-3 text-xs transition-colors hover:bg-panel2 cursor-pointer">
              <Sev level={i.severity} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{i.title}</span>
                <span className="text-2xs text-muted">{i.id} · {i.services.join(", ")} · {i.affectedUsers.toLocaleString()} users · {i.alerts.length} alerts</span>
              </span>
              <span className="shrink-0 rounded-md border border-line px-2 py-0.5 text-2xs text-muted">{i.status}</span>
              <span className="w-14 shrink-0 text-right text-2xs text-muted">{i.duration}</span>
            </Link>
          ))}
        </div>
      </Panel>
    </div>
  );
}
