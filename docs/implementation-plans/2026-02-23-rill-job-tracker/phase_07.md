# Rill Job Tracker Implementation Plan - Phase 7

**Goal:** Scheduled email digest for follow-up due and no-response alerts via Gmail SMTP

**Architecture:** node-cron runs hourly, queries active jobs, evaluates alerts.lv per job via Rill bridge, batches results into single digest email sent via Nodemailer with Gmail SMTP. Settings page configures thresholds and credentials.

**Tech Stack:** node-cron, nodemailer, Express, HTMX, rill-lang bridge

**Scope:** 8 phases from original design (phase 7 of 8)

**Codebase verified:** 2026-02-23 — Phases 1-6 provide all required infrastructure: database with jobs/settings tables, Rill bridge with alerts.lv, auth middleware, view helpers. nodemailer and node-cron installed in Phase 1.

---

## Acceptance Criteria Coverage

This phase implements and tests:

### rill-job-tracker.AC3: Email alerts
- **rill-job-tracker.AC3.1 Success:** Email digest sent when follow-up date has passed on any active job
- **rill-job-tracker.AC3.2 Success:** Email digest sent when a job has had no response for Y days (configurable)
- **rill-job-tracker.AC3.3 Success:** Multiple alerts batched into single digest email
- **rill-job-tracker.AC3.4 Success:** Alert thresholds configurable from settings page
- **rill-job-tracker.AC3.5 Success:** Gmail SMTP credentials configurable from settings page
- **rill-job-tracker.AC3.6 Edge:** Same alert not re-sent within 24 hours for the same job
- **rill-job-tracker.AC3.7 Failure:** Alert scheduler continues running if Gmail credentials are invalid (logs error, does not crash)

---

<!-- START_TASK_1 -->
### Task 1: Create settings query helpers

**Files:**
- Modify: `src/db/queries.ts`

**Implementation:**

Add settings-related query functions:

- `getSetting(db, key)` — SELECT value FROM settings WHERE key = ?. Returns string or null.
- `setSetting(db, key, value)` — INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)
- `getAlertSettings(db)` — Returns an object with alert-related settings:
  - `alert_threshold_days` (default: 7)
  - `gmail_user` (default: '')
  - `gmail_app_password` (default: '')
  - `alert_recipient_email` (default: '')
  - `alerts_enabled` (default: 'false')
- `getActiveJobsForAlerts(db)` — SELECT jobs WHERE current_stage NOT IN (Rejected stage id, Offer stage id), including:
  - Computed `days_since_update`: `CAST(julianday('now') - julianday(updated_at) AS INTEGER)`
  - Computed `follow_up_date_passed`: `follow_up_date IS NOT NULL AND follow_up_date < datetime('now')`
  - `last_alert_sent_at` for 24-hour dedup check
- `updateJobAlertSentAt(db, jobId)` — UPDATE jobs SET last_alert_sent_at = datetime('now') WHERE id = ?

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add settings and alert query functions`
<!-- END_TASK_1 -->

<!-- START_SUBCOMPONENT_A (tasks 2-4) -->
<!-- START_TASK_2 -->
### Task 2: Create mailer module

**Files:**
- Create: `src/alerts/mailer.ts`

**Implementation:**

Export a function to create a Nodemailer transport and send emails:

- `createMailTransport(gmailUser, gmailAppPassword)` — Create and return a Nodemailer transport configured for Gmail SMTP:
  - host: 'smtp.gmail.com'
  - port: 587
  - secure: false (STARTTLS)
  - auth: { user: gmailUser, pass: gmailAppPassword }

- `sendDigestEmail(transport, recipientEmail, senderEmail, alerts)` — Send a single digest email:
  - Subject: "Job Tracker Alert Digest"
  - HTML body formatted with alert details (each alert as a section with job name, type, message)
  - Returns `{ success: boolean, error?: string }`

Wrap transport creation and sending in try/catch to handle invalid credentials gracefully.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add mailer module for Gmail SMTP digest emails`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Create digest formatter

**Files:**
- Create: `src/alerts/digest.ts`

**Implementation:**

Export functions to format alert data into an HTML email:

- `AlertItem` type: `{ jobId: number, companyName: string, role: string, type: 'follow_up' | 'no_response', message: string }`

- `formatDigestHtml(alerts: AlertItem[])` — Returns HTML string for the digest email body:
  - Header: "Job Tracker Alert Digest"
  - Date: current date
  - Group alerts by type (follow-ups first, then no-response)
  - Each alert shows company name, role, and specific message
  - Footer with link-like text (the app URL, configurable later)
  - Styled with inline CSS for email compatibility

