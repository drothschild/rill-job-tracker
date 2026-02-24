import type { Job, Stage, JobsByStage } from '../../db/queries';
import { escapeHtml, formatDate } from '../helpers';

/**
 * Calculates the number of days a job has been in its current stage
 */
function daysInStage(job: Job): number {
  const created = new Date(job.updated_at).getTime();
  const now = new Date().getTime();
  return Math.floor((now - created) / (1000 * 60 * 60 * 24));
}

/**
 * Get badge color for application type
 */
function getApplicationTypeBadge(type: 'warm' | 'cold'): string {
  if (type === 'warm') {
    return `<span class="inline-block px-2 py-1 rounded text-xs font-medium bg-purple-100 text-purple-800">Referral</span>`;
  }
  return `<span class="inline-block px-2 py-1 rounded text-xs font-medium bg-slate-100 text-slate-800">Cold</span>`;
}

/**
 * Renders a job card (used in both desktop and mobile views)
 */
function jobCard(job: Job, allStages: Stage[]): string {
  const days = daysInStage(job);
  const daysText = days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`;

  // Create dropdown options for valid next stages (filtered based on current stage)
  const stageOptions = allStages
    .filter((s) => s.id !== job.current_stage_id) // Don't include current stage
    .map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`)
    .join('');

  return `
    <div
      class="bg-white border border-gray-200 rounded-lg p-4 mb-3 cursor-move hover:shadow-md transition-shadow"
      draggable="true"
      data-job-id="${job.id}"
      data-current-stage="${job.current_stage_id}"
      @dragstart="dragStart($event)"
      @dragend="dragEnd($event)"
    >
      <!-- Header with company and role -->
      <div class="mb-2">
        <h3 class="font-semibold text-gray-900 text-sm">${escapeHtml(job.company_name)}</h3>
        <p class="text-xs text-gray-600">${escapeHtml(job.role)}</p>
      </div>

      <!-- Metadata badges -->
      <div class="flex gap-2 mb-3 flex-wrap">
        <span class="inline-block px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">${daysText}</span>
        ${getApplicationTypeBadge(job.application_type)}
      </div>

      <!-- Desktop drag button (hidden on mobile) -->
      <div class="hidden md:block text-center text-xs text-gray-400 mb-2">
        ⋮ Drag to move
      </div>

      <!-- Mobile dropdown (hidden on desktop) -->
      <div class="md:hidden">
        <form
          @submit.prevent="submitTransition($event, ${job.id})"
          class="flex gap-2"
        >
          <select
            name="to_stage_id"
            class="flex-1 px-2 py-1 text-xs border border-gray-300 rounded"
            @change="$event.target.closest('form').submit()"
          >
            <option value="">Move to...</option>
            ${stageOptions}
          </select>
        </form>
      </div>
    </div>
  `;
}

/**
 * Renders a single column for desktop view
 */
function desktopColumn(stage: Stage, jobs: Job[], allStages: Stage[]): string {
  const jobCount = jobs.length;
  const jobsHtml = jobs.length > 0
    ? jobs.map((job) => jobCard(job, allStages)).join('')
    : '<p class="text-gray-400 text-sm text-center py-6">No jobs</p>';

  return `
    <div
      class="flex-shrink-0 w-80 bg-gray-50 rounded-lg border border-gray-200 p-4"
      data-stage-id="${stage.id}"
      @dragover="dragOver($event)"
      @drop="drop($event, ${stage.id})"
      @dragleave="dragLeave($event)"
    >
      <!-- Column header -->
      <div class="mb-4 pb-3 border-b border-gray-300">
        <h2 class="font-semibold text-gray-900">${escapeHtml(stage.name)}</h2>
        <p class="text-xs text-gray-500">${jobCount} job${jobCount !== 1 ? 's' : ''}</p>
      </div>

      <!-- Jobs list -->
      <div class="space-y-0">
        ${jobsHtml}
      </div>
    </div>
  `;
}

/**
 * Renders a collapsible section for mobile view
 */
