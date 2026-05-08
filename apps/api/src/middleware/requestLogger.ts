/**
 * Minimal request logger: method, path, status, duration in ms.
 * Inline implementation - no external service. Production should swap
 * console.log for a structured logger (pino, winston) and add a request id.
 */

import type { Context, Next } from "hono";

export async function requestLogger(c: Context, next: Next) {
  const start = performance.now();
  await next();
  const ms = (performance.now() - start).toFixed(1);
  const { method } = c.req;
  const { pathname } = new URL(c.req.url);
  console.log(`[api] ${method} ${pathname} -> ${c.res.status} (${ms}ms)`);
}
