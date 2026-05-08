/**
 * Single source of truth for API response shape. Every handler MUST go
 * through these helpers so the wire format is consistent.
 *
 * Success:  { data, meta: { timestamp } }
 * Error:    { error: <code>, message, [fields] }
 */

import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";

export type SuccessEnvelope<T> = {
  data: T;
  meta: { timestamp: string };
};

export type ErrorEnvelope = {
  error: string;
  message: string;
  fields?: Record<string, string>;
};

export function ok<T>(c: Context, data: T, status: ContentfulStatusCode = 200) {
  const body: SuccessEnvelope<T> = {
    data,
    meta: { timestamp: new Date().toISOString() },
  };
  return c.json(body, status);
}

export function fail(
  c: Context,
  status: ContentfulStatusCode,
  error: string,
  message: string,
  fields?: Record<string, string>,
) {
  const body: ErrorEnvelope = fields ? { error, message, fields } : { error, message };
  return c.json(body, status);
}
