import type { Job, Contact, Interaction, Note } from '../../db/queries';
import { escapeHtml, formatDate, formatSalary } from '../helpers';

interface StageHistory {
  id: number;
  job_id: number;
  from_stage_id: number | null;
  to_stage_id: number;
  sub_label: string | null;
  transitioned_at: string;
  to_stage_name?: string;
}

/**
 * Renders a detailed view of a single job with all fields, contacts, interactions, notes,
 * and stage transition history.
 *
 * @param job The job object
 * @param contacts Array of Contact objects for this job
 * @param notes Array of Note objects for this job
 * @param stageHistory Array of stage transition objects
 * @returns HTML detail page
 */
export function jobDetailView(
  job: Job,
  contacts: Contact[],
  notes: Note[],
  stageHistory: StageHistory[] = []
): string {
  // Get interactions for all contacts
  const getContactInteractions = (contactId: number, allInteractions: Interaction[]): Interaction[] => {
    return allInteractions.filter((i) => i.contact_id === contactId);
  };

  // Color mapping for interaction types
  const interactionColors: { [key: string]: string } = {
    'call': 'bg-blue-100 text-blue-800',
    'email': 'bg-green-100 text-green-800',
    'note': 'bg-purple-100 text-purple-800',
  };

  const getInteractionColor = (type: string): string => {
    return interactionColors[type] || 'bg-gray-100 text-gray-800';
  };

  const renderContactCard = (contact: Contact): string => {
    return `
      <div id="contact-card-${contact.id}" class="bg-gray-50 rounded-lg p-3 sm:p-4 border border-gray-200">
        <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
          <div class="min-w-0">
            <h4 class="font-bold text-gray-900 break-words">${escapeHtml(contact.name)}</h4>
            ${contact.role ? `<p class="text-xs sm:text-sm text-gray-600 break-words">${escapeHtml(contact.role)}</p>` : ''}
          </div>
          <div class="flex gap-2">
            <button
              hx-get="/jobs/${job.id}/contacts/${contact.id}/edit"
              hx-target="#contact-card-${contact.id}"
              hx-swap="outerHTML"
              class="w-full sm:w-auto px-3 py-1 text-blue-600 hover:text-blue-800 text-xs sm:text-sm font-medium"
            >
              Edit
            </button>
            <button
              hx-delete="/jobs/${job.id}/contacts/${contact.id}"
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
  };

  const stageColor = (stageName?: string): string => {
    const colors: { [key: string]: string } = {
      'Applied': 'bg-blue-100 text-blue-800',
      'Interview': 'bg-yellow-100 text-yellow-800',
      'Offer': 'bg-green-100 text-green-800',
      'Rejected': 'bg-red-100 text-red-800',
      'Accepted': 'bg-green-200 text-green-900',
      'Withdrawn': 'bg-gray-100 text-gray-800',
    };
    return stageName && colors[stageName] ? colors[stageName] : 'bg-gray-100 text-gray-800';
  };

  return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
      <!-- Main Content -->
      <div class="md:col-span-2 space-y-6 md:space-y-8">
        <!-- Job Header -->
        <div class="bg-white rounded-lg shadow p-4 sm:p-6">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3 mb-4">
            <div class="min-w-0">
              <h2 class="text-xl sm:text-2xl font-bold text-gray-900 break-words">${escapeHtml(job.company_name)}</h2>
              <p class="text-base sm:text-lg text-gray-600 break-words">${escapeHtml(job.role)}</p>
            </div>
            <a
              href="/jobs/${job.id}/edit"
              class="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm text-center"
            >
              Edit
            </a>
          </div>

          <!-- Job details -->
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
            <div>
              <p class="text-gray-500">Current Stage</p>
              <span class="inline-block mt-1 px-3 py-1 rounded-full font-medium ${stageColor(job.stage_name)}">
                ${job.stage_name ? escapeHtml(job.stage_name) : 'No Stage'}
              </span>
            </div>
            <div>
              <p class="text-gray-500">Application Type</p>
              <p class="font-medium text-gray-900 mt-1">${job.application_type === 'warm' ? 'Referral' : 'Cold Apply'}</p>
            </div>
            <div>
              <p class="text-gray-500">Salary</p>
              <p class="font-medium text-gray-900 mt-1">${formatSalary(job.salary_min, job.salary_max)}</p>
            </div>
            <div>
              <p class="text-gray-500">Location</p>
              <p class="font-medium text-gray-900 mt-1 break-words">${job.location ? escapeHtml(job.location) : 'Not specified'}</p>
            </div>
            ${job.link ? `
              <div class="col-span-1 sm:col-span-2">
                <p class="text-gray-500">Job Link</p>
                <a href="${escapeHtml(job.link)}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 font-medium mt-1 block break-all text-xs sm:text-sm">
                  ${escapeHtml(job.link)}
                </a>
              </div>
            ` : ''}
            ${job.follow_up_date ? `
              <div>
                <p class="text-gray-500">Follow-up Date</p>
                <p class="font-medium text-gray-900 mt-1">${formatDate(job.follow_up_date)}</p>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Job Description -->
        ${job.job_description ? `
          <div class="bg-white rounded-lg shadow p-4 sm:p-6">
            <h3 class="text-lg font-bold text-gray-900 mb-4">Job Description</h3>
            <div class="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap text-xs sm:text-sm break-words">
              ${escapeHtml(job.job_description)}
            </div>
          </div>
        ` : ''}

        <!-- Contacts Section -->
        <div id="contacts-section" class="bg-white rounded-lg shadow p-4 sm:p-6">
          <div class="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 mb-4">
            <h3 class="text-lg font-bold text-gray-900">Contacts</h3>
            <button
              hx-get="/jobs/${job.id}/contacts/new"
              hx-target="this"
              class="w-full sm:w-auto px-3 py-2 bg-green-600 text-white rounded text-sm hover:bg-green-700 font-medium"
            >
              Add Contact
            </button>
          </div>

          ${contacts.length === 0
            ? '<p class="text-gray-500">No contacts yet. Add one to track interactions.</p>'
            : `
              <div class="space-y-3 sm:space-y-4">
                ${contacts.map((contact) => renderContactCard(contact)).join('')}
              </div>
            `}
        </div>

        <!-- Notes Section -->
        <div id="notes-section" class="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Notes</h3>

          <!-- Add Note Form -->
          <form hx-post="/jobs/${job.id}/notes" hx-target="#notes-section" class="mb-6">
            <div class="space-y-3">
              <textarea
                name="content"
                rows="3"
                placeholder="Add a note about this job..."
                class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
                required
              ></textarea>
              <button
                type="submit"
                class="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
              >
                Add Note
              </button>
            </div>
          </form>

          <!-- Notes List -->
          ${notes.length === 0
            ? '<p class="text-gray-500">No notes yet.</p>'
            : `
              <div class="space-y-3 sm:space-y-4">
                ${notes
                  .map(
                    (note) => `
                  <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-3 sm:p-4">
                    <div class="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                      <p class="text-xs sm:text-sm text-gray-600">${formatDate(note.created_at)}</p>
                      <button
                        hx-delete="/jobs/${job.id}/notes/${note.id}"
                        hx-target="#notes-section"
                        hx-confirm="Delete this note?"
                        class="text-red-600 hover:text-red-800 text-xs sm:text-sm"
                      >
                        Delete
                      </button>
                    </div>
                    <p class="text-gray-800 whitespace-pre-wrap text-sm break-words">${escapeHtml(note.content)}</p>
                  </div>
                `
                  )
                  .join('')}
              </div>
            `}
        </div>
      </div>

      <!-- Sidebar -->
      <div class="md:col-span-1">
        <!-- Timeline -->
        <div class="bg-white rounded-lg shadow p-4 sm:p-6">
          <h3 class="text-lg font-bold text-gray-900 mb-4">Timeline</h3>
          <div class="space-y-4 text-xs sm:text-sm">
            <div>
              <p class="text-gray-500">Created</p>
              <p class="font-medium text-gray-900">${formatDate(job.created_at)}</p>
            </div>
            <div>
              <p class="text-gray-500">Last Updated</p>
              <p class="font-medium text-gray-900">${formatDate(job.updated_at)}</p>
            </div>
          </div>

          ${stageHistory.length > 0
            ? `
              <div class="mt-6 pt-6 border-t border-gray-200">
                <h4 class="font-medium text-gray-900 mb-3">Stage History</h4>
                <div class="space-y-3">
                  ${stageHistory
                    .map(
                      (transition) => `
                    <div class="text-xs sm:text-sm">
                      <p class="text-gray-600">${formatDate(transition.transitioned_at)}</p>
                      <p class="font-medium text-gray-900">
                        ${transition.to_stage_name ? escapeHtml(transition.to_stage_name) : 'Unknown'}
                        ${transition.sub_label ? ` - ${escapeHtml(transition.sub_label)}` : ''}
                      </p>
                    </div>
                  `
                    )
                    .join('')}
                </div>
              </div>
            `
            : ''}
        </div>

        <!-- Delete Button -->
        <div class="mt-6">
          <form method="POST" action="/jobs/${job.id}" style="display: none;">
            <input type="hidden" name="_method" value="DELETE">
          </form>
          <button
            hx-delete="/jobs/${job.id}"
            hx-confirm="Delete this job? This cannot be undone."
            hx-redirect="/jobs"
            class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium text-sm"
          >
            Delete Job
          </button>
        </div>
      </div>
    </div>
  `;
}
