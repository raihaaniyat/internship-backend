/**
 * requireAdmin: must be chained AFTER requireAuth.
 *
 * Reads `c.var.user.role` (populated by requireAuth) and rejects with
 * 403 if the role is not exactly "admin". This keeps role logic in
 * one place; routes only declare what they need.
 */

import type { Context, Next } from "hono";
import { fail } from "../lib/responses";
import type { AuthEnv } from "../lib/auth-context";

export async function requireAdmin(c: Context<AuthEnv>, next: Next) {
  const user = c.get("user");
  if (!user) {
    // Defensive guard. If you see this in logs, requireAdmin was wired
    // before requireAuth in the middleware chain and that is a bug.
    return fail(c, 401, "missing_token", "Authorization header is required");
  }
  if (user.role !== "admin") {
    return fail(c, 403, "forbidden", "Admin access required");
  }
  return next();
}
