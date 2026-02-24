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

describe('Export (AC5)', () => {
  describe('AC5.1: Complete nested export structure', () => {
    it('should return all jobs with nested contacts, interactions, notes, and stage_history', async () => {
      const app = createApp();

      // Set password and login
      const setupRes = await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      const cookies = setupRes.headers['set-cookie'];

      // Create first job
      const job1Res = await request(app)
        .post('/jobs')
        .set('Cookie', cookies)
        .send({
          company_name: 'Acme Corp',
          role: 'Senior Engineer',
          application_type: 'warm',
          salary_min: 150000,
          salary_max: 180000,
          location: 'San Francisco, CA',
          link: 'https://acme.com/jobs/123',
        });

      expect(job1Res.status).toBe(302);
      const job1IdMatch = job1Res.headers.location?.match(/\/jobs\/(\d+)/);
      const job1Id = job1IdMatch ? parseInt(job1IdMatch[1], 10) : null;
      expect(job1Id).not.toBeNull();

      // Create second job
      const job2Res = await request(app)
        .post('/jobs')
        .set('Cookie', cookies)
        .send({
          company_name: 'Tech Startup',
          role: 'Full Stack Developer',
          application_type: 'cold',
          salary_min: 120000,
          salary_max: 150000,
          location: 'New York, NY',
        });

      expect(job2Res.status).toBe(302);
      const job2IdMatch = job2Res.headers.location?.match(/\/jobs\/(\d+)/);
      const job2Id = job2IdMatch ? parseInt(job2IdMatch[1], 10) : null;
      expect(job2Id).not.toBeNull();

      // Add contact to job 1
      const contact1Res = await request(app)
        .post(`/jobs/${job1Id}/contacts`)
        .set('Cookie', cookies)
        .send({
          name: 'Jane Smith',
          role: 'Hiring Manager',
          email: 'jane@acme.com',
          linkedin_url: 'https://linkedin.com/in/janesmith',
          notes: 'Very responsive',
        });

      // Get contact ID from database since response is HTML
      const db = new Database(testDbPath);
      const contact1Data = db.prepare('SELECT id FROM contacts WHERE job_id = ? AND name = ?').get(job1Id, 'Jane Smith') as { id: number };
      const contact1Id = contact1Data?.id;
      db.close();
      expect(contact1Id).toBeDefined();

      // Add interaction to contact
      await request(app)
        .post(`/jobs/${job1Id}/contacts/${contact1Id}/interactions`)
        .set('Cookie', cookies)
        .send({
          type: 'email',
          content: 'Sent resume and cover letter',
        });

      // Add note to job 1
      await request(app)
        .post(`/jobs/${job1Id}/notes`)
        .set('Cookie', cookies)
        .send({
          content: 'Company seems interested, waiting for phone screen',
        });

      // Add contact to job 2
      const contact2Res = await request(app)
        .post(`/jobs/${job2Id}/contacts`)
        .set('Cookie', cookies)
        .send({
          name: 'Bob Johnson',
          role: 'Recruiter',
          email: 'bob@techstartup.com',
        });

      // Get contact ID from database
      const db2 = new Database(testDbPath);
      const contact2Data = db2.prepare('SELECT id FROM contacts WHERE job_id = ? AND name = ?').get(job2Id, 'Bob Johnson') as { id: number };
      const contact2Id = contact2Data?.id;
      db2.close();
      expect(contact2Id).toBeDefined();

      // Add interaction to contact 2
      await request(app)
        .post(`/jobs/${job2Id}/contacts/${contact2Id}/interactions`)
        .set('Cookie', cookies)
        .send({
          type: 'call',
          content: 'Initial phone screen scheduled for Friday',
        });

      // Add stage transition
      await request(app)
        .post('/pipeline/transition')
        .set('Cookie', cookies)
        .send({
          job_id: job1Id,
          to_stage_id: 2,
          sub_label: 'Scheduled for next week',
        });

      // Get export
      const exportRes = await request(app)
        .get('/export')
        .set('Cookie', cookies);

      expect(exportRes.status).toBe(200);
      expect(exportRes.body).toHaveProperty('exported_at');
      expect(exportRes.body).toHaveProperty('jobs');
      expect(Array.isArray(exportRes.body.jobs)).toBe(true);
      expect(exportRes.body.jobs).toHaveLength(2);

      // Check job 1
      const exportedJob1 = exportRes.body.jobs.find((j: any) => j.id === job1Id);
      expect(exportedJob1).toBeDefined();
      expect(exportedJob1.company_name).toBe('Acme Corp');
      expect(exportedJob1.role).toBe('Senior Engineer');
      expect(exportedJob1.current_stage).toBe('Phone Screen');
      expect(exportedJob1.salary_min).toBe(150000);
      expect(exportedJob1.salary_max).toBe(180000);
      expect(exportedJob1.location).toBe('San Francisco, CA');
      expect(exportedJob1.link).toBe('https://acme.com/jobs/123');

      // Check contacts nested under job 1
      expect(Array.isArray(exportedJob1.contacts)).toBe(true);
      expect(exportedJob1.contacts).toHaveLength(1);
      const exportedContact1 = exportedJob1.contacts[0];
      expect(exportedContact1.name).toBe('Jane Smith');
      expect(exportedContact1.role).toBe('Hiring Manager');
      expect(exportedContact1.email).toBe('jane@acme.com');
      expect(exportedContact1.linkedin_url).toBe('https://linkedin.com/in/janesmith');
      expect(exportedContact1.notes).toBe('Very responsive');

      // Check interactions nested under contact 1
      expect(Array.isArray(exportedContact1.interactions)).toBe(true);
      expect(exportedContact1.interactions).toHaveLength(1);
      const exportedInteraction1 = exportedContact1.interactions[0];
      expect(exportedInteraction1.type).toBe('email');
      expect(exportedInteraction1.content).toBe('Sent resume and cover letter');

      // Check notes nested under job 1
      expect(Array.isArray(exportedJob1.notes)).toBe(true);
      expect(exportedJob1.notes).toHaveLength(1);
      const exportedNote1 = exportedJob1.notes[0];
      expect(exportedNote1.content).toBe('Company seems interested, waiting for phone screen');

      // Check stage history
      expect(Array.isArray(exportedJob1.stage_history)).toBe(true);
      expect(exportedJob1.stage_history.length).toBeGreaterThan(0);
      const transition = exportedJob1.stage_history.find(
        (t: any) => t.to_stage === 'Phone Screen'
      );
      expect(transition).toBeDefined();
      expect(transition.sub_label).toBe('Scheduled for next week');

      // Check job 2
      const exportedJob2 = exportRes.body.jobs.find((j: any) => j.id === job2Id);
      expect(exportedJob2).toBeDefined();
      expect(exportedJob2.company_name).toBe('Tech Startup');
      expect(exportedJob2.role).toBe('Full Stack Developer');
      expect(exportedJob2.current_stage).toBe('Applied');
      expect(exportedJob2.contacts).toHaveLength(1);
      expect(exportedJob2.contacts[0].interactions).toHaveLength(1);
      expect(exportedJob2.contacts[0].interactions[0].type).toBe('call');
    });
  });

  describe('AC5.2: Response headers and JSON validity', () => {
    it('should return valid JSON with correct headers', async () => {
      const app = createApp();

      // Set password and login
      const setupRes = await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      const cookies = setupRes.headers['set-cookie'];

      // Create a job
      await request(app)
        .post('/jobs')
        .set('Cookie', cookies)
        .send({
          company_name: 'Test Company',
          role: 'Test Role',
          application_type: 'cold',
        });

      const exportRes = await request(app)
        .get('/export')
        .set('Cookie', cookies);

      expect(exportRes.status).toBe(200);

      // Check Content-Type header
      expect(exportRes.headers['content-type']).toContain('application/json');

      // Check Content-Disposition header
      const disposition = exportRes.headers['content-disposition'];
      expect(disposition).toBeDefined();
      expect(disposition).toContain('attachment');
      expect(disposition).toContain('filename=');
      expect(disposition).toMatch(/job-tracker-export-\d{4}-\d{2}-\d{2}\.json/);

      // Verify JSON is valid - should be able to parse
      expect(() => JSON.parse(JSON.stringify(exportRes.body))).not.toThrow();

      // Verify structure
      expect(exportRes.body).toHaveProperty('exported_at');
      expect(exportRes.body).toHaveProperty('jobs');
    });
  });

  describe('AC5.3: Empty database export', () => {
    it('should return valid JSON structure with empty jobs array', async () => {
      const app = createApp();

      // Set password and login
      const setupRes = await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      const cookies = setupRes.headers['set-cookie'];

      // Export without creating any jobs
      const exportRes = await request(app)
        .get('/export')
        .set('Cookie', cookies);

      expect(exportRes.status).toBe(200);
      expect(exportRes.body).toHaveProperty('exported_at');
      expect(exportRes.body).toHaveProperty('jobs');
      expect(Array.isArray(exportRes.body.jobs)).toBe(true);
      expect(exportRes.body.jobs).toHaveLength(0);

      // Verify it's valid ISO datetime string
      expect(typeof exportRes.body.exported_at).toBe('string');
      expect(new Date(exportRes.body.exported_at).getTime()).not.toBeNaN();
    });
  });

  describe('AC5: Authentication required', () => {
    it('should redirect to login when not authenticated', async () => {
      const app = createApp();

      // Set password
      await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      // Create fresh app without session
      const app2 = createApp();

      const exportRes = await request(app2).get('/export');

      expect(exportRes.status).toBe(302);
      expect(exportRes.headers.location).toBe('/auth/login');
    });
  });
});
