/**
 * Seed script.
 *
 * Users are created through Better Auth's signUpEmail API. We DO NOT
 * insert plaintext passwords directly: doing so would bypass Better
 * Auth's hashing pipeline and produce broken accounts that cannot sign
 * in. After sign-up, we update the admin user's `role` column to
 * "admin" via Drizzle. The admin plugin only reads from this column,
 * so this is safe.
 *
 * Parts are non-auth data and are inserted via Drizzle directly.
 *
 * Idempotent: re-running is safe. Existing emails / part numbers are
 * skipped instead of erroring.
 */

import "./load-env";
import { eq } from "drizzle-orm";
import { createAuth } from "@internship/auth-config";
import { db, tables } from "./index";

interface SeedUser {
  name: string;
  email: string;
  password: string;
  role: "admin" | "user";
}

const seedUsers: SeedUser[] = [
  {
    name: "Admin User",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@buyanyautopart.com",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin1234!",
    role: "admin",
  },
  {
    name: "Test User",
    email: process.env.SEED_USER_EMAIL ?? "user@buyanyautopart.com",
    password: process.env.SEED_USER_PASSWORD ?? "User1234!",
    role: "user",
  },
];

const seedParts = [
  {
    name: "Premium Oil Filter",
    partNumber: "OF-1001",
    description: "High-flow synthetic oil filter for 4-cylinder engines.",
    price: "12.99",
    category: "Engine",
    inStock: true,
  },
  {
    name: "Brake Pad Set (Front)",
    partNumber: "BP-2002",
    description: "Ceramic front brake pad set, low dust.",
    price: "49.50",
    category: "Brakes",
    inStock: true,
  },
  {
    name: "Spark Plug 4-Pack",
    partNumber: "SP-3003",
    description: "Iridium spark plugs, pack of 4.",
    price: "32.00",
    category: "Engine",
    inStock: true,
  },
  {
    name: "Cabin Air Filter",
    partNumber: "CF-4004",
    description: "Activated-carbon cabin air filter.",
    price: "18.75",
    category: "HVAC",
    inStock: true,
  },
  {
    name: "Halogen Headlight Bulb",
    partNumber: "HB-5005",
    description: "H7 halogen headlight bulb, 55W.",
    price: "9.99",
    category: "Lighting",
    inStock: false,
  },
];

async function seedUser(auth: ReturnType<typeof createAuth>, u: SeedUser): Promise<string> {
  const existing = await db.query.user.findFirst({
    where: eq(tables.user.email, u.email),
    columns: { id: true, role: true },
  });

  if (existing) {
    console.log(`[seed] user ${u.email} already exists (id=${existing.id})`);
    if (existing.role !== u.role) {
      await db.update(tables.user).set({ role: u.role }).where(eq(tables.user.id, existing.id));
      console.log(`[seed] updated ${u.email} role -> ${u.role}`);
    }
    return existing.id;
  }

  // signUpEmail goes through Better Auth's password hashing pipeline.
  const result = await auth.api.signUpEmail({
    body: { name: u.name, email: u.email, password: u.password },
  });

  const userId = result.user.id;

  if (u.role !== "user") {
    await db.update(tables.user).set({ role: u.role }).where(eq(tables.user.id, userId));
  }

  console.log(`[seed] created user ${u.email} (id=${userId}, role=${u.role})`);
  return userId;
}

async function seedPartsTable(): Promise<void> {
  for (const p of seedParts) {
    const existing = await db.query.parts.findFirst({
      where: eq(tables.parts.partNumber, p.partNumber),
      columns: { id: true },
    });
    if (existing) {
      console.log(`[seed] part ${p.partNumber} already exists, skipping`);
      continue;
    }
    const [created] = await db.insert(tables.parts).values(p).returning({ id: tables.parts.id });
    console.log(`[seed] created part ${p.partNumber} (id=${created?.id})`);
  }
}

async function main(): Promise<void> {
  const auth = createAuth();

  console.log("[seed] users ...");
  for (const u of seedUsers) {
    await seedUser(auth, u);
  }

  console.log("[seed] parts ...");
  await seedPartsTable();

  console.log("[seed] done.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
