# Rill Job Tracker Implementation Plan - Phase 5

**Goal:** Kanban pipeline view with drag-and-drop stage transitions validated by Rill

**Architecture:** Pipeline view renders stage columns with job cards. Alpine.js handles drag-and-drop on desktop, tap-to-move on mobile. Stage transitions POST to server, validated via Rill transitions.lv before persisting.

**Tech Stack:** Express, HTMX, Alpine.js (CDN), rill-lang bridge

**Scope:** 8 phases from original design (phase 5 of 8)

**Codebase verified:** 2026-02-23 — Phases 1-4 create database with stage_transitions table, jobs CRUD, Rill bridge with transitions.lv rule file. Alpine.js from CDN (no install needed).

---

## Acceptance Criteria Coverage

This phase implements and tests:

### rill-job-tracker.AC1: Job lifecycle management
- **rill-job-tracker.AC1.7 Success:** Jobs move through pipeline stages (Applied, Phone Screen, Interview, Offer, Rejected)
- **rill-job-tracker.AC1.8 Success:** Custom sub-labels can be added to stage transitions (e.g., "Technical Interview")
- **rill-job-tracker.AC1.9 Success:** Stage transition history is recorded with timestamps
- **rill-job-tracker.AC1.12 Failure:** Invalid stage transitions are rejected (e.g., Applied directly to Offer)

---

<!-- START_TASK_1 -->
### Task 1: Add stage transition query functions

**Files:**
- Modify: `src/db/queries.ts`

**Implementation:**

Add the following query functions to the existing queries module:

- `getAllStages(db)` — SELECT all stages ordered by display_order
- `getStageByName(db, name)` — SELECT stage by name
- `getStageById(db, id)` — SELECT stage by id
- `getJobsByStage(db)` — SELECT all jobs grouped by current_stage_id, with stage name. Returns `{ stageId, stageName, jobs[] }[]`
- `createStageTransition(db, data)` — INSERT into stage_transitions (job_id, from_stage_id, to_stage_id, sub_label)
- `getStageTransitionsByJobId(db, jobId)` — SELECT transitions for a job with from/to stage names, ordered by transitioned_at DESC
- `updateJobStage(db, jobId, stageId)` — UPDATE jobs SET current_stage_id, updated_at

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add stage transition query functions`
<!-- END_TASK_1 -->

<!-- START_SUBCOMPONENT_A (tasks 2-4) -->
<!-- START_TASK_2 -->
### Task 2: Create pipeline view

**Files:**
- Create: `src/views/pipeline/board.ts`

**Implementation:**

Export `pipelineBoardView(stages, jobsByStage)` that renders a Kanban board:

**Desktop layout (md+ breakpoint):**
- Horizontal scrolling container with one column per stage
- Each column has a header with stage name and job count
- Job cards inside each column show: company name, role, days in stage, warm/cold badge
- Cards are draggable (Alpine.js `x-data` with drag handlers)
- Columns are drop targets

**Mobile layout (< md breakpoint):**
- Vertical stacked sections, one per stage
- Collapsible sections (tap stage header to expand/collapse)
- Cards show same info but in compact format
- "Move to..." button on each card opens a dropdown of valid target stages

**Alpine.js drag-and-drop:**
- Each card has `draggable="true"` and Alpine.js handlers for `dragstart`, `dragend`
- Each column has handlers for `dragover`, `drop`
- On drop, POST to `/pipeline/transition` via HTMX with job_id, to_stage_id, and optional sub_label
- Include Alpine.js CDN script in the layout: `<script src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js" defer></script>`

**Sub-label prompt:**
- When a card is dropped on a new column, show a small modal/dialog asking for an optional sub-label (e.g., "Technical Interview")
- Submit button sends the transition request

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add pipeline Kanban board view with drag-and-drop`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Create pipeline routes with Rill transition validation

**Files:**
- Create: `src/routes/pipeline.ts`

**Implementation:**

Create an Express Router:

**GET /pipeline** — Render pipeline board. Query `getAllStages`, `getJobsByStage`. Render `pipelineBoardView`. Return partial or full page based on HX-Request.

**POST /pipeline/transition** — Process stage transition:
1. Parse body: `job_id`, `to_stage_id`, `sub_label` (optional)
2. Get current job to find `from_stage_id`
3. Look up stage names for both IDs
4. Evaluate `rules/transitions.lv` via bridge: `evaluateRule('rules/transitions.lv', { from_stage: fromName, to_stage: toName })`
5. If result is Err (invalid transition): return 422 with error message as HTML partial
6. If result is Ok:
   - Call `updateJobStage(db, jobId, toStageId)`
   - Call `createStageTransition(db, { job_id, from_stage_id, to_stage_id, sub_label })`
   - Return updated pipeline board partial (HTMX swaps the board)

Mount at `/pipeline` in server.ts.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add pipeline routes with Rill stage transition validation`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: Wire pipeline routes and test transitions

**Verifies:** rill-job-tracker.AC1.7, rill-job-tracker.AC1.8, rill-job-tracker.AC1.9, rill-job-tracker.AC1.12

**Files:**
- Modify: `src/server.ts`
- Test: `tests/pipeline.test.ts`

**Implementation:**

Update `src/server.ts` to import and mount pipeline routes at `/pipeline`.

**Testing:**

Tests must verify each AC listed above using supertest:

- rill-job-tracker.AC1.7: Create a job (starts at Applied), POST /pipeline/transition to Phone Screen succeeds, job's current_stage_id updated
- rill-job-tracker.AC1.8: POST /pipeline/transition with sub_label "Technical Interview", query stage_transitions shows sub_label stored
- rill-job-tracker.AC1.9: After transition, query stage_transitions for job shows from_stage, to_stage, timestamp recorded
- rill-job-tracker.AC1.12: POST /pipeline/transition from Applied directly to Offer returns 422 error (Rill rejects)

Also test:
- All valid transitions succeed (Applied→Phone Screen, Applied→Rejected, Phone Screen→Interview, Phone Screen→Rejected, Interview→Offer, Interview→Rejected, Offer→Rejected)
- Multiple transitions for same job creates multiple records in stage_transitions

Follow project testing patterns. Task-implementor generates actual test code at execution time.

**Verification:**

```bash
npx tsx tests/pipeline.test.ts
```

Expected: All tests pass.

**Commit:** `feat: wire pipeline routes, add stage transition tests`
<!-- END_TASK_4 -->
<!-- END_SUBCOMPONENT_A -->
