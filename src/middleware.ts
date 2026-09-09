import { NextRequest, NextResponse } from "next/server";
import { getRole, routeAllowed, verifyUser, parseUsers, type MonitorRole } from "@/lib/roles";

const ROLE_HEADER = "x-crm-monitor-role";

// P5 — auth fails CLOSED in production (never silently open).
// P4 / per-user RBAC — when MONITOR_USERS is set, the authenticated user's role
// drives BOTH the route guard and (via a middleware-set, client-stripped header)
// the downstream data scoping — so authorization derives from one identity.
export function middleware(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isProd = process.env.NODE_ENV === "production";
  const users = parseUsers();
  const singlePassword = process.env.MONITOR_PASSWORD;

  let role: MonitorRole = getRole(); // fallback (single-operator / dev)

  const basic = () => {
    const header = req.headers.get("authorization") || "";
    if (!header.startsWith("Basic ")) return null;
    try { const [u, p] = atob(header.slice(6)).split(":"); return { u, p }; } catch { return null; }
  };
  const unauthorized = () => new NextResponse("Authentication required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="CRM Monitor", charset="UTF-8"' } });

  if (users.size > 0) {
    // per-user auth: role = authenticated user's role
    const c = basic();
    const u = c && verifyUser(c.u, c.p);
    if (!u) return unauthorized();
    role = u.role;
  } else if (singlePassword) {
    const c = basic();
    const monitorUser = process.env.MONITOR_USER || "monitor";
    if (!c || c.u !== monitorUser || c.p !== singlePassword) return unauthorized();
    role = getRole();
  } else {
    // no auth configured
    if (isProd) {
      console.error("[crm-monitor] SECURITY: no MONITOR_USERS and no MONITOR_PASSWORD set. Refusing to serve in production. Configure one and redeploy.");
      return new NextResponse("Monitoring board not configured: authentication is required in production. See server logs.", { status: 503, headers: { "content-type": "text/plain" } });
    }
    console.warn("[crm-monitor] DEV: no auth configured — auth disabled (development only).");
    role = getRole();
  }

  // role route guard (server-side, fail closed)
  if (!routeAllowed(role, path)) {
    return new NextResponse("Forbidden: your role is not permitted to view this area.", { status: 403, headers: { "content-type": "text/plain" } });
  }

  // forward the resolved role, having STRIPPED any client-supplied value (anti-spoof)
  const fwd = new Headers(req.headers);
  fwd.delete(ROLE_HEADER);
  fwd.set(ROLE_HEADER, role);
  return NextResponse.next({ request: { headers: fwd } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|api/ping|api/heartbeat).*)"],
};
