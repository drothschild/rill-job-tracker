# Test Requirements — Rill Job Tracker

This document maps every acceptance criterion to either an automated test or a human verification item.
Each entry identifies the implementation phase and task that covers the criterion, the test type, and
the expected test file path (for automated tests) or verification steps (for human verification items).

---

## AC1: Job Lifecycle Management (13 criteria)

### AC1.1 — Job can be created with all fields (company name, role, link, salary range, application type, job description snippet, location)

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.1                                       |
| Type                | Success                                                      |
| Implementation      | Phase 4, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/jobs.test.ts`                                         |
| Test description    | POST /jobs with all fields (company_name, role, link, salary_min, salary_max, application_type, job_description, location) creates a job. GET /jobs/:id returns all submitted fields with correct values. |

---

### AC1.2 — Job can be edited and changes persist

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.2                                       |
| Type                | Success                                                      |
| Implementation      | Phase 4, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/jobs.test.ts`                                         |
| Test description    | Create a job via POST /jobs. PUT /jobs/:id with changed company_name and role. GET /jobs/:id returns updated values. Verify updated_at timestamp changed. |

---

### AC1.3 — Contacts with notes can be added to a job with name, role, email, LinkedIn URL

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.3                                       |
| Type                | Success                                                      |
| Implementation      | Phase 4, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/jobs.test.ts`                                         |
| Test description    | POST /jobs/:id/contacts with name, role, email, linkedin_url, and notes. Verify contact is created and linked to the job. GET /jobs/:id returns the contact data in the response. |

---

### AC1.4 — Interactions (call, email, note) can be logged per contact

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.4                                       |
| Type                | Success                                                      |
| Implementation      | Phase 4, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/jobs.test.ts`                                         |
| Test description    | Create a job, add a contact. POST /jobs/:id/contacts/:cid/interactions with type "call" and content. Repeat for types "email" and "note". Verify each interaction is recorded with correct type, content, and occurred_at timestamp. |

---

### AC1.5 — Freeform notes can be added per job

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.5                                       |
| Type                | Success                                                      |
| Implementation      | Phase 4, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/jobs.test.ts`                                         |
| Test description    | POST /jobs/:id/notes with content text. GET /jobs/:id returns the note in the response. Add a second note and verify both appear ordered by created_at DESC. |

---

### AC1.6 — Jobs can be tagged as warm (referral) or cold (blind)

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.6                                       |
| Type                | Success                                                      |
| Implementation      | Phase 4, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/jobs.test.ts`                                         |
| Test description    | POST /jobs with application_type "warm", verify job created with warm tag. POST /jobs with application_type "cold", verify job created with cold tag. Verify tags persist and display correctly on GET /jobs/:id. |

---

### AC1.7 — Jobs move through pipeline stages (Applied, Phone Screen, Interview, Offer, Rejected)

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.7                                       |
| Type                | Success                                                      |
| Implementation      | Phase 5, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/pipeline.test.ts`                                     |
| Test description    | Create a job (starts at Applied). POST /pipeline/transition to move to Phone Screen — succeeds. Verify job's current_stage_id updated. Continue transitioning through all valid stages to verify the full pipeline path works. |

---

### AC1.8 — Custom sub-labels can be added to stage transitions (e.g., "Technical Interview")

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.8                                       |
| Type                | Success                                                      |
| Implementation      | Phase 5, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/pipeline.test.ts`                                     |
| Test description    | POST /pipeline/transition with sub_label "Technical Interview". Query stage_transitions table and verify sub_label is stored and associated with the correct transition record. |

---

