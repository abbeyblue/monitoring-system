"use client";

import Link from "next/link";
import { HEALTH_COLOR, HEALTH_LABEL, type Health } from "@/lib/mock";

export { HEALTH_COLOR, HEALTH_LABEL };

/* status dot (rounded square) */
export function Dot({ health, pulse }: { health: Health; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2.5 w-2.5 shrink-0">
      {pulse && (health === "healthy") && <span className="absolute inline-flex h-full w-full rounded-[3px] opacity-70 motion-safe:animate-[ping2_2s_ease-out_infinite]" style={{ background: HEALTH_COLOR[health] }} aria-hidden />}
      <span className="relative inline-flex h-2.5 w-2.5 rounded-[3px]" style={{ background: HEALTH_COLOR[health] }} />
    </span>
  );
}

export function Pill({ health, label }: { health: Health; label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-2xs font-semibold"
      style={{ color: HEALTH_COLOR[health], borderColor: `${HEALTH_COLOR[health]}55`, background: `${HEALTH_COLOR[health]}12` }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: HEALTH_COLOR[health] }} />
      {label ?? HEALTH_LABEL[health]}
    </span>
  );
}

const SEV: Record<string, string> = { P0: "down", P1: "down", P2: "warn", P3: "idle" };
export function Sev({ level }: { level: string }) {
  const c = SEV[level] ?? "idle";
  return <span className="rounded px-1.5 py-0.5 text-2xs font-bold" style={{ color: `rgb(var(--${c}))`, background: `rgb(var(--${c}) / 0.15)` }}>{level}</span>;
}

export function Delta({ value, unit = "", invert }: { value: number; unit?: string; invert?: boolean }) {
  const bad = invert ? value < 0 : value > 0;
  const c = value === 0 ? "muted" : bad ? "down" : "ok";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "—";
  return <span className="font-mono text-2xs font-semibold" style={{ color: `rgb(var(--${c}))` }}>{arrow} {value > 0 ? "+" : ""}{value}{unit}</span>;
}

/* time-series chart: line + optional area + threshold */
export function Chart({ data, color, height = 48, threshold, unit = "", area = true }: { data: number[]; color: string; height?: number; threshold?: number; unit?: string; area?: boolean }) {
  if (!data || data.length < 2) return <div style={{ height }} aria-hidden />;
  const w = 100, h = height;
  const max = Math.max(...data, threshold ?? -Infinity), min = Math.min(...data, threshold ?? Infinity);
  const range = max - min || 1;
  const y = (v: number) => h - ((v - min) / range) * (h - 6) - 3;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, y(v)]);
  const line = pts.map(([px, py]) => `${px.toFixed(2)},${py.toFixed(2)}`).join(" ");
  const areaPts = `0,${h} ${line} ${w},${h}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" width="100%" height={h} className="overflow-visible" role="img" aria-label="trend">
      {area && <polygon points={areaPts} fill={color} opacity={0.1} />}
      {threshold != null && <line x1="0" x2={w} y1={y(threshold)} y2={y(threshold)} stroke="rgb(var(--down))" strokeWidth="0.6" strokeDasharray="2 2" opacity={0.7} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function Spark({ data, color, w = 64, h = 20 }: { data: number[]; color: string; w?: number; h?: number }) {
  if (!data || data.length < 2) return <div style={{ width: w, height: h }} aria-hidden />;
  const max = Math.max(...data), min = Math.min(...data), range = max - min || 1;
  const pts = data.map((v, i) => `${((i / (data.length - 1)) * w).toFixed(1)},${(h - ((v - min) / range) * (h - 3) - 1.5).toFixed(1)}`).join(" ");
  return <svg width={w} height={h} className="overflow-visible" aria-hidden><polyline points={pts} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" /></svg>;
}

/* KPI / stat card, optionally a drill-down link */
export function Stat({ label, value, sub, health = "healthy", spark, href, delta, tip }: { label: string; value: string; sub?: string; health?: Health; spark?: number[]; href?: string; delta?: React.ReactNode; tip?: string }) {
  const inner = (
    <div className="flex h-full flex-col rounded-lg border border-line bg-panel p-3 shadow-panel transition-colors duration-200 hover:border-accent/50" title={tip}>
      <div className="flex items-center gap-1.5">
        <Dot health={health} />
        <span className="text-2xs font-semibold uppercase tracking-wider text-muted">{label}</span>
        {href && <span className="ml-auto text-muted"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6" /></svg></span>}
      </div>
      <div className="mt-1.5 flex items-end justify-between gap-2">
        <div>
          <div className="text-lg font-semibold tabular-nums leading-none" style={{ color: health === "healthy" || health === "maintenance" ? "rgb(var(--ink))" : HEALTH_COLOR[health] }}>{value}</div>
          {sub && <div className="mt-1 text-2xs text-muted">{sub}</div>}
        </div>
        {delta}
        {spark && <div className="w-16"><Spark data={spark} color={HEALTH_COLOR[health]} w={64} h={22} /></div>}
      </div>
    </div>
  );
  return href ? <Link href={href} className="cursor-pointer">{inner}</Link> : inner;
}

export function Panel({ title, right, count, children, status, className = "", pad }: { title: string; right?: React.ReactNode; count?: string; children: React.ReactNode; status?: Health; className?: string; pad?: boolean }) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-panel ${className}`}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4">
        {status && <Dot health={status} />}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">{title}</h2>
        {count && <span className="font-mono text-[11px] text-muted">{count}</span>}
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
      <div className={`min-h-0 flex-1 ${pad ? "p-4" : ""}`}>{children}</div>
    </section>
  );
}

