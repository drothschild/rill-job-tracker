# Rill Job Tracker Implementation Plan - Phase 4

**Goal:** Full create/read/update/delete for jobs and contacts with Rill validation and HTMX partials

**Architecture:** Express routes return HTML partials for HTMX requests, full pages otherwise. Database queries use prepared statements. Rill validation.lv validates input on create/update.

**Tech Stack:** Express, better-sqlite3, HTMX, rill-lang bridge

**Scope:** 8 phases from original design (phase 4 of 8)

**Codebase verified:** 2026-02-23 — Phases 1-3 create Express server, auth, database with all tables, Rill bridge. All deterministic from greenfield.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### rill-job-tracker.AC1: Job lifecycle management
- **rill-job-tracker.AC1.1 Success:** Job can be created with all fields (company name, role, link, salary range, application type, job description snippet, location)
- **rill-job-tracker.AC1.2 Success:** Job can be edited and changes persist
- **rill-job-tracker.AC1.3 Success:** Contacts with notes can be added to a job with name, role, email, LinkedIn URL
- **rill-job-tracker.AC1.4 Success:** Interactions (call, email, note) can be logged per contact
- **rill-job-tracker.AC1.5 Success:** Freeform notes can be added per job
- **rill-job-tracker.AC1.6 Success:** Jobs can be tagged as warm (referral) or cold (blind)
- **rill-job-tracker.AC1.13 Failure:** Job creation with salary_min > salary_max is rejected

---

<!-- START_TASK_1 -->
### Task 1: Create database queries module

**Files:**
- Create: `src/db/queries.ts`

**Implementation:**

Create a module that exports prepared statement functions for all CRUD operations. Each function takes the database instance and returns prepared statements or executes queries directly.

Provide functions for:

**Jobs:**
- `getAllJobs(db)` — SELECT all jobs with their current stage name (JOIN stages), ordered by updated_at DESC
- `getJobById(db, id)` — SELECT single job with stage name
- `createJob(db, data)` — INSERT job with all fields, return inserted row
- `updateJob(db, id, data)` — UPDATE job fields, set updated_at to now
- `deleteJob(db, id)` — DELETE job by id

**Contacts:**
- `getContactsByJobId(db, jobId)` — SELECT contacts for a job
- `createContact(db, data)` — INSERT contact with job_id, name, role, email, linkedin_url, notes
- `updateContact(db, id, data)` — UPDATE contact fields
- `deleteContact(db, id)` — DELETE contact

**Interactions:**
- `getInteractionsByContactId(db, contactId)` — SELECT interactions for a contact, ordered by occurred_at DESC
- `createInteraction(db, data)` — INSERT interaction with contact_id, type, content

**Notes:**
- `getNotesByJobId(db, jobId)` — SELECT notes for a job, ordered by created_at DESC
- `createNote(db, data)` — INSERT note with job_id and content
- `deleteNote(db, id)` — DELETE note

All functions use prepared statements for performance. Use `db.prepare()` at function call time (not module level) since the db instance comes from the caller.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add database query functions for jobs, contacts, interactions, notes`
<!-- END_TASK_1 -->

<!-- START_SUBCOMPONENT_A (tasks 2-3) -->
<!-- START_TASK_2 -->
### Task 2: Create HTML view helpers and layout

**Files:**
- Create: `src/views/layout.ts`
- Create: `src/views/helpers.ts`

**Implementation:**

**layout.ts** — Export a `layout(title, bodyHtml, req)` function that wraps body content in a full HTML page with:
- `<head>` with TailwindCSS CDN (`<script src="https://cdn.tailwindcss.com"></script>`), HTMX CDN (`<script src="https://unpkg.com/htmx.org@2.0.4"></script>`)
- Navigation bar with links: Dashboard, Jobs, Pipeline, Settings, Logout
- `<main>` container wrapping the body HTML
- The function checks the `HX-Request` header on the request — if present, return ONLY the body HTML (partial), not the full page wrapper

**helpers.ts** — Export helper functions:
- `escapeHtml(str)` — Escape `<`, `>`, `&`, `"`, `'` for safe HTML rendering
- `formatDate(dateStr)` — Format ISO date string to human-readable format
- `formatSalary(min, max)` — Format salary range as "$X - $Y" or "Not specified"

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add HTML layout wrapper and view helpers`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Create job views (list, detail, form)

**Files:**
- Create: `src/views/jobs/list.ts`
- Create: `src/views/jobs/detail.ts`
- Create: `src/views/jobs/form.ts`

**Implementation:**

Each view is a TypeScript function that returns an HTML string.

**list.ts** — `jobListView(jobs)`: Renders a list/grid of job cards showing company name, role, current stage (color-coded badge), application type (warm/cold tag), salary range, and location. Each card links to the job detail view. Include a "New Job" button that triggers the form.

**detail.ts** — `jobDetailView(job, contacts, notes, stageHistory)`: Renders a detailed view of a single job with:
- All job fields displayed
- Edit button (links to form in edit mode)
- Contacts section with "Add Contact" button
- Each contact shows name, role, email (linked), LinkedIn (linked), with an "Add Interaction" form
- Interactions list per contact (type badge + content + date)
- Notes section with "Add Note" form and list of existing notes
- Stage transition history timeline

**form.ts** — `jobFormView(job?)`: Renders a form for creating or editing a job. If `job` is provided, pre-fills fields for editing. Fields:
- Company Name (text, required)
- Role (text, required)
- Link (url)
- Salary Min (number)
- Salary Max (number)
- Application Type (select: warm/cold)
- Job Description (textarea)
- Location (text)
- Follow-up Date (date input)

The form uses HTMX: `hx-post="/jobs"` for create, `hx-put="/jobs/:id"` for update, targeting the main content area.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add job list, detail, and form views`
<!-- END_TASK_3 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (tasks 4-6) -->
<!-- START_TASK_4 -->
### Task 4: Create jobs routes with Rill validation

