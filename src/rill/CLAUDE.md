# Rill integration

Last verified: 2026-07-02

## Purpose
Runs the `.lv` rules in `rules/` through the embedded Rill language. Rules are
loaded and executed at runtime, so a broken rule is otherwise only caught when a
request happens to hit it — this dir adds a load-time safety net.

## Contracts
- **Boot-time type-check is a hard gate.** `checkAllRules()` type-checks every
  shipped rule against its declared signature. `server.ts` calls it in the
  `require.main` block BEFORE `app.listen`; on failure it logs the errors and
  `process.exit(1)`. The server must never start serving with rules that don't
  type-check.
- **`RULE_SIGNATURES` in `typecheck.ts` is the source of truth for rule inputs.**
  Each entry declares the shape of the record/values injected into that rule.
  These signatures MUST match what `bridge.ts` actually injects at request time —
  they are a hand-maintained mirror, not derived. Update both together.
- **Exposes**: `typecheckRule(rulePath, signature)` and `checkAllRules()`, both
  returning `{ ok, errors }` (never throw). Error messages are source-located
  (`Error at line X, col Y: ...`), prefixed by filename in `checkAllRules`.

## Invariants
- Rule string-length checks use `str_len` (String -> Int), not `length`
  (List -> Int). `length(job.company_name)` fails the type-check; see
  `rules/validation.lv`.
- Record signatures are closed unless the rule reads fields beyond the declared
  set — those pass an open row (`T.record(fields, true)`).

## Dependencies
- **Uses**: `rill-lang` public API (`infer`, `createPreludeTypeEnv`, `bindType`,
  `T`, `Type`).
- **Boundary**: `bridge.ts` (the request hot path) is deliberately NOT
  type-checked per-request; the boot-time check is the guarantee instead.

## Key Files
- `typecheck.ts` - `typecheckRule`, `checkAllRules`, `RULE_SIGNATURES`
- `bridge.ts` - request-time rule execution (unchanged by the type-check work)

## Gotchas
- Adding/renaming a rule file or changing its injected inputs requires updating
  `RULE_SIGNATURES`, or boot silently stops covering it (or wrongly fails).
