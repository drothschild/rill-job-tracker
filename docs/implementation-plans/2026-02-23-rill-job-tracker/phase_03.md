# Rill Job Tracker Implementation Plan - Phase 3

**Goal:** Working integration between Node.js and Rill interpreter with bridge module and all four rule files

**Architecture:** Bridge module converts JS objects to Rill Value types, evaluates .lv rule scripts with injected context, converts results back. Rill project modified to export library API.

**Tech Stack:** TypeScript, rill-lang (local dependency), fs for hot-reload of .lv files

**Scope:** 8 phases from original design (phase 3 of 8)

**Codebase verified:** 2026-02-23 — Rill project at /Users/davidrothschild/Projects/rill-lang/ confirmed. Key findings:
- `runSource()` only takes source string, no custom env
- `evaluate(expr, env)` accepts custom `Map<string, Value>` environment
- `createPrelude()` returns base env with builtins
- Rill `index.ts` is CLI entry point, does NOT export library API
- Must modify Rill project to add library exports (user confirmed)
- Rill uses `match` for conditionals (no if/else keyword)
- Records use `{ field: value }`, access via `.field`
- Functions: `fn(x) -> body`, auto-curried multi-arg
- Tags: `Ok(value)`, `Err(msg)`, uppercase constructors

---

## Acceptance Criteria Coverage

This phase implements and tests:

### rill-job-tracker.AC4: Rill DSL rule engine
- **rill-job-tracker.AC4.1 Success:** Stage transition rules evaluated via Rill `.lv` file
- **rill-job-tracker.AC4.2 Success:** Alert conditions evaluated via Rill `.lv` file
- **rill-job-tracker.AC4.3 Success:** Input validation evaluated via Rill `.lv` file
- **rill-job-tracker.AC4.4 Success:** Dashboard metrics computed via Rill `.lv` file
- **rill-job-tracker.AC4.5 Success:** JS objects correctly convert to Rill Value types and back via bridge module
- **rill-job-tracker.AC4.6 Success:** Editing a `.lv` file changes behavior without server restart
- **rill-job-tracker.AC4.7 Failure:** Rill evaluation errors return meaningful error messages, do not crash server

---

<!-- START_TASK_1 -->
### Task 1: Add library exports to Rill project

**Files:**
- Create: `/Users/davidrothschild/Projects/rill-lang/src/lib.ts`
- Modify: `/Users/davidrothschild/Projects/rill-lang/package.json`

**Implementation:**

Create `src/lib.ts` in the Rill project that re-exports the library API needed by consumers:

```typescript
// Library API exports for embedding Rill as a rule engine
export { evaluate } from './evaluator';
export { createPrelude } from './prelude';
export { lex } from './lexer';
export { parse } from './parser';
export { Value, prettyPrint } from './values';
export { runSource } from './runner';
```

Update the Rill project's `package.json` to add an `exports` field that exposes both the CLI and library entry points:

```json
{
  "main": "dist/index.js",
  "exports": {
    ".": "./dist/lib.js",
    "./cli": "./dist/index.js"
  }
}
```

This keeps the CLI working via `bin` while allowing library consumers to `import { evaluate, createPrelude, Value } from 'rill-lang'`.

**Step 1: Create the lib.ts file**

**Step 2: Update package.json exports field**

**Step 3: Rebuild the Rill project**

```bash
cd /Users/davidrothschild/Projects/rill-lang && npm run build
```

Expected: Build succeeds, `dist/lib.js` and `dist/lib.d.ts` are generated.

**Step 4: Verify exports work**

```bash
node -e "const rill = require('/Users/davidrothschild/Projects/rill-lang/dist/lib.js'); console.log(typeof rill.evaluate, typeof rill.createPrelude, typeof rill.lex, typeof rill.parse)"
```

Expected: `function function function function`

**Step 5: Commit in the Rill project**

```bash
cd /Users/davidrothschild/Projects/rill-lang && git add src/lib.ts package.json && git commit -m "feat: add library exports for embedding as rule engine"
```

**Step 6: Reinstall in job-tracker to pick up changes**

```bash
cd /Users/davidrothschild/job-tracker-for-david && npm install
```
<!-- END_TASK_1 -->

<!-- START_SUBCOMPONENT_A (tasks 2-3) -->
<!-- START_TASK_2 -->
### Task 2: Create the Rill bridge module

**Files:**
- Create: `src/rill/bridge.ts`

**Implementation:**

