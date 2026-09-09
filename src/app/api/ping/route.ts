import { NextResponse } from "next/server";

// Liveness probe for the MONITOR itself (not the CRM). Unauthenticated and
// exempt from the password gate so ECS/ALB health checks can reach it.
export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json({ ok: true, service: "crm-monitor", at: new Date().toISOString() });
}
