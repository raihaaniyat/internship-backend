import type { Context, Next } from "hono";

export async function securityHeaders(c: Context, next: Next) {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("X-XSS-Protection", "0");
  // See apps/auth: avoid CORP same-site so 127.0.0.1 ↔ localhost dev URLs work.
  c.header("Cross-Origin-Resource-Policy", "cross-origin");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
}