### AC1.9 — Stage transition history is recorded with timestamps

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.9                                       |
| Type                | Success                                                      |
| Implementation      | Phase 5, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/pipeline.test.ts`                                     |
| Test description    | Perform a stage transition via POST /pipeline/transition. Query stage_transitions for the job. Verify the record contains from_stage_id, to_stage_id, and a valid transitioned_at timestamp. Perform a second transition and verify both records exist ordered by transitioned_at. |

---

### AC1.10 — Dashboard shows total applications, response rate, and interview conversion rate

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.10                                      |
| Type                | Success                                                      |
| Implementation      | Phase 6, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/dashboard.test.ts`                                    |
| Test description    | Seed 5 jobs in various stages (e.g., 2 Applied, 1 Phone Screen, 1 Interview, 1 Offer). GET /dashboard (or GET /). Verify response HTML contains correct total (5), response rate (60% — 3 out of 5 moved past Applied), and interview conversion rate (40% — 2 in Interview or Offer). Also test with 0 jobs to verify 0% rates without division-by-zero errors. |

---

### AC1.11 — Dashboard charts render on both mobile (375px) and desktop viewports

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.11                                      |
| Type                | Success                                                      |
| Implementation      | Phase 6, Task 4 (HTML structure); Phase 8, Task 5 (mobile polish) |
| Verification        | **Split: Automated + Human**                                 |

**Automated portion:**

| Test type           | Integration                                                  |
|---------------------|--------------------------------------------------------------|
| Test file           | `tests/dashboard.test.ts`                                    |
| Test description    | GET /dashboard returns HTML containing all three chart canvas elements (`chart-applications-timeline`, `chart-stage-funnel`, `chart-warm-cold`), the Chart.js CDN script tag, and responsive TailwindCSS classes (e.g., `md:grid-cols-2`). |

**Human verification portion:**

| Justification       | Visual rendering at specific viewport widths (375px mobile vs desktop) cannot be validated by an HTTP integration test. Chart.js rendering requires a browser with a canvas context. |
|---------------------|--------------------------------------------------------------|
| Verification steps  | 1. Start the server with `npm run dev`. 2. Open the dashboard in a browser. 3. Open DevTools, set viewport to 375px width. 4. Verify charts stack vertically, are fully visible, and do not overflow horizontally. 5. Expand viewport to 1280px. 6. Verify charts display in a 2-column grid. 7. Verify all three charts render data correctly at both widths. |

---

### AC1.12 — Invalid stage transitions are rejected (e.g., Applied directly to Offer)

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.12                                      |
| Type                | Failure                                                      |
| Implementation      | Phase 5, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/pipeline.test.ts`                                     |
| Test description    | Create a job in Applied stage. POST /pipeline/transition attempting to move directly to Offer. Verify response status is 422. Verify the job's current_stage_id remains unchanged (still Applied). Verify the error message references the invalid transition. |

---

### AC1.13 — Job creation with salary_min > salary_max is rejected

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC1.13                                      |
| Type                | Failure                                                      |
| Implementation      | Phase 4, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/jobs.test.ts`                                         |
| Test description    | POST /jobs with salary_min=100000 and salary_max=50000. Verify the request is rejected (Rill validation.lv returns Err). Verify no job was created in the database. Verify the error message mentions salary. |

---

## AC2: Authentication (7 criteria)

### AC2.1 — First-run setup screen allows setting initial password

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC2.1                                       |
| Type                | Success                                                      |
| Implementation      | Phase 2, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/auth.test.ts`                                         |
| Test description    | With a fresh database (no password_hash in settings), POST /auth/setup with matching password and confirm_password. Verify a password_hash is created in the settings table. Verify the response redirects to / (dashboard). Verify the session is authenticated (subsequent requests to protected routes succeed). |

---

### AC2.2 — Login with correct password creates session and redirects to dashboard

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC2.2                                       |
| Type                | Success                                                      |
| Implementation      | Phase 2, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/auth.test.ts`                                         |
| Test description    | Set up a password via /auth/setup. POST /auth/login with the correct password. Verify the response redirects to /. Verify a session cookie (Set-Cookie header) is returned. Verify subsequent requests with the cookie access protected routes successfully. |

---