The bridge module has three responsibilities:
1. Convert JS values to Rill `Value` types (`jsToRill`)
2. Convert Rill `Value` types back to JS (`rillToJs`)
3. Evaluate a `.lv` rule file with injected JS data and return JS results (`evaluateRule`)

```typescript
import { readFileSync } from 'fs';
import { lex, parse, evaluate, createPrelude, Value, prettyPrint } from 'rill-lang';

// JS → Rill conversion
export function jsToRill(value: unknown): Value {
  if (value === null || value === undefined) {
    return { kind: 'Unit' };
  }
  if (typeof value === 'boolean') {
    return { kind: 'Bool', value };
  }
  if (typeof value === 'number') {
    return Number.isInteger(value)
      ? { kind: 'Int', value }
      : { kind: 'Float', value };
  }
  if (typeof value === 'string') {
    return { kind: 'String', value };
  }
  if (Array.isArray(value)) {
    return { kind: 'List', elements: value.map(jsToRill) };
  }
  if (typeof value === 'object') {
    const fields = new Map<string, Value>();
    for (const [k, v] of Object.entries(value)) {
      fields.set(k, jsToRill(v));
    }
    return { kind: 'Record', fields };
  }
  return { kind: 'Unit' };
}

// Rill → JS conversion
export function rillToJs(value: Value): unknown {
  switch (value.kind) {
    case 'Int':
    case 'Float':
      return value.value;
    case 'String':
      return value.value;
    case 'Bool':
      return value.value;
    case 'Unit':
      return null;
    case 'List':
      return value.elements.map(rillToJs);
    case 'Tuple':
      return value.elements.map(rillToJs);
    case 'Record': {
      const obj: Record<string, unknown> = {};
      for (const [k, v] of value.fields) {
        obj[k] = rillToJs(v);
      }
      return obj;
    }
    case 'Tag':
      if (value.args.length === 0) return value.tag;
      if (value.args.length === 1) return { tag: value.tag, value: rillToJs(value.args[0]) };
      return { tag: value.tag, values: value.args.map(rillToJs) };
    case 'Closure':
    case 'BuiltinFn':
      return `<function:${value.kind === 'Closure' ? 'closure' : value.name}>`;
  }
}

// Rule evaluation result
export interface RuleResult {
  success: boolean;
  value: unknown;
  error?: string;
}

// Evaluate a .lv rule file with injected data
export function evaluateRule(
  rulePath: string,
  data: Record<string, unknown>
): RuleResult {
  try {
    const source = readFileSync(rulePath, 'utf-8');
    return evaluateSource(source, data);
  } catch (err: any) {
    return { success: false, value: null, error: err.message };
  }
}

// Evaluate a Rill source string with injected data
export function evaluateSource(
  source: string,
  data: Record<string, unknown>
): RuleResult {
  try {
    const env = createPrelude();
    for (const [key, val] of Object.entries(data)) {
      env.set(key, jsToRill(val));
    }
    const tokens = lex(source);
    const ast = parse(tokens);
    const result = evaluate(ast, env);
    return { success: true, value: rillToJs(result) };
  } catch (err: any) {
    return { success: false, value: null, error: err.message };
  }
}
```

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Commit:** `feat: add Rill bridge module for JS-Rill type conversion and evaluation`
<!-- END_TASK_2 -->

<!-- START_TASK_3 -->
### Task 3: Test bridge module type conversion and evaluation

**Verifies:** rill-job-tracker.AC4.5, rill-job-tracker.AC4.7

**Files:**
- Test: `tests/rill-bridge.test.ts`

**Testing:**

Tests must verify each AC listed above:
- rill-job-tracker.AC4.5: Test round-trip conversion for all JS types:
  - `number` (integer) → `Int` → `number`
  - `number` (float) → `Float` → `number`
  - `string` → `String` → `string`
  - `boolean` → `Bool` → `boolean`
  - `null/undefined` → `Unit` → `null`
  - `Array` → `List` → `Array`
  - `Object` → `Record` → `Object`
  - Nested objects with mixed types convert correctly
- rill-job-tracker.AC4.7: Test error handling:
  - Syntax errors in Rill source return `{ success: false, error: "..." }`
  - Undefined variable references return error, don't crash
  - `evaluateRule` with nonexistent file path returns error, doesn't crash

Also test `evaluateSource` with injected data:
  - Simple arithmetic with injected variable: `evaluateSource("x + 1", { x: 5 })` returns `{ success: true, value: 6 }`
  - Injected record field access: `evaluateSource("job.salary", { job: { salary: 100000 } })` returns value `100000`

