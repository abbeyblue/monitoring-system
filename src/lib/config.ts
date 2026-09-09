// What the dashboard monitors. Derived from the CRM route manifest.
// Sections: public endpoints (live-probed), authenticated staff routes
// (cookie-probed), cron jobs (schedule + CloudWatch-log verified),
// external dependencies, AWS CloudWatch (alarms/logs/metrics), and alerting.

export const CRM_BASE_URL = process.env.CRM_BASE_URL ?? "https://YOUR_CRM_HOST";

export type Tier = 1 | 2 | 3;
export type Health = "ok" | "warn" | "down" | "idle";

export interface HttpCheck {
  id: string;
  label: string;
  path: string;
  tier: Tier;
  okStatus: number[];
  keyword?: string;
  note?: string;
  /** requires the synthetic staff session cookie */
  authed?: boolean;
}

// 1) Publicly reachable CRM endpoints — probed live, server-side.
export const HTTP_CHECKS: HttpCheck[] = [
  { id: "health", label: "Health probe", path: "/api/health", tier: 1, okStatus: [200], keyword: "ok",
    note: "Liveness probe used by the load balancer." },
  { id: "pusher-status", label: "Realtime (Pusher) status", path: "/api/pusher/status", tier: 1, okStatus: [200] },
  { id: "push-vapid", label: "Web-push VAPID key", path: "/api/push/vapid-key", tier: 2, okStatus: [200] },
  { id: "auth-me", label: "Auth — session probe", path: "/api/auth/me", tier: 1, okStatus: [200, 401],
    note: "200 (session) or 401 (no session) both mean the auth stack is alive." },
  { id: "auth-check-status", label: "Auth — check-status", path: "/api/auth/check-status", tier: 2, okStatus: [200, 400, 401] },
];

// 2) Authenticated staff routes — GET, read-only, probed with a synthetic
//    read-only staff session cookie (set MONITOR_SESSION_COOKIE). Without the
//    cookie these show as "idle" (not configured). Never list mutating routes here.
export const AUTHED_CHECKS: HttpCheck[] = [
  { id: "auth-notifications", label: "Notifications feed", path: "/api/notifications", tier: 2, okStatus: [200], authed: true },
  { id: "auth-tickets-board", label: "Tickets board", path: "/api/tickets/board", tier: 1, okStatus: [200], authed: true },
  { id: "auth-search", label: "Global search", path: "/api/search?q=test", tier: 2, okStatus: [200], authed: true },
  { id: "auth-my-cases", label: "My cases", path: "/api/my-cases", tier: 2, okStatus: [200], authed: true },
  { id: "auth-users-me", label: "Users list", path: "/api/users", tier: 2, okStatus: [200, 403], authed: true },
  { id: "auth-analytics-revenue", label: "Analytics — revenue", path: "/api/analytics/revenue", tier: 2, okStatus: [200, 403], authed: true },
];

export const MONITOR_SESSION_COOKIE = process.env.MONITOR_SESSION_COOKIE ?? "";

// POST-only public auth endpoints — known but not blind-probed (need a body).
export const KNOWN_UNPROBED = [
  "/api/auth/activate", "/api/auth/forgot-password", "/api/auth/reset-password",
  "/api/auth/change-password", "/api/auth/request-access",
];

export interface CronJob {
  id: string;
  label: string;
  path: string;
  schedule: string | null;
  tier: Tier;
  note?: string;
}