### AC2.3 — Session persists across page refreshes (cookie-based)

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC2.3                                       |
| Type                | Success                                                      |
| Implementation      | Phase 2, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/auth.test.ts`                                         |
| Test description    | Log in and capture the session cookie. Make a GET request to a protected route with the cookie — verify 200 OK. Make a second GET request to a different protected route with the same cookie — verify 200 OK (session persists). |

---

### AC2.4 — Logout destroys session and redirects to login

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC2.4                                       |
| Type                | Success                                                      |
| Implementation      | Phase 2, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/auth.test.ts`                                         |
| Test description    | Log in and capture the session cookie. POST /auth/logout with the cookie. Verify the response redirects to /auth/login. Use the same cookie to access a protected route — verify it redirects to /auth/login (session destroyed). |

---

### AC2.5 — Password can be changed from settings

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC2.5                                       |
| Type                | Success                                                      |
| Implementation      | Phase 2, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/auth.test.ts`                                         |
| Test description    | Set up password, log in. POST /auth/change-password with correct current_password and matching new_password + confirm_password. Verify success response. Log out. POST /auth/login with the old password — verify it fails. POST /auth/login with the new password — verify it succeeds. |

---

### AC2.6 — Login with wrong password returns error, no session created

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC2.6                                       |
| Type                | Failure                                                      |
| Implementation      | Phase 2, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/auth.test.ts`                                         |
| Test description    | Set up a password. POST /auth/login with an incorrect password. Verify the response contains an error message. Verify no authenticated session is created (subsequent requests to protected routes are redirected to /auth/login). |

---

### AC2.7 — All non-auth routes redirect to login when no valid session

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC2.7                                       |
| Type                | Failure                                                      |
| Implementation      | Phase 2, Task 4                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/auth.test.ts`                                         |
| Test description    | With no session, GET / — verify redirect to /auth/setup (first run, no password) or /auth/login (password exists). GET /jobs — verify redirect. GET /pipeline — verify redirect. GET /settings — verify redirect. POST /jobs — verify redirect. Verify that /auth/login and /auth/setup are accessible without a session. |

---

## AC3: Email Alerts (7 criteria)

### AC3.1 — Email digest sent when follow-up date has passed on any active job

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC3.1                                       |
| Type                | Success                                                      |
| Implementation      | Phase 7, Task 7                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/alerts.test.ts`                                       |
| Test description    | Create a job with follow_up_date set to a date in the past and current_stage "Applied" (active). Run the scheduler logic function (not the cron wrapper). Verify an alert is generated with type "follow_up". The mailer transport is mocked/stubbed so no real email is sent — verify the mock was called with the expected alert data. |

---

### AC3.2 — Email digest sent when a job has had no response for Y days (configurable)

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC3.2                                       |
| Type                | Success                                                      |
| Implementation      | Phase 7, Task 7                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/alerts.test.ts`                                       |
| Test description    | Set alert_threshold_days to 7 in settings. Create a job with updated_at set to 10 days ago. Run scheduler logic. Verify "no_response" alert is generated. Change threshold to 14 via settings. Run scheduler logic again for a fresh job at 10 days — verify no alert fires. Run with job at 15 days — verify alert fires. |

---

### AC3.3 — Multiple alerts batched into single digest email

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC3.3                                       |
| Type                | Success                                                      |
| Implementation      | Phase 7, Task 7                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/alerts.test.ts`                                       |
| Test description    | Create 3 jobs that each trigger an alert (mix of follow_up and no_response). Run scheduler logic. Verify the mock mailer's sendDigestEmail is called exactly once (not 3 times). Verify the single call includes all 3 alerts in the batch. |

---

### AC3.4 — Alert thresholds configurable from settings page

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC3.4                                       |
| Type                | Success                                                      |
| Implementation      | Phase 7, Task 7                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/alerts.test.ts`                                       |
| Test description    | POST /settings/alerts with alert_threshold_days=14 and alerts_enabled=true. Verify settings are persisted in the database. GET /settings and verify the form displays the updated values. Run scheduler with a job at 10 days since update — no alert (below threshold). Run with a job at 15 days — alert fires (above threshold). |

---

### AC3.5 — Gmail SMTP credentials configurable from settings page

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC3.5                                       |
| Type                | Success                                                      |
| Implementation      | Phase 7, Task 7                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/alerts.test.ts`                                       |
| Test description    | POST /settings/gmail with gmail_user, gmail_app_password, and alert_recipient_email. Verify all three settings are persisted in the settings table. GET /settings and verify the Gmail section displays the saved email and recipient (password should be masked or not displayed). |

