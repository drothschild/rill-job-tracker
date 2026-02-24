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
