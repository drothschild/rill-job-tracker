# Rill Job Tracker Design

## Summary

This project is a personal, self-hosted job application tracker built as a single Docker container running on a QNAP home server. It provides a mobile-first web UI for managing the full lifecycle of job applications: logging companies and contacts, moving applications through a fixed hiring pipeline, tracking interaction history, and receiving email reminders when follow-ups are due or applications have gone silent. The backend is a Node.js Express server using SQLite for persistence and HTMX for frontend interactions — the server renders HTML fragments that the browser swaps into the page directly, with no separate frontend build step or JSON API.

The distinguishing architectural choice is the use of Rill, a custom functional scripting language, as an embedded rule engine. Rather than writing business logic (which stage transitions are allowed, when an alert should fire, whether a salary range is valid) as plain TypeScript, those rules are written in `.lv` files and evaluated at runtime by the Rill interpreter. A thin bridge module handles converting JavaScript objects into Rill's type system and back. This keeps business rules isolated, human-readable, and hot-reloadable — editing a rule file takes effect immediately without restarting the server.

## Definition of Done

A self-hosted, Dockerized job application tracker running on a QNAP server that:

1. **Provides a polished mobile-first web UI** with a dashboard showing application stats (total apps, response rate, interview conversion), a visual pipeline view, and card-based job management
2. **Manages the full job application lifecycle** — CRUD for jobs (with company info, salary, contacts, notes, warm/cold tagging), fixed pipeline stages with custom sub-labels
3. **Sends email alerts via Gmail** when a follow-up is due or there's been no response in Y days
4. **Uses Rill as a DSL/rule engine** — business rules for stage transitions, alert conditions, and validation are written as Rill scripts evaluated by the Node.js backend
5. **Supports JSON export** of all application data

## Acceptance Criteria

### rill-job-tracker.AC1: Job lifecycle management
- **rill-job-tracker.AC1.1 Success:** Job can be created with all fields (company name, role, link, salary range, application type, job description snippet, location)
- **rill-job-tracker.AC1.2 Success:** Job can be edited and changes persist
- **rill-job-tracker.AC1.3 Success:** Contacts with notes can be added to a job with name, role, email, LinkedIn URL
- **rill-job-tracker.AC1.4 Success:** Interactions (call, email, note) can be logged per contact
- **rill-job-tracker.AC1.5 Success:** Freeform notes can be added per job
- **rill-job-tracker.AC1.6 Success:** Jobs can be tagged as warm (referral) or cold (blind)
- **rill-job-tracker.AC1.7 Success:** Jobs move through pipeline stages (Applied, Phone Screen, Interview, Offer, Rejected)
- **rill-job-tracker.AC1.8 Success:** Custom sub-labels can be added to stage transitions (e.g., "Technical Interview")
- **rill-job-tracker.AC1.9 Success:** Stage transition history is recorded with timestamps
- **rill-job-tracker.AC1.10 Success:** Dashboard shows total applications, response rate, and interview conversion rate
- **rill-job-tracker.AC1.11 Success:** Dashboard charts render on both mobile (375px) and desktop viewports
- **rill-job-tracker.AC1.12 Failure:** Invalid stage transitions are rejected (e.g., Applied directly to Offer)
- **rill-job-tracker.AC1.13 Failure:** Job creation with salary_min > salary_max is rejected

### rill-job-tracker.AC2: Authentication
- **rill-job-tracker.AC2.1 Success:** First-run setup screen allows setting initial password
- **rill-job-tracker.AC2.2 Success:** Login with correct password creates session and redirects to dashboard
- **rill-job-tracker.AC2.3 Success:** Session persists across page refreshes (cookie-based)
- **rill-job-tracker.AC2.4 Success:** Logout destroys session and redirects to login
- **rill-job-tracker.AC2.5 Success:** Password can be changed from settings
- **rill-job-tracker.AC2.6 Failure:** Login with wrong password returns error, no session created
- **rill-job-tracker.AC2.7 Failure:** All non-auth routes redirect to login when no valid session

