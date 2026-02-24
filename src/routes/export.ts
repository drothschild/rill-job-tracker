import express from 'express';
import { getDb } from '../db/connection';
import { getFullExportData } from '../db/queries';

const router = express.Router();

/**
 * GET /export
 * Returns complete job tracker data as JSON file
 * Sets appropriate headers for file download
 */
router.get('/', (req, res) => {
  const db = getDb();
  const data = getFullExportData(db);

  // Format the export date as YYYY-MM-DD for filename
  const exportDate = new Date().toISOString().split('T')[0];

  // Set response headers
  res.setHeader('Content-Type', 'application/json');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="job-tracker-export-${exportDate}.json"`
  );

  // Send formatted JSON
  res.send(JSON.stringify(data, null, 2));
});

export default router;
