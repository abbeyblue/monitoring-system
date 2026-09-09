import { NextRequest, NextResponse } from "next/server";
import { asRole, getRole, parseUsers } from "@/lib/roles";

export const dynamic = "force-dynamic";

// The current operator's effective role (from the authenticated identity when
// MONITOR_USERS is configured, else the global MONITOR_ROLE). Drives nav scoping
// client-side; business-KPI + route scoping are enforced server-side.
export function GET(req: NextRequest) {
  const role = asRole(req.headers.get("x-crm-monitor-role")) ?? getRole();
  return NextResponse.json({ role, perUserIdentity: parseUsers().size > 0 });
}