---

### AC3.6 — Same alert not re-sent within 24 hours for the same job

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC3.6                                       |
| Type                | Edge                                                         |
| Implementation      | Phase 7, Task 7                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/alerts.test.ts`                                       |
| Test description    | Create a job that triggers an alert. Run scheduler logic — verify alert fires and last_alert_sent_at is updated on the job. Run scheduler logic again immediately — verify the same job does NOT generate a new alert (dedup within 24 hours). Manually set last_alert_sent_at to 25 hours ago. Run scheduler again — verify alert fires this time. |

---

### AC3.7 — Alert scheduler continues running if Gmail credentials are invalid (logs error, does not crash)

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC3.7                                       |
| Type                | Failure                                                      |
| Implementation      | Phase 7, Task 7                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/alerts.test.ts`                                       |
| Test description    | Configure invalid Gmail credentials in settings (e.g., empty or malformed). Create a job that would trigger an alert. Run scheduler logic. Verify the function completes without throwing an exception. Verify the error is logged (capture console.error or logger output). Verify the scheduler remains functional by running it a second time — it should complete again without crashing. |

---

## AC4: Rill DSL Rule Engine (7 criteria)

### AC4.1 — Stage transition rules evaluated via Rill .lv file

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC4.1                                       |
| Type                | Success                                                      |
| Implementation      | Phase 3, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Unit                                                         |
| Test file           | `tests/rill-rules.test.ts`                                   |
| Test description    | Call `evaluateRule('rules/transitions.lv', { from_stage: "Applied", to_stage: "Phone Screen" })` — verify result indicates Ok/allowed. Test all 7 valid transitions (Applied->Phone Screen, Applied->Rejected, Phone Screen->Interview, Phone Screen->Rejected, Interview->Offer, Interview->Rejected, Offer->Rejected) — all return Ok. Test invalid transitions (Applied->Offer, Applied->Interview, Phone Screen->Offer) — all return Err with descriptive message. |

---

### AC4.2 — Alert conditions evaluated via Rill .lv file

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC4.2                                       |
| Type                | Success                                                      |
| Implementation      | Phase 3, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Unit                                                         |
| Test file           | `tests/rill-rules.test.ts`                                   |
| Test description    | Evaluate alerts.lv with a job that has follow_up_date_passed: true and current_stage "Applied" — verify follow_up_due is true. Evaluate with days_since_update > alert_threshold — verify no_response is true. Evaluate with current_stage "Rejected" — verify is_active is false regardless of other conditions. Evaluate with current_stage "Offer" — verify is_active is false. |

---

### AC4.3 — Input validation evaluated via Rill .lv file

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC4.3                                       |
| Type                | Success                                                      |
| Implementation      | Phase 3, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Unit                                                         |
| Test file           | `tests/rill-rules.test.ts`                                   |
| Test description    | Evaluate validation.lv with a complete, valid job record — verify Ok result. Evaluate with empty company_name — verify Err with "Company name is required". Evaluate with empty role — verify Err with "Role is required". Evaluate with salary_min > salary_max — verify Err with salary message. Evaluate with salary_min=0 and salary_max=0 — verify Ok (no salary specified). |

---

### AC4.4 — Dashboard metrics computed via Rill .lv file

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC4.4                                       |
| Type                | Success                                                      |
| Implementation      | Phase 3, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Unit                                                         |
| Test file           | `tests/rill-rules.test.ts`                                   |
| Test description    | Evaluate dashboard.lv with an empty jobs list — verify total is 0. Evaluate with a mix of jobs in various stages — verify total, responded (non-Applied count), interviewed (Interview + Offer count), warm_count, and cold_count are all correct. |