Follow project testing patterns. Task-implementor generates actual test code at execution time.

**Verification:**

```bash
npx tsx tests/rill-bridge.test.ts
```

Expected: All tests pass.

**Commit:** `test: add bridge module type conversion and error handling tests`
<!-- END_TASK_3 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_SUBCOMPONENT_B (tasks 4-6) -->
<!-- START_TASK_4 -->
### Task 4: Write transitions.lv rule file

**Files:**
- Create: `rules/` directory (if not exists: `mkdir -p rules`)
- Create: `rules/transitions.lv`

**Implementation:**

The transitions rule validates whether a stage transition is allowed. It receives `from_stage` (string) and `to_stage` (string) as injected variables and returns `Ok("allowed")` or `Err("reason")`.

Valid transitions (design spec):
- Applied → Phone Screen
- Applied → Rejected
- Phone Screen → Interview
- Phone Screen → Rejected
- Interview → Offer
- Interview → Rejected
- Offer → Rejected

The rule uses match on a tuple of (from_stage, to_stage):

```rill
-- Stage transition validation
-- Injected: from_stage (String), to_stage (String)
-- Returns: Ok("allowed") or Err("Invalid transition from X to Y")

match (from_stage, to_stage) {
  ("Applied", "Phone Screen") -> Ok("allowed"),
  ("Applied", "Rejected") -> Ok("allowed"),
  ("Phone Screen", "Interview") -> Ok("allowed"),
  ("Phone Screen", "Rejected") -> Ok("allowed"),
  ("Interview", "Offer") -> Ok("allowed"),
  ("Interview", "Rejected") -> Ok("allowed"),
  ("Offer", "Rejected") -> Ok("allowed"),
  _ -> Err("Invalid transition from " ++ from_stage ++ " to " ++ to_stage)
}
```

**Verification:**

```bash
npx tsc --noEmit
```

Expected: Compiles (no TS in .lv files, but verify project still compiles).

**Commit:** `feat: add stage transition validation rule`
<!-- END_TASK_4 -->

<!-- START_TASK_5 -->
### Task 5: Write validation.lv, alerts.lv, and dashboard.lv rule files

**Files:**
- Create: `rules/validation.lv`
- Create: `rules/alerts.lv`
- Create: `rules/dashboard.lv`

**Implementation:**

**validation.lv** — Validates job input data. Receives `job` record with fields (company_name, role, salary_min, salary_max). Returns `Ok("valid")` or `Err("reason")`.

```rill
-- Job input validation
-- Injected: job (Record with company_name, role, salary_min, salary_max)
-- Returns: Ok("valid") or Err("reason")

let has_company = length(job.company_name) > 0 in
let has_role = length(job.role) > 0 in
let salary_valid = match (job.salary_min, job.salary_max) {
  (0, 0) -> true,
  (min, max) -> min <= max
} in
match (has_company, has_role, salary_valid) {
  (false, _, _) -> Err("Company name is required"),
  (_, false, _) -> Err("Role is required"),
  (_, _, false) -> Err("Minimum salary cannot exceed maximum salary"),
  _ -> Ok("valid")
}
```

**alerts.lv** — Evaluates alert conditions for a job. Receives `job` record with fields (current_stage, days_since_update, follow_up_date_passed, last_alert_hours_ago). Returns a list of alert records.

```rill
-- Alert condition evaluation
-- Injected: job (Record), alert_threshold (Int - days of silence)
-- Returns: List of { type: String, message: String } records

let is_active = match job.current_stage {
  "Rejected" -> false,
  "Offer" -> false,
  _ -> true
} in
let alerts = [] in
let alerts = match (is_active, job.follow_up_date_passed) {
  (true, true) -> [{ type: "follow_up", message: "Follow-up due for " ++ job.company_name }],
  _ -> alerts
} in
let alerts = match (is_active, job.days_since_update > alert_threshold) {
  (true, true) -> let new_alert = { type: "no_response", message: "No response from " ++ job.company_name ++ " in " ++ to_string(job.days_since_update) ++ " days" } in
    fold(alerts, fn(acc, a) -> acc, [new_alert]) |> fn(_) -> [new_alert] |> fn(a) -> fold(a, fn(acc, x) -> acc, alerts),
  _ -> alerts
} in
alerts
```

