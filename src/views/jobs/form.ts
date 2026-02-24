import type { Job } from '../../db/queries';
import { escapeHtml, formatDate } from '../helpers';

/**
 * Renders a form for creating or editing a job.
 * If a job is provided, pre-fills the form fields for editing.
 * Form uses HTMX: hx-post="/jobs" for create, hx-put="/jobs/:id" for update.
 *
 * @param job Optional job object for editing mode
 * @returns HTML form string
 */
export function jobFormView(job?: Job): string {
  const isEdit = !!job;
  const formMethod = isEdit ? 'PUT' : 'POST';
  const formAction = isEdit ? `/jobs/${job!.id}` : '/jobs';
  const submitLabel = isEdit ? 'Update Job' : 'Create Job';

  // Parse date for form input (YYYY-MM-DD format)
  const followUpDateValue = job?.follow_up_date
    ? new Date(job.follow_up_date).toISOString().split('T')[0]
    : '';

  return `
    <div class="w-full max-w-2xl mx-auto">
      <form hx-${formMethod.toLowerCase()}="${formAction}" hx-target="main" class="space-y-6 bg-white p-4 sm:p-6 rounded-lg shadow">
        <!-- Company Name -->
        <div>
          <label for="company_name" class="block text-sm font-medium text-gray-700 mb-2">
            Company Name
            <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="company_name"
            name="company_name"
            required
            value="${isEdit ? escapeHtml(job!.company_name) : ''}"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <!-- Role -->
        <div>
          <label for="role" class="block text-sm font-medium text-gray-700 mb-2">
            Role
            <span class="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="role"
            name="role"
            required
            value="${isEdit ? escapeHtml(job!.role) : ''}"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <!-- Link -->
        <div>
          <label for="link" class="block text-sm font-medium text-gray-700 mb-2">
            Job Link
          </label>
          <input
            type="url"
            id="link"
            name="link"
            value="${isEdit && job!.link ? escapeHtml(job!.link) : ''}"
            placeholder="https://example.com/job"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <!-- Salary Range -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label for="salary_min" class="block text-sm font-medium text-gray-700 mb-2">
              Salary Min
            </label>
            <input
              type="number"
              id="salary_min"
              name="salary_min"
              value="${isEdit && job!.salary_min ? job!.salary_min : ''}"
              placeholder="50000"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
          <div>
            <label for="salary_max" class="block text-sm font-medium text-gray-700 mb-2">
              Salary Max
            </label>
            <input
              type="number"
              id="salary_max"
              name="salary_max"
              value="${isEdit && job!.salary_max ? job!.salary_max : ''}"
              placeholder="150000"
              class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
          </div>
        </div>

        <!-- Application Type -->
        <div>
          <label for="application_type" class="block text-sm font-medium text-gray-700 mb-2">
            Application Type
            <span class="text-red-500">*</span>
          </label>
          <select
            id="application_type"
            name="application_type"
            required
            class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          >
            <option value="">Select type</option>
            <option value="cold" ${isEdit && job!.application_type === 'cold' ? 'selected' : ''}>
              Cold (Blind Application)
            </option>
            <option value="warm" ${isEdit && job!.application_type === 'warm' ? 'selected' : ''}>
              Warm (Referral)
            </option>
          </select>
        </div>

        <!-- Job Description -->
        <div>
          <label for="job_description" class="block text-sm font-medium text-gray-700 mb-2">
            Job Description
          </label>
          <textarea
            id="job_description"
            name="job_description"
            rows="4"
            placeholder="Paste or summarize the job description..."
            class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          >${isEdit && job!.job_description ? escapeHtml(job!.job_description) : ''}</textarea>
        </div>

        <!-- Location -->
        <div>
          <label for="location" class="block text-sm font-medium text-gray-700 mb-2">
            Location
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value="${isEdit && job!.location ? escapeHtml(job!.location) : ''}"
            placeholder="San Francisco, CA"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <!-- Follow-up Date -->
        <div>
          <label for="follow_up_date" class="block text-sm font-medium text-gray-700 mb-2">
            Follow-up Date
          </label>
          <input
            type="date"
            id="follow_up_date"
            name="follow_up_date"
            value="${followUpDateValue}"
            class="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 text-sm"
          />
        </div>

        <!-- Submit Button -->
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            type="submit"
            class="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm"
          >
            ${submitLabel}
          </button>
          <a
            href="/jobs"
            hx-boost="true"
            class="w-full sm:w-auto px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium text-sm text-center"
          >
            Cancel
          </a>
        </div>
      </form>
    </div>
  `;
}
