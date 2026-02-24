import type Database from 'better-sqlite3';

// ============================================================================
// Jobs
// ============================================================================

export interface Job {
  id: number;
  company_name: string;
  role: string;
  link: string | null;
  salary_min: number | null;
  salary_max: number | null;
  application_type: 'warm' | 'cold';
  job_description: string | null;
  location: string | null;
  current_stage_id: number;
  follow_up_date: string | null;
  last_alert_sent_at: string | null;
  created_at: string;
  updated_at: string;
  stage_name?: string;
}

export interface CreateJobData {
  company_name: string;
  role: string;
  link?: string;
  salary_min?: number;
  salary_max?: number;
  application_type: 'warm' | 'cold';
  job_description?: string;
  location?: string;
  follow_up_date?: string;
}

export interface UpdateJobData {
  company_name?: string;
  role?: string;
  link?: string;
  salary_min?: number;
  salary_max?: number;
  application_type?: 'warm' | 'cold';
  job_description?: string;
  location?: string;
  follow_up_date?: string;
}

export function getAllJobs(db: Database.Database): Job[] {
  const stmt = db.prepare(`
    SELECT
      j.*,
      s.name as stage_name
    FROM jobs j
    LEFT JOIN stages s ON j.current_stage_id = s.id
    ORDER BY j.updated_at DESC
  `);
  return stmt.all() as Job[];
}

export function getJobById(db: Database.Database, id: number): Job | undefined {
  const stmt = db.prepare(`
    SELECT
      j.*,
      s.name as stage_name
    FROM jobs j
    LEFT JOIN stages s ON j.current_stage_id = s.id
    WHERE j.id = ?
  `);
  return stmt.get(id) as Job | undefined;
}

export function createJob(
  db: Database.Database,
  data: CreateJobData
): Job {
  const stmt = db.prepare(`
    INSERT INTO jobs (
      company_name,
      role,
      link,
      salary_min,
      salary_max,
      application_type,
      job_description,
      location,
      follow_up_date,
      current_stage_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    data.company_name,
    data.role,
    data.link || null,
    data.salary_min || null,
    data.salary_max || null,
    data.application_type,
    data.job_description || null,
    data.location || null,
    data.follow_up_date || null,
    1 // Default to first stage (usually "Applied")
  );

  const job = getJobById(db, info.lastInsertRowid as number);
  if (!job) {
    throw new Error('Failed to retrieve created job');
  }
  return job;
}

export function updateJob(
  db: Database.Database,
  id: number,
  data: UpdateJobData
): Job {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.company_name !== undefined) {
    updates.push('company_name = ?');
    values.push(data.company_name);
  }
  if (data.role !== undefined) {
    updates.push('role = ?');
    values.push(data.role);
  }
  if (data.link !== undefined) {
    updates.push('link = ?');
    values.push(data.link || null);
  }
  if (data.salary_min !== undefined) {
    updates.push('salary_min = ?');
    values.push(data.salary_min || null);
  }
  if (data.salary_max !== undefined) {
    updates.push('salary_max = ?');
    values.push(data.salary_max || null);
  }
  if (data.application_type !== undefined) {
    updates.push('application_type = ?');
    values.push(data.application_type);
  }
  if (data.job_description !== undefined) {
    updates.push('job_description = ?');
    values.push(data.job_description || null);
  }
  if (data.location !== undefined) {
    updates.push('location = ?');
    values.push(data.location || null);
  }
  if (data.follow_up_date !== undefined) {
    updates.push('follow_up_date = ?');
    values.push(data.follow_up_date || null);
  }

  // Always update updated_at
  updates.push("updated_at = datetime('now')");
  values.push(id);

  const stmt = db.prepare(`
    UPDATE jobs
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);

  const job = getJobById(db, id);
  if (!job) {
    throw new Error('Failed to retrieve updated job');
  }
  return job;
}

export function deleteJob(db: Database.Database, id: number): void {
  const stmt = db.prepare('DELETE FROM jobs WHERE id = ?');
  stmt.run(id);
}

// ============================================================================
// Contacts
// ============================================================================

export interface Contact {
  id: number;
  job_id: number;
  name: string;
  role: string | null;
  email: string | null;
  linkedin_url: string | null;
  notes: string | null;
  created_at: string;
}

