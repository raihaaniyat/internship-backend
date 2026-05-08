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
import { requestLogger } from "./middleware/requestLogger";
import { healthRoutes } from "./routes/health";
import { partsRoutes } from "./routes/parts";
import { meRoutes } from "./routes/me";
import type { AuthEnv } from "./lib/auth-context";

const app = new Hono<AuthEnv>();

// CORS: explicit allow list. NEVER use `*` in production - it disables the
// browser's same-origin protections for credentialed requests and lets any
// site read responses on a victim's behalf. The `API_CORS_ORIGINS` env var
// is the single switch for what the deployed API trusts.
const corsOrigins = (process.env.API_CORS_ORIGINS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  "*",
  cors({
    origin: corsOrigins.length > 0 ? corsOrigins : ["http://localhost:3000", "http://localhost:3001"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
    maxAge: 600,
  }),
);

app.use("*", requestLogger);

app.route("/", healthRoutes);
app.route("/", partsRoutes);
app.route("/", meRoutes);

app.notFound((c) => fail(c, 404, "not_found", "Route not found"));

// Catch-all error handler. Stack traces never leave the server.
app.onError((err, c) => {
  console.error("[api] unhandled error:", err);
  return fail(c, 500, "server_error", "An unexpected error occurred");
});

const port = Number(process.env.API_PORT ?? 3000);

console.log(`[api] listening on http://localhost:${port}`);

export default {
  port,
  fetch: app.fetch,
};
