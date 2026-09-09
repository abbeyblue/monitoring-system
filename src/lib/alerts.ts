// Alerting engine: compares current health against last persisted health, opens
// an incident after N consecutive bad polls (de-flapping), escalates warn->down,
// resolves on recovery, and dispatches notifications — unless the check (or
// everything, via a "*" maintenance silence) is silenced.
import { ALERT_CHANNELS, type Health, type Tier } from "@/lib/config";
import { loadState, saveState, effectiveSettings } from "@/lib/store";
import { activeSilences, isSilenced } from "@/lib/store";
import type { Incident, Silence } from "@/lib/storage";

export interface CheckResult {
  id: string; label: string; tier: Tier; health: Health; detail?: string;
}

const isBad = (h: Health) => h === "down" || h === "warn";
const rank: Record<Health, number> = { down: 3, warn: 2, idle: 1, ok: 0 };

export interface AlertRunResult {
  opened: Incident[];
  resolved: Incident[];
  active: Incident[];
  silences: Silence[];
}

export async function runAlerts(results: CheckResult[], nowIso: string): Promise<AlertRunResult> {
  const state = await loadState();
  const { minTier, consecutiveFailures } = await effectiveSettings();
  const now = new Date(nowIso).getTime();
  state.silences = activeSilences(state.silences, now); // prune expired
  const opened: Incident[] = [];
  const resolved: Incident[] = [];

  for (const r of results) {
    const openInc = state.incidents.find((i) => i.checkId === r.id && !i.resolvedAt);
    const silenced = isSilenced(r.id, state.silences, now);

    if (isBad(r.health)) {
      const n = (state.pendingBad[r.id] = (state.pendingBad[r.id] ?? 0) + 1);
      if (!openInc && n >= consecutiveFailures) {
        const inc: Incident = {
          id: `${r.id}:${nowIso}`, checkId: r.id, label: r.label, tier: r.tier,
          severity: r.health, openedAt: nowIso, resolvedAt: null, detail: r.detail, suppressed: silenced,
        };
        state.incidents.unshift(inc);
        opened.push(inc);
      } else if (openInc && rank[r.health] > rank[openInc.severity]) {
        openInc.severity = r.health; openInc.detail = r.detail;
        opened.push(openInc); // escalation
      }
    } else if (r.health === "ok") {
      state.pendingBad[r.id] = 0;
      if (openInc) { openInc.resolvedAt = nowIso; resolved.push(openInc); }
    }
    state.lastHealth[r.id] = r.health;
  }

  state.incidents = state.incidents.slice(0, 500);
  await saveState(state);

  // dispatch: severity-gated AND not silenced
  const notify = [...opened, ...resolved].filter(
    (i) => i.tier <= minTier && !isSilenced(i.checkId, state.silences, now)
  );
  await Promise.all(notify.map((i) => dispatch(i, resolved.includes(i) ? "resolved" : "firing")));

  return {
    opened, resolved,
    active: state.incidents.filter((i) => !i.resolvedAt),
    silences: state.silences,
  };
}

async function dispatch(inc: Incident, phase: "firing" | "resolved") {
  const mark = phase === "resolved" ? "[RESOLVED]" : inc.severity === "down" ? "[DOWN]" : "[DEGRADED]";
  const title = `${mark} ${inc.label} (T${inc.tier})`;
  const body = inc.detail ? `${title} — ${inc.detail}` : title;

  const jobs: Promise<unknown>[] = [];
  if (ALERT_CHANNELS.slackWebhook) jobs.push(post(ALERT_CHANNELS.slackWebhook, { text: body }));
  if (ALERT_CHANNELS.genericWebhook) jobs.push(post(ALERT_CHANNELS.genericWebhook, {
    phase, severity: inc.severity, tier: inc.tier, check: inc.checkId, label: inc.label,
    detail: inc.detail ?? null, openedAt: inc.openedAt, resolvedAt: inc.resolvedAt,
  }));
  await Promise.allSettled(jobs);
}

async function post(url: string, payload: unknown) {
  try {
    await fetch(url, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(payload), signal: AbortSignal.timeout(6000),
    });
  } catch { /* best-effort */ }
}
