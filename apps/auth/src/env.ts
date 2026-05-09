import { z } from "zod";

const envSchema = z.object({
  AUTH_PORT: z.coerce.number().int().positive().default(3001),
  BETTER_AUTH_TRUSTED_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_AUTH_PER_MIN: z.coerce.number().int().positive().default(40),
});

function parseOrigins(raw: string): string[] {
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (origins.some((origin) => origin === "*")) {
    throw new Error("BETTER_AUTH_TRUSTED_ORIGINS must not include '*' when credentials=true.");
  }

  return origins.length > 0 ? origins : ["http://localhost:3000", "http://localhost:3001"];
}

export type AuthEnvConfig = {
  port: number;
  trustedOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitAuthPerMin: number;
};

export function readAuthEnv(): AuthEnvConfig {
  const parsed = envSchema.parse(process.env);
  return {
    port: parsed.AUTH_PORT,
    trustedOrigins: parseOrigins(parsed.BETTER_AUTH_TRUSTED_ORIGINS),
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitAuthPerMin: parsed.RATE_LIMIT_AUTH_PER_MIN,
  };
}