Note: The alerts.lv rule above is a first draft. The Rill language lacks list append/concat for lists. The implementation may need to be simplified to return individual alert checks rather than building a list. A simpler approach:

```rill
-- Alert condition evaluation (simplified)
-- Injected: job (Record), alert_threshold (Int)
-- Returns: Record { follow_up_due: Bool, no_response: Bool, is_active: Bool }

let is_active = match job.current_stage {
  "Rejected" -> false,
  "Offer" -> false,
  _ -> true
} in
{
  is_active: is_active,
  follow_up_due: match (is_active, job.follow_up_date_passed) {
    (true, true) -> true,
    _ -> false
  },
  no_response: match (is_active, job.days_since_update > alert_threshold) {
    (true, true) -> true,
    _ -> false
  }
}
```

Use the simplified version — the bridge module will construct the alert messages in TypeScript based on the boolean results.

**dashboard.lv** — Computes dashboard metrics from job data. Receives `jobs` (list of job records). Returns a metrics record.

```rill
-- Dashboard metrics computation
-- Injected: jobs (List of Records with current_stage, application_type)
-- Returns: Record { total, response_rate, interview_rate, warm_count, cold_count }

let total = length(jobs) in
let responded = length(filter(fn(j) -> match j.current_stage {
  "Applied" -> false,
  _ -> true
}, jobs)) in
let interviewed = length(filter(fn(j) -> match j.current_stage {
  "Interview" -> true,
  "Offer" -> true,
  _ -> false
}, jobs)) in
let warm_count = length(filter(fn(j) -> j.application_type == "warm", jobs)) in
let cold_count = length(filter(fn(j) -> j.application_type == "cold", jobs)) in
{
  total: total,
  responded: responded,
  interviewed: interviewed,
  warm_count: warm_count,
  cold_count: cold_count
}
```

Note: Rate computation (division) happens in TypeScript to avoid division-by-zero in Rill (integer division with zero total would crash). The bridge returns counts and TypeScript computes percentages.

**Verification:**

```bash
ls rules/
```

Expected: `alerts.lv  dashboard.lv  transitions.lv  validation.lv`

**Commit:** `feat: add validation, alerts, and dashboard rule files`
<!-- END_TASK_5 -->

<!-- START_TASK_6 -->
### Task 6: Test all rule files via bridge

**Verifies:** rill-job-tracker.AC4.1, rill-job-tracker.AC4.2, rill-job-tracker.AC4.3, rill-job-tracker.AC4.4, rill-job-tracker.AC4.6

**Files:**
- Test: `tests/rill-rules.test.ts`

**Testing:**

Tests must verify each AC listed above:

- rill-job-tracker.AC4.1: Transition rules:
  - `evaluateRule("rules/transitions.lv", { from_stage: "Applied", to_stage: "Phone Screen" })` returns Ok result
  - `evaluateRule("rules/transitions.lv", { from_stage: "Applied", to_stage: "Offer" })` returns Err result (invalid skip)
  - All valid transitions from the design spec return Ok
  - All invalid transitions return Err with descriptive message

- rill-job-tracker.AC4.2: Alert rules:
  - Job with `follow_up_date_passed: true` and active stage returns `follow_up_due: true`
  - Job with `days_since_update > alert_threshold` returns `no_response: true`
  - Job with `current_stage: "Rejected"` returns `is_active: false` regardless of other conditions
  - Job with `current_stage: "Offer"` returns `is_active: false`

- rill-job-tracker.AC4.3: Validation rules:
  - Valid job with all required fields returns Ok
  - Job with empty company_name returns Err
  - Job with empty role returns Err
  - Job with salary_min > salary_max returns Err
  - Job with salary_min == 0 and salary_max == 0 passes (no salary specified)

- rill-job-tracker.AC4.4: Dashboard rules:
  - Empty jobs list returns total: 0
  - Mix of stages returns correct counts for responded and interviewed
  - Warm/cold counts match input data

- rill-job-tracker.AC4.6: Hot reload:
  - Evaluate a rule file, modify the file on disk, re-evaluate same path — result changes without restart
  - Use a temporary file for this test, not the production rule files

Follow project testing patterns. Task-implementor generates actual test code at execution time.

**Verification:**

```bash
npx tsx tests/rill-rules.test.ts
```

Expected: All tests pass.

**Commit:** `test: add comprehensive tests for all Rill rule files`
<!-- END_TASK_6 -->
<!-- END_SUBCOMPONENT_B -->
