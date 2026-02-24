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
