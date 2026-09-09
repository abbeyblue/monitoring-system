import { NextRequest, NextResponse } from "next/server";
import { getBusinessSnapshot } from "@/lib/business";
import { asRole, getRole } from "@/lib/roles";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const period = new URL(req.url).searchParams.get("period") || "month";
  // role comes from the middleware-set, client-stripped header (authenticated identity)
  const role = asRole(req.headers.get("x-crm-monitor-role")) ?? getRole();
  const snap = await getBusinessSnapshot(period, role);
  return NextResponse.json(snap, { headers: { "cache-control": "no-store" } });
}
