"use client";

import Link from "next/link";
import { useMonitor } from "@/components/monitor-context";
import { useBusiness, BizTile, BizFreshness } from "@/components/use-business";
import { Stat, Panel, Dot, Sev, MockBadge, TONE, HEALTH_LABEL } from "@/components/kit";
import { SERVICES, INCIDENTS, DEPLOYMENTS, QUEUES, JOBS, series, type Health } from "@/lib/mock";

/** Bronze section heading + optional trailing chips, per the design. */
function Head({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline gap-2.5">
      <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-heading">{title}</h2>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { data: live } = useMonitor();
  const { data: biz, loading: bizLoading } = useBusiness();

  // real system signals from the live probe engine
  const probes = live ? [...live.endpoints, ...live.authed] : [];
  const probesUp = probes.filter((e) => e.health === "ok").length;
  const activeIncidents = live?.incidents.active.length ?? 0;

  // overall health from REAL signals only — and honest NOT CONNECTED state
  const isPlaceholder = (u?: string | null) => !u || /your[-_]crm[-_]host/i.test(u);
  const probeConfigured = live ? !isPlaceholder(live.crmBase) : false;
  const configured = biz?.configured;
  const notConnected = live != null && !probeConfigured && !configured;
  const bizCrit = biz?.kpis.some((k) => k.status === "ok" && k.health === "critical");
  const bizWarn = biz?.kpis.some((k) => k.status === "ok" && k.health === "degraded");
  const sysCrit = probeConfigured && probes.some((e) => e.health === "down");
  const overall: Health = !live ? "unknown" : (bizCrit || sysCrit) ? "critical" : bizWarn ? "degraded" : "healthy";
  const heroTone = TONE[notConnected ? "unknown" : overall];

  // illustrative (sample) infra KPIs — clearly labelled below
  const rpm = SERVICES.reduce((a, s) => a + s.rpm, 0);
  const sampleCards = [
    { label: "Requests / min", value: rpm.toLocaleString(), health: "healthy" as Health, spark: series(73, 30, 60000, 4000) },
    { label: "Avg latency", value: "270 ms", health: "healthy" as Health },
    { label: "P95 latency", value: "516 ms", health: "degraded" as Health },
    { label: "Queue depth", value: QUEUES.reduce((a, q) => a + q.depth, 0).toLocaleString(), health: "degraded" as Health },
    { label: "Failed jobs", value: String(JOBS.filter((j) => !j.success).length), health: "critical" as Health },
    { label: "Error rate", value: "2.01%", health: "critical" as Health, spark: series(72, 30, 0.6, 0.3, 3) },
  ];

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      {/* hero — real signals, never fabricated */}
      <div className={`flex flex-wrap items-center justify-between gap-4 rounded-card border bg-panel p-5 shadow-card ${heroTone.bd}`}>
        <div className="flex items-center gap-4">
          <Dot health={notConnected ? "unknown" : overall} pulse={overall === "healthy" && !notConnected} />
          <div>
            <div className={`text-2xl font-semibold tracking-[-0.022em] ${heroTone.fg}`}>
              {notConnected ? "Not connected" : overall === "unknown" ? "Checking…" : overall === "healthy" ? "CRM Operational" : HEALTH_LABEL[overall]}
            </div>
            <p className="mt-1 text-[12.5px] text-muted">
              {notConnected
                ? "No CRM target and no live probes configured — set CRM_BASE_URL to begin monitoring."
                : <>{activeIncidents} active incident{activeIncidents !== 1 ? "s" : ""} · {probesUp}/{probes.length} live probes up{biz && !configured && " · business data not connected"}</>}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {SERVICES.map((s) => (
            <Link key={s.id} href={`/service-health/${s.id}`} className="flex cursor-pointer items-center gap-2 rounded-ctl border border-line bg-panel px-2.5 py-1.5 text-[12px] transition-colors hover:border-muted2/60 hover:bg-hover">
              <Dot health={s.health} /><span className="hidden lg:inline">{s.name.replace(" Service", "")}</span>
            </Link>
          ))}
        </div>
      </div>

      {/* BUSINESS HEALTH — real CRM data */}
      <section>
        <Head title="Business Health"><BizFreshness data={biz} /></Head>
        {biz && !configured ? (
          <div className="rounded-card border border-warn-bd bg-warn-bg px-4 py-3 text-[12.5px] text-warn-fg">
            Business KPIs are not connected. Set <span className="font-mono">CRM_BASE_URL</span> (and a super-admin <span className="font-mono">MONITOR_SESSION_COOKIE</span>) in <span className="font-mono">.env.local</span> — these tiles then read the CRM&apos;s real analytics endpoints.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {bizLoading && !biz ? Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-[74px] animate-pulse rounded-card border border-line bg-panel" />)
              : biz?.kpis.map((k) => <BizTile key={k.id} k={k} base={biz.crmBase} />)}
          </div>
        )}
      </section>

      {/* SYSTEM HEALTH — real probes */}
      <section>
        <Head title="System Health">
          <span className="flex items-center gap-1.5 text-[11.5px] text-muted"><span className="h-1.5 w-1.5 rounded-full bg-ok motion-safe:animate-pulse" />live · probes</span>
        </Head>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="API availability" value={probes.length ? `${probesUp}/${probes.length}` : "—"} sub="endpoints up" health={sysCrit ? "critical" : probes.length ? "healthy" : "unknown"} href="/apis" />
          <Stat label="Active incidents" value={String(activeIncidents)} sub="from alert engine" health={activeIncidents ? "critical" : "healthy"} href="/incidents" />
          <Stat label="Service health" value={`${SERVICES.filter((s) => s.health === "healthy").length}/${SERVICES.length}`} sub="live where mapped" health="degraded" href="/service-health" />
        </div>
      </section>

      {/* ILLUSTRATIVE — sample telemetry */}
      <section>
        <Head title="Sample Telemetry">
          <MockBadge />
          <span className="text-[11.5px] text-muted">not connected to a live source</span>
        </Head>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {sampleCards.map((c) => <Stat key={c.label} {...c} />)}
        </div>
      </section>

      <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
        <Panel title="Incidents" status="critical" right={<MockBadge />}>
          <div className="divide-y divide-line2">
            {INCIDENTS.map((i) => (
              <Link key={i.id} href={`/incidents/${i.id}`} className="flex cursor-pointer items-center gap-3 px-4 py-3 text-[13px] transition-colors hover:bg-hover">
                <Sev level={i.severity} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{i.title}</span><span className="font-mono text-[11px] text-muted">{i.id} · {i.services.join(", ")}</span></span>
                <span className="shrink-0 text-[11.5px] text-muted">{i.status}</span>
              </Link>
            ))}
          </div>
        </Panel>
        <Panel title="Deployments" right={<MockBadge />}>
          <div className="divide-y divide-line2">
            {DEPLOYMENTS.map((d) => (
              <Link key={d.id} href={`/deployments/${d.id}`} className="flex cursor-pointer items-center gap-3 px-4 py-3 text-[13px] transition-colors hover:bg-hover">
                <Dot health={d.status} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium">{d.version} <span className="font-mono text-[11px] text-muted">{d.commit}</span></span><span className="text-[11.5px] text-muted">{d.services.join(", ")}</span></span>
                <span className="shrink-0 font-mono text-[11px] text-muted">{d.start}</span>
              </Link>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
