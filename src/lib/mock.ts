// Mock telemetry layer for the CRM Observability Platform prototype.
// One coherent dataset woven around a flagship incident (#1042): deployment
// v1.42.3 -> DB connection exhaustion -> Customer API degraded -> 5xx spike ->
// incident -> rollback -> recovery. Everything cross-references shared ids so
// the drill-down journey (alert -> incident -> trace -> log -> query -> deploy)
// is fully connected. Deterministic (seeded RNG, fixed base clock) so SSR and
// client render identically.

export type Health = "healthy" | "degraded" | "critical" | "maintenance" | "unknown";
export const HEALTH_COLOR: Record<Health, string> = {
  healthy: "rgb(var(--ok))", degraded: "rgb(var(--warn))", critical: "rgb(var(--down))",
  maintenance: "rgb(var(--accent))", unknown: "rgb(var(--idle))",
};
export const HEALTH_LABEL: Record<Health, string> = {
  healthy: "Healthy", degraded: "Degraded", critical: "Critical", maintenance: "Maintenance", unknown: "Unknown",
};

// fixed "now" so all relative times are deterministic
export const BASE = new Date("2026-09-01T16:32:00Z");
export const nowMs = BASE.getTime();

// seeded PRNG (mulberry32)
function rng(seed: number) {
  return function () {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// a wavering series with an optional spike near the end (for the incident window)
export function series(seed: number, n: number, base: number, jitter: number, spike = 0): number[] {
  const r = rng(seed);
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const wobble = (r() - 0.5) * 2 * jitter;
    const trend = Math.sin(i / 5) * jitter * 0.4;
    const s = spike && i > n - 8 ? spike * ((i - (n - 8)) / 8) : 0;
    out.push(Math.max(0, +(base + wobble + trend + s).toFixed(2)));
  }
  return out;
}

export const ENVIRONMENTS = ["production", "staging", "development"] as const;
export const TIME_RANGES = ["15m", "1h", "6h", "24h", "7d", "30d"] as const;

/* ---------------- services (§4, §54) ---------------- */
export interface Service {
  id: string; name: string; health: Health; owner: string;
  rpm: number; errorRate: number; p95: number; p99: number; cpu: number; mem: number;
  deps: { name: string; health: Health }[]; lastDeploy: string; alerts: number; incident?: string;
  spark: number[];
}
export const SERVICES: Service[] = [
  { id: "customer", name: "Customer Service", health: "critical", owner: "Team Nova", rpm: 15210, errorRate: 4.2, p95: 980, p99: 2140, cpu: 78, mem: 74, deps: [{ name: "PostgreSQL", health: "critical" }, { name: "Redis", health: "healthy" }, { name: "SQS", health: "degraded" }], lastDeploy: "v1.42.3", alerts: 3, incident: "INC-1042", spark: series(11, 40, 300, 60, 900) },
  { id: "lead", name: "Lead Service", health: "healthy", owner: "Team Nova", rpm: 8420, errorRate: 0.11, p95: 210, p99: 480, cpu: 41, mem: 55, deps: [{ name: "PostgreSQL", health: "degraded" }, { name: "EventBridge", health: "healthy" }], lastDeploy: "v1.42.1", alerts: 0, spark: series(12, 40, 190, 30) },
  { id: "opportunity", name: "Opportunity Service", health: "degraded", owner: "Team Atlas", rpm: 3110, errorRate: 1.4, p95: 640, p99: 1280, cpu: 63, mem: 61, deps: [{ name: "Aurora", health: "healthy" }, { name: "Redis", health: "healthy" }], lastDeploy: "v1.41.9", alerts: 1, spark: series(13, 40, 520, 80) },
  { id: "auth", name: "Authentication", health: "healthy", owner: "Team Sentinel", rpm: 22040, errorRate: 0.05, p95: 120, p99: 260, cpu: 38, mem: 44, deps: [{ name: "Cognito", health: "healthy" }, { name: "Redis", health: "healthy" }], lastDeploy: "v1.40.2", alerts: 0, spark: series(14, 40, 110, 20) },
  { id: "notification", name: "Notification Service", health: "critical", owner: "Team Atlas", rpm: 6650, errorRate: 8.9, p95: 1520, p99: 3400, cpu: 55, mem: 82, deps: [{ name: "SQS", health: "degraded" }, { name: "SNS", health: "critical" }, { name: "Email Provider", health: "degraded" }], lastDeploy: "v1.42.0", alerts: 2, incident: "INC-1039", spark: series(15, 40, 700, 120, 800) },
  { id: "reporting", name: "Reporting Service", health: "healthy", owner: "Team Atlas", rpm: 1240, errorRate: 0.2, p95: 880, p99: 1900, cpu: 47, mem: 58, deps: [{ name: "Data Warehouse", health: "healthy" }, { name: "S3", health: "healthy" }], lastDeploy: "v1.41.5", alerts: 0, spark: series(16, 40, 820, 90) },
  { id: "search", name: "Search Service", health: "healthy", owner: "Team Nova", rpm: 9980, errorRate: 0.08, p95: 95, p99: 190, cpu: 52, mem: 49, deps: [{ name: "OpenSearch", health: "healthy" }, { name: "Redis", health: "healthy" }], lastDeploy: "v1.42.1", alerts: 0, spark: series(17, 40, 90, 15) },
];

// Maps a service to the live /api/status probe ids that reflect its health.
// (Probe ids come from the monitor config: HTTP_CHECKS + AUTHED_CHECKS.)
export const LIVE_PROBE_MAP: Record<string, string[]> = {
  auth: ["auth-me", "auth-check-status"],
  notification: ["pusher-status", "auth-notifications"],
  search: ["auth-search"],
  customer: ["auth-tickets-board", "auth-my-cases"],
  reporting: ["auth-analytics-revenue"],
};

/* ---------------- APIs (§5, §7) ---------------- */
export interface Api {
  id: string; service: string; method: string; endpoint: string; version: string; owner: string;
  health: Health; requests: number; successRate: number; errorRate: number; avg: number; p95: number; p99: number;
  timeouts: number; rateLimits: number; s5xx: number; s4xx: number; lastError: string; lastDeploy: string;
  spark: number[];
}
export const APIS: Api[] = [
  { id: "post-customers", service: "customer", method: "POST", endpoint: "/api/v1/customers", version: "v1", owner: "Team Nova", health: "critical", requests: 15421, successRate: 95.8, errorRate: 4.2, avg: 182, p95: 421, p99: 982, timeouts: 17, rateLimits: 4, s5xx: 4.04, s4xx: 0.16, lastError: "500 connection pool exhausted", lastDeploy: "v1.42.3", spark: series(21, 40, 200, 40, 700) },
  { id: "get-customers", service: "customer", method: "GET", endpoint: "/api/v1/customers/{id}", version: "v1", owner: "Team Nova", health: "degraded", requests: 48210, successRate: 98.9, errorRate: 1.1, avg: 96, p95: 240, p99: 620, timeouts: 8, rateLimits: 0, s5xx: 0.9, s4xx: 0.2, lastError: "504 upstream timeout", lastDeploy: "v1.42.3", spark: series(22, 40, 120, 30, 300) },
  { id: "post-leads", service: "lead", method: "POST", endpoint: "/api/v1/leads", version: "v1", owner: "Team Nova", health: "healthy", requests: 8420, successRate: 99.89, errorRate: 0.11, avg: 110, p95: 210, p99: 480, timeouts: 1, rateLimits: 0, s5xx: 0.02, s4xx: 0.09, lastError: "422 validation", lastDeploy: "v1.42.1", spark: series(23, 40, 120, 25) },
  { id: "get-opps", service: "opportunity", method: "GET", endpoint: "/api/v1/opportunities", version: "v1", owner: "Team Atlas", health: "degraded", requests: 3110, successRate: 98.6, errorRate: 1.4, avg: 300, p95: 640, p99: 1280, timeouts: 5, rateLimits: 0, s5xx: 0.6, s4xx: 0.8, lastError: "500 slow query", lastDeploy: "v1.41.9", spark: series(24, 40, 340, 60, 200) },
  { id: "post-login", service: "auth", method: "POST", endpoint: "/api/v1/auth/login", version: "v1", owner: "Team Sentinel", health: "healthy", requests: 22040, successRate: 99.95, errorRate: 0.05, avg: 64, p95: 120, p99: 260, timeouts: 0, rateLimits: 12, s5xx: 0.01, s4xx: 0.04, lastError: "401 invalid credentials", lastDeploy: "v1.40.2", spark: series(25, 40, 70, 15) },
  { id: "post-notify", service: "notification", method: "POST", endpoint: "/api/v1/notifications", version: "v1", owner: "Team Atlas", health: "critical", requests: 6650, successRate: 91.1, errorRate: 8.9, avg: 720, p95: 1520, p99: 3400, timeouts: 63, rateLimits: 2, s5xx: 7.2, s4xx: 1.7, lastError: "503 SNS unavailable", lastDeploy: "v1.42.0", spark: series(26, 40, 780, 120, 900) },
  { id: "get-search", service: "search", method: "GET", endpoint: "/api/v1/search", version: "v1", owner: "Team Nova", health: "healthy", requests: 9980, successRate: 99.92, errorRate: 0.08, avg: 48, p95: 95, p99: 190, timeouts: 0, rateLimits: 3, s5xx: 0.01, s4xx: 0.07, lastError: "400 bad query", lastDeploy: "v1.42.1", spark: series(27, 40, 55, 12) },
  { id: "get-reports", service: "reporting", method: "GET", endpoint: "/api/v1/reports/{id}", version: "v1", owner: "Team Atlas", health: "healthy", requests: 1240, successRate: 99.8, errorRate: 0.2, avg: 640, p95: 880, p99: 1900, timeouts: 2, rateLimits: 0, s5xx: 0.1, s4xx: 0.1, lastError: "404 report not found", lastDeploy: "v1.41.5", spark: series(28, 40, 700, 90) },
];

export const API_ERROR_CLASSES = [
  { code: 400, label: "Bad Request", count: 842, rate: 0.14, service: "search", endpoint: "/api/v1/search", firstSeen: "14:02", lastSeen: "16:31" },
  { code: 401, label: "Unauthorized", count: 1203, rate: 0.2, service: "auth", endpoint: "/api/v1/auth/login", firstSeen: "00:00", lastSeen: "16:32" },
  { code: 403, label: "Forbidden", count: 88, rate: 0.01, service: "customer", endpoint: "/api/v1/customers", firstSeen: "09:11", lastSeen: "16:20" },
  { code: 404, label: "Not Found", count: 411, rate: 0.07, service: "reporting", endpoint: "/api/v1/reports/{id}", firstSeen: "08:00", lastSeen: "16:29" },
  { code: 409, label: "Conflict", count: 37, rate: 0.01, service: "customer", endpoint: "/api/v1/customers", firstSeen: "11:20", lastSeen: "15:58" },
  { code: 429, label: "Too Many Requests", count: 156, rate: 0.03, service: "auth", endpoint: "/api/v1/auth/login", firstSeen: "12:00", lastSeen: "16:30" },
  { code: 500, label: "Internal Server Error", count: 2841, rate: 3.1, service: "customer", endpoint: "/api/v1/customers", firstSeen: "16:12", lastSeen: "16:32", incident: "INC-1042", deployment: "v1.42.3" },
  { code: 502, label: "Bad Gateway", count: 214, rate: 0.3, service: "notification", endpoint: "/api/v1/notifications", firstSeen: "15:40", lastSeen: "16:31" },
  { code: 503, label: "Service Unavailable", count: 588, rate: 0.7, service: "notification", endpoint: "/api/v1/notifications", firstSeen: "15:38", lastSeen: "16:32", incident: "INC-1039" },
  { code: 504, label: "Gateway Timeout", count: 449, rate: 0.5, service: "customer", endpoint: "/api/v1/customers/{id}", firstSeen: "16:13", lastSeen: "16:31", incident: "INC-1042" },
];

/* ---------------- trace (§11) ---------------- */
export interface Span { id: string; label: string; kind: string; start: number; dur: number; health: Health; detail?: string; }
export interface Trace { id: string; endpoint: string; status: number; total: number; ts: string; service: string; spans: Span[]; }
export const FLAGSHIP_TRACE: Trace = {
  id: "trc_9f2a71c4e8", endpoint: "POST /api/v1/customers", status: 500, total: 2098, ts: "16:22:07",
  service: "customer",
  spans: [
    { id: "sp_01", label: "CloudFront", kind: "cdn", start: 0, dur: 9, health: "healthy" },
    { id: "sp_02", label: "API Gateway", kind: "gateway", start: 9, dur: 15, health: "healthy" },
    { id: "sp_03", label: "CRM API (Customer Service)", kind: "service", start: 24, dur: 2050, health: "critical", detail: "handler POST /customers" },
    { id: "sp_04", label: "Redis GET session", kind: "cache", start: 30, dur: 12, health: "healthy" },
    { id: "sp_05", label: "PostgreSQL acquire connection", kind: "db", start: 60, dur: 1780, health: "critical", detail: "waited 1.78s for a pool slot — pool exhausted (98/100)" },
    { id: "sp_06", label: "PostgreSQL INSERT customers", kind: "db", start: 1840, dur: 210, health: "degraded", detail: "INSERT INTO customers (...) VALUES (...)" },
    { id: "sp_07", label: "SQS send CustomerCreated", kind: "queue", start: 2052, dur: 34, health: "degraded" },
  ],
};
export const TRACES: { id: string; endpoint: string; status: number; total: number; ts: string; service: string; health: Health }[] = [
  { id: FLAGSHIP_TRACE.id, endpoint: FLAGSHIP_TRACE.endpoint, status: 500, total: 2098, ts: "16:22:07", service: "customer", health: "critical" },
  { id: "trc_5b1d90aa32", endpoint: "GET /api/v1/customers/{id}", status: 504, total: 3010, ts: "16:20:44", service: "customer", health: "critical" },
  { id: "trc_2c8e44f1a9", endpoint: "POST /api/v1/notifications", status: 503, total: 1890, ts: "16:19:12", service: "notification", health: "critical" },
  { id: "trc_77aa10bd54", endpoint: "GET /api/v1/opportunities", status: 200, total: 640, ts: "16:18:03", service: "opportunity", health: "degraded" },
  { id: "trc_a01ffe2210", endpoint: "POST /api/v1/leads", status: 200, total: 188, ts: "16:17:55", service: "lead", health: "healthy" },
  { id: "trc_e4b7c93d18", endpoint: "GET /api/v1/search", status: 200, total: 71, ts: "16:17:40", service: "search", health: "healthy" },
];

/* ---------------- database (§12-24, §56) ---------------- */
export const DB = {
  name: "crm-prod-db", engine: "PostgreSQL", version: "15.4", region: "eu-west-1", health: "critical" as Health,
  instance: "db.r6g.2xlarge", role: "primary", lastBackup: "16:00 (OK)", lastFailover: "—", connectionsNow: 982,
  cpu: 91, mem: 78, storageUsedGb: 716, storageTotalGb: 1024, connections: 982, connectionsMax: 1000,
  readIops: 4200, writeIops: 3100, readThroughput: 182, writeThroughput: 141, readLatency: 3.2, writeLatency: 11.4,
  replicationLag: 4.8, activeQueries: 214, slowQueries: 38, deadlocksToday: 7, deadlocksWeek: 21,
  cpuSeries: series(31, 48, 55, 12, 40), memSeries: series(32, 48, 62, 8, 18),
  storageSeries: series(33, 48, 690, 6, 24).map((v, i) => +(680 + i * 0.75).toFixed(1)),
  connSeries: series(34, 48, 420, 60, 560), iopsReadSeries: series(35, 48, 3800, 400), iopsWriteSeries: series(36, 48, 2900, 350),
  latReadSeries: series(37, 48, 3, 1), latWriteSeries: series(38, 48, 8, 3, 8),
  slowQueryList: [
    { id: "q1", sql: "SELECT * FROM customers WHERE tenant_id = $1 AND status = $2 ORDER BY updated_at DESC", count: 8421, avg: 1820, p95: 2400, p99: 3100, max: 4120, rowsReturned: 512, rowsScanned: 1284000, errors: 3, firstSeen: "16:12", lastSeen: "16:32", service: "customer" },
    { id: "q2", sql: "SELECT count(*) FROM opportunities o JOIN accounts a ON a.id = o.account_id WHERE o.stage = $1", count: 1204, avg: 940, p95: 1400, p99: 1900, max: 2600, rowsReturned: 1, rowsScanned: 402000, errors: 0, firstSeen: "15:50", lastSeen: "16:31", service: "opportunity" },
    { id: "q3", sql: "UPDATE customers SET last_seen = now() WHERE id = $1", count: 44210, avg: 220, p95: 480, p99: 900, max: 1800, rowsReturned: 0, rowsScanned: 1, errors: 12, firstSeen: "00:00", lastSeen: "16:32", service: "customer" },
  ],
  locks: [
    { type: "RowExclusiveLock", duration: 42, blocking: "txn 88431", blocked: "txn 88452", session: "customer-svc-7" },
    { type: "ShareLock", duration: 18, blocking: "txn 88420", blocked: "txn 88461", session: "customer-svc-3" },
  ],
  replicas: [
    { name: "Primary", health: "critical" as Health, lag: 0 },
    { name: "Replica 1", health: "healthy" as Health, lag: 0.4 },
    { name: "Replica 2", health: "degraded" as Health, lag: 4.8 },
  ],
  backups: [
    { at: "16:00", status: "OK", duration: "6m 12s", size: "412 GB" },
    { at: "10:00", status: "OK", duration: "6m 02s", size: "410 GB" },
    { at: "04:00", status: "OK", duration: "5m 58s", size: "409 GB" },
  ],
  events: [
    { at: "16:12", text: "Connection count crossed 900 (90% of max)", health: "critical" as Health },
    { at: "16:13", text: "Slow query rate increased 6× on customers table", health: "degraded" as Health },
    { at: "16:24", text: "Deployment v1.42.3 rolled back", health: "healthy" as Health },
    { at: "16:29", text: "Connections normalised to 410", health: "healthy" as Health },
  ],
};
export const DATABASES = [
  { id: "crm-prod-db", name: "crm-prod-db", engine: "PostgreSQL 15.4", region: "eu-west-1", health: "critical" as Health, cpu: 91, storagePct: 69.9, connectionsPct: 98.2 },
  { id: "crm-aurora-analytics", name: "crm-aurora-analytics", engine: "Aurora MySQL", region: "eu-west-1", health: "healthy" as Health, cpu: 44, storagePct: 51, connectionsPct: 33 },
  { id: "crm-prod-replica-2", name: "crm-prod-replica-2", engine: "PostgreSQL 15.4", region: "eu-west-1", health: "degraded" as Health, cpu: 61, storagePct: 69.9, connectionsPct: 40 },
];

/* ---------------- deployments (§43-44) ---------------- */
export interface Deployment {
  id: string; version: string; commit: string; env: string; start: string; end: string; status: Health;
  deployer: string; services: string[]; rollback: boolean; errDelta: number; latDelta: number; cpuDelta: number; incident?: string;
}
export const DEPLOYMENTS: Deployment[] = [
  { id: "dpl_442", version: "v1.42.3", commit: "9c3f1ab", env: "production", start: "16:10", end: "16:12", status: "critical", deployer: "j.rivera", services: ["Customer Service"], rollback: true, errDelta: 4.0, latDelta: 133, cpuDelta: 33, incident: "INC-1042" },
  { id: "dpl_441", version: "v1.42.1", commit: "5a1b8de", env: "production", start: "11:04", end: "11:07", status: "healthy", deployer: "s.okafor", services: ["Lead Service", "Search Service"], rollback: false, errDelta: -0.02, latDelta: -4, cpuDelta: 1 },
  { id: "dpl_440", version: "v1.42.0", commit: "77de210", env: "production", start: "09:20", end: "09:24", status: "degraded", deployer: "a.novak", services: ["Notification Service"], rollback: false, errDelta: 0.9, latDelta: 42, cpuDelta: 6, incident: "INC-1039" },
  { id: "dpl_439", version: "v1.41.9", commit: "1c9f0aa", env: "production", start: "Yesterday 18:02", end: "18:05", status: "healthy", deployer: "j.rivera", services: ["Opportunity Service"], rollback: false, errDelta: 0.1, latDelta: 8, cpuDelta: 2 },
];

/* ---------------- alerts + incidents (§32, §39) ---------------- */
export interface Alert { id: string; severity: "P0" | "P1" | "P2" | "P3"; title: string; service: string; value: string; threshold: string; start: string; status: "firing" | "acknowledged" | "resolved"; incident?: string; runbook?: string; }
export const ALERTS: Alert[] = [
  { id: "ALT-8801", severity: "P1", title: "Customer API 5xx > 5% for 5m", service: "customer", value: "4.2%", threshold: "5% / 5m", start: "16:13", status: "acknowledged", incident: "INC-1042", runbook: "db-connection-exhaustion" },
  { id: "ALT-8802", severity: "P1", title: "DB connection utilization > 85%", service: "customer", value: "98.2%", threshold: "85%", start: "16:12", status: "acknowledged", incident: "INC-1042", runbook: "db-connection-exhaustion" },
  { id: "ALT-8803", severity: "P2", title: "DB CPU > 90% for 10m", service: "customer", value: "91%", threshold: "90% / 10m", start: "16:15", status: "firing", incident: "INC-1042", runbook: "db-cpu-high" },
  { id: "ALT-8804", severity: "P1", title: "Notification 5xx > 5%", service: "notification", value: "8.9%", threshold: "5%", start: "15:40", status: "acknowledged", incident: "INC-1039", runbook: "sns-unavailable" },
  { id: "ALT-8805", severity: "P2", title: "SQS oldest message > 10m", service: "notification", value: "12m", threshold: "10m", start: "15:52", status: "firing", incident: "INC-1039" },
  { id: "ALT-8806", severity: "P3", title: "Replica 2 lag > 3s", service: "reporting", value: "4.8s", threshold: "3s", start: "16:14", status: "firing" },
];

export interface TimelineEvent { at: string; text: string; kind: "deploy" | "alert" | "incident" | "action" | "recovery" | "note"; }
export interface Incident {
  id: string; title: string; severity: "P0" | "P1" | "P2" | "P3"; status: string; start: string; duration: string;
  impact: string; services: string[]; affectedUsers: number; suspectedCause: string; confirmedCause?: string;
  owner: string; responders: string[]; alerts: string[]; deployment?: string; trace?: string; runbook?: string;
  timeline: TimelineEvent[]; rootChain: { label: string; detail: string }[]; confidence: number;
}
export const INCIDENTS: Incident[] = [
  {
    id: "INC-1042", title: "Customer API degraded — DB connection exhaustion", severity: "P1", status: "Monitoring",
    start: "16:14", duration: "18m", impact: "Elevated 5xx and latency on customer create/read", services: ["Customer Service"],
    affectedUsers: 3120, suspectedCause: "Deployment v1.42.3 increased DB connection usage",
    confirmedCause: "v1.42.3 removed connection pooling on the customers write path, exhausting the DB pool",
    owner: "j.rivera", responders: ["j.rivera", "s.okafor", "on-call: m.lee"], alerts: ["ALT-8801", "ALT-8802", "ALT-8803"],
    deployment: "dpl_442", trace: "trc_9f2a71c4e8", runbook: "db-connection-exhaustion", confidence: 92,
    timeline: [
      { at: "16:10", text: "Deployment v1.42.3 started (Customer Service)", kind: "deploy" },
      { at: "16:12", text: "API latency on POST /customers increased", kind: "alert" },
      { at: "16:13", text: "5xx threshold exceeded (ALT-8801)", kind: "alert" },
      { at: "16:14", text: "P1 incident INC-1042 created", kind: "incident" },
      { at: "16:16", text: "On-call engineer acknowledged", kind: "action" },
      { at: "16:19", text: "DB connections reached 98% (982/1000)", kind: "alert" },
      { at: "16:24", text: "Deployment v1.42.3 rolled back", kind: "action" },
      { at: "16:27", text: "Error rate normalising", kind: "recovery" },
      { at: "16:30", text: "Metrics back within SLO; monitoring", kind: "recovery" },
    ],
    rootChain: [
      { label: "Customer API degraded", detail: "5xx 4.2%, P95 980ms" },
      { label: "DB connection exhaustion", detail: "pool 98/100" },
      { label: "Slow queries increased", detail: "customers table, 6× rate" },
      { label: "Deployment v1.42.3", detail: "removed pooling on write path" },
    ],
  },
  {
    id: "INC-1039", title: "Notification delivery failures — SNS unavailable", severity: "P1", status: "Investigating",
    start: "15:40", duration: "52m", impact: "Notifications & SMS delayed/failed", services: ["Notification Service"],
    affectedUsers: 8400, suspectedCause: "SNS regional degradation", owner: "a.novak", responders: ["a.novak", "on-call: m.lee"],
    alerts: ["ALT-8804", "ALT-8805"], runbook: "sns-unavailable", confidence: 64,
    timeline: [
      { at: "15:38", text: "SNS publish errors rising", kind: "alert" },
      { at: "15:40", text: "P1 incident INC-1039 created", kind: "incident" },
      { at: "15:52", text: "SQS backlog > 10m old", kind: "alert" },
      { at: "16:05", text: "Investigating SNS regional status", kind: "note" },
    ],
    rootChain: [
      { label: "Notification failures", detail: "5xx 8.9%" },
      { label: "SNS publish errors", detail: "503 from SNS" },
      { label: "SQS backlog", detail: "DLQ 37" },
    ],
  },
];

/* ---------------- queues / jobs / integrations / webhooks (§26-31) ---------------- */
export const QUEUES = [
  { id: "customer-notify", name: "CustomerNotificationQueue", health: "degraded" as Health, depth: 1248, inflight: 84, oldest: "4m 21s", rate: 220, failRate: 1.2, dlq: 37, consumers: 6 },
  { id: "lead-processing", name: "LeadProcessingQueue", health: "healthy" as Health, depth: 42, inflight: 12, oldest: "9s", rate: 640, failRate: 0.1, dlq: 0, consumers: 8 },
  { id: "search-index", name: "SearchIndexQueue", health: "healthy" as Health, depth: 210, inflight: 30, oldest: "22s", rate: 900, failRate: 0.05, dlq: 1, consumers: 10 },
  { id: "webhook-dispatch", name: "WebhookDispatchQueue", health: "degraded" as Health, depth: 902, inflight: 48, oldest: "3m 02s", rate: 300, failRate: 2.1, dlq: 12, consumers: 5 },
];
export const JOBS = [
  { id: "customer-sync", name: "Customer sync", health: "critical" as Health, last: "16:20", duration: "failed", success: false, retries: 3, queue: "customer-notify", worker: "worker-2", error: "DB connection timeout" },
  { id: "lead-processing", name: "Lead processing", health: "healthy" as Health, last: "16:31", duration: "42s", success: true, retries: 0, queue: "lead-processing", worker: "worker-1", error: "—" },
  { id: "email-send", name: "Email sending", health: "degraded" as Health, last: "16:30", duration: "1m 20s", success: true, retries: 2, queue: "customer-notify", worker: "worker-3", error: "SMTP 421 (retried)" },
  { id: "report-gen", name: "Report generation", health: "healthy" as Health, last: "16:00", duration: "3m 11s", success: true, retries: 0, queue: "—", worker: "worker-4", error: "—" },
  { id: "search-index", name: "Search indexing", health: "healthy" as Health, last: "16:31", duration: "18s", success: true, retries: 0, queue: "search-index", worker: "worker-5", error: "—" },
  { id: "data-cleanup", name: "Data cleanup", health: "healthy" as Health, last: "04:00", duration: "12m", success: true, retries: 0, queue: "—", worker: "worker-6", error: "—" },
];
export const INTEGRATIONS = [
  { id: "salesforce", name: "Salesforce", health: "healthy" as Health, successRate: 99.8, latency: 240, lastSync: "16:30", lag: "2m" },
  { id: "hubspot", name: "HubSpot", health: "healthy" as Health, successRate: 99.6, latency: 310, lastSync: "16:28", lag: "4m" },
  { id: "stripe", name: "Stripe", health: "healthy" as Health, successRate: 99.95, latency: 180, lastSync: "16:31", lag: "1m" },
  { id: "email", name: "Email Provider", health: "degraded" as Health, successRate: 96.2, latency: 640, lastSync: "16:22", lag: "10m" },
  { id: "erp", name: "ERP", health: "critical" as Health, successRate: 71.4, latency: 2100, lastSync: "14:05", lag: "2h 27m" },
  { id: "warehouse", name: "Data Warehouse", health: "healthy" as Health, successRate: 99.9, latency: 520, lastSync: "16:00", lag: "32m" },
];
export const WEBHOOKS = [
  { id: "customer-updated", name: "customer.updated", received: 12423, processed: 12401, failed: 22, retried: 31, dup: 4, sigFail: 0, dlq: 2, latency: 88 },
  { id: "payment-succeeded", name: "payment.succeeded", received: 5210, processed: 5210, failed: 0, retried: 3, dup: 1, sigFail: 0, dlq: 0, latency: 64 },
  { id: "lead-created", name: "lead.created", received: 8804, processed: 8790, failed: 14, retried: 20, dup: 0, sigFail: 2, dlq: 1, latency: 102 },
];

/* ---------------- infra (§25) ---------------- */
export const INFRA = {
  ecs: [
    { id: "customer-svc", name: "customer-service", desired: 8, running: 8, failed: 0, cpu: 78, mem: 74, restarts: 2, health: "critical" as Health },
    { id: "lead-svc", name: "lead-service", desired: 4, running: 4, failed: 0, cpu: 41, mem: 55, restarts: 0, health: "healthy" as Health },
    { id: "notify-svc", name: "notification-service", desired: 6, running: 5, failed: 1, cpu: 55, mem: 82, restarts: 4, health: "critical" as Health },
  ],
  lambda: [
    { id: "webhook-proc", name: "webhook-processor", invocations: 44210, errors: 88, p95: 210, throttles: 0, cold: 12, health: "healthy" as Health },
    { id: "report-render", name: "report-renderer", invocations: 1204, errors: 2, p95: 1800, throttles: 1, cold: 3, health: "healthy" as Health },
    { id: "notify-fanout", name: "notification-fanout", invocations: 6650, errors: 420, p95: 1520, throttles: 8, cold: 5, health: "critical" as Health },
  ],
  ec2: [
    { id: "bastion", name: "bastion-1", cpu: 4, mem: 22, disk: 31, status: "ok", health: "healthy" as Health },
    { id: "worker-1", name: "worker-1", cpu: 61, mem: 58, disk: 44, status: "ok", health: "degraded" as Health },
  ],
};

/* ---------------- security / audit (§45-46) ---------------- */
export const SECURITY_EVENTS = [
  { id: "sec-1", at: "16:28", severity: "high", type: "Excessive failed logins", detail: "user j.doe — 22 failures in 3m from 3 IPs", user: "j.doe" },
  { id: "sec-2", at: "16:05", severity: "medium", type: "Rate-limit violation", detail: "IP 203.0.113.9 hit /auth/login limit 12×", user: "—" },
  { id: "sec-3", at: "15:41", severity: "high", type: "Privilege change", detail: "admin@example.com granted SecurityAdmin to r.patel", user: "admin@example.com" },
  { id: "sec-4", at: "14:12", severity: "low", type: "Sensitive-data access", detail: "export of 4,200 customer records by s.okafor", user: "s.okafor" },
];
export const AUDIT_LOGS = [
  { id: "aud-1", at: "16:22", user: "admin@example.com", action: "CUSTOMER_UPDATED", target: "customer/12345", fields: "phone", source: "CRM UI", requestId: "req_7c1a" },
  { id: "aud-2", at: "16:18", user: "s.okafor", action: "ALERT_RULE_CHANGED", target: "rule/db-cpu-high", fields: "threshold 85→90", source: "Monitor UI", requestId: "req_9b22" },
  { id: "aud-3", at: "16:14", user: "system", action: "INCIDENT_CREATED", target: "INC-1042", fields: "severity=P1", source: "Alert Engine", requestId: "req_1042" },
  { id: "aud-4", at: "16:24", user: "j.rivera", action: "DEPLOYMENT_ROLLBACK", target: "v1.42.3", fields: "rollback=true", source: "CI/CD", requestId: "req_dpl442" },
];

/* ---------------- SLO / capacity / cost / monitoring health ---------------- */
export const SLOS = [
  { id: "api-avail", name: "API availability", target: 99.95, current: 99.91, unit: "%", budgetTotalMin: 21.9, budgetUsedMin: 8.4, series: series(51, 40, 99.95, 0.05, -0.2), status: "degraded" as Health },
  { id: "api-latency", name: "API P95 latency", target: 500, current: 421, unit: "ms", budgetTotalMin: 21.9, budgetUsedMin: 5.1, series: series(52, 40, 380, 40, 120), status: "healthy" as Health },
  { id: "api-errors", name: "API error rate", target: 0.1, current: 0.18, unit: "%", budgetTotalMin: 21.9, budgetUsedMin: 14.9, series: series(53, 40, 0.08, 0.03, 0.2), status: "critical" as Health },
];
export const CAPACITY = [
  { id: "db-storage", name: "DB storage", used: 69.9, forecast: "90% in 17 days", health: "degraded" as Health },
  { id: "db-conns", name: "DB connections", used: 98.2, forecast: "at limit now", health: "critical" as Health },
  { id: "ecs-cpu", name: "ECS CPU (customer)", used: 78, forecast: "scale event likely in 6 days", health: "degraded" as Health },
  { id: "lambda-conc", name: "Lambda concurrency", used: 42, forecast: "healthy", health: "healthy" as Health },
  { id: "sqs-cap", name: "Queue capacity", used: 33, forecast: "healthy", health: "healthy" as Health },
];
export const COST = {
  daily: 4210, monthly: 118400, mtdDelta: 6.2,
  byService: [
    { name: "RDS / Aurora", value: 38200 }, { name: "ECS", value: 24100 }, { name: "Lambda", value: 9800 },
    { name: "CloudWatch", value: 7400 }, { name: "S3", value: 5200 }, { name: "API Gateway", value: 6100 },
    { name: "Data transfer", value: 8900 }, { name: "Other", value: 18700 },
  ],
  anomalies: [{ at: "16:00", text: "CloudWatch Logs ingestion +38% (incident traffic)", health: "degraded" as Health }],
  perCustomer: 0.094, perRequest: 0.0007,
};
export const MONITORING_HEALTH = [
  { id: "metrics", name: "Metrics ingestion", health: "healthy" as Health },
  { id: "logs", name: "Logs ingestion", health: "healthy" as Health },
  { id: "traces", name: "Trace ingestion", health: "degraded" as Health },
  { id: "alert-engine", name: "Alert engine", health: "healthy" as Health },
  { id: "slack", name: "Slack notifications", health: "critical" as Health },
  { id: "email", name: "Email notifications", health: "healthy" as Health },
  { id: "collectors", name: "Collector / agent health", health: "healthy" as Health },
  { id: "pipeline", name: "Data pipeline", health: "healthy" as Health },
];

/* ---------------- business (§28-29) ---------------- */
export const BUSINESS = {
  customers: { created: 4210, updated: 18900, failed: 17, duplicates: 17 },
  leads: { created: 3120, assigned: 2980, converted: 640, failed: 22 },
  opportunities: { created: 812, stageChanges: 2140, closed: 190, failed: 4 },
  comms: { emailsSent: 42100, emailsFailed: 512, notifSent: 38200, notifFailed: 3400, sms: 1200, webhooks: 26437 },
  integrity: { checked: 1248392, dupCustomers: 17, orphanContacts: 3, invalidOpps: 0, syncMismatches: 24 },
  kpiSeries: series(61, 40, 300, 40),
};

/* ---------------- global logs (§10) ---------------- */
export const LOGS = [
  { ts: "16:22:07.412", level: "ERROR", service: "customer", env: "production", requestId: "req_7c1a", traceId: "trc_9f2a71c4e8", endpoint: "POST /api/v1/customers", status: 500, duration: 2098, msg: "connection pool exhausted: timed out acquiring a connection (98/100 in use)" },
  { ts: "16:22:05.980", level: "WARN", service: "customer", env: "production", requestId: "req_7c19", traceId: "trc_5b1d90aa32", endpoint: "GET /api/v1/customers/{id}", status: 504, duration: 3010, msg: "upstream timeout waiting for database" },
  { ts: "16:21:58.220", level: "ERROR", service: "notification", env: "production", requestId: "req_5f02", traceId: "trc_2c8e44f1a9", endpoint: "POST /api/v1/notifications", status: 503, duration: 1890, msg: "SNS publish failed: ServiceUnavailable" },
  { ts: "16:21:40.114", level: "INFO", service: "search", env: "production", requestId: "req_aa10", traceId: "trc_e4b7c93d18", endpoint: "GET /api/v1/search", status: 200, duration: 71, msg: "query ok" },
  { ts: "16:20:44.900", level: "ERROR", service: "customer", env: "production", requestId: "req_7b02", traceId: "trc_5b1d90aa32", endpoint: "GET /api/v1/customers/{id}", status: 504, duration: 3010, msg: "gateway timeout" },
  { ts: "16:12:03.001", level: "WARN", service: "customer", env: "production", requestId: "req_6d55", traceId: "trc_3a11", endpoint: "internal", status: 0, duration: 0, msg: "db connection count crossed 900 (90% of max)" },
  { ts: "16:10:12.400", level: "INFO", service: "customer", env: "production", requestId: "req_dpl442", traceId: "-", endpoint: "deploy", status: 0, duration: 0, msg: "deployment v1.42.3 started" },
];

/* ---------------- runbooks (§42) ---------------- */
export const RUNBOOKS = [
  { id: "db-connection-exhaustion", title: "Database connection exhaustion", steps: ["Check active connections & pool utilization", "Check connection pool config in the deployed service", "Check slow queries on the affected table", "Check for locks / long transactions", "Check the most recent deployment for pooling changes", "Check DB CPU / memory", "Scale connections or roll back the deployment", "Verify recovery: connections and 5xx normalise", "Escalate to DBA on-call if not recovered in 15m"] },
  { id: "db-cpu-high", title: "Database CPU high", steps: ["Identify top queries by total time", "Check for missing indexes / seq scans", "Check for a traffic spike or runaway job", "Consider read-replica offload", "Scale instance if sustained"] },
  { id: "sns-unavailable", title: "SNS / notification delivery failures", steps: ["Confirm SNS regional status", "Check DLQ depth and retry policy", "Fail over to secondary channel if configured", "Replay DLQ once recovered"] },
];

/* ---------------- helpers ---------------- */
// (globalHealth() removed — global status now derives from real /api/status,
//  never from this illustrative service catalog.)
export const rel = (hhmm: string) => hhmm; // times are already display strings

// global search index (§1)
export interface SearchHit { id: string; label: string; type: string; href: string; }
export function searchIndex(): SearchHit[] {
  const hits: SearchHit[] = [];
  for (const s of SERVICES) hits.push({ id: s.id, label: s.name, type: "Service", href: `/crm/service-health/${s.id}` });
  for (const a of APIS) hits.push({ id: a.id, label: `${a.method} ${a.endpoint}`, type: "API", href: `/crm/apis/${a.id}` });
  for (const t of TRACES) hits.push({ id: t.id, label: `${t.id} · ${t.endpoint}`, type: "Trace", href: `/crm/traces/${t.id}` });
  for (const i of INCIDENTS) hits.push({ id: i.id, label: `${i.id} · ${i.title}`, type: "Incident", href: `/crm/incidents/${i.id}` });
  for (const a of ALERTS) hits.push({ id: a.id, label: `${a.id} · ${a.title}`, type: "Alert", href: `/crm/alerts` });
  for (const d of DEPLOYMENTS) hits.push({ id: d.id, label: `${d.version} · ${d.commit}`, type: "Deployment", href: `/crm/deployments/${d.id}` });
  for (const d of DATABASES) hits.push({ id: d.id, label: d.name, type: "Database", href: `/crm/databases/${d.id}` });
  for (const l of LOGS) hits.push({ id: l.requestId, label: `${l.requestId} · ${l.endpoint}`, type: "Request", href: `/crm/logs?q=${l.requestId}` });
  return hits;
}
