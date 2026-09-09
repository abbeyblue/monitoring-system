"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMonitor } from "@/components/monitor-context";
import { useBusiness } from "@/components/use-business";
import { Dot, HEALTH_COLOR, HEALTH_LABEL } from "@/components/kit";
import { searchIndex, type Health } from "@/lib/mock";

type Kind = "overall" | "probes" | "business" | "incidents" | "mock" | "none";
type Item = { href: string; label: string; kind: Kind };
type Group = { heading: string; items: Item[] };

const NAV: Group[] = [
  { heading: "Overview", items: [
    { href: "/", label: "Dashboard", kind: "overall" },
    { href: "/service-health", label: "Service Health", kind: "probes" },
  ]},
  { heading: "Observability", items: [
    { href: "/apis", label: "APIs", kind: "probes" },
    { href: "/logs", label: "Logs", kind: "mock" },
    { href: "/traces", label: "Traces", kind: "mock" },
    { href: "/metrics", label: "Metrics", kind: "mock" },
    { href: "/infrastructure", label: "Infrastructure", kind: "mock" },
    { href: "/databases", label: "Databases", kind: "mock" },
    { href: "/queues", label: "Queues", kind: "mock" },
  ]},
  { heading: "CRM", items: [
    { href: "/customers", label: "Customers", kind: "business" },
    { href: "/leads", label: "Leads", kind: "mock" },
    { href: "/opportunities", label: "Opportunities", kind: "mock" },
    { href: "/background-jobs", label: "Background Jobs", kind: "mock" },
    { href: "/integrations", label: "Integrations", kind: "mock" },
    { href: "/webhooks", label: "Webhooks", kind: "mock" },
    { href: "/business-health", label: "Business Health", kind: "business" },
  ]},
  { heading: "Operations", items: [
    { href: "/alerts", label: "Alerts", kind: "mock" },
    { href: "/alert-rules", label: "Alert Rules", kind: "mock" },
    { href: "/incidents", label: "Incidents", kind: "incidents" },
    { href: "/deployments", label: "Deployments", kind: "mock" },
    { href: "/runbooks", label: "Runbooks", kind: "mock" },
  ]},
  { heading: "Security", items: [
    { href: "/security-events", label: "Security Events", kind: "mock" },
    { href: "/audit-logs", label: "Audit Logs", kind: "mock" },
  ]},
  { heading: "Platform", items: [
    { href: "/diagnostics", label: "Diagnostics", kind: "none" },
    { href: "/slo", label: "SLO / SLA", kind: "mock" },
    { href: "/capacity", label: "Capacity", kind: "mock" },
    { href: "/cost", label: "Cost", kind: "mock" },
    { href: "/monitoring-health", label: "Monitoring Health", kind: "mock" },
    { href: "/settings", label: "Settings", kind: "none" },
  ]},
];

