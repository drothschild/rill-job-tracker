# Rill Job Tracker Implementation Plan - Phase 8

**Goal:** JSON export, settings page polish, mobile responsive polish, and production readiness

**Architecture:** Export route queries all tables with nested relationships and returns as JSON file download. Mobile polish adds bottom tab navigation, responsive layouts, and consistent styling across all views.

**Tech Stack:** Express, TailwindCSS (CDN), HTMX, Alpine.js

**Scope:** 8 phases from original design (phase 8 of 8)

**Codebase verified:** 2026-02-23 — All previous phases complete. Settings page exists from Phase 7. All views exist and need mobile polish.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### rill-job-tracker.AC5: JSON export
- **rill-job-tracker.AC5.1 Success:** Export downloads a JSON file containing all jobs with nested contacts, interactions, notes, and stage history
- **rill-job-tracker.AC5.2 Success:** Exported JSON is valid and parseable
- **rill-job-tracker.AC5.3 Edge:** Export with zero jobs returns valid empty JSON structure

---

<!-- START_SUBCOMPONENT_A (tasks 1-3) -->
<!-- START_TASK_1 -->
### Task 1: Create export query and route

**Files:**
- Create: `src/routes/export.ts`
- Modify: `src/db/queries.ts`

**Implementation:**

**Add to queries.ts:**

- `getFullExportData(db)` — Builds the complete nested export structure:
  1. SELECT all jobs
  2. For each job, SELECT contacts, notes, stage_transitions
  3. For each contact, SELECT interactions
  4. Return structured array where each job contains its nested data:
  ```typescript
  {
    exported_at: string,
    jobs: Array<{
      id, company_name, role, link, salary_min, salary_max,
      application_type, job_description, location, current_stage,
      follow_up_date, created_at, updated_at,
      contacts: Array<{
        id, name, role, email, linkedin_url, notes, created_at,
        interactions: Array<{ id, type, content, occurred_at }>
      }>,
      notes: Array<{ id, content, created_at }>,
      stage_history: Array<{ from_stage, to_stage, sub_label, transitioned_at }>
    }>
  }
  ```

Use a transaction for read consistency. Join stage names for current_stage and stage_history entries.

**Export route:**

**GET /export** — Query `getFullExportData(db)`, set response headers:
- `Content-Type: application/json`
- `Content-Disposition: attachment; filename="job-tracker-export-YYYY-MM-DD.json"`

Return `JSON.stringify(data, null, 2)`.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add JSON export route with nested data`
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Wire export route and update settings page

**Files:**
- Modify: `src/server.ts`
- Modify: `src/views/settings/index.ts`

**Implementation:**

Update `src/server.ts` to mount export route at `/export`.

Update the settings view to add an "Export Data" section with a download link:
- "Export All Data" button linking to `/export` (standard link, not HTMX — triggers file download)
- Brief description: "Download all job application data as a JSON file"

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: wire export route and add export button to settings`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Test JSON export

**Verifies:** rill-job-tracker.AC5.1, rill-job-tracker.AC5.2, rill-job-tracker.AC5.3

**Files:**
- Test: `tests/export.test.ts`

**Testing:**

Tests must verify each AC listed above using supertest:

- rill-job-tracker.AC5.1: Seed database with 2 jobs, each with contacts (with interactions), notes, and stage transitions. GET /export returns JSON containing all jobs with correctly nested contacts, interactions, notes, and stage_history.
- rill-job-tracker.AC5.2: GET /export response body is valid JSON (JSON.parse succeeds). Content-Type header is application/json. Content-Disposition header contains filename with .json extension.
- rill-job-tracker.AC5.3: With empty database (no jobs), GET /export returns valid JSON with `{ exported_at: "...", jobs: [] }` structure.

Follow project testing patterns. Task-implementor generates actual test code at execution time.

**Verification:**

```bash
npx tsx tests/export.test.ts
```

Expected: All tests pass.

**Commit:** `test: add JSON export tests`
<!-- END_TASK_3 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_TASK_4 -->
### Task 4: Add mobile bottom tab navigation

**Files:**
- Modify: `src/views/layout.ts`

**Implementation:**

Update the layout to add a bottom tab navigation bar visible only on mobile (< md breakpoint):

- Fixed to bottom of viewport
- 4 tabs: Dashboard (home icon), Jobs (list icon), Pipeline (columns icon), Settings (gear icon)
- Each tab is an HTMX link that swaps the main content area
- Active tab highlighted based on current path
- Hide the top navigation bar on mobile (show only on md+ breakpoint)
- Use TailwindCSS responsive classes: `hidden md:flex` for desktop nav, `flex md:hidden` for mobile bottom nav

Icons can be simple text/emoji or inline SVG. Keep it lightweight — no icon library dependency.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors. Start server, check layout at narrow viewport.

**Commit:** `feat: add mobile bottom tab navigation`
<!-- END_TASK_4 -->

<!-- START_TASK_5 -->
### Task 5: Mobile responsive polish across all views

**Files:**
- Modify: `src/views/jobs/list.ts`
- Modify: `src/views/jobs/detail.ts`
- Modify: `src/views/jobs/form.ts`
- Modify: `src/views/pipeline/board.ts`
- Modify: `src/views/dashboard/index.ts`
- Modify: `src/views/settings/index.ts`

**Implementation:**

Review and polish each view for mobile (375px) and desktop responsiveness:

**Job list**: Cards stack vertically on mobile, grid on desktop. Ensure text doesn't overflow.

**Job detail**: Sections stack vertically on mobile. Contact cards and interaction logs use full width. Form inputs are full-width on mobile.

**Job form**: All inputs full-width on mobile. Labels above inputs (not beside). Submit button full-width on mobile.

**Pipeline board**: Horizontal scroll on desktop, vertical stacked sections on mobile (already designed in Phase 5 — verify it works).

**Dashboard**: Stats cards stack on mobile (1 column), grid on desktop (3 columns). Charts full-width on mobile, 2-column grid on desktop. Chart.js responsive option should already handle canvas sizing.

**Settings**: Form sections full-width on mobile. Inputs and buttons full-width.

Use TailwindCSS responsive prefixes: `sm:`, `md:`, `lg:`. Ensure padding/margins are comfortable for touch targets (min 44px tap targets).

**Verification:**

Start server, visually check all pages at 375px and desktop widths.

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `style: mobile responsive polish across all views`
<!-- END_TASK_5 -->

<!-- START_TASK_6 -->
### Task 6: Update Dockerfile for production

**Files:**
- Modify: `Dockerfile`

**Implementation:**

Update the Dockerfile created in Phase 1 to properly handle the final project structure:

- Copy the `rules/` directory into the container
- Ensure `public/` directory is included
- Set proper production defaults
- Add health check: `HEALTHCHECK CMD curl -f http://localhost:3000/health || exit 1`

Verify the Docker build context handles the rill-lang dependency correctly. The rill-lang project needs to be accessible during build. Options:
1. Copy rill-lang dist/ into the Docker context
2. Multi-stage build that copies just the needed files

Use approach 1 (simpler): copy rill-lang/dist and rill-lang/package.json into the build context.

Update `.dockerignore` to exclude test files and docs from the image.

**Verification:**

```bash
docker build -t rill-job-tracker . 2>&1 | tail -5
```

Expected: Build completes (or shows progress if Docker available). If Docker unavailable, verify Dockerfile syntax.

**Commit:** `chore: update Dockerfile for production deployment`
<!-- END_TASK_6 -->