---

### AC4.5 — JS objects correctly convert to Rill Value types and back via bridge module

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC4.5                                       |
| Type                | Success                                                      |
| Implementation      | Phase 3, Task 3                                              |
| Verification        | Automated                                                    |
| Test type           | Unit                                                         |
| Test file           | `tests/rill-bridge.test.ts`                                  |
| Test description    | Test round-trip conversion (jsToRill then rillToJs) for: integer (42 -> Int -> 42), float (3.14 -> Float -> 3.14), string ("hello" -> String -> "hello"), boolean (true -> Bool -> true), null (null -> Unit -> null), array ([1,2,3] -> List -> [1,2,3]), object ({a:1, b:"x"} -> Record -> {a:1, b:"x"}), and nested objects with mixed types. Verify each round-trip produces the original value. |

---

### AC4.6 — Editing a .lv file changes behavior without server restart

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC4.6                                       |
| Type                | Success                                                      |
| Implementation      | Phase 3, Task 6                                              |
| Verification        | Automated                                                    |
| Test type           | Unit                                                         |
| Test file           | `tests/rill-rules.test.ts`                                   |
| Test description    | Create a temporary .lv file that returns a known value (e.g., `42`). Call `evaluateRule` and verify it returns 42. Overwrite the file with a new script that returns a different value (e.g., `99`). Call `evaluateRule` again on the same path without restarting the process. Verify it returns 99 (hot-reload confirmed). Clean up the temporary file. |

---

### AC4.7 — Rill evaluation errors return meaningful error messages, do not crash server

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC4.7                                       |
| Type                | Failure                                                      |
| Implementation      | Phase 3, Task 3                                              |
| Verification        | Automated                                                    |
| Test type           | Unit                                                         |
| Test file           | `tests/rill-bridge.test.ts`                                  |
| Test description    | Call `evaluateSource` with a Rill syntax error — verify result is { success: false, error: "..." } with a non-empty error string. Call `evaluateSource` referencing an undefined variable — verify it returns an error result without throwing. Call `evaluateRule` with a nonexistent file path — verify it returns an error result without throwing. Verify no unhandled exceptions propagate in any error case. |

---

## AC5: JSON Export (3 criteria)

### AC5.1 — Export downloads a JSON file containing all jobs with nested contacts, interactions, notes, and stage history

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC5.1                                       |
| Type                | Success                                                      |
| Implementation      | Phase 8, Task 3                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/export.test.ts`                                       |
| Test description    | Seed database with 2 jobs, each having contacts (with interactions), notes, and stage transitions. GET /export. Parse the JSON response. Verify the top-level structure has `exported_at` and `jobs` array. Verify jobs array has 2 entries. For each job, verify it contains nested `contacts` (each with nested `interactions`), `notes`, and `stage_history` arrays with correct data matching what was seeded. Verify Content-Disposition header contains `attachment; filename="job-tracker-export-` and `.json"`. |

---

### AC5.2 — Exported JSON is valid and parseable

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC5.2                                       |
| Type                | Success                                                      |
| Implementation      | Phase 8, Task 3                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/export.test.ts`                                       |
| Test description    | Seed database with data. GET /export. Verify `JSON.parse(response.text)` succeeds without throwing. Verify Content-Type header is `application/json`. Verify the parsed object matches the expected schema (has `exported_at` as string, `jobs` as array). |

---

### AC5.3 — Export with zero jobs returns valid empty JSON structure

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Criterion ID        | rill-job-tracker.AC5.3                                       |
| Type                | Edge                                                         |
| Implementation      | Phase 8, Task 3                                              |
| Verification        | Automated                                                    |
| Test type           | Integration                                                  |
| Test file           | `tests/export.test.ts`                                       |
| Test description    | With a fresh database (no jobs). GET /export. Verify `JSON.parse(response.text)` succeeds. Verify the structure is `{ exported_at: "<valid ISO date>", jobs: [] }` — exported_at is present and jobs is an empty array. |

