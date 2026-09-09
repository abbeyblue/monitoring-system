"use client";

import { PageHead, Panel } from "@/components/kit";
import { AUDIT_LOGS } from "@/lib/mock";

export default function AuditLogsPage() {
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHead mock title="Audit Logs" sub="Immutable-style trail of significant actions — who did what, when, from where, with the request id." crumbs={[{ label: "Users", href: "/users" }, { label: "Audit Logs" }]} />
      <Panel title="Audit trail" count={`${AUDIT_LOGS.length}`}>
        <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-xs">
          <thead><tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-muted"><th className="px-3 py-2">Time</th><th className="px-3 py-2">User</th><th className="px-3 py-2">Action</th><th className="px-3 py-2">Target</th><th className="px-3 py-2">Changed</th><th className="px-3 py-2">Source</th><th className="px-3 py-2">Request</th></tr></thead>
          <tbody>{AUDIT_LOGS.map((a) => (
            <tr key={a.id} className="border-b border-line/60 last:border-0">
              <td className="px-3 py-2 font-mono text-2xs text-muted">{a.at}</td>
              <td className="px-3 py-2">{a.user}</td>
              <td className="px-3 py-2"><span className="rounded border border-line px-1.5 py-0.5 font-mono text-2xs">{a.action}</span></td>
              <td className="px-3 py-2 font-mono text-2xs text-muted">{a.target}</td>
              <td className="px-3 py-2 text-muted">{a.fields}</td>
              <td className="px-3 py-2 text-muted">{a.source}</td>
              <td className="px-3 py-2"><a href={`/crm/logs?q=${a.requestId}`} className="font-mono text-2xs text-accent hover:underline cursor-pointer">{a.requestId}</a></td>
            </tr>
          ))}</tbody>
        </table></div>
      </Panel>
    </div>
  );
}
