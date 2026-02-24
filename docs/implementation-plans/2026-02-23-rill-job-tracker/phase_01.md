# Rill Job Tracker Implementation Plan - Phase 1

**Goal:** Working Node.js project with SQLite database, schema migrations, Docker setup, and seeded pipeline stages

**Architecture:** Monolithic Node.js Express server using TypeScript, better-sqlite3 for persistence with WAL mode, tsx for development

**Tech Stack:** Node.js 20+, TypeScript 5.x, Express, better-sqlite3, tsx, Docker

**Scope:** 8 phases from original design (phase 1 of 8)

**Codebase verified:** 2026-02-23 — confirmed greenfield, no existing files. Rill project at /Users/davidrothschild/Projects/rill-lang/ confirmed with CommonJS output and expected API.

---

## Acceptance Criteria Coverage

This phase is infrastructure — no acceptance criteria are tested. Verification is operational (install, build, run, Docker).

**Verifies: None** (infrastructure scaffolding)

**Testing workflow:** All functionality phases (2-8) follow TDD per CLAUDE.md conventions: write the failing test first, verify it fails, implement minimum code to pass, verify pass, commit. Infrastructure phases (this phase) are verified operationally. Test framework: vitest + supertest (installed in this phase).

---

<!-- START_TASK_1 -->
### Task 1: Create package.json with all dependencies

**Files:**
- Create: `package.json`

**Step 1: Create package.json**

```json
{
  "name": "rill-job-tracker",
  "version": "1.0.0",
  "private": true,
  "description": "Personal job application tracker with Rill rule engine",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "start": "tsx src/server.ts",
    "build": "tsc",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "bcrypt": "^5.1.1",
    "better-sqlite3": "^12.6.2",
    "better-sqlite3-session-store": "^0.1.0",
    "express": "^4.21.0",
    "express-session": "^1.18.1",
    "node-cron": "^4.2.1",
    "nodemailer": "^8.0.1",
    "rill-lang": "file:../../Projects/rill-lang",
    "tsx": "^4.21.0"
  },
  "devDependencies": {
    "@types/bcrypt": "^5.0.2",
    "@types/better-sqlite3": "^7.6.12",
    "@types/express": "^5.0.0",
    "@types/express-session": "^1.18.1",
    "@types/node": "^22.0.0",
    "@types/node-cron": "^3.0.11",
    "@types/nodemailer": "^6.4.17",
    "@types/supertest": "^6.0.0",
    "supertest": "^7.0.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0"
  }
}
```

**Step 2: Run npm install**

```bash
npm install
```

Expected: Installs without errors. `node_modules/rill-lang` symlinked to local project.

**Step 3: Verify rill-lang is linked**

```bash
ls -la node_modules/rill-lang
```

Expected: Symlink or directory pointing to `/Users/davidrothschild/Projects/rill-lang`.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: initialize package.json with all dependencies"
```
<!-- END_TASK_1 -->

<!-- START_TASK_2 -->
### Task 2: Create tsconfig.json

**Files:**
- Create: `tsconfig.json`

**Step 1: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "lib": ["ES2022"],
    "moduleResolution": "Node16",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "isolatedModules": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 2: Verify TypeScript compiles (empty project)**

```bash
npx tsc --noEmit
```

Expected: No errors (no source files yet, should succeed or exit cleanly).

**Step 3: Commit**

```bash
git add tsconfig.json
git commit -m "chore: add tsconfig.json with strict CommonJS config"
```
<!-- END_TASK_2 -->

<!-- START_SUBCOMPONENT_A (tasks 3-5) -->
<!-- START_TASK_3 -->
### Task 3: Create database connection module

**Files:**
- Create: `src/db/connection.ts`

**Step 1: Create src/db/connection.ts**

```typescript
import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';

