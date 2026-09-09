# Go-live runbook

Do these in order. After each phase, reload http://localhost:4000 and confirm
that section turns green before moving on. Everything except Phase 1 is optional
but recommended.

---

## Phase 1 — Run locally against prod (5 min)

```bash
cd ~/Desktop/crm-monitor
cp .env.example .env.local
# edit .env.local: set CRM_BASE_URL=https://<your-prod-crm-host>
npm install          # use npm, not pnpm
npm run dev          # http://localhost:4000
```

✅ Expect: **Live endpoints** green, **External dependencies** show Stripe/Pusher
Operational, **Scheduled jobs** table populated. (Authed/CloudWatch still dark.)

---

## Phase 2 — Authenticated routes

1. Create (or pick) a **read-only staff account** in the CRM — lowest privileges
   that can still load pages.
2. Log in as that account in a browser. Open DevTools → Application → Cookies →
   your CRM domain. Copy the NextAuth session cookie **name and value**:
   - prod (https): `__Secure-next-auth.session-token`
   - local (http): `next-auth.session-token`
3. In `.env.local`, set the whole `name=value` pair:
   ```
   MONITOR_SESSION_COOKIE=__Secure-next-auth.session-token=eyJ...long...value
   ```
4. Restart (`Ctrl-C`, `npm run dev`).

