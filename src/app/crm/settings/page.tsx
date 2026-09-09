"use client";

import { useEffect, useMemo, useState } from "react";
import { useMonitor } from "@/components/monitor-context";
import { Panel, Dot, PageHead, TONE } from "@/components/kit";
import { mapHealth } from "@/components/live";

const fmtClock = (iso: string | null) =>
  iso ? new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" }) : "—";

interface EnvStatus {
  cloudwatch: boolean; authCookie: boolean; slackAlerts: boolean; webhookAlerts: boolean;
  heartbeatToken: boolean; passwordGate: boolean; region: string; logGroups: string[]; storage: string;
}
interface SettingsResp { env: EnvStatus; effective: { minTier: number; consecutiveFailures: number }; }

const TIER_LABEL: Record<number, string> = { 1: "Critical only", 2: "Core & up", 3: "Everything" };

export default function SettingsPage() {
  const { data, reload } = useMonitor();
  const [cfg, setCfg] = useState<SettingsResp | null>(null);
  const [minTier, setMinTier] = useState(2);
  const [consec, setConsec] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // silence form
  const [target, setTarget] = useState("*");
  const [minutes, setMinutes] = useState(60);

  async function loadCfg() {
    const r = await fetch("/api/settings", { cache: "no-store" });
    const j: SettingsResp = await r.json();
    setCfg(j); setMinTier(j.effective.minTier); setConsec(j.effective.consecutiveFailures);
  }
  useEffect(() => { loadCfg(); }, []);

  async function saveAlerts() {
    setSaving(true);
    await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ minTier, consecutiveFailures: consec }) });
    await loadCfg(); setSaving(false); setSaved(true); setTimeout(() => setSaved(false), 1500);
  }

  async function addSilence() {
    await fetch("/api/silence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: target, minutes, reason: "manual" }) });
    reload();
  }
  async function clearSilence(id: string) {
    await fetch(`/api/silence?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    reload();
  }

  const targets = useMemo(() => {
    const list: { id: string; label: string }[] = [{ id: "*", label: "Everything (maintenance)" }];
    if (data) {
      for (const e of data.endpoints) list.push({ id: e.id, label: `API · ${e.label}` });
      for (const e of data.authed) list.push({ id: e.id, label: `Auth · ${e.label}` });
      for (const c of data.cloudwatch.cronRuns) list.push({ id: `cron:${c.id}`, label: `Cron · ${c.label}` });
      for (const d of data.deps) list.push({ id: `dep:${d.id}`, label: `Dep · ${d.label}` });
      for (const m of data.cloudwatch.metrics) list.push({ id: `metric:${m.id}`, label: `Metric · ${m.label}` });
    }
    return list;
  }, [data]);

  const env = cfg?.env;
  const silences = data?.silences ?? [];

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHead sub="Environment status, alert thresholds (saved to the datastore), and silences." />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {/* Integrations */}
        <Panel title="Integrations & environment">
          <div className="divide-y divide-line">
            <EnvRow ok={env?.cloudwatch} label="AWS CloudWatch" on="connected" off="no AWS creds" />
            <EnvRow ok={env?.authCookie} label="Authenticated checks" on="session cookie set" off="MONITOR_SESSION_COOKIE unset" />
            <EnvRow ok={env?.slackAlerts} label="Slack alerts" on="webhook set" off="not configured" />
            <EnvRow ok={env?.webhookAlerts} label="Generic webhook" on="set" off="not configured" />
            <EnvRow ok={env?.heartbeatToken} label="Heartbeat token" on="required" off="open (no token)" warnWhenOff />
            <EnvRow ok={env?.passwordGate} label="Password gate" on="enabled" off="OPEN — set MONITOR_PASSWORD" warnWhenOff />
            <Info label="Storage" value={env?.storage ?? "…"} />
            <Info label="AWS region" value={env?.region ?? "…"} />
            <Info label="Log groups" value={env?.logGroups?.join(", ") || "—"} mono />
          </div>
        </Panel>

        {/* Alerting */}
        <div className="flex flex-col gap-3">
          <Panel title="Alert thresholds">
            <div className="space-y-4 p-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">Notify severity (min tier)</label>
                <div className="flex gap-1.5">
                  {[1, 2, 3].map((t) => (
                    <button key={t} onClick={() => setMinTier(t)}
                      className={`flex-1 rounded-md border px-2 py-2 text-xs font-medium transition-colors duration-200 cursor-pointer ${minTier === t ? "border-accent/60 bg-accent/10 text-ink" : "border-line bg-panel2 text-muted hover:text-ink"}`}>
                      <div>T{t}+</div><div className="mt-0.5 text-[10px] font-normal text-muted">{TIER_LABEL[t]}</div>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-muted">De-flap — consecutive failures before alerting</label>
                <div className="flex items-center gap-2">
                  <input type="range" min={1} max={10} value={consec} onChange={(e) => setConsec(Number(e.target.value))} className="flex-1 accent-[rgb(var(--accent))] cursor-pointer" />
                  <span className="w-10 rounded-md border border-line bg-panel2 py-1 text-center font-mono text-xs">{consec}</span>
                </div>
                <p className="mt-1 text-[11px] text-muted">≈ {consec * 30}s of continuous failure at the 30s poll interval.</p>
              </div>
              <button onClick={saveAlerts} disabled={saving}
                className="w-full rounded-md border border-accent/60 bg-accent/15 py-2 text-xs font-semibold text-ink transition-colors duration-200 hover:bg-accent/25 disabled:opacity-50 cursor-pointer">
                {saving ? "Saving…" : saved ? "Saved ✓" : "Save thresholds"}
              </button>
            </div>
          </Panel>

          <Panel title="Silences" count={`${silences.length} active`}>
            <div className="space-y-3 p-4">
              <div className="flex flex-wrap items-end gap-2">
                <div className="min-w-[160px] flex-1">
                  <label className="mb-1 block text-[11px] text-muted">Target</label>
                  <select value={target} onChange={(e) => setTarget(e.target.value)}
                    className="w-full rounded-md border border-line bg-panel2 px-2 py-1.5 text-xs text-ink cursor-pointer">
                    {targets.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
                  </select>
                </div>
                <div className="w-20">
                  <label className="mb-1 block text-[11px] text-muted">Minutes</label>
                  <input type="number" min={1} max={1440} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}
                    className="w-full rounded-md border border-line bg-panel2 px-2 py-1.5 text-xs text-ink" />
                </div>
                <button onClick={addSilence} className="rounded-md border border-line bg-panel2 px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:text-ink cursor-pointer">Silence</button>
              </div>

              {silences.length === 0 ? (
                <p className="text-[11px] text-muted">No active silences.</p>
              ) : (
                <ul className="divide-y divide-line rounded-md border border-line">
                  {silences.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                      <span className="font-mono">{s.scope === "*" ? "everything" : s.scope}</span>
                      <span className="text-[11px] text-muted">until {fmtClock(s.until)}</span>
                      <button onClick={() => clearSilence(s.id)} className="ml-auto text-[11px] text-muted transition-colors hover:text-down cursor-pointer">clear</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function EnvRow({ ok, label, on, off, warnWhenOff }: { ok?: boolean; label: string; on: string; off: string; warnWhenOff?: boolean }) {
  const health = mapHealth(ok ? "ok" : warnWhenOff ? "warn" : "idle");
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 text-xs">
      <Dot health={health} />
      <span className="font-medium">{label}</span>
      <span className={`ml-auto text-[11px] ${TONE[health].fg}`}>{ok ? on : off}</span>
    </div>
  );
}
function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 text-xs">
      <span className="font-medium text-muted">{label}</span>
      <span className={`ml-auto truncate text-ink ${mono ? "font-mono text-[11px]" : ""}`}>{value}</span>
    </div>
  );
}
