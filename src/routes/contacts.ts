import type { Request, Response } from 'express';
import { Router } from 'express';
import { getDb } from '../db/connection';
import {
  getJobById,
  getContactsByJobId,
  createContact,
  updateContact,
  deleteContact,
  getInteractionsByContactId,
  createInteraction,
  type CreateContactData,
  type UpdateContactData,
  type CreateInteractionData,
} from '../db/queries';
import { escapeHtml, formatDate } from '../views/helpers';

const router = Router({ mergeParams: true });

/**
 * GET /jobs/:jobId/contacts/new - Render add contact form
 */
router.get('/new', (req: Request, res: Response): void => {
  const jobIdParam = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const jobId = parseInt(jobIdParam, 10);

  const job = getJobById(getDb(), jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  const html = `
    <form hx-post="/jobs/${jobId}/contacts" hx-target="#contacts-section" class="space-y-3">
      <div>
        <input type="text" name="name" placeholder="Contact name *" required class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm" />
      </div>
      <div>
        <input type="text" name="role" placeholder="Role (e.g. Recruiter, Hiring Manager)" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm" />
      </div>
      <div>
        <input type="email" name="email" placeholder="Email" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm" />
      </div>
      <div>
        <input type="url" name="linkedin_url" placeholder="LinkedIn URL" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm" />
      </div>
      <div>
        <textarea name="notes" rows="2" placeholder="Notes" class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm text-gray-900 bg-white focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"></textarea>
      </div>
      <div class="flex gap-2">
        <button type="submit" class="flex-1 px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium">Save</button>
        <button type="button" hx-get="/jobs/${jobId}" hx-target="#contacts-section" hx-select="#contacts-section" class="flex-1 px-3 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 font-medium">Cancel</button>
      </div>
    </form>
  `;
  res.send(html);
});

/**
 * GET /jobs/:jobId/contacts/:id/edit - Render inline edit form for a contact
 */
router.get('/:id/edit', (req: Request, res: Response): void => {
  const db = getDb();
  const jobIdParam = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(jobIdParam, 10);
  const contactId = parseInt(idParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  const contacts = getContactsByJobId(db, jobId);
  const contact = contacts.find((c) => c.id === contactId);
  if (!contact) {
    res.status(404).send('Contact not found');
    return;
  }

  const html = `
    <div id="contact-card-${contactId}" class="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
      <form hx-put="/jobs/${jobId}/contacts/${contactId}" hx-target="#contact-card-${contactId}" hx-swap="outerHTML" class="space-y-3">
        <div><input type="text" name="name" value="${escapeHtml(contact.name)}" required class="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white text-sm" /></div>
        <div><input type="text" name="role" value="${escapeHtml(contact.role || '')}" placeholder="Role" class="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white text-sm" /></div>
        <div><input type="email" name="email" value="${escapeHtml(contact.email || '')}" placeholder="Email" class="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white text-sm" /></div>
        <div><input type="url" name="linkedin_url" value="${escapeHtml(contact.linkedin_url || '')}" placeholder="LinkedIn URL" class="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white text-sm" /></div>
        <div><textarea name="notes" rows="2" placeholder="Notes" class="w-full px-3 py-2 border border-gray-300 rounded text-gray-900 bg-white text-sm">${escapeHtml(contact.notes || '')}</textarea></div>
        <div class="flex gap-2">
          <button type="submit" class="flex-1 px-3 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-700 font-medium">Update</button>
          <button type="button" hx-get="/jobs/${jobId}" hx-target="#contacts-section" hx-select="#contacts-section" class="flex-1 px-3 py-2 bg-gray-200 text-gray-800 rounded text-sm hover:bg-gray-300 font-medium">Cancel</button>
        </div>
      </form>
    </div>
  `;
  res.send(html);
});

/**
 * POST /jobs/:jobId/contacts - Create contact for job
 */
router.post('/', (req: Request, res: Response): void => {
  const db = getDb();
  const jobIdParam = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const jobId = parseInt(jobIdParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  // Parse form data
  const data: CreateContactData = {
    job_id: jobId,
    name: (req.body.name || '').trim(),
    role: req.body.role ? (req.body.role || '').trim() : undefined,
    email: req.body.email ? (req.body.email || '').trim() : undefined,
    linkedin_url: req.body.linkedin_url ? (req.body.linkedin_url || '').trim() : undefined,
    notes: req.body.notes ? (req.body.notes || '').trim() : undefined,
  };

  if (!data.name) {
    res.status(400).send('Contact name is required');
    return;
  }

  const contact = createContact(db, data);

  // Return updated contacts section partial
  const contacts = getContactsByJobId(db, jobId);

  const contactsHtml = contacts.length === 0
    ? '<p class="text-gray-500">No contacts yet. Add one to track interactions.</p>'
    : `
      <div class="space-y-4">
        ${contacts
          .map(
            (c) => `
          <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <div class="flex justify-between items-start mb-3">
              <div>
                <h4 class="font-bold text-gray-900">${escapeHtml(c.name)}</h4>
                ${c.role ? `<p class="text-sm text-gray-600">${escapeHtml(c.role)}</p>` : ''}
              </div>
              <button
                hx-delete="/jobs/${jobId}/contacts/${c.id}"
                hx-target="#contacts-section"
                hx-confirm="Delete this contact?"
                class="text-red-600 hover:text-red-800 text-sm font-medium"
              >
                Delete
              </button>
            </div>

            <!-- Contact details -->
            <div class="space-y-1 text-sm mb-3">
              ${c.email ? `<p><a href="mailto:${escapeHtml(c.email)}" class="text-blue-600 hover:text-blue-800">${escapeHtml(c.email)}</a></p>` : ''}
              ${c.linkedin_url ? `<p><a href="${escapeHtml(c.linkedin_url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800">LinkedIn Profile →</a></p>` : ''}
              ${c.notes ? `<p class="text-gray-600"><strong>Notes:</strong> ${escapeHtml(c.notes)}</p>` : ''}
            </div>

            <!-- Interactions section would be populated here -->
            <div class="mt-3 pt-3 border-t border-gray-300">
              <details class="text-sm">
                <summary class="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
                  Interactions (0)
                </summary>
                <!-- Interactions list would go here -->
              </details>
            </div>
          </div>
        `
          )
          .join('')}
      </div>
    `;

  const page = contactsHtml;
  res.send(page);
});

/**
 * PUT /jobs/:jobId/contacts/:id - Update contact
 */
router.put('/:id', (req: Request, res: Response): void => {
  const db = getDb();
  const jobIdParam = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(jobIdParam, 10);
  const contactId = parseInt(idParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  // Parse form data
  const data: UpdateContactData = {};
  if (req.body.name) data.name = (req.body.name || '').trim();
  if (req.body.role !== undefined) data.role = req.body.role ? (req.body.role || '').trim() : undefined;
  if (req.body.email !== undefined) data.email = req.body.email ? (req.body.email || '').trim() : undefined;
  if (req.body.linkedin_url !== undefined) data.linkedin_url = req.body.linkedin_url ? (req.body.linkedin_url || '').trim() : undefined;
  if (req.body.notes !== undefined) data.notes = req.body.notes ? (req.body.notes || '').trim() : undefined;

  const contact = updateContact(db, contactId, data);

  // Return updated contact card (outerHTML swap replaces the card in place)
  const html = `
    <div id="contact-card-${contact.id}" class="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
      <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
        <div class="min-w-0">
          <h4 class="font-bold text-gray-900 break-words">${escapeHtml(contact.name)}</h4>
          ${contact.role ? `<p class="text-xs sm:text-sm text-gray-600 break-words">${escapeHtml(contact.role)}</p>` : ''}
        </div>
        <div class="flex gap-2">
          <button
            hx-get="/jobs/${jobId}/contacts/${contact.id}/edit"
            hx-target="#contact-card-${contact.id}"
            hx-swap="outerHTML"
            class="w-full sm:w-auto px-3 py-1 text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium"
          >
            Edit
          </button>
          <button
            hx-delete="/jobs/${jobId}/contacts/${contact.id}"
            hx-target="#contact-card-${contact.id}"
            hx-swap="outerHTML"
            hx-confirm="Delete this contact?"
            class="w-full sm:w-auto px-3 py-1 text-red-600 hover:text-red-800 text-xs sm:text-sm font-medium"
          >
            Delete
          </button>
        </div>
      </div>

      <!-- Contact details -->
      <div class="space-y-1 text-xs sm:text-sm mb-3">
        ${contact.email ? `<p><a href="mailto:${escapeHtml(contact.email)}" class="text-blue-600 hover:text-blue-800 break-all">${escapeHtml(contact.email)}</a></p>` : ''}
        ${contact.linkedin_url ? `<p><a href="${escapeHtml(contact.linkedin_url)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 break-all">LinkedIn Profile →</a></p>` : ''}
        ${contact.notes ? `<p class="text-gray-600 break-words"><strong>Notes:</strong> ${escapeHtml(contact.notes)}</p>` : ''}
      </div>

      <!-- Interactions section would be populated here -->
      <div class="mt-3 pt-3 border-t border-gray-300">
        <details class="text-xs sm:text-sm">
          <summary class="cursor-pointer font-medium text-gray-700 hover:text-gray-900">
            Interactions (0)
          </summary>
          <!-- Interactions list would go here -->
        </details>
      </div>
    </div>
  `;
  res.send(html);
});

/**
 * DELETE /jobs/:jobId/contacts/:id - Delete contact
 */
router.delete('/:id', (req: Request, res: Response): void => {
  const db = getDb();
  const jobIdParam = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(jobIdParam, 10);
  const contactId = parseInt(idParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  deleteContact(db, contactId);

  // Return empty (HTMX removes element)
  res.send('');
});

/**
 * POST /jobs/:jobId/contacts/:id/interactions - Log interaction
 */
router.post('/:id/interactions', (req: Request, res: Response): void => {
  const db = getDb();
  const jobIdParam = Array.isArray(req.params.jobId) ? req.params.jobId[0] : req.params.jobId;
  const idParam = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const jobId = parseInt(jobIdParam, 10);
  const contactId = parseInt(idParam, 10);

  const job = getJobById(db, jobId);
  if (!job) {
    res.status(404).send('Job not found');
    return;
  }

  // Parse form data
  const data: CreateInteractionData = {
    contact_id: contactId,
    type: (req.body.type || 'note') as 'call' | 'email' | 'note',
    content: (req.body.content || '').trim(),
  };

  if (!data.content) {
    res.status(400).send('Interaction content is required');
    return;
  }

  createInteraction(db, data);

  // Return updated interaction list partial
  const interactions = getInteractionsByContactId(db, contactId);

  const interactionColors: { [key: string]: string } = {
    'call': 'bg-blue-100 text-blue-800',
    'email': 'bg-green-100 text-green-800',
    'note': 'bg-purple-100 text-purple-800',
  };

  const getInteractionColor = (type: string): string => {
    return interactionColors[type] || 'bg-gray-100 text-gray-800';
  };

  const html = interactions.length === 0
    ? '<p class="text-gray-500 text-sm">No interactions yet.</p>'
    : `
      <div class="space-y-2">
        ${interactions
          .map(
            (interaction) => `
          <div class="text-sm">
            <span class="inline-block px-2 py-1 rounded text-xs font-medium ${getInteractionColor(interaction.type)}">
              ${interaction.type.toUpperCase()}
            </span>
            <p class="text-gray-600 mt-1">${escapeHtml(interaction.content)}</p>
            <p class="text-xs text-gray-500">${formatDate(interaction.occurred_at)}</p>
          </div>
        `
          )
          .join('')}
      </div>
    `;

  res.send(html);
});

export default router;
