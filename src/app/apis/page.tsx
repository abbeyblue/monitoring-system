"use client";

import Link from "next/link";
import { useMonitor } from "@/components/monitor-context";
import { PageHead, Panel, Dot, Spark, HEALTH_COLOR } from "@/components/kit";
import { LiveRows, liveWorst as worstOf } from "@/components/live";
import { APIS } from "@/lib/mock";

export default function ApisPage() {
  const { data, latency, loading, error } = useMonitor();
  const live = data ? [...data.endpoints, ...data.authed] : [];
  const liveUp = live.filter((e) => e.health === "ok").length;
  const liveWorst = data ? worstOf(live) : "unknown";
  const placeholder = data?.crmBase?.includes("YOUR_CRM_HOST");

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead title="APIs" sub="Live server-side probes of the real CRM endpoints, plus the sample inventory with full latency percentiles." crumbs={[{ label: "Services", href: "/service-health" }, { label: "APIs" }]} />

      {/* LIVE */}
      <Panel
        title="Live probes"
        status={data ? liveWorst : "unknown"}
        count={data ? `${liveUp}/${live.length} up` : "connecting…"}
        right={
          <span className="flex items-center gap-2 text-2xs text-muted">
            {data && <><span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-ok motion-safe:animate-pulse" />LIVE</span>·<span className="font-mono">{data.crmBase}</span></>}
            {loading && <span>refreshing…</span>}
          </span>
        }
      >
        {error ? (
          <p className="px-4 py-3 text-xs text-down">{error}</p>
        ) : !data ? (
          <p className="px-4 py-3 text-xs text-muted">Connecting to the monitor API…</p>
        ) : (
          <>
            {placeholder && (
              <div className="border-b border-warn/30 bg-warn/10 px-4 py-2 text-2xs text-warn">
                CRM_BASE_URL is unset (probing the placeholder host) — set it in <span className="font-mono">.env.local</span> to see real results. Everything reads Down until then.
              </div>
            )}
            <LiveRows items={live} latency={latency} />
            {data.knownUnprobed.length > 0 && (
              <div className="border-t border-line px-4 py-2 text-[11px] text-muted">
                Not probed (POST auth flows, need a body): <span className="font-mono">{data.knownUnprobed.join(", ")}</span>
              </div>
            )}
          </>
        )}
      </Panel>

      {/* SAMPLE INVENTORY (mock) */}
      <div className="mt-3">
        <Panel title="Sample inventory" count={`${APIS.length}`} right={<span className="rounded border border-line px-1.5 py-0.5 text-2xs text-muted">mock telemetry</span>}>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-xs">
              <thead>
                <tr className="border-b border-line text-left text-2xs uppercase tracking-wider text-muted">
                  <th className="px-3 py-2 font-semibold">Endpoint</th><th className="px-3 py-2 font-semibold">Req/min</th><th className="px-3 py-2 font-semibold">Success</th><th className="px-3 py-2 font-semibold">Error</th><th className="px-3 py-2 font-semibold">Avg</th><th className="px-3 py-2 font-semibold">P95</th><th className="px-3 py-2 font-semibold">P99</th><th className="px-3 py-2 font-semibold">Timeouts</th><th className="px-3 py-2 font-semibold">Trend</th>
                </tr>
              </thead>
              <tbody>
                {APIS.map((a) => (
                  <tr key={a.id} className="border-b border-line/60 transition-colors last:border-0 hover:bg-panel2">
                    <td className="px-3 py-2"><Link href={`/apis/${a.id}`} className="flex items-center gap-2 cursor-pointer"><Dot health={a.health} /><span className="font-mono text-2xs font-semibold" style={{ color: a.method === "POST" ? "rgb(var(--accent))" : "rgb(var(--muted))" }}>{a.method}</span><span className="font-medium">{a.endpoint}</span></Link></td>
                    <td className="px-3 py-2 font-mono tabular-nums text-muted">{a.requests.toLocaleString()}</td>
                    <td className="px-3 py-2 font-mono tabular-nums">{a.successRate}%</td>
                    <td className="px-3 py-2 font-mono tabular-nums" style={{ color: a.errorRate > 1 ? "rgb(var(--down))" : undefined }}>{a.errorRate}%</td>
                    <td className="px-3 py-2 font-mono tabular-nums text-muted">{a.avg}ms</td>
                    <td className="px-3 py-2 font-mono tabular-nums text-muted">{a.p95}ms</td>
                    <td className="px-3 py-2 font-mono tabular-nums" style={{ color: a.p99 > 1000 ? "rgb(var(--warn))" : undefined }}>{a.p99}ms</td>
                    <td className="px-3 py-2 font-mono tabular-nums text-muted">{a.timeouts}</td>
                    <td className="px-3 py-2"><Spark data={a.spark} color={HEALTH_COLOR[a.health]} w={72} h={20} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
