/**
 * apps/auth: Better Auth HTTP server.
 *
 * Responsibilities:
 *   - Expose all Better Auth routes under /api/auth/*
 *   - Health check at /health
 *   - CORS for the browser dev origins
 *
 * It does NOT serve any business logic. apps/api handles that.
 *
 * Routes mounted by Better Auth (the ones the assignment cares about):
 *   POST /api/auth/sign-up/email   { name, email, password }
 *   POST /api/auth/sign-in/email   { email, password }
 *   POST /api/auth/sign-out
 *   GET  /api/auth/get-session
 *
 * After a successful sign-in, the response carries a `set-auth-token`
 * header. That value is the Bearer token to use against apps/api as:
 *   Authorization: Bearer <token>
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { createAuth } from "@internship/auth-config";
import { readAuthEnv } from "./env";
import { securityHeaders } from "./middleware/securityHeaders";
import { createAuthRateLimiter } from "./middleware/rateLimit";

const auth = createAuth();
const config = readAuthEnv();

const app = new Hono();

app.use("*", logger());

// CORS: explicit origins, never `*` in production. We expose `set-auth-token`
// because the bearer plugin returns the bearer token in that header on
// successful sign-in, and the browser cannot read it otherwise.
app.use(
  "*",
  cors({
    origin: config.trustedOrigins,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    exposeHeaders: ["set-auth-token"],
    credentials: true,
    maxAge: 600,
  }),
);
app.use("*", securityHeaders);
app.use("/api/auth/*", createAuthRateLimiter(config.rateLimitAuthPerMin, config.rateLimitWindowMs));

app.get("/health", (c) =>
  c.json({
    data: { status: "ok", service: "auth" },
    meta: { timestamp: new Date().toISOString() },
  }),
);

// Mount Better Auth. Hono's `on(method, path, handler)` accepts a fetch-style
// handler; Better Auth's handler matches that signature exactly.
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));

const port = config.port;

console.log(`[auth] listening on http://localhost:${port}`);
console.log(`[auth] better-auth routes mounted at /api/auth/*`);

export default {
  port,
  fetch: app.fetch,
};
