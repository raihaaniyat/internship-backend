/**
 * requireAuth: validates a bearer token against Better Auth's session store.
 *
 * The token IS the session token (Better Auth's session row holds
 * `expiresAt`). We use the shared Better Auth instance to validate, then
 * fall back to a direct DB lookup if validation fails so we can
 * distinguish expired tokens from invalid ones.
 *
 * Error contract (matches assignment spec):
 *   401 missing_token   { error: "missing_token",  message: "Authorization header is required" }
 *   401 invalid_token   { error: "invalid_token",  message: "Token is malformed" | "Token is invalid" }
 *   401 token_expired   { error: "token_expired",  message: "Token has expired" }
 *
 * On success we set `c.var.user` and `c.var.session`. We never leak DB
 * errors or stack traces to the client.
 */

import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import { createAuth } from "@internship/auth-config";
import { db, tables } from "@internship/db";
import { fail } from "../lib/responses";
import type { AuthEnv } from "../lib/auth-context";

const auth = createAuth();

const BEARER_PATTERN = /^Bearer\s+([A-Za-z0-9._\-+/=]+)$/;

export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  const headerValue = c.req.header("authorization") ?? c.req.header("Authorization");

  if (!headerValue) {
    return fail(c, 401, "missing_token", "Authorization header is required");
  }

  const match = BEARER_PATTERN.exec(headerValue);
  if (!match) {
    return fail(c, 401, "invalid_token", "Token is malformed");
  }
  const token = match[1] ?? "";

  let result: Awaited<ReturnType<typeof auth.api.getSession>> = null;
  try {
    result = await auth.api.getSession({ headers: c.req.raw.headers });
  } catch (err) {
    console.error("[requireAuth] getSession threw:", err);
    return fail(c, 401, "invalid_token", "Token is invalid");
  }

  if (result && result.session && result.user) {
    c.set("session", {
      id: result.session.id,
      token: result.session.token,
      userId: result.session.userId,
      expiresAt: new Date(result.session.expiresAt),
    });
    c.set("user", {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
      // admin plugin guarantees `role` exists with a default of "user".
      role: (result.user as { role?: string }).role ?? "user",
      emailVerified: result.user.emailVerified,
    });
    return next();
  }

  // getSession returned null. Disambiguate expired vs invalid by hitting
  // the session row directly. We never include the row's contents in the
  // response, only the boolean outcome.
  try {
    const row = await db.query.session.findFirst({
      where: eq(tables.session.token, token),
      columns: { expiresAt: true },
    });

    if (row && row.expiresAt.getTime() < Date.now()) {
      return fail(c, 401, "token_expired", "Token has expired");
    }
  } catch (err) {
    console.error("[requireAuth] session lookup failed:", err);
    // Fall through to invalid_token; never leak DB errors.
  }

  return fail(c, 401, "invalid_token", "Token is invalid");
}
