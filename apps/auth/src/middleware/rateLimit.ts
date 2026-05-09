import type { Context, Next } from "hono";

const buckets = new Map<string, { count: number; resetAt: number }>();

function getClient(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("cf-connecting-ip") ??
    "local"
  );
}

export function createAuthRateLimiter(limit: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const key = `${getClient(c)}:${c.req.path}`;
    const now = Date.now();
    const existing = buckets.get(key);
    const bucket =
      existing && existing.resetAt > now ? existing : { count: 0, resetAt: now + windowMs };

    bucket.count += 1;
    buckets.set(key, bucket);

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    c.header("X-RateLimit-Reset", String(Math.floor(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      return c.json(
        { error: "rate_limited", message: "Too many authentication requests, please wait." },
        429,
      );
    }

    await next();
  };
}
