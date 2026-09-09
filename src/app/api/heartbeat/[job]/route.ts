import { NextResponse } from "next/server";
import { recordHeartbeat } from "@/lib/store";
import { CRON_JOBS } from "@/lib/config";

export const dynamic = "force-dynamic";

// Cron verification receiver. Wire each CRM cron to hit this on success:
//   curl -fsS "https://YOUR_MONITOR_HOST/api/heartbeat/<job-id>?token=$HEARTBEAT_TOKEN"
// If HEARTBEAT_TOKEN is set, it must match (query ?token= or Authorization: Bearer).
function authed(req: Request): boolean {
  const token = process.env.HEARTBEAT_TOKEN;
  if (!token) return true;
  const url = new URL(req.url);
  const q = url.searchParams.get("token");
  const bearer = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  return q === token || bearer === token;
}

export async function GET(req: Request, { params }: { params: Promise<{ job: string }> }) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { job } = await params;
  if (!CRON_JOBS.some((c) => c.id === job)) return NextResponse.json({ error: "unknown job" }, { status: 404 });
  await recordHeartbeat(job);
  return NextResponse.json({ ok: true, job, at: new Date().toISOString() });
}

export const POST = GET;
