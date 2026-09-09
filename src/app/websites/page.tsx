"use client";

import { PageHead, Panel, StateBadge } from "@/components/kit";
import { HTTP_CHECKS } from "@/lib/config";

// Outward-facing website monitoring (uptime, SSL expiry, DNS) as specified by
// the design. HTTP_CHECKS currently probes CRM endpoints only — there is no
// site registry, no certificate check and no uptime history store — so this
// reports what is actually probed instead of inventing availability figures.
// ponytail: the 48-bar uptime strip and per-site detail route arrive with an
// uptime store; a bar chart of data we do not retain would be decoration.
export default function WebsitesPage() {
  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead
        sub="Availability, certificate and DNS checks for the outward-facing sites."
        right={<StateBadge state="not-configured" />}
      />

      <Panel title="Site checks" right={<StateBadge state="not-configured" />}>
        <div className="px-5 py-5">
          <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-muted">
            No public sites are registered for monitoring. Uptime percentages, SSL expiry and
            DNS status need a site list, a certificate check and a history store — none of which
            exist yet — so no availability figure is shown rather than an invented one.
          </p>
          <p className="mt-3 max-w-[70ch] text-[13.5px] leading-relaxed text-muted">
            Today <code className="font-mono text-[12px] text-ink2">HTTP_CHECKS</code> in{" "}
            <code className="font-mono text-[12px] text-ink2">src/lib/config.ts</code> probes CRM
            endpoints only. Those probes are live on{" "}
            <span className="text-ink2">Services</span>.
          </p>
        </div>
      </Panel>

      <div className="mt-6">
        <Panel title="Currently probed" count={`${HTTP_CHECKS.length}`}>
          <div className="divide-y divide-line2">
            {HTTP_CHECKS.map((c) => (
              <div key={c.path} className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-hover">
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{c.label}</span>
                <span className="truncate font-mono text-[11.5px] text-muted">{c.path}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
