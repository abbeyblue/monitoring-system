import { NextRequest, NextResponse } from "next/server";
import { readSeries, historyStatus, HISTORY_RANGES, type HistoryRange } from "@/lib/history";

export const dynamic = "force-dynamic";

// Historical KPI series (P7). Returns [] until real KPI points have been
// recorded — the UI must state that historical coverage is unavailable rather
// than drawing fabricated points.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const id = url.searchParams.get("kpi") || "";
  const range = (url.searchParams.get("range") || "7d") as HistoryRange;
  if (!id) return NextResponse.json({ error: "kpi query param required" }, { status: 400 });
  if (!(range in HISTORY_RANGES)) return NextResponse.json({ error: "invalid range" }, { status: 400 });
  const points = await readSeries(id, range);
  return NextResponse.json(
    { kpi: id, range, points, available: points.length > 0, storage: historyStatus() },
    { headers: { "cache-control": "no-store" } }
  );
}
