import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync, unlinkSync, existsSync } from 'fs';
import { createApp } from '../src/server';
import { getDb, closeDb } from '../src/db/connection';

// Test database setup - use temp file per test
let testDbPath: string;

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

describe('Authentication (AC2)', () => {
  describe('AC2.1: First-run setup screen', () => {
    it('should allow setting initial password via POST /auth/setup', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/auth/setup')
        .send({
          password: 'MySecurePassword123!',
          confirm_password: 'MySecurePassword123!',
        });

      // Should redirect to home
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');

      // Verify password hash was stored in database
      closeDb();
      const testDb = new Database(testDbPath);
      const setting = testDb
        .prepare("SELECT value FROM settings WHERE key = 'password_hash'")
        .get() as { value: string } | undefined;
      testDb.close();

      expect(setting).toBeDefined();
      expect(setting?.value).toBeTruthy();
      expect(setting?.value).not.toBe('MySecurePassword123!'); // Should be hashed
    });

    it('should reject mismatched passwords', async () => {
      const app = createApp();

      const response = await request(app)
        .post('/auth/setup')
        .send({
          password: 'Password123!',
          confirm_password: 'DifferentPassword123!',
        });

      // Should redirect back to setup
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/setup');

      // Verify no password was stored in DB
      closeDb();
      const testDb = new Database(testDbPath);
      const setting = testDb
        .prepare("SELECT value FROM settings WHERE key = 'password_hash'")
        .get();
      testDb.close();

      expect(setting).toBeUndefined();
    });

    it('should redirect to setup on GET /auth/setup when no password exists', async () => {
      const app = createApp();

      const response = await request(app).get('/auth/setup');

      expect(response.status).toBe(200);
      expect(response.text).toContain('Initial Setup');
    });
  });

  describe('AC2.2: Login with correct password', () => {
    it('should authenticate and redirect to / with correct password', async () => {
      const app = createApp();

      // First set a password via setup
      await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      // Now logout to clear the session
      const setupResponse = await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });
      const cookies = setupResponse.headers['set-cookie'];

      // Create fresh app and login
      const app2 = createApp();
      const loginResponse = await request(app2)
        .post('/auth/login')
        .send({
          password: 'TestPassword123!',
        });

      expect(loginResponse.status).toBe(302);
      expect(loginResponse.headers.location).toBe('/');

      // Verify session was created (cookies set)
      expect(loginResponse.headers['set-cookie']).toBeDefined();
    });
  });

  describe('AC2.3: Session persistence', () => {
    it('should maintain session across multiple requests', async () => {
      const app = createApp();

      // Set password via setup
      const setupRes = await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      const cookies = setupRes.headers['set-cookie'];

      // Should be able to access protected route with the session cookie
      const dashRes = await request(app)
        .get('/')
        .set('Cookie', cookies);

      expect(dashRes.status).toBe(200);
      expect(dashRes.text).toContain('Dashboard');
    });

    it('should redirect to login without valid session', async () => {
      const app = createApp();

      // Set password via setup
      await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      // Create fresh app (simulating different session)
      const app2 = createApp();

      // Try to access protected route without session
      const dashRes = await request(app2).get('/');

      expect(dashRes.status).toBe(302);
      expect(dashRes.headers.location).toBe('/auth/login');
    });
  });

  describe('AC2.4: Logout', () => {
    it('should destroy session and redirect to login on POST /auth/logout', async () => {
      const app = createApp();

      // Set password and login
      const setupRes = await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      const cookies = setupRes.headers['set-cookie'];

      // Verify logged in
      const dashRes = await request(app)
        .get('/')
        .set('Cookie', cookies);
      expect(dashRes.status).toBe(200);

      // Logout
      const logoutRes = await request(app)
        .post('/auth/logout')
        .set('Cookie', cookies);

      expect(logoutRes.status).toBe(302);
      expect(logoutRes.headers.location).toBe('/auth/login');

      // Verify session is destroyed - should redirect to login
      const afterLogoutRes = await request(app)
        .get('/')
        .set('Cookie', cookies);

      expect(afterLogoutRes.status).toBe(302);
      expect(afterLogoutRes.headers.location).toBe('/auth/login');
    });
  });

  describe('AC2.5: Change password', () => {
    it('should update password with valid current password', async () => {
      const app = createApp();

      // Set initial password
      const setupRes = await request(app)
        .post('/auth/setup')
        .send({
          password: 'OldPassword123!',
          confirm_password: 'OldPassword123!',
        });

      const cookies = setupRes.headers['set-cookie'];

      // Change password
      const changeRes = await request(app)
        .post('/auth/change-password')
        .set('Cookie', cookies)
        .send({
          current_password: 'OldPassword123!',
          new_password: 'NewPassword456!',
          confirm_password: 'NewPassword456!',
        });

      expect(changeRes.status).toBe(200);
      expect(changeRes.body.success).toBe(true);

      // Verify old password no longer works
      const app2 = createApp();
      const oldLoginRes = await request(app2)
        .post('/auth/login')
        .send({
          password: 'OldPassword123!',
        });

      expect(oldLoginRes.status).toBe(302);
      expect(oldLoginRes.headers.location).toBe('/auth/login');

      // Verify new password works
      const newLoginRes = await request(app2)
        .post('/auth/login')
        .send({
          password: 'NewPassword456!',
        });

      expect(newLoginRes.status).toBe(302);
      expect(newLoginRes.headers.location).toBe('/');
    });

    it('should reject password change with wrong current password', async () => {
      const app = createApp();

      // Set password
      const setupRes = await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      const cookies = setupRes.headers['set-cookie'];

      // Try to change with wrong current password
      const changeRes = await request(app)
        .post('/auth/change-password')
        .set('Cookie', cookies)
        .send({
          current_password: 'WrongPassword123!',
          new_password: 'NewPassword456!',
          confirm_password: 'NewPassword456!',
        });

      expect(changeRes.status).toBe(401);
      expect(changeRes.body.error).toContain('Current password is incorrect');
    });
  });

  describe('AC2.6: Login failure', () => {
    it('should return error and not create session with wrong password', async () => {
      const app = createApp();

      // Set password
      await request(app)
        .post('/auth/setup')
        .send({
          password: 'CorrectPassword123!',
          confirm_password: 'CorrectPassword123!',
        });

      // Create fresh app and try wrong password
      const app2 = createApp();
      const loginRes = await request(app2)
        .post('/auth/login')
        .send({
          password: 'WrongPassword123!',
        });

      // Should redirect back to login with error
      expect(loginRes.status).toBe(302);
      expect(loginRes.headers.location).toBe('/auth/login');

      // Session should not be authenticated
      const dashRes = await request(app2).get('/');
      expect(dashRes.status).toBe(302);
      expect(dashRes.headers.location).toBe('/auth/login');
    });

    it('should display error message on login page after failed attempt', async () => {
      const app = createApp();

      // Set password
      await request(app)
        .post('/auth/setup')
        .send({
          password: 'CorrectPassword123!',
          confirm_password: 'CorrectPassword123!',
        });

      // Try wrong password
      const loginRes = await request(app)
        .post('/auth/login')
        .send({
          password: 'WrongPassword123!',
        });

      const cookies = loginRes.headers['set-cookie'];

      // Get login page with error message
      const pageRes = await request(app)
        .get('/auth/login')
        .set('Cookie', cookies);

      expect(pageRes.status).toBe(200);
      expect(pageRes.text).toContain('Invalid password');
    });
  });

  describe('AC2.7: Protected routes redirect', () => {
    it('should redirect / to /auth/setup when no password exists (first run)', async () => {
      const app = createApp();

      // Try to access / without any password set
      const res = await request(app).get('/');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/auth/setup');
    });

    it('should redirect / to /auth/login when password exists but not authenticated', async () => {
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

      // Try to access /
      const res = await request(app2).get('/');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/auth/login');
    });

    it('should allow access to /auth/login without authentication', async () => {
      const app = createApp();

      // Set password
      await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      // Create fresh app
      const app2 = createApp();

      // Should be able to access login page
      const res = await request(app2).get('/auth/login');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Login');
    });

    it('should allow access to /auth/setup without authentication', async () => {
      const app = createApp();

      // Fresh app with no password set
      const res = await request(app).get('/auth/setup');

      expect(res.status).toBe(200);
      expect(res.text).toContain('Initial Setup');
    });

    it('should redirect /auth/change-password without authentication', async () => {
      const app = createApp();

      // Set password
      await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      // Create fresh app
      const app2 = createApp();

      // Try to change password without auth
      const res = await request(app2).post('/auth/change-password').send({
        current_password: 'TestPassword123!',
        new_password: 'NewPassword456!',
        confirm_password: 'NewPassword456!',
      });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain('Not authenticated');
    });

    it('should redirect /health to login without authentication', async () => {
      const app = createApp();

      // Set password
      await request(app)
        .post('/auth/setup')
        .send({
          password: 'TestPassword123!',
          confirm_password: 'TestPassword123!',
        });

      // Create fresh app
      const app2 = createApp();

      // Try to access health endpoint
      const res = await request(app2).get('/health');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/auth/login');
    });
  });
});
