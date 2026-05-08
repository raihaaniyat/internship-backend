import "./load-env";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Single shared Drizzle client + connection pool used by every consumer
 * (apps/auth, apps/api, migrations, seeds). Importing this module is the
 * only sanctioned way to talk to the database. The DATABASE_URL is
 * required at startup so misconfiguration fails loudly.
 */

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is not set. Copy .env.example to .env at the repo root and load it before starting the app.",
  );
}

// `max` is intentionally small for local dev; tune in production.
const queryClient = postgres(databaseUrl, { max: 10 });

export const db = drizzle(queryClient, { schema });
export { schema };
export type Database = typeof db;
