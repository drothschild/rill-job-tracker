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

    it('AC2.1: broken validation.lv with undeclared field read returns ok:false and located error', () => {
      const signature = {
        job: T.record({
          company_name: T.String,
          role: T.String,
          salary_min: T.Int,
          salary_max: T.Int,
        }), // closed
      };
      const brokenFixturePath = path.join(__dirname, 'fixtures', 'broken-validation.lv');
      const result = typecheckRule(brokenFixturePath, signature);

      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(1);
      expect(result.errors[0]).toContain('compnay_name');
      expect(result.errors[0]).toMatch(/line \d+, col \d+/);
    });
  });
});

describe('rule headers (in-file signatures)', () => {
  const FIXTURES_DIR = path.join(__dirname, 'fixtures');

  it('checkAllRules covers every .lv file in the directory without registration', () => {
    const result = checkAllRules(FIXTURES_DIR);
    expect(result.ok).toBe(false);
    // headed-good.lv passes; the other two produce errors prefixed by filename
    expect(result.errors.some(e => e.startsWith('headed-broken.lv:'))).toBe(true);
    expect(result.errors.some(e => e.startsWith('headerless.lv:'))).toBe(true);
    expect(result.errors.some(e => e.startsWith('headed-good.lv:'))).toBe(false);
  });

  it('a headerless rule file is an error, not silently skipped', () => {
    const result = checkAllRules(FIXTURES_DIR);
    const err = result.errors.find(e => e.startsWith('headerless.lv:'));
    expect(err).toMatch(/header/i);
  });

  it('a body/return-type mismatch is reported with the rule name', () => {
    const result = checkAllRules(FIXTURES_DIR);
    const err = result.errors.find(e => e.startsWith('headed-broken.lv:'));
    expect(err).toBeDefined();
  });

  it('all shipped rules carry headers and pass without RULE_SIGNATURES', () => {
    const result = checkAllRules();
    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });
});
