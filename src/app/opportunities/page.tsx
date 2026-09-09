"use client";

import { PageHead, Panel, Stat, Chart, HEALTH_COLOR as HC } from "@/components/kit";
import { BUSINESS, series } from "@/lib/mock";

export default function OpportunitiesPage() {
  const o = BUSINESS.opportunities;
  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHead mock title="Opportunities" sub="Opportunity creation, stage changes, and closures." crumbs={[{ label: "CRM", href: "/" }, { label: "Opportunities" }]} />
      <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <Stat label="Created" value={String(o.created)} health="healthy" />
        <Stat label="Stage changes" value={o.stageChanges.toLocaleString()} health="healthy" />
        <Stat label="Closed" value={String(o.closed)} health="healthy" />
        <Stat label="Failed updates" value={String(o.failed)} health={o.failed ? "degraded" : "healthy"} href="/service-health/opportunity" />
      </div>
      <div className="mt-3"><Panel title="Stage changes (per min)" pad><Chart data={series(150, 40, 55, 15)} color={HC.healthy} height={160} /></Panel></div>
    </div>
  );
}