/* ---------- monitoring data-state contract (P9/P10) ----------
   A single visual language for how trustworthy a number is. Used everywhere a
   metric is shown so a viewer can tell live from cached/mock/unavailable. */
export type DataState = "live" | "cached" | "stale" | "mock" | "not-configured" | "error";
const STATE_STYLE: Record<DataState, { color: string; label: string; pulse?: boolean }> = {
  live: { color: "rgb(var(--ok))", label: "LIVE", pulse: true },
  cached: { color: "rgb(var(--accent))", label: "CACHED" },
  stale: { color: "rgb(var(--warn))", label: "STALE" },
  mock: { color: "rgb(var(--warn))", label: "MOCK" },
  "not-configured": { color: "rgb(var(--idle))", label: "NOT CONFIGURED" },
  error: { color: "rgb(var(--down))", label: "ERROR" },
};
export function StateBadge({ state, label }: { state: DataState; label?: string }) {
  const s = STATE_STYLE[state];
  return (
    <span className="inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-2xs font-semibold"
      style={{ color: s.color, borderColor: `${s.color}55`, background: `${s.color}12` }}
      title={`Data source state: ${s.label}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.pulse ? "motion-safe:animate-pulse" : ""}`} style={{ background: s.color }} />
      {label ?? s.label}
    </span>
  );
}

/** Amber chip marking a page/panel as illustrative (not real production data). */
export function MockBadge({ label = "Illustrative data" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-warn/40 bg-warn/10 px-1.5 py-0.5 text-2xs font-semibold text-warn" title="Sample/mock data — not connected to a live source">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></svg>
      {label}
    </span>
  );
}

export function PageHead({ title, sub, right, crumbs, mock }: { title: string; sub?: string; right?: React.ReactNode; crumbs?: { label: string; href?: string }[]; mock?: boolean }) {
  return (
    <div className="mb-4">
      {crumbs && (
        <nav className="mb-1.5 flex items-center gap-1.5 text-2xs text-muted">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {c.href ? <Link href={c.href} className="hover:text-ink cursor-pointer">{c.label}</Link> : <span>{c.label}</span>}
              {i < crumbs.length - 1 && <span className="opacity-50">/</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">{title}{mock && <MockBadge />}</h1>
          {sub && <p className="mt-0.5 max-w-2xl text-xs text-muted">{sub}</p>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </div>
  );
}

/* a labelled "Related" cross-link chip row (§64 correlation) */
export function Related({ items }: { items: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-2xs uppercase tracking-wider text-muted">Related</span>
      {items.map((it, i) => (
        <Link key={i} href={it.href} className="rounded-md border border-line bg-panel2 px-2 py-0.5 text-2xs text-muted transition-colors hover:border-accent/50 hover:text-ink cursor-pointer">{it.label}</Link>
      ))}
    </div>
  );
}

export const pctHealth = (p: number, warn = 75, crit = 90): Health => (p >= crit ? "critical" : p >= warn ? "degraded" : "healthy");

/** HTTP status -> short error class label */
export function errClass(code: number): string | null {
  if (code === 0) return "timeout";
  if (code === 401) return "401 unauth";
  if (code === 403) return "403 forbidden";
  if (code === 404) return "404";
  if (code === 408 || code === 504) return "timeout";
  if (code === 429) return "429 rate-limit";
  if (code >= 500) return `${code} server`;
  if (code >= 400) return `${code}`;
  return null;
}
