# internship-project

A Bun monorepo containing two services for an auto parts marketplace:

- `apps/auth` issues sessions (Better Auth, email + password, bearer tokens)
- `apps/api` serves the protected catalog and per-user resources, validating
  tokens against the same database

Both apps share schema, types, and the Better Auth instance through workspace
packages, so token verification in `apps/api` does not duplicate any logic
from `apps/auth`.

## Architecture

```
            +-------------------+              +--------------------+
  client -->| apps/auth :3001   |  sign-up /   | apps/api :3000     |<-- client
            | Hono + Better Auth|  sign-in     | Hono + Drizzle     |
            +---------+---------+              +---------+----------+
                      |                                  |
                      |  reads/writes user, session,     |  reads session via
                      |  account, verification           |  shared Better Auth
                      v                                  v
            +-----------------------------------------------+
            |               PostgreSQL 16                   |
            |  user / session / account / verification      |  (Better Auth)
            |  parts / vehicles / saved_parts / audit_logs  |  (domain)
            +-----------------------------------------------+
                      ^
                      |
                      |
            +-------------------+        +--------------------+
            | packages/db       |<------>| packages/auth-config|
            | Drizzle schema    |        | createAuth() factory|
            | + client + seed   |        | (used by both apps) |
            +-------------------+        +--------------------+
```

Key design choices:

- One PostgreSQL database, shared by both apps. Session validation in
  `apps/api` is a database lookup (Better Auth uses DB-backed sessions, not
  stateless JWTs), so it works without a network call to `apps/auth`.
- One Drizzle schema in `packages/db` covers Better Auth's tables and the
  domain tables. Foreign keys (`vehicles.user_id`, `saved_parts.user_id`,
  `audit_logs.user_id`) point to Better Auth's `user.id`.
- `packages/auth-config` owns the Better Auth configuration and is consumed
  by both apps. The same `BETTER_AUTH_SECRET` and `DATABASE_URL` are read
  on both sides, so a token issued by `apps/auth` is valid in `apps/api`.

## Auth flow end to end

1. Client POSTs to `apps/auth` at `POST /api/auth/sign-up/email` with
   `{ name, email, password }`. Better Auth hashes the password, writes the
   `user` and `account` rows, and starts a session.
2. Client POSTs to `apps/auth` at `POST /api/auth/sign-in/email` with
   `{ email, password }`. Better Auth verifies, writes a fresh `session`
   row, and returns the bearer token in a response header named
   `set-auth-token`. The token is also returned in the JSON body's session
   metadata.
3. Client stores the token (Authorization header on every API call,
   localStorage if you must, never URL params).
4. Client calls `apps/api` with `Authorization: Bearer <token>`.
5. `apps/api`'s `requireAuth` middleware calls
   `auth.api.getSession({ headers })` from the shared Better Auth instance.
   The bearer plugin reads the token, looks up the session row, checks
   `expires_at`, and returns `{ user, session }` or `null`.
6. On success, `requireAuth` attaches the user (with role) and session to
   the Hono context. Downstream handlers read `c.var.user.id` and use it
   to scope every query.

## Token verification in apps/api

`apps/api/src/middleware/requireAuth.ts` is the only place that turns a
bearer token into a user. It returns one of four outcomes, each with a
distinct `error` code in the response body:

| Situation                                                | Status | error code      |
| -------------------------------------------------------- | ------ | --------------- |
| No `Authorization` header                                | 401    | `missing_token` |
| Header present but not `Bearer <token>` shape            | 401    | `invalid_token` |
| Bearer token shape ok, session not found                 | 401    | `invalid_token` |
| Session found but `expires_at` already in the past       | 401    | `token_expired` |
| Valid                                                    | 200    | (proceeds)      |

The middleware never includes DB errors, stack traces, or token contents
in any response.

`requireAdmin` is a separate middleware that runs after `requireAuth` and
only checks `c.var.user.role === "admin"`, returning 403 `forbidden`
otherwise. The role lives on the Better Auth `user` table via the
`admin` plugin, so we did not need a separate `user_profiles` table.

## Database tables

### Owned by Better Auth

