import { NextResponse } from "next/server";
import { crmFetch, crmConfigured, crmAuthConfigured, crmBase } from "@/lib/crm";
import { CRM_ENDPOINTS } from "@/lib/crm-registry";
import { MONITOR_TZ, MONITOR_CURRENCY } from "@/lib/config";

export const dynamic = "force-dynamic";

// Read-only connection diagnostic + setup checklist (P11 / phase: disconnected
// deployment). NEVER exposes the session cookie, tokens, headers, raw CRM
// payloads, or personal data — only booleans, statuses, timings, and non-secret
// config (timezone/currency). liveVerified is NEVER set here.
type ConnState = "not-configured" | "unreachable" | "unauthorized" | "degraded" | "authorized-unverified";

export async function GET() {
  const configured = crmConfigured();
  const probes = CRM_ENDPOINTS.filter((e) => e.implemented && e.method === "GET");

  const results = configured
    ? await Promise.all(probes.map(async (e) => {
        const r = await crmFetch(e.path); // read-only GET; no body echoed
        return { path: e.path, domain: e.domain, status: r.status, httpStatus: r.httpStatus ?? null, latencyMs: r.latencyMs ?? null, contentType: r.contentType ?? null, requiredPermission: e.requiredPermission };
      }))
    : probes.map((e) => ({ path: e.path, domain: e.domain, status: "not-configured" as const, httpStatus: null, latencyMs: null, requiredPermission: e.requiredPermission }));

  const answered = results.some((r) => r.httpStatus != null);
  const anyAuthorized = results.some((r) => r.status === "ok" || r.status === "empty");
  const anyUnauthorized = results.some((r) => r.status === "unauthorized" || r.status === "forbidden");
  const oks = results.filter((r) => r.latencyMs != null).map((r) => r.latencyMs as number);

  const anyFailure = results.some((r) => ["unauthorized", "forbidden", "not-found", "error", "timeout", "rate-limited", "malformed", "unreachable"].includes(r.status));
  const connectionState: ConnState =
    !configured ? "not-configured"
    : !answered ? "unreachable"
    : !anyAuthorized ? "unauthorized"           // answered but nothing authorized (incl. forbidden)
    : anyFailure ? "degraded"                    // some endpoints authorized, some failing (partial)
    : "authorized-unverified";                   // all authorized — but shapes NOT live-verified here

  return NextResponse.json({
    connectionState,
    crmConfigured: configured,
    crmBase: configured ? crmBase() : null,
    authConfigured: crmAuthConfigured(),           // boolean only — never the cookie
    reachable: configured ? answered : false,
    authenticationAccepted: configured ? !anyUnauthorized && answered : false,
    monitoringIdentityAuthorized: anyAuthorized,
    avgLatencyMs: oks.length ? Math.round(oks.reduce((a, b) => a + b, 0) / oks.length) : null,
    checkedAt: new Date().toISOString(),
    endpoints: results,
    // non-secret setup checklist — what an operator must provide before a live test
    setup: {
      crmBaseUrl: { required: true, set: configured },
      monitoringIdentity: { required: true, set: crmAuthConfigured(), note: "dedicated READ-ONLY account credential in .env.local (never super-admin)" },
      timezone: { required: true, value: MONITOR_TZ },
      currency: { required: true, value: MONITOR_CURRENCY, conversion: "none (native only)" },
      requiredPermissions: Array.from(new Set(probes.map((e) => e.requiredPermission))).sort(),
      nonProductionVerificationRequired: true,
      liveVerified: false,
    },
    stateLegend: {
      "not-configured": "CRM_BASE_URL / identity absent",
      unreachable: "configured but no endpoint answered",
      unauthorized: "answered but the monitoring identity is not permitted",
      "authorized-unverified": "reachable & authorized — response SHAPES not yet live-verified",
      "live-verified": "set per-endpoint only after confirming the live shape (never automatically)",
      "stale/degraded": "last value older than 2× refresh, or partial availability",
    },
  }, { headers: { "cache-control": "no-store" } });
}
