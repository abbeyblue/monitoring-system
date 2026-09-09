"use client";

import { PageHead, Panel, StateBadge } from "@/components/kit";

// Session / authentication monitoring. The design specifies this screen, but
// nothing in this app exposes CRM session data yet — there is no sessions
// adapter in src/lib/adapters.ts and no session endpoint in the CRM registry.
// Per the project's no-fabrication rule this renders the honest unconfigured
// state rather than sample rows.
// ponytail: the design's filter pills, search and 6-column table land with the
// data source; building the chrome now would be shell with nothing behind it.
const NEEDED = [
  ["Active sessions", "Who is signed in now, and for how long"],
  ["Sign-in history", "Successful and failed authentications, with source IP"],
  ["Per-user activity", "Last action and the record being worked on"],
];

export default function UsersPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead title="Sessions" sub="Who is signed in to the CRM right now." />
      <Panel title="Session source" right={<StateBadge state="not-configured" />}>
        <div className="px-5 py-5">
          <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-muted">
            No session data source is connected. This page stays empty rather than showing
            sample users, so nothing here can be mistaken for live sign-in activity.
          </p>
          <p className="mt-3 max-w-[70ch] text-[13.5px] leading-relaxed text-muted">
            Connecting one means adding a sessions endpoint to the CRM registry
            (<code className="font-mono text-[12px] text-ink2">src/lib/crm-registry.ts</code>) and an
            adapter in <code className="font-mono text-[12px] text-ink2">src/lib/adapters.ts</code>, the
            same shape the business KPIs already use.
          </p>
          <div className="mt-5 divide-y divide-line2 border-t border-line2">
            {NEEDED.map(([label, note]) => (
              <div key={label} className="flex items-center gap-4 py-3">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full border border-muted2/40" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-[13.5px] font-medium">{label}</span>
                  <span className="text-[11.5px] text-muted">{note}</span>
                </span>
                <span className="ml-auto font-mono text-[11.5px] text-muted2">no source</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>
      <p className="mt-4 text-[12.5px] text-muted">
        Authentication anomalies and the action trail that <em>are</em> available live under{" "}
        <span className="text-ink2">Security Events</span> and <span className="text-ink2">Audit Logs</span>.
      </p>
    </div>
  );
}
