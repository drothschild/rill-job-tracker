import type { Request, Response } from 'express';
import { Router } from 'express';
import { getDb } from '../db/connection';
import {
  getAllStages,
  getJobsByStage,
  getJobById,
  getStageByName,
  getStageById,
  updateJobStage,
  createStageTransition,
} from '../db/queries';
import { evaluateRule } from '../rill/bridge';
import { escapeHtml } from '../views/helpers';
import { layout } from '../views/layout';
import { pipelineBoardView } from '../views/pipeline/board';

const router = Router();

/**
 * GET /pipeline - Render pipeline Kanban board
 */
router.get('/', (req: Request, res: Response): void => {
  const db = getDb();

  const stages = getAllStages(db);
  const jobsByStage = getJobsByStage(db);

  const html = pipelineBoardView(stages, jobsByStage);
  const page = layout('Pipeline', html, req);
  res.send(page);
});

/**
 * POST /pipeline/transition - Process stage transition with Rill validation
 */
router.post('/transition', (req: Request, res: Response): void => {
  const db = getDb();

  // Parse form data
  const jobId = parseInt(req.body.job_id, 10);
  const toStageId = parseInt(req.body.to_stage_id, 10);
  const subLabel = (req.body.sub_label || '').trim() || null;

  // Validate inputs
  if (isNaN(jobId) || isNaN(toStageId)) {
    res.status(400).send('Invalid job_id or to_stage_id');
    return;
  }

  // Get current job to find from_stage_id
  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  const fromStageId = job.current_stage_id;

  // Look up stage names
  const fromStage = getStageById(db, fromStageId);
  const toStage = getStageById(db, toStageId);

  if (!fromStage || !toStage) {
    res.status(400).send('Invalid stage ID');
    return;
  }

  // Evaluate Rill transitions.lv rule
  const ruleResult = evaluateRule('rules/transitions.lv', {
    from_stage: fromStage.name,
    to_stage: toStage.name,
  });

  if (!ruleResult.success) {
    // Rill execution failed
    res.status(422).send(`
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 font-medium">Validation error: ${escapeHtml(ruleResult.error || 'Unknown error')}</p>
      </div>
    `);
    return;
  }

  // Check if result is an Err tag
  const resultValue = ruleResult.value as any;
  if (resultValue && resultValue.tag === 'Err') {
    // Invalid transition
    res.status(422).send(`
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 font-medium">${escapeHtml(resultValue.value)}</p>
      </div>
    `);
    return;
  }

  // Transition is valid - update job and create transition record
  try {
    updateJobStage(db, jobId, toStageId);
    createStageTransition(db, {
      job_id: jobId,
      from_stage_id: fromStageId,
      to_stage_id: toStageId,
      sub_label: subLabel,
    });

    // Return updated pipeline board partial
    const stages = getAllStages(db);
    const jobsByStage = getJobsByStage(db);
    const html = pipelineBoardView(stages, jobsByStage);
    res.send(html);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    res.status(500).send(`
      <div class="bg-red-50 border border-red-200 rounded-lg p-4">
        <p class="text-red-800 font-medium">Error: ${escapeHtml(message)}</p>
      </div>
    `);
  }
});

export default router;
