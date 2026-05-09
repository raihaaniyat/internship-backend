import type {
  ApiResult,
  PaginatedResponse,
  Part,
  SavedPart,
  User,
  Vehicle,
} from "./types";
import { normalizePartPrice } from "./utils";

export const AUTH_BASE =
  process.env.NEXT_PUBLIC_AUTH_BASE_URL ?? "http://localhost:3001";
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3000";

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

async function readJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function toResult<T>(res: Response): Promise<ApiResult<T>> {
  const body = (await readJsonSafe(res)) as Record<string, unknown> | null;
  if (res.ok) {
    const data = (body && "data" in body ? body.data : body) as T;
    return { ok: true, status: res.status, data };
  }
  const error =
    (body && typeof body === "object" && (body.error as string)) || "request_failed";
  const message =
    (body && typeof body === "object" && (body.message as string)) ||
    `Request failed with ${res.status}`;
  const fields =
    body && typeof body === "object" && body.fields
      ? (body.fields as Record<string, string>)
      : undefined;
  return { ok: false, status: res.status, error, message, fields };
}

async function api<T>(
  path: string,
  token: string | null,
  init: RequestInit = {},
): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers ?? {});
  if (!headers.has("content-type") && init.body) {
    headers.set("content-type", "application/json");
  }
  if (token) headers.set("authorization", `Bearer ${token}`);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, headers });
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: "network_error",
      message: err instanceof Error ? err.message : "Network unreachable",
    };
  }
  return toResult<T>(res);
}

function normalizePart(part: Part): Part {
  return { ...part, price: normalizePartPrice(part.price) };
}

function mapPaginatedParts(
  result: ApiResult<PaginatedResponse<Part>>,
): ApiResult<PaginatedResponse<Part>> {
  if (!result.ok) return result;
  return {
    ...result,
    data: {
      ...result.data,
      items: result.data.items.map(normalizePart),
    },
  };
}

function mapPartResult(result: ApiResult<Part>): ApiResult<Part> {
  if (!result.ok) return result;
  return { ...result, data: normalizePart(result.data) };
}

function mapSavedPartsResult(
  result: ApiResult<{ items: SavedPart[] }>,
): ApiResult<{ items: SavedPart[] }> {
  if (!result.ok) return result;
  return {
    ...result,
    data: {
      items: result.data.items.map((item) => ({
        ...item,
        part: normalizePart(item.part),
      })),
    },
  };
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthSuccess {
  token: string;
  user: { id: string; email: string; name?: string | null };
}

async function authPost(
  path: string,
  body: Record<string, unknown>,
): Promise<ApiResult<AuthSuccess>> {
  let res: Response;
  try {
    res = await fetch(`${AUTH_BASE}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Auth server unreachable";
    const hint =
      msg === "Failed to fetch"
        ? " Is apps/auth running? If you use 127.0.0.1 in the browser, add that origin to BETTER_AUTH_TRUSTED_ORIGINS and restart auth."
        : "";
    return {
      ok: false,
      status: 0,
      error: "network_error",
      message: `${msg}.${hint}`,
    };
  }

  const token = res.headers.get("set-auth-token") ?? "";
  const json = (await readJsonSafe(res)) as Record<string, unknown> | null;

  if (!res.ok) {
    const message =
      (json && (json.message as string)) ||
      (json && (json.error as string)) ||
      `Auth request failed with ${res.status}`;
    return {
      ok: false,
      status: res.status,
      error: (json?.error as string) ?? "auth_error",
      message,
    };
  }

  if (!token) {
    return {
      ok: false,
      status: res.status,
      error: "missing_token",
      message:
        "Sign-in succeeded but no bearer token was returned. Check that this origin is in BETTER_AUTH_TRUSTED_ORIGINS and that the auth server exposes 'set-auth-token'.",
    };
  }

  const user =
    (json && (json.user as AuthSuccess["user"])) ??
    ({ id: "", email: "" } as AuthSuccess["user"]);
  return { ok: true, status: res.status, data: { token, user } };
}

export function signUp(name: string, email: string, password: string) {
  return authPost("/api/auth/sign-up/email", { name, email, password });
}

export function signIn(email: string, password: string) {
  return authPost("/api/auth/sign-in/email", { email, password });
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthResult {
  ok: boolean;
  status: number;
  service?: string;
  latencyMs: number;
  error?: string;
}

async function pingHealth(base: string, service: string): Promise<HealthResult> {
  const start = performance.now();
  try {
    const res = await fetch(`${base}/health`, { cache: "no-store" });
    const latencyMs = Math.round(performance.now() - start);
    if (!res.ok) {
      return { ok: false, status: res.status, latencyMs, error: `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, service, latencyMs };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - start);
    const msg = err instanceof Error ? err.message : "unreachable";
    const hint =
      msg === "Failed to fetch"
        ? " — nothing is listening (start `bun run auth:dev` / `bun run api:dev`)"
        : "";
    return {
      ok: false,
      status: 0,
      latencyMs,
      error: `${msg}${hint}`,
    };
  }
}

export function pingApi() {
  return pingHealth(API_BASE, "api");
}

export function pingAuth() {
  return pingHealth(AUTH_BASE, "auth");
}

// ---------------------------------------------------------------------------
// Resources
// ---------------------------------------------------------------------------

export function getMe(token: string) {
  return api<User>("/me", token);
}

export function listParts(
  token: string | null,
  params: { page?: number; pageSize?: number; category?: string } = {},
) {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.pageSize) query.set("pageSize", String(params.pageSize));
  if (params.category) query.set("category", params.category);
  const qs = query.toString();
  return api<PaginatedResponse<Part>>(`/parts${qs ? `?${qs}` : ""}`, token).then(
    mapPaginatedParts,
  );
}

export function getPart(id: string, token: string | null) {
  return api<Part>(`/parts/${id}`, token).then(mapPartResult);
}

export function createPart(token: string, body: {
  name: string;
  partNumber: string;
  description?: string;
  price: number;
  category?: string;
  inStock?: boolean;
}) {
  return api<Part>("/parts", token, {
    method: "POST",
    body: JSON.stringify(body),
  }).then(mapPartResult);
}

export function updatePart(
  token: string,
  id: string,
  body: Partial<{
    name: string;
    partNumber: string;
    description: string;
    price: number;
    category: string;
    inStock: boolean;
  }>,
) {
  return api<Part>(`/parts/${id}`, token, {
    method: "PATCH",
    body: JSON.stringify(body),
  }).then(mapPartResult);
}

export function deletePart(token: string, id: string) {
  return api<{ id: string }>(`/parts/${id}`, token, { method: "DELETE" });
}

export function listGarage(token: string) {
  return api<{ items: Vehicle[] }>("/me/garage", token);
}

export function addVehicle(
  token: string,
  body: { make: string; model: string; year: number; trim?: string },
) {
  return api<Vehicle>("/me/garage", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteVehicle(token: string, id: string) {
  return api<{ id: string }>(`/me/garage/${id}`, token, { method: "DELETE" });
}

export function listSavedParts(token: string) {
  return api<{ items: SavedPart[] }>("/me/saved-parts", token).then(
    mapSavedPartsResult,
  );
}

export function savePart(token: string, partId: string) {
  return api<{ id: string }>("/me/saved-parts", token, {
    method: "POST",
    body: JSON.stringify({ partId }),
  });
}

export function removeSavedPart(token: string, bookmarkId: string) {
  return api<{ id: string }>(`/me/saved-parts/${bookmarkId}`, token, {
    method: "DELETE",
  });
}
