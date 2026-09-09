"use client";

import { use } from "react";
import { PageHead, Panel, Stat, Dot, Pill, Chart, Related, HEALTH_COLOR as HC } from "@/components/kit";
import { DB, DATABASES, ALERTS, series, type Health } from "@/lib/mock";

export default function DatabaseDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const meta = DATABASES.find((d) => d.id === id);
  const isPrimary = id === "crm-prod-db";

  if (!isPrimary) {
    return (
      <div className="mx-auto max-w-[1400px]">
        <PageHead mock title={meta?.name ?? id} sub={meta?.engine} crumbs={[{ label: "Databases", href: "/crm/databases" }, { label: meta?.name ?? id }]} right={meta && <Pill health={meta.health} />} />
        <Panel title="Telemetry" pad><p className="text-xs text-muted">Full instance telemetry is wired for <span className="font-mono">crm-prod-db</span> in this prototype. <a href="/crm/databases/crm-prod-db" className="text-accent hover:underline cursor-pointer">Open crm-prod-db →</a></p></Panel>
      </div>
    );
  }

  const storagePct = +((DB.storageUsedGb / DB.storageTotalGb) * 100).toFixed(1);
  const connPct = +((DB.connections / DB.connectionsMax) * 100).toFixed(1);
  const growthPerDay = 18; // GB/day (from series slope)
  const daysTo85 = Math.round((DB.storageTotalGb * 0.85 - DB.storageUsedGb) / growthPerDay);
  const dbAlerts = ALERTS.filter((a) => a.runbook?.startsWith("db"));

  const cards: { label: string; value: string; sub?: string; health: Health }[] = [
    { label: "CPU", value: `${DB.cpu}%`, health: "critical" },
    { label: "Memory", value: `${DB.mem}%`, health: "degraded" },
    { label: "Storage", value: `${storagePct}%`, sub: `${DB.storageUsedGb}/${DB.storageTotalGb} GB`, health: "degraded" },
    { label: "Free storage", value: `${DB.storageTotalGb - DB.storageUsedGb} GB`, health: "degraded" },
    { label: "Connections", value: `${DB.connections}/${DB.connectionsMax}`, sub: `${connPct}%`, health: "critical" },
    { label: "Read IOPS", value: DB.readIops.toLocaleString(), health: "healthy" },
    { label: "Write IOPS", value: DB.writeIops.toLocaleString(), health: "healthy" },
    { label: "Read thrpt", value: `${DB.readThroughput} MB/s`, health: "healthy" },
    { label: "Write thrpt", value: `${DB.writeThroughput} MB/s`, health: "healthy" },
    { label: "Repl lag", value: `${DB.replicationLag}s`, health: "degraded" },
    { label: "Active queries", value: String(DB.activeQueries), health: "degraded" },
    { label: "Slow queries", value: String(DB.slowQueries), health: "critical" },
  ];

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead title={DB.name} sub={`${DB.engine} ${DB.version} · ${DB.instance} · ${DB.role} · ${DB.region}`}
        crumbs={[{ label: "Databases", href: "/crm/databases" }, { label: DB.name }]} right={<Pill health={DB.health} />} />

      <div className="mb-3">
        <Related items={[
          { label: "Incident INC-1042", href: "/crm/incidents/INC-1042" },
          { label: "Trace trc_9f2a71c4e8", href: "/crm/traces/trc_9f2a71c4e8" },
          { label: "Deploy v1.42.3", href: "/crm/deployments/dpl_442" },
          { label: "Customer Service", href: "/crm/service-health/customer" },
        ]} />
      </div>

      {/* storage forecast warning (§14) */}
      <div className="mb-3 flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 px-4 py-2.5 text-xs text-warn">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></svg>
        At the current growth rate (~{growthPerDay} GB/day), storage will reach 85% in <strong>{daysTo85} days</strong>. Connection utilization is at {connPct}% — at the pool limit now.
      </div>

      {/* metric cards */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {cards.map((c) => <Stat key={c.label} {...c} />)}
      </div>

      {/* graphs */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Storage usage (GB)" pad right={<span className="text-2xs text-muted">forecast → 85% in {daysTo85}d</span>}><Chart data={DB.storageSeries} color={HC.degraded} height={130} threshold={DB.storageTotalGb * 0.85} /></Panel>
        <Panel title="CPU %" pad><Chart data={DB.cpuSeries} color={HC.critical} height={130} threshold={90} unit="%" /></Panel>
        <Panel title="Memory %" pad><Chart data={DB.memSeries} color={HC.degraded} height={130} threshold={90} unit="%" /></Panel>
        <Panel title="Connections" pad right={<span className="text-2xs text-muted">{connPct}% of {DB.connectionsMax}</span>}><Chart data={DB.connSeries} color={HC.critical} height={130} threshold={DB.connectionsMax * 0.85} /></Panel>
        <Panel title="IOPS (read/write)" pad><Chart data={DB.iopsReadSeries} color={HC.healthy} height={130} /></Panel>
        <Panel title="Write latency (ms)" pad><Chart data={DB.latWriteSeries} color={HC.degraded} height={130} unit="ms" /></Panel>
      </div>

      {/* lower panels */}
      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Panel title="Active alerts" count={`${dbAlerts.length}`} status="critical">
          <div className="divide-y divide-line">
            {dbAlerts.map((a) => (
              <a key={a.id} href="/crm/alerts" className="flex items-center gap-2 px-4 py-2 text-xs transition-colors hover:bg-panel2 cursor-pointer">
                <span className="rounded px-1 text-2xs font-bold" style={{ color: "rgb(var(--down))", background: "rgb(var(--down)/0.15)" }}>{a.severity}</span>
                <span className="truncate">{a.title}</span><span className="ml-auto font-mono text-2xs text-muted">{a.value}</span>
              </a>
            ))}
          </div>
        </Panel>
        <Panel title="Slow queries" count={`${DB.slowQueryList.length}`} status="critical">
          <div className="divide-y divide-line">
            {DB.slowQueryList.map((q) => (
              <div key={q.id} className="px-4 py-2.5 text-xs">
                <div className="truncate font-mono text-2xs text-ink" title={q.sql}>{q.sql}</div>
                <div className="mt-1 flex flex-wrap gap-x-3 text-2xs text-muted">
                  <span>×{q.count.toLocaleString()}</span><span>avg <span className="text-ink">{q.avg}ms</span></span><span>p99 {q.p99}ms</span><span>scanned {q.rowsScanned.toLocaleString()}</span>{q.errors > 0 && <span className="text-down">{q.errors} err</span>}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-3">
        <Panel title="Locks & deadlocks">
          <div className="p-4 text-xs">
            <div className="mb-2 flex gap-4 text-2xs text-muted"><span>Deadlocks today <span className="font-mono text-down">{DB.deadlocksToday}</span></span><span>this week <span className="font-mono text-ink">{DB.deadlocksWeek}</span></span></div>
            <div className="divide-y divide-line rounded border border-line">
              {DB.locks.map((l, i) => (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 text-2xs"><span className="font-mono">{l.type}</span><span className="ml-auto text-muted">{l.duration}s · {l.session}</span></div>
              ))}
            </div>
          </div>
        </Panel>
        <Panel title="Replication">
          <div className="divide-y divide-line">
            {DB.replicas.map((r) => (
              <div key={r.name} className="flex items-center gap-2 px-4 py-2.5 text-xs"><Dot health={r.health} /><span>{r.name}</span><span className="ml-auto font-mono text-2xs text-muted">lag {r.lag}s</span></div>
            ))}
          </div>
        </Panel>
        <Panel title="Backups">
          <div className="divide-y divide-line">
            {DB.backups.map((b, i) => (
              <div key={i} className="flex items-center gap-2 px-4 py-2.5 text-xs"><Dot health="healthy" /><span className="font-mono">{b.at}</span><span className="text-muted">{b.duration}</span><span className="ml-auto text-2xs text-muted">{b.size}</span></div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="mt-3">
        <Panel title="Recent database events">
          <div className="divide-y divide-line">
            {DB.events.map((e, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2 text-xs"><Dot health={e.health} /><span className="font-mono text-2xs text-muted">{e.at}</span><span>{e.text}</span></div>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}