// 3) Cron jobs. Schedules from vercel.json. Verified against CloudWatch logs.
export const CRON_JOBS: CronJob[] = [
  { id: "reconcile-payments", label: "Reconcile payments", path: "/api/cron/reconcile-payments", schedule: "0 3 * * *", tier: 1 },
  { id: "check-expiry", label: "Document expiry check", path: "/api/cron/check-expiry", schedule: "0 8 * * *", tier: 2 },
  { id: "issue-due-soon", label: "Issues due soon", path: "/api/cron/issue-due-soon", schedule: "0 8 * * *", tier: 3 },
  { id: "warmup", label: "Warmup (DB/serverless)", path: "/api/cron/warmup", schedule: "0 9 * * *", tier: 3 },
  { id: "late-clockout", label: "Late clock-out", path: "/api/cron/late-clockout", schedule: "0 19 * * *", tier: 3 },
  { id: "missed-clockin", label: "Missed clock-in", path: "/api/cron/missed-clockin", schedule: "30 10 * * *", tier: 3 },
  { id: "birthday-anniversary", label: "Birthday / anniversary", path: "/api/cron/birthday-anniversary", schedule: "0 8 * * *", tier: 3 },
  { id: "leave-tomorrow", label: "Leave-tomorrow notice", path: "/api/cron/leave-tomorrow", schedule: "0 8 * * *", tier: 3 },
  { id: "marketing-tasks-overdue", label: "Marketing tasks overdue", path: "/api/cron/marketing-tasks-overdue", schedule: "0 7 * * *", tier: 3 },
  { id: "monthly-flex-credit", label: "Monthly flex credit", path: "/api/cron/monthly-flex-credit", schedule: "0 0 23 * *", tier: 2 },
  { id: "data-retention", label: "Data retention purge", path: "/api/cron/data-retention", schedule: "0 3 * * 0", tier: 2 },
  { id: "send-scheduled-emails", label: "Send scheduled emails", path: "/api/cron/send-scheduled-emails", schedule: null, tier: 1,
    note: "No schedule in vercel.json — set its EventBridge rule expression here." },
  { id: "purge-old-email-logs", label: "Purge old email logs", path: "/api/cron/purge-old-email-logs", schedule: null, tier: 3 },
  { id: "vault-expiry", label: "Vault expiry", path: "/api/cron/vault-expiry", schedule: null, tier: 2 },
];

export interface Dependency {
  id: string; label: string; tier: Tier; statusApi: string | null; note?: string;
}

// 4) External dependencies. statuspage.io APIs return { status: { indicator } }.
export const DEPENDENCIES: Dependency[] = [
  { id: "stripe", label: "Stripe", tier: 1, statusApi: "https://www.stripestatus.com/api/v2/status.json" },
  { id: "revolut", label: "Revolut Business", tier: 1, statusApi: null, note: "No public status JSON — verify via a Revolut API health call from your infra." },
  { id: "pusher", label: "Pusher", tier: 1, statusApi: "https://status.pusher.com/api/v2/status.json" },
  { id: "microsoft-graph", label: "Microsoft 365 / Graph", tier: 2, statusApi: null, note: "No public statuspage JSON — check via CRM calendar/email sync." },
  { id: "google-drive", label: "Google Drive", tier: 2, statusApi: null, note: "Check via Google Workspace Status Dashboard." },
  { id: "s3", label: "AWS S3 (uploads)", tier: 2, statusApi: null, note: "Probe with a HeadBucket from your infra." },
  { id: "redis", label: "Redis (cache)", tier: 2, statusApi: null, note: "Probe with PING from your infra." },
  { id: "email-provider", label: "Email provider", tier: 2, statusApi: null, note: "Provider-specific status page." },
];

// ---------------------------------------------------------------------------
// 5) AWS CloudWatch (ECS + EventBridge, eu-west-1). Fill LOG_GROUPS with your
//    actual ECS log group(s). Failure detection is LOG-BASED (no alarms yet).
// ---------------------------------------------------------------------------
export const AWS_REGION = process.env.AWS_REGION ?? "eu-west-1";

// Enabled only when AWS creds are present in the environment (standard chain).
export const CLOUDWATCH_ENABLED =
  Boolean(process.env.AWS_ACCESS_KEY_ID || process.env.AWS_PROFILE || process.env.AWS_CONTAINER_CREDENTIALS_RELATIVE_URI);

// The ECS log group(s) that contain the CRM application + cron output.
// e.g. "/ecs/abbey-blue-crm" — REPLACE with your real names.
export const LOG_GROUPS: string[] = (process.env.CW_LOG_GROUPS ?? "/ecs/abbey-blue-crm")
  .split(",").map((s) => s.trim()).filter(Boolean);

// Log line patterns (CloudWatch Logs filter syntax) used to surface errors.
export const ERROR_FILTER_PATTERN =
  process.env.CW_ERROR_PATTERN ?? '?ERROR ?Error ?Exception ?"UnhandledRejection" ?FATAL';

