/**
 * Best-effort in-process rate limiter.
 *
 * On a single Node server this is a real limit. On serverless it is
 * per-instance, so treat it as a throttle against accidental double
 * submits and casual abuse rather than a hard guarantee — the durable
 * controls are Supabase Auth's own email rate limits and RLS.
 */
interface Hit {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Hit>();

export function rateLimit(key: string, limit: number, windowMs: number): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const hit = buckets.get(key);

  if (!hit || hit.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  hit.count += 1;
  if (hit.count > limit) {
    return { ok: false, retryAfter: Math.ceil((hit.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** Keep the map from growing without bound. */
if (typeof setInterval !== 'undefined') {
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, hit] of buckets) if (hit.resetAt <= now) buckets.delete(key);
  }, 60_000);
  if (typeof sweep.unref === 'function') sweep.unref();
}
