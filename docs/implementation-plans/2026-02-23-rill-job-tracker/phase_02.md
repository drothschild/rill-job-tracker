# Rill Job Tracker Implementation Plan - Phase 2

**Goal:** Password-based single-user authentication with session management

**Architecture:** Express middleware-based auth with bcrypt password hashing, SQLite-backed sessions, HTMX-compatible login flow

**Tech Stack:** Express, express-session, better-sqlite3-session-store, bcrypt

**Scope:** 8 phases from original design (phase 2 of 8)

**Codebase verified:** 2026-02-23 — Phase 1 creates Express server, SQLite database with settings table, all dependencies installed

---

## Acceptance Criteria Coverage

This phase implements and tests:

### rill-job-tracker.AC2: Authentication
- **rill-job-tracker.AC2.1 Success:** First-run setup screen allows setting initial password
- **rill-job-tracker.AC2.2 Success:** Login with correct password creates session and redirects to dashboard
- **rill-job-tracker.AC2.3 Success:** Session persists across page refreshes (cookie-based)
- **rill-job-tracker.AC2.4 Success:** Logout destroys session and redirects to login
- **rill-job-tracker.AC2.5 Success:** Password can be changed from settings
- **rill-job-tracker.AC2.6 Failure:** Login with wrong password returns error, no session created
- **rill-job-tracker.AC2.7 Failure:** All non-auth routes redirect to login when no valid session

---

<!-- START_TASK_1 -->
### Task 1: Add session middleware to Express server

**Files:**
- Modify: `src/server.ts`

**Implementation:**

Update `src/server.ts` to configure express-session with better-sqlite3-session-store. The session store uses the same SQLite database as the application. Add session middleware before any route handlers.

Key details:
- Import `express-session` and `better-sqlite3-session-store`
- The session store constructor takes the `session` module: `const SqliteStore = BetterSqlite3SessionStore(session)`
- Configure with: `secret` from `SESSION_SECRET` env var (default for dev), `resave: false`, `saveUninitialized: false`
- Cookie: `httpOnly: true`, `secure: false` (LAN app), `maxAge: 7 days`, `sameSite: 'lax'`
- The store takes the database instance from `getDb()` as `client`

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add session middleware with SQLite-backed store`
<!-- END_TASK_1 -->

<!-- START_SUBCOMPONENT_A (tasks 2-4) -->
<!-- START_TASK_2 -->
### Task 2: Create auth middleware

**Files:**
- Create: `src/middleware/auth.ts`

**Implementation:**

Create Express middleware that checks for a valid session on every request except specific auth paths. The middleware should:

1. Allow requests to `/auth/login`, `/auth/setup` (GET and POST) to pass through without auth
2. All other routes (including `/auth/change-password` and `/auth/logout`) require authentication
3. Check if `req.session.authenticated` is truthy
4. If not authenticated, check if a password has been set (query `settings` table for key `password_hash`)
5. If no password exists, redirect to `/auth/setup` (first-run)
6. If password exists but not authenticated, redirect to `/auth/login`

Declare the session type augmentation for TypeScript:

```typescript
declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
  }
}
```

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add auth middleware protecting all routes`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Create auth routes

**Files:**
- Create: `src/routes/auth.ts`

**Implementation:**

Create an Express Router with these routes:

**GET /auth/login** — Render login page HTML. If no password hash exists in settings, redirect to `/auth/setup`.

**GET /auth/setup** — Render first-run setup page HTML. If password hash already exists, redirect to `/auth/login`.

**POST /auth/setup** — First-run password creation:
- Read `password` and `confirm_password` from request body
- Validate they match and are not empty
- Hash with bcrypt (salt rounds: 10)
- Store hash in settings table with key `password_hash`
- Set `req.session.authenticated = true`
- Redirect to `/` (dashboard)

**POST /auth/login** — Login:
- Read `password` from request body
- Get `password_hash` from settings table
- Compare with `bcrypt.compare()`
- If match: set `req.session.authenticated = true`, redirect to `/`
- If no match: re-render login page with error message

**POST /auth/logout** — Logout:
- Call `req.session.destroy()`
- Redirect to `/auth/login`

**POST /auth/change-password** — Change password (requires authenticated session):
- Read `current_password`, `new_password`, `confirm_password` from body
- Verify current password with bcrypt.compare
- Validate new passwords match
- Hash and update in settings table
- Respond with success message

The login and setup pages should be simple HTML with a form. Use inline styles or basic HTML for now (TailwindCSS comes in Phase 8). Each page is a full HTML document.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add auth routes for login, setup, logout, and password change`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: Wire auth into server and test

**Verifies:** rill-job-tracker.AC2.1, rill-job-tracker.AC2.2, rill-job-tracker.AC2.3, rill-job-tracker.AC2.4, rill-job-tracker.AC2.5, rill-job-tracker.AC2.6, rill-job-tracker.AC2.7

**Files:**
- Modify: `src/server.ts`
- Test: `tests/auth.test.ts`

**Implementation:**

Update `src/server.ts` to:
1. Import and use the auth middleware (after session middleware, before routes)
2. Import and mount auth routes at `/auth`
3. Add a temporary root route that returns a simple "Dashboard placeholder" page (will be replaced in Phase 6)

**Testing:**

Tests must verify each AC listed above:
- rill-job-tracker.AC2.1: POST /auth/setup with matching passwords creates password hash in settings table and redirects
- rill-job-tracker.AC2.2: POST /auth/login with correct password sets session and redirects to /
- rill-job-tracker.AC2.3: After login, subsequent requests to protected routes succeed (cookie maintained)
- rill-job-tracker.AC2.4: POST /auth/logout destroys session, subsequent requests redirect to /auth/login
- rill-job-tracker.AC2.5: POST /auth/change-password with valid current password updates the hash
- rill-job-tracker.AC2.6: POST /auth/login with wrong password returns error, no session created
- rill-job-tracker.AC2.7: GET / without session redirects to /auth/setup (first run) or /auth/login (password exists)

Use supertest for HTTP-level integration tests against the Express app. Add `supertest` and `@types/supertest` as dev dependencies. Use a test database (different path from production) initialized fresh for each test.

Follow project testing patterns. Task-implementor generates actual test code at execution time.

**Verification:**

```bash
npx tsx tests/auth.test.ts
```

Expected: All tests pass.

**Commit:** `feat: wire auth middleware and routes into server`
<!-- END_TASK_4 -->
<!-- END_SUBCOMPONENT_A -->
