# BuyAnyAutoPart · Internship backend (monorepo)

A **Bun** monorepo for an internship-style assignment: **Better Auth** on **`apps/auth`**, a **Hono + Drizzle** resource API on **`apps/api`**, and an optional **Next.js** demo UI on **`apps/web`**. Everything shares **one PostgreSQL database** and **`packages/auth-config`** so the API validates bearer tokens without duplicating auth logic.

---

## Table of contents

1. [What’s implemented](#whats-implemented-assignment-alignment)
2. [Architecture](#architecture)
   - [System context](#system-context-mermaid)
   - [Repository tree](#repository-structure-mermaid)
3. [Repository layout](#repository-layout)
4. [Prerequisites](#prerequisites)
5. [Quick start](#quick-start)
6. [Command reference](#command-reference)
7. [Environment variables](#environment-variables)
8. [Running services](#running-services)
9. [Database (migrations, seed, Drizzle Studio, pgAdmin)](#database-migrations-seed-drizzle-studio-pgadmin)
10. [Auth flow & token verification](#auth-flow--token-verification)
   - [Sign-in and protected API](#sign-in-and-protected-api-mermaid)
   - [requireAuth decision](#requireauth-decision-mermaid)
   - [Admin gate](#admin-route-gate-mermaid)
11. [API reference](#api-reference)
12. [Web app (`apps/web`)](#web-app-appsweb)
13. [Testing](#testing)
    - [Integration test harness](#integration-test-harness-mermaid)
14. [Manual checks (curl)](#manual-checks-curl)
15. [Reviewer demo (5–7 minutes)](#reviewer-demo-5--7-minutes)
16. [Troubleshooting](#troubleshooting)
17. [Author](#author)

---

## What’s implemented (assignment alignment)

| Requirement | Where / how |
|-------------|-------------|
| **Better Auth** with chosen methods | `packages/auth-config` — `emailAndPassword`, **bearer** plugin (session token as `Authorization: Bearer`), **admin** plugin (`role` on `user`). |
| **Tokens minted for the API** | DB-backed sessions; sign-in returns **`set-auth-token`** header; same `DATABASE_URL` + `BETTER_AUTH_SECRET` on auth and API. |
| **Auth HTTP routes** | `apps/auth` mounts Better Auth at **`/api/auth/*`** (sign-up, sign-in, sign-out, get-session, etc.). |
| **Resource endpoints** | `apps/api/src/routes/*` — `/parts`, `/me`, garage, saved parts, admin mutations; see [API reference](#api-reference). |
| **Protect routes; reject missing / invalid / expired** | `apps/api/src/middleware/requireAuth.ts` → `missing_token`, `invalid_token`, `token_expired`. |
| **Drizzle + Postgres** | `packages/db` — schema, migrations, `db.query` / `db.insert` in route handlers. |
| **Hardening (extra)** | CORS allow-lists, security headers, rate limiting, audit logging, integration tests. |
| **Demo UI (extra)** | `apps/web` — catalog, auth, `/status` diagnostics, emerald “BuyAnyAutoPart”-style theme. |

---

## Architecture

Diagrams use **[Mermaid](https://mermaid.js.org/)** — they render on GitHub/GitLab and in most Markdown previews (for example VS Code).

### System context (Mermaid)

```mermaid
flowchart TB
  subgraph Client["Client"]
    BR[Browser]
  end

  subgraph Services["Runtime services"]
    WEB["apps/web :3002 · Next.js"]
    AUTH["apps/auth :3001 · Hono + Better Auth"]
    API["apps/api :3000 · Hono + Drizzle"]
  end

  subgraph Shared["Shared packages"]
    CFG["packages/auth-config · createAuth()"]
    DBLIB["packages/db · Drizzle schema + client"]
  end

  PG[("PostgreSQL 16 · user, session, account, verification, parts, …")]

  BR --> WEB
  BR --> AUTH
  BR --> API
  WEB --> AUTH
  WEB --> API

  AUTH --> CFG
  AUTH --> DBLIB
  API --> CFG
  API --> DBLIB
  DBLIB --> PG
```

### Repository structure (Mermaid)

```mermaid
flowchart LR
  ROOT["internship-project"] --> APPS["apps/"]
  ROOT --> PKGS["packages/"]
  APPS --> APP_AUTH["auth/"]
  APPS --> APP_API["api/"]
  APPS --> APP_WEB["web/"]
  PKGS --> PKG_DB["db/"]
  PKGS --> PKG_AC["auth-config/"]
```

**Design choices**

- **One database** — Session validation in `apps/api` is a **database lookup** (not a stateless JWT verify against a secret alone). No extra HTTP hop to `apps/auth` at request time.
- **One schema** — `packages/db/src/schema.ts`: Better Auth tables + domain tables; FKs from `vehicles`, `saved_parts`, `audit_logs` to `user.id`.
- **Shared auth factory** — `packages/auth-config` is imported by both servers so configuration cannot drift.

---

## Repository layout

Text listing (see also the [repository Mermaid tree](#repository-structure-mermaid) above):

```
internship-project/
  apps/
    auth/                 # Hono + Better Auth (:3001)
    api/                  # Hono + requireAuth + Drizzle (:3000)
    web/                  # Next.js 15 demo UI (:3002)
  packages/
    db/                   # Drizzle schema, migrate, seed, drizzle-kit
    auth-config/          # betterAuth({ ... }) shared by auth + api
  docker-compose.development.yml
  .env.example
  package.json            # Bun workspaces + root scripts
```

---

## Prerequisites

- **Bun** `>= 1.1` (see [bun.sh](https://bun.sh))
- **Docker** (for PostgreSQL via Compose)
- **Node.js** (used by `apps/web` scripts to run the Next.js CLI reliably on all platforms)

---

## Quick start

```bash
# 1. Dependencies
bun install

# 2. Env (repo root)
cp .env.example .env
# Set BETTER_AUTH_SECRET to a long random value, e.g.:
#   openssl rand -base64 32

# 3. Postgres
docker compose -f docker-compose.development.yml up -d

# 4. Schema
bun run db:generate   # when you change schema; optional on fresh clone if migrations exist
bun run db:migrate
bun run db:seed

# 5. Three terminals — auth, API, web (see [Command reference](#command-reference))
bun run auth:dev      # http://localhost:3001
bun run api:dev       # http://localhost:3000
bun run web:dev       # http://localhost:3002
```

Full copy-paste tables (Docker, Bun, `npx` for **:3002**) are in **[Command reference](#command-reference)** below.

Optional (one-time hook):

```bash
git config core.hooksPath .githooks
```

---

## Command reference

Use this section as the single **uniform** list of commands. Unless noted, run **Bun** from the **repository root** (`internship-backend/`).

### Docker Compose (PostgreSQL)

| Action | Command |
|--------|---------|
| Start database (detached) | `docker compose -f docker-compose.development.yml up -d` |
| Stop containers | `docker compose -f docker-compose.development.yml down` |
| View logs (follow) | `docker compose -f docker-compose.development.yml logs -f` |

### Bun (monorepo root)

| Action | Command |
|--------|---------|
| Install dependencies | `bun install` |
| Auth server → `http://localhost:3001` | `bun run auth:dev` |
| API server → `http://localhost:3000` | `bun run api:dev` |
| Web UI → `http://localhost:3002` | `bun run web:dev` |
| Generate Drizzle migrations | `bun run db:generate` |
| Apply migrations | `bun run db:migrate` |
| Seed database | `bun run db:seed` |
| Drizzle Studio | `bun run db:studio` |
| Typecheck all workspaces | `bun run typecheck` |
| API tests (integration suite) | `bun run test` |
| API integration tests only | `bun run test:integration` |
| Clear Next.js build cache | `bun run --filter @internship/web clean` |

### Next.js on `http://localhost:3002` (`npx`)

The `bun run web:dev` script runs **`node …/next dev -p 3002 --turbopack`**. Equivalent **`npx`** invocations from **`apps/web`**:

```bash
cd apps/web
npx next dev -p 3002 --turbopack
```

Webpack dev (fallback):

```bash
cd apps/web
npx next dev -p 3002
```

**Windows (PowerShell)** if `npx` does not resolve:

```powershell
cd apps/web
./node_modules/.bin/next dev -p 3002 --turbopack
```

Or:

```powershell
cd apps/web
npx.cmd next dev -p 3002 --turbopack
```

Production build and serve on port 3002:

```bash
cd apps/web
npx next build
npx next start -p 3002
```

---

## Environment variables

Copy **`.env.example`** → **`.env`** at the **repository root**. Both `apps/auth` and `apps/api` load this via `packages/db/src/load-env.ts` and app `env` readers.

**Important**

- **`BETTER_AUTH_SECRET`** — Must be **identical** for `apps/auth` and `apps/api` (and ≥ 16 chars as enforced in auth-config).
- **`BETTER_AUTH_TRUSTED_ORIGINS`** and **`API_CORS_ORIGINS`** — Include **both** `http://localhost:3002` and `http://127.0.0.1:3002` (and the same for `:3000`/`:3001`) so the browser Origin matches how you open the site.

Illustrative excerpt from `.env.example`:

```env
DATABASE_URL=postgres://internship:internship_dev_password@localhost:5432/internship
BETTER_AUTH_SECRET=replace_me_with_a_long_random_string_at_least_32_chars
BETTER_AUTH_URL=http://localhost:3001
BETTER_AUTH_TRUSTED_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002
API_CORS_ORIGINS=http://localhost:3000,http://localhost:3001,http://localhost:3002,http://127.0.0.1:3000,http://127.0.0.1:3001,http://127.0.0.1:3002
AUTH_PORT=3001
API_PORT=3000
```

**Web overrides** (`apps/web/.env.local` optional) — must use the **same host** as the address bar:

```env
# apps/web/.env.example
# NEXT_PUBLIC_AUTH_BASE_URL=http://localhost:3001
# NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

---

## Running services

Root **`package.json`** scripts (Bun workspaces):

```json
{
  "scripts": {
    "auth:dev": "bun --filter @internship/auth-server dev",
    "api:dev": "bun --filter @internship/api dev",
    "web:dev": "bun --filter @internship/web dev",
    "db:generate": "bun --filter @internship/db db:generate",
    "db:migrate": "bun --filter @internship/db db:migrate",
    "db:seed": "bun --filter @internship/db db:seed",
    "db:studio": "bun --filter @internship/db db:studio",
    "typecheck": "bun --filter '*' typecheck",
    "test": "bun --filter @internship/api test",
    "test:integration": "bun --filter @internship/api test:integration"
  }
}
```

| Script | Purpose |
|--------|---------|
| `auth:dev` | Better Auth server |
| `api:dev` | Resource API |
| `web:dev` | Next.js UI (Turbopack dev) |
| `db:migrate` / `db:seed` | Apply migrations and seed users + parts |
| `db:studio` | Drizzle Studio (see below) |
| `test` | API **integration** tests (starts auth+api in-process) |
| `test:integration` | Same file, explicit filter |

---

## Database (migrations, seed, Drizzle Studio, pgAdmin)

- **Schema** — `packages/db/src/schema.ts`
- **Migrations** — `packages/db/drizzle/`
- **Migrate** — `bun run db:migrate` (uses `DATABASE_URL`)
- **Seed** — `bun run db:seed` (Better Auth users + catalog; see [Test credentials](#test-credentials-after-seed))

### Drizzle Studio

Not a folder in the repo — it is launched from **`packages/db`**:

```bash
bun run db:studio
```

Uses `packages/db/drizzle.config.ts` (loads root `.env` via `src/load-env.ts`). The CLI prints a URL (often `https://local.drizzle.studio`) — open it in the browser to inspect tables.

### pgAdmin (optional)

Useful for **live demos** and SQL. Connection (from Compose / `.env.example`):

| Field | Value |
|-------|--------|
| Host | `localhost` |
| Port | `5432` |
| Database | `internship` |
| Username | `internship` |
| Password | `internship_dev_password` |

**Tables to show**

- Better Auth: `user`, `session`, `account`, `verification`
- Domain: `parts`, `vehicles`, `saved_parts`, `audit_logs`

---

## Auth flow & token verification

### Sign-in and protected API (Mermaid)

```mermaid
sequenceDiagram
  autonumber
  actor U as Browser
  participant W as apps/web :3002
  participant A as apps/auth :3001
  participant P as apps/api :3000
  participant D as PostgreSQL

  Note over U,D: Optional: UI loads from Next.js; auth/API still work with curl.

  U->>A: POST /api/auth/sign-in/email JSON credentials
  A->>D: Verify password, write session row
  D-->>A: Session persisted
  A-->>U: 200 + set-auth-token header (bearer value)

  U->>P: GET /me + Authorization Bearer token
  P->>D: getSession / session lookup via shared Better Auth
  D-->>P: user + session if valid
  P-->>U: 200 profile JSON
```

### requireAuth decision (Mermaid)

```mermaid
flowchart TD
  START([Incoming request]) --> M{Protected route?}
  M -->|no| NEXT[Handler / public middleware chain]
  M -->|yes| H{Authorization<br/>header present?}
  H -->|no| E1[401 · missing_token]
  H -->|yes| F{Bearer token format}
  F -->|bad| E2[401 · invalid_token]
  F -->|ok| S[getSession + optional session row lookup]
  S --> V{Session valid and<br/>not expired?}
  V -->|expired| E3[401 · token_expired]
  V -->|missing / bad| E4[401 · invalid_token]
  V -->|ok| OK[Set c.var.user + c.var.session → next]
```

### Admin route gate (Mermaid)

```mermaid
flowchart LR
  subgraph chain["Middleware chain"]
    R1[requireAuth]
    R2[requireAdmin]
    H[Admin handler]
  end
  R1 -->|403 never here if unauthenticated| R2
  R2 -->|role === admin| H
  R2 -->|else| X[403 · forbidden]
```

### End-to-end flow (steps)

1. `POST /api/auth/sign-up/email` on **:3001** with `{ name, email, password }`.
2. `POST /api/auth/sign-in/email` — response header **`set-auth-token`** holds the bearer token (also reflected in JSON session metadata where applicable).
3. Client calls **:3000** with `Authorization: Bearer <token>`.
4. `requireAuth` uses **`auth.api.getSession({ headers })`** from `@internship/auth-config`; bearer plugin resolves the session row.
5. Handlers use **`c.var.user.id`** (and `role` for admin routes).

### Shared Better Auth configuration (excerpt)

From `packages/auth-config/src/index.ts`:

```ts
return betterAuth({
  appName: "internship-project",
  secret: options.secret ?? env.secret,
  baseURL: options.baseURL ?? env.baseURL,
  trustedOrigins: options.trustedOrigins ?? env.trustedOrigins,

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.user,
      session: schema.session,
      account: schema.account,
      verification: schema.verification,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    requireEmailVerification,
    autoSignIn: true,
  },

  session: {
    expiresIn: Number(process.env.AUTH_SESSION_EXPIRES_IN_SECONDS ?? 60 * 60 * 24 * 7),
    updateAge: Number(process.env.AUTH_SESSION_UPDATE_AGE_SECONDS ?? 60 * 60 * 24),
  },

  plugins: [bearer(), admin()],
});
```

### Auth server mount (`apps/auth`)

```ts
app.on(["GET", "POST"], "/api/auth/*", (c) => auth.handler(c.req.raw));
```

Documented routes include:

- `POST /api/auth/sign-up/email`
- `POST /api/auth/sign-in/email`
- `POST /api/auth/sign-out`
- `GET /api/auth/get-session`

### Token verification (`apps/api`)

| Situation | Status | `error` |
|-----------|--------|---------|
| No `Authorization` | 401 | `missing_token` |
| Not `Bearer <token>` | 401 | `invalid_token` |
| Unknown session | 401 | `invalid_token` |
| Session expired | 401 | `token_expired` |
| OK | (next) | — |

Excerpt from `apps/api/src/middleware/requireAuth.ts`:

```ts
export async function requireAuth(c: Context<AuthEnv>, next: Next) {
  const headerValue = c.req.header("authorization") ?? c.req.header("Authorization");

  if (!headerValue) {
    return fail(c, 401, "missing_token", "Authorization header is required");
  }

  const match = BEARER_PATTERN.exec(headerValue);
  if (!match) {
    return fail(c, 401, "invalid_token", "Token is malformed");
  }
  // ... getSession, then optional DB lookup for expired vs invalid ...
}
```

**Admin** — `requireAdmin` after `requireAuth`; **`403 forbidden`** if `role !== "admin"`.

---

## API reference

### Public

| Method | Path | Auth | Notes |
|--------|------|------|--------|
| GET | `/health` | none | |
| GET | `/parts` | none | Query: `page`, `pageSize`, `category` |
| GET | `/parts/:id` | none | UUID |

### Authenticated (`Authorization: Bearer`)

| Method | Path | Notes |
|--------|------|--------|
| GET | `/me` | Profile |
| GET/POST | `/me/garage` | Vehicles |
| DELETE | `/me/garage/:id` | |
| GET/POST | `/me/saved-parts` | Bookmarks |
| DELETE | `/me/saved-parts/:id` | |

### Admin only

| Method | Path | Notes |
|--------|------|--------|
| POST | `/parts` | Create |
| PATCH | `/parts/:id` | Update |
| DELETE | `/parts/:id` | Delete |

### Error shape

```json
{
  "error": "validation_error",
  "message": "Request body failed validation",
  "fields": { "price": "…" }
}
```

`fields` appears on **400** validation errors.

### API client: numeric `price` from Postgres

PostgreSQL **`numeric`** values may serialize as **strings** in JSON. The web client normalizes `part.price` to a number in `apps/web/lib/api.ts` after successful responses (using `normalizePartPrice` in `apps/web/lib/utils.ts`) so UI code can safely use `.toFixed(2)`.

---

## Web app (`apps/web`)

- **Stack** — Next.js 15 (App Router), React 19, Tailwind, shadcn-style components, **Inter** font, emerald **BuyAnyAutoPart**-inspired theme.
- **Ports** — `:3002` (Auth :3001 · API :3000).
- **Scripts** (`apps/web/package.json`):

```json
{
  "scripts": {
    "clean": "node -e \"require('node:fs').rmSync('.next',{recursive:true,force:true});\"",
    "dev": "node ./node_modules/next/dist/bin/next dev -p 3002 --turbopack",
    "dev:webpack": "node ./node_modules/next/dist/bin/next dev -p 3002",
    "build": "node ./node_modules/next/dist/bin/next build",
    "start": "node ./node_modules/next/dist/bin/next start -p 3002",
    "typecheck": "tsc --noEmit"
  }
}
```

**Why Node for `next`?** The CLI is spawned with **Node** so dev/prod builds behave consistently on Windows; **Turbopack** is the default dev bundler (`dev:webpack` available if needed).

**Footer** — Build attribution and link to the author site appear in the root layout.

**Main routes** — `/`, `/sign-in`, `/sign-up`, `/parts`, `/me`, `/admin` (role-gated), `/status` (diagnostics).

---

## Testing

### Integration test harness (Mermaid)

```mermaid
flowchart LR
  subgraph bun["bun test"]
    T[integration.test.ts]
    AS[auth app fetch]
    AP[api app fetch]
  end
  PG[(PostgreSQL)]
  T --> AS
  T --> AP
  AS --> PG
  AP --> PG
```

### Integration tests (`bun run test`)

Prerequisites: **Postgres up** and **`bun run db:seed`** (tests sign in as seeded users).

The suite imports the **auth** and **API** apps in-process and drives **`fetch()`** — you do **not** need separate terminals for `test`.

```bash
docker compose -f docker-compose.development.yml up -d
bun run db:migrate
bun run db:seed
bun run test
```

**What `bun run test` proves** (see `apps/api/src/__tests__/integration.test.ts`):

| Test | Expectation |
|------|-------------|
| `GET /me` without token | **401** `missing_token` |
| `GET /me` bogus bearer | **401** `invalid_token` |
| `GET /me` as seeded user | **200** |
| `POST /parts` as non-admin | **403** `forbidden` |
| `POST /parts` duplicate `partNumber` | **409** `conflict` |

```bash
bun run test           # all API tests
bun run test:integration   # integration file only
```

---

## Manual checks (curl)

Short cookbook (full flow). Replace tokens from `set-auth-token` after sign-in.

```bash
# Sign up
curl -i -X POST http://localhost:3001/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name":"Alice","email":"alice@example.com","password":"Alice1234!"}'

# Sign in — copy set-auth-token from headers
curl -i -X POST http://localhost:3001/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"Alice1234!"}'

TOKEN="paste-token-here"

curl -i http://localhost:3000/me
curl -i -H "Authorization: Bearer notarealtoken" http://localhost:3000/me
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:3000/me
curl -i 'http://localhost:3000/parts?page=1&pageSize=20'
```

Admin create part (after signing in as seeded admin):

```bash
curl -i -X POST http://localhost:3000/parts \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Oil Filter","partNumber":"OF-9999","price":12.99,"category":"Engine","inStock":true}'
```

---

### Test credentials (after seed)

| Role | Email | Password |
|------|-------|----------|
| admin | `admin@buyanyautopart.com` | `Admin1234!` |
| user | `user@buyanyautopart.com` | `User1234!` |

Override via `SEED_*` in `.env`.

### Hardening-related env (see `.env.example`)

- `AUTH_REQUIRE_EMAIL_VERIFICATION`
- `AUTH_SESSION_EXPIRES_IN_SECONDS` / `AUTH_SESSION_UPDATE_AGE_SECONDS`
- `RATE_LIMIT_*` — public / auth / write buckets

Both servers apply **strict CORS**, **security headers**, and **in-memory rate limiting** (`429 rate_limited`).

---

## Reviewer demo (5–7 minutes)

**Terminal 1 — database**

```powershell
docker compose -f docker-compose.development.yml up -d
bun run db:migrate
bun run db:seed
```

**Terminal 2 — auth**

```bash
bun run auth:dev
```

**Terminal 3 — API**

```bash
bun run api:dev
```

**Terminal 4 — web (`http://localhost:3002`)**

```bash
bun run web:dev
```

Alternative from `apps/web`: `npx next dev -p 3002 --turbopack` — see **[Command reference](#command-reference)**.

**UI walkthrough**

1. **Overview (`/`)** — System status / hero.
2. **Catalog (`/parts`)** — `GET /parts`, filters.
3. **Sign in (`/sign-in`)** — seeded admin; toast should confirm session.
4. **My account (`/me`)** — garage + saved parts.
5. **Admin (`/admin`)** — create/toggle/delete parts; repeat as normal user → **403** toast.
6. **System (`/status`)** — live probes: 401 without token, invalid token, 200 with token, admin gate.
7. **Automated proof** — `bun run test` shows **5** passing integration tests.

---

## Troubleshooting

### “Failed to fetch” in the browser

1. **Run** `auth:dev` and `api:dev` (and `web:dev` for the UI).
2. **Origins** — `BETTER_AUTH_TRUSTED_ORIGINS` and `API_CORS_ORIGINS` must include the exact Origin you use (`localhost` vs `127.0.0.1`). Restart auth + API after editing `.env`.
3. **CORP** — Dev uses **`cross-origin`** headers where configured so mixed localhost / 127.0.0.1 does not block `fetch`.

### Next.js: `Cannot find module './NNN.js'` or missing `prerender-manifest.json`

Usually a **corrupt or stale `.next` cache** (or multiple dev servers). **Stop** dev servers, then:

```bash
cd apps/web
bun run clean
bun run web:dev
```

Do not run two `next dev` instances on the same app folder.

### Port already in use (`EADDRINUSE :3002`)

Kill the old process or change the port in `apps/web` scripts **and** add the new web origin to CORS / trusted origins.

### `part.price.toFixed is not a function`

Fixed in the client by normalizing API `price` fields; if you bypass `apps/web/lib/api.ts`, coerce with `Number` / `parseFloat` yourself.

---

## Author

**Muhammad Raihaan Musharraf** — [https://raihaaan.com](https://raihaaan.com)

---

*README revision: full-stack documentation with setup, snippets, tests, web tooling, and troubleshooting aligned to the current monorepo.*
