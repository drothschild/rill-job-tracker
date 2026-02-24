# Rill Job Tracker

A personal job application tracker with a Kanban pipeline, email alerts, and business rules powered by the [Rill](https://github.com/drothschild/rill-lang) rule engine.

Built for self-hosting on a LAN via Docker.

## Features

- **Kanban pipeline** -- drag-and-drop jobs through stages (Applied, Phone Screen, Interview, Offer, Rejected)
- **Job CRUD** -- track company, role, salary range, application type (warm/cold), description, location
- **Contacts & interactions** -- log contacts per job with call/email/note history
- **Dashboard** -- metrics, charts (Chart.js), and actionable items at a glance
- **Email alerts** -- hourly digest via Gmail SMTP for overdue follow-ups and stale applications
- **JSON export** -- download all data with nested relationships
- **Rill rules** -- stage transitions, input validation, alert conditions, and dashboard metrics are defined in `.lv` rule files, not hardcoded
- **Mobile responsive** -- bottom tab nav and stacked layouts for phones
- **Single-user auth** -- bcrypt password hashing with SQLite-backed sessions

## Prerequisites

- Node.js 20+
- [rill-lang](https://github.com/drothschild/rill-lang) cloned as a sibling directory at `../Projects/rill-lang` (or adjust the path in `package.json`)

## Setup

```bash
npm install
npm run dev
```

Open `http://localhost:3000`. On first run you'll be prompted to set a password.

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with file watching (tsx watch) |
| `npm start` | Start without watching |
| `npm test` | Run all tests (vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run typecheck` | TypeScript type checking |
| `npm run build` | Compile TypeScript |

## Docker

```bash
# Build (copies rill-lang into Docker context)
bash scripts/docker-build.sh

# Or use docker-compose
SESSION_SECRET=your-secret-here docker compose up -d
```

Data is persisted in a Docker volume at `/data/tracker.db`.

## Project Structure

```
src/
  server.ts              # Express app, middleware, route mounting
  db/
    connection.ts        # SQLite connection (WAL mode, foreign keys)
    schema.ts            # 7 tables: jobs, stages, contacts, etc.
    seed.ts              # Pipeline stage seed data
    queries.ts           # All database queries
  middleware/
    auth.ts              # Session-based authentication guard
  routes/
    auth.ts              # Login, setup, logout, change password
    jobs.ts              # Job CRUD with Rill validation
    contacts.ts          # Contacts and interactions per job
    pipeline.ts          # Stage transitions with Rill validation
    dashboard.ts         # Dashboard with Rill-computed metrics
    settings.ts          # Alert and Gmail configuration
    export.ts            # JSON export with nested data
  rill/
    bridge.ts            # JS <-> Rill type conversion and evaluation
  views/
    layout.ts            # Page shell with nav (desktop + mobile)
    helpers.ts           # escapeHtml, formatDate, formatSalary
    jobs/                # Job list, detail, form views
    pipeline/            # Kanban board view
    dashboard/           # Stats cards and Chart.js charts
    settings/            # Settings form
  alerts/
    scheduler.ts         # Hourly cron job for alert evaluation
    mailer.ts            # Gmail SMTP via Nodemailer
    digest.ts            # HTML/plain text email formatting
rules/
  transitions.lv         # Valid stage transition rules
  validation.lv          # Job input validation rules
  alerts.lv              # Alert condition rules
  dashboard.lv           # Dashboard metric computation
tests/                   # 159 tests across 9 files (vitest + supertest)
```

## Rill Rules

Business logic is defined in Rill `.lv` files rather than application code. Rules are evaluated at runtime and can be edited without restarting the server.

**transitions.lv** -- which pipeline moves are allowed:
```
match (from_stage, to_stage) {
  ("Applied", "Phone Screen") -> Ok("allowed"),
  ("Applied", "Rejected") -> Ok("allowed"),
  ("Phone Screen", "Interview") -> Ok("allowed"),
  ...
  _ -> Err("Invalid transition from " ++ from_stage ++ " to " ++ to_stage)
}
```

**validation.lv** -- job input validation:
```
match (has_company, has_role, salary_valid) {
  (false, _, _) -> Err("Company name is required"),
  (_, false, _) -> Err("Role is required"),
  (_, _, false) -> Err("Minimum salary cannot exceed maximum salary"),
  _ -> Ok("valid")
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `DB_PATH` | `data/tracker.db` | SQLite database path |
| `SESSION_SECRET` | dev default | Session cookie signing secret |

## Tech Stack

- **Runtime:** Node.js + TypeScript + tsx
- **Server:** Express
- **Database:** SQLite via better-sqlite3 (WAL mode)
- **Frontend:** Server-rendered HTML, HTMX, Alpine.js, TailwindCSS (CDN), Chart.js
- **Auth:** bcrypt + express-session + better-sqlite3-session-store
- **Alerts:** node-cron + Nodemailer (Gmail SMTP)
- **Rules:** rill-lang
- **Testing:** Vitest + Supertest (159 integration tests)
