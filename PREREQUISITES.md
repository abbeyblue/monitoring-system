# First non-production connection — prerequisites & safety

The board runs safely **disconnected**. Nothing below connects to a live CRM;
it documents exactly what you must provide before a controlled non-production
read-only test. **No `liveVerified` flag is set until a live shape is confirmed.**

## 1. Setup checklist (non-secret)
`GET /api/diagnostics` returns this live, plus a `connectionState`:

| State | Meaning |
|---|---|
| `not-configured` | `CRM_BASE_URL` / identity absent |
| `unreachable` | configured but no endpoint answered |
| `unauthorized` | answered but the monitoring identity isn't permitted |
| `authorized-unverified` | reachable + authorized, **shapes not yet live-verified** |
| `live-verified` | set **per endpoint only** after confirming the live shape (never automatic) |
| `stale / degraded` | value older than 2× refresh, or partial availability |

Required before a live test:
1. `CRM_BASE_URL` → a **non-production** (or read-only-safe) CRM host. Use the bare
   **origin only** — e.g. `https://host.example.com` — **not** a `/login?...` URL
   and **no trailing slash** (a wrong base returns the login HTML, seen as `malformed`).
2. A **dedicated read-only monitoring account** cookie in `.env.local`
   (`MONITOR_SESSION_COOKIE`) — **never** a super-admin account. Set by you; never pasted in chat.
   The CRM runs **Auth.js v5**, so the session cookie is
   **`__Secure-authjs.session-token`** (https) — NOT `next-auth.session-token`.
   Format: `MONITOR_SESSION_COOKIE=__Secure-authjs.session-token=<value>` (the
   cookie is `HttpOnly`, so copy the Value from DevTools → Application → Cookies).
3. `MONITOR_TZ` (default `Europe/Dublin`) and `MONITOR_CURRENCY` (default `EUR`).
4. Auth for the board itself: `MONITOR_USERS` (per-user) or `MONITOR_PASSWORD`.

### First sandbox live test — result (2026-09-08)
Connected to the Vercel sandbox preview. End-to-end pipeline **proven**:
- With a **scoped admin** cookie → `connectionState: degraded`; `/api/tickets/deadlines`
  returned `ok`, the other 5 returned `403 forbidden` (honestly shown as `—`, never 0).
- With a **super-admin** cookie → all 6 endpoints `ok 200`, `connectionState: authorized-unverified`.
- **Live-verified so far:** `deadlines` (3 active / 1 overdue reconciled against the CRM).
- **Pending reconciliation** (values look unusual, confirm against CRM before trusting):
  `revenue-mtd = €1 / 0 cases` (timezone/month-boundary or low sandbox activity?),
  `active-sessions = 1856` (un-revoked test sessions?), `outstanding = €100,132 / 50 cases`, `stagnant = 40`.
- The 403 map from the scoped-admin run **is** the least-privilege spec for the prod
  read-only account (see §2).

## 2. Endpoint → permission matrix (6 implemented sources)
All verified from the CRM source (method + guard). The monitoring identity needs
**only** these read permissions — never super-admin blanket access.

| KPI(s) | Method + Route | CRM guard (min permission) | Fields consumed | Why |
|---|---|---|---|---|
| revenue-mtd | GET `/api/analytics/revenue?period=` | `requireService("revenue")` | `paidRevenue, outstanding, ticketCount` | Revenue MTD tile |
| outstanding, urgent-followups | GET `/api/payment-followup` | `requireService("paymentFollowup")` | `summary.totalOutstanding, totalCases, urgentFollowups` | Financial tiles |
| overdue-deadlines, active-cases | GET `/api/tickets/deadlines` | `requireService("deadlines")` | `cases[].deadlineInfo.daysRemaining` | Support tiles |
| stagnant-cases | GET `/api/governance/stagnant` | role `SUPER_ADMIN`/`SEMI_SUPER_ADMIN` | `tickets[]` (count only) | Support tile |
| service-inbox | GET `/api/service-requests/inbox?scope=pending` | `requireTaskAssigner()` | `tasks[]` (count only) | Support tile |
| failed-logins, active-sessions | GET `/api/super-admin/security-overview` | `requireService("security")` | `stats.failed24h, activeSessions` | Security tiles |

**Uncertain guards (verify live before trusting):**
- `governance/stagnant` is **role-gated** (`SUPER_ADMIN`/`SEMI_SUPER_ADMIN`) — a
  least-privilege monitoring account may need an equivalent service permission or
  will return `forbidden`. **Flagged.**
- `service-requests/inbox` requires **task-assigner** — a read-only account may
  return `forbidden`. **Flagged.**
- `revenue`, `deadlines`, `paymentFollowup`, `security` are `requireService(...)`
  keys — grant exactly those, no more.

## 3. RBAC — current state & limitation
- **Implemented:** when `MONITOR_USERS="user:pass:role,…"` is set, the
  **authenticated Basic-Auth user's role** drives the server-side route guard AND
  the KPI data scoping (via a middleware-set, client-**stripped** `x-crm-monitor-role`
  header — anti-spoof verified). Route access, API responses, and data scoping now
  derive from **one identity**.
- **Limitation (documented, not complete RBAC):** identities are **monitor-local**
  (a static `MONITOR_USERS` table), **not** the CRM's SSO/user identity. If
  `MONITOR_USERS` is unset it falls back to the single global `MONITOR_ROLE`.
  Incident *visibility* is not yet role-scoped (alert **detection** is system-wide
  by design). **Do not describe this as complete RBAC** until identities come from
  the CRM's authenticated user.
- **Smallest next step:** replace the static `MONITOR_USERS` table with the CRM's
  session/SSO identity → role mapping, and scope incident visibility to the same role.

## 4. Timezone & currency
- `MONITOR_TZ` (default `Europe/Dublin`), `MONITOR_CURRENCY` (default `EUR`) are
  **explicit** config. Currency mode is **native only — no conversion** (add one
  only with a real exchange-rate source + explicit policy).
- **CRM caveat:** `/api/analytics/revenue` bounds months with `new Date(y, m, 1)`
  in **server-local time** — not `MONITOR_TZ`. Near month boundaries the CRM's MTD
  window may differ from the monitor's assumed timezone. The monitor cannot fix
  this from outside; it is surfaced, not hidden.
- **Non-production comparison checklist (run at first live test):**
  1. Compare monitor **revenue-mtd** vs the CRM revenue page for `period=month`.
  2. Repeat within a few hours of **UTC midnight / month rollover** to expose the
     server-local boundary.
  3. Compare **outstanding** vs the CRM payment-followup total.
  4. Confirm the currency symbol matches the CRM's actual currency; if the CRM is
     multi-currency, mark these KPIs **native** and do not sum across currencies.

## 5. History durability
- File backend (default, no `DATABASE_URL`): **non-durable, single-instance only**;
  `GET /api/history` reports `storage.durable=false`. Do **not** rely on it in a
  multi-instance/serverless deployment.
- Postgres backend (`DATABASE_URL` set): durable + multi-instance safe
  (`kpi_history` table). Implemented; **not live-tested without a database.**
- History records **only** successful numeric KPI values — never mock, stale,
  unavailable, unauthorized, or malformed.
