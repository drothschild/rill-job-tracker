import { readFileSync, readdirSync } from 'fs';
import path from 'path';
import { lex, parseProgram, infer, createPreludeTypeEnv, bindType, checkRuleSource, Type } from 'rill-lang';

export interface CheckResult {
  ok: boolean;
  errors: string[];
}

/** Absolute path to the repo-root rules/ directory (typecheck.ts lives in src/rill/). */
const RULES_DIR = path.join(__dirname, '..', '..', 'rules');

/**
 * Type-check a single .lv rule file against an explicitly provided input signature.
 * Kept for ad-hoc checks; shipped rules declare their own signature in-file via a
 * `rule` header and are covered by checkAllRules. A header in the file is tolerated
 * (the provided signature is what gets bound).
 * Returns { ok:false, errors:[msg] } on the first type error (RillError message is "Error at line X, col Y: ...").
 */
export function typecheckRule(
  rulePath: string,
  signature: Record<string, Type>
): CheckResult {
  try {
    const source = readFileSync(rulePath, 'utf-8');
    const program = parseProgram(lex(source));
    let env = createPreludeTypeEnv();
    for (const [name, type] of Object.entries(signature)) {
      env = bindType(env, name, type);
    }
    infer(program.body, env, source);
    return { ok: true, errors: [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [message] };
  }
}

/**
 * Type-check every .lv file in the rules directory against its own in-file
 * `rule` header (input types AND declared return type). No registration step:
 * a new rule file is covered the moment it exists, and a headerless file is an
 * error rather than a silent coverage gap. Errors are prefixed with the filename.
 */
export function checkAllRules(rulesDir: string = RULES_DIR): CheckResult {
  const errors: string[] = [];
  const files = readdirSync(rulesDir).filter((f) => f.endsWith('.lv')).sort();
  for (const file of files) {
    const source = readFileSync(path.join(rulesDir, file), 'utf-8');
    const result = checkRuleSource(source);
    if (!result.ok) {
      for (const msg of result.errors) errors.push(`${file}: ${msg}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
