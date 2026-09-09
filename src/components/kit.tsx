"use client";

import Link from "next/link";
import { HEALTH_COLOR, HEALTH_LABEL, type Health } from "@/lib/mock";

export { HEALTH_COLOR, HEALTH_LABEL };

/* Tone classes per health state — dot fill, text, surface, border.
   Replaces the old `${HEALTH_COLOR[h]}55` inline pattern, which concatenated a
   hex alpha onto an `rgb(var(--ok))` string and produced invalid CSS, so those
   borders and fills silently never rendered. */
export const TONE: Record<Health, { dot: string; fg: string; bg: string; bd: string }> = {
  healthy:     { dot: "bg-ok",     fg: "text-ok-fg",   bg: "bg-ok-bg",     bd: "border-ok-bd" },
  degraded:    { dot: "bg-warn",   fg: "text-warn-fg", bg: "bg-warn-bg",   bd: "border-warn-bd" },
  critical:    { dot: "bg-down",   fg: "text-down-fg", bg: "bg-down-bg",   bd: "border-down-bd" },
  maintenance: { dot: "bg-accent", fg: "text-accent",  bg: "bg-accent/10", bd: "border-accent/30" },
  unknown:     { dot: "bg-idle",   fg: "text-idle-fg", bg: "bg-idle-bg",   bd: "border-idle-bd" },
};

/* status dot — circular, per the design */
export function Dot({ health, pulse }: { health: Health; pulse?: boolean }) {
  const t = TONE[health];
  return (
    <span className="relative inline-flex h-[7px] w-[7px] shrink-0">
      {pulse && health === "healthy" && (
        <span className={`absolute inline-flex h-full w-full rounded-full opacity-70 motion-safe:animate-[ping2_2s_ease-out_infinite] ${t.dot}`} aria-hidden />
      )}
      <span className={`relative inline-flex h-[7px] w-[7px] rounded-full ${t.dot}`} />
    </span>
  );
}

export function Pill({ health, label }: { health: Health; label?: string }) {
  const t = TONE[health];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-chip border px-2.5 py-[3px] text-xs font-medium ${t.fg} ${t.bg} ${t.bd}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
      {label ?? HEALTH_LABEL[health]}
    </span>
  );
}

const SEV: Record<string, Health> = { P0: "critical", P1: "critical", P2: "degraded", P3: "unknown" };
export function Sev({ level }: { level: string }) {
  const t = TONE[SEV[level] ?? "unknown"];
  return <span className={`rounded-chip px-1.5 py-0.5 font-mono text-2xs font-semibold ${t.fg} ${t.bg}`}>{level}</span>;
}

export function Delta({ value, unit = "", invert }: { value: number; unit?: string; invert?: boolean }) {
  const bad = invert ? value < 0 : value > 0;
  const c = value === 0 ? "text-muted" : bad ? "text-down-fg" : "text-ok-fg";
  const arrow = value > 0 ? "▲" : value < 0 ? "▼" : "—";
  return <span className={`font-mono text-2xs font-semibold ${c}`}>{arrow} {value > 0 ? "+" : ""}{value}{unit}</span>;
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
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
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
  const neutral = health === "healthy" || health === "maintenance";
  const inner = (
    <div className={`flex h-full flex-col gap-3 rounded-card border border-line bg-panel px-4 pb-[15px] pt-4 shadow-card transition-colors hover:border-muted2/50 ${neutral ? "" : "border-t-2 " + TONE[health].bd.replace("border-", "border-t-")}`} title={tip}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11.5px] text-muted2">{label}</span>
        <Dot health={health} />
      </div>
      <div className="flex items-end justify-between gap-2">
        <div className="min-w-0">
          <div className={`font-mono text-xl font-medium leading-none tracking-tight ${neutral ? "text-ink" : TONE[health].fg}`}>{value}</div>
          {sub && <div className="mt-1.5 text-[11.5px] text-muted">{sub}</div>}
        </div>
        {delta}
        {spark && <div className="w-16 shrink-0"><Spark data={spark} color={HEALTH_COLOR[health]} w={64} h={22} /></div>}
      </div>
      {href && <span className="mt-auto font-mono text-[10.5px] text-muted2">View detail →</span>}
    </div>
  );
  return href ? <Link href={href} className="cursor-pointer">{inner}</Link> : inner;
}

/* Section: bronze heading above a white card, matching the design's
   `<h2>` + card pattern. Prop signature is unchanged so all 29 consuming
   pages pick up the new look without edits. */
