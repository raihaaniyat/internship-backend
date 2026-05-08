/**
 * Shared Hono Variables typing for authenticated request context.
 * `requireAuth` populates these; downstream handlers read them.
 */

export interface AuthedUser {
  id: string;
  email: string;
  name: string;
  role: string;
  emailVerified: boolean;
}

export interface AuthedSession {
  id: string;
  token: string;
  userId: string;
  expiresAt: Date;
}

export type AuthVariables = {
  user: AuthedUser;
  session: AuthedSession;
};

export type AuthEnv = { Variables: AuthVariables };