---

## Summary Table

| Criterion ID | AC Group       | Test Type   | Automated? | Test File                 | Phase | Task |
|--------------|---------------|-------------|------------|---------------------------|-------|------|
| AC1.1        | Job Lifecycle  | Integration | Yes        | `tests/jobs.test.ts`      | 4     | 6    |
| AC1.2        | Job Lifecycle  | Integration | Yes        | `tests/jobs.test.ts`      | 4     | 6    |
| AC1.3        | Job Lifecycle  | Integration | Yes        | `tests/jobs.test.ts`      | 4     | 6    |
| AC1.4        | Job Lifecycle  | Integration | Yes        | `tests/jobs.test.ts`      | 4     | 6    |
| AC1.5        | Job Lifecycle  | Integration | Yes        | `tests/jobs.test.ts`      | 4     | 6    |
| AC1.6        | Job Lifecycle  | Integration | Yes        | `tests/jobs.test.ts`      | 4     | 6    |
| AC1.7        | Job Lifecycle  | Integration | Yes        | `tests/pipeline.test.ts`  | 5     | 4    |
| AC1.8        | Job Lifecycle  | Integration | Yes        | `tests/pipeline.test.ts`  | 5     | 4    |
| AC1.9        | Job Lifecycle  | Integration | Yes        | `tests/pipeline.test.ts`  | 5     | 4    |
| AC1.10       | Job Lifecycle  | Integration | Yes        | `tests/dashboard.test.ts` | 6     | 4    |
| AC1.11       | Job Lifecycle  | Integration + Human | Partial | `tests/dashboard.test.ts` | 6+8 | 4+5 |
| AC1.12       | Job Lifecycle  | Integration | Yes        | `tests/pipeline.test.ts`  | 5     | 4    |
| AC1.13       | Job Lifecycle  | Integration | Yes        | `tests/jobs.test.ts`      | 4     | 6    |
| AC2.1        | Authentication | Integration | Yes        | `tests/auth.test.ts`      | 2     | 4    |
| AC2.2        | Authentication | Integration | Yes        | `tests/auth.test.ts`      | 2     | 4    |
| AC2.3        | Authentication | Integration | Yes        | `tests/auth.test.ts`      | 2     | 4    |
| AC2.4        | Authentication | Integration | Yes        | `tests/auth.test.ts`      | 2     | 4    |
| AC2.5        | Authentication | Integration | Yes        | `tests/auth.test.ts`      | 2     | 4    |
| AC2.6        | Authentication | Integration | Yes        | `tests/auth.test.ts`      | 2     | 4    |
| AC2.7        | Authentication | Integration | Yes        | `tests/auth.test.ts`      | 2     | 4    |
| AC3.1        | Email Alerts   | Integration | Yes        | `tests/alerts.test.ts`    | 7     | 7    |
| AC3.2        | Email Alerts   | Integration | Yes        | `tests/alerts.test.ts`    | 7     | 7    |
| AC3.3        | Email Alerts   | Integration | Yes        | `tests/alerts.test.ts`    | 7     | 7    |
| AC3.4        | Email Alerts   | Integration | Yes        | `tests/alerts.test.ts`    | 7     | 7    |
| AC3.5        | Email Alerts   | Integration | Yes        | `tests/alerts.test.ts`    | 7     | 7    |
| AC3.6        | Email Alerts   | Integration | Yes        | `tests/alerts.test.ts`    | 7     | 7    |
| AC3.7        | Email Alerts   | Integration | Yes        | `tests/alerts.test.ts`    | 7     | 7    |
| AC4.1        | Rill DSL       | Unit        | Yes        | `tests/rill-rules.test.ts`| 3     | 6    |
| AC4.2        | Rill DSL       | Unit        | Yes        | `tests/rill-rules.test.ts`| 3     | 6    |
| AC4.3        | Rill DSL       | Unit        | Yes        | `tests/rill-rules.test.ts`| 3     | 6    |
| AC4.4        | Rill DSL       | Unit        | Yes        | `tests/rill-rules.test.ts`| 3     | 6    |
| AC4.5        | Rill DSL       | Unit        | Yes        | `tests/rill-bridge.test.ts`| 3    | 3    |
| AC4.6        | Rill DSL       | Unit        | Yes        | `tests/rill-rules.test.ts`| 3     | 6    |
| AC4.7        | Rill DSL       | Unit        | Yes        | `tests/rill-bridge.test.ts`| 3    | 3    |
| AC5.1        | JSON Export    | Integration | Yes        | `tests/export.test.ts`    | 8     | 3    |
| AC5.2        | JSON Export    | Integration | Yes        | `tests/export.test.ts`    | 8     | 3    |
| AC5.3        | JSON Export    | Integration | Yes        | `tests/export.test.ts`    | 8     | 3    |

