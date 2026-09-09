"use client";

import { PageHead, Dot, Pill } from "@/components/kit";
import { QUEUES } from "@/lib/mock";

export default function QueuesPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title="Queues" sub="SQS and async queues — depth, in-flight, oldest message age, failure rate, and dead-letter counts." crumbs={[{ label: "Services", href: "/crm/service-health" }, { label: "Queues" }]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUEUES.map((q) => (
          <div key={q.id} className="rounded-lg border border-line bg-panel p-4 shadow-panel">
            <div className="flex items-center gap-2"><Dot health={q.health} /><span className="truncate text-sm font-semibold">{q.name}</span></div>
            <div className="mt-3 space-y-1.5 text-xs">
              <Row k="Messages" v={q.depth.toLocaleString()} />
              <Row k="In flight" v={String(q.inflight)} />
              <Row k="Oldest" v={q.oldest} bad={q.oldest.includes("m")} />
              <Row k="Rate" v={`${q.rate}/min`} />
              <Row k="Failures" v={`${q.failRate}%`} bad={q.failRate > 1} />
              <Row k="DLQ" v={String(q.dlq)} bad={q.dlq > 0} />
              <Row k="Consumers" v={String(q.consumers)} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ k, v, bad }: { k: string; v: string; bad?: boolean }) {
  return <div className="flex justify-between"><span className="text-muted">{k}</span><span className="font-mono tabular-nums" style={{ color: bad ? "rgb(var(--down))" : undefined }}>{v}</span></div>;
}
