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
