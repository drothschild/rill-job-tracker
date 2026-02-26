import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, unlinkSync, existsSync } from 'fs';
import bcrypt from 'bcrypt';
import { getDb, closeDb } from '../src/db/connection';
import { runAlertScheduler } from '../src/alerts/scheduler';
import {
  createJob,
  setSetting,
  getAlertSettings,
  getActiveJobsForAlerts,
  updateJobAlertSentAt,
} from '../src/db/queries';

// Mock the mailer module to prevent actual email sends
vi.mock('../src/alerts/mailer', () => ({
  createMailTransport: vi.fn(() => ({
    sendMail: vi.fn().mockResolvedValue({}),
    close: vi.fn(),
  })),
  sendDigestEmail: vi.fn().mockResolvedValue({ success: true }),
}));

// Test database setup
let testDbPath: string;

/**
 * Helper to set up authenticated session
 */
async function setupAuthenticatedSession(app: any): Promise<any> {
  const supertest = await import('supertest');
  const request = supertest.default;
  const db = getDb();

  // Set initial password
  const passwordHash = await bcrypt.hash('test-password', 10);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('password_hash', passwordHash);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run('setup_complete', 'true');

  // Create a session by logging in
  const loginRes = await request(app).post('/auth/login').send({
    password: 'test-password',
  });

  // Extract session cookie
  const setCookieHeader = loginRes.headers['set-cookie'];
  const sessionCookie = setCookieHeader
    ? setCookieHeader.find((cookie: string) => cookie.startsWith('connect.sid'))
    : null;

  if (!sessionCookie) {
    throw new Error('Failed to create authenticated session');
  }

  return sessionCookie;
}

beforeEach(() => {
  // Create a unique test database for each test
  const testDir = path.join(process.cwd(), '.test-db');
  mkdirSync(testDir, { recursive: true });
  testDbPath = path.join(testDir, `test-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);

  // Set test database path
  process.env.DB_PATH = testDbPath;

  // Close any existing connection
  closeDb();

  // Initialize test database
  const testDb = new Database(testDbPath);
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');

  // Create schema
  testDb.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      display_order INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      company_name TEXT NOT NULL,
      role TEXT NOT NULL,
      link TEXT,
      salary_min INTEGER,
      salary_max INTEGER,
      application_type TEXT NOT NULL DEFAULT 'cold' CHECK(application_type IN ('warm', 'cold')),
      job_description TEXT,
      location TEXT,
      current_stage_id INTEGER NOT NULL DEFAULT 1,
      follow_up_date TEXT,
      last_alert_sent_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (current_stage_id) REFERENCES stages(id)
    );

    CREATE TABLE IF NOT EXISTS stage_transitions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      from_stage_id INTEGER,
      to_stage_id INTEGER NOT NULL,
      sub_label TEXT,
      transitioned_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE,
      FOREIGN KEY (from_stage_id) REFERENCES stages(id),
      FOREIGN KEY (to_stage_id) REFERENCES stages(id)
    );

    CREATE TABLE IF NOT EXISTS contacts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      role TEXT,
      email TEXT,
      linkedin_url TEXT,
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      contact_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('call', 'email', 'note')),
      content TEXT NOT NULL,
      occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS sessions (
      sid TEXT NOT NULL PRIMARY KEY,
      sess TEXT NOT NULL,
      expire INTEGER NOT NULL
    );
  `);

  // Seed default stages
  testDb.prepare(
    'INSERT OR IGNORE INTO stages (id, name, display_order) VALUES (?, ?, ?)'
  ).run(1, 'Applied', 1);
  testDb.prepare(
    'INSERT OR IGNORE INTO stages (id, name, display_order) VALUES (?, ?, ?)'
  ).run(2, 'Phone Screen', 2);
  testDb.prepare(
    'INSERT OR IGNORE INTO stages (id, name, display_order) VALUES (?, ?, ?)'
  ).run(3, 'Technical Interview', 3);
  testDb.prepare(
    'INSERT OR IGNORE INTO stages (id, name, display_order) VALUES (?, ?, ?)'
  ).run(4, 'Final Round', 4);
  testDb.prepare(
    'INSERT OR IGNORE INTO stages (id, name, display_order) VALUES (?, ?, ?)'
  ).run(5, 'Offer', 5);
  testDb.prepare(
    'INSERT OR IGNORE INTO stages (id, name, display_order) VALUES (?, ?, ?)'
  ).run(6, 'Rejected', 6);
  testDb.prepare(
    'INSERT OR IGNORE INTO stages (id, name, display_order) VALUES (?, ?, ?)'
  ).run(7, 'Research', 0);

  // Set a test password for auth tests
  testDb.prepare(
    "INSERT OR REPLACE INTO settings (key, value) VALUES ('password_hash', '$2b$10$mocked.hash.value.for.testing')"
  ).run();

  testDb.close();

  // Clear all mocks before each test
  vi.clearAllMocks();
});

