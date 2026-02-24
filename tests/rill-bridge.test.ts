import { describe, it, expect } from 'vitest';
import { jsToRill, rillToJs, evaluateRule, evaluateSource } from '../src/rill/bridge';
import { writeFileSync, unlinkSync } from 'fs';
import path from 'path';

describe('Rill Bridge - Type Conversion (AC4.5)', () => {
  describe('jsToRill and rillToJs round-trip conversion', () => {
    it('should convert integer number to Int and back', () => {
      const original = 42;
      const rillValue = jsToRill(original);
      expect(rillValue.kind).toBe('Int');
      expect(rillToJs(rillValue)).toBe(42);
    });

    it('should convert float number to Float and back', () => {
      const original = 3.14159;
      const rillValue = jsToRill(original);
      expect(rillValue.kind).toBe('Float');
      expect(rillToJs(rillValue)).toBe(3.14159);
    });

    it('should convert string to String and back', () => {
      const original = 'hello world';
      const rillValue = jsToRill(original);
      expect(rillValue.kind).toBe('String');
      expect(rillToJs(rillValue)).toBe('hello world');
    });

    it('should convert boolean true to Bool and back', () => {
      const original = true;
      const rillValue = jsToRill(original);
      expect(rillValue.kind).toBe('Bool');
      expect(rillToJs(rillValue)).toBe(true);
    });

    it('should convert boolean false to Bool and back', () => {
      const original = false;
      const rillValue = jsToRill(original);
      expect(rillValue.kind).toBe('Bool');
      expect(rillToJs(rillValue)).toBe(false);
    });

    it('should convert null to Unit and back to null', () => {
      const rillValue = jsToRill(null);
      expect(rillValue.kind).toBe('Unit');
      expect(rillToJs(rillValue)).toBeNull();
    });

    it('should convert undefined to Unit and back to null', () => {
      const rillValue = jsToRill(undefined);
      expect(rillValue.kind).toBe('Unit');
      expect(rillToJs(rillValue)).toBeNull();
    });

    it('should convert array to List and back', () => {
      const original = [1, 2, 3];
      const rillValue = jsToRill(original);
      expect(rillValue.kind).toBe('List');
      const result = rillToJs(rillValue);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should convert array with mixed types to List and back', () => {
      const original = [1, 'hello', true, 3.14];
      const rillValue = jsToRill(original);
      expect(rillValue.kind).toBe('List');
      const result = rillToJs(rillValue);
      expect(result).toEqual([1, 'hello', true, 3.14]);
    });

    it('should convert simple object to Record and back', () => {
      const original = { name: 'Alice', age: 30 };
      const rillValue = jsToRill(original);
      expect(rillValue.kind).toBe('Record');
      const result = rillToJs(rillValue);
      expect(result).toEqual({ name: 'Alice', age: 30 });
    });

    it('should convert nested object with mixed types to Record and back', () => {
      const original = {
        company: 'TechCorp',
        salary_min: 100000,
        salary_max: 150000,
        is_remote: true,
        benefits: ['health', 'dental', '401k']
      };
      const rillValue = jsToRill(original);
      expect(rillValue.kind).toBe('Record');
      const result = rillToJs(rillValue);
      expect(result).toEqual(original);
    });

    it('should convert deeply nested structure', () => {
      const original = {
        name: 'John',
        positions: [
          { company: 'A', salary: 100000 },
          { company: 'B', salary: 120000 }
        ],
        metadata: {
          years_experience: 5,
          willing_to_relocate: false
        }
      };
      const rillValue = jsToRill(original);
      const result = rillToJs(rillValue);
      expect(result).toEqual(original);
    });

    it('should convert empty array to empty List', () => {
      const original: unknown[] = [];
      const rillValue = jsToRill(original);
      expect(rillValue.kind).toBe('List');
      const result = rillToJs(rillValue);
      expect(result).toEqual([]);
    });

    it('should convert empty object to empty Record', () => {
      const original = {};
      const rillValue = jsToRill(original);
      expect(rillValue.kind).toBe('Record');
      const result = rillToJs(rillValue);
      expect(result).toEqual({});
    });
  });

  describe('Tag conversion (Ok/Err types)', () => {
    it('should convert Tag with no args to string', () => {
      const rillValue = { kind: 'Tag' as const, tag: 'Ok', args: [] };
      const result = rillToJs(rillValue);
      expect(result).toBe('Ok');
    });

    it('should convert Tag with single arg to object with tag and value', () => {
      const rillValue = {
        kind: 'Tag' as const,
        tag: 'Err',
        args: [{ kind: 'String' as const, value: 'invalid input' }]
      };
      const result = rillToJs(rillValue);
      expect(result).toEqual({ tag: 'Err', value: 'invalid input' });
    });

    it('should convert Tag with multiple args to object with tag and values', () => {
      const rillValue = {
        kind: 'Tag' as const,
        tag: 'SomeTag',
        args: [
          { kind: 'Int' as const, value: 1 },
          { kind: 'String' as const, value: 'test' }
        ]
      };
      const result = rillToJs(rillValue);
      expect(result).toEqual({ tag: 'SomeTag', values: [1, 'test'] });
    });
  });
});