### rill-job-tracker.AC3: Email alerts
- **rill-job-tracker.AC3.1 Success:** Email digest sent when follow-up date has passed on any active job
- **rill-job-tracker.AC3.2 Success:** Email digest sent when a job has had no response for Y days (configurable)
- **rill-job-tracker.AC3.3 Success:** Multiple alerts batched into single digest email
- **rill-job-tracker.AC3.4 Success:** Alert thresholds configurable from settings page
- **rill-job-tracker.AC3.5 Success:** Gmail SMTP credentials configurable from settings page
- **rill-job-tracker.AC3.6 Edge:** Same alert not re-sent within 24 hours for the same job
- **rill-job-tracker.AC3.7 Failure:** Alert scheduler continues running if Gmail credentials are invalid (logs error, does not crash)

### rill-job-tracker.AC4: Rill DSL rule engine
- **rill-job-tracker.AC4.1 Success:** Stage transition rules evaluated via Rill `.lv` file
- **rill-job-tracker.AC4.2 Success:** Alert conditions evaluated via Rill `.lv` file
- **rill-job-tracker.AC4.3 Success:** Input validation evaluated via Rill `.lv` file
- **rill-job-tracker.AC4.4 Success:** Dashboard metrics computed via Rill `.lv` file
- **rill-job-tracker.AC4.5 Success:** JS objects correctly convert to Rill Value types and back via bridge module
- **rill-job-tracker.AC4.6 Success:** Editing a `.lv` file changes behavior without server restart
- **rill-job-tracker.AC4.7 Failure:** Rill evaluation errors return meaningful error messages, do not crash server

### rill-job-tracker.AC5: JSON export
- **rill-job-tracker.AC5.1 Success:** Export downloads a JSON file containing all jobs with nested contacts, interactions, notes, and stage history
- **rill-job-tracker.AC5.2 Success:** Exported JSON is valid and parseable
- **rill-job-tracker.AC5.3 Edge:** Export with zero jobs returns valid empty JSON structure

## Glossary

- **Rill**: A custom functional scripting language with its own interpreter, developed locally at `/Users/davidrothschild/Projects/rill-lang/`. Used here as an embedded rule engine rather than a general-purpose language.
- **`.lv` file**: A Rill source file containing rules or logic written in the Rill DSL. The extension is specific to the Rill language.
- **DSL (Domain-Specific Language)**: A small language designed for a narrow purpose. Here, Rill is used as a DSL for expressing business rules rather than as a general application language.
- **Rule engine**: A component that evaluates a set of declarative rules against input data to produce a decision (allow/deny, pass/fail, compute a value). Rill fills this role in the architecture.
- **`runSource()`**: The Rill interpreter's public API entry point that accepts a Rill script string and an environment, evaluates it, and returns a result.
- **`createPrelude()`**: A Rill API function that constructs the base runtime environment (built-in functions and bindings) used as the starting point before injecting application data.
- **Rill `Value` types**: The internal type representations used by the Rill interpreter (e.g., `Int`, `Float`, `String`, `Bool`, `Record`, `List`). JavaScript data must be converted to these types before being passed into a Rill evaluation.
- **Bridge module** (`rill-bridge.ts`): The adapter layer that converts JavaScript objects into Rill `Value` types for injection, and converts Rill results back into JavaScript objects after evaluation.
- **HTMX**: A JavaScript library that lets the server return HTML fragments in response to user interactions. The browser swaps those fragments into the page, enabling dynamic UI without a dedicated frontend framework or JSON API.
- **Alpine.js**: A lightweight JavaScript library for adding client-side interactivity (e.g., drag-and-drop handlers) directly in HTML markup, without a build step.
- **HTMX partial**: An HTML fragment (not a full page) returned by the server in response to an HTMX request. HTMX replaces a specific DOM element with the fragment.
- **`HX-Request` header**: An HTTP header that HTMX automatically adds to its requests. The server checks for this header to decide whether to return a full page or just a partial fragment.
- **better-sqlite3**: A synchronous Node.js SQLite driver. Used here with WAL mode for the application database.
- **WAL mode (Write-Ahead Logging)**: A SQLite journal mode that improves read/write concurrency and reduces the chance of database corruption on unexpected shutdown.
- **node-cron**: A Node.js library for scheduling recurring tasks using cron expressions. Used to run the email alert checker on a regular interval.
- **Nodemailer**: A Node.js library for sending email. Used here with Gmail SMTP to deliver alert digest emails.
- **SMTP app password**: A Gmail-specific credential that allows a third-party application to send email via Gmail without using the account's main password. Required because Gmail blocks direct password authentication for SMTP.
- **bcrypt**: A password hashing algorithm designed to be slow in order to resist brute-force attacks. Used to hash the single-user login password stored in the settings table.
- **Pipeline stages**: The fixed set of states a job application can move through: Applied, Phone Screen, Interview, Offer, Rejected. These are seeded into the database and are not user-editable.
- **Sub-label**: A user-supplied tag attached to a specific stage transition (e.g., labeling an Interview stage move as "Technical Interview"). Stored in `stage_transitions` alongside the timestamp.
- **Warm / cold tagging**: A user-applied label indicating whether an application was submitted through a referral or personal connection (warm) versus submitted blindly with no prior relationship (cold).
- **Digest email**: A single email that batches multiple alerts together, rather than sending one email per alert.
- **Kanban board**: A visual layout where items (job cards) are arranged in columns representing their current stage. Drag-and-drop moves cards between columns.
- **Hot-reload**: The ability to change a file and have the running application pick up the change without restarting the server. Achieved here by reading `.lv` rule files from disk on each evaluation.
- **QNAP**: A brand of NAS (Network Attached Storage) device used here as a home server to host the Docker container.

