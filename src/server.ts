import express from 'express';
import path from 'path';
import session from 'express-session';
// @ts-expect-error - better-sqlite3-session-store lacks type definitions
import BetterSqlite3SessionStore from 'better-sqlite3-session-store';
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

// Configure session middleware
const SqliteStore = BetterSqlite3SessionStore(session);
const sessionSecret = process.env.SESSION_SECRET || 'dev-secret-key';

app.use(
  session({
    store: new SqliteStore({
      client: db,
    }),
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days in milliseconds
      sameSite: 'lax',
    },
  })
);

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
