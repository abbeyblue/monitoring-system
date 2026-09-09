import { NextResponse } from "next/server";
import { effectiveSettings, updateSettings, storageKind } from "@/lib/store";
import {
  CLOUDWATCH_ENABLED, MONITOR_SESSION_COOKIE, ALERT_CHANNELS, AWS_REGION, LOG_GROUPS,
} from "@/lib/config";

export const dynamic = "force-dynamic";

function envStatus() {
  return {
    cloudwatch: CLOUDWATCH_ENABLED,
    authCookie: Boolean(MONITOR_SESSION_COOKIE),
    slackAlerts: Boolean(ALERT_CHANNELS.slackWebhook),
    webhookAlerts: Boolean(ALERT_CHANNELS.genericWebhook),
    heartbeatToken: Boolean(process.env.HEARTBEAT_TOKEN),
    passwordGate: Boolean(process.env.MONITOR_PASSWORD),
    region: AWS_REGION,
    logGroups: LOG_GROUPS,
    storage: storageKind(),
  };
}

export async function GET() {
  const [effective] = await Promise.all([effectiveSettings()]);
  return NextResponse.json({ env: envStatus(), effective }, { headers: { "cache-control": "no-store" } });
}

export async function PATCH(req: Request) {
  const body = await req.json().catch(() => ({}));
  const next = await updateSettings({ minTier: body.minTier, consecutiveFailures: body.consecutiveFailures });
  return NextResponse.json({ ok: true, effective: next });
}
