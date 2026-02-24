import { escapeHtml, safeJsonStringify } from '../helpers';
import type { DashboardJob, ApplicationCountByDate, JobsByStage } from '../../db/queries';

export interface DashboardMetrics {
  total: number;
  responded: number;
  interviewed: number;
  response_rate: number;
  interview_rate: number;
  warm_count: number;
  cold_count: number;
}

export interface ActionableItem {
  job: DashboardJob;
  daysOverdue?: number;
  daysSinceUpdate?: number;
}

/**
 * Calculate days between two date strings
 */
function daysBetween(fromDate: string | null | undefined, toDate: string = new Date().toISOString()): number {
  if (!fromDate) return 0;
  try {
    const from = new Date(fromDate).getTime();
    const to = new Date(toDate).getTime();
    return Math.floor((to - from) / (1000 * 60 * 60 * 24));
  } catch {
    return 0;
  }
}

/**
 * Render stats cards row (responsive: 3 columns desktop, stack mobile)
 */
function renderStatsCards(metrics: DashboardMetrics): string {
  return `
    <div class="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 mb-8">
      <!-- Total Applications Card -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div class="text-center">
          <div class="text-3xl sm:text-4xl font-bold text-blue-600 mb-2">${metrics.total}</div>
          <div class="text-gray-600 text-xs sm:text-sm">Total Applications</div>
        </div>
      </div>

      <!-- Response Rate Card -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div class="text-center">
          <div class="text-3xl sm:text-4xl font-bold text-green-600 mb-2">${metrics.response_rate}%</div>
          <div class="text-gray-600 text-xs sm:text-sm">Response Rate</div>
        </div>
      </div>

      <!-- Interview Conversion Card -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div class="text-center">
          <div class="text-3xl sm:text-4xl font-bold text-purple-600 mb-2">${metrics.interview_rate}%</div>
          <div class="text-gray-600 text-xs sm:text-sm">Interview Conversion</div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Render charts section with three Chart.js charts (responsive: 2 columns desktop, stack mobile)
 */
function renderChartsSection(
  timelineData: ApplicationCountByDate[],
  stageData: JobsByStage[],
  warmColdCounts: { warm: number; cold: number }
): string {
  // Prepare timeline data for Chart.js
  const timelineLabels = timelineData.map(d => d.date);
  const timelineValues = timelineData.map(d => d.count);

  // Prepare stage funnel data
  const stageLabels = stageData.map(s => s.stageName);
  const stageCounts = stageData.map(s => s.jobs.length);

  // Prepare warm vs cold data
  const warmColdLabels = ['Warm', 'Cold'];
  const warmColdValues = [warmColdCounts.warm, warmColdCounts.cold];

  return `
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-8">
      <!-- Applications Over Time Chart -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-4">Applications Over Time</h3>
        <div style="position: relative; height: 250px; min-height: 250px;">
          <canvas id="chart-applications-timeline"></canvas>
        </div>
      </div>

      <!-- Stage Funnel Chart -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-4">Stage Funnel</h3>
        <div style="position: relative; height: 250px; min-height: 250px;">
          <canvas id="chart-stage-funnel"></canvas>
        </div>
      </div>

      <!-- Warm vs Cold Breakdown Chart -->
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-4">Warm vs Cold Breakdown</h3>
        <div style="position: relative; height: 250px; min-height: 250px;">
          <canvas id="chart-warm-cold"></canvas>
        </div>
      </div>
    </div>

    <!-- Chart.js Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/chart.js@4"></script>
    <script>
      document.addEventListener('DOMContentLoaded', function() {
        // Timeline Chart
        const timelineCtx = document.getElementById('chart-applications-timeline');
        if (timelineCtx) {
          new Chart(timelineCtx, {
            type: 'line',
            data: {
              labels: ${safeJsonStringify(timelineLabels)},
              datasets: [{
                label: 'Applications',
                data: ${safeJsonStringify(timelineValues)},
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: '#3b82f6'
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  ticks: { stepSize: 1 }
                }
              }
            }
          });
        }

        // Stage Funnel Chart
        const stageCtx = document.getElementById('chart-stage-funnel');
        if (stageCtx) {
          const stageColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];
          new Chart(stageCtx, {
            type: 'bar',
            data: {
              labels: ${safeJsonStringify(stageLabels)},
              datasets: [{
                label: 'Jobs by Stage',
                data: ${safeJsonStringify(stageCounts)},
                backgroundColor: stageColors.slice(0, ${stageLabels.length}),
                borderColor: stageColors.slice(0, ${stageLabels.length}),
                borderWidth: 1
              }]
            },
            options: {
              indexAxis: 'y',
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: { display: false }
              },
              scales: {
                x: {
                  beginAtZero: true,
                  ticks: { stepSize: 1 }
                }
              }
            }
          });
        }

        // Warm vs Cold Chart
        const warmColdCtx = document.getElementById('chart-warm-cold');
        if (warmColdCtx) {
          new Chart(warmColdCtx, {
            type: 'doughnut',
            data: {
              labels: ${safeJsonStringify(warmColdLabels)},
              datasets: [{
                data: ${safeJsonStringify(warmColdValues)},
                backgroundColor: ['#8b5cf6', '#3b82f6'],
                borderColor: ['#6d28d9', '#1e40af'],
                borderWidth: 2
              }]
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: {
                legend: {
                  position: 'bottom'
                }
              }
            }
          });
        }
      });
    </script>
  `;
}

/**
 * Render actionable items section (overdue follow-ups and stale jobs)
 */
function renderActionableItems(
  overdueFollowUps: ActionableItem[],
  staleJobs: ActionableItem[]
): string {
  if (overdueFollowUps.length === 0 && staleJobs.length === 0) {
    return `
      <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 class="text-lg font-semibold text-gray-900 mb-4">Actionable Items</h3>
        <p class="text-gray-600 text-center py-4">No actionable items at this time. Keep up the good work!</p>
      </div>
    `;
  }

  let html = '<div class="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">';

  // Overdue Follow-ups Section
  html += `
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
      <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-4">Overdue Follow-ups</h3>
  `;

  if (overdueFollowUps.length === 0) {
    html += '<p class="text-gray-600 text-center py-4 text-sm">No overdue follow-ups</p>';
  } else {
    html += '<ul class="space-y-3">';
    overdueFollowUps.forEach(item => {
      const days = item.daysOverdue || 0;
      const daysText = days === 1 ? '1 day' : `${days} days`;
      html += `
        <li class="border-l-4 border-red-500 pl-3 py-1">
          <a href="/jobs/${item.job.id}" class="text-blue-600 hover:text-blue-800 font-medium text-sm break-words">
            ${escapeHtml(item.job.company_name)} - ${escapeHtml(item.job.role)}
          </a>
          <p class="text-xs text-gray-600 mt-1">${daysText} overdue</p>
        </li>
      `;
    });
    html += '</ul>';
  }

  html += '</div>';

  // Stale Jobs Section
  html += `
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
      <h3 class="text-base sm:text-lg font-semibold text-gray-900 mb-4">Stale Applications</h3>
  `;

  if (staleJobs.length === 0) {
    html += '<p class="text-gray-600 text-center py-4 text-sm">No stale applications</p>';
  } else {
    html += '<ul class="space-y-3">';
    staleJobs.forEach(item => {
      const days = item.daysSinceUpdate || 0;
      const daysText = days === 1 ? '1 day' : `${days} days`;
      html += `
        <li class="border-l-4 border-yellow-500 pl-3 py-1">
          <a href="/jobs/${item.job.id}" class="text-blue-600 hover:text-blue-800 font-medium text-sm break-words">
            ${escapeHtml(item.job.company_name)} - ${escapeHtml(item.job.role)}
          </a>
          <p class="text-xs text-gray-600 mt-1">${daysText} since update</p>
        </li>
      `;
    });
    html += '</ul>';
  }

  html += '</div>';
  html += '</div>';

  return html;
}

/**
 * Render the full dashboard view with stats cards, charts, and actionable items
 */
export function dashboardView(
  metrics: DashboardMetrics,
  timelineData: ApplicationCountByDate[],
  stageData: JobsByStage[],
  overdueFollowUps: DashboardJob[],
  staleJobs: DashboardJob[]
): string {
  const warmColdCounts = {
    warm: metrics.warm_count,
    cold: metrics.cold_count,
  };

  const overdueItems: ActionableItem[] = overdueFollowUps.map(job => ({
    job,
    daysOverdue: daysBetween(job.follow_up_date),
  }));

  const staleItems: ActionableItem[] = staleJobs.map(job => ({
    job,
    daysSinceUpdate: daysBetween(job.updated_at),
  }));

  return `
    <div class="space-y-8">
      ${renderStatsCards(metrics)}
      ${renderChartsSection(timelineData, stageData, warmColdCounts)}
      ${renderActionableItems(overdueItems, staleItems)}
    </div>
  `;
}
