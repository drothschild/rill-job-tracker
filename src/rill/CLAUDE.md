# Rill integration

Last verified: 2026-07-21

## Purpose
Runs the `.lv` rules in `rules/` through the embedded Rill language. Rules are
loaded and executed at runtime, so a broken rule is otherwise only caught when a
request happens to hit it — this dir adds a load-time safety net.

## Contracts
- **Boot-time type-check is a hard gate.** `checkAllRules()` type-checks every
  `.lv` file in `rules/` against its own in-file `rule` header. `server.ts`
  calls it in the `require.main` block BEFORE `app.listen`; on failure it logs
  the errors and `process.exit(1)`. The server must never start serving with
  rules that don't type-check. Non-exhaustive matches over unions are caught here.
- **Each rule declares its own signature in-file.** The `rule name(params) -> Type`
  header at the top of each `.lv` file is the single source of truth for that
  rule's inputs and output. `checkAllRules()` globs the directory — a new rule
  file is covered the moment it exists, and a headerless file FAILS the boot
  gate (no silent coverage gaps). There is no external signature registry.
- **`bridge.ts` validates injection against the header.** Before evaluating, it
  checks that every declared param is present in the injected `data` and fails
  with the missing param's name. Rule headers are cached per-file for performance.
  Route code must inject exactly what the header declares.
- **Canonical tag convention (outbound).** Tags without payload return `{ tag: "X" }`;
  tags with single payload return `{ tag: "X", value: payload }`. No bare-string tags.
  This is the rill-lang canonical convention re-exported from `bridge.ts`.
- **Exposes**: `checkAllRules(rulesDir?)` and `typecheckRule(rulePath, signature)`
  (explicit-signature variant for ad-hoc checks), both returning `{ ok, errors }`
  (never throw). Error messages are source-located, prefixed by filename in
  `checkAllRules`.

## Stage Union Convention
Rules that work with stages use a declared `Stage` union in the rule file:
```
type Stage = Research | Applied | PhoneScreen | Interview | Offer | Rejected
```
The host passes stages as tag objects: `{ tag: "PhoneScreen" }`. The utility
`stageToTag(dbString)` maps DB display strings to tag objects; `tagToStageString`
reverses it.

## Invariants
- Rule string-length checks use `str_len` (String -> Int), not `length`
  (List -> Int).
- Record types in headers are closed unless they end with `..` (open row) —
  open only when the injected record legitimately carries extra fields the
  rule doesn't read.

## Dependencies
- **Uses**: `rill-lang` public API (`checkRuleSource`, `rillToJs`, `jsToRill`,
  `parseProgram`, `lex`, `evaluate`, `createPrelude`, `infer`, `createPreludeTypeEnv`,
  `bindType`, `T`, `Type`).
- **Bridge**: re-exports canonical `rillToJs` from rill-lang; implements
  value-directed `jsToRill` for simple runtime injection without type metadata.
- **Boundary**: `bridge.ts` (the request hot path) does a cheap missing-param
  check per evaluation; full type-checking happens once at boot.

## Key Files
- `typecheck.ts` - `checkAllRules` (header-driven, globs rules/), `typecheckRule`
- `bridge.ts` - request-time rule execution + injection-boundary param check + canonical rillToJs
- `../utils/stageMapping.ts` - `stageToTag`, `tagToStageString` converters

## Gotchas
- Changing a rule's injected inputs means updating its in-file header AND the
  route code that builds `data` — the boot gate catches header/body mismatches,
  and the bridge catches missing injections at request time, but it cannot know
  a route passes extra junk keys (extras are ignored).
- `evaluateSource` (string variant) accepts headerless sources for tests/REPL
  use; only files shipped in `rules/` must carry headers.
- Route code must check for `{ tag: "Err", value: message }` pattern, not bare
  error strings (canonical tag convention).
