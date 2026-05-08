import { Hono } from "hono";
import { ok } from "../lib/responses";

export const healthRoutes = new Hono();

/**
 * GET /health
 * Public liveness probe. No auth, no DB hit. Useful for k8s readiness.
 */
healthRoutes.get("/health", (c) => ok(c, { status: "ok", service: "api" }));
