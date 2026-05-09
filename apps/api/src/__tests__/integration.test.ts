import { describe, expect, test } from "bun:test";
import apiServer from "../index";
import authServer from "../../../auth/src/index";

type JsonRecord = Record<string, unknown>;

async function signIn(email: string, password: string): Promise<string> {
  const req = new Request("http://localhost:3001/api/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const res = await authServer.fetch(req);
  expect(res.status).toBe(200);

  const token = res.headers.get("set-auth-token");
  if (!token) {
    throw new Error("sign-in response missing set-auth-token");
  }
  return token;
}

async function apiJson(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: JsonRecord }> {
  const req = new Request(`http://localhost:3000${path}`, init);
  const res = await apiServer.fetch(req);
  const body = (await res.json()) as JsonRecord;
  return { status: res.status, body };
}

describe("API integration", () => {
  test("GET /me without token returns 401 missing_token", async () => {
    const { status, body } = await apiJson("/me");
    expect(status).toBe(401);
    expect(body.error).toBe("missing_token");
  });

  test("GET /me with invalid token returns 401 invalid_token", async () => {
    const { status, body } = await apiJson("/me", {
      headers: { Authorization: "Bearer not-a-real-token" },
    });
    expect(status).toBe(401);
    expect(body.error).toBe("invalid_token");
  });

  test("GET /me with valid token returns 200", async () => {
    const userToken = await signIn("user@buyanyautopart.com", "User1234!");
    const { status, body } = await apiJson("/me", {
      headers: { Authorization: `Bearer ${userToken}` },
    });
    expect(status).toBe(200);
    expect((body.data as JsonRecord).email).toBe("user@buyanyautopart.com");
  });

  test("POST /parts blocks non-admin users with 403", async () => {
    const userToken = await signIn("user@buyanyautopart.com", "User1234!");
    const { status, body } = await apiJson("/parts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${userToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Unauthorized Attempt",
        partNumber: `NONADMIN-${Date.now()}`,
        price: 19.99,
        category: "Test",
      }),
    });
    expect(status).toBe(403);
    expect(body.error).toBe("forbidden");
  });

  test("POST /parts duplicate partNumber returns 409 conflict", async () => {
    const adminToken = await signIn("admin@buyanyautopart.com", "Admin1234!");
    const partNumber = `TEST-${Date.now()}`;

    const first = await apiJson("/parts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Integration Test Part",
        partNumber,
        price: 15.5,
        category: "Test",
        inStock: true,
      }),
    });
    expect(first.status).toBe(201);

    const second = await apiJson("/parts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${adminToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        name: "Integration Test Part Duplicate",
        partNumber,
        price: 20,
        category: "Test",
        inStock: true,
      }),
    });
    expect(second.status).toBe(409);
    expect(second.body.error).toBe("conflict");
  });
});
