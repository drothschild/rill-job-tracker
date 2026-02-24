import Database from 'better-sqlite3';
import path from 'path';
import { mkdirSync } from 'fs';

let db: Database.Database | null = null;
let currentDbPath: string | null = null;

function getDbPath(): string {
  return process.env.DB_PATH || path.join(process.cwd(), 'data', 'tracker.db');
}

export function getDb(): Database.Database {
  const dbPath = getDbPath();

  // If DB_PATH changed (e.g., in tests), close old connection and create new one
  if (currentDbPath !== dbPath) {
    if (db) {
      db.close();
      db = null;
    }
    currentDbPath = dbPath;
  }

  if (!db) {
    mkdirSync(path.dirname(dbPath), { recursive: true });
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
    currentDbPath = null;
  }
}
