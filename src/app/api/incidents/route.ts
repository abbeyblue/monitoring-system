import { NextResponse } from "next/server";
import { loadState } from "@/lib/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const s = await loadState();
  return NextResponse.json(
    { incidents: s.incidents.slice(0, 100) },
    { headers: { "cache-control": "no-store" } }
  );
}