function mobileSection(stage: Stage, jobs: Job[], allStages: Stage[]): string {
  const jobCount = jobs.length;
  const jobsHtml = jobs.length > 0
    ? jobs.map((job) => jobCard(job, allStages)).join('')
    : '<p class="text-gray-400 text-sm text-center py-4">No jobs</p>';

  return `
    <div class="mb-4 border border-gray-200 rounded-lg overflow-hidden">
      <!-- Section header (tap to expand/collapse) -->
      <button
        type="button"
        @click="toggleSection(${stage.id})"
        class="w-full bg-gray-100 hover:bg-gray-200 transition-colors px-4 py-3 flex justify-between items-center text-left"
      >
        <div>
          <h2 class="font-semibold text-gray-900">${escapeHtml(stage.name)}</h2>
          <p class="text-xs text-gray-500">${jobCount} job${jobCount !== 1 ? 's' : ''}</p>
        </div>
        <svg
          class="w-5 h-5 text-gray-600 transform transition-transform"
          :class="{'rotate-180': expandedSections[${stage.id}]}"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      </button>

      <!-- Section content (collapsible) -->
      <div
        x-show="expandedSections[${stage.id}]"
        class="bg-white p-4 border-t border-gray-200"
      >
        ${jobsHtml}
      </div>
    </div>
  `;
}

/**
 * Renders the full pipeline Kanban board with drag-and-drop (desktop) and mobile dropdown
 */
export function pipelineBoardView(stages: Stage[], jobsByStage: JobsByStage[]): string {
  // Create a map of stage ID to jobs for easier lookup
  const jobMap: { [key: number]: Job[] } = {};
  jobsByStage.forEach((group) => {
    jobMap[group.stageId] = group.jobs;
  });

  // Ensure all stages have an entry in the map
  stages.forEach((stage) => {
    if (!jobMap[stage.id]) {
      jobMap[stage.id] = [];
    }
  });

  // Desktop view - horizontal scrolling columns
  const desktopContent = `
    <div class="hidden md:flex gap-4 pb-4 overflow-x-auto">
      ${stages.map((stage) => desktopColumn(stage, jobMap[stage.id], stages)).join('')}
    </div>
  `;

  // Mobile view - vertical stacked sections
  const mobileContent = `
    <div class="md:hidden">
      ${stages.map((stage) => mobileSection(stage, jobMap[stage.id], stages)).join('')}
    </div>
  `;

  // Alpine.js component with drag-and-drop and mobile functionality
  return `
    <div
      x-data="{
        draggedJob: null,
        draggedFromStage: null,
        expandedSections: {},

        dragStart(event) {
          this.draggedJob = event.currentTarget.dataset.jobId;
          this.draggedFromStage = event.currentTarget.dataset.currentStage;
          event.currentTarget.classList.add('opacity-50');
        },

        dragEnd(event) {
          event.currentTarget.classList.remove('opacity-50');
        },

        dragOver(event) {
          event.preventDefault();
          event.currentTarget.classList.add('bg-blue-50');
        },

        dragLeave(event) {
          event.currentTarget.classList.remove('bg-blue-50');
        },

        drop(event, toStageId) {
          event.preventDefault();
          event.currentTarget.classList.remove('bg-blue-50');

          if (this.draggedJob && this.draggedFromStage != toStageId) {
            this.submitTransitionDrop(this.draggedJob, toStageId);
          }
        },

        toggleSection(stageId) {
          this.expandedSections[stageId] = !this.expandedSections[stageId];
        },

        submitTransitionDrop(jobId, toStageId) {
          // Show prompt for optional sub_label
          const subLabel = prompt('Optional: Enter a sub-label for this transition (e.g., "Technical Interview")');

          const formData = new FormData();
          formData.append('job_id', jobId);
          formData.append('to_stage_id', toStageId);
          if (subLabel) {
            formData.append('sub_label', subLabel);
          }

          // Use fetch to POST the transition
          fetch('/pipeline/transition', {
            method: 'POST',
            body: formData
          })
          .then(response => {
            if (response.ok) {
              // Reload the pipeline board
              window.location.reload();
            } else {
              alert('Transition failed. Please try again.');
            }
          })
          .catch(err => {
            console.error('Transition error:', err);
            alert('Error during transition');
          });
        },

        submitTransition(event, jobId) {
          event.preventDefault();
          const toStageId = event.currentTarget.querySelector('select').value;
          if (toStageId) {
            this.submitTransitionDrop(jobId, toStageId);
          }
        }
      }"
      class="space-y-6"
    >
      ${desktopContent}
      ${mobileContent}
    </div>
  `;
}
