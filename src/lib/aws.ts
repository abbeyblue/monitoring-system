// AWS CloudWatch integration (eu-west-1, ECS + EventBridge).
// - Alarms: DescribeAlarms (shown if any exist)
// - Metrics: GetMetricData -> latest value + sparkline series, health vs thresholds
// - Error logs: FilterLogEvents over the configured log groups
// - Failed-cron detection: per-cron success/error markers in the log window
// All calls degrade gracefully when AWS creds are absent.
import {
  CloudWatchClient, DescribeAlarmsCommand, GetMetricDataCommand,
} from "@aws-sdk/client-cloudwatch";
import {
  CloudWatchLogsClient, FilterLogEventsCommand,
} from "@aws-sdk/client-cloudwatch-logs";
import {
  AWS_REGION, CLOUDWATCH_ENABLED, LOG_GROUPS, ERROR_FILTER_PATTERN,
  METRICS, CRON_JOBS, CRON_LOG_MARKERS, CRON_GRACE_MINUTES, type Health,
} from "@/lib/config";
import { prevFire } from "@/lib/cron";

const cw = () => new CloudWatchClient({ region: AWS_REGION });
const cwl = () => new CloudWatchLogsClient({ region: AWS_REGION });

export interface AlarmView { name: string; state: string; reason?: string; updated?: string; health: Health; }
export interface MetricView { id: string; label: string; unit?: string; latest: number | null; series: number[]; health: Health; tier: number; }
export interface LogLine { ts: string; group: string; message: string; }
export interface CronRunView { id: string; label: string; health: Health; lastExpected: string | null; evidence?: string; }

export interface CloudWatchView {
  enabled: boolean;
  region: string;
  error?: string;
  alarms: AlarmView[];
  metrics: MetricView[];
  logs: LogLine[];
  cronRuns: CronRunView[];
}

const alarmHealth = (state: string): Health =>
  state === "ALARM" ? "down" : state === "OK" ? "ok" : "warn";

export async function getCloudWatch(nowMs: number): Promise<CloudWatchView> {
  const base = { enabled: CLOUDWATCH_ENABLED, region: AWS_REGION, alarms: [], metrics: [], logs: [], cronRuns: [] as CronRunView[] };
  if (!CLOUDWATCH_ENABLED) {
    return { ...base, error: "AWS credentials not set — CloudWatch panel disabled. Set AWS_ACCESS_KEY_ID/SECRET or AWS_PROFILE." };
  }
  try {
    const [alarms, metrics, logs, cronRuns] = await Promise.all([
      getAlarms(), getMetrics(nowMs), getErrorLogs(nowMs), getCronRuns(nowMs),
    ]);
    return { ...base, alarms, metrics, logs, cronRuns };
  } catch (e) {
    return { ...base, error: e instanceof Error ? e.message : "CloudWatch query failed" };
  }
}

async function getAlarms(): Promise<AlarmView[]> {
  const res = await cw().send(new DescribeAlarmsCommand({ MaxRecords: 100 }));
  const all = [...(res.MetricAlarms ?? []), ...(res.CompositeAlarms ?? [])];
  return all.map((a) => ({
    name: a.AlarmName ?? "(unnamed)",
    state: a.StateValue ?? "UNKNOWN",
    reason: a.StateReason,
    updated: a.StateUpdatedTimestamp?.toISOString(),
    health: alarmHealth(a.StateValue ?? ""),
  }));
}

async function getMetrics(nowMs: number): Promise<MetricView[]> {
  if (METRICS.length === 0) return [];
  const start = new Date(nowMs - 3 * 3600 * 1000);
  const end = new Date(nowMs);
  const res = await cw().send(new GetMetricDataCommand({
    StartTime: start, EndTime: end, ScanBy: "TimestampAscending",
    MetricDataQueries: METRICS.map((m, i) => ({
      Id: `m${i}`,
      MetricStat: {
        Metric: { Namespace: m.namespace, MetricName: m.metricName, Dimensions: m.dimensions },
        Period: 300, Stat: m.stat,
      },
      ReturnData: true,
    })),
  }));
  return METRICS.map((m, i) => {
    const r = res.MetricDataResults?.find((x) => x.Id === `m${i}`);
    const series = (r?.Values ?? []).map((v) => Math.round(v * 100) / 100);
    const latest = series.length ? series[series.length - 1] : null;
    let health: Health = "ok";
    if (latest === null) health = "idle";
    else if (m.downAbove != null && latest >= m.downAbove) health = "down";
    else if (m.warnAbove != null && latest >= m.warnAbove) health = "warn";
    return { id: m.id, label: m.label, unit: m.unit, latest, series, health, tier: m.tier };
  });
}

async function getErrorLogs(nowMs: number): Promise<LogLine[]> {
  const start = nowMs - 60 * 60 * 1000; // last hour
  const out: LogLine[] = [];
  for (const group of LOG_GROUPS) {
    try {
      const res = await cwl().send(new FilterLogEventsCommand({
        logGroupName: group, startTime: start, endTime: nowMs,
        filterPattern: ERROR_FILTER_PATTERN, limit: 40,
      }));
      for (const e of res.events ?? []) {
        out.push({ ts: new Date(e.timestamp ?? nowMs).toISOString(), group, message: (e.message ?? "").trim().slice(0, 400) });
      }
    } catch { /* group may not exist yet */ }
  }
  return out.sort((a, b) => b.ts.localeCompare(a.ts)).slice(0, 50);
}

async function getCronRuns(nowMs: number): Promise<CronRunView[]> {
  const now = new Date(nowMs);
  const out: CronRunView[] = [];
  for (const c of CRON_JOBS) {
    if (!c.schedule) { out.push({ id: c.id, label: c.label, health: "warn", lastExpected: null, evidence: "no schedule configured" }); continue; }
    const last = prevFire(c.schedule, now);
    if (!last || nowMs - last.getTime() > 26 * 3600 * 1000) {
      out.push({ id: c.id, label: c.label, health: "idle", lastExpected: last?.toISOString() ?? null, evidence: "outside lookback window" });
      continue;
    }
    const markers = CRON_LOG_MARKERS[c.id] ?? { success: `${c.path} 200`, error: undefined };
    const windowStart = last.getTime();
    let ok = false, errored = false, evidence: string | undefined;
    for (const group of LOG_GROUPS) {
      try {
        if (markers.error) {
          const er = await cwl().send(new FilterLogEventsCommand({
            logGroupName: group, startTime: windowStart, endTime: nowMs,
            filterPattern: `"${markers.error}"`, limit: 1,
          }));
          if ((er.events ?? []).length) { errored = true; evidence = er.events![0].message?.trim().slice(0, 200); break; }
        }
        const sr = await cwl().send(new FilterLogEventsCommand({
          logGroupName: group, startTime: windowStart, endTime: nowMs,
          filterPattern: `"${markers.success}"`, limit: 1,
        }));
        if ((sr.events ?? []).length) { ok = true; evidence = sr.events![0].message?.trim().slice(0, 200); break; }
      } catch { /* group may not exist */ }
    }
    let health: Health;
    if (errored) health = "down";
    else if (ok) health = "ok";
    else health = nowMs - windowStart > CRON_GRACE_MINUTES * 60 * 1000 ? "down" : "idle"; // missed vs pending
    if (!evidence) evidence = health === "down" ? "no success marker within grace window" : health === "idle" ? "run pending" : undefined;
    out.push({ id: c.id, label: c.label, health, lastExpected: last.toISOString(), evidence });
  }
  return out;
}
