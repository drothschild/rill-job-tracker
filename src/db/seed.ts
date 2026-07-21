import type Database from 'better-sqlite3';

const PIPELINE_STAGES = [
  { name: 'Research', display_order: 0 },
  { name: 'Applied', display_order: 1 },
  { name: 'Phone Screen', display_order: 2 },
  { name: 'Tech Screen', display_order: 3 },
  { name: 'Interview', display_order: 4 },
  { name: 'Offer', display_order: 5 },
  { name: 'Rejected', display_order: 6 },
];

export function seedStages(db: Database.Database): void {
  const insert = db.prepare(
    'INSERT OR IGNORE INTO stages (name, display_order) VALUES (?, ?)'
  );
  const update = db.prepare(
    'UPDATE stages SET display_order = ? WHERE name = ?'
  );

  const runSeeds = db.transaction(() => {
    for (const stage of PIPELINE_STAGES) {
      insert.run(stage.name, stage.display_order);
      // Keep display_order current for pre-existing rows (e.g. when a new
      // stage is inserted mid-pipeline and later stages shift down).
      update.run(stage.display_order, stage.name);
    }
  });

  runSeeds();
}