**Files:**
- Create: `src/routes/jobs.ts`

**Implementation:**

Create an Express Router with these routes:

**GET /jobs** — List all jobs. Query `getAllJobs`, render `jobListView`. Return partial or full page based on HX-Request header.

**GET /jobs/new** — Show create form. Render `jobFormView()` (no job argument).

**GET /jobs/:id** — Show job detail. Query `getJobById`, `getContactsByJobId`, `getNotesByJobId`, get stage transitions. Render `jobDetailView`.

**GET /jobs/:id/edit** — Show edit form. Query `getJobById`, render `jobFormView(job)`.

**POST /jobs** — Create job. Parse form body. Run Rill validation via `evaluateRule('rules/validation.lv', { job: formData })`. If validation returns Err, re-render form with error message. If Ok, call `createJob`, also insert initial stage transition (to "Applied"), redirect to job detail.

**PUT /jobs/:id** — Update job. Parse form body. Run Rill validation. If Ok, call `updateJob`, return updated job detail partial.

**DELETE /jobs/:id** — Delete job. Call `deleteJob`, redirect to job list.

**POST /jobs/:id/notes** — Add note. Parse body, call `createNote`, return updated notes section partial.

**DELETE /jobs/:id/notes/:noteId** — Delete note. Call `deleteNote`, return updated notes section partial.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add job CRUD routes with Rill validation`
<!-- END_TASK_4 -->

<!-- START_TASK_5 -->
### Task 5: Create contacts and interactions routes

**Files:**
- Create: `src/routes/contacts.ts`

**Implementation:**

Create an Express Router (mounted under `/jobs/:jobId/contacts`):

**POST /** — Create contact for job. Parse form body (name, role, email, linkedin_url, notes). Call `createContact`. Return updated contacts section partial.

**PUT /:id** — Update contact. Parse form body, call `updateContact`. Return updated contact card partial.

**DELETE /:id** — Delete contact. Call `deleteContact`. Return empty (HTMX removes element).

**POST /:id/interactions** — Log interaction. Parse form body (type: call/email/note, content). Call `createInteraction`. Return updated interaction list partial.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add contact and interaction routes`
<!-- END_TASK_5 -->

<!-- START_TASK_6 -->
### Task 6: Wire routes into server and test

**Verifies:** rill-job-tracker.AC1.1, rill-job-tracker.AC1.2, rill-job-tracker.AC1.3, rill-job-tracker.AC1.4, rill-job-tracker.AC1.5, rill-job-tracker.AC1.6, rill-job-tracker.AC1.13

**Files:**
- Modify: `src/server.ts`
- Test: `tests/jobs.test.ts`

**Implementation:**

Update `src/server.ts` to import and mount:
- Job routes at `/jobs`
- Contact routes at `/jobs/:jobId/contacts`

**Testing:**

Tests must verify each AC listed above using supertest HTTP-level integration tests:

- rill-job-tracker.AC1.1: POST /jobs with all fields creates job, GET /jobs/:id returns all fields
- rill-job-tracker.AC1.2: PUT /jobs/:id with changed fields updates job, GET /jobs/:id shows changes
- rill-job-tracker.AC1.3: POST /jobs/:id/contacts with name, role, email, linkedin_url creates contact linked to job
- rill-job-tracker.AC1.4: POST /jobs/:id/contacts/:cid/interactions with type "call" and content creates interaction record
- rill-job-tracker.AC1.5: POST /jobs/:id/notes with content creates note, appears in job detail
- rill-job-tracker.AC1.6: POST /jobs with application_type "warm" creates warm-tagged job; same with "cold"
- rill-job-tracker.AC1.13: POST /jobs with salary_min=100000, salary_max=50000 returns validation error (Rill rejects)

Use a test database, create authenticated session before tests (setup from Phase 2).

Follow project testing patterns. Task-implementor generates actual test code at execution time.

**Verification:**

```bash
npx tsx tests/jobs.test.ts
```

Expected: All tests pass.

**Commit:** `feat: wire job and contact routes, add integration tests`
<!-- END_TASK_6 -->
<!-- END_SUBCOMPONENT_B -->
