import { NextResponse } from "next/server";
import { addSilence, clearSilence, loadState, activeSilences } from "@/lib/store";

export const dynamic = "force-dynamic";

// GET  -> active silences
// POST -> { scope?: "*" | checkId, minutes?: number, reason?: string }  (scope defaults to "*")
// DELETE?scope=... or ?id=...  -> clear a silence / maintenance window
export async function GET() {
  const s = await loadState();
  return NextResponse.json({ silences: activeSilences(s.silences) }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const scope = typeof body.scope === "string" && body.scope ? body.scope : "*";
  const minutes = Number.isFinite(body.minutes) ? Math.max(1, Math.min(1440, body.minutes)) : 60;
  const sil = await addSilence(scope, minutes, typeof body.reason === "string" ? body.reason : undefined);
  return NextResponse.json({ ok: true, silence: sil });
}

export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get("id") || url.searchParams.get("scope") || "*";
  await clearSilence(key);
  return NextResponse.json({ ok: true, cleared: key });
}
