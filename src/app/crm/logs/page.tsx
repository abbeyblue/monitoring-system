"use client";

import { useMemo, useState } from "react";
import { PageHead, Panel, Dot } from "@/components/kit";
import { LOGS } from "@/lib/mock";

const LEVELS = ["ALL", "ERROR", "WARN", "INFO"] as const;
const LVL_COLOR: Record<string, string> = { ERROR: "rgb(var(--down))", WARN: "rgb(var(--warn))", INFO: "rgb(var(--muted))" };

export default function LogsPage() {
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<string>("ALL");
  const [svc, setSvc] = useState<string>("ALL");
  const services = useMemo(() => ["ALL", ...Array.from(new Set(LOGS.map((l) => l.service)))], []);
  const rows = LOGS.filter((l) => (level === "ALL" || l.level === level) && (svc === "ALL" || l.service === svc) &&
    (!q || JSON.stringify(l).toLowerCase().includes(q.toLowerCase())));

  return (
    <div className="mx-auto max-w-[1400px]">
      <PageHead mock sub="Structured CloudWatch + application logs. Filter by level, service, or search by request/trace id — every row links into its trace." />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-line bg-panel px-2.5 py-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Full-text / request id / trace id…" className="w-full bg-transparent text-xs focus:outline-none" />
        </div>
        <Seg options={[...LEVELS]} value={level} onChange={setLevel} />
        <select value={svc} onChange={(e) => setSvc(e.target.value)} className="rounded-md border border-line bg-panel2 px-2 py-1.5 text-2xs cursor-pointer">
          {services.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <Panel title="Log stream" count={`${rows.length}`}>
        <div className="divide-y divide-line font-mono text-2xs">
          {rows.map((l, i) => (
            <div key={i} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2 transition-colors hover:bg-panel2">
              <span className="text-muted">{l.ts}</span>
              <span className="font-bold" style={{ color: LVL_COLOR[l.level] }}>{l.level}</span>
              <span className="rounded border border-line px-1 text-muted">{l.service}</span>
              {l.status > 0 && <span style={{ color: l.status >= 500 ? "rgb(var(--down))" : l.status >= 400 ? "rgb(var(--warn))" : "rgb(var(--ok))" }}>{l.status}</span>}
              {l.duration > 0 && <span className="text-muted">{l.duration}ms</span>}
              {l.traceId !== "-" && <a href={`/crm/traces/${l.traceId}`} className="text-accent hover:underline cursor-pointer">{l.traceId}</a>}
              <span className="text-muted">{l.requestId}</span>
              <span className="w-full text-ink sm:w-auto sm:flex-1">{l.msg}</span>
            </div>
          ))}
          {rows.length === 0 && <p className="px-4 py-3 text-muted">No matching logs.</p>}
        </div>
      </Panel>
    </div>
  );
}

function Seg({ options, value, onChange }: { options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex rounded-md border border-line bg-panel2 p-0.5">
      {options.map((o) => (
        <button key={o} onClick={() => onChange(o)} className={`rounded px-2 py-1 text-2xs font-medium transition-colors cursor-pointer ${value === o ? "bg-panel text-ink" : "text-muted hover:text-ink"}`}>{o}</button>
      ))}
    </div>
  );
}
