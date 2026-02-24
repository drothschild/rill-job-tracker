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
  updates.push('updated_at = datetime("now")');
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
