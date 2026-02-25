import type { Job, Stage, JobsByStage } from '../../db/queries';
import { escapeHtml } from '../helpers';

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
      class="bg-white border border-gray-200 rounded-lg p-3 sm:p-4 mb-3 cursor-move hover:shadow-md transition-shadow"
      draggable="true"
      data-job-id="${job.id}"
      data-current-stage="${job.current_stage_id}"
      @dragstart="dragStart($event)"
      @dragend="dragEnd($event)"
    >
      <!-- Header with company and role -->
      <div class="mb-2">
        <h3 class="font-semibold text-gray-900 text-xs sm:text-sm break-words">${escapeHtml(job.company_name)}</h3>
        <p class="text-xs text-gray-600 break-words">${escapeHtml(job.role)}</p>
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
      class="flex-shrink-0 w-72 sm:w-80 bg-gray-50 rounded-lg border border-gray-200 p-3 sm:p-4"
      data-stage-id="${stage.id}"
      @dragover="dragOver($event)"
      @drop="drop($event, ${stage.id})"
      @dragleave="dragLeave($event)"
    >
      <!-- Column header -->
      <div class="mb-4 pb-3 border-b border-gray-300">
        <h2 class="font-semibold text-gray-900 text-sm">${escapeHtml(stage.name)}</h2>
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
        class="w-full bg-gray-100 hover:bg-gray-200 transition-colors px-3 sm:px-4 py-3 flex justify-between items-center text-left"
      >
        <div class="min-w-0">
          <h2 class="font-semibold text-gray-900 text-sm">${escapeHtml(stage.name)}</h2>
          <p class="text-xs text-gray-500">${jobCount} job${jobCount !== 1 ? 's' : ''}</p>
        </div>
        <svg
          class="w-5 h-5 text-gray-600 transform transition-transform flex-shrink-0 ml-2"
          :class="{'rotate-180': expandedSections[${stage.id}]}"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
        </svg>
      </button>

      <!-- Section content (collapsible) -->
      <div
        x-show="expandedSections[${stage.id}]"
        class="bg-white p-3 sm:p-4 border-t border-gray-200"
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
    <div class="hidden md:flex gap-3 sm:gap-4 pb-4 overflow-x-auto">
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
  // NOTE: The Alpine.js logic is in a <script> block using Alpine.data() rather than
  // inline in x-data, because inline JS with > characters breaks HTML attribute parsing.
  // NOTE: The component registration must handle two scenarios:
  //   1. Full page load: Alpine not yet initialized, use alpine:init event
  //   2. HTMX swap (mobile nav): Alpine already initialized, register directly + call initTree
  return `
    <script>
      (function() {
        function registerPipelineBoard() {
          Alpine.data('pipelineBoard', () => ({
            draggedJob: null,
            draggedFromStage: null,
            expandedSections: {},

            dragStart(event) {
              this.draggedJob = event.currentTarget.dataset.jobId;
              this.draggedFromStage = event.currentTarget.dataset.currentStage;
              event.dataTransfer.setData('text/plain', this.draggedJob);
              event.dataTransfer.effectAllowed = 'move';
              event.currentTarget.classList.add('opacity-50');
            },

            dragEnd(event) {
              event.currentTarget.classList.remove('opacity-50');
            },

            dragOver(event) {
              event.preventDefault();
              event.dataTransfer.dropEffect = 'move';
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
              const params = new URLSearchParams();
              params.append('job_id', jobId);
              params.append('to_stage_id', toStageId);

              fetch('/pipeline/transition', {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: params.toString()
              })
              .then(function(response) {
                if (response.ok) {
                  window.location.reload();
                } else {
                  alert('Transition failed. Please try again.');
                }
              })
              .catch(function(err) {
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
          }));
        }

        if (typeof Alpine !== 'undefined') {
          // HTMX swap: Alpine already initialized — register and init the new element
          registerPipelineBoard();
          document.addEventListener('htmx:afterSettle', function() {
            const el = document.querySelector('[x-data="pipelineBoard"]');
            if (el) Alpine.initTree(el);
          }, { once: true });
        } else {
          // Full page load: wait for Alpine to initialize
          document.addEventListener('alpine:init', registerPipelineBoard);
        }
      })();
    </script>
    <div
      x-data="pipelineBoard"
      class="space-y-6"
    >
      ${desktopContent}
      ${mobileContent}
    </div>
  `;
}
