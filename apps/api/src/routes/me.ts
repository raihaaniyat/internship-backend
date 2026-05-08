import { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import { db, tables } from "@internship/db";
import { fail, ok } from "../lib/responses";
import { logAction } from "../lib/audit";
import { requireAuth } from "../middleware/requireAuth";
import {
  createVehicleSchema,
  parseBody,
  savePartSchema,
} from "../validation/schemas";
import { isUuid } from "./parts";
import type { AuthEnv } from "../lib/auth-context";

/**
 * Every route in this router is user-scoped: queries are always
 * constrained by `userId = c.var.user.id`. There is no path that lets
 * a caller pass a userId from the request, intentionally.
 */
export const meRoutes = new Hono<AuthEnv>();

meRoutes.use("*", requireAuth);

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/**
 * GET /me
 * Returns the authenticated user's safe profile fields. Never returns the
 * password hash or session internals.
 */
meRoutes.get("/me", (c) => {
  const u = c.get("user");
  return ok(c, {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    emailVerified: u.emailVerified,
  });
});

// ---------------------------------------------------------------------------
// Garage (vehicles)
// ---------------------------------------------------------------------------

/**
 * GET /me/garage
 */
meRoutes.get("/me/garage", async (c) => {
  const userId = c.get("user").id;
  const items = await db.query.vehicles.findMany({
    where: eq(tables.vehicles.userId, userId),
    orderBy: (v, { desc }) => [desc(v.createdAt)],
  });
  return ok(c, { items });
});

/**
 * POST /me/garage
 */
meRoutes.post("/me/garage", async (c) => {
  const parsed = await parseBody(c, createVehicleSchema);
  if (parsed instanceof Response) return parsed;

  const userId = c.get("user").id;
  const [created] = await db
    .insert(tables.vehicles)
    .values({
      userId,
      make: parsed.make,
      model: parsed.model,
      year: parsed.year,
      trim: parsed.trim,
    })
    .returning();

  if (!created) {
    return fail(c, 500, "server_error", "Failed to add vehicle");
  }

  await logAction({
    userId,
    action: "add_vehicle",
    resourceType: "vehicle",
    resourceId: created.id,
    metadata: { make: created.make, model: created.model, year: created.year },
  });

  return ok(c, created, 201);
});

/**
 * DELETE /me/garage/:id
 *
 * The WHERE clause includes both id AND userId. A user can never delete
 * a vehicle that does not belong to them, even if they guess the id.
 */
meRoutes.delete("/me/garage/:id", async (c) => {
  const id = c.req.param("id");
  if (!id || !isUuid(id)) {
    return fail(c, 404, "not_found", "Vehicle not found");
  }
  const userId = c.get("user").id;

  const [deleted] = await db
    .delete(tables.vehicles)
    .where(and(eq(tables.vehicles.id, id), eq(tables.vehicles.userId, userId)))
    .returning({ id: tables.vehicles.id });

  if (!deleted) {
    return fail(c, 404, "not_found", "Vehicle not found");
  }

  await logAction({
    userId,
    action: "remove_vehicle",
    resourceType: "vehicle",
    resourceId: id,
  });

  return ok(c, { id });
});

// ---------------------------------------------------------------------------
// Saved parts (bookmarks)
// ---------------------------------------------------------------------------

/**
 * GET /me/saved-parts
 * Returns each bookmark with its joined Part details.
 */
meRoutes.get("/me/saved-parts", async (c) => {
  const userId = c.get("user").id;
  const items = await db
    .select({
      bookmarkId: tables.savedParts.id,
      savedAt: tables.savedParts.createdAt,
      part: tables.parts,
    })
    .from(tables.savedParts)
    .innerJoin(tables.parts, eq(tables.savedParts.partId, tables.parts.id))
    .where(eq(tables.savedParts.userId, userId))
    .orderBy(tables.savedParts.createdAt);

  return ok(c, { items });
});

/**
 * POST /me/saved-parts
 */
meRoutes.post("/me/saved-parts", async (c) => {
  const parsed = await parseBody(c, savePartSchema);
  if (parsed instanceof Response) return parsed;

  const userId = c.get("user").id;

  const part = await db.query.parts.findFirst({
    where: eq(tables.parts.id, parsed.partId),
    columns: { id: true },
  });
  if (!part) {
    return fail(c, 404, "not_found", "Part not found");
  }

  const existing = await db.query.savedParts.findFirst({
    where: and(eq(tables.savedParts.userId, userId), eq(tables.savedParts.partId, parsed.partId)),
    columns: { id: true },
  });
  if (existing) {
    return fail(c, 400, "conflict", "Part is already saved");
  }

  const [created] = await db
    .insert(tables.savedParts)
    .values({ userId, partId: parsed.partId })
    .returning();

  if (!created) {
    return fail(c, 500, "server_error", "Failed to save part");
  }

  await logAction({
    userId,
    action: "save_part",
    resourceType: "saved_part",
    resourceId: created.id,
    metadata: { partId: parsed.partId },
  });

  return ok(c, created, 201);
});

/**
 * DELETE /me/saved-parts/:id
 *
 * `:id` is the saved_parts row id (the bookmark id), not the part id.
 * Same id+userId guard as garage delete.
 */
meRoutes.delete("/me/saved-parts/:id", async (c) => {
  const id = c.req.param("id");
  if (!id || !isUuid(id)) {
    return fail(c, 404, "not_found", "Saved part not found");
  }
  const userId = c.get("user").id;

  const [deleted] = await db
    .delete(tables.savedParts)
    .where(and(eq(tables.savedParts.id, id), eq(tables.savedParts.userId, userId)))
    .returning({ id: tables.savedParts.id });

  if (!deleted) {
    return fail(c, 404, "not_found", "Saved part not found");
  }

  await logAction({
    userId,
    action: "remove_saved_part",
    resourceType: "saved_part",
    resourceId: id,
  });

  return ok(c, { id });
});
