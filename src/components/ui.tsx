"use client";

import type { Health } from "@/lib/types";

export const COLOR: Record<Health, string> = {
  ok: "rgb(var(--ok))", warn: "rgb(var(--warn))", down: "rgb(var(--down))", idle: "rgb(var(--idle))",
};
export const LABEL: Record<Health, string> = { ok: "Operational", warn: "Degraded", down: "Down", idle: "Idle" };

export const worst = (hs: Health[]): Health =>
  hs.includes("down") ? "down" : hs.includes("warn") ? "warn" : hs.some((h) => h === "ok") ? "ok" : "idle";

export const fmtClock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtDateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
export const fmtRel = (iso: string) => {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`; return `${Math.floor(s / 86400)}d`;
};
export const dur = (a: string, b: string) => {
  const s = Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000);
  if (s < 60) return `${s}s`; if (s < 3600) return `${Math.floor(s / 60)}m`; return `${Math.floor(s / 3600)}h${Math.floor((s % 3600) / 60)}m`;
};

export function Sq({ health, pulse }: { health: Health; pulse?: boolean }) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse && <span className="absolute inline-flex h-full w-full rounded-[3px] opacity-70 motion-safe:animate-[ping2_2s_ease-out_infinite]" style={{ background: COLOR[health] }} aria-hidden />}
      <span className="relative inline-flex h-2 w-2 rounded-[3px]" style={{ background: COLOR[health] }} />
    </span>
  );
}

export function Spark({ points, color, fill = true, w = 68, h = 20 }: { points: number[]; color: string; fill?: boolean; w?: number; h?: number }) {
  if (points.length < 2) return <div style={{ width: w, height: h }} aria-hidden />;
  const max = Math.max(...points), min = Math.min(...points), range = max - min || 1;
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - ((p - min) / range) * (h - 3) - 1.5]);
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${xy[0][0]},${h} ${line} ${xy[xy.length - 1][0]},${h}`;
  return (
    <svg width={w} height={h} className="overflow-visible" role="img" aria-label="trend">
      {fill && <polygon points={area} fill={color} opacity={0.12} />}
      <polyline points={line} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export function Tier({ tier }: { tier: number }) {
  const c: Record<number, string> = { 1: "text-down border-down/40", 2: "text-warn border-warn/40", 3: "text-muted border-line" };
  return <span className={`rounded border px-1 text-[10px] font-semibold leading-4 ${c[tier] ?? c[3]}`}>T{tier}</span>;
}

export function Panel({ title, right, count, status, children, className = "" }: { title: string; right?: React.ReactNode; count?: string; status?: Health; children: React.ReactNode; className?: string }) {
  return (
    <section className={`flex flex-col overflow-hidden rounded-lg border border-line bg-panel shadow-panel ${className}`}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-line px-4">
        {status && <Sq health={status} />}
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink">{title}</h2>
        {count && <span className="font-mono text-[11px] text-muted">{count}</span>}
        <div className="ml-auto flex items-center gap-2">{right}</div>
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </section>
  );
}

export function PageHead({ title, sub, right }: { title: string; sub?: string; right?: React.ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
      </div>
      {right && <div className="flex items-center gap-2">{right}</div>}
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