---

## Test File Inventory

| Test File                   | AC Criteria Covered                          | Test Framework | Phase |
|-----------------------------|----------------------------------------------|----------------|-------|
| `tests/auth.test.ts`        | AC2.1 - AC2.7                                | vitest + supertest | 2  |
| `tests/rill-bridge.test.ts` | AC4.5, AC4.7                                 | vitest         | 3     |
| `tests/rill-rules.test.ts`  | AC4.1 - AC4.4, AC4.6                         | vitest         | 3     |
| `tests/jobs.test.ts`        | AC1.1 - AC1.6, AC1.13                        | vitest + supertest | 4  |
| `tests/pipeline.test.ts`    | AC1.7 - AC1.9, AC1.12                        | vitest + supertest | 5  |
| `tests/dashboard.test.ts`   | AC1.10, AC1.11 (automated portion)           | vitest + supertest | 6  |
| `tests/alerts.test.ts`      | AC3.1 - AC3.7                                | vitest + supertest | 7  |
| `tests/export.test.ts`      | AC5.1 - AC5.3                                | vitest + supertest | 8  |

---

## Human Verification Items

Only **one** criterion requires human verification (in addition to its automated portion):

### AC1.11 — Dashboard charts render on both mobile (375px) and desktop viewports

| Field               | Value                                                        |
|---------------------|--------------------------------------------------------------|
| Justification       | Chart.js renders to an HTML `<canvas>` element which requires a real browser with a canvas rendering context. HTTP-level integration tests can verify the HTML structure, CSS classes, and Chart.js configuration data are present, but cannot confirm the visual rendering at specific viewport widths. Viewport-dependent responsive behavior (column stacking, chart sizing) requires visual inspection. |
| Verification approach | Manual browser testing                                      |
| Steps               | 1. Start the development server: `npm run dev` |
|                     | 2. Open `http://localhost:3000` in a browser (Chrome recommended) |
|                     | 3. Seed at least 5 jobs across different stages and application types |
|                     | 4. Navigate to the dashboard |
|                     | 5. Open browser DevTools and set viewport width to 375px (iPhone SE size) |
|                     | 6. Verify: Stats cards stack vertically (1 column) |
|                     | 7. Verify: All three charts (Applications Over Time, Stage Funnel, Warm vs Cold) are visible, fully rendered, and do not overflow the viewport horizontally |
|                     | 8. Verify: Chart labels and legends are readable at 375px |
|                     | 9. Expand viewport to 1280px (desktop) |
|                     | 10. Verify: Stats cards display in a 3-column grid |
|                     | 11. Verify: Charts display in a 2-column grid layout |
|                     | 12. Verify: Charts resize correctly and remain interactive (hover tooltips work) |

---

## Coverage Statistics

- **Total acceptance criteria:** 37
- **Fully automated:** 36 (97.3%)
- **Partially automated + human verification:** 1 (2.7%)
- **Fully human-only:** 0 (0%)
- **Test files:** 8
- **Unit tests:** 2 files (Rill bridge and rule engine)
- **Integration tests:** 6 files (auth, jobs, pipeline, dashboard, alerts, export)
