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
  testDb.prepare(
    'INSERT OR IGNORE INTO stages (id, name, display_order) VALUES (?, ?, ?)'
  ).run(7, 'Research', 0);

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

  // Set password hash in database
  const passwordHash = await bcrypt.hash('testpassword123', 10);
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
    'password_hash',
    passwordHash
  );

  // Login to get session
  const agent = request.agent(app);
  const loginRes = await agent
    .post('/auth/login')
    .send({
      password: 'testpassword123',
    });

  expect(loginRes.status).toBe(302);
  expect(loginRes.headers.location).toBe('/');

  return agent;
}

describe('Job CRUD Operations (AC1)', () => {
  describe('AC1.1: Job can be created with all fields', () => {
    it('should create a job with all fields via POST /jobs', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      const response = await agent
        .post('/jobs')
        .send({
          company_name: 'Acme Corp',
          role: 'Software Engineer',
          link: 'https://acme.com/jobs/software-engineer',
          salary_min: '100000',
          salary_max: '150000',
          application_type: 'warm',
          job_description: 'Build great software',
          location: 'San Francisco, CA',
          follow_up_date: '2026-03-15',
        });

      expect(response.status).toBe(302);

      // Verify job was created in database (check after test completes in afterEach)
      const db = getDb();
      const job = db.prepare('SELECT * FROM jobs WHERE company_name = ?').get('Acme Corp') as any;

      expect(job).toBeDefined();
      expect(job.role).toBe('Software Engineer');
      expect(job.link).toBe('https://acme.com/jobs/software-engineer');
      expect(job.salary_min).toBe(100000);
      expect(job.salary_max).toBe(150000);
      expect(job.application_type).toBe('warm');
      expect(job.job_description).toBe('Build great software');
      expect(job.location).toBe('San Francisco, CA');
    });

    it('should return all job fields when viewing created job', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      // Create job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Tech Inc',
          role: 'Data Scientist',
          link: 'https://techinc.com/jobs/data-scientist',
          salary_min: '120000',
          salary_max: '180000',
          application_type: 'cold',
          job_description: 'ML work',
          location: 'New York, NY',
        });

      // Extract job ID from redirect
      const locationHeader = createRes.headers.location;
      const jobIdMatch = locationHeader.match(/\/jobs\/(\d+)/);
      const jobId = jobIdMatch ? jobIdMatch[1] : null;
      expect(jobId).toBeTruthy();

      // View job detail
      const viewRes = await agent.get(`/jobs/${jobId}`);
      expect(viewRes.status).toBe(200);
      expect(viewRes.text).toContain('Tech Inc');
      expect(viewRes.text).toContain('Data Scientist');
      expect(viewRes.text).toContain('https://techinc.com/jobs/data-scientist');
      expect(viewRes.text).toContain('$120,000 - $180,000');
      expect(viewRes.text).toContain('ML work');
      expect(viewRes.text).toContain('New York, NY');
    });
  });

  describe('AC1.2: Job can be edited and changes persist', () => {
    it('should update a job via PUT /jobs/:id', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      // Create job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Original Corp',
          role: 'Engineer',
          salary_min: '100000',
          salary_max: '150000',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = jobIdMatch![1];

      // Update job
      const updateRes = await agent
        .put(`/jobs/${jobId}`)
        .send({
          company_name: 'Updated Corp',
          role: 'Senior Engineer',
          salary_min: '150000',
          salary_max: '200000',
        });

      expect(updateRes.status).toBe(200);
      expect(updateRes.text).toContain('Updated Corp');
      expect(updateRes.text).toContain('Senior Engineer');

      // Verify changes in database
      const db = getDb();
      const updatedJob = db.prepare('SELECT * FROM jobs WHERE id = ?').get(parseInt(jobId)) as any;

      expect(updatedJob.company_name).toBe('Updated Corp');
      expect(updatedJob.role).toBe('Senior Engineer');
      expect(updatedJob.salary_min).toBe(150000);
      expect(updatedJob.salary_max).toBe(200000);
    });

    it('should show updated fields when viewing edited job', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      // Create and update job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Test Co',
          role: 'Junior Dev',
          application_type: 'cold',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = jobIdMatch![1];

      await agent
        .put(`/jobs/${jobId}`)
        .send({
          company_name: 'Test Co Updated',
          role: 'Senior Dev',
        });

      // View job and verify changes
      const viewRes = await agent.get(`/jobs/${jobId}`);
      expect(viewRes.status).toBe(200);
      expect(viewRes.text).toContain('Test Co Updated');
      expect(viewRes.text).toContain('Senior Dev');
    });
  });

  describe('AC1.3: Contacts with notes can be added to a job', () => {
    it('should create a contact with all fields via POST /jobs/:jobId/contacts', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      // Create job first
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Test Company',
          role: 'Software Engineer',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = jobIdMatch![1];

      // Create contact
      const contactRes = await agent
        .post(`/jobs/${jobId}/contacts`)
        .send({
          name: 'John Doe',
          role: 'Hiring Manager',
          email: 'john@example.com',
          linkedin_url: 'https://linkedin.com/in/johndoe',
          notes: 'Met at conference',
        });

      expect(contactRes.status).toBe(200);

      // Verify contact in database
      const db = getDb();
      const contact = db.prepare('SELECT * FROM contacts WHERE name = ?').get('John Doe') as any;
      

      expect(contact).toBeDefined();
      expect(contact.job_id).toBe(parseInt(jobId));
      expect(contact.role).toBe('Hiring Manager');
      expect(contact.email).toBe('john@example.com');
      expect(contact.linkedin_url).toBe('https://linkedin.com/in/johndoe');
      expect(contact.notes).toBe('Met at conference');
    });
  });

  describe('AC1.4: Interactions (call, email, note) can be logged per contact', () => {
    it('should create an interaction via POST /jobs/:jobId/contacts/:id/interactions', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      // Create job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Test Company',
          role: 'Software Engineer',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = jobIdMatch![1];

      // Create contact
      await agent
        .post(`/jobs/${jobId}/contacts`)
        .send({
          name: 'Jane Doe',
          email: 'jane@example.com',
        });

      // Get contact ID from database (don't close db during test)
      const db = getDb();
      const contact = db.prepare('SELECT * FROM contacts WHERE name = ?').get('Jane Doe') as any;
      const contactId = contact.id;

      // Create interaction
      const interactionRes = await agent
        .post(`/jobs/${jobId}/contacts/${contactId}/interactions`)
        .send({
          type: 'call',
          content: 'Discussed role responsibilities',
        });

      expect(interactionRes.status).toBe(200);

      // Verify interaction in database
      const db2 = getDb();
      const interaction = db2
        .prepare('SELECT * FROM interactions WHERE contact_id = ? AND type = ?')
        .get(contactId, 'call') as any;

      expect(interaction).toBeDefined();
      expect(interaction.content).toBe('Discussed role responsibilities');
      expect(interaction.type).toBe('call');
    });

    it('should support different interaction types', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      // Create job and contact
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Test Company',
          role: 'Software Engineer',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = jobIdMatch![1];

      await agent
        .post(`/jobs/${jobId}/contacts`)
        .send({
          name: 'Bob Smith',
        });

      const db = getDb();
      const contact = db.prepare('SELECT * FROM contacts WHERE name = ?').get('Bob Smith') as any;
      const contactId = contact.id;

      // Test email interaction
      await agent
        .post(`/jobs/${jobId}/contacts/${contactId}/interactions`)
        .send({
          type: 'email',
          content: 'Sent CV',
        });

      // Test note interaction
      await agent
        .post(`/jobs/${jobId}/contacts/${contactId}/interactions`)
        .send({
          type: 'note',
          content: 'Follow up next week',
        });

      // Verify all interactions
      const db3 = getDb();
      const interactions = db3
        .prepare('SELECT * FROM interactions WHERE contact_id = ? ORDER BY occurred_at DESC')
        .all(contactId) as any[];

      expect(interactions).toHaveLength(2);
      expect(interactions.some((i) => i.type === 'email')).toBeTruthy();
      expect(interactions.some((i) => i.type === 'note')).toBeTruthy();
    });
  });

  describe('AC1.5: Freeform notes can be added per job', () => {
    it('should create a note via POST /jobs/:id/notes', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      // Create job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Test Company',
          role: 'Software Engineer',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = jobIdMatch![1];

      // Create note
      const noteRes = await agent
        .post(`/jobs/${jobId}/notes`)
        .send({
          content: 'This is an important note about the job',
        });

      expect(noteRes.status).toBe(200);

      // Verify note in database
      const db = getDb();
      const note = db.prepare('SELECT * FROM notes WHERE job_id = ?').get(parseInt(jobId)) as any;
      

      expect(note).toBeDefined();
      expect(note.content).toBe('This is an important note about the job');
    });

    it('should show notes when viewing job detail', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      // Create job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Test Company',
          role: 'Software Engineer',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = jobIdMatch![1];

      // Add note
      await agent
        .post(`/jobs/${jobId}/notes`)
        .send({
          content: 'Important note to remember',
        });

      // View job and verify note appears
      const viewRes = await agent.get(`/jobs/${jobId}`);
      expect(viewRes.status).toBe(200);
      expect(viewRes.text).toContain('Important note to remember');
    });
  });

  describe('AC1.6: Jobs can be tagged as warm (referral) or cold (blind)', () => {
    it('should create a warm job (referral)', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      const response = await agent
        .post('/jobs')
        .send({
          company_name: 'Warm Co',
          role: 'Engineer',
          application_type: 'warm',
        });

      expect(response.status).toBe(302);

      const db = getDb();
      const job = db.prepare('SELECT * FROM jobs WHERE company_name = ?').get('Warm Co') as any;
      

      expect(job.application_type).toBe('warm');
    });

    it('should create a cold job (blind application)', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      const response = await agent
        .post('/jobs')
        .send({
          company_name: 'Cold Co',
          role: 'Engineer',
          application_type: 'cold',
        });

      expect(response.status).toBe(302);

      const db = getDb();
      const job = db.prepare('SELECT * FROM jobs WHERE company_name = ?').get('Cold Co') as any;
      

      expect(job.application_type).toBe('cold');
    });

    it('should display application type in job list', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      // Create warm and cold jobs
      await agent
        .post('/jobs')
        .send({
          company_name: 'Warm Co',
          role: 'Engineer',
          application_type: 'warm',
        });

      await agent
        .post('/jobs')
        .send({
          company_name: 'Cold Co',
          role: 'Engineer',
          application_type: 'cold',
        });

      // View jobs list
      const listRes = await agent.get('/jobs');
      expect(listRes.status).toBe(200);
      expect(listRes.text).toContain('Referral');
      expect(listRes.text).toContain('Cold Apply');
    });
  });

  describe('AC1.13: Validation error for salary_min > salary_max', () => {
    it('should reject job creation with invalid salary range', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      const response = await agent
        .post('/jobs')
        .send({
          company_name: 'Invalid Salary Co',
          role: 'Engineer',
          salary_min: '150000',
          salary_max: '100000', // max < min
          application_type: 'warm',
        });

      expect(response.status).toBe(200);
      expect(response.text).toContain('Minimum salary cannot exceed maximum salary');

      // Verify job was NOT created
      const db = getDb();
      const job = db
        .prepare('SELECT * FROM jobs WHERE company_name = ?')
        .get('Invalid Salary Co') as any;

      expect(job).toBeUndefined();
    });

    it('should reject job update with invalid salary range', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      // Create valid job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Test Company',
          role: 'Engineer',
          salary_min: '100000',
          salary_max: '150000',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = jobIdMatch![1];

      // Try to update with invalid salary
      const updateRes = await agent
        .put(`/jobs/${jobId}`)
        .send({
          salary_min: '200000',
          salary_max: '100000', // invalid
        });

      expect(updateRes.status).toBe(400);
      expect(updateRes.text).toContain('Minimum salary cannot exceed maximum salary');

      // Verify job salary wasn't updated
      const db = getDb();
      const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(parseInt(jobId)) as any;
      

      expect(job.salary_min).toBe(100000); // Original value
      expect(job.salary_max).toBe(150000); // Original value
    });
  });
});
