import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, unlinkSync, existsSync } from 'fs';
import bcrypt from 'bcrypt';
import { createApp } from '../src/server';
import { getDb, closeDb } from '../src/db/connection';

// Test database setup
let testDbPath: string;

beforeEach(() => {
  const testDir = path.join(process.cwd(), '.test-db');
  mkdirSync(testDir, { recursive: true });
  testDbPath = path.join(testDir, `test-${Date.now()}-${Math.random().toString(36).substring(7)}.db`);

  process.env.DB_PATH = testDbPath;
  closeDb();

  const testDb = new Database(testDbPath);
  testDb.pragma('journal_mode = WAL');
  testDb.pragma('foreign_keys = ON');

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
  ).run(3, 'Interview', 3);
  testDb.prepare(
    'INSERT OR IGNORE INTO stages (id, name, display_order) VALUES (?, ?, ?)'
  ).run(4, 'Offer', 4);
  testDb.prepare(
    'INSERT OR IGNORE INTO stages (id, name, display_order) VALUES (?, ?, ?)'
  ).run(5, 'Rejected', 5);
  testDb.prepare(
    'INSERT OR IGNORE INTO stages (id, name, display_order) VALUES (?, ?, ?)'
  ).run(6, 'Research', 0);

  // Create settings table with default stale threshold
  testDb.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run(
    'stale_job_threshold',
    '7'
  );

  testDb.close();
});