- `formatDigestPlainText(alerts: AlertItem[])` — Returns plain text fallback version

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add digest email formatter`
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: Create alert scheduler

**Files:**
- Create: `src/alerts/scheduler.ts`

**Implementation:**

Export a function to start the alert scheduler:

- `startAlertScheduler(db)` — Sets up a node-cron job running hourly (`'0 * * * *'`):
  1. Read alert settings from DB via `getAlertSettings(db)`
  2. If `alerts_enabled` is not 'true', skip silently
  3. If `gmail_user` or `gmail_app_password` is empty, log warning and skip
  4. Query `getActiveJobsForAlerts(db)` to get active jobs with computed fields
  5. For each job, check 24-hour dedup: skip if `last_alert_sent_at` is within 24 hours
  6. Evaluate `rules/alerts.lv` via bridge for each eligible job:
     ```
     evaluateRule('rules/alerts.lv', {
       job: { current_stage: stageName, days_since_update: N, follow_up_date_passed: bool, company_name: name },
       alert_threshold: thresholdDays
     })
     ```
  7. Collect all alerts where `follow_up_due` or `no_response` is true
  8. If any alerts collected, batch into digest and send via mailer
  9. For each job that triggered an alert, call `updateJobAlertSentAt(db, jobId)`
  10. Wrap entire cron callback in try/catch — log errors, never crash

- Return the cron task reference for testing/cleanup

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add hourly alert scheduler with Rill evaluation`
<!-- END_TASK_4 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (tasks 5-7) -->
<!-- START_TASK_5 -->
### Task 5: Create settings routes and views

**Files:**
- Create: `src/routes/settings.ts`
- Create: `src/views/settings/index.ts`

**Implementation:**

**Settings view** — `settingsView(settings, message?)`:
- Form with sections:
  - **Alert Configuration**: threshold days (number input), alerts enabled (checkbox)
  - **Gmail Configuration**: Gmail email (text), App password (password input), Recipient email (text)
  - **Password**: Current password, new password, confirm password (links to POST /auth/change-password)
  - **Data**: Export JSON button (links to /export)
- Each section has its own submit button
- Success/error message display at top
- HTMX-enabled forms that swap messages inline

**Settings routes** — Express Router:

**GET /settings** — Read all settings, render settingsView. Return partial or full page based on HX-Request.

**POST /settings/alerts** — Update alert settings:
- Parse body: `alert_threshold_days`, `alerts_enabled`
- Save via `setSetting(db, key, value)` for each
- Re-render settings with success message

**POST /settings/gmail** — Update Gmail credentials:
- Parse body: `gmail_user`, `gmail_app_password`, `alert_recipient_email`
- Save via `setSetting(db, key, value)` for each
- Re-render settings with success message

Mount at `/settings` in server.ts.

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add settings routes and views for alert and Gmail configuration`
<!-- END_TASK_5 -->

<!-- START_TASK_6 -->
### Task 6: Wire scheduler into server and mount settings

**Files:**
- Modify: `src/server.ts`

**Implementation:**

Update `src/server.ts` to:
1. Import and mount settings routes at `/settings`
2. Import `startAlertScheduler` and call it after server starts, passing the db instance
3. Store the cron task reference for graceful shutdown (stop the cron on SIGTERM/SIGINT)

**Verification:**

Start the server, check logs for scheduler initialization:

```bash
npx tsx src/server.ts &
sleep 2
curl http://localhost:3000/settings
kill %1
```

Expected: Server starts, settings page renders, no scheduler errors in logs.

**Commit:** `feat: wire alert scheduler and settings routes into server`
<!-- END_TASK_6 -->

<!-- START_TASK_7 -->
### Task 7: Test alert system

**Verifies:** rill-job-tracker.AC3.1, rill-job-tracker.AC3.2, rill-job-tracker.AC3.3, rill-job-tracker.AC3.4, rill-job-tracker.AC3.5, rill-job-tracker.AC3.6, rill-job-tracker.AC3.7

**Files:**
- Test: `tests/alerts.test.ts`

**Testing:**

Tests must verify each AC listed above. Use a test database and mock/stub the mailer transport (do not send real emails):

- rill-job-tracker.AC3.1: Create job with follow_up_date in the past, run scheduler logic (call the internal function, not the cron wrapper), verify alert generated with type "follow_up"
- rill-job-tracker.AC3.2: Create job with updated_at > threshold days ago, run scheduler logic, verify alert generated with type "no_response". Change threshold via settings, verify different behavior.
- rill-job-tracker.AC3.3: Create 3 jobs triggering different alerts, run scheduler logic, verify all alerts collected in single batch (not 3 separate sends)
- rill-job-tracker.AC3.4: POST /settings/alerts with threshold_days=14, verify setting persisted. Run scheduler with job at 10 days — no alert. Run with job at 15 days — alert fires.
- rill-job-tracker.AC3.5: POST /settings/gmail with credentials, verify settings persisted in database
- rill-job-tracker.AC3.6: Run scheduler, alert fires for job, `last_alert_sent_at` updated. Run scheduler again immediately — same job does NOT generate alert (within 24 hours)
- rill-job-tracker.AC3.7: Configure invalid Gmail credentials, run scheduler — verify it catches error, logs it, does not crash, scheduler remains alive

Follow project testing patterns. Task-implementor generates actual test code at execution time.

**Verification:**

```bash
npx tsx tests/alerts.test.ts
```

Expected: All tests pass.

**Commit:** `test: add alert system integration tests`
<!-- END_TASK_7 -->
<!-- END_SUBCOMPONENT_B -->
