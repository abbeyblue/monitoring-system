export type Health = "ok" | "warn" | "down" | "idle";

export interface Endpoint { id: string; label: string; path: string; tier: number; note?: string; authed?: boolean; health: Health; httpStatus: number; latency: number; detail?: string; }
export interface Cron { id: string; label: string; path: string; tier: number; schedule: string | null; lastExpected: string | null; nextExpected: string | null; lastHeartbeat: string | null; health: Health; note?: string; }
export interface Dep { id: string; label: string; tier: number; health: Health; detail?: string; note?: string; }
export interface AlarmView { name: string; state: string; reason?: string; updated?: string; health: Health; }
export interface MetricView { id: string; label: string; unit?: string; latest: number | null; series: number[]; health: Health; tier: number; }
export interface LogLine { ts: string; group: string; message: string; }
export interface CronRunView { id: string; label: string; health: Health; lastExpected: string | null; evidence?: string; }
export interface CloudWatch { enabled: boolean; region: string; error?: string; alarms: AlarmView[]; metrics: MetricView[]; logs: LogLine[]; cronRuns: CronRunView[]; }
export interface Incident { id: string; checkId: string; label: string; tier: number; severity: Health; openedAt: string; resolvedAt: string | null; detail?: string; suppressed?: boolean; }
export interface Silence { id: string; scope: string; until: string; reason?: string; }

export interface Status {
  crmBase: string; checkedAt: string;
  summary: { ok: number; warn: number; down: number; idle: number };
  endpoints: Endpoint[]; authed: Endpoint[]; authConfigured: boolean;
  crons: Cron[]; deps: Dep[]; cloudwatch: CloudWatch;
  incidents: { active: Incident[]; opened: number; resolved: number };
  silences: Silence[]; storage: string; knownUnprobed: string[];
}
