import { z } from "zod";

const envSchema = z.object({
  API_PORT: z.coerce.number().int().positive().default(3000),
  API_CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:3001"),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_PUBLIC_PER_MIN: z.coerce.number().int().positive().default(240),
  RATE_LIMIT_AUTH_PER_MIN: z.coerce.number().int().positive().default(120),
  RATE_LIMIT_WRITE_PER_MIN: z.coerce.number().int().positive().default(30),
});

function parseOrigins(raw: string): string[] {
  const origins = raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (origins.some((origin) => origin === "*")) {
    throw new Error("API_CORS_ORIGINS must not include '*' when credentials=true.");
  }

  return origins.length > 0 ? origins : ["http://localhost:3000", "http://localhost:3001"];
}

export type ApiEnvConfig = {
  port: number;
  corsOrigins: string[];
  rateLimitWindowMs: number;
  rateLimitPublicPerMin: number;
  rateLimitAuthPerMin: number;
  rateLimitWritePerMin: number;
};

export function readApiEnv(): ApiEnvConfig {
  const parsed = envSchema.parse(process.env);

  return {
    port: parsed.API_PORT,
    corsOrigins: parseOrigins(parsed.API_CORS_ORIGINS),
    rateLimitWindowMs: parsed.RATE_LIMIT_WINDOW_MS,
    rateLimitPublicPerMin: parsed.RATE_LIMIT_PUBLIC_PER_MIN,
    rateLimitAuthPerMin: parsed.RATE_LIMIT_AUTH_PER_MIN,
    rateLimitWritePerMin: parsed.RATE_LIMIT_WRITE_PER_MIN,
  };
}
