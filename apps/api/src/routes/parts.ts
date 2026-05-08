import { Hono } from "hono";
import { and, count, eq } from "drizzle-orm";
import { db, tables } from "@internship/db";
import { fail, ok } from "../lib/responses";
import { logAction } from "../lib/audit";
import { requireAuth } from "../middleware/requireAuth";
import { requireAdmin } from "../middleware/requireAdmin";
import {
  createPartSchema,
  paginationSchema,
  parseBody,
  updatePartSchema,
} from "../validation/schemas";
import type { AuthEnv } from "../lib/auth-context";

export const partsRoutes = new Hono<AuthEnv>();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------------------------------------------------------------------------
// Public reads
// ---------------------------------------------------------------------------

/**
 * GET /parts?page=1&pageSize=20[&category=Engine]
 * Public, paginated catalog listing.
 */
partsRoutes.get("/parts", async (c) => {
  const parsed = paginationSchema.safeParse({
    page: c.req.query("page"),
    pageSize: c.req.query("pageSize"),
  });
  if (!parsed.success) {
    return fail(c, 400, "validation_error", "Invalid pagination parameters");
  }
  const { page, pageSize } = parsed.data;
  const category = c.req.query("category");

  const where = category ? eq(tables.parts.category, category) : undefined;

  const [items, totalRow] = await Promise.all([
    db.query.parts.findMany({
      where,
      orderBy: (p, { desc }) => [desc(p.createdAt)],
      limit: pageSize,
      offset: (page - 1) * pageSize,
    }),
    db
      .select({ value: count() })
      .from(tables.parts)
      .where(where ?? undefined),
  ]);

  const total = totalRow[0]?.value ?? 0;

  return ok(c, { items, page, pageSize, total });
});

/**
 * GET /parts/:id
 * Public single fetch. Returns 404 if the id doesn't exist or isn't a UUID.
 */
partsRoutes.get("/parts/:id", async (c) => {
  const id = c.req.param("id");
  if (!id || !UUID_PATTERN.test(id)) {
    return fail(c, 404, "not_found", "Part not found");
  }
  const part = await db.query.parts.findFirst({ where: eq(tables.parts.id, id) });
  if (!part) {
    return fail(c, 404, "not_found", "Part not found");
  }
  return ok(c, part);
});

// ---------------------------------------------------------------------------
// Admin mutations
// ---------------------------------------------------------------------------

/**
 * POST /parts  (admin only)
 * Returns 201 with the created resource on success.
 */
partsRoutes.post("/parts", requireAuth, requireAdmin, async (c) => {
  const parsed = await parseBody(c, createPartSchema);
  if (parsed instanceof Response) return parsed;

  // partNumber is unique; surface the conflict cleanly.
  const existing = await db.query.parts.findFirst({
    where: eq(tables.parts.partNumber, parsed.partNumber),
    columns: { id: true },
  });
  if (existing) {
    return fail(c, 400, "conflict", "A part with that partNumber already exists");
  }

  const [created] = await db
    .insert(tables.parts)
    .values({
      name: parsed.name,
      partNumber: parsed.partNumber,
      description: parsed.description,
      price: parsed.price,
      category: parsed.category,
      inStock: parsed.inStock,
    })
    .returning();

  if (!created) {
    return fail(c, 500, "server_error", "Failed to create part");
  }

  await logAction({
    userId: c.get("user").id,
    action: "create_part",
    resourceType: "part",
    resourceId: created.id,
    metadata: { name: created.name, partNumber: created.partNumber },
  });

  return ok(c, created, 201);
});

/**
 * PATCH /parts/:id  (admin only)
 */
partsRoutes.patch("/parts/:id", requireAuth, requireAdmin, async (c) => {
  const id = c.req.param("id");
  if (!id || !UUID_PATTERN.test(id)) {
    return fail(c, 404, "not_found", "Part not found");
  }

  const parsed = await parseBody(c, updatePartSchema);
  if (parsed instanceof Response) return parsed;

  if (Object.keys(parsed).length === 0) {
    return fail(c, 400, "validation_error", "At least one field must be provided");
  }

  const [updated] = await db
    .update(tables.parts)
    .set({ ...parsed, updatedAt: new Date() })
    .where(eq(tables.parts.id, id))
    .returning();

  if (!updated) {
    return fail(c, 404, "not_found", "Part not found");
  }

  await logAction({
    userId: c.get("user").id,
    action: "update_part",
    resourceType: "part",
    resourceId: id,
    metadata: { fields: Object.keys(parsed) },
  });

  return ok(c, updated);
});

/**
 * DELETE /parts/:id  (admin only)
 */
partsRoutes.delete("/parts/:id", requireAuth, requireAdmin, async (c) => {
  const id = c.req.param("id");
  if (!id || !UUID_PATTERN.test(id)) {
    return fail(c, 404, "not_found", "Part not found");
  }

  const [deleted] = await db
    .delete(tables.parts)
    .where(eq(tables.parts.id, id))
    .returning({ id: tables.parts.id });

  if (!deleted) {
    return fail(c, 404, "not_found", "Part not found");
  }

  await logAction({
    userId: c.get("user").id,
    action: "delete_part",
    resourceType: "part",
    resourceId: id,
  });

  return ok(c, { id });
});

// Keep a private re-export of the matcher so other routes can reuse it.
export const isUuid = (s: string): boolean => UUID_PATTERN.test(s);
