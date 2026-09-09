// Host-agnostic persistence. Default: JSON file (VM / container with a volume).
// If DATABASE_URL is set: Postgres (serverless-safe). Both store the whole
// StoreState as one JSON blob — trivial for this scale, no migrations.
import { promises as fs } from "node:fs";
import path from "node:path";
import type { Tier, Health } from "@/lib/config";

export interface Incident {
  id: string; checkId: string; label: string; tier: Tier; severity: Health;
  openedAt: string; resolvedAt: string | null; detail?: string; suppressed?: boolean;
}
export interface Silence { id: string; scope: string; until: string; reason?: string; } // scope "*" = all

export interface Settings { minTier?: number; consecutiveFailures?: number; }

export interface StoreState {
  lastHealth: Record<string, Health>;
  pendingBad: Record<string, number>;   // consecutive-bad counter for de-flapping
  incidents: Incident[];
  latency: Record<string, number[]>;
  heartbeats: Record<string, string>;
  silences: Silence[];
  settings: Settings;
}

export const EMPTY_STATE: StoreState = {
  lastHealth: {}, pendingBad: {}, incidents: [], latency: {}, heartbeats: {}, silences: [], settings: {},
};

export interface StorageAdapter {
  read(): Promise<StoreState>;
  write(state: StoreState): Promise<void>;
  kind: string;
}

// ---- File adapter ----
class FileAdapter implements StorageAdapter {
  kind = "file";
  private file = path.join(process.cwd(), ".data", "state.json");
  async read(): Promise<StoreState> {
    try { return { ...EMPTY_STATE, ...JSON.parse(await fs.readFile(this.file, "utf8")) }; }
    catch { return { ...EMPTY_STATE }; }
  }
  async write(state: StoreState): Promise<void> {
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    await fs.writeFile(this.file, JSON.stringify(state, null, 2), "utf8");
  }
}

// ---- Postgres adapter (single-row JSONB) ----
class PostgresAdapter implements StorageAdapter {
  kind = "postgres";
  private ready = false;
  // lazy import so `pg` isn't required unless DATABASE_URL is set
  private async pool() {
    const { Pool } = await import("pg");
    const g = globalThis as unknown as { __cwmPool?: import("pg").Pool };
    if (!g.__cwmPool) {
      g.__cwmPool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === "false" ? undefined : { rejectUnauthorized: false },
        max: 3,
      });
    }
    return g.__cwmPool;
  }
  private async init() {
    if (this.ready) return;
    const p = await this.pool();
    await p.query(`CREATE TABLE IF NOT EXISTS monitor_state (id text PRIMARY KEY, data jsonb NOT NULL)`);
    this.ready = true;
  }
  async read(): Promise<StoreState> {
    await this.init();
    const p = await this.pool();
    const res = await p.query<{ data: StoreState }>(`SELECT data FROM monitor_state WHERE id = 'state'`);
    return res.rows[0] ? { ...EMPTY_STATE, ...res.rows[0].data } : { ...EMPTY_STATE };
  }
  async write(state: StoreState): Promise<void> {
    await this.init();
    const p = await this.pool();
    await p.query(
      `INSERT INTO monitor_state (id, data) VALUES ('state', $1)
       ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`,
      [JSON.stringify(state)]
    );
  }
}

let adapter: StorageAdapter | null = null;
export function getStorage(): StorageAdapter {
  if (!adapter) adapter = process.env.DATABASE_URL ? new PostgresAdapter() : new FileAdapter();
  return adapter;
}
