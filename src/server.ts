import express from 'express';
import path from 'path';
import session from 'express-session';
// @ts-expect-error - better-sqlite3-session-store lacks type definitions
import BetterSqlite3SessionStore from 'better-sqlite3-session-store';
import { getDb, closeDb } from './db/connection';
import { createSchema } from './db/schema';
import { seedStages } from './db/seed';
import { authMiddleware } from './middleware/auth';
import authRoutes from './routes/auth';

export function createApp(): express.Application {
  const app = express();

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

  // Apply auth middleware
  app.use(authMiddleware);

  // Mount auth routes
  app.use('/auth', authRoutes);

  // Root dashboard route (placeholder)
  app.get('/', (_req, res) => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard</title>
        <style>
          body { font-family: sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
          .container { max-width: 800px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { color: #333; }
          .logout-btn { padding: 10px 20px; background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; }
          .logout-btn:hover { background: #c82333; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Dashboard</h1>
          <p>Welcome to the Job Tracker.</p>
          <form method="POST" action="/auth/logout" style="display: inline;">
            <button type="submit" class="logout-btn">Logout</button>
          </form>
        </div>
      </body>
      </html>
    `);
  });

  // Health check route
  app.get('/health', (_req, res) => {
    const stages = db.prepare('SELECT * FROM stages ORDER BY display_order').all();
    res.json({ status: 'ok', stages });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const PORT = parseInt(process.env.PORT || '3000', 10);

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
}
