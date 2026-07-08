import type { Request, Response } from 'express';
import { Router } from 'express';
import { getDb } from '../db/connection';
import {
  getAllJobs,
  getJobById,
  createJob,
  updateJob,
  deleteJob,
  getContactsByJobId,
  getNotesByJobId,
  createNote,
  deleteNote,
  type CreateJobData,
  type UpdateJobData,
} from '../db/queries';
import { evaluateRule } from '../rill/bridge';
import { layout } from '../views/layout';
import { escapeHtml } from '../views/helpers';
import { jobListView } from '../views/jobs/list';
import { jobFormView } from '../views/jobs/form';
import { jobDetailView } from '../views/jobs/detail';
import { fetchJobDescription } from '../utils/fetchJobDescription';

const router = Router();

/**
 * GET /jobs - List all jobs
 */
router.get('/', (req: Request, res: Response): void => {
  const db = getDb();
  const jobs = getAllJobs(db);

  const html = jobListView(jobs);
  const page = layout('Jobs', html, req);
  res.send(page);
});

/**
 * GET /jobs/new - Show create form
 */
router.get('/new', (req: Request, res: Response): void => {
  const html = jobFormView();
  const page = layout('Create Job', html, req);
  res.send(page);
});

/**
 * GET /jobs/:id - Show job detail
 */
