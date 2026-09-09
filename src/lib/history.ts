// Time-series KPI snapshot store (P7). Stores ONLY successful numeric KPI values
// — never mock/unavailable/error. Two backends:
//   • file  (JSONL)   — default; NON-durable, NOT multi-instance safe. Best-effort
//                       single-instance only. /api/history reports durable:false.
//   • postgres        — used when DATABASE_URL is set; durable + multi-instance
//                       safe (a kpi_history table). Not live-tested without a DB.
// We NEVER claim durable history unless the Postgres backend is active.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { KpiResult } from "@/lib/contract";

const FILE = path.join(process.cwd(), ".data", "kpi-history.jsonl");
const MAX_LINES = 200_000;

export interface KpiPoint { ts: string; id: string; raw: number; health: string; source: string; }
export const HISTORY_RANGES = { "24h": 864e5, "7d": 6048e5, "30d": 2592e6, "90d": 7776e6 } as const;
export type HistoryRange = keyof typeof HISTORY_RANGES;

export function historyBackend(): "postgres" | "file" { return process.env.DATABASE_URL ? "postgres" : "file"; }
export function historyStatus() {
  const backend = historyBackend();
  const durable = backend === "postgres";
  return { backend, durable, multiInstanceSafe: durable,
    note: durable ? "durable (Postgres)" : "non-durable, single-instance only (file JSONL) — set DATABASE_URL for durable multi-instance history" };
}

const okPoints = (kpis: KpiResult[]): KpiPoint[] =>
  kpis.filter((k) => k.status === "ok" && typeof k.raw === "number")
    .map((k) => ({ ts: new Date().toISOString(), id: k.id, raw: k.raw as number, health: k.health, source: k.source }));

// ---- Postgres backend (durable) ----
async function pgPool() {
  const { Pool } = await import("pg");
  const g = globalThis as unknown as { __cwmHistPool?: import("pg").Pool };
  if (!g.__cwmHistPool) {
    g.__cwmHistPool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false }, max: 3 });
    await g.__cwmHistPool.query(`CREATE TABLE IF NOT EXISTS kpi_history (ts timestamptz NOT NULL, id text NOT NULL, raw double precision NOT NULL, health text, source text)`);
    await g.__cwmHistPool.query(`CREATE INDEX IF NOT EXISTS kpi_history_id_ts ON kpi_history (id, ts)`).catch(() => {});
  }
  return g.__cwmHistPool;
}

export async function appendKpiPoints(kpis: KpiResult[]): Promise<number> {
  const points = okPoints(kpis);
  if (points.length === 0) return 0;
  if (historyBackend() === "postgres") {
    const p = await pgPool();
    // parameterised multi-row insert (atomic per statement — multi-instance safe)
    const vals: unknown[] = []; const rows: string[] = [];
    points.forEach((pt, i) => { const b = i * 5; rows.push(`($${b + 1},$${b + 2},$${b + 3},$${b + 4},$${b + 5})`); vals.push(pt.ts, pt.id, pt.raw, pt.health, pt.source); });
    await p.query(`INSERT INTO kpi_history (ts, id, raw, health, source) VALUES ${rows.join(",")}`, vals);
    return points.length;
  }
  await fs.mkdir(path.dirname(FILE), { recursive: true });
  await fs.appendFile(FILE, points.map((p) => JSON.stringify(p)).join("\n") + "\n", "utf8");
  return points.length;
}

export async function readSeries(id: string, range: HistoryRange): Promise<KpiPoint[]> {
  const since = Date.now() - HISTORY_RANGES[range];
  if (historyBackend() === "postgres") {
    const p = await pgPool();
    const res = await p.query<{ ts: Date; id: string; raw: number; health: string; source: string }>(
      `SELECT ts, id, raw, health, source FROM kpi_history WHERE id = $1 AND ts >= $2 ORDER BY ts ASC`, [id, new Date(since)]);
    return res.rows.map((r) => ({ ts: r.ts.toISOString(), id: r.id, raw: r.raw, health: r.health, source: r.source }));
  }
  let raw: string;
  try { raw = await fs.readFile(FILE, "utf8"); } catch { return []; }
  const out: KpiPoint[] = [];
  for (const line of raw.split("\n")) {
    if (!line) continue;
    try { const pt = JSON.parse(line) as KpiPoint; if (pt.id === id && new Date(pt.ts).getTime() >= since) out.push(pt); }
    catch { /* skip corrupt line */ }
  }
  return out;
}

export async function trimHistory(): Promise<void> {
  if (historyBackend() !== "file") return;
  try {
    const raw = await fs.readFile(FILE, "utf8");
    const lines = raw.split("\n").filter(Boolean);
    if (lines.length > MAX_LINES) await fs.writeFile(FILE, lines.slice(-MAX_LINES).join("\n") + "\n", "utf8");
  } catch { /* no file yet */ }
}