## Architecture

Monolithic Node.js Express server running in a Docker container on QNAP. Serves both the JSON-less HTML API (server-rendered partials for HTMX) and static frontend assets from a single process.

**Components:**

- **Express server** (`src/server.ts`) — HTTP server, route registration, session middleware, static file serving
- **Routes** (`src/routes/`) — One file per resource: `auth.ts`, `jobs.ts`, `pipeline.ts`, `dashboard.ts`, `contacts.ts`, `settings.ts`, `export.ts`
- **Database layer** (`src/db/`) — better-sqlite3 with WAL mode. `schema.ts` for migrations, `queries.ts` for prepared statements
- **Rill bridge** (`src/rill/bridge.ts`) — Converts JS objects to Rill `Value` types and back. Imports `runSource()` and `createPrelude()` from the Rill project
- **Rill rules** (`rules/`) — `.lv` files: `transitions.lv`, `alerts.lv`, `validation.lv`, `dashboard.lv`
- **Alert scheduler** (`src/alerts/scheduler.ts`) — `node-cron` job that evaluates alert rules and sends digest emails via Nodemailer
- **Frontend** (`public/`) — HTML templates, TailwindCSS, vendored JS (HTMX, Alpine.js, Chart.js)
- **Views** (`src/views/`) — Server-side HTML template functions returning full pages or HTMX partials based on `HX-Request` header

**Data flow:** Browser sends HTMX request → Express route handler → queries SQLite → injects data into Rill rule via bridge → Rill evaluates and returns decision → handler renders HTML partial → HTMX swaps DOM.

**Rill integration:** Node.js imports Rill's `createPrelude()` to get a base environment, injects application data as Rill variables via `env.set()`, then calls `runSource()` with the rule script. A `rill-bridge.ts` module handles JS↔Rill type conversion (objects → Records, arrays → Lists, primitives → Int/Float/String/Bool). Rule files are read from disk on each evaluation for hot-reload capability.

## Existing Patterns

Investigation found no existing codebase — this is a greenfield project. The Rill language project at `/Users/davidrothschild/Projects/rill-lang/` provides the interpreter.

**Rill integration pattern:** Rill exposes a clean API via `runSource()` in `src/runner.ts` and `createPrelude()` in `src/prelude.ts`. The evaluator accepts a custom environment `Map<string, Value>`, enabling host data injection without modifying Rill source. This is the integration surface the bridge module uses.

**New patterns introduced:**
- Express + HTMX server-rendered partial pattern (routes return HTML fragments, not JSON)
- Rill as embedded rule engine (`.lv` files evaluated at runtime with injected context)
- Single-table settings pattern (one row, keyed config values)

## Implementation Phases

<!-- START_PHASE_1 -->
### Phase 1: Project Scaffolding & Database
**Goal:** Working Node.js project with SQLite database, schema migrations, and Docker setup