✅ Expect: **Authenticated routes** turn green. (They go red when the cookie
expires — that's the known limitation; re-copy when it happens.)

---

## Phase 3 — AWS CloudWatch

1. **IAM user** (read-only). In AWS console → IAM → create user `crm-monitor-ro`,
   attach `iam-policy.json` (edit `ACCOUNT_ID` + confirm the log-group ARN first).
   Create an access key.
2. Put the creds in `.env.local`:
   ```
   AWS_REGION=eu-west-1
   AWS_ACCESS_KEY_ID=AKIA...
   AWS_SECRET_ACCESS_KEY=...
   CW_LOG_GROUPS=/ecs/abbey-blue-crm
   ```
3. **Find the real names** (with any AWS CLI creds that can read):
   ```bash
   aws logs describe-log-groups --region eu-west-1 --query 'logGroups[].logGroupName'
   aws ecs list-clusters  --region eu-west-1
   aws ecs list-services  --region eu-west-1 --cluster <cluster-arn>
   aws rds describe-db-instances --region eu-west-1 --query 'DBInstances[].DBInstanceIdentifier'
   ```
   - Put the log group(s) in `CW_LOG_GROUPS`.
   - In `src/lib/config.ts` → `METRICS`, replace `REPLACE_CLUSTER`,
     `REPLACE_SERVICE`, `REPLACE_DB_INSTANCE` with those values.
4. Restart.

✅ Expect: **AWS CloudWatch** shows metrics sparklines + recent error logs.
Alarms will say "none configured" (expected — you use logs).

---

## Phase 4 — Failed-cron detection (pick ONE)

**Option A — heartbeats (most reliable).** Add one line to each cron on success:
```bash
curl -fsS "https://<your-monitor-host>/api/heartbeat/<job-id>?token=$HEARTBEAT_TOKEN"
```
Set `HEARTBEAT_TOKEN` in `.env.local` to any random string. Job ids are the `id`
values in `CRON_JOBS` (e.g. `reconcile-payments`).

**Option B — log markers.** In `src/lib/config.ts` → `CRON_LOG_MARKERS`, set the
exact success/error strings each cron prints. Unlisted jobs fall back to
matching `"<path> 200"` in the logs.

✅ Expect: **Cron runs** tiles flip to ran/failed based on real evidence.

---

## Phase 5 — Alerting

1. Create a **Slack Incoming Webhook** (or any endpoint that accepts JSON POST).
2. In `.env.local`:
   ```
   ALERT_SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
   ALERT_MIN_TIER=2                 # 1=critical only, 2=core+, 3=everything
   ALERT_CONSECUTIVE_FAILURES=2     # de-flap: bad polls before alerting
   ```
3. Test: temporarily point `CRM_BASE_URL` at a bad host, wait ~1 min → you should
   get a firing alert, then a resolved alert when you point it back.

---

## Phase 6 — Lock down + deploy

1. **Password-protect it** (it exposes infra + error logs):
   ```
   MONITOR_USER=monitor
   MONITOR_PASSWORD=<a-strong-password>
   ```
2. **Persistence — depends on host:**
   - VM or container **with a volume** → nothing to do; JSON file store works.
   - **Serverless (Vercel/etc.)** → provision Postgres and set `DATABASE_URL=...`;
     the app auto-switches and history survives cold starts.
3. **Build & serve:**
   ```bash
   npm run build && npm start      # port 4000
   ```
   Put it behind your host's HTTPS + (ideally) an IP allowlist/VPN.
4. Point `CRM_BASE_URL` at prod, load it, confirm every section is green.

Done — it now polls prod every 30s, records incidents, and alerts on changes.

---

## Phase 7 — Deploy to AWS ECS (Fargate)

Files: `Dockerfile`, `ecs-task-def.json`, `iam-policy.json`. AWS access uses the
**task role** (no static keys) — the SDK picks it up automatically and the
CloudWatch panel self-enables. Fargate's disk is ephemeral, so set a
**`DATABASE_URL`** secret (Postgres) or incident history resets on redeploy.

Set once: `ACCOUNT=<id>  REGION=eu-west-1  REPO=crm-monitor`

**1. Build & push the image** (build for amd64 to match the task def):
```bash
aws ecr create-repository --repository-name $REPO --region $REGION
aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ACCOUNT.dkr.ecr.$REGION.amazonaws.com
docker build --platform linux/amd64 -t $REPO:latest .
docker tag $REPO:latest $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest
docker push $ACCOUNT.dkr.ecr.$REGION.amazonaws.com/$REPO:latest
```
(Prefer native ARM? Set `runtimePlatform.cpuArchitecture` to `ARM64` in the task
def and drop `--platform`.)

**2. IAM roles**
- **Task role** `crm-monitor-task-role`: attach `iam-policy.json` (fill in
  `ACCOUNT_ID`). This is what grants read-only CloudWatch access.
- **Execution role** `crm-monitor-execution-role`: attach the managed
  `AmazonECSTaskExecutionRolePolicy`, plus `secretsmanager:GetSecretValue` on the
  `crm-monitor/*` secrets so ECS can inject them.

**3. Secrets** (Secrets Manager, names must match the task def `valueFrom` ARNs):
```bash
for s in MONITOR_PASSWORD MONITOR_SESSION_COOKIE ALERT_SLACK_WEBHOOK_URL HEARTBEAT_TOKEN DATABASE_URL; do
  aws secretsmanager create-secret --name crm-monitor/$s --region $REGION --secret-string "REPLACE_ME"
done
```

**4. Register the task def** (edit the `REPLACE_*` values first):
```bash
aws ecs register-task-definition --cli-input-json file://ecs-task-def.json --region $REGION
```

**5. Run it** — as a service behind an ALB (recommended) so you get HTTPS + the
health check on `/api/ping`, then lock the ALB down with an IP allowlist / your
VPN. Point the target group health check at `/api/ping` (port 4000).
```bash
aws ecs create-service --cluster <your-cluster> --service-name crm-monitor \
  --task-definition crm-monitor --desired-count 1 --launch-type FARGATE \
  --network-configuration 'awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}' \
  --load-balancers 'targetGroupArn=<tg-arn>,containerName=crm-monitor,containerPort=4000' \
  --region $REGION
```

**Cron heartbeats** (Phase 4) then point at the ALB URL:
`curl -fsS "https://<monitor-alb>/api/heartbeat/<job>?token=$HEARTBEAT_TOKEN"`.
```
