// Server-side, read-only client for the CRM's own API. Runs only in monitor API
// routes (never the browser) so the monitoring identity's cookie stays
// server-side and there's no CORS.
//
// AUTH ARCHITECTURE (target): the monitor should authenticate as a DEDICATED
// read-only monitoring identity (NOT the super-admin cookie). See crm-registry.ts
// for the exact read permissions required. Credentials are supplied via env only
// (MONITOR_SESSION_COOKIE) — never hardcoded, never sent to the browser.

export type CrmStatus =
  | "ok" | "empty"
  | "not-configured"
  | "unauthorized" | "forbidden" | "not-found" | "rate-limited"
  | "timeout" | "error" | "malformed";

export interface CrmResult<T> {
  status: CrmStatus;
  httpStatus?: number;
  latencyMs?: number;
  data?: T;
  error?: string;
  contentType?: string;   // non-secret diagnostic (e.g. "text/html" vs "application/json")
}

const BASE = process.env.CRM_BASE_URL ?? "";
const COOKIE = process.env.MONITOR_SESSION_COOKIE ?? "";

const isPlaceholderHost = (u: string) => {
  const b = u.toLowerCase();
  return b.includes("your-crm-host") || b.includes("your_crm_host");
};
export const crmConfigured = () => Boolean(BASE) && !isPlaceholderHost(BASE);
export const crmAuthConfigured = () => Boolean(COOKIE);
export const crmBase = () => BASE;

/** Pure classifier — maps an HTTP status + parsed body to a CrmStatus.
 *  Exported for contract tests (no network). Never returns a numeric fallback. */
export function classify(httpStatus: number, body: unknown): CrmStatus {
  if (httpStatus === 401) return "unauthorized";
  if (httpStatus === 403) return "forbidden";
  if (httpStatus === 404) return "not-found";
  if (httpStatus === 429) return "rate-limited";
  if (httpStatus >= 500) return "error";
  if (httpStatus < 200 || httpStatus >= 300) return "error";
  // 2xx — check for emptiness
  if (body == null) return "empty";
  if (Array.isArray(body) && body.length === 0) return "empty";
  if (typeof body === "object" && Object.keys(body as object).length === 0) return "empty";
  return "ok";
}

export async function crmFetch<T>(path: string, timeoutMs = 8000): Promise<CrmResult<T>> {
  if (!crmConfigured()) return { status: "not-configured" };
  const started = Date.now();
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(BASE + path, {
      signal: controller.signal, cache: "no-store", redirect: "manual",
      headers: COOKIE ? { cookie: COOKIE } : undefined,
    });
    const latencyMs = Date.now() - started;
    const contentType = res.headers?.get?.("content-type") ?? undefined;
    // non-2xx: classify without parsing (body may be an error page)
    if (res.status < 200 || res.status >= 300) {
      return { status: classify(res.status, undefined), httpStatus: res.status, latencyMs, contentType };
    }
    let body: unknown;
    try { body = await res.json(); }
    catch { return { status: "malformed", httpStatus: res.status, latencyMs, error: "invalid JSON", contentType }; }
    const status = classify(res.status, body);
    return { status, httpStatus: res.status, latencyMs, data: body as T, contentType };
  } catch (e) {
    const aborted = e instanceof Error && e.name === "AbortError";
    return { status: aborted ? "timeout" : "error", latencyMs: Date.now() - started, error: aborted ? "timeout" : "network" };
  } finally {
    clearTimeout(t);
  }
}
