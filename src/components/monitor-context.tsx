"use client";

import { createContext, useContext, useCallback, useEffect, useRef, useState } from "react";
import type { Status, Incident } from "@/lib/types";

interface MonitorCtx {
  data: Status | null;
  history: Incident[];
  latency: Record<string, number[]>;
  loading: boolean;
  error: string | null;
  reload: () => void;
  toggleMaintenance: () => Promise<void>;
}

const Ctx = createContext<MonitorCtx | null>(null);

export function MonitorProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Status | null>(null);
  const [history, setHistory] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latency = useRef<Record<string, number[]>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const [s, i] = await Promise.all([
        fetch("/api/status", { cache: "no-store" }),
        fetch("/api/incidents", { cache: "no-store" }),
      ]);
      const json: Status = await s.json();
      const inc: { incidents: Incident[] } = await i.json();
      for (const e of [...json.endpoints, ...json.authed]) {
        const h = (latency.current[e.id] ??= []);
        if (e.health !== "down" && e.health !== "idle") h.push(e.latency);
        if (h.length > 40) h.shift();
      }
      setData(json); setHistory(inc.incidents); setError(null);
    } catch { setError("Monitor API unreachable."); } finally { setLoading(false); }
  }, []);

  useEffect(() => { reload(); const id = setInterval(reload, 30_000); return () => clearInterval(id); }, [reload]);

  const toggleMaintenance = useCallback(async () => {
    const on = data?.silences?.some((s) => s.scope === "*");
    if (on) await fetch("/api/silence?scope=*", { method: "DELETE" });
    else await fetch("/api/silence", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ scope: "*", minutes: 60, reason: "manual" }) });
    reload();
  }, [data, reload]);

  return (
    <Ctx.Provider value={{ data, history, latency: latency.current, loading, error, reload, toggleMaintenance }}>
      {children}
    </Ctx.Provider>
  );
}

export function useMonitor(): MonitorCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("useMonitor must be used within MonitorProvider");
  return c;
}