export function Panel({ title, right, count, children, status, className = "", pad }: { title: string; right?: React.ReactNode; count?: string; children: React.ReactNode; status?: Health; className?: string; pad?: boolean }) {
  return (
    <section className={`flex flex-col gap-2.5 ${className}`}>
      <div className="flex items-baseline gap-2">
        {status && <Dot health={status} />}
        <h2 className="text-[13px] font-semibold tracking-[-0.01em] text-heading">{title}</h2>
        {count && <span className="font-mono text-[11px] text-muted">{count}</span>}
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
      <div className={`min-h-0 flex-1 overflow-hidden rounded-card border border-line bg-panel shadow-card ${pad ? "p-4" : ""}`}>{children}</div>
    </section>
  );
}

/* ---------- monitoring data-state contract (P9/P10) ----------
   A single visual language for how trustworthy a number is. Used everywhere a
   metric is shown so a viewer can tell live from cached/mock/unavailable. */
export type DataState = "live" | "cached" | "stale" | "mock" | "not-configured" | "error";
const STATE_STYLE: Record<DataState, { tone: Health; label: string; pulse?: boolean }> = {
  live: { tone: "healthy", label: "LIVE", pulse: true },
  cached: { tone: "maintenance", label: "CACHED" },
  stale: { tone: "degraded", label: "STALE" },
  mock: { tone: "degraded", label: "MOCK" },
  "not-configured": { tone: "unknown", label: "NOT CONFIGURED" },
  error: { tone: "critical", label: "ERROR" },
};
export function StateBadge({ state, label }: { state: DataState; label?: string }) {
  const s = STATE_STYLE[state];
  const t = TONE[s.tone];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-chip border px-2 py-0.5 text-2xs font-semibold ${t.fg} ${t.bg} ${t.bd}`}
      title={`Data source state: ${s.label}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${t.dot} ${s.pulse ? "motion-safe:animate-pulse" : ""}`} />
      {label ?? s.label}
    </span>
  );
}

/** Amber chip marking a page/panel as illustrative (not real production data). */
export function MockBadge({ label = "Illustrative data" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-chip border border-warn-bd bg-warn-bg px-2 py-0.5 text-2xs font-semibold text-warn-fg" title="Sample/mock data — not connected to a live source">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3 2 20h20L12 3z" /><path d="M12 10v4M12 17h.01" /></svg>
      {label}
    </span>
  );
}

/* Sub-heading within a section. The shell header owns the section title, so
   this is the page-level heading beneath it (and the only heading on detail
   routes, where crumbs carry the hierarchy). */
// `title` is optional: on a section landing page the shell header already
// shows it, so the page renders only its lead paragraph and badges.
export function PageHead({ title, sub, right, crumbs, mock }: { title?: string; sub?: string; right?: React.ReactNode; crumbs?: { label: string; href?: string }[]; mock?: boolean }) {
  return (
    <div className="mb-5">
      {crumbs && (
        <nav className="mb-2 flex items-center gap-1.5 font-mono text-[11px] text-muted2">
          {crumbs.map((c, i) => (
            <span key={i} className="flex items-center gap-1.5">
              {c.href ? <Link href={c.href} className="cursor-pointer hover:text-ink">{c.label}</Link> : <span>{c.label}</span>}
              {i < crumbs.length - 1 && <span className="opacity-50">/</span>}
            </span>
          ))}
        </nav>
      )}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {title
            ? <h1 className="flex items-center gap-2.5 text-[17px] font-semibold tracking-[-0.02em]">{title}{mock && <MockBadge />}</h1>
            : mock && <MockBadge />}
          {sub && <p className={`max-w-[70ch] text-[12.5px] leading-relaxed text-muted ${title || mock ? "mt-1" : ""}`}>{sub}</p>}
        </div>
        {right && <div className="flex items-center gap-2">{right}</div>}
      </div>
    </div>
  );
}

/* a labelled "Related" cross-link chip row (§64 correlation) */
export function Related({ items }: { items: { label: string; href: string }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11.5px] text-muted2">Related</span>
      {items.map((it, i) => (
        <Link key={i} href={it.href} className="cursor-pointer rounded-chip border border-line bg-panel2 px-2.5 py-1 text-[12px] text-ink2 transition-colors hover:border-muted2/60 hover:text-ink">{it.label}</Link>
      ))}
    </div>
  );
}

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
