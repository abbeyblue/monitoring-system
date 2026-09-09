# CRM Monitor

A **standalone** status dashboard for the Abbey Blue CRM. It runs as its own
Next.js app (separate repo/host — **not inside the CRM**) and checks the CRM
from the outside. All checks run **server-side**, avoiding browser CORS and
letting the app hold credentials for authenticated and AWS checks.

## What it monitors

| Group | How it's checked | Needs |
|-------|------------------|-------|
| **Live endpoints** | Direct server-side probe of the CRM's public routes (health keyword-checked, pusher/status, vapid-key, auth probes). Up/down + latency + sparkline. | nothing |
| **Authenticated routes** | GET, read-only session-guarded routes probed with a synthetic staff session cookie. | `MONITOR_SESSION_COOKIE` |
| **AWS CloudWatch** | Alarm states, key metrics (ECS CPU/mem, RDS connections) as sparklines, recent ERROR log lines, and **log-based failed-cron detection**. | AWS creds + `CW_LOG_GROUPS` |
| **Scheduled jobs** | Cron schedules from `vercel.json` with computed last/next run; verified by heartbeat and/or CloudWatch logs. | nothing (heartbeat optional) |
| **External dependencies** | Stripe / Pusher via public statuspages; Revolut, Microsoft, Drive, S3, Redis, email as tiles. | nothing |
| **Alerting + incidents** | Every signal feeds an incident engine: opens on ok→down/warn, resolves on recovery, notifies Slack/webhook, and keeps an incident history. | channel URLs (optional) |

Tiers: **T1** critical, **T2** core, **T3** rest. Auto-polls every 30s.

## Run it

```bash
cd ~/Desktop/crm-monitor
cp .env.example .env.local          # set CRM_BASE_URL (rest optional)
npm install                         # use npm, not pnpm (Node 20 here)
npm run dev                         # http://localhost:4000
```

Production: `npm run build && npm start`. Deploy anywhere that runs Node.

### Docker-based local run

```bash
cp .env.example .env                # compose reads .env, not .env.local
docker compose up --build           # http://localhost:4000 (dev, hot reload)
docker compose --profile production up --build web-prod
```

`WEB_PORT` moves the host port for this checkout; the container always uses 4000.

## Enabling each layer

**Authenticated routes** — create a read-only monitor staff account, log in,
copy its session cookie (`name=value`) from devtools into
`MONITOR_SESSION_COOKIE`. Only non-mutating GETs are listed in `AUTHED_CHECKS`
(`src/lib/config.ts`); never add write routes there.

**CloudWatch** — set `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (or
`AWS_PROFILE`) for a read-only IAM user with `cloudwatch:DescribeAlarms`,
`cloudwatch:GetMetricData`, and `logs:FilterLogEvents`. Put your real ECS log
group(s) in `CW_LOG_GROUPS`, and fill the `REPLACE_*` dimension values in
`METRICS`. Failed-cron detection scans each cron's log window for a success /
error marker — set those per job in `CRON_LOG_MARKERS` (unlisted jobs fall back
to a generic `"<path> 200"` success marker).

**Cron heartbeats (optional, most reliable)** — have each CRM cron curl the
monitor on success: `curl -fsS https://YOUR_MONITOR_HOST/api/heartbeat/<job-id>`.

**Alerting** — set `ALERT_SLACK_WEBHOOK_URL` and/or `ALERT_WEBHOOK_URL`.
`ALERT_MIN_TIER` gates which severities page out. Incidents are recorded even
with no channel configured (visible in the Incident history section).

## Config

Everything lives in **`src/lib/config.ts`** — endpoints, authed checks, cron
jobs, dependencies, CloudWatch (log groups, metrics, cron markers), and alert
settings. State (incidents, latency, heartbeats) persists to `.data/state.json`.

## API

- `GET /api/status` — the full live snapshot (runs all checks + alert engine)
- `GET /api/incidents` — incident history
- `GET|POST /api/heartbeat/<job-id>` — cron heartbeat receiver
# monitoring-system
