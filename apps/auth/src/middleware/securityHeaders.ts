import type { Context, Next } from "hono";

export async function securityHeaders(c: Context, next: Next) {
  await next();

  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header("X-XSS-Protection", "0");
  // CORP `same-site` breaks dev when the tab is `127.0.0.1` but the API
  // URL is `localhost` (or vice versa): Chromium treats them as different
  // sites, so the browser may hide the response from fetch(). CORS still
  // enforces which Origins may call the API; use `cross-origin` here.
  c.header("Cross-Origin-Resource-Policy", "cross-origin");
  c.header("Cross-Origin-Opener-Policy", "same-origin");
}
