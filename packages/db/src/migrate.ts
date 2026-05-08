import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Idempotent migration runner.
 *
 * Run with: `bun run db:migrate` from the repo root.
 *
 * We open a dedicated single-connection client for migrations so we never
 * leak a pool. Drizzle handles the migration journal table itself.
 */

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set.");
  }

  const migrationClient = postgres(databaseUrl, { max: 1 });
  const migrationDb = drizzle(migrationClient);

  console.log("[migrate] running migrations from ./drizzle ...");
  await migrate(migrationDb, { migrationsFolder: "./drizzle" });
  console.log("[migrate] done.");

  await migrationClient.end();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