const HIDDEN: Record<string, string[]> = {
  "super-admin": [], finance: ["/security-events", "/audit-logs"],
  sales: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
  marketing: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
  hr: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
  support: ["/cost", "/security-events", "/audit-logs", "/monitoring-health"],
};
const isPlaceholder = (u?: string | null) => !u || /your[-_]crm[-_]host/i.test(u);
const fmtRel = (iso: string) => { const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`; };
const worst = (hs: Health[]): Health => hs.includes("critical") ? "critical" : hs.includes("degraded") ? "degraded" : hs.some((h) => h === "healthy") ? "healthy" : "unknown";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: live } = useMonitor();
  const { data: biz } = useBusiness();

  const [role, setRole] = useState<string>("super-admin");
  useEffect(() => { fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).then((j) => j?.role && setRole(j.role)).catch(() => {}); }, []);
  const canSee = (href: string) => !(HIDDEN[role] ?? []).includes(href);

  // ---- real status, no fabrication (P1) ----
  const probes = live ? [...live.endpoints, ...live.authed] : [];
  const probeConfigured = live ? !isPlaceholder(live.crmBase) : false;
  const bizConfigured = Boolean(biz?.configured);
  const notConnected = live != null && !probeConfigured && !bizConfigured;

  const probeState: Health = !live ? "unknown" : !probeConfigured ? "unknown" : worst(probes.map((e) => e.health === "down" ? "critical" : e.health === "warn" ? "degraded" : e.health === "ok" ? "healthy" : "unknown"));
  const bizState: Health = !biz ? "unknown" : !bizConfigured ? "unknown" : worst((biz.kpis).filter((k) => k.status === "ok").map((k) => k.health));
  const incidentsActive = live?.incidents.active.length ?? 0;
  const overall: Health = notConnected ? "unknown" : worst([probeState, bizState, incidentsActive > 0 ? "critical" : "healthy"]);

  const statusFor = (kind: Kind): Health | null => {
    switch (kind) {
      case "overall": return overall;
      case "probes": return probeState;
      case "business": return bizState;
      case "incidents": return incidentsActive > 0 ? "critical" : (live ? "healthy" : "unknown");
      case "mock": return null;  // illustrative — shows a hollow marker
      case "none": return null;  // real page, no single health signal — no marker
    }
  };
  const lastUpdated = live?.checkedAt ?? biz?.generatedAt ?? null;

  // ---- global search over the illustrative catalog (navigation aid) ----
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const results = useMemo(() => {
    if (!q.trim()) return [];
    const s = q.toLowerCase();
    return searchIndex().filter((h) => h.label.toLowerCase().includes(s) || h.id.toLowerCase().includes(s) || h.type.toLowerCase().includes(s)).slice(0, 8);
  }, [q]);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc); return () => document.removeEventListener("mousedown", onDoc);
  }, []);
  function go(href: string) { setOpen(false); setQ(""); router.push(href); }

  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="flex h-14 items-center gap-3 px-4">
          <div className="flex w-56 items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent/15 text-accent">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12h4l2 6 4-14 2 8h6" /></svg>
            </span>
            <span className="text-sm font-semibold tracking-tight">CRM Observability</span>
          </div>

          {/* overall status — real, or NOT CONNECTED (never fabricated) */}
          {notConnected ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-idle/40 bg-idle/10 px-2.5 py-1.5">
              <span className="h-2.5 w-2.5 rounded-[3px] bg-idle" />
              <span className="text-xs font-bold uppercase tracking-wide text-idle">Not connected</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5" style={{ borderColor: `${HEALTH_COLOR[overall]}55`, background: `${HEALTH_COLOR[overall]}12` }}>
              <Dot health={overall} pulse={overall === "healthy"} />
              <span className="text-xs font-bold uppercase tracking-wide" style={{ color: HEALTH_COLOR[overall] }}>{overall === "unknown" ? "Checking…" : HEALTH_LABEL[overall]}</span>
            </div>
          )}

          <div ref={boxRef} className="relative mx-auto w-full max-w-md">
            <div className="flex items-center gap-2 rounded-lg border border-line bg-panel px-2.5 py-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-muted"><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></svg>
              <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search catalog…" className="w-full bg-transparent text-xs text-ink placeholder:text-muted focus:outline-none" />
            </div>
            {open && results.length > 0 && (
              <div className="absolute left-0 right-0 top-11 z-40 overflow-hidden rounded-lg border border-line bg-panel shadow-panel">
                {results.map((r) => (
                  <button key={r.type + r.id} onClick={() => go(r.href)} className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-panel2 cursor-pointer">
                    <span className="rounded border border-line px-1.5 py-0.5 text-2xs text-muted">{r.type}</span>
                    <span className="truncate">{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            {lastUpdated && <span className="hidden items-center gap-1.5 rounded-md border border-line bg-panel px-2 py-1.5 text-2xs text-muted lg:flex"><span className="h-1.5 w-1.5 rounded-full bg-ok motion-safe:animate-pulse" />updated {fmtRel(lastUpdated)} ago</span>}
            <Link href="/incidents" className="relative flex h-8 w-8 items-center justify-center rounded-md border border-line bg-panel2 text-muted transition-colors hover:text-ink cursor-pointer" aria-label="Incidents">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              {incidentsActive > 0 && <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-down px-1 text-[9px] font-bold text-white">{incidentsActive}</span>}
            </Link>
            <ThemeToggle />
            <span className="hidden items-center gap-1.5 rounded-md border border-line bg-panel2 px-2 py-1.5 text-2xs text-muted sm:flex" title="Operator role (MONITOR_ROLE) — scopes visible KPIs and pages">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2 4 6v6c0 5 3.5 8 8 10 4.5-2 8-5 8-10V6z" /></svg>{role}
            </span>
          </div>
        </div>
      </header>

      <div className="flex">
        <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-56 shrink-0 overflow-y-auto border-r border-line bg-panel/40 px-3 py-4 md:block">
          {NAV.map((g) => {
            const items = g.items.filter((it) => canSee(it.href));
            if (items.length === 0) return null;
            return (
              <div key={g.heading} className="mb-4">
                <div className="mb-1 px-2.5 text-[10px] font-bold uppercase tracking-[0.12em] text-muted/70">{g.heading}</div>
                <nav className="flex flex-col gap-0.5">
                  {items.map((it) => {
                    const active = isActive(it.href);
                    const st = statusFor(it.kind);
                    return (
                      <Link key={it.href} href={it.href} className={`relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] transition-colors duration-200 ${active ? "text-ink" : "text-muted hover:text-ink"}`}>
                        {active && <motion.span layoutId="nav-active" className="absolute inset-0 -z-10 rounded-md border border-line bg-panel2" transition={{ type: "spring", stiffness: 400, damping: 32 }} />}
                        <span className="font-medium">{it.label}</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          {it.kind === "incidents" && incidentsActive > 0 && <span className="rounded bg-down/15 px-1 font-mono text-[10px] font-semibold text-down">{incidentsActive}</span>}
                          {st ? <Dot health={st} /> : it.kind === "mock" ? <span className="h-1.5 w-1.5 rounded-full border border-muted/40" title="Illustrative — no live source" /> : null}
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              </div>
            );
          })}
          <p className="mt-2 px-2.5 text-[10px] leading-relaxed text-muted/60"><span className="inline-block h-1.5 w-1.5 rounded-full border border-muted/40 align-middle" /> = illustrative (no live source)</p>
        </aside>

        <main className="min-w-0 flex-1 p-4">{children}</main>
      </div>
    </div>
  );
}
