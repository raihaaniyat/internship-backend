/**
 * All request-body validation lives here. Routes import the schema and
 * call `parseBody(c, schema)` so the 400 error shape is consistent.
 */

import type { Context } from "hono";
import { z } from "zod";
import { fail } from "../lib/responses";

export const createPartSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  partNumber: z
    .string()
    .min(1, "partNumber is required")
    .max(64)
    .regex(/^[A-Za-z0-9._-]+$/, "partNumber must be alphanumeric (._- allowed)"),
  description: z.string().max(2000).optional(),
  // Accept number or numeric string. Store as string to keep numeric precision.
  price: z
    .union([z.number(), z.string()])
    .transform((v) => (typeof v === "number" ? v.toFixed(2) : v))
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "price must be a positive decimal with up to 2 dp"),
  category: z.string().min(1).max(80),
  inStock: z.boolean().optional().default(true),
});

export const updatePartSchema = createPartSchema.partial();

export const createVehicleSchema = z.object({
  make: z.string().min(1).max(80),
  model: z.string().min(1).max(80),
  year: z.number().int().gte(1900).lte(new Date().getFullYear() + 1),
  trim: z.string().max(80).optional(),
});

export const savePartSchema = z.object({
  partId: z.string().uuid("partId must be a UUID"),
});

export const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
});

/**
 * Parse + validate a JSON body. On failure, returns a 400 response with
 * field-level error detail. On success, returns the parsed value.
 *
 * Usage:
 *   const parsed = await parseBody(c, createPartSchema);
 *   if (parsed instanceof Response) return parsed;
 *   // parsed is fully typed from here on
 */
export async function parseBody<T extends z.ZodTypeAny>(
  c: Context,
  schema: T,
): Promise<z.output<T> | Response> {
  let raw: unknown;
  try {
    raw = await c.req.json();
  } catch {
    return fail(c, 400, "invalid_json", "Request body must be valid JSON");
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    const fields: Record<string, string> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "_root";
      // Only keep the first message per field; anything more is noise on the wire.
      if (!(key in fields)) fields[key] = issue.message;
    }
    return fail(c, 400, "validation_error", "Request body failed validation", fields);
  }
  return result.data;
}