**Components:**
- `package.json` with dependencies (express, better-sqlite3, express-session, better-sqlite3-session-store, node-cron, nodemailer, tsx)
- `tsconfig.json` with strict mode
- `src/server.ts` — Express app initialization, middleware registration
- `src/db/schema.ts` — SQLite schema creation (all 7 tables: jobs, stages, stage_transitions, contacts, interactions, notes, settings). Jobs table includes location text field.
- `src/db/connection.ts` — Database connection with WAL mode
- `src/db/seed.ts` — Seed fixed pipeline stages (Applied, Phone Screen, Interview, Offer, Rejected)
- `Dockerfile` and `docker-compose.yml` with volume mount for `/data/tracker.db`

**Dependencies:** None (first phase)

**Done when:** `npm install` succeeds, `npm run build` succeeds, server starts, database creates all tables, Docker container builds and runs, seeded stages exist in `stages` table
<!-- END_PHASE_1 -->

<!-- START_PHASE_2 -->
### Phase 2: Authentication
**Goal:** Password-based single-user authentication with session management

**Components:**
- `src/routes/auth.ts` — Login POST route, logout route, first-run setup route
- `src/middleware/auth.ts` — Session check middleware protecting all routes except `/auth/*`
- `src/views/login.html` — Login page, first-run password setup page
- Session store using better-sqlite3-session-store
- Password hash stored in `settings` table row

**Dependencies:** Phase 1 (database, Express server)

**Covers:** rill-job-tracker.AC2 (Authentication)

**Done when:** First-run setup creates password, login succeeds with correct password, login rejects wrong password, all non-auth routes redirect to login when no session, logout destroys session
<!-- END_PHASE_2 -->

<!-- START_PHASE_3 -->
### Phase 3: Rill Bridge & Rule Engine
**Goal:** Working integration between Node.js and Rill interpreter with all four rule files

**Components:**
- `src/rill/bridge.ts` — JS↔Rill type conversion, rule file loading, evaluation wrapper
- `rules/transitions.lv` — Stage transition validation logic
- `rules/alerts.lv` — Alert condition evaluation (follow-up due, no response)
- `rules/validation.lv` — Job input validation rules
- `rules/dashboard.lv` — Dashboard metric computation
- Rill project linked as local dependency (npm workspace or symlink)

**Dependencies:** Phase 1 (database for test data)

**Covers:** rill-job-tracker.AC4 (Rill DSL)

**Done when:** Bridge converts JS objects to Rill Values and back correctly, each rule file evaluates with injected test data and returns expected results, invalid transitions are rejected, alert conditions fire correctly
<!-- END_PHASE_3 -->

<!-- START_PHASE_4 -->
### Phase 4: Job CRUD & Contacts
**Goal:** Full create/read/update/delete for jobs and contacts with Rill validation

**Components:**
- `src/routes/jobs.ts` — CRUD routes for jobs, returns HTML partials for HTMX
- `src/routes/contacts.ts` — CRUD routes for contacts and interactions per job
- `src/db/queries.ts` — Prepared statements for jobs, contacts, interactions, notes
- `src/views/jobs/` — Job list view, job detail view, job form, contact cards, interaction log
- Integration with `rules/validation.lv` for input validation on create/update

**Dependencies:** Phase 2 (auth), Phase 3 (Rill bridge for validation)

**Covers:** rill-job-tracker.AC1 (Job lifecycle management)

**Done when:** Jobs can be created with all fields (company info, salary, location, warm/cold, etc.), edited, and viewed. Contacts with notes can be added to jobs with interaction history. Rill validation rejects invalid input (e.g., salary_min > salary_max). Notes can be added per job.
<!-- END_PHASE_4 -->

<!-- START_PHASE_5 -->
### Phase 5: Pipeline & Stage Transitions
**Goal:** Kanban pipeline view with drag-and-drop stage transitions validated by Rill

**Components:**
- `src/routes/pipeline.ts` — Pipeline view route, stage transition POST route
- `src/views/pipeline/` — Kanban board (desktop), stacked cards (mobile), stage columns
- Alpine.js drag-and-drop handlers in pipeline view
- Integration with `rules/transitions.lv` for transition validation
- `stage_transitions` table records every stage change with timestamp and optional sub-label