router.get('/:id', (req: Request, res: Response): void => {
  const db = getDb();
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(idParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  const contacts = getContactsByJobId(db, jobId);
  const notes = getNotesByJobId(db, jobId);

  // Get stage history
  const stageHistory = db
    .prepare(`
      SELECT st.*, s.name as to_stage_name
      FROM stage_transitions st
      LEFT JOIN stages s ON st.to_stage_id = s.id
      WHERE st.job_id = ?
      ORDER BY st.transitioned_at DESC
    `)
    .all(jobId) as any[];

  const html = jobDetailView(job, contacts, notes, stageHistory);
  const page = layout(job.company_name, html, req);
  res.send(page);
});

/**
 * GET /jobs/:id/edit - Show edit form
 */
router.get('/:id/edit', (req: Request, res: Response): void => {
  const db = getDb();
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(idParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  const html = jobFormView(job);
  const page = layout('Edit Job', html, req);
  res.send(page);
});

/**
 * POST /jobs - Create job with Rill validation
 */
router.post('/', (req: Request, res: Response): void => {
  const db = getDb();

  // Parse form data
  const formData = {
    company_name: (req.body.company_name || '').trim(),
    role: (req.body.role || '').trim(),
    link: (req.body.link || '').trim() || null,
    salary_min: req.body.salary_min ? parseInt(req.body.salary_min, 10) : 0,
    salary_max: req.body.salary_max ? parseInt(req.body.salary_max, 10) : 0,
    application_type: (req.body.application_type || 'cold') as 'warm' | 'cold',
    job_description: (req.body.job_description || '').trim() || null,
    location: (req.body.location || '').trim() || null,
    follow_up_date: (req.body.follow_up_date || '').trim() || null,
  };

  // Run Rill validation
  const validationResult = evaluateRule('rules/validation.lv', { job: formData });

  if (!validationResult.success) {
    // Validation failed - re-render form with error
    let errorHtml = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p class="text-red-800 font-medium">${validationResult.error}</p>
      </div>
    `;
    errorHtml += jobFormView();

    const page = layout('Create Job', errorHtml, req);
    res.send(page);
    return;
  }

  // Check if result is an Err tag
  const resultValue = validationResult.value as any;
  if (resultValue && resultValue.tag === 'Err') {
    // Validation error
    let errorHtml = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p class="text-red-800 font-medium">${resultValue.value}</p>
      </div>
    `;
    errorHtml += jobFormView();

    const page = layout('Create Job', errorHtml, req);
    res.send(page);
    return;
  }

  // Create job
  const createData: CreateJobData = {
    company_name: formData.company_name,
    role: formData.role,
    link: formData.link as string | undefined,
    salary_min: formData.salary_min as number | undefined,
    salary_max: formData.salary_max as number | undefined,
    application_type: formData.application_type,
    job_description: formData.job_description as string | undefined,
    location: formData.location as string | undefined,
    follow_up_date: formData.follow_up_date as string | undefined,
  };

  const job = createJob(db, createData);

  // Create initial stage transition (use the job's actual initial stage)
  db.prepare(`
    INSERT INTO stage_transitions (job_id, to_stage_id, transitioned_at)
    VALUES (?, ?, datetime('now'))
  `).run(job.id, job.current_stage_id);

  // Redirect to job detail
  res.redirect(`/jobs/${job.id}`);
});

/**
 * PUT /jobs/:id - Update job with Rill validation
 */
router.put('/:id', (req: Request, res: Response): void => {
  const db = getDb();
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(idParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  // Parse form data (allow partial updates)
  const formData = {
    company_name: req.body.company_name ? (req.body.company_name || '').trim() : job.company_name,
    role: req.body.role ? (req.body.role || '').trim() : job.role,
    salary_min: req.body.salary_min !== undefined ? (req.body.salary_min ? parseInt(req.body.salary_min, 10) : 0) : (job.salary_min || 0),
    salary_max: req.body.salary_max !== undefined ? (req.body.salary_max ? parseInt(req.body.salary_max, 10) : 0) : (job.salary_max || 0),
  };

  // Run Rill validation on updated fields
  const validationResult = evaluateRule('rules/validation.lv', { job: formData });

  if (!validationResult.success) {
    res.status(400).send(`Validation error: ${validationResult.error}`);
    return;
  }

  // Check if result is an Err tag
  const resultValue = validationResult.value as any;
  if (resultValue && resultValue.tag === 'Err') {
    res.status(400).send(`Validation error: ${resultValue.value}`);
    return;
  }

  // Update job
  const updateData: UpdateJobData = {};
  if (req.body.company_name) updateData.company_name = req.body.company_name.trim();
  if (req.body.role) updateData.role = req.body.role.trim();
  if (req.body.link !== undefined) updateData.link = req.body.link?.trim() || undefined;
  if (req.body.salary_min !== undefined) updateData.salary_min = req.body.salary_min ? parseInt(req.body.salary_min, 10) : undefined;
  if (req.body.salary_max !== undefined) updateData.salary_max = req.body.salary_max ? parseInt(req.body.salary_max, 10) : undefined;
  if (req.body.application_type) updateData.application_type = req.body.application_type as 'warm' | 'cold';
  if (req.body.job_description !== undefined) updateData.job_description = req.body.job_description?.trim() || undefined;
  if (req.body.location !== undefined) updateData.location = req.body.location?.trim() || undefined;
  if (req.body.follow_up_date !== undefined) updateData.follow_up_date = req.body.follow_up_date?.trim() || undefined;

  const updatedJob = updateJob(db, jobId, updateData);

  // Return updated job detail partial
  const contacts = getContactsByJobId(db, jobId);
  const notes = getNotesByJobId(db, jobId);
  const stageHistory = db
    .prepare(`
      SELECT st.*, s.name as to_stage_name
      FROM stage_transitions st
      LEFT JOIN stages s ON st.to_stage_id = s.id
      WHERE st.job_id = ?
      ORDER BY st.transitioned_at DESC
    `)
    .all(jobId) as any[];

  const html = jobDetailView(updatedJob, contacts, notes, stageHistory);
  const page = layout(updatedJob.company_name, html, req);
  res.send(page);
});

/**
 * POST /jobs/:id/fetch-description - Fetch job description text from the job's link
 */
router.post('/:id/fetch-description', async (req: Request, res: Response): Promise<void> => {
  const db = getDb();
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(idParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  if (!job.link) {
    res.status(400).send('This job has no link to fetch a description from.');
    return;
  }

  let errorHtml = '';
  let currentJob = job;

  try {
    const description = await fetchJobDescription(job.link);
    currentJob = updateJob(db, jobId, { job_description: description });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errorHtml = `
      <div class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
        <p class="text-red-800 font-medium">${escapeHtml(message)}</p>
      </div>
    `;
  }

  const contacts = getContactsByJobId(db, jobId);
  const notes = getNotesByJobId(db, jobId);
  const stageHistory = db
    .prepare(`
      SELECT st.*, s.name as to_stage_name
      FROM stage_transitions st
      LEFT JOIN stages s ON st.to_stage_id = s.id
      WHERE st.job_id = ?
      ORDER BY st.transitioned_at DESC
    `)
    .all(jobId) as any[];

  const html = errorHtml + jobDetailView(currentJob, contacts, notes, stageHistory);
  const page = layout(currentJob.company_name, html, req);
  res.send(page);
});

/**
 * DELETE /jobs/:id - Delete job
 */
router.delete('/:id', (req: Request, res: Response): void => {
  const db = getDb();
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(idParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  deleteJob(db, jobId);

  // Redirect to jobs list
  res.redirect('/jobs');
});

/**
 * POST /jobs/:id/notes - Add note to job
 */
router.post('/:id/notes', (req: Request, res: Response): void => {
  const db = getDb();
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(idParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  const content = (req.body.content || '').trim();
  if (!content) {
    res.status(400).send('Note content is required');
    return;
  }

  createNote(db, {
    job_id: jobId,
    content,
  });

  // Return updated notes section
  const notes = getNotesByJobId(db, jobId);

  const notesHtml = notes.length === 0
    ? '<p class="text-gray-500">No notes yet.</p>'
    : `
      <div class="space-y-4">
        ${notes
          .map(
            (note) => `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div class="flex justify-between items-start mb-2">
              <p class="text-sm text-gray-600">${new Date(note.created_at).toLocaleDateString()}</p>
              <button
                hx-delete="/jobs/${jobId}/notes/${note.id}"
                hx-target="#notes-section"
                hx-confirm="Delete this note?"
                class="text-red-600 hover:text-red-800 text-sm"
              >
                Delete
              </button>
            </div>
            <p class="text-gray-800 whitespace-pre-wrap">${escapeHtml(content)}</p>
          </div>
        `
          )
          .join('')}
      </div>
    `;

  const page = layout('Notes', notesHtml, req);
  res.send(page);
});

/**
 * DELETE /jobs/:id/notes/:noteId - Delete note
 */
router.delete('/:id/notes/:noteId', (req: Request, res: Response): void => {
  const db = getDb();
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const noteIdParam = Array.isArray(req.params.noteId) ? req.params.noteId[0] : req.params.noteId;
  const jobId = parseInt(idParam, 10);
  const noteId = parseInt(noteIdParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  deleteNote(db, noteId);

  // Return updated notes section
  const notes = getNotesByJobId(db, jobId);

  const notesHtml = notes.length === 0
    ? '<p class="text-gray-500">No notes yet.</p>'
    : `
      <div class="space-y-4">
        ${notes
          .map(
            (note) => `
          <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div class="flex justify-between items-start mb-2">
              <p class="text-sm text-gray-600">${new Date(note.created_at).toLocaleDateString()}</p>
              <button
                hx-delete="/jobs/${jobId}/notes/${note.id}"
                hx-target="#notes-section"
                hx-confirm="Delete this note?"
                class="text-red-600 hover:text-red-800 text-sm"
              >
                Delete
              </button>
            </div>
            <p class="text-gray-800 whitespace-pre-wrap">${escapeHtml(note.content)}</p>
          </div>
        `
          )
          .join('')}
      </div>
    `;

  const page = layout('Notes', notesHtml, req);
  res.send(page);
});

export default router;
