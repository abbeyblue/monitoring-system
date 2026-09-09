// State access on top of the pluggable storage adapter (file or Postgres).
import { getStorage, type StoreState, type Silence, type Settings } from "@/lib/storage";
import { ALERT_MIN_TIER, ALERT_CONSECUTIVE_FAILURES } from "@/lib/config";

export type { StoreState, Incident, Silence, Settings } from "@/lib/storage";

let cache: StoreState | null = null;

export async function loadState(): Promise<StoreState> {
  if (cache) return cache;
  cache = await getStorage().read();
  return cache;
}

export async function saveState(state: StoreState): Promise<void> {
  cache = state;
  await getStorage().write(state);
}

export function storageKind() {
  return getStorage().kind;
}

export async function recordHeartbeat(job: string): Promise<void> {
  const s = await loadState();
  s.heartbeats[job] = new Date().toISOString();
  await saveState(s);
}

export async function readHeartbeats(): Promise<Record<string, string>> {
  return (await loadState()).heartbeats;
}

export async function pushLatency(checkId: string, ms: number, cap = 30): Promise<void> {
  const s = await loadState();
  const arr = (s.latency[checkId] ??= []);
  arr.push(ms);
  if (arr.length > cap) arr.shift();
  await saveState(s);
}

// ---- silences / maintenance ----
export function activeSilences(silences: Silence[], now = Date.now()): Silence[] {
  return silences.filter((s) => new Date(s.until).getTime() > now);
}
export function isSilenced(checkId: string, silences: Silence[], now = Date.now()): boolean {
  return activeSilences(silences, now).some((s) => s.scope === "*" || s.scope === checkId);
}

export async function addSilence(scope: string, minutes: number, reason?: string): Promise<Silence> {
  const s = await loadState();
  const sil: Silence = {
    id: `${scope}:${new Date().toISOString()}`,
    scope,
    until: new Date(Date.now() + minutes * 60_000).toISOString(),
    reason,
  };
  s.silences = [sil, ...activeSilences(s.silences)];
  await saveState(s);
  return sil;
}

export async function clearSilence(idOrScope: string): Promise<void> {
  const s = await loadState();
  s.silences = activeSilences(s.silences).filter((x) => x.id !== idOrScope && x.scope !== idOrScope);
  await saveState(s);
}

// ---- settings (runtime overrides of env defaults) ----
export async function effectiveSettings(): Promise<{ minTier: number; consecutiveFailures: number }> {
  const s = await loadState();
  return {
    minTier: s.settings.minTier ?? ALERT_MIN_TIER,
    consecutiveFailures: s.settings.consecutiveFailures ?? ALERT_CONSECUTIVE_FAILURES,
  };
}

export async function updateSettings(patch: Settings): Promise<Settings> {
  const s = await loadState();
  const next: Settings = { ...s.settings };
  if (patch.minTier != null) next.minTier = Math.min(3, Math.max(1, Math.round(patch.minTier)));
  if (patch.consecutiveFailures != null) next.consecutiveFailures = Math.min(10, Math.max(1, Math.round(patch.consecutiveFailures)));
  s.settings = next;
  await saveState(s);
  return next;
}
