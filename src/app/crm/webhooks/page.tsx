"use client";

import { PageHead, Panel, Dot } from "@/components/kit";
import { WEBHOOKS } from "@/lib/mock";

export default function WebhooksPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock title="Webhooks" sub="Inbound webhook processing — received, processed, failed, retried, duplicates, and signature failures." crumbs={[{ label: "CRM", href: "/crm" }, { label: "Webhooks" }]} />
      <Panel title="Webhook events" count={`${WEBHOOKS.length}`} status="degraded">
        <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-xs">
          <thead><tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-muted"><th className="px-3 py-2">Event</th><th className="px-3 py-2">Received</th><th className="px-3 py-2">Processed</th><th className="px-3 py-2">Failed</th><th className="px-3 py-2">Retried</th><th className="px-3 py-2">Dup</th><th className="px-3 py-2">Sig fail</th><th className="px-3 py-2">DLQ</th><th className="px-3 py-2">Latency</th></tr></thead>
          <tbody>{WEBHOOKS.map((w) => (
            <tr key={w.id} className="border-b border-line/60 last:border-0">
              <td className="px-3 py-2 font-mono"><span className="flex items-center gap-2"><Dot health={w.failed > 10 ? "degraded" : "healthy"} />{w.name}</span></td>
              <td className="px-3 py-2 font-mono">{w.received.toLocaleString()}</td>
              <td className="px-3 py-2 font-mono">{w.processed.toLocaleString()}</td>
              <td className="px-3 py-2 font-mono" style={{ color: w.failed > 0 ? "rgb(var(--down))" : undefined }}>{w.failed}</td>
              <td className="px-3 py-2 font-mono">{w.retried}</td>
              <td className="px-3 py-2 font-mono">{w.dup}</td>
              <td className="px-3 py-2 font-mono" style={{ color: w.sigFail > 0 ? "rgb(var(--warn))" : undefined }}>{w.sigFail}</td>
              <td className="px-3 py-2 font-mono" style={{ color: w.dlq > 0 ? "rgb(var(--warn))" : undefined }}>{w.dlq}</td>
              <td className="px-3 py-2 font-mono text-muted">{w.latency}ms</td>
            </tr>
          ))}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}
