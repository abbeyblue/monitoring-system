"use client";

import Link from "next/link";
import { useMonitor } from "@/components/monitor-context";
import { PageHead, Dot, Pill, StateBadge, HEALTH_COLOR } from "@/components/kit";
import { liveWorst } from "@/components/live";
import { SERVICES, LIVE_PROBE_MAP } from "@/lib/mock";
import type { Endpoint } from "@/lib/types";

export default function ServiceHealth() {
  const { data } = useMonitor();
  const all: Endpoint[] = data ? [...data.endpoints, ...data.authed] : [];
  const liveFor = (id: string) => all.filter((e) => (LIVE_PROBE_MAP[id] ?? []).includes(e.id));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead title="Service Health"
        sub="Per-service health is from LIVE probes where a service is mapped. Golden signals (RPM, error rate, P95, CPU, memory) require an APM integration and are shown as NOT CONFIGURED — never fabricated. The service list itself is an illustrative catalog."
        crumbs={[{ label: "Overview", href: "/" }, { label: "Service Health" }]} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SERVICES.map((s) => {
          const probes = liveFor(s.id);
          const upNow = probes.filter((p) => p.health === "ok").length;
          const cardHealth = probes.length ? liveWorst(probes) : "unknown";
          return (
            <Link key={s.id} href={`/service-health/${s.id}`} className="block cursor-pointer">
              <div className="rounded-lg border border-line bg-panel p-4 shadow-panel transition-colors hover:border-accent/50">
                <div className="flex items-center gap-2">
                  <Dot health={cardHealth} pulse={cardHealth === "healthy"} />
                  <span className="text-sm font-semibold">{s.name}</span>
                  <span className="ml-auto">{probes.length ? <Pill health={cardHealth} /> : <StateBadge state="not-configured" />}</span>
                </div>
                {probes.length > 0 ? (
                  <div className="mt-3 flex items-center gap-2 rounded-md border border-line bg-panel2/50 px-2 py-1.5 text-2xs">
                    <StateBadge state="live" />
                    <span style={{ color: HEALTH_COLOR[cardHealth] }}>{upNow}/{probes.length} probes up</span>
                    <span className="ml-auto font-mono text-muted">{probes.map((p) => p.health === "ok" ? `${p.latency}ms` : (p.httpStatus || "×")).join(" · ")}</span>
                  </div>
                ) : (
                  <p className="mt-3 text-2xs text-muted">No live probe mapped to this service.</p>
                )}
                <div className="mt-3 flex items-center justify-between border-t border-line pt-2 text-2xs text-muted">
                  <span>{s.owner}</span>
                  <StateBadge state="not-configured" label="GOLDEN SIGNALS: NEEDS APM" />
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="mt-3 text-2xs text-muted">
        Void of a tracing/APM agent in the CRM, per-service RPM / error-rate / latency / CPU / memory cannot be computed and are not shown. Connect an APM source to populate them.
      </p>
    </div>
  );
}
