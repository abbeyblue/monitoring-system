"use client";

import { PageHead, Panel, Stat, Chart, HEALTH_COLOR as HC } from "@/components/kit";
import { BUSINESS, series } from "@/lib/mock";

export default function LeadsPage() {
  const l = BUSINESS.leads;
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHead mock title="Leads" sub="Lead creation, assignment, conversion, and processing failures." crumbs={[{ label: "CRM", href: "/crm" }, { label: "Leads" }]} />
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Created" value={l.created.toLocaleString()} health="healthy" />
        <Stat label="Assigned" value={l.assigned.toLocaleString()} health="healthy" />
        <Stat label="Converted" value={l.converted.toLocaleString()} health="healthy" />
        <Stat label="Processing failures" value={String(l.failed)} health={l.failed ? "degraded" : "healthy"} href="/crm/background-jobs" />
      </div>
      <div className="mt-3"><Panel title="Lead throughput (per min)" pad><Chart data={series(140, 40, 90, 20)} color={HC.healthy} height={160} /></Panel></div>
    </div>
  );
}
