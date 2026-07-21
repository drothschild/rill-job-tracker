import { readFileSync } from 'fs';
import { lex, parseProgram, evaluate, createPrelude, Value, rillToJs as rillLangRillToJs, checkRuleSource, RuleHeader } from 'rill-lang';

// Canonical rillToJs from rill-lang (outputs { tag: "X" } for no-arg tags)
export const rillToJs = rillLangRillToJs;

// Value-directed JS → Rill conversion (no type information needed at conversion time)
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
    // Special handling for tag objects: { tag: "Constructor" } with optional value field
    // indicates a Rill tag constructor (canonical form at the bridge)
    const keys = Object.keys(value);
    if (keys.length >= 1 && (value as any).tag !== undefined && typeof (value as any).tag === 'string') {
      const tagValue = (value as any).tag;
      const payload = (value as any).value;
      if (payload === undefined) {
        // No-arg tag: { tag: "Research" }
        return { kind: 'Tag', tag: tagValue, args: [] };
      } else {
        // Tagged value: { tag: "Err", value: "message" }
        return { kind: 'Tag', tag: tagValue, args: [jsToRill(payload)] };
      }
    }

    const fields = new Map<string, Value>();
    for (const [k, v] of Object.entries(value)) {
      fields.set(k, jsToRill(v));
    }
    return { kind: 'Record', fields };
  }
  return { kind: 'Unit' };
}

// Cache for rule headers (path → header)
const ruleHeaderCache = new Map<string, RuleHeader | null>();

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

    // Get or cache the rule header via checkRuleSource
    let header = ruleHeaderCache.get(rulePath);
    if (header === undefined) {
      const checkResult = checkRuleSource(source);
      header = checkResult.header;
      ruleHeaderCache.set(rulePath, header);
    }

    return evaluateSource(source, data, header);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, value: null, error: message };
  }
}

// Evaluate a Rill source string with injected data and optional header
export function evaluateSource(
  source: string,
  data: Record<string, unknown>,
  header?: RuleHeader | null
): RuleResult {
  try {
    const env = createPrelude();
    for (const [key, val] of Object.entries(data)) {
      env.set(key, jsToRill(val));
    }
    const tokens = lex(source);
    const program = parseProgram(tokens);

    // Use provided header or fall back to parsing it
    const ruleHeader = header ?? program.header;

    // A rule header names the exact inputs the host must inject — fail the
    // injection boundary with the parameter's name instead of mid-evaluation.
    if (ruleHeader) {
      const missing = ruleHeader.params
        .map((p) => p.name)
        .filter((name) => !(name in data));
      if (missing.length > 0) {
        return {
          success: false,
          value: null,
          error: `rule '${ruleHeader.name}' is missing injected input(s): ${missing.join(', ')}`,
        };
      }
    }
    const result = evaluate(program.body, env);
    return { success: true, value: rillToJs(result) };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, value: null, error: message };
  }
}
