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
import jobRoutes from './routes/jobs';
import contactRoutes from './routes/contacts';
import pipelineRoutes from './routes/pipeline';
import dashboardRoutes from './routes/dashboard';
import settingsRoutes from './routes/settings';
import { startAlertScheduler } from './alerts/scheduler';

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

  // Mount dashboard routes at root
  app.use('/', dashboardRoutes);

  // Mount auth routes
  app.use('/auth', authRoutes);

  // Mount job routes
  app.use('/jobs', jobRoutes);

  // Mount contact routes (nested under jobs/:jobId)
  app.use('/jobs/:jobId/contacts', contactRoutes);

  // Mount pipeline routes
  app.use('/pipeline', pipelineRoutes);

  // Mount settings routes
  app.use('/settings', settingsRoutes);

  // Health check route
  app.get('/health', (_req, res) => {
    const stages = db.prepare('SELECT * FROM stages ORDER BY display_order').all();
    res.json({ status: 'ok', stages });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  const db = getDb();
  const PORT = parseInt(process.env.PORT || '3000', 10);

  const server = app.listen(PORT, () => {
    console.log(`Job tracker running on http://localhost:${PORT}`);

    // Start the alert scheduler after server starts
    const alertSchedulerTask = startAlertScheduler(db);

    // Graceful shutdown
    const shutdown = () => {
      console.log('Shutting down gracefully...');
      // Stop the alert scheduler
      if (alertSchedulerTask) {
        alertSchedulerTask.stop();
      }
      server.close(() => {
        closeDb();
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  });
}
