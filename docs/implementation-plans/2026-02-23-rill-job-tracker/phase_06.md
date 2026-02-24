# Rill Job Tracker Implementation Plan - Phase 6

**Goal:** Polished dashboard with stats cards, Chart.js visualizations, and actionable items

**Architecture:** Dashboard route queries all job data, passes to Rill dashboard.lv for metric computation, renders stats cards and Chart.js charts. Charts configured inline via `<script>` tags.

**Tech Stack:** Express, HTMX, Chart.js (CDN), rill-lang bridge

**Scope:** 8 phases from original design (phase 6 of 8)

**Codebase verified:** 2026-02-23 — Phases 1-5 create all job data, stage transitions, Rill bridge with dashboard.lv. Chart.js from CDN (no install needed).

---

## Acceptance Criteria Coverage

This phase implements and tests:

### rill-job-tracker.AC1: Job lifecycle management
- **rill-job-tracker.AC1.10 Success:** Dashboard shows total applications, response rate, and interview conversion rate
- **rill-job-tracker.AC1.11 Success:** Dashboard charts render on both mobile (375px) and desktop viewports

---

<!-- START_TASK_1 -->
### Task 1: Add dashboard query functions

**Files:**
- Modify: `src/db/queries.ts`

**Implementation:**

Add query functions for dashboard data:

- `getJobsForDashboard(db)` — SELECT all jobs with current stage name and application_type. Returns enough data for Rill to compute metrics.
- `getApplicationsOverTime(db)` — SELECT count of jobs grouped by created_at date (DATE(created_at)), ordered chronologically. Returns `{ date: string, count: number }[]` for the line chart.
- `getJobsWithOverdueFollowUp(db)` — SELECT jobs where follow_up_date < datetime('now') AND current_stage NOT IN ('Rejected', 'Offer'). Returns actionable items.
- `getStaleJobs(db, thresholdDays)` — SELECT jobs where updated_at < datetime('now', '-N days') AND current_stage NOT IN ('Rejected', 'Offer'). Returns jobs with no recent activity.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add dashboard query functions`
<!-- END_TASK_1 -->

<!-- START_SUBCOMPONENT_A (tasks 2-4) -->
<!-- START_TASK_2 -->
### Task 2: Create dashboard view

**Files:**
- Create: `src/views/dashboard/index.ts`

**Implementation:**

Export `dashboardView(metrics, chartData, actionableItems)` that renders:

**Stats Cards Row** (responsive grid — 3 columns desktop, stack on mobile):
- Total Applications: `metrics.total` (large number, label below)
- Response Rate: computed as `(metrics.responded / metrics.total * 100)%` — show as percentage with label
- Interview Conversion: computed as `(metrics.interviewed / metrics.total * 100)%` — show as percentage with label

**Charts Section** (responsive — 2 columns desktop, stack on mobile):

1. **Applications Over Time** (line chart):
   - Canvas element with id `chart-applications-timeline`
   - Chart.js configuration in a `<script>` tag below the canvas
   - X-axis: dates, Y-axis: cumulative application count
   - Responsive sizing

2. **Stage Funnel** (horizontal bar chart):
   - Canvas element with id `chart-stage-funnel`
   - Bars for each stage showing job count
   - Color-coded by stage

3. **Warm vs Cold Breakdown** (doughnut chart):
   - Canvas element with id `chart-warm-cold`
   - Two segments: warm (green) and cold (blue)
   - Center label showing total

**Actionable Items Section:**
- List of overdue follow-ups with job name, company, days overdue, link to job detail
- List of stale applications with job name, company, days since last update, link to job detail

Include Chart.js CDN: `<script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>`

Chart data is serialized as JSON in data attributes or inline script variables, then Chart.js initializes on DOMContentLoaded.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add dashboard view with stats cards and Chart.js charts`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Create dashboard route with Rill metrics

**Files:**
- Create: `src/routes/dashboard.ts`

**Implementation:**

Create an Express Router:

**GET /** (mounted at `/` or `/dashboard`):
1. Query `getJobsForDashboard(db)` to get all jobs with stage names
2. Convert jobs to Rill-compatible format and evaluate `rules/dashboard.lv` via bridge:
   ```
   evaluateRule('rules/dashboard.lv', { jobs: jobsData })
   ```
3. The Rill result provides: `{ total, responded, interviewed, warm_count, cold_count }`
4. Compute percentage rates in TypeScript (avoid division by zero):
   - `response_rate = total > 0 ? Math.round(responded / total * 100) : 0`
   - `interview_rate = total > 0 ? Math.round(interviewed / total * 100) : 0`
5. Query `getApplicationsOverTime(db)` for timeline chart data
6. Query `getJobsWithOverdueFollowUp(db)` for actionable items
7. Query `getStaleJobs(db, alertThreshold)` for stale jobs (read threshold from settings, default 7 days)
8. Get stage counts from `getJobsByStage(db)` for funnel chart
9. Render `dashboardView(metrics, chartData, actionableItems)`
10. Return partial or full page based on HX-Request

Update `src/server.ts`:
- Mount dashboard route at `/`
- Remove the temporary placeholder root route from Phase 2

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add dashboard route with Rill metric computation`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: Test dashboard metrics

**Verifies:** rill-job-tracker.AC1.10, rill-job-tracker.AC1.11

**Files:**
- Modify: `src/server.ts`
- Test: `tests/dashboard.test.ts`

**Testing:**

Tests must verify each AC listed above:

- rill-job-tracker.AC1.10: Dashboard metrics:
  - Seed 5 jobs in various stages. GET /dashboard returns HTML containing correct total (5), response rate (percentage of non-Applied jobs), interview conversion rate (percentage of Interview+Offer stage jobs)
  - With 0 jobs, response rate and interview rate show 0% (no division by zero)
  - With mix of warm/cold jobs, warm_count and cold_count are correct

- rill-job-tracker.AC1.11: Chart rendering (HTML structure test):
  - GET /dashboard returns HTML containing all three chart canvas elements with correct IDs
  - Response includes Chart.js CDN script tag
  - Chart configuration data is embedded in the page (as JSON in script or data attributes)
  - Note: Visual rendering verification (375px vs desktop) is a human verification item — the test verifies the HTML structure is present and responsive CSS classes are applied

Follow project testing patterns. Task-implementor generates actual test code at execution time.

**Verification:**

```bash
npx tsx tests/dashboard.test.ts
```

Expected: All tests pass.

**Commit:** `feat: wire dashboard route, add metric tests`
<!-- END_TASK_4 -->
<!-- END_SUBCOMPONENT_A -->
