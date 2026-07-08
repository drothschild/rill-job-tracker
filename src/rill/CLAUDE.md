# Rill integration

Last verified: 2026-07-07

## Purpose
Runs the `.lv` rules in `rules/` through the embedded Rill language. Rules are
loaded and executed at runtime, so a broken rule is otherwise only caught when a
request happens to hit it — this dir adds a load-time safety net.

## Contracts
- **Boot-time type-check is a hard gate.** `checkAllRules()` type-checks every
  `.lv` file in `rules/` against its own in-file `rule` header. `server.ts`
  calls it in the `require.main` block BEFORE `app.listen`; on failure it logs
  the errors and `process.exit(1)`. The server must never start serving with
  rules that don't type-check.
- **Each rule declares its own signature in-file.** The `rule name(params) -> Type`
  header at the top of each `.lv` file is the single source of truth for that
  rule's inputs and output. `checkAllRules()` globs the directory — a new rule
  file is covered the moment it exists, and a headerless file FAILS the boot
  gate (no silent coverage gaps). There is no external signature registry.
- **`bridge.ts` validates injection against the header.** Before evaluating, it
  checks that every declared param is present in the injected `data` and fails
  with the missing param's name. Route code must inject exactly what the header
  declares.
- **Exposes**: `checkAllRules(rulesDir?)` and `typecheckRule(rulePath, signature)`
  (explicit-signature variant for ad-hoc checks), both returning `{ ok, errors }`
  (never throw). Error messages are source-located, prefixed by filename in
  `checkAllRules`.

## Invariants
- Rule string-length checks use `str_len` (String -> Int), not `length`
  (List -> Int).
- Record types in headers are closed unless they end with `..` (open row) —
  open only when the injected record legitimately carries extra fields the
  rule doesn't read.

## Dependencies
- **Uses**: `rill-lang` public API (`checkRuleSource`, `parseProgram`, `lex`,
  `evaluate`, `createPrelude`, `infer`, `createPreludeTypeEnv`, `bindType`, `T`, `Type`).
- **Boundary**: `bridge.ts` (the request hot path) does a cheap missing-param
  check per evaluation; full type-checking happens once at boot.

## Key Files
- `typecheck.ts` - `checkAllRules` (header-driven, globs rules/), `typecheckRule`
- `bridge.ts` - request-time rule execution + injection-boundary param check

## Gotchas
- Changing a rule's injected inputs means updating its in-file header AND the
  route code that builds `data` — the boot gate catches header/body mismatches,
  and the bridge catches missing injections at request time, but it cannot know
  a route passes extra junk keys (extras are ignored).
- `evaluateSource` (string variant) accepts headerless sources for tests/REPL
  use; only files shipped in `rules/` must carry headers.