const DB_PATH = process.env.DB_PATH || path.join(process.cwd(), 'data', 'tracker.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    mkdirSync(path.dirname(DB_PATH), { recursive: true });
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Step 3: Commit**

```bash
git add src/db/connection.ts
git commit -m "feat: add SQLite database connection with WAL mode"
```
<!-- END_TASK_3 -->

<!-- START_TASK_4 -->
### Task 4: Create database schema module

**Files:**
- Create: `src/db/schema.ts`

**Step 1: Create src/db/schema.ts**

This creates all 7 tables specified in the design: jobs, stages, stage_transitions, contacts, interactions, notes, settings.

```typescript
import type Database from 'better-sqlite3';

export function createSchema(db: Database.Database): void {
  db.exec(`
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
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Step 3: Commit**

```bash
git add src/db/schema.ts
git commit -m "feat: add database schema with all 7 tables"
```
<!-- END_TASK_4 -->

<!-- START_TASK_5 -->
### Task 5: Create database seed module

**Files:**
- Create: `src/db/seed.ts`

**Step 1: Create src/db/seed.ts**

```typescript
import type Database from 'better-sqlite3';

const PIPELINE_STAGES = [
  { name: 'Applied', display_order: 1 },
  { name: 'Phone Screen', display_order: 2 },
  { name: 'Interview', display_order: 3 },
  { name: 'Offer', display_order: 4 },
  { name: 'Rejected', display_order: 5 },
];

export function seedStages(db: Database.Database): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO stages (name, display_order) VALUES (?, ?)'
  );

  const runSeeds = db.transaction(() => {
    for (const stage of PIPELINE_STAGES) {
      insert.run(stage.name, stage.display_order);
    }
  });

  runSeeds();
}
```

**Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Step 3: Commit**

```bash
git add src/db/seed.ts
git commit -m "feat: add pipeline stage seed data"
```
<!-- END_TASK_5 -->
<!-- END_SUBCOMPONENT_A -->

<!-- START_TASK_6 -->
### Task 6: Create Express server with database initialization

**Files:**
- Create: `src/server.ts`

**Step 1: Create src/server.ts**

```typescript
import express from 'express';
import path from 'path';
import { getDb, closeDb } from './db/connection';
import { createSchema } from './db/schema';
import { seedStages } from './db/seed';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

// Initialize database
const db = getDb();
createSchema(db);
seedStages(db);

// Health check route
app.get('/health', (_req, res) => {
  const stages = db.prepare('SELECT * FROM stages ORDER BY display_order').all();
  res.json({ status: 'ok', stages });
});

const server = app.listen(PORT, () => {
  console.log(`Job tracker running on http://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  server.close(() => {
    closeDb();
    process.exit(0);
  });
});
```

**Step 2: Create data directory**

```bash
mkdir -p data public
```

**Step 3: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: Compiles without errors.

**Step 4: Start the server and verify**

```bash
npx tsx src/server.ts &
sleep 2
curl http://localhost:3000/health
kill %1
```

Expected: Server starts, health endpoint returns JSON with status "ok" and all 5 pipeline stages. Database file created at `data/tracker.db`.

**Step 5: Verify database tables exist**

```bash
sqlite3 data/tracker.db ".tables"
```

Expected: Output shows all 7 tables: `contacts  interactions  jobs  notes  settings  stage_transitions  stages`

**Step 6: Verify seeded stages**

```bash
sqlite3 data/tracker.db "SELECT * FROM stages;"
```

Expected: 5 rows with Applied, Phone Screen, Interview, Offer, Rejected in order.

**Step 7: Commit**

```bash
git add src/server.ts
git commit -m "feat: add Express server with database initialization and health check"
```
<!-- END_TASK_6 -->

<!-- START_TASK_7 -->
### Task 7: Create Dockerfile and docker-compose.yml

**Files:**
- Create: `Dockerfile`
- Create: `docker-compose.yml`
- Create: `.dockerignore`

**Step 1: Create .dockerignore**

```
node_modules
dist
data
.git
*.md
```

**Step 2: Create build script for Docker**

Create `scripts/docker-build.sh` that copies the rill-lang dependency into the build context:

```bash
#!/bin/bash
set -e
# Copy rill-lang into build context (Docker can't access paths outside context)
mkdir -p .docker-deps/rill-lang
cp -r ../../Projects/rill-lang/dist .docker-deps/rill-lang/dist
cp ../../Projects/rill-lang/package.json .docker-deps/rill-lang/package.json
docker build -t rill-job-tracker .
```

**Step 3: Create Dockerfile**

```dockerfile
FROM node:20-alpine

WORKDIR /app

# Copy Rill dependency (prepared by docker-build.sh)
COPY .docker-deps/rill-lang /rill-lang

# Copy package files and update rill-lang path for Docker
COPY package.json package-lock.json ./
RUN sed -i 's|file:../../Projects/rill-lang|file:/rill-lang|' package.json

RUN npm ci

# Copy application code
COPY tsconfig.json ./
COPY src/ ./src/
COPY public/ ./public/
COPY rules/ ./rules/

# Create data directory
RUN mkdir -p /data

ENV DB_PATH=/data/tracker.db
ENV PORT=3000
ENV NODE_ENV=production

EXPOSE 3000

HEALTHCHECK CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["npx", "tsx", "src/server.ts"]
```

**Step 4: Create docker-compose.yml**

```yaml
services:
  tracker:
    build:
      context: .
      dockerfile: Dockerfile
    ports:
      - "3000:3000"
    volumes:
      - tracker-data:/data
    environment:
      - DB_PATH=/data/tracker.db
      - PORT=3000
      - SESSION_SECRET=${SESSION_SECRET:-change-me-in-production}
    restart: unless-stopped

volumes:
  tracker-data:
```

**Step 5: Verify Docker build** (if Docker is available)

```bash
bash scripts/docker-build.sh
```

Expected: Build completes successfully. If Docker is not available, skip this step — verify the Dockerfile syntax is correct.

**Step 6: Commit**

```bash
git add Dockerfile docker-compose.yml .dockerignore scripts/docker-build.sh
git commit -m "chore: add Docker configuration for QNAP deployment"
```
<!-- END_TASK_7 -->

<!-- START_TASK_8 -->
### Task 8: Add .gitignore and clean up data directory

**Files:**
- Create: `.gitignore`

**Step 1: Create .gitignore**

```
node_modules/
dist/
data/*.db
data/*.db-wal
data/*.db-shm
.env
```

**Step 2: Commit**

```bash
git add .gitignore
git commit -m "chore: add .gitignore for node_modules, dist, and database files"
```
<!-- END_TASK_8 -->