// Per-cron log markers used to VERIFY a run succeeded / failed. A cron is:
//   - "ok"   if a success line appeared at/after the last expected fire
//   - "down" if an error line appeared in that window (or no success line by grace)
// Adjust the substrings to match what each job actually logs.
export interface CronLogMarkers { success: string; error?: string; }
export const CRON_LOG_MARKERS: Record<string, CronLogMarkers> = {
  "reconcile-payments": { success: "reconcile-payments: done", error: "reconcile-payments: error" },
  "send-scheduled-emails": { success: "send-scheduled-emails: sent", error: "send-scheduled-emails: error" },
  // ...add markers per job as you standardise cron logging. Unlisted jobs fall
  // back to a generic "<path> 200" success marker in the log scanner.
};

// Grace window (minutes) after the expected fire before a missing success = failure.
export const CRON_GRACE_MINUTES = Number(process.env.CW_CRON_GRACE_MINUTES ?? 20);

// Key metrics to graph. Namespace/metric/dimensions per CloudWatch. Fill in the
// dimension VALUES (cluster/service/instance names) for your infra.
export interface MetricSpec {
  id: string; label: string; namespace: string; metricName: string;
  dimensions: { Name: string; Value: string }[]; stat: string; unit?: string; tier: Tier;
  warnAbove?: number; downAbove?: number;
}
export const METRICS: MetricSpec[] = [
  { id: "ecs-cpu", label: "ECS CPU", namespace: "AWS/ECS", metricName: "CPUUtilization",
    dimensions: [{ Name: "ClusterName", Value: "REPLACE_CLUSTER" }, { Name: "ServiceName", Value: "REPLACE_SERVICE" }],
    stat: "Average", unit: "%", tier: 2, warnAbove: 75, downAbove: 90 },
  { id: "ecs-mem", label: "ECS Memory", namespace: "AWS/ECS", metricName: "MemoryUtilization",
    dimensions: [{ Name: "ClusterName", Value: "REPLACE_CLUSTER" }, { Name: "ServiceName", Value: "REPLACE_SERVICE" }],
    stat: "Average", unit: "%", tier: 2, warnAbove: 80, downAbove: 92 },
  { id: "rds-conns", label: "RDS connections", namespace: "AWS/RDS", metricName: "DatabaseConnections",
    dimensions: [{ Name: "DBInstanceIdentifier", Value: "REPLACE_DB_INSTANCE" }],
    stat: "Average", tier: 1, warnAbove: 80, downAbove: 110 },
];

// ---------------------------------------------------------------------------
// 6) Alerting. Incidents are recorded on every ok->down/warn transition and
//    resolved on recovery. Notifications fire to any channel URL you configure.
// ---------------------------------------------------------------------------
export const ALERT_CHANNELS = {
  slackWebhook: process.env.ALERT_SLACK_WEBHOOK_URL ?? "",   // Slack Incoming Webhook URL
  genericWebhook: process.env.ALERT_WEBHOOK_URL ?? "",       // any endpoint accepting JSON POST
};
// Only tiers at or above this severity page out (1 = only critical, 3 = everything).
export const ALERT_MIN_TIER: Tier = (Number(process.env.ALERT_MIN_TIER ?? 2) as Tier);
// De-flapping: require this many consecutive bad polls before opening an incident.
export const ALERT_CONSECUTIVE_FAILURES = Math.max(1, Number(process.env.ALERT_CONSECUTIVE_FAILURES ?? 2));

export const POLL_INTERVAL_MS = 30_000;

// ---------------------------------------------------------------------------
// Monitoring timezone & currency — EXPLICIT, never inferred (P6).
// The CRM's revenue handler bounds months in SERVER-LOCAL time; the monitor
// cannot change that from here, so we surface the assumed business timezone and
// currency explicitly and document the caveat rather than silently trusting €.
// ---------------------------------------------------------------------------
export const MONITOR_TZ = process.env.MONITOR_TZ ?? "Europe/Dublin";
export const MONITOR_CURRENCY = process.env.MONITOR_CURRENCY ?? "EUR";
const CURRENCY_SYMBOL: Record<string, string> = { EUR: "€", GBP: "£", USD: "$" };
export const currencySymbol = () => CURRENCY_SYMBOL[MONITOR_CURRENCY] ?? (MONITOR_CURRENCY + " ");
// Currency handling for KPIs: the CRM stores native amounts; the monitor does
// NOT convert. KPIs are reported in the CRM's native currency (assumed
// MONITOR_CURRENCY). Multi-currency conversion is NOT implemented.
export const CURRENCY_MODE: "native" = "native";