| Table          | Purpose                                                                |
| -------------- | ---------------------------------------------------------------------- |
| `user`         | Identity. Has `role` ("user" or "admin") via the admin plugin.         |
| `session`      | One row per active login. `token` is the bearer value. Has `expires_at`.|
| `account`      | Provider link table. For email+password, holds the password hash.      |
| `verification` | Used by Better Auth for email verify, password reset tokens, etc.      |

### Domain tables

| Table         | Purpose                                                                  |
| ------------- | ------------------------------------------------------------------------ |
| `parts`       | Catalog. Public read, admin write.                                       |
| `vehicles`    | A user's saved garage (`user_id` FK to `user.id`).                       |
| `saved_parts` | A user's bookmarks. Unique on `(user_id, part_id)` so no duplicates.     |
| `audit_logs`  | Append-only record of mutating actions. `metadata` is jsonb.             |

All schema lives in `packages/db/src/schema.ts`. All migrations are
generated by `drizzle-kit` and live in `packages/db/drizzle/`.

## API reference

### Public

| Method | Path           | Auth | Body                                | Response                                                      |
| ------ | -------------- | ---- | ----------------------------------- | ------------------------------------------------------------- |
| GET    | `/health`      | none | -                                   | `{ data: { status, service }, meta }`                         |
| GET    | `/parts`       | none | query: `page`, `pageSize`, `category` | `{ data: { items, page, pageSize, total }, meta }`          |
| GET    | `/parts/:id`   | none | -                                   | `{ data: { ...part }, meta }` or `404 not_found`              |

### Authenticated user (Bearer required)

| Method | Path                       | Body                              | Response                                |
| ------ | -------------------------- | --------------------------------- | --------------------------------------- |
| GET    | `/me`                      | -                                 | `{ data: { id, email, name, role, ... }, meta }` |
| GET    | `/me/garage`               | -                                 | `{ data: { items }, meta }`             |
| POST   | `/me/garage`               | `{ make, model, year, trim? }`    | `201 { data: { ...vehicle }, meta }`    |
| DELETE | `/me/garage/:id`           | -                                 | `{ data: { id }, meta }` or 404         |
| GET    | `/me/saved-parts`          | -                                 | `{ data: { items: [{ bookmarkId, savedAt, part }] }, meta }` |
| POST   | `/me/saved-parts`          | `{ partId }`                      | `201 { data: { ...savedPart }, meta }`  |
| DELETE | `/me/saved-parts/:id`      | -                                 | `{ data: { id }, meta }` or 404         |

### Admin only

| Method | Path           | Body                                               | Response                                |
| ------ | -------------- | -------------------------------------------------- | --------------------------------------- |
| POST   | `/parts`       | `{ name, partNumber, price, category, description?, inStock? }` | `201 { data: { ...part }, meta }` |
| PATCH  | `/parts/:id`   | any subset of the create body                      | `{ data: { ...part }, meta }` or 404    |
| DELETE | `/parts/:id`   | -                                                  | `{ data: { id }, meta }` or 404         |

### Auth routes (mounted by Better Auth on apps/auth)

These are mounted at `/api/auth/*` by Better Auth itself; the assignment
deliverable is to discover and document the actual paths, not assume them:

| Method | Path                          | Body                          |
| ------ | ----------------------------- | ----------------------------- |
| POST   | `/api/auth/sign-up/email`     | `{ name, email, password }`   |
| POST   | `/api/auth/sign-in/email`     | `{ email, password }`         |
| POST   | `/api/auth/sign-out`          | (Authorization required)      |
| GET    | `/api/auth/get-session`       | (Authorization required)      |

### Error response shape

```json
{ "error": "validation_error", "message": "Request body failed validation", "fields": { "price": "price must be a positive decimal with up to 2 dp" } }
```

`fields` is only present for 400 validation errors.

## Local setup

```bash
# 1. Install dependencies
bun install

# 2. Wire up the repo's commit-msg hook (one-time, per clone)
git config core.hooksPath .githooks

# 3. Configure env
cp .env.example .env
# Then edit BETTER_AUTH_SECRET to something long and random:
#   openssl rand -base64 32

# 4. Start Postgres
docker compose -f docker-compose.development.yml up -d

# 5. Generate + apply migrations
bun run db:generate
bun run db:migrate

# 6. Seed users + parts
bun run db:seed

# 7. Start the servers (two terminals)
bun run auth:dev   # http://localhost:3001
bun run api:dev    # http://localhost:3000
```