**Dependencies:** Phase 4 (jobs exist to display in pipeline)

**Covers:** rill-job-tracker.AC1 (stage tracking portions)

**Done when:** Pipeline view shows jobs as cards in stage columns, drag-and-drop moves jobs between stages, Rill rejects invalid transitions (e.g., Applied → Offer), sub-labels can be added to transitions, stage history is recorded and visible on job detail
<!-- END_PHASE_5 -->

<!-- START_PHASE_6 -->
### Phase 6: Dashboard & Metrics
**Goal:** Polished dashboard with stats cards and Chart.js visualizations

**Components:**
- `src/routes/dashboard.ts` — Dashboard route, queries job data, passes to Rill for computation
- `src/views/dashboard/` — Stats cards, Chart.js charts, actionable items list
- Integration with `rules/dashboard.lv` for metric computation
- Chart.js config for: applications over time (line), stage funnel (bar), warm vs cold breakdown (doughnut)
- Actionable items: follow-ups due, jobs with no response past threshold

**Dependencies:** Phase 4 (job data), Phase 5 (stage data for funnel)

**Covers:** rill-job-tracker.AC1 (dashboard portions)

**Done when:** Dashboard displays total applications, response rate, interview conversion rate. Charts render correctly on mobile and desktop. Actionable items list shows overdue follow-ups and stale applications.
<!-- END_PHASE_6 -->

<!-- START_PHASE_7 -->
### Phase 7: Email Alerts
**Goal:** Scheduled email digest for follow-up due and no-response alerts

**Components:**
- `src/alerts/scheduler.ts` — node-cron job (hourly), iterates active jobs, evaluates `rules/alerts.lv`
- `src/alerts/mailer.ts` — Nodemailer transport configured with Gmail SMTP app password from settings
- `src/alerts/digest.ts` — Batches alerts into single digest email with HTML formatting
- `src/routes/settings.ts` — Settings page for configuring alert thresholds and Gmail credentials
- `src/views/settings/` — Settings form
- `last_alert_sent_at` on jobs table prevents duplicate alerts within 24 hours

**Dependencies:** Phase 3 (Rill alert rules), Phase 4 (job data)

**Covers:** rill-job-tracker.AC3 (Email alerts)

**Done when:** Cron job runs on schedule, evaluates alert rules for each active job, sends single digest email when alerts fire, does not re-alert within 24 hours, settings page allows configuring thresholds and Gmail credentials
<!-- END_PHASE_7 -->

<!-- START_PHASE_8 -->
### Phase 8: JSON Export, Settings & Polish
**Goal:** JSON export, settings management, mobile polish, and production readiness

**Components:**
- `src/routes/export.ts` — GET route that dumps all tables as nested JSON, returns as file download
- `src/routes/settings.ts` — Password change, alert threshold config (extends Phase 7 work)
- `src/views/settings/` — Complete settings page with export button
- Mobile responsive polish across all views (bottom tab nav, responsive Kanban, chart sizing)
- `public/` — Vendored static assets (HTMX, Alpine.js, Chart.js, TailwindCSS via CDN or built CSS)

**Dependencies:** All previous phases

**Covers:** rill-job-tracker.AC5 (JSON export)

**Done when:** JSON export downloads complete dataset with nested relationships. Settings page manages all config. All views render correctly on mobile (375px) and desktop. Bottom tab navigation works on mobile.
<!-- END_PHASE_8 -->

## Additional Considerations

**Rill project dependency:** The Rill interpreter at `/Users/davidrothschild/Projects/rill-lang/` is linked as a local dependency. If Rill's API changes (e.g., `runSource` signature), the bridge module is the only file that needs updating.

**SQLite durability:** WAL mode with default sync provides good performance with acceptable durability for a single-user app. The Docker volume mount ensures the database file survives container restarts. Users should back up the `.db` file periodically (or use the JSON export).

**Security:** Gmail app password and session secret are passed via environment variables, never stored in code. The password hash in the settings table uses bcrypt. The app is designed for LAN access — no HTTPS, no CSRF beyond sameSite cookies. If exposed to the internet, a reverse proxy with TLS should be added.
