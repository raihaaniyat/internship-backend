import type { Context, Next } from "hono";
import { fail } from "../lib/responses";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

function clientKey(c: Context): string {
  return (
    c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
    c.req.header("cf-connecting-ip") ??
    "local"
  );
}

function currentBucket(key: string, windowMs: number): Bucket {
  const now = Date.now();
  const existing = buckets.get(key);
  if (existing && existing.resetAt > now) {
    return existing;
  }
  const next = { count: 0, resetAt: now + windowMs };
  buckets.set(key, next);
  return next;
}

export function createRateLimiter(limit: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const key = `${clientKey(c)}:${c.req.path}`;
    const bucket = currentBucket(key, windowMs);
    bucket.count += 1;

    c.header("X-RateLimit-Limit", String(limit));
    c.header("X-RateLimit-Remaining", String(Math.max(0, limit - bucket.count)));
    c.header("X-RateLimit-Reset", String(Math.floor(bucket.resetAt / 1000)));

    if (bucket.count > limit) {
      return fail(c, 429, "rate_limited", "Too many requests, please try again later");
    }

    await next();
  };
}