export interface CreateContactData {
  job_id: number;
  name: string;
  role?: string;
  email?: string;
  linkedin_url?: string;
  notes?: string;
}

export interface UpdateContactData {
  name?: string;
  role?: string;
  email?: string;
  linkedin_url?: string;
  notes?: string;
}

export function getContactsByJobId(db: Database.Database, jobId: number): Contact[] {
  const stmt = db.prepare(`
    SELECT *
    FROM contacts
    WHERE job_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(jobId) as Contact[];
}

export function createContact(
  db: Database.Database,
  data: CreateContactData
): Contact {
  const stmt = db.prepare(`
    INSERT INTO contacts (job_id, name, role, email, linkedin_url, notes)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const info = stmt.run(
    data.job_id,
    data.name,
    data.role || null,
    data.email || null,
    data.linkedin_url || null,
    data.notes || null
  );

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(
    info.lastInsertRowid
  );
  if (!contact) {
    throw new Error('Failed to retrieve created contact');
  }
  return contact as Contact;
}

export function updateContact(
  db: Database.Database,
  id: number,
  data: UpdateContactData
): Contact {
  const updates: string[] = [];
  const values: unknown[] = [];

  if (data.name !== undefined) {
    updates.push('name = ?');
    values.push(data.name);
  }
  if (data.role !== undefined) {
    updates.push('role = ?');
    values.push(data.role || null);
  }
  if (data.email !== undefined) {
    updates.push('email = ?');
    values.push(data.email || null);
  }
  if (data.linkedin_url !== undefined) {
    updates.push('linkedin_url = ?');
    values.push(data.linkedin_url || null);
  }
  if (data.notes !== undefined) {
    updates.push('notes = ?');
    values.push(data.notes || null);
  }

  if (updates.length === 0) {
    const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
    return contact as Contact;
  }

  values.push(id);
  const stmt = db.prepare(`
    UPDATE contacts
    SET ${updates.join(', ')}
    WHERE id = ?
  `);

  stmt.run(...values);

  const contact = db.prepare('SELECT * FROM contacts WHERE id = ?').get(id);
  if (!contact) {
    throw new Error('Failed to retrieve updated contact');
  }
  return contact as Contact;
}

export function deleteContact(db: Database.Database, id: number): void {
  const stmt = db.prepare('DELETE FROM contacts WHERE id = ?');
  stmt.run(id);
}

// ============================================================================
// Interactions
// ============================================================================

export interface Interaction {
  id: number;
  contact_id: number;
  type: 'call' | 'email' | 'note';
  content: string;
  occurred_at: string;
}

export interface CreateInteractionData {
  contact_id: number;
  type: 'call' | 'email' | 'note';
  content: string;
}

export function getInteractionsByContactId(
  db: Database.Database,
  contactId: number
): Interaction[] {
  const stmt = db.prepare(`
    SELECT *
    FROM interactions
    WHERE contact_id = ?
    ORDER BY occurred_at DESC
  `);
  return stmt.all(contactId) as Interaction[];
}

export function createInteraction(
  db: Database.Database,
  data: CreateInteractionData
): Interaction {
  const stmt = db.prepare(`
    INSERT INTO interactions (contact_id, type, content)
    VALUES (?, ?, ?)
  `);

  const info = stmt.run(data.contact_id, data.type, data.content);

  const interaction = db
    .prepare('SELECT * FROM interactions WHERE id = ?')
    .get(info.lastInsertRowid);
  if (!interaction) {
    throw new Error('Failed to retrieve created interaction');
  }
  return interaction as Interaction;
}

// ============================================================================
// Notes
// ============================================================================

export interface Note {
  id: number;
  job_id: number;
  content: string;
  created_at: string;
}

export interface CreateNoteData {
  job_id: number;
  content: string;
}

export function getNotesByJobId(db: Database.Database, jobId: number): Note[] {
  const stmt = db.prepare(`
    SELECT *
    FROM notes
    WHERE job_id = ?
    ORDER BY created_at DESC
  `);
  return stmt.all(jobId) as Note[];
}

export function createNote(db: Database.Database, data: CreateNoteData): Note {
  const stmt = db.prepare(`
    INSERT INTO notes (job_id, content)
    VALUES (?, ?)
  `);

  const info = stmt.run(data.job_id, data.content);

  const note = db.prepare('SELECT * FROM notes WHERE id = ?').get(info.lastInsertRowid);
  if (!note) {
    throw new Error('Failed to retrieve created note');
  }
  return note as Note;
}

export function deleteNote(db: Database.Database, id: number): void {
  const stmt = db.prepare('DELETE FROM notes WHERE id = ?');
  stmt.run(id);
}

// ============================================================================
// Stages and Stage Transitions
// ============================================================================

export interface Stage {
  id: number;
  name: string;
  display_order: number;
}

export interface StageTransition {
  id: number;
  job_id: number;
  from_stage_id: number | null;
  to_stage_id: number;
  from_stage_name?: string;
  to_stage_name?: string;
  sub_label: string | null;
  transitioned_at: string;
}

export interface CreateStageTransitionData {
  job_id: number;
  from_stage_id: number;
  to_stage_id: number;
  sub_label?: string;
}

export interface JobsByStage {
  stageId: number;
  stageName: string;
  display_order: number;
  jobs: Job[];
}

/**
 * Raw row type for getJobsByStage query result
 */
interface JobsByStageRawRow {
  stageId: number;
  stageName: string;
  display_order: number;
  id: number | null;
  company_name: string | null;
  role: string | null;
  link: string | null;
  salary_min: number | null;
  salary_max: number | null;
  application_type: string | null;
  job_description: string | null;
  location: string | null;
  current_stage_id: number | null;
  follow_up_date: string | null;
  last_alert_sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  stage_name: string | null;
}

export function getAllStages(db: Database.Database): Stage[] {
  const stmt = db.prepare(`
    SELECT *
    FROM stages
    ORDER BY display_order
  `);
  return stmt.all() as Stage[];
}

export function getStageByName(db: Database.Database, name: string): Stage | undefined {
  const stmt = db.prepare(`
    SELECT *
    FROM stages
    WHERE name = ?
  `);
  return stmt.get(name) as Stage | undefined;
}

export function getStageById(db: Database.Database, id: number): Stage | undefined {
  const stmt = db.prepare(`
    SELECT *
    FROM stages
    WHERE id = ?
  `);
  return stmt.get(id) as Stage | undefined;
}

export function getJobsByStage(db: Database.Database): JobsByStage[] {
  const stmt = db.prepare(`
    SELECT
      s.id as stageId,
      s.name as stageName,
      s.display_order,
      j.id,
      j.company_name,
      j.role,
      j.link,
      j.salary_min,
      j.salary_max,
      j.application_type,
      j.job_description,
      j.location,
      j.current_stage_id,
      j.follow_up_date,
      j.last_alert_sent_at,
      j.created_at,
      j.updated_at,
      s.name as stage_name
    FROM stages s
    LEFT JOIN jobs j ON j.current_stage_id = s.id
    ORDER BY s.display_order, j.updated_at DESC
  `);

  const results = stmt.all() as JobsByStageRawRow[];
  const groupedByStage: { [key: number]: JobsByStage } = {};

  results.forEach((row) => {
    if (!groupedByStage[row.stageId]) {
      groupedByStage[row.stageId] = {
        stageId: row.stageId,
        stageName: row.stageName,
        display_order: row.display_order,
        jobs: [],
      };
    }
    if (row.id !== null) {
      groupedByStage[row.stageId].jobs.push({
        id: row.id,
        company_name: row.company_name!,
        role: row.role!,
        link: row.link,
        salary_min: row.salary_min,
        salary_max: row.salary_max,
        application_type: row.application_type as 'warm' | 'cold',
        job_description: row.job_description,
        location: row.location,
        current_stage_id: row.current_stage_id!,
        follow_up_date: row.follow_up_date,
        last_alert_sent_at: row.last_alert_sent_at,
        created_at: row.created_at!,
        updated_at: row.updated_at!,
        stage_name: row.stage_name,
      } as Job);
    }
  });

  // Sort by display_order to ensure consistent ordering regardless of Object.values() behavior
  return Object.values(groupedByStage).sort((a, b) => a.display_order - b.display_order);
}

export function createStageTransition(
  db: Database.Database,
  data: CreateStageTransitionData
): StageTransition {
  const stmt = db.prepare(`
    INSERT INTO stage_transitions (job_id, from_stage_id, to_stage_id, sub_label)
    VALUES (?, ?, ?, ?)
  `);

  const info = stmt.run(
    data.job_id,
    data.from_stage_id,
    data.to_stage_id,
    data.sub_label || null
  );

  const transition = db
    .prepare(`
      SELECT
        st.*,
        fs.name as from_stage_name,
        ts.name as to_stage_name
      FROM stage_transitions st
      LEFT JOIN stages fs ON st.from_stage_id = fs.id
      LEFT JOIN stages ts ON st.to_stage_id = ts.id
      WHERE st.id = ?
    `)
    .get(info.lastInsertRowid);

  if (!transition) {
    throw new Error('Failed to retrieve created stage transition');
  }
  return transition as StageTransition;
}

export function getStageTransitionsByJobId(
  db: Database.Database,
  jobId: number
): StageTransition[] {
  const stmt = db.prepare(`
    SELECT
      st.*,
      fs.name as from_stage_name,
      ts.name as to_stage_name
    FROM stage_transitions st
    LEFT JOIN stages fs ON st.from_stage_id = fs.id
    LEFT JOIN stages ts ON st.to_stage_id = ts.id
    WHERE st.job_id = ?
    ORDER BY st.transitioned_at DESC
  `);
  return stmt.all(jobId) as StageTransition[];
}

export function updateJobStage(
  db: Database.Database,
  jobId: number,
  stageId: number
): Job {
  const stmt = db.prepare(`
    UPDATE jobs
    SET current_stage_id = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  stmt.run(stageId, jobId);

  const job = getJobById(db, jobId);
  if (!job) {
    throw new Error('Failed to retrieve updated job');
  }
  return job;
}

// ============================================================================
// Dashboard Queries
// ============================================================================

export interface DashboardJob extends Omit<Job, 'stage_name'> {
  stage_name: string;
}

export interface ApplicationCountByDate {
  date: string;
  count: number;
}

/**
 * Get all jobs with their current stage names for dashboard metrics
 */
export function getJobsForDashboard(db: Database.Database): DashboardJob[] {
  const stmt = db.prepare(`
    SELECT
      j.*,
      s.name as stage_name
    FROM jobs j
    LEFT JOIN stages s ON j.current_stage_id = s.id
    ORDER BY j.updated_at DESC
  `);
  return stmt.all() as DashboardJob[];
}

/**
 * Get count of applications by date (created_at), ordered chronologically
 */
export function getApplicationsOverTime(db: Database.Database): ApplicationCountByDate[] {
  const stmt = db.prepare(`
    SELECT
      DATE(created_at) as date,
      COUNT(*) as count
    FROM jobs
    GROUP BY DATE(created_at)
    ORDER BY DATE(created_at) ASC
  `);
  return stmt.all() as ApplicationCountByDate[];
}

/**
 * Get jobs with overdue follow-up dates that are not in terminal stages
 */
export function getJobsWithOverdueFollowUp(db: Database.Database): DashboardJob[] {
  const stmt = db.prepare(`
    SELECT
      j.*,
      s.name as stage_name
    FROM jobs j
    LEFT JOIN stages s ON j.current_stage_id = s.id
    WHERE j.follow_up_date IS NOT NULL
      AND j.follow_up_date < datetime('now')
      AND s.name NOT IN ('Rejected', 'Offer')
    ORDER BY j.follow_up_date ASC
  `);
  return stmt.all() as DashboardJob[];
}

/**
 * Get jobs with no recent activity (not updated within threshold days)
 * that are not in terminal stages
 */
export function getStaleJobs(db: Database.Database, thresholdDays: number): DashboardJob[] {
  const stmt = db.prepare(`
    SELECT
      j.*,
      s.name as stage_name
    FROM jobs j
    LEFT JOIN stages s ON j.current_stage_id = s.id
    WHERE j.updated_at < datetime('now', ? || ' days')
      AND s.name NOT IN ('Rejected', 'Offer')
    ORDER BY j.updated_at DESC
  `);
  return stmt.all(`-${thresholdDays}`) as DashboardJob[];
}
