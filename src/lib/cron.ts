// Minimal cron evaluator for the subset used by the CRM's vercel.json crons:
// "minute hour day-of-month month day-of-week", fields are "*" or a single number.
// Vercel runs crons in UTC, so everything here is computed in UTC.

function parseField(field: string, min: number, max: number): (n: number) => boolean {
  if (field === "*") return () => true;
  const nums = field.split(",").map((s) => parseInt(s, 10)).filter((n) => n >= min && n <= max);
  const set = new Set(nums);
  return (n: number) => set.has(n);
}

function matcher(expr: string) {
  const [mi = "*", ho = "*", dom = "*", mo = "*", dow = "*"] = expr.trim().split(/\s+/);
  const mMin = parseField(mi, 0, 59);
  const mHour = parseField(ho, 0, 23);
  const mDom = parseField(dom, 1, 31);
  const mMonth = parseField(mo, 1, 12);
  const mDow = parseField(dow, 0, 6);
  const domRestricted = dom !== "*";
  const dowRestricted = dow !== "*";
  return (d: Date) => {
    const domOk = mDom(d.getUTCDate());
    const dowOk = mDow(d.getUTCDay());
    // Vixie cron: when both DOM and DOW are restricted, match if EITHER matches.
    const dayOk = domRestricted && dowRestricted ? domOk || dowOk : domOk && dowOk;
    return mMin(d.getUTCMinutes()) && mHour(d.getUTCHours()) && mMonth(d.getUTCMonth() + 1) && dayOk;
  };
}

const MAX_STEPS = 400 * 24 * 60; // ~400 days of minutes — safe cap

export function nextFire(expr: string, from: Date): Date | null {
  const match = matcher(expr);
  const d = new Date(from);
  d.setUTCSeconds(0, 0);
  d.setUTCMinutes(d.getUTCMinutes() + 1);
  for (let i = 0; i < MAX_STEPS; i++) {
    if (match(d)) return new Date(d);
    d.setUTCMinutes(d.getUTCMinutes() + 1);
  }
  return null;
}

export function prevFire(expr: string, from: Date): Date | null {
  const match = matcher(expr);
  const d = new Date(from);
  d.setUTCSeconds(0, 0);
  for (let i = 0; i < MAX_STEPS; i++) {
    if (match(d)) return new Date(d);
    d.setUTCMinutes(d.getUTCMinutes() - 1);
  }
  return null;
}
