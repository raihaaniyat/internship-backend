/**
 * apps/api: protected resource server.
 *
 * Public:    /health, GET /parts, GET /parts/:id
 * Auth'd:    /me, /me/garage*, /me/saved-parts*
 * Admin:     POST/PATCH/DELETE /parts*
 *
 * The Better Auth session token is presented as `Authorization: Bearer <token>`.
 * Validation goes through the shared `@internship/auth-config` package, so
 * we never duplicate verification logic.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { fail } from "./lib/responses";
import { readApiEnv } from "./lib/env";
import { requestLogger } from "./middleware/requestLogger";
import { securityHeaders } from "./middleware/securityHeaders";
import { createRateLimiter } from "./middleware/rateLimit";
import { healthRoutes } from "./routes/health";
import { partsRoutes } from "./routes/parts";
import { meRoutes } from "./routes/me";
import type { AuthEnv } from "./lib/auth-context";

const app = new Hono<AuthEnv>();
const config = readApiEnv();

// CORS: explicit allow list. NEVER use `*` in production - it disables the
// browser's same-origin protections for credentialed requests and lets any
// site read responses on a victim's behalf. The `API_CORS_ORIGINS` env var
// is the single switch for what the deployed API trusts.
app.use(
  "*",
  cors({
    origin: config.corsOrigins,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 600,
  }),
);

app.use("*", securityHeaders);
app.use("*", requestLogger);
app.use("/health", createRateLimiter(config.rateLimitPublicPerMin, config.rateLimitWindowMs));
app.use("/parts", createRateLimiter(config.rateLimitPublicPerMin, config.rateLimitWindowMs));
app.use("/parts/*", createRateLimiter(config.rateLimitPublicPerMin, config.rateLimitWindowMs));
app.use("/me", createRateLimiter(config.rateLimitAuthPerMin, config.rateLimitWindowMs));
app.use("/me/*", createRateLimiter(config.rateLimitWritePerMin, config.rateLimitWindowMs));

app.route("/", healthRoutes);
app.route("/", partsRoutes);
app.route("/", meRoutes);

app.notFound((c) => fail(c, 404, "not_found", "Route not found"));

// Catch-all error handler. Stack traces never leave the server.
app.onError((err, c) => {
  console.error("[api] unhandled error:", err);
  return fail(c, 500, "server_error", "An unexpected error occurred");
});

const port = config.port;

console.log(`[api] listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
