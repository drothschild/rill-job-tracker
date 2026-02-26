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

  // Seed default stages (matching seed.ts)
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

describe('Pipeline Stage Transitions (AC1.7-AC1.12)', () => {
  describe('AC1.7: Jobs move through pipeline stages', () => {
    it('should transition a job from Applied to Phone Screen', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      // Create a job (starts at Applied, stage_id=1)
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Tech Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Engineer',
          application_type: 'warm',
        });

      expect(createRes.status).toBe(302);
      const locationHeader = createRes.headers.location;
      const jobIdMatch = locationHeader.match(/\/jobs\/(\d+)/);
      const jobId = jobIdMatch ? parseInt(jobIdMatch[1], 10) : null;
      expect(jobId).toBeTruthy();

      // Verify job is at Research stage (initial stage)
      let job = db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get(jobId) as any;
      expect(job.current_stage_id).toBe(6); // Research

      // Move to Applied first
      db.prepare('UPDATE jobs SET current_stage_id = 1 WHERE id = ?').run(jobId);

      // Transition to Phone Screen (stage 2)
      const transitionRes = await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 2,
        });

      expect(transitionRes.status).toBe(200);

      // Verify job moved to Phone Screen
      job = db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get(jobId) as any;
      expect(job.current_stage_id).toBe(2);
    });

    it('should transition a job from Phone Screen to Interview', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      // Create a job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'StartUp Inc',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Product Manager',
          application_type: 'cold',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      // Manually move to Phone Screen for this test
      db.prepare('UPDATE jobs SET current_stage_id = 2 WHERE id = ?').run(
        jobId
      );

      // Transition to Interview (stage 3)
      const transitionRes = await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 3,
        });

      expect(transitionRes.status).toBe(200);

      // Verify job moved to Interview
      const job = db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get(jobId) as any;
      expect(job.current_stage_id).toBe(3);
    });

    it('should transition a job from Interview to Offer', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      // Create a job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Big Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Senior Engineer',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      // Manually move to Interview
      db.prepare('UPDATE jobs SET current_stage_id = 3 WHERE id = ?').run(
        jobId
      );

      // Transition to Offer (stage 4)
      const transitionRes = await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 4,
        });

      expect(transitionRes.status).toBe(200);

      // Verify job moved to Offer
      const job = db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get(jobId) as any;
      expect(job.current_stage_id).toBe(4);
    });
  });

  describe('AC1.8: Custom sub-labels can be added to stage transitions', () => {
    it('should record sub_label when provided in transition', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      // Create a job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Test Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Developer',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      // Move to Applied first (jobs now start at Research)
      db.prepare('UPDATE jobs SET current_stage_id = 1 WHERE id = ?').run(jobId);

      // Transition with sub_label
      const transitionRes = await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 2,
          sub_label: 'Technical Interview',
        });

      expect(transitionRes.status).toBe(200);

      // Verify stage_transitions record has sub_label
      const transition = db
        .prepare('SELECT * FROM stage_transitions WHERE job_id = ? ORDER BY id DESC LIMIT 1')
        .get(jobId) as any;

      expect(transition).toBeDefined();
      expect(transition.sub_label).toBe('Technical Interview');
    });

    it('should allow transition without sub_label (optional)', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      // Create a job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Another Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Designer',
          application_type: 'cold',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      // Move to Applied first (jobs now start at Research)
      db.prepare('UPDATE jobs SET current_stage_id = 1 WHERE id = ?').run(jobId);

      // Transition without sub_label
      const transitionRes = await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 2,
        });

      expect(transitionRes.status).toBe(200);

      // Verify stage_transitions record has null sub_label
      const transition = db
        .prepare('SELECT * FROM stage_transitions WHERE job_id = ? ORDER BY id DESC LIMIT 1')
        .get(jobId) as any;

      expect(transition).toBeDefined();
      expect(transition.sub_label).toBeNull();
    });
  });

  describe('AC1.9: Stage transition history is recorded with timestamps', () => {
    it('should record from_stage, to_stage, and timestamp', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      // Create a job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'History Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Analyst',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      // Move to Applied first (jobs now start at Research)
      db.prepare('UPDATE jobs SET current_stage_id = 1 WHERE id = ?').run(jobId);

      // Transition Applied -> Phone Screen
      await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 2,
        });

      // Verify transition record
      const transition = db
        .prepare(`
          SELECT st.*, fs.name as from_stage_name, ts.name as to_stage_name
          FROM stage_transitions st
          LEFT JOIN stages fs ON st.from_stage_id = fs.id
          LEFT JOIN stages ts ON st.to_stage_id = ts.id
          WHERE st.job_id = ?
          ORDER BY st.id DESC
          LIMIT 1
        `)
        .get(jobId) as any;

      expect(transition).toBeDefined();
      expect(transition.from_stage_id).toBe(1);
      expect(transition.to_stage_id).toBe(2);
      expect(transition.from_stage_name).toBe('Applied');
      expect(transition.to_stage_name).toBe('Phone Screen');
      expect(transition.transitioned_at).toBeTruthy();
      expect(new Date(transition.transitioned_at).getTime()).toBeGreaterThan(0);
    });

    it('should record multiple transitions for the same job', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      // Create a job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Multi-Trans Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Specialist',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      // First transition: Research -> Applied
      await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 1,
        });

      // Second transition: Applied -> Phone Screen
      await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 2,
        });

      // Third transition: Phone Screen -> Interview
      await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 3,
        });

      // Verify all transitions were recorded
      // Note: job creation adds an initial transition to Research (stage 6)
      // so we expect 4 transitions total: initial + 3 manual transitions
      const transitions = db
        .prepare('SELECT * FROM stage_transitions WHERE job_id = ? ORDER BY id ASC')
        .all(jobId) as any[];

      expect(transitions.length).toBe(4);
      // First is the initial transition to Research (no from_stage)
      expect(transitions[0].to_stage_id).toBe(6);
      // Then the manual transitions
      expect(transitions[1].from_stage_id).toBe(6);
      expect(transitions[1].to_stage_id).toBe(1);
      expect(transitions[2].from_stage_id).toBe(1);
      expect(transitions[2].to_stage_id).toBe(2);
      expect(transitions[3].from_stage_id).toBe(2);
      expect(transitions[3].to_stage_id).toBe(3);
    });
  });

  describe('AC1.12: Invalid stage transitions are rejected', () => {
    it('should reject transition from Applied directly to Offer', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      // Create a job (starts at Applied)
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Invalid Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Tester',
          application_type: 'cold',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      // Move to Applied first (jobs now start at Research)
      db.prepare('UPDATE jobs SET current_stage_id = 1 WHERE id = ?').run(jobId);

      // Try invalid transition: Applied -> Offer
      const transitionRes = await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 4, // Offer
        });

      expect(transitionRes.status).toBe(422);
      expect(transitionRes.text).toContain('Invalid transition');

      // Verify job is still at Applied
      const job = db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get(jobId) as any;
      expect(job.current_stage_id).toBe(1);
    });

    it('should reject transition from Applied to Interview', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      // Create a job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Skip Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'QA',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      // Move to Applied first (jobs now start at Research)
      db.prepare('UPDATE jobs SET current_stage_id = 1 WHERE id = ?').run(jobId);

      // Try invalid transition: Applied -> Interview (skip Phone Screen)
      const transitionRes = await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 3, // Interview
        });

      expect(transitionRes.status).toBe(422);
      expect(transitionRes.text).toContain('Invalid transition');

      // Verify job is still at Applied
      const job = db
        .prepare('SELECT * FROM jobs WHERE id = ?')
        .get(jobId) as any;
      expect(job.current_stage_id).toBe(1);
    });
  });

  describe('Valid transitions', () => {
    it('should allow all defined valid transitions', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      const validTransitions = [
        { from: 1, to: 2, name: 'Applied -> Phone Screen' },
        { from: 1, to: 5, name: 'Applied -> Rejected' },
        { from: 2, to: 3, name: 'Phone Screen -> Interview' },
        { from: 2, to: 5, name: 'Phone Screen -> Rejected' },
        { from: 3, to: 4, name: 'Interview -> Offer' },
        { from: 3, to: 5, name: 'Interview -> Rejected' },
        { from: 4, to: 5, name: 'Offer -> Rejected' },
      ];

      for (let i = 0; i < validTransitions.length; i++) {
        const transition = validTransitions[i];

        // Create a job
        const createRes = await agent
          .post('/jobs')
          .send({
            company_name: `Valid Trans Corp ${i}`,
            role: 'Engineer',
            application_type: 'warm',
            salary_min: '100000',
            salary_max: '150000',
          });

        const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
        const jobId = parseInt(jobIdMatch![1], 10);

        // Move to from_stage (jobs now start at Research, so always set explicitly)
        db.prepare('UPDATE jobs SET current_stage_id = ? WHERE id = ?').run(
          transition.from,
          jobId
        );

        // Perform transition
        const transitionRes = await agent
          .post('/pipeline/transition')
          .send({
            job_id: jobId,
            to_stage_id: transition.to,
          });

        expect(transitionRes.status).toBe(200);

        // Verify job moved
        const job = db
          .prepare('SELECT * FROM jobs WHERE id = ?')
          .get(jobId) as any;
        expect(job.current_stage_id).toBe(
          transition.to
        );
      }
    });
  });

  describe('GET /pipeline', () => {
    it('should render the pipeline board', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      const res = await agent.get('/pipeline');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Applied');
      expect(res.text).toContain('Phone Screen');
      expect(res.text).toContain('Interview');
      expect(res.text).toContain('Offer');
      expect(res.text).toContain('Rejected');
    });

    it('should show jobs grouped by stage', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      // Create a job
      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Display Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Engineer',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      // Transition to Phone Screen
      await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 2,
        });

      // View pipeline
      const res = await agent.get('/pipeline');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Display Corp');
    });

    it('should render the Research stage on the pipeline board', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);

      const res = await agent.get('/pipeline');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Research');
    });
  });

  describe('Research stage', () => {
    it('should create new jobs in the Research stage', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Research Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Engineer',
          application_type: 'cold',
        });

      expect(createRes.status).toBe(302);
      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
      expect(job.current_stage_id).toBe(6); // Research
    });

    it('should allow transition from Research to Applied', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Apply Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Engineer',
          application_type: 'warm',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      // Job starts at Research (ID 6), transition to Applied (ID 1)
      const transitionRes = await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 1,
        });

      expect(transitionRes.status).toBe(200);
      const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
      expect(job.current_stage_id).toBe(1); // Applied
    });

    it('should allow transition from Applied back to Research', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      const createRes = await agent
        .post('/jobs')
        .send({
          company_name: 'Back To Research Corp',
          salary_min: '100000',
          salary_max: '150000',
          role: 'Engineer',
          application_type: 'cold',
        });

      const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
      const jobId = parseInt(jobIdMatch![1], 10);

      // Move to Applied first
      db.prepare('UPDATE jobs SET current_stage_id = 1 WHERE id = ?').run(jobId);

      // Transition back to Research (ID 6)
      const transitionRes = await agent
        .post('/pipeline/transition')
        .send({
          job_id: jobId,
          to_stage_id: 6,
        });

      expect(transitionRes.status).toBe(200);
      const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
      expect(job.current_stage_id).toBe(6); // Research
    });

    it('should allow transition from any stage back to Research', async () => {
      const app = createApp();
      const agent = await setupAuthenticatedSession(app);
      const db = getDb();

      const stagesWithResearch = [
        { id: 1, name: 'Applied' },
        { id: 2, name: 'Phone Screen' },
        { id: 3, name: 'Interview' },
        { id: 4, name: 'Offer' },
        { id: 5, name: 'Rejected' },
      ];

      for (const stage of stagesWithResearch) {
        const createRes = await agent
          .post('/jobs')
          .send({
            company_name: `${stage.name} Corp`,
            role: 'Engineer',
            application_type: 'cold',
            salary_min: '100000',
            salary_max: '150000',
          });

        const jobIdMatch = createRes.headers.location.match(/\/jobs\/(\d+)/);
        const jobId = parseInt(jobIdMatch![1], 10);

        db.prepare('UPDATE jobs SET current_stage_id = ? WHERE id = ?').run(stage.id, jobId);

        const transitionRes = await agent
          .post('/pipeline/transition')
          .send({
            job_id: jobId,
            to_stage_id: 6, // Research
          });

        expect(transitionRes.status).toBe(200);
        const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(jobId) as any;
        expect(job.current_stage_id).toBe(6);
      }
    });
  });
});