afterEach(() => {
  closeDb();
  delete process.env.DB_PATH;

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

/**
 * Helper to set up authenticated session
 */
async function setupAuthenticatedSession(app: any): Promise<any> {
  const db = getDb();

  // Set initial password
  const passwordHash = await bcrypt.hash('test-password', 10);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('password_hash', passwordHash);
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?)').run('setup_complete', 'true');

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

describe('Dashboard - AC1.10 Metrics', () => {
  it('should display total applications count', async () => {
    const app = createApp();
    const sessionCookie = await setupAuthenticatedSession(app);
    const db = getDb();

    // Create 5 jobs in various stages
    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('TechCorp', 'Software Engineer', 'warm', 1); // Applied

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('StartupInc', 'Product Manager', 'cold', 2); // Phone Screen

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('BigCorp', 'Senior Engineer', 'warm', 3); // Interview

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('MediumCorp', 'Developer', 'cold', 4); // Offer

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('SmallCorp', 'Consultant', 'cold', 5); // Rejected

    // Get dashboard
    const res = await request(app)
      .get('/')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    expect(res.text).toContain('Dashboard');
    // Should contain the total applications count (5)
    expect(res.text).toContain('>5<');
  });

  it('should compute response rate correctly', async () => {
    const app = createApp();
    const sessionCookie = await setupAuthenticatedSession(app);
    const db = getDb();

    // Create 5 jobs: 2 Applied (not responded), 3 others (responded)
    // Response rate should be 3/5 = 60%
    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company1', 'Role1', 'cold', 1); // Applied - not responded

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company2', 'Role2', 'cold', 1); // Applied - not responded

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company3', 'Role3', 'warm', 2); // Phone Screen - responded

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company4', 'Role4', 'warm', 3); // Interview - responded

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company5', 'Role5', 'cold', 5); // Rejected - responded

    // Get dashboard
    const res = await request(app)
      .get('/')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    // Response rate should be 60%
    expect(res.text).toContain('>60%<');
  });

  it('should compute interview conversion rate correctly', async () => {
    const app = createApp();
    const sessionCookie = await setupAuthenticatedSession(app);
    const db = getDb();

    // Create 5 jobs: 2 in Interview/Offer (interviewed), 3 others (not interviewed)
    // Interview rate should be 2/5 = 40%
    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company1', 'Role1', 'cold', 1); // Applied

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company2', 'Role2', 'cold', 2); // Phone Screen

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company3', 'Role3', 'warm', 3); // Interview - interviewed

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company4', 'Role4', 'warm', 4); // Offer - interviewed

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company5', 'Role5', 'cold', 5); // Rejected

    // Get dashboard
    const res = await request(app)
      .get('/')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    // Interview rate should be 40%
    expect(res.text).toContain('>40%<');
  });

  it('should handle zero jobs gracefully (no division by zero)', async () => {
    const app = createApp();
    const sessionCookie = await setupAuthenticatedSession(app);

    // Get dashboard with no jobs
    const res = await request(app)
      .get('/')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    // Total should be 0
    expect(res.text).toContain('>0<');
    // Response rate should be 0%
    expect(res.text).toContain('>0%<');
  });

  it('should count warm and cold applications correctly', async () => {
    const app = createApp();
    const sessionCookie = await setupAuthenticatedSession(app);
    const db = getDb();

    // Create 3 warm and 2 cold jobs
    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company1', 'Role1', 'warm', 1);

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company2', 'Role2', 'warm', 2);

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company3', 'Role3', 'warm', 3);

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company4', 'Role4', 'cold', 4);

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company5', 'Role5', 'cold', 5);

    // Get dashboard
    const res = await request(app)
      .get('/')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    // Should have data embedded for 3 warm and 2 cold
    expect(res.text).toContain('[3,2]'); // Warm vs Cold chart data
  });
});

describe('Dashboard - AC1.11 Chart Rendering', () => {
  it('should include all three chart canvas elements with correct IDs', async () => {
    const app = createApp();
    const sessionCookie = await setupAuthenticatedSession(app);

    const res = await request(app)
      .get('/')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    // Check for all three canvas elements
    expect(res.text).toContain('id="chart-applications-timeline"');
    expect(res.text).toContain('id="chart-stage-funnel"');
    expect(res.text).toContain('id="chart-warm-cold"');
  });

  it('should include Chart.js CDN script tag', async () => {
    const app = createApp();
    const sessionCookie = await setupAuthenticatedSession(app);

    const res = await request(app)
      .get('/')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    // Check for Chart.js CDN
    expect(res.text).toContain('cdn.jsdelivr.net/npm/chart.js');
  });

  it('should embed chart configuration data in script tags', async () => {
    const app = createApp();
    const sessionCookie = await setupAuthenticatedSession(app);
    const db = getDb();

    // Create some jobs to generate chart data
    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company1', 'Role1', 'warm', 1);

    db.prepare(`
      INSERT INTO jobs (company_name, role, application_type, current_stage_id)
      VALUES (?, ?, ?, ?)
    `).run('Company2', 'Role2', 'cold', 2);

    const res = await request(app)
      .get('/')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    // Check for DOMContentLoaded event listener (data embedding in script)
    expect(res.text).toContain('DOMContentLoaded');
    // Check for JSON.stringify output with chart data
    expect(res.text).toContain('["Warm","Cold"]');
    // Check for Chart constructor calls
    expect(res.text).toContain('new Chart');
  });

  it('should have responsive CSS classes for mobile and desktop', async () => {
    const app = createApp();
    const sessionCookie = await setupAuthenticatedSession(app);

    const res = await request(app)
      .get('/')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    // Check for responsive grid classes
    expect(res.text).toContain('grid');
    expect(res.text).toContain('md:');
    expect(res.text).toContain('lg:');
  });

  it('should render stats cards with proper HTML structure', async () => {
    const app = createApp();
    const sessionCookie = await setupAuthenticatedSession(app);

    const res = await request(app)
      .get('/')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    // Check for stats card labels
    expect(res.text).toContain('Total Applications');
    expect(res.text).toContain('Response Rate');
    expect(res.text).toContain('Interview Conversion');
  });

  it('should include actionable items section', async () => {
    const app = createApp();
    const sessionCookie = await setupAuthenticatedSession(app);

    const res = await request(app)
      .get('/')
      .set('Cookie', sessionCookie);

    expect(res.status).toBe(200);
    // Check for actionable items section
    expect(res.text).toContain('Actionable Items');
  });
});