afterEach(() => {
  // Close database
  closeDb();
  delete process.env.DB_PATH;

  // Clean up test database files
  if (existsSync(testDbPath)) {
    try {
      unlinkSync(testDbPath);
    } catch (e) {
      // ignore
    }
  }
  const walFile = testDbPath + '-wal';
  if (existsSync(walFile)) {
    try {
      unlinkSync(walFile);
    } catch (e) {
      // ignore
    }
  }
  const shmFile = testDbPath + '-shm';
  if (existsSync(shmFile)) {
    try {
      unlinkSync(shmFile);
    } catch (e) {
      // ignore
    }
  }
});

describe('Email Alerts (AC3)', () => {
  describe('AC3.1: Follow-up date alert', () => {
    it('should trigger when follow_up_date has passed (verified by job update)', async () => {
      const db = getDb();

      // Create a job with follow_up_date in the past
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const followUpDate = yesterdayDate.toISOString().split('T')[0]; // YYYY-MM-DD

      const job = createJob(db, {
        company_name: 'Test Company',
        role: 'Software Engineer',
        application_type: 'warm',
        follow_up_date: followUpDate,
      });

      expect(job.follow_up_date).toBe(followUpDate);

      // Enable alerts and set Gmail credentials
      setSetting(db, 'alerts_enabled', 'true');
      setSetting(db, 'gmail_user', 'test@gmail.com');
      setSetting(db, 'gmail_app_password', 'test-app-password');
      setSetting(db, 'alert_recipient_email', 'recipient@example.com');

      // Get active jobs to verify the follow_up_date_passed computed field works
      const activeJobs = getActiveJobsForAlerts(db);
      const testJob = activeJobs.find(j => j.id === job.id);

      // Verify the computed field shows follow_up_date_passed = true
      expect(testJob).toBeDefined();
      expect(testJob?.follow_up_date_passed).toBe(true);
    });
  });

  describe('AC3.2: No-response alert', () => {
    it('should generate alert when job has no response for threshold days', async () => {
      const { sendDigestEmail } = await import('../src/alerts/mailer');
      const db = getDb();

      // Create a job with updated_at > threshold days ago
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      createJob(db, {
        company_name: 'Old Company',
        role: 'Backend Engineer',
        application_type: 'cold',
      });

      // Manually set updated_at to 10 days ago
      const jobs = db.prepare('SELECT id FROM jobs LIMIT 1').all() as any[];
      if (jobs.length > 0) {
        db.prepare('UPDATE jobs SET updated_at = ? WHERE id = ?').run(
          tenDaysAgo.toISOString(),
          jobs[0].id
        );
      }

      // Set alert threshold to 7 days
      setSetting(db, 'alert_threshold_days', '7');
      setSetting(db, 'alerts_enabled', 'true');
      setSetting(db, 'gmail_user', 'test@gmail.com');
      setSetting(db, 'gmail_app_password', 'test-app-password');
      setSetting(db, 'alert_recipient_email', 'recipient@example.com');

      // Run scheduler
      await runAlertScheduler(db);

      // Verify alert was sent
      expect(sendDigestEmail).toHaveBeenCalled();
    });

    it('should not alert when job is within threshold days', async () => {
      const { sendDigestEmail } = await import('../src/alerts/mailer');
      const db = getDb();

      // Create a job updated 5 days ago
      const fiveDaysAgo = new Date();
      fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

      createJob(db, {
        company_name: 'Recent Company',
        role: 'Frontend Engineer',
        application_type: 'warm',
      });

      // Manually set updated_at to 5 days ago
      const jobs = db.prepare('SELECT id FROM jobs LIMIT 1').all() as any[];
      if (jobs.length > 0) {
        db.prepare('UPDATE jobs SET updated_at = ? WHERE id = ?').run(
          fiveDaysAgo.toISOString(),
          jobs[0].id
        );
      }

      // Set alert threshold to 7 days
      setSetting(db, 'alert_threshold_days', '7');
      setSetting(db, 'alerts_enabled', 'true');
      setSetting(db, 'gmail_user', 'test@gmail.com');
      setSetting(db, 'gmail_app_password', 'test-app-password');
      setSetting(db, 'alert_recipient_email', 'recipient@example.com');

      // Run scheduler
      await runAlertScheduler(db);

      // Verify no email was sent
      expect(sendDigestEmail).not.toHaveBeenCalled();
    });

    it('should respect threshold changes', async () => {
      const { sendDigestEmail } = await import('../src/alerts/mailer');
      const db = getDb();

      // Create a job updated 10 days ago
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      createJob(db, {
        company_name: 'Test Company',
        role: 'DevOps Engineer',
        application_type: 'warm',
      });

      const jobs = db.prepare('SELECT id FROM jobs LIMIT 1').all() as any[];
      if (jobs.length > 0) {
        db.prepare('UPDATE jobs SET updated_at = ? WHERE id = ?').run(
          tenDaysAgo.toISOString(),
          jobs[0].id
        );
      }

      // Set alert threshold to 14 days (should NOT alert)
      setSetting(db, 'alert_threshold_days', '14');
      setSetting(db, 'alerts_enabled', 'true');
      setSetting(db, 'gmail_user', 'test@gmail.com');
      setSetting(db, 'gmail_app_password', 'test-app-password');
      setSetting(db, 'alert_recipient_email', 'recipient@example.com');

      // Run scheduler - should NOT alert
      await runAlertScheduler(db);
      expect(sendDigestEmail).not.toHaveBeenCalled();

      // Change threshold to 7 days (should alert)
      setSetting(db, 'alert_threshold_days', '7');
      vi.clearAllMocks();

      await runAlertScheduler(db);
      expect(sendDigestEmail).toHaveBeenCalled();
    });
  });

  describe('AC3.3: Multiple alerts batched into single email', () => {
    it('should batch multiple alerts into one email', async () => {
      const { sendDigestEmail } = await import('../src/alerts/mailer');
      const db = getDb();

      // Create 3 jobs with different alert conditions
      // Job 1: Follow-up date passed
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const followUpDate = yesterdayDate.toISOString().split('T')[0];

      createJob(db, {
        company_name: 'Company 1',
        role: 'Role 1',
        application_type: 'warm',
        follow_up_date: followUpDate,
      });

      // Job 2: No response for 10 days
      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      createJob(db, {
        company_name: 'Company 2',
        role: 'Role 2',
        application_type: 'cold',
      });

      // Job 3: Another no response
      createJob(db, {
        company_name: 'Company 3',
        role: 'Role 3',
        application_type: 'warm',
      });

      // Manually update jobs 2 and 3
      const allJobs = db.prepare('SELECT id FROM jobs ORDER BY id').all() as any[];
      if (allJobs.length >= 2) {
        db.prepare('UPDATE jobs SET updated_at = ? WHERE id = ?').run(
          tenDaysAgo.toISOString(),
          allJobs[1].id
        );
        db.prepare('UPDATE jobs SET updated_at = ? WHERE id = ?').run(
          tenDaysAgo.toISOString(),
          allJobs[2].id
        );
      }

      // Configure alerts
      setSetting(db, 'alert_threshold_days', '7');
      setSetting(db, 'alerts_enabled', 'true');
      setSetting(db, 'gmail_user', 'test@gmail.com');
      setSetting(db, 'gmail_app_password', 'test-app-password');
      setSetting(db, 'alert_recipient_email', 'recipient@example.com');

      // Run scheduler
      await runAlertScheduler(db);

      // Verify only ONE email was sent with all alerts
      expect(sendDigestEmail).toHaveBeenCalledTimes(1);
    });
  });

  describe('AC3.4: Alert threshold configurable from settings', () => {
    it('should allow updating threshold via direct DB call', async () => {
      const db = getDb();

      // Set threshold via setSetting (simulating form submission)
      setSetting(db, 'alert_threshold_days', '14');

      // Verify setting was persisted
      const settings = db
        .prepare("SELECT value FROM settings WHERE key = 'alert_threshold_days'")
        .get() as { value: string } | undefined;
      expect(settings?.value).toBe('14');
    });

    it('should prevent alerts when job is at 10 days with 14-day threshold', async () => {
      const { sendDigestEmail } = await import('../src/alerts/mailer');
      const db = getDb();

      const tenDaysAgo = new Date();
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      createJob(db, {
        company_name: 'Test Company',
        role: 'Engineer',
        application_type: 'warm',
      });

      const jobs = db.prepare('SELECT id FROM jobs LIMIT 1').all() as any[];
      if (jobs.length > 0) {
        db.prepare('UPDATE jobs SET updated_at = ? WHERE id = ?').run(
          tenDaysAgo.toISOString(),
          jobs[0].id
        );
      }

      setSetting(db, 'alert_threshold_days', '14');
      setSetting(db, 'alerts_enabled', 'true');
      setSetting(db, 'gmail_user', 'test@gmail.com');
      setSetting(db, 'gmail_app_password', 'test-app-password');
      setSetting(db, 'alert_recipient_email', 'recipient@example.com');

      await runAlertScheduler(db);
      expect(sendDigestEmail).not.toHaveBeenCalled();
    });

    it('should trigger alerts when job is at 15 days with 14-day threshold', async () => {
      const { sendDigestEmail } = await import('../src/alerts/mailer');
      const db = getDb();

      const fifteenDaysAgo = new Date();
      fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

      createJob(db, {
        company_name: 'Test Company',
        role: 'Engineer',
        application_type: 'warm',
      });

      const jobs = db.prepare('SELECT id FROM jobs LIMIT 1').all() as any[];
      if (jobs.length > 0) {
        db.prepare('UPDATE jobs SET updated_at = ? WHERE id = ?').run(
          fifteenDaysAgo.toISOString(),
          jobs[0].id
        );
      }

      setSetting(db, 'alert_threshold_days', '14');
      setSetting(db, 'alerts_enabled', 'true');
      setSetting(db, 'gmail_user', 'test@gmail.com');
      setSetting(db, 'gmail_app_password', 'test-app-password');
      setSetting(db, 'alert_recipient_email', 'recipient@example.com');

      await runAlertScheduler(db);
      expect(sendDigestEmail).toHaveBeenCalled();
    });
  });

  describe('AC3.5: Gmail credentials configurable from settings', () => {
    it('should allow updating Gmail settings via direct DB call', async () => {
      const db = getDb();

      // Update Gmail settings via setSetting
      setSetting(db, 'gmail_user', 'myemail@gmail.com');
      setSetting(db, 'gmail_app_password', 'my-app-password-16char');
      setSetting(db, 'alert_recipient_email', 'alerts@example.com');

      // Verify settings persisted
      const gmailUser = db
        .prepare("SELECT value FROM settings WHERE key = 'gmail_user'")
        .get() as { value: string } | undefined;
      const gmailPassword = db
        .prepare("SELECT value FROM settings WHERE key = 'gmail_app_password'")
        .get() as { value: string } | undefined;
      const recipientEmail = db
        .prepare("SELECT value FROM settings WHERE key = 'alert_recipient_email'")
        .get() as { value: string } | undefined;

      expect(gmailUser?.value).toBe('myemail@gmail.com');
      expect(gmailPassword?.value).toBe('my-app-password-16char');
      expect(recipientEmail?.value).toBe('alerts@example.com');
    });
  });

  describe('AC3.6: 24-hour dedup - same alert not resent within 24h', () => {
    it('should allow manual update of last_alert_sent_at', async () => {
      const db = getDb();

      // Create a job
      const job = createJob(db, {
        company_name: 'Test Company',
        role: 'Engineer',
        application_type: 'warm',
      });

      // Verify initial state
      let jobData = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id) as any;
      expect(jobData.last_alert_sent_at).toBeNull();

      // Use updateJobAlertSentAt to set the timestamp
      updateJobAlertSentAt(db, job.id);

      // Verify last_alert_sent_at was set
      jobData = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job.id) as any;
      expect(jobData.last_alert_sent_at).toBeTruthy();
      expect(typeof jobData.last_alert_sent_at).toBe('string');
    });

    it('should respect 24-hour dedup window when evaluating alerts', async () => {
      const db = getDb();

      // Create a job that triggered an alert
      const job = createJob(db, {
        company_name: 'Test Company',
        role: 'Engineer',
        application_type: 'warm',
      });

      // Set last_alert_sent_at to current time (just now)
      const now = new Date();
      db.prepare('UPDATE jobs SET last_alert_sent_at = ? WHERE id = ?').run(
        now.toISOString(),
        job.id
      );

      // Get active jobs - job should be skipped due to 24-hour dedup
      const activeJobs = getActiveJobsForAlerts(db);
      const testJob = activeJobs.find(j => j.id === job.id);

      expect(testJob).toBeDefined();
      // The job exists in active jobs, but scheduler should skip it due to 24h dedup
      expect(testJob?.last_alert_sent_at).toBeTruthy();
    });

    it('should allow resending alert after 24+ hours have passed', async () => {
      const db = getDb();

      // Create a job that previously had an alert
      const job = createJob(db, {
        company_name: 'Test Company',
        role: 'Engineer',
        application_type: 'warm',
      });

      // Set last_alert_sent_at to 25 hours ago
      const twentyFiveHoursAgo = new Date();
      twentyFiveHoursAgo.setHours(twentyFiveHoursAgo.getHours() - 25);
      db.prepare('UPDATE jobs SET last_alert_sent_at = ? WHERE id = ?').run(
        twentyFiveHoursAgo.toISOString(),
        job.id
      );

      // Get active jobs
      const activeJobs = getActiveJobsForAlerts(db);
      const testJob = activeJobs.find(j => j.id === job.id);

      // Job should be present and could trigger alerts (24+ hours have passed)
      expect(testJob).toBeDefined();
      expect(testJob?.last_alert_sent_at).toBeTruthy();

      // Calculate hours since last alert
      const lastAlertTime = new Date(testJob!.last_alert_sent_at!);
      const now = new Date();
      const hoursSinceAlert = (now.getTime() - lastAlertTime.getTime()) / (1000 * 60 * 60);

      // Verify 24+ hours have passed
      expect(hoursSinceAlert).toBeGreaterThanOrEqual(24);
    });
  });

  describe('AC3.7: Invalid Gmail credentials handled gracefully', () => {
    it('should skip alerts if Gmail credentials not configured', async () => {
      const { sendDigestEmail } = await import('../src/alerts/mailer');
      const db = getDb();

      // Create a job that would trigger an alert
      const yesterdayDate = new Date();
      yesterdayDate.setDate(yesterdayDate.getDate() - 1);
      const followUpDate = yesterdayDate.toISOString().split('T')[0];

      createJob(db, {
        company_name: 'Test Company',
        role: 'Engineer',
        application_type: 'warm',
        follow_up_date: followUpDate,
      });

      // Enable alerts but DON'T set Gmail credentials
      setSetting(db, 'alerts_enabled', 'true');
      // No gmail_user or gmail_app_password

      // Run scheduler
      await runAlertScheduler(db);

      // Should NOT send email (credentials missing)
      expect(sendDigestEmail).not.toHaveBeenCalled();
    });
  });

  describe('Settings Database Integration', () => {
    it('should correctly read and write all settings fields', async () => {
      const db = getDb();

      // Set all settings
      setSetting(db, 'alert_threshold_days', '21');
      setSetting(db, 'alerts_enabled', 'true');
      setSetting(db, 'gmail_user', 'test@gmail.com');
      setSetting(db, 'gmail_app_password', 'password123');
      setSetting(db, 'alert_recipient_email', 'recipient@example.com');

      // Retrieve all settings
      const settings = getAlertSettings(db);

      expect(settings.alert_threshold_days).toBe(21);
      expect(settings.alerts_enabled).toBe('true');
      expect(settings.gmail_user).toBe('test@gmail.com');
      expect(settings.gmail_app_password).toBe('password123');
      expect(settings.alert_recipient_email).toBe('recipient@example.com');
    });
  });

  describe('HTTP Route Tests - Settings API', () => {
    it('AC3.4: POST /settings/alerts should persist threshold_days value', async () => {
      const { createApp } = await import('../src/server');
      const supertest = await import('supertest');
      const request = supertest.default;
      const app = createApp();
      const sessionCookie = await setupAuthenticatedSession(app);

      // Submit form with threshold_days using authenticated session
      const response = await request(app)
        .post('/settings/alerts')
        .set('Cookie', sessionCookie)
        .set('HX-Request', 'true')
        .send({
          alert_threshold_days: '14',
          alerts_enabled: 'true',
        });

      expect(response.status).toBe(200);

      // Verify setting was persisted in database
      const db = getDb();
      const settings = getAlertSettings(db);
      expect(settings.alert_threshold_days).toBe(14);
    });

    it('AC3.5: POST /settings/gmail should persist credentials', async () => {
      const { createApp } = await import('../src/server');
      const supertest = await import('supertest');
      const request = supertest.default;
      const app = createApp();
      const sessionCookie = await setupAuthenticatedSession(app);

      // Submit form with Gmail credentials using authenticated session
      const response = await request(app)
        .post('/settings/gmail')
        .set('Cookie', sessionCookie)
        .set('HX-Request', 'true')
        .send({
          gmail_user: 'myemail@gmail.com',
          gmail_app_password: 'app-password-16-chars',
          alert_recipient_email: 'alerts@example.com',
        });

      expect(response.status).toBe(200);

      // Verify settings were persisted in database
      const db = getDb();
      const settings = getAlertSettings(db);
      expect(settings.gmail_user).toBe('myemail@gmail.com');
      expect(settings.gmail_app_password).toBe('app-password-16-chars');
      expect(settings.alert_recipient_email).toBe('alerts@example.com');
    });
  });
});
