"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useMonitor } from "@/components/monitor-context";
import { useBusiness } from "@/components/use-business";
import { Dot, TONE } from "@/components/kit";
import { SECTIONS, HIDDEN_NAV, sectionFor, tabFor, type Kind, type Section } from "@/lib/nav";
import { searchIndex, HEALTH_LABEL, type Health } from "@/lib/mock";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 1.4, viewBox: "0 0 16 16" } as const;

const ICON: Record<string, React.ReactNode> = {
  overview: <><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1" /><rect x="9" y="1.5" width="5.5" height="5.5" rx="1" /><rect x="1.5" y="9" width="5.5" height="5.5" rx="1" /><rect x="9" y="9" width="5.5" height="5.5" rx="1" /></>,
  crm: <><ellipse cx="8" cy="3.6" rx="5.5" ry="2.1" /><path d="M2.5 3.6v8.8c0 1.16 2.46 2.1 5.5 2.1s5.5-.94 5.5-2.1V3.6" /><path d="M2.5 8c0 1.16 2.46 2.1 5.5 2.1s5.5-.94 5.5-2.1" /></>,
  users: <><circle cx="6" cy="5" r="2.6" /><path d="M1.6 13.6c0-2.4 2-4 4.4-4s4.4 1.6 4.4 4" /><path d="M11 3.1a2.6 2.6 0 0 1 0 4.6M12.2 9.9c1.4.5 2.3 1.8 2.3 3.7" /></>,
  websites: <><circle cx="8" cy="8" r="6.3" /><path d="M1.7 8h12.6" /><ellipse cx="8" cy="8" rx="2.9" ry="6.3" /></>,
  services: <><rect x="1.5" y="2.5" width="13" height="4.2" rx="1" /><rect x="1.5" y="9.3" width="13" height="4.2" rx="1" /><circle cx="4.4" cy="4.6" r=".6" fill="currentColor" stroke="none" /><circle cx="4.4" cy="11.4" r=".6" fill="currentColor" stroke="none" /></>,
  incidents: <><path d="M8 2.2 14.5 13.4H1.5Z" strokeLinejoin="round" /><path d="M8 6.4v3" /><circle cx="8" cy="11.4" r=".7" fill="currentColor" stroke="none" /></>,
  logs: <><path d="M3 1.8h6l4 4v8.4H3Z" strokeLinejoin="round" /><path d="M5.4 7.6h5.2M5.4 10.2h3.4" /></>,
  settings: <><circle cx="8" cy="8" r="2.3" /><circle cx="8" cy="8" r="5.9" strokeDasharray="2.4 2.1" /></>,
};
const Icon = ({ id, size = 15 }: { id: string; size?: number }) => <svg width={size} height={size} {...S}>{ICON[id]}</svg>;

