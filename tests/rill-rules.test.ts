import { describe, it, expect } from 'vitest';
import { evaluateRule, evaluateSource } from '../src/rill/bridge';
import { writeFileSync, unlinkSync } from 'fs';
import path from 'path';

describe('Rill Rules - Stage Transitions (AC4.1)', () => {
  const rulePath = path.join(process.cwd(), 'rules/transitions.lv');

  describe('Research stage transitions', () => {
    it('should allow transition from Research to Applied', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Research',
        to_stage: 'Applied'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Research to Rejected', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Research',
        to_stage: 'Rejected'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Applied to Research', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Applied',
        to_stage: 'Research'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Phone Screen to Research', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Phone Screen',
        to_stage: 'Research'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Interview to Research', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Interview',
        to_stage: 'Research'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Offer to Research', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Offer',
        to_stage: 'Research'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Rejected to Research', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Rejected',
        to_stage: 'Research'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });
  });

  describe('Valid transitions', () => {
    it('should allow transition from Applied to Phone Screen', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Applied',
        to_stage: 'Phone Screen'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Applied to Rejected', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Applied',
        to_stage: 'Rejected'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Phone Screen to Interview', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Phone Screen',
        to_stage: 'Interview'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Phone Screen to Rejected', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Phone Screen',
        to_stage: 'Rejected'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Interview to Offer', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Interview',
        to_stage: 'Offer'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Interview to Rejected', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Interview',
        to_stage: 'Rejected'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });

    it('should allow transition from Offer to Rejected', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Offer',
        to_stage: 'Rejected'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'allowed' });
    });
  });

  describe('Invalid transitions', () => {
    it('should reject transition from Applied to Offer (invalid skip)', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Applied',
        to_stage: 'Offer'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Applied to Offer'
      });
    });

    it('should reject transition from Applied to Interview', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Applied',
        to_stage: 'Interview'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Applied to Interview'
      });
    });

    it('should reject transition from Phone Screen to Offer (invalid skip)', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Phone Screen',
        to_stage: 'Offer'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Phone Screen to Offer'
      });
    });

    it('should reject transition from Interview to Phone Screen (backwards)', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Interview',
        to_stage: 'Phone Screen'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Interview to Phone Screen'
      });
    });

    it('should reject transition from Rejected to Applied', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Rejected',
        to_stage: 'Applied'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Rejected to Applied'
      });
    });

    it('should reject transition from Research to Phone Screen', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Research',
        to_stage: 'Phone Screen'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Research to Phone Screen'
      });
    });

    it('should reject transition from Research to Interview', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Research',
        to_stage: 'Interview'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Research to Interview'
      });
    });

    it('should reject transition from Phone Screen to Applied', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Phone Screen',
        to_stage: 'Applied'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Phone Screen to Applied'
      });
    });

    it('should reject transition from Interview to Applied', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Interview',
        to_stage: 'Applied'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Interview to Applied'
      });
    });

    it('should reject transition from Offer to Applied', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Offer',
        to_stage: 'Applied'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Offer to Applied'
      });
    });

    it('should reject transition from Offer to Interview', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Offer',
        to_stage: 'Interview'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Offer to Interview'
      });
    });

    it('should reject transition from Rejected to Offer', () => {
      const result = evaluateRule(rulePath, {
        from_stage: 'Rejected',
        to_stage: 'Offer'
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Invalid transition from Rejected to Offer'
      });
    });
  });
});

describe('Rill Rules - Alert Conditions (AC4.2)', () => {
  const rulePath = path.join(process.cwd(), 'rules/alerts.lv');

  it('should set is_active to false for Rejected stage', () => {
    const result = evaluateRule(rulePath, {
      job: {
        current_stage: 'Rejected',
        follow_up_date_passed: true,
        days_since_update: 100
      },
      alert_threshold: 14
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      is_active: false,
      follow_up_due: false,
      no_response: false
    });
  });

  it('should set is_active to false for Offer stage', () => {
    const result = evaluateRule(rulePath, {
      job: {
        current_stage: 'Offer',
        follow_up_date_passed: true,
        days_since_update: 100
      },
      alert_threshold: 14
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      is_active: false,
      follow_up_due: false,
      no_response: false
    });
  });

  it('should set follow_up_due to true when job is active and follow_up date passed', () => {
    const result = evaluateRule(rulePath, {
      job: {
        current_stage: 'Applied',
        follow_up_date_passed: true,
        days_since_update: 5
      },
      alert_threshold: 14
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      is_active: true,
      follow_up_due: true,
      no_response: false
    });
  });

  it('should set no_response to true when days since update exceeds threshold', () => {
    const result = evaluateRule(rulePath, {
      job: {
        current_stage: 'Phone Screen',
        follow_up_date_passed: false,
        days_since_update: 21
      },
      alert_threshold: 14
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      is_active: true,
      follow_up_due: false,
      no_response: true
    });
  });

  it('should handle job with Interview stage correctly', () => {
    const result = evaluateRule(rulePath, {
      job: {
        current_stage: 'Interview',
        follow_up_date_passed: true,
        days_since_update: 30
      },
      alert_threshold: 14
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      is_active: true,
      follow_up_due: true,
      no_response: true
    });
  });

  it('should handle job with no alerts', () => {
    const result = evaluateRule(rulePath, {
      job: {
        current_stage: 'Applied',
        follow_up_date_passed: false,
        days_since_update: 5
      },
      alert_threshold: 14
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      is_active: true,
      follow_up_due: false,
      no_response: false
    });
  });
});

