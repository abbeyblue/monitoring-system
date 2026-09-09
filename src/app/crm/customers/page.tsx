"use client";

import { PageHead } from "@/components/kit";
import { useBusiness, BizGrid } from "@/components/use-business";

export default function CustomersPage() {
  const { data, loading } = useBusiness();
  const configured = data?.configured;
  const supportKpis = (data?.kpis ?? []).filter((k) => k.groups.includes("support"));

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHead title="Customers & Support" sub="Live case-load signals from the CRM — overdue deadlines, stagnant cases, and the service-request inbox."
        crumbs={[{ label: "CRM", href: "/crm" }, { label: "Customers" }]} />
      {data && !configured ? (
        <div className="rounded-lg border border-warn/40 bg-warn/10 px-4 py-3 text-xs text-warn">
          Not connected. Set <span className="font-mono">CRM_BASE_URL</span> + <span className="font-mono">MONITOR_SESSION_COOKIE</span> in <span className="font-mono">.env.local</span> to read the CRM's case data.
        </div>
      ) : (
        <BizGrid kpis={supportKpis} base={data?.crmBase ?? null} loading={loading} />
      )}
      <p className="mt-3 text-2xs text-muted">
        Customer growth, engagement, case-demand-by-type and data-integrity (duplicate detection is a per-record lookup in the CRM, not a board-wide count) are the next wiring pass.
      </p>
    </div>
  );
}