const isPlaceholder = (u?: string | null) => !u || /your[-_]crm[-_]host/i.test(u);
const fmtRel = (iso: string) => { const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m` : `${Math.floor(s / 3600)}h`; };
const worst = (hs: Health[]): Health => hs.includes("critical") ? "critical" : hs.includes("degraded") ? "degraded" : hs.some((h) => h === "healthy") ? "healthy" : "unknown";

const MOBILE_TABS = ["overview", "websites", "incidents", "users"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: live, reload } = useMonitor();
  const { data: biz } = useBusiness();

  const [role, setRole] = useState<string>("super-admin");
  useEffect(() => { fetch("/api/me", { cache: "no-store" }).then((r) => r.json()).then((j) => j?.role && setRole(j.role)).catch(() => {}); }, []);
  const canSee = (href: string) => !(HIDDEN_NAV[role as keyof typeof HIDDEN_NAV] ?? []).includes(href);

  // ---- real status, no fabrication (P1) ----
  const probes = live ? [...live.endpoints, ...live.authed] : [];
  const probeConfigured = live ? !isPlaceholder(live.crmBase) : false;
  const bizConfigured = Boolean(biz?.configured);
  const notConnected = live != null && !probeConfigured && !bizConfigured;

  const probeState: Health = !live ? "unknown" : !probeConfigured ? "unknown" : worst(probes.map((e) => e.health === "down" ? "critical" : e.health === "warn" ? "degraded" : e.health === "ok" ? "healthy" : "unknown"));
  const bizState: Health = !biz ? "unknown" : !bizConfigured ? "unknown" : worst((biz.kpis).filter((k) => k.status === "ok").map((k) => k.health));
  const incidentsActive = live?.incidents.active.length ?? 0;
  // Until /api/status resolves there is no probe signal, so the incidents term
  // must not vote "healthy" — that claimed All Systems Operational on first paint.
  const incidentState: Health = !live ? "unknown" : incidentsActive > 0 ? "critical" : "healthy";
  const overall: Health = notConnected || !live ? "unknown" : worst([probeState, bizState, incidentState]);

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

  const section = sectionFor(pathname);
  const activeTab = tabFor(section, pathname);
  const visibleTabs = section.tabs.filter((t) => canSee(t.href));

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

  const statusPill = notConnected ? (
    <span className="flex items-center gap-2 rounded-ctl border border-idle-bd bg-idle-bg px-2.5 py-1.5 text-[12.5px] font-medium text-idle-fg">
      <span className="h-[7px] w-[7px] rounded-full bg-idle" />Not connected
    </span>
  ) : (
    <span className={`flex items-center gap-2 rounded-ctl border px-2.5 py-1.5 text-[12.5px] font-medium ${TONE[overall].fg} ${TONE[overall].bg} ${TONE[overall].bd}`}>
      <Dot health={overall} pulse={overall === "healthy"} />
      {overall === "unknown" ? "Checking…" : overall === "healthy" ? "All Systems Operational" : HEALTH_LABEL[overall]}
    </span>
  );

  const groups: Section["group"][] = ["Monitoring", "Operations"];

  return (
    <div className="min-h-screen">
      <div className="flex items-stretch">
        {/* ---- sidebar (desktop) ---- */}
        <aside className="sticky top-0 hidden h-screen w-[248px] shrink-0 flex-col border-r border-line bg-bg/[0.86] backdrop-blur-chrome backdrop-saturate-[1.8] md:flex">
          <div className="border-b border-line2 px-[18px] py-5">
            <Link href="/crm" className="flex items-center gap-2.5">
              <span className="flex h-[26px] w-[26px] items-center justify-center rounded-[7px] bg-[#151c34] text-xs font-semibold tracking-[0.02em] text-white">AB</span>
              <span className="flex flex-col leading-[1.25]">
                <strong className="text-[13.5px] font-semibold">Abbey Blue</strong>
                <span className="font-mono text-[11px] text-muted">Operations monitor</span>
              </span>
            </Link>
          </div>

          <div ref={boxRef} className="relative px-[10px] pt-3">
            <label className="flex items-center gap-2 rounded-ctl border border-line bg-panel px-2.5 py-1.5">
              <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 text-muted"><circle cx="7" cy="7" r="4.6" /><path d="M10.4 10.4 14 14" /></svg>
              <input value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} placeholder="Search catalog" className="w-full bg-transparent text-[13px] text-ink placeholder:text-muted2 focus:outline-none" />
            </label>
            {open && results.length > 0 && (
              <div className="absolute left-[10px] right-[10px] top-[46px] z-40 overflow-hidden rounded-card border border-line bg-panel shadow-card">
                {results.map((r) => (
                  <button key={r.type + r.id} onClick={() => go(r.href)} className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-xs transition-colors hover:bg-hover">
                    <span className="rounded-chip border border-line px-1.5 py-0.5 font-mono text-[10px] text-muted2">{r.type}</span>
                    <span className="truncate">{r.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <nav className="flex flex-1 flex-col gap-px overflow-auto px-[10px] py-3">
            {groups.map((g) => (
              <div key={g} className="contents">
                <span className="px-3 pb-1 pt-2 text-[11.5px] font-semibold text-heading">{g}</span>
                {SECTIONS.filter((s) => s.group === g).map((s) => {
                  const active = s.id === section.id;
                  const st = statusFor(s.kind);
                  return (
                    <Link key={s.id} href={s.href}
                      className={`flex items-center gap-2.5 rounded-ctl px-2.5 py-[7px] text-[13.5px] transition-colors ${active ? "bg-accent/[0.09] font-semibold text-accent" : "text-ink2 hover:bg-panel2"}`}>
                      <Icon id={s.id} />
                      {s.label}
                      <span className="ml-auto flex items-center gap-1.5">
                        {s.id === "incidents" && incidentsActive > 0 && (
                          <span className="rounded-ctl bg-down-bg px-1.5 font-mono text-[10.5px] text-down-fg">{incidentsActive}</span>
                        )}
                        {st ? <Dot health={st} /> : s.kind === "mock" ? <span className="h-1.5 w-1.5 rounded-full border border-muted2/40" title="Illustrative — no live source" /> : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="flex items-center gap-2 border-t border-line2 px-4 py-3 font-mono text-[10.5px] text-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${TONE[overall].dot}`} />
            <span className="whitespace-nowrap">{notConnected ? "Not connected" : overall === "healthy" ? "All operational" : HEALTH_LABEL[overall]}{lastUpdated && ` · checked ${fmtRel(lastUpdated)} ago`}</span>
          </div>
        </aside>

        {/* ---- main ---- */}
        <main className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-10 flex min-h-[66px] flex-wrap items-center gap-4 border-b border-line bg-panel/[0.82] px-5 py-3.5 backdrop-blur-chrome backdrop-saturate-[1.8] lg:px-8">
            <div className="flex min-w-0 flex-col leading-[1.3]">
              <h1 className="text-[19px] font-semibold tracking-[-0.022em]">{section.title}</h1>
              <span className="text-[12.5px] text-muted">{section.sub}</span>
            </div>
            <div className="ml-auto flex flex-wrap items-center justify-end gap-3">
              {statusPill}
              {lastUpdated && <span className="hidden font-mono text-[11.5px] text-muted lg:inline">Updated {fmtRel(lastUpdated)} ago</span>}
              <button onClick={() => reload()} className="flex cursor-pointer items-center gap-1.5 rounded-ctl border border-line bg-panel px-2.5 py-1.5 text-[12.5px] text-ink2 transition-colors hover:border-muted2/60 hover:bg-hover">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M13.5 8a5.5 5.5 0 1 1-1.7-3.9" /><path d="M13.8 2.2v3.2h-3.2" /></svg>
                Refresh
              </button>
              <span className="hidden h-[22px] w-px bg-line sm:block" />
              <ThemeToggle />
              <span className="flex items-center gap-2" title="Operator role (MONITOR_ROLE) — scopes visible KPIs and pages">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-panel2 text-[11.5px] font-semibold uppercase text-ink2">{role.slice(0, 2)}</span>
                <span className="hidden text-[12.5px] text-ink2 sm:inline">{role}</span>
              </span>
            </div>
          </header>

          {visibleTabs.length > 1 && (
            <div className="sticky top-[66px] z-[9] border-b border-line bg-bg/[0.86] px-5 py-2.5 backdrop-blur-chrome lg:px-8">
              <div className="flex w-fit max-w-full gap-0.5 overflow-x-auto rounded-card bg-panel2 p-[3px]">
                {visibleTabs.map((t) => {
                  const active = activeTab?.href === t.href;
                  return (
                    <Link key={t.href} href={t.href}
                      className={`whitespace-nowrap rounded-chip px-3 py-1.5 text-[12.5px] transition-colors ${active ? "bg-panel font-semibold text-ink shadow-card" : "text-muted hover:text-ink"}`}>
                      {t.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          <div className="w-full max-w-[1300px] px-5 pb-24 pt-7 md:pb-20 lg:px-8">{children}</div>
        </main>
      </div>

      {/* ---- mobile bottom tab bar (the desktop sidebar is hidden below md) ---- */}
      <nav className="fixed bottom-0 left-0 right-0 z-20 grid grid-cols-4 border-t border-line bg-panel/95 backdrop-blur-chrome md:hidden">
        {MOBILE_TABS.map((id) => {
          const s = SECTIONS.find((x) => x.id === id)!;
          const active = s.id === section.id;
          return (
            <Link key={id} href={s.href} className={`flex flex-col items-center gap-1.5 px-0 pb-3.5 pt-2.5 text-[10.5px] ${active ? "text-accent" : "text-muted"}`}>
              <span className="relative">
                <Icon id={id} size={17} />
                {id === "incidents" && incidentsActive > 0 && <span className="absolute -right-1.5 -top-1 h-1.5 w-1.5 rounded-full bg-down" />}
              </span>
              {s.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
