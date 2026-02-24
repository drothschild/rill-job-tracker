import type { Job } from '../../db/queries';
import { escapeHtml, formatDate, formatSalary } from '../helpers';

/**
 * Renders a list/grid of job cards showing company name, role, stage, application type,
 * salary range, and location. Each card links to the job detail view.
 *
 * @param jobs Array of Job objects
 * @returns HTML grid of job cards
 */
export function jobListView(jobs: Job[]): string {
  // Color mapping for stage badges
  const stageColors: { [key: string]: string } = {
    'Applied': 'bg-blue-100 text-blue-800',
    'Interview': 'bg-yellow-100 text-yellow-800',
    'Offer': 'bg-green-100 text-green-800',
    'Rejected': 'bg-red-100 text-red-800',
    'Accepted': 'bg-green-200 text-green-900',
    'Withdrawn': 'bg-gray-100 text-gray-800',
  };

  // Color mapping for application type badges
  const typeColors: { [key: string]: string } = {
    'warm': 'bg-purple-100 text-purple-800',
    'cold': 'bg-slate-100 text-slate-800',
  };

  const getStageColor = (stageName?: string): string => {
    return stageName && stageColors[stageName] ? stageColors[stageName] : 'bg-gray-100 text-gray-800';
  };

  const getTypeColor = (type: string): string => {
    return typeColors[type] || 'bg-gray-100 text-gray-800';
  };

  const getTypeLabel = (type: string): string => {
    return type === 'warm' ? 'Referral' : 'Cold Apply';
  };

  if (jobs.length === 0) {
    return `
      <div class="text-center py-12">
        <p class="text-gray-500 text-lg mb-6">No jobs yet. Get started by adding your first job.</p>
        <a
          href="/jobs/new"
          hx-boost="true"
          class="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          New Job
        </a>
      </div>
    `;
  }

  const jobCards = jobs
    .map(
      (job) => `
    <div class="bg-white rounded-lg shadow hover:shadow-md transition-shadow border border-gray-200">
      <div class="p-4 sm:p-6">
        <!-- Header with company and role -->
        <div class="mb-4">
          <a
            href="/jobs/${job.id}"
            hx-boost="true"
            class="text-lg sm:text-xl font-bold text-gray-900 hover:text-blue-600 block break-words"
          >
            ${escapeHtml(job.company_name)}
          </a>
          <p class="text-sm text-gray-600 break-words">${escapeHtml(job.role)}</p>
        </div>

        <!-- Badges -->
        <div class="flex gap-2 mb-4 flex-wrap">
          <span class="inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getStageColor(job.stage_name)}">
            ${job.stage_name ? escapeHtml(job.stage_name) : 'No Stage'}
          </span>
          <span class="inline-block px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${getTypeColor(job.application_type)}">
            ${getTypeLabel(job.application_type)}
          </span>
        </div>

        <!-- Details -->
        <div class="space-y-2 text-xs sm:text-sm text-gray-600 mb-4">
          ${job.location ? `<p><strong>Location:</strong> <span class="break-words">${escapeHtml(job.location)}</span></p>` : ''}
          <p><strong>Salary:</strong> ${formatSalary(job.salary_min, job.salary_max)}</p>
          <p><strong>Applied:</strong> ${formatDate(job.created_at)}</p>
          ${job.follow_up_date ? `<p><strong>Follow-up:</strong> ${formatDate(job.follow_up_date)}</p>` : ''}
        </div>

        <!-- View Details Link -->
        <a
          href="/jobs/${job.id}"
          hx-boost="true"
          class="inline-block text-blue-600 hover:text-blue-800 font-medium text-xs sm:text-sm"
        >
          View Details →
        </a>
      </div>
    </div>
  `
    )
    .join('');

  return `
    <div class="mb-6">
      <a
        href="/jobs/new"
        hx-boost="true"
        class="inline-block px-4 sm:px-6 py-2 sm:py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm sm:text-base"
      >
        New Job
      </a>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
      ${jobCards}
    </div>
  `;
}
