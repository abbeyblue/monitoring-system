"use client";

import Link from "next/link";
import { useMonitor } from "@/components/monitor-context";
import { useBusiness } from "@/components/use-business";
import { Panel, Dot, StateBadge, MockBadge, TONE, HEALTH_LABEL } from "@/components/kit";
import { liveWorst, mapHealth } from "@/components/live";
import { SERVICES, INCIDENTS, LIVE_PROBE_MAP, type Health } from "@/lib/mock";

/** Design's status card: title + dot, mono sub, status line, two stats, footer. */
function StatusCard({ title, sub, health, status, k1, v1, k2, v2, foot, href }: {
  title: string; sub: string; health: Health; status: string;
  k1: string; v1: string; k2: string; v2: string; foot: string; href: string;
}) {
  const t = TONE[health];
  const neutral = health === "healthy";
  return (
    <Link href={href} className={`flex cursor-pointer flex-col gap-3 rounded-card border border-t-2 border-line bg-panel px-[17px] pb-[15px] pt-4 shadow-card transition-colors hover:border-muted2/60 ${neutral ? "border-t-line" : t.bd}`}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <strong className="text-sm font-semibold">{title}</strong>
          <Dot health={health} />
        </div>
        <span className="font-mono text-[11px] text-muted">{sub}</span>
      </div>
      <div className={`text-[14.5px] font-semibold ${neutral ? "text-ink" : t.fg}`}>{status}</div>
      <div className="flex gap-6 border-t border-line2 pt-[11px]">
        <span className="flex flex-col gap-0.5">
          <span className="text-[11.5px] text-muted2">{k1}</span>
          <span className="font-mono text-sm font-medium">{v1}</span>
        </span>
        <span className="flex flex-col gap-0.5">
          <span className="text-[11.5px] text-muted2">{k2}</span>
          <span className="font-mono text-sm font-medium">{v2}</span>
        </span>
      </div>
      <span className="font-mono text-[10.5px] text-muted2">{foot}</span>
    </Link>
  );
}

function Head({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex flex-wrap items-baseline gap-2.5">
      <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-heading">{title}</h2>
      {children}
      {href && <Link href={href} className="ml-auto text-[12.5px] text-accent hover:underline">{linkLabel}</Link>}
    </div>
  );
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });

