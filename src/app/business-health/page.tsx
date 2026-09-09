"use client";

import { useState } from "react";
import { PageHead, MockBadge } from "@/components/kit";
import { useBusiness, BizGrid, BizFreshness } from "@/components/use-business";

const PERIODS = ["month", "quarter", "year", "all"] as const;
const GROUPS: { key: string; title: string; caption: string }[] = [
  { key: "executive", title: "Executive", caption: "revenue, outstanding, overdue deadlines" },
  { key: "financial", title: "Financial", caption: "payments & follow-ups" },
  { key: "support", title: "Customer & support", caption: "deadlines, stagnant cases, service inbox" },
  { key: "security", title: "Security", caption: "authentication" },
];

export default function BusinessHealthPage() {
  const [period, setPeriod] = useState<string>("month");
  const { data, loading } = useBusiness(period);
  const configured = data?.configured;

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead title="Business Health" sub="Live KPIs from the CRM's own analytics endpoints — revenue, payments, cases, and security."
        crumbs={[{ label: "CRM", href: "/" }, { label: "Business Health" }]}
        right={
          <div className="flex items-center gap-3">
            <BizFreshness data={data} />
            <div className="flex rounded-md border border-line bg-panel2 p-0.5">
              {PERIODS.map((p) => (
                <button key={p} onClick={() => setPeriod(p)} className={`rounded px-2 py-1 text-2xs font-medium capitalize transition-colors cursor-pointer ${period === p ? "bg-panel text-ink" : "text-muted hover:text-ink"}`}>{p}</button>
              ))}
            </div>
          </div>
        } />

      {data && !configured ? (
        <div className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-xs text-warn">
          Not connected. Set <span className="font-mono">CRM_BASE_URL</span> and a super-admin <span className="font-mono">MONITOR_SESSION_COOKIE</span> in <span className="font-mono">.env.local</span> — these KPIs then read the CRM's real analytics endpoints (revenue, payment-followup, deadlines, governance, security-overview).
        </div>
      ) : (
        <div className="space-y-5">
          {GROUPS.map((g) => (
            <div key={g.key}>
              <div className="mb-2 flex items-center gap-2">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">{g.title}</h2>
                <span className="text-2xs text-muted">{g.caption}</span>
              </div>
              <BizGrid kpis={(data?.kpis ?? []).filter((k) => k.groups.includes(g.key))} base={data?.crmBase ?? null} loading={loading} />
            </div>
          ))}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted">Sales & pipeline · Team & HR</h2>
              <MockBadge label="integration pending" />
            </div>
            <p className="rounded-lg border border-line bg-panel px-4 py-3 text-xs text-muted">
              Sales performance, commission, funnel conversion, and HR attendance are available in the CRM
              (<span className="font-mono">/api/analytics/performance</span>, <span className="font-mono">/api/sales/commission-summary</span>, <span className="font-mono">/api/analytics/marketing/funnel</span>, <span className="font-mono">/api/hr/attendance</span>) and are the next wiring pass — not shown here rather than shown as fake.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
