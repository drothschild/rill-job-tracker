import { describe, it, expect } from 'vitest';
import path from 'path';
import { checkAllRules, typecheckRule } from '../src/rill/typecheck';
import { T } from 'rill-lang';

const RULES_DIR = path.join(__dirname, '..', 'rules');

describe('typecheck', () => {
  describe('checkAllRules', () => {
    it('AC1.1: checkAllRules() returns { ok: true, errors: [] } for all shipped rules', () => {
      const result = checkAllRules();
      expect(result.ok).toBe(true);
      expect(result.errors).toEqual([]);
    });
  });

  describe('dashboard.lv', () => {
    it('AC1.2: dashboard.lv type-checks via row unification', () => {
      const signature = {
        jobs: T.list(
          T.record(
            { current_stage: T.String, application_type: T.String },
            true // open
          )
        ),
      };
      const result = typecheckRule(path.join(RULES_DIR, 'dashboard.lv'), signature);
      expect(result.ok).toBe(true);
    });
  });

  describe('validation.lv', () => {
    it('AC1.3: validation.lv type-checks with the closed job record', () => {
      const signature = {
        job: T.record({
          company_name: T.String,
          role: T.String,
          salary_min: T.Int,
          salary_max: T.Int,
        }), // closed
      };
      const result = typecheckRule(path.join(RULES_DIR, 'validation.lv'), signature);
      expect(result.ok).toBe(true);
    });
  });
});