describe('Rill Bridge - Source Evaluation (AC4.5)', () => {
  it('should evaluate simple arithmetic with injected variable', () => {
    const result = evaluateSource('x + 1', { x: 5 });
    expect(result.success).toBe(true);
    expect(result.value).toBe(6);
  });

  it('should evaluate record field access with injected record', () => {
    const result = evaluateSource('job.salary', { job: { salary: 100000 } });
    expect(result.success).toBe(true);
    expect(result.value).toBe(100000);
  });

  it('should evaluate nested record access', () => {
    const result = evaluateSource('person.address.city', {
      person: { address: { city: 'New York' } }
    });
    expect(result.success).toBe(true);
    expect(result.value).toBe('New York');
  });

  it('should evaluate boolean comparison', () => {
    const result = evaluateSource('5 > 3', {});
    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
  });

  it('should evaluate equality comparison', () => {
    const result = evaluateSource('name == "Alice"', { name: 'Alice' });
    expect(result.success).toBe(true);
    expect(result.value).toBe(true);
  });

  it('should evaluate string concatenation with injected variables', () => {
    const result = evaluateSource('company ++ " - " ++ role', {
      company: 'TechCorp',
      role: 'Engineer'
    });
    expect(result.success).toBe(true);
    expect(result.value).toBe('TechCorp - Engineer');
  });

  it('should evaluate list length', () => {
    const result = evaluateSource('length(items)', { items: [1, 2, 3, 4, 5] });
    expect(result.success).toBe(true);
    expect(result.value).toBe(5);
  });

  it('should evaluate match expression on injected variable', () => {
    const result = evaluateSource(
      'match status { "active" -> 1, "inactive" -> 0, _ -> -1 }',
      { status: 'active' }
    );
    expect(result.success).toBe(true);
    expect(result.value).toBe(1);
  });
});

describe('Rill Bridge - Error Handling (AC4.7)', () => {
  it('should return error object for syntax error in Rill source', () => {
    const result = evaluateSource('this is not valid rill', {});
    expect(result.success).toBe(false);
    expect(result.value).toBeNull();
    expect(result.error).toBeDefined();
    expect(typeof result.error).toBe('string');
  });

  it('should return error object for undefined variable reference', () => {
    const result = evaluateSource('undefined_variable + 1', {});
    expect(result.success).toBe(false);
    expect(result.value).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('should return error object for accessing undefined field', () => {
    const result = evaluateSource('job.nonexistent', { job: { salary: 100000 } });
    expect(result.success).toBe(false);
    expect(result.value).toBeNull();
    expect(result.error).toBeDefined();
  });

  it('should return error object for nonexistent rule file', () => {
    const result = evaluateRule('/nonexistent/path/to/rule.lv', {});
    expect(result.success).toBe(false);
    expect(result.value).toBeNull();
    expect(result.error).toBeDefined();
    expect(result.error).toContain('ENOENT');
  });

  it('should not crash server on evaluation error and return graceful error', () => {
    const result = evaluateSource('invalid syntax here !!!', {});
    // The error should be caught and returned, not thrown
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('should handle type mismatch errors gracefully', () => {
    const result = evaluateSource('x + "string"', { x: 5 });
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe('Rill Bridge - evaluateRule with files', () => {
  it('should evaluate a temporary rule file and return success', () => {
    const tempFile = path.join(process.cwd(), '.test-rill-' + Date.now() + '.lv');
    try {
      writeFileSync(tempFile, 'x + 10');
      const result = evaluateRule(tempFile, { x: 5 });
      expect(result.success).toBe(true);
      expect(result.value).toBe(15);
    } finally {
      unlinkSync(tempFile);
    }
  });

  it('should evaluate a temporary rule file with record data', () => {
    const tempFile = path.join(process.cwd(), '.test-rill-' + Date.now() + '.lv');
    try {
      writeFileSync(
        tempFile,
        'match job.stage { "Applied" -> "new", _ -> "processing" }'
      );
      const result = evaluateRule(tempFile, {
        job: { stage: 'Applied', company: 'TechCorp' }
      });
      expect(result.success).toBe(true);
      expect(result.value).toBe('new');
    } finally {
      unlinkSync(tempFile);
    }
  });

  it('should support hot-reload of rule files', () => {
    const tempFile = path.join(process.cwd(), '.test-rill-hotreload-' + Date.now() + '.lv');
    try {
      // First version of rule
      writeFileSync(tempFile, 'x + 1');
      const result1 = evaluateRule(tempFile, { x: 10 });
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(11);

      // Modify the rule file (hot-reload)
      writeFileSync(tempFile, 'x * 2');
      const result2 = evaluateRule(tempFile, { x: 10 });
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(20);
    } finally {
      unlinkSync(tempFile);
    }
  });
});

describe('Rill Bridge - Complex rule scenarios', () => {
  it('should evaluate job validation-like rule', () => {
    const rule = `
      let has_company = length(job.company_name) > 0 in
      let has_role = length(job.role) > 0 in
      match (has_company, has_role) {
        (false, _) -> "error: company required",
        (_, false) -> "error: role required",
        _ -> "valid"
      }
    `;
    const result = evaluateSource(rule, {
      job: { company_name: 'TechCorp', role: 'Engineer' }
    });
    expect(result.success).toBe(true);
    expect(result.value).toBe('valid');
  });

  it('should evaluate stage transition rule', () => {
    const rule = `
      match (from_stage, to_stage) {
        ("Applied", "Phone Screen") -> "allowed",
        ("Phone Screen", "Interview") -> "allowed",
        _ -> "not allowed"
      }
    `;
    const result = evaluateSource(rule, {
      from_stage: 'Applied',
      to_stage: 'Phone Screen'
    });
    expect(result.success).toBe(true);
    expect(result.value).toBe('allowed');
  });

  it('should return error tag for invalid transition', () => {
    const rule = `
      match (from_stage, to_stage) {
        ("Applied", "Phone Screen") -> Ok("allowed"),
        _ -> Err("Invalid transition from " ++ from_stage ++ " to " ++ to_stage)
      }
    `;
    const result = evaluateSource(rule, {
      from_stage: 'Applied',
      to_stage: 'Offer'
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      tag: 'Err',
      value: 'Invalid transition from Applied to Offer'
    });
  });
});