describe('Rill Rules - Input Validation (AC4.3)', () => {
  const rulePath = path.join(process.cwd(), 'rules/validation.lv');

  describe('Valid inputs', () => {
    it('should validate a complete job with all fields', () => {
      const result = evaluateRule(rulePath, {
        job: {
          company_name: 'TechCorp',
          role: 'Software Engineer',
          salary_min: 100000,
          salary_max: 150000
        }
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'valid' });
    });

    it('should validate job with no salary specified (0, 0)', () => {
      const result = evaluateRule(rulePath, {
        job: {
          company_name: 'StartupInc',
          role: 'Product Manager',
          salary_min: 0,
          salary_max: 0
        }
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'valid' });
    });

    it('should validate job with salary_min equal to salary_max', () => {
      const result = evaluateRule(rulePath, {
        job: {
          company_name: 'BigCorp',
          role: 'Analyst',
          salary_min: 80000,
          salary_max: 80000
        }
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({ tag: 'Ok', value: 'valid' });
    });
  });

  describe('Invalid inputs', () => {
    it('should reject job with empty company name', () => {
      const result = evaluateRule(rulePath, {
        job: {
          company_name: '',
          role: 'Software Engineer',
          salary_min: 100000,
          salary_max: 150000
        }
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Company name is required'
      });
    });

    it('should reject job with empty role', () => {
      const result = evaluateRule(rulePath, {
        job: {
          company_name: 'TechCorp',
          role: '',
          salary_min: 100000,
          salary_max: 150000
        }
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Role is required'
      });
    });

    it('should reject job with salary_min greater than salary_max', () => {
      const result = evaluateRule(rulePath, {
        job: {
          company_name: 'TechCorp',
          role: 'Software Engineer',
          salary_min: 150000,
          salary_max: 100000
        }
      });
      expect(result.success).toBe(true);
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Minimum salary cannot exceed maximum salary'
      });
    });

    it('should check company name before role', () => {
      const result = evaluateRule(rulePath, {
        job: {
          company_name: '',
          role: '',
          salary_min: 100000,
          salary_max: 50000
        }
      });
      expect(result.success).toBe(true);
      // Should return company error (checked first)
      expect(result.value).toEqual({
        tag: 'Err',
        value: 'Company name is required'
      });
    });
  });
});

describe('Rill Rules - Dashboard Metrics (AC4.4)', () => {
  const rulePath = path.join(process.cwd(), 'rules/dashboard.lv');

  it('should compute metrics for empty jobs list', () => {
    const result = evaluateRule(rulePath, {
      jobs: []
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      total: 0,
      responded: 0,
      interviewed: 0,
      warm_count: 0,
      cold_count: 0
    });
  });

  it('should compute metrics with single Applied job', () => {
    const result = evaluateRule(rulePath, {
      jobs: [
        {
          current_stage: 'Applied',
          application_type: 'cold'
        }
      ]
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      total: 1,
      responded: 0,
      interviewed: 0,
      warm_count: 0,
      cold_count: 1
    });
  });

  it('should count responded jobs (any stage except Applied)', () => {
    const result = evaluateRule(rulePath, {
      jobs: [
        { current_stage: 'Applied', application_type: 'cold' },
        { current_stage: 'Phone Screen', application_type: 'cold' },
        { current_stage: 'Interview', application_type: 'warm' }
      ]
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      total: 3,
      responded: 2,
      interviewed: 1,
      warm_count: 1,
      cold_count: 2
    });
  });

  it('should count interviewed jobs (Interview or Offer)', () => {
    const result = evaluateRule(rulePath, {
      jobs: [
        { current_stage: 'Applied', application_type: 'cold' },
        { current_stage: 'Phone Screen', application_type: 'cold' },
        { current_stage: 'Interview', application_type: 'cold' },
        { current_stage: 'Offer', application_type: 'warm' },
        { current_stage: 'Rejected', application_type: 'cold' }
      ]
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      total: 5,
      responded: 4,
      interviewed: 2,
      warm_count: 1,
      cold_count: 4
    });
  });

  it('should count warm and cold applications', () => {
    const result = evaluateRule(rulePath, {
      jobs: [
        { current_stage: 'Applied', application_type: 'warm' },
        { current_stage: 'Applied', application_type: 'warm' },
        { current_stage: 'Phone Screen', application_type: 'warm' },
        { current_stage: 'Applied', application_type: 'cold' },
        { current_stage: 'Interview', application_type: 'cold' }
      ]
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      total: 5,
      responded: 2,
      interviewed: 1,
      warm_count: 3,
      cold_count: 2
    });
  });

  it('should handle all Rejected jobs', () => {
    const result = evaluateRule(rulePath, {
      jobs: [
        { current_stage: 'Rejected', application_type: 'cold' },
        { current_stage: 'Rejected', application_type: 'warm' },
        { current_stage: 'Rejected', application_type: 'cold' }
      ]
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      total: 3,
      responded: 3,
      interviewed: 0,
      warm_count: 1,
      cold_count: 2
    });
  });

  it('should handle all Offer jobs', () => {
    const result = evaluateRule(rulePath, {
      jobs: [
        { current_stage: 'Offer', application_type: 'warm' },
        { current_stage: 'Offer', application_type: 'cold' }
      ]
    });
    expect(result.success).toBe(true);
    expect(result.value).toEqual({
      total: 2,
      responded: 2,
      interviewed: 2,
      warm_count: 1,
      cold_count: 1
    });
  });
});