### Test credentials (after seed)

| Role  | Email                          | Password    |
| ----- | ------------------------------ | ----------- |
| admin | `admin@buyanyautopart.com`     | `Admin1234!`|
| user  | `user@buyanyautopart.com`      | `User1234!` |

Override in `.env` via `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`,
`SEED_USER_EMAIL`, `SEED_USER_PASSWORD`.

## Testing guide

```bash
# 1. Start infra
docker compose -f docker-compose.development.yml up -d

# 2. Run migrations
bun run db:migrate

# 3. Seed
bun run db:seed

# 4. Start servers (two terminals)
bun run auth:dev
bun run api:dev

# 5. Sign up a fresh user
curl -i -X POST http://localhost:3001/api/auth/sign-up/email \
  -H "Content-Type: application/json" \
  -d '{"name": "Alice", "email": "alice@example.com", "password": "Alice1234!"}'

# 6. Sign in (capture the bearer token)
#    The token is returned in the `set-auth-token` response HEADER.
#    Use -i to see headers; copy the value of `set-auth-token`.
curl -i -X POST http://localhost:3001/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "alice@example.com", "password": "Alice1234!"}'

# Save it:
TOKEN="paste-set-auth-token-value-here"

# 7. No token -> expect 401 missing_token
curl -i http://localhost:3000/me

# 8. Invalid token -> expect 401 invalid_token
curl -i -H "Authorization: Bearer notarealtoken" http://localhost:3000/me

# 9. Valid token -> expect 200
curl -i -H "Authorization: Bearer $TOKEN" http://localhost:3000/me

# 10. Sign in as the seeded admin
curl -i -X POST http://localhost:3001/api/auth/sign-in/email \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@buyanyautopart.com", "password": "Admin1234!"}'
ADMIN_TOKEN="paste-set-auth-token-value-here"

# 11. Admin creates a part -> expect 201
curl -i -X POST http://localhost:3000/parts \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Oil Filter", "partNumber": "OF-9999", "price": 12.99, "category": "Engine", "inStock": true}'

# 12. Non-admin tries to create a part -> expect 403 forbidden
curl -i -X POST http://localhost:3000/parts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Oil Filter", "partNumber": "OF-8888", "price": 12.99, "category": "Engine", "inStock": true}'

# 13. List parts (public) -> expect 200
curl -i 'http://localhost:3000/parts?page=1&pageSize=20'

# 14. Add a vehicle to the user's garage
curl -i -X POST http://localhost:3000/me/garage \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"make": "Honda", "model": "Civic", "year": 2018, "trim": "EX"}'

# 15. Bookmark a part (use a partId from /parts)
curl -i -X POST http://localhost:3000/me/saved-parts \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"partId": "PASTE_UUID_FROM_/parts"}'
```

## What is intentionally out of scope

These are flagged as known limitations, not bugs:

- No email delivery. `requireEmailVerification` is off so the assignment
  is testable without an SMTP server. Production should turn it on and
  wire up an email provider.
- No refresh-token rotation. Better Auth's session lifetime + rolling
  refresh handles the assignment cleanly; production may want shorter
  access tokens plus rotation.
- No rate limiting. A reverse proxy or `hono/rate-limiter` would do this
  in production. The middleware seam is in place for it.
- No automated test suite. The `curl` script in this README is the
  testing surface for the assignment. A real project would add Vitest /
  Bun test plus a test database.
- CORS is configured for `http://localhost:3000` and `:3001` in dev. The
  comments in both `apps/*/src/index.ts` flag the production rule:
  origins must be explicit, never `*`, because `*` plus credentials lets
  any site read responses on a victim's behalf.
- Admin promotion in production should NOT be done by the seed script.
  It should be a deliberate operator action (CLI command or a one-off
  migration) gated by ops review.

## Layout

```
internship-project/
  apps/
    auth/            # Hono server hosting Better Auth
    api/             # Hono server with requireAuth + requireAdmin
  packages/
    db/              # Drizzle schema + client + migrate + seed
    auth-config/     # Shared Better Auth factory
  docker-compose.development.yml
  .env.example
  package.json       # Bun workspaces
```
