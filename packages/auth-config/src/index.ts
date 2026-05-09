/**
 * Shared Better Auth instance used by BOTH apps/auth and apps/api.
 *
 * Why share?
 *   apps/auth mounts the HTTP handler at /api/auth/* and serves sign-up,
 *   sign-in, etc.
 *
 *   apps/api never exposes those routes; it only calls
 *   `auth.api.getSession({ headers })` to verify a Bearer token presented
 *   by the client. Because Better Auth stores sessions in the database
 *   and both apps share the same DATABASE_URL + BETTER_AUTH_SECRET, the
 *   verifier side can validate any token issued by the auth side without
 *   any extra network hop.
 *
 * Auth method (confirmed by configuration below):
 *   - emailAndPassword: enabled (sign-up + sign-in via email + password)
 *   - bearer plugin:    enabled (Authorization: Bearer <session-token>)
 *   - admin plugin:     enabled (adds `role` to user; powers requireAdmin)
 *
 * Sessions are DB-backed (not stateless JWT). The bearer token IS the
 * session token; verification is a database lookup, not signature math.
 */

import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, bearer } from "better-auth/plugins";
import { db, schema } from "@internship/db";

export type AuthInstance = ReturnType<typeof createAuth>;

export interface CreateAuthOptions {
  /**
   * Public base URL of the auth server. Used to build callback URLs and
   * in CORS / cookie config. Defaults to the BETTER_AUTH_URL env var.
   */
  baseURL?: string;
  /** Comma-separated origins allowed to talk to the auth server. */
  trustedOrigins?: string[];
  /** Long random string. MUST match across apps/auth and apps/api. */
  secret?: string;
  /** Require email verification before login. */
  requireEmailVerification?: boolean;
}

function readBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  return value.toLowerCase() === "true";
}

function readEnv(): Required<CreateAuthOptions> {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "BETTER_AUTH_SECRET is missing or too short. Generate with `openssl rand -base64 32` and set it in .env.",
    );
  }

  const baseURL = process.env.BETTER_AUTH_URL ?? "http://localhost:3001";

  const trustedOrigins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const requireEmailVerification = readBoolean(process.env.AUTH_REQUIRE_EMAIL_VERIFICATION, false);

  return { secret, baseURL, trustedOrigins, requireEmailVerification };
}

export function createAuth(options: CreateAuthOptions = {}) {
  const env = readEnv();
  const requireEmailVerification =
    options.requireEmailVerification ?? env.requireEmailVerification;

  return betterAuth({
    appName: "internship-project",
    secret: options.secret ?? env.secret,
    baseURL: options.baseURL ?? env.baseURL,
    trustedOrigins: options.trustedOrigins ?? env.trustedOrigins,

    database: drizzleAdapter(db, {
      provider: "pg",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),

    emailAndPassword: {
      enabled: true,
      // 8 chars is the assignment-grade minimum; production should be higher.
      minPasswordLength: 8,
      maxPasswordLength: 128,
      requireEmailVerification,
      autoSignIn: true,
    },

    session: {
      // Tunable policy with secure defaults for assignment demos.
      expiresIn: Number(process.env.AUTH_SESSION_EXPIRES_IN_SECONDS ?? 60 * 60 * 24 * 7),
      updateAge: Number(process.env.AUTH_SESSION_UPDATE_AGE_SECONDS ?? 60 * 60 * 24),
    },

    plugins: [
      // Lets clients pass `Authorization: Bearer <token>` instead of
      // relying on cookies. Required by the assignment.
      bearer(),
      // Adds the `role` column we keyed requireAdmin on. Default role is "user".
      admin(),
    ],
  });
}