describe('Rill Rules - Hot Reload (AC4.6)', () => {
  it('should support hot-reload of rule files', () => {
    const tempFile = path.join(
      process.cwd(),
      '.test-hotreload-' + Date.now() + '.lv'
    );
    try {
      // First version: simple arithmetic
      writeFileSync(tempFile, 'x + 1');
      const result1 = evaluateRule(tempFile, { x: 10 });
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(11);

      // Modify the rule file (hot-reload)
      writeFileSync(tempFile, 'x * 2');
      const result2 = evaluateRule(tempFile, { x: 10 });
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(20);

      // Modify again
      writeFileSync(tempFile, 'x + 100');
      const result3 = evaluateRule(tempFile, { x: 10 });
      expect(result3.success).toBe(true);
      expect(result3.value).toBe(110);
    } finally {
      unlinkSync(tempFile);
    }
  });

  it('should support hot-reload of complex rule files', () => {
    const tempFile = path.join(
      process.cwd(),
      '.test-hotreload-complex-' + Date.now() + '.lv'
    );
    try {
      // First version: match on stage
      writeFileSync(
        tempFile,
        'match stage { "Applied" -> 0, "Phone Screen" -> 1, _ -> 2 }'
      );
      const result1 = evaluateRule(tempFile, { stage: 'Applied' });
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(0);

      // Modify to different logic
      writeFileSync(
        tempFile,
        'match stage { "Applied" -> 10, "Phone Screen" -> 20, _ -> 99 }'
      );
      const result2 = evaluateRule(tempFile, { stage: 'Applied' });
      expect(result2.success).toBe(true);
      expect(result2.value).toBe(10);

      const result3 = evaluateRule(tempFile, { stage: 'Phone Screen' });
      expect(result3.success).toBe(true);
      expect(result3.value).toBe(20);
    } finally {
      unlinkSync(tempFile);
    }
  });

  it('should support hot-reload with record transformations', () => {
    const tempFile = path.join(
      process.cwd(),
      '.test-hotreload-record-' + Date.now() + '.lv'
    );
    try {
      // First version: return bool
      writeFileSync(tempFile, 'length(name) > 0');
      const result1 = evaluateRule(tempFile, { name: 'Alice' });
      expect(result1.success).toBe(true);
      expect(result1.value).toBe(true);

      // Modify to return record
      writeFileSync(tempFile, '{ is_valid: length(name) > 0, length: length(name) }');
      const result2 = evaluateRule(tempFile, { name: 'Alice' });
      expect(result2.success).toBe(true);
      expect(result2.value).toEqual({ is_valid: true, length: 5 });
    } finally {
      unlinkSync(tempFile);
    }
  });
});

describe('Rill Rules - Integration (All ACs)', () => {
  it('should successfully evaluate all four rule files in sequence', () => {
    const transitionsPath = path.join(process.cwd(), 'rules/transitions.lv');
    const validationPath = path.join(process.cwd(), 'rules/validation.lv');
    const alertsPath = path.join(process.cwd(), 'rules/alerts.lv');
    const dashboardPath = path.join(process.cwd(), 'rules/dashboard.lv');

    // Evaluate transition rule
    const transResult = evaluateRule(transitionsPath, {
      from_stage: 'Applied',
      to_stage: 'Phone Screen'
    });
    expect(transResult.success).toBe(true);

    // Evaluate validation rule
    const valResult = evaluateRule(validationPath, {
      job: {
        company_name: 'TechCorp',
        role: 'Engineer',
        salary_min: 100000,
        salary_max: 150000
      }
    });
    expect(valResult.success).toBe(true);

    // Evaluate alerts rule
    const alertResult = evaluateRule(alertsPath, {
      job: {
        current_stage: 'Phone Screen',
        follow_up_date_passed: true,
        days_since_update: 5
      },
      alert_threshold: 14
    });
    expect(alertResult.success).toBe(true);

    // Evaluate dashboard rule
    const dashResult = evaluateRule(dashboardPath, {
      jobs: [
        { current_stage: 'Applied', application_type: 'cold' },
        { current_stage: 'Phone Screen', application_type: 'warm' },
        { current_stage: 'Interview', application_type: 'cold' }
      ]
    });
    expect(dashResult.success).toBe(true);
  });
});
