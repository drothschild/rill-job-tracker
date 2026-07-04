import { readFileSync } from 'fs';
import path from 'path';
import { lex, parse, infer, createPreludeTypeEnv, bindType, T, Type } from 'rill-lang';

export interface CheckResult {
  ok: boolean;
  errors: string[];
}

/** Absolute path to the repo-root rules/ directory (typecheck.ts lives in src/rill/). */
const RULES_DIR = path.join(__dirname, '..', '..', 'rules');

/**
 * Type-check a single .lv rule file against a declared input signature.
 * Returns { ok:false, errors:[msg] } on the first type error (RillError message is "Error at line X, col Y: ...").
 */
export function typecheckRule(
  rulePath: string,
  signature: Record<string, Type>
): CheckResult {
  try {
    const source = readFileSync(rulePath, 'utf-8');
    let env = createPreludeTypeEnv();
    for (const [name, type] of Object.entries(signature)) {
      env = bindType(env, name, type);
    }
    infer(parse(lex(source)), env, source);
    return { ok: true, errors: [] };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, errors: [message] };
  }
}

/** The four shipped rules and their declared input signatures. */
const RULE_SIGNATURES: Array<{ file: string; signature: Record<string, Type> }> = [
  {
    file: 'transitions.lv',
    signature: { from_stage: T.String, to_stage: T.String },
  },
  {
    file: 'validation.lv',
    signature: {
      job: T.record({
        company_name: T.String,
        role: T.String,
        salary_min: T.Int,
        salary_max: T.Int,
      }), // closed
    },
  },
  {
    file: 'alerts.lv',
    signature: {
      job: T.record(
        {
          current_stage: T.String,
          follow_up_date_passed: T.Bool,
          days_since_update: T.Int,
        },
        true // open
      ),
      alert_threshold: T.Int,
    },
  },
  {
    file: 'dashboard.lv',
    signature: {
      jobs: T.list(
        T.record(
          { current_stage: T.String, application_type: T.String },
          true // open
        )
      ),
    },
  },
];

/** Type-check all four shipped rules; aggregate errors (prefixing each with its file). */
export function checkAllRules(): CheckResult {
  const errors: string[] = [];
  for (const { file, signature } of RULE_SIGNATURES) {
    const result = typecheckRule(path.join(RULES_DIR, file), signature);
    if (!result.ok) {
      for (const msg of result.errors) errors.push(`${file}: ${msg}`);
    }
  }
  return { ok: errors.length === 0, errors };
}