export default function SystemOverview() {
  const { data: live } = useMonitor();
  const { data: biz } = useBusiness();

  const probes = live ? [...live.endpoints, ...live.authed] : [];
  const probesUp = probes.filter((e) => e.health === "ok").length;
  const activeIncidents = live?.incidents.active ?? [];

  const isPlaceholder = (u?: string | null) => !u || /your[-_]crm[-_]host/i.test(u);
  const probeConfigured = live ? !isPlaceholder(live.crmBase) : false;
  const bizConfigured = Boolean(biz?.configured);

  // CRM status is real: probe health where the target is configured, otherwise
  // unknown. Never "operational" on the strength of having checked nothing.
  const crmHealth: Health = !live ? "unknown" : !probeConfigured ? "unknown" : liveWorst(probes);
  const crmStatus = !live ? "Checking…" : !probeConfigured ? "Not configured" : HEALTH_LABEL[crmHealth];
  const crmHost = live && probeConfigured ? new URL(live.crmBase!).host : "CRM_BASE_URL not set";

  const bizHealth: Health = !biz ? "unknown" : !bizConfigured ? "unknown" : "healthy";
  const svcOk = SERVICES.filter((s) => s.health === "healthy").length;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      {/* active incidents — real, from the alert engine */}
      {activeIncidents.length > 0 && (
        <div className="flex flex-wrap items-start gap-3.5 rounded-card border border-down-bd border-l-[3px] border-l-down bg-panel px-[18px] py-4">
          <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-down motion-safe:animate-abpulse" />
          <div className="min-w-0 flex-1">
            <strong className="text-[15px] font-semibold">
              {activeIncidents.length} active incident{activeIncidents.length !== 1 ? "s" : ""}
            </strong>
            <p className="mt-1.5 max-w-[70ch] text-[13.5px] text-muted">
              Raised by the alert engine from live probe failures and threshold breaches.
            </p>
          </div>
          <Link href="/incidents" className="rounded-ctl border border-down bg-down px-3.5 py-[7px] text-[12.5px] font-medium text-white transition-opacity hover:opacity-90">
            View incidents
          </Link>
        </div>
      )}

      {/* four status cards, one per monitored area */}
      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        <StatusCard
          title="CRM" sub={crmHost} health={crmHealth} status={crmStatus}
          k1="Probes up" v1={probes.length ? `${probesUp}/${probes.length}` : "—"}
          k2="Incidents" v2={String(activeIncidents.length)}
          foot={live ? "Live probe engine" : "Awaiting first poll"} href="/crm"
        />
        <StatusCard
          title="Business Health" sub={bizConfigured ? "CRM analytics" : "not connected"}
          health={bizHealth} status={bizConfigured ? "Connected" : "Not configured"}
          k1="KPIs" v1={bizConfigured ? String(biz?.kpis.length ?? 0) : "—"}
          k2="Source" v2={bizConfigured ? "live" : "—"}
          foot={bizConfigured ? "CRM analytics endpoints" : "Set CRM_BASE_URL"} href="/crm/business-health"
        />
        <StatusCard
          title="Services" sub={`${SERVICES.length} in catalog`} health="unknown"
          status={`${svcOk} / ${SERVICES.length} healthy`}
          k1="Mapped to probes" v1={String(Object.keys(LIVE_PROBE_MAP).length)}
          k2="Catalog" v2="illustrative"
          foot="Live where a probe is mapped" href="/service-health"
        />
        <StatusCard
          title="Websites" sub="no sites registered" health="unknown" status="Not configured"
          k1="Sites" v1="—" k2="Uptime" v2="—"
          foot="Needs a site list and uptime store" href="/websites"
        />
      </div>

      <div className="grid items-start gap-5 xl:grid-cols-2">
        {/* CRM Activity — the design's 6-metric grid. No session source exists. */}
        <Panel title="CRM Activity" right={<StateBadge state="not-configured" />}>
          <div className="px-5 py-5">
            <p className="max-w-[60ch] text-[13.5px] leading-relaxed text-muted">
              Active users, sessions, request volume and failed logins need a CRM sessions
              source, which is not connected. No figures are shown rather than sample ones.
            </p>
            <Link href="/users" className="mt-3 inline-block text-[12.5px] text-accent hover:underline">
              What this needs →
            </Link>
          </div>
        </Panel>

        {/* Service Health — illustrative catalog, live where a probe is mapped */}
        <section>
          <Head title="Service Health" href="/service-health" linkLabel="All services">
            <MockBadge label="Catalog" />
          </Head>
          <div className="overflow-hidden rounded-card border border-line bg-panel shadow-card">
            {SERVICES.map((s) => (
              <Link key={s.id} href={`/service-health/${s.id}`}
                className="flex cursor-pointer items-center gap-3 border-b border-line2 px-4 py-2.5 last:border-0 transition-colors hover:bg-hover">
                <Dot health={s.health} />
                <span className="min-w-0 flex-1 truncate text-[13.5px]">{s.name}</span>
                <span className="font-mono text-[11.5px] text-muted">
                  {LIVE_PROBE_MAP[s.id] ? `${LIVE_PROBE_MAP[s.id].length} probe${LIVE_PROBE_MAP[s.id].length === 1 ? "" : "s"}` : "no probe"}
                </span>
                <span className={`w-[86px] text-right text-[12px] ${TONE[s.health].fg}`}>{HEALTH_LABEL[s.health]}</span>
              </Link>
            ))}
          </div>
        </section>
      </div>

      {/* Website Monitoring — no source yet */}
      <Panel title="Website Monitoring" right={<StateBadge state="not-configured" />}>
        <div className="px-5 py-5">
          <p className="max-w-[70ch] text-[13.5px] leading-relaxed text-muted">
            No outward-facing sites are registered. Uptime, SSL expiry and DNS checks need a
            site list, a certificate check and a history store — none of which exist yet, so
            no availability figure is shown rather than an invented one.
          </p>
          <Link href="/websites" className="mt-3 inline-block text-[12.5px] text-accent hover:underline">
            Website monitoring →
          </Link>
        </div>
      </Panel>

      {/* Recent Events — real active incidents first, then the illustrative catalog */}
      <section>
        <Head title="Recent Events" href="/incidents" linkLabel="All incidents">
          <MockBadge label="Catalog below live rows" />
        </Head>
        <div className="overflow-hidden rounded-card border border-line bg-panel shadow-card">
          {activeIncidents.map((i) => (
            <div key={i.id} className="flex items-baseline gap-4 border-b border-line2 px-4 py-3">
              <span className="w-[74px] shrink-0 font-mono text-[11.5px] text-muted">{fmtTime(i.openedAt)}</span>
              <span className={`relative -top-px h-1.5 w-1.5 shrink-0 rounded-full ${TONE[mapHealth(i.severity)].dot}`} />
              <span className="min-w-0 flex-1 text-[13.5px]">{i.label}{i.detail && <span className="text-muted"> — {i.detail}</span>}</span>
              <span className="whitespace-nowrap rounded-chip bg-down-bg px-2 py-0.5 text-[11.5px] text-down-fg">Active</span>
            </div>
          ))}
          {INCIDENTS.map((i) => (
            <Link key={i.id} href={`/incidents/${i.id}`}
              className="flex cursor-pointer items-baseline gap-4 border-b border-line2 px-4 py-3 last:border-0 transition-colors hover:bg-hover">
              <span className="w-[74px] shrink-0 font-mono text-[11.5px] text-muted">{i.id}</span>
              <span className="relative -top-px h-1.5 w-1.5 shrink-0 rounded-full bg-idle" />
              <span className="min-w-0 flex-1 truncate text-[13.5px]">{i.title}</span>
              <span className="whitespace-nowrap rounded-chip bg-panel2 px-2 py-0.5 text-[11.5px] text-muted">{i.status}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
