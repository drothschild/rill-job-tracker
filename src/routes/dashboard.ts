import type { Request, Response } from 'express';
import { Router } from 'express';
import path from 'path';
import { getDb } from '../db/connection';
import {
  getJobsForDashboard,
  getApplicationsOverTime,
  getJobsWithOverdueFollowUp,
  getStaleJobs,
  getJobsByStage,
} from '../db/queries';
import { evaluateRule } from '../rill/bridge';
import { layout } from '../views/layout';
import { dashboardView, type DashboardMetrics } from '../views/dashboard';

const router = Router();

/**
 * GET /
 * Render the dashboard with metrics, charts, and actionable items
 */
router.get('/', (req: Request, res: Response) => {
  const db = getDb();

  try {
    // Query all jobs for dashboard
    const jobs = getJobsForDashboard(db);

    // Prepare data for Rill evaluation
    // The dashboard.lv rule expects a list of jobs with current_stage and application_type
    const jobsForRill = jobs.map(job => ({
      current_stage: job.stage_name,
      application_type: job.application_type,
    }));

    // Evaluate dashboard.lv rule to compute metrics
    const rulePath = path.join(process.cwd(), 'rules/dashboard.lv');
    const metricsResult = evaluateRule(rulePath, { jobs: jobsForRill });

    if (!metricsResult.success) {
      return res.status(500).send('Failed to compute dashboard metrics');
    }

    // Extract metrics from Rill result
    const rillMetrics = metricsResult.value as {
      total: number;
      responded: number;
      interviewed: number;
      warm_count: number;
      cold_count: number;
    };

    // Compute percentage rates in TypeScript (avoid division by zero)
    const response_rate =
      rillMetrics.total > 0
        ? Math.round((rillMetrics.responded / rillMetrics.total) * 100)
        : 0;
    const interview_rate =
      rillMetrics.total > 0
        ? Math.round((rillMetrics.interviewed / rillMetrics.total) * 100)
        : 0;

    const metrics: DashboardMetrics = {
      total: rillMetrics.total,
      responded: rillMetrics.responded,
      interviewed: rillMetrics.interviewed,
      response_rate,
      interview_rate,
      warm_count: rillMetrics.warm_count,
      cold_count: rillMetrics.cold_count,
    };

    // Query timeline data for line chart
    const timelineData = getApplicationsOverTime(db);

    // Query stage data for funnel chart
    const jobsByStage = getJobsByStage(db);

    // Query actionable items
    const overdueFollowUps = getJobsWithOverdueFollowUp(db);

    // Get stale jobs threshold from settings (default 7 days)
    const settingsStmt = db.prepare("SELECT value FROM settings WHERE key = 'stale_job_threshold'");
    const settingsRow = settingsStmt.get() as { value: string } | undefined;
    const staleThreshold = settingsRow ? parseInt(settingsRow.value, 10) : 7;

    const staleJobs = getStaleJobs(db, staleThreshold);

    // Render dashboard view
    const bodyHtml = dashboardView(metrics, timelineData, jobsByStage, overdueFollowUps, staleJobs);

    // Wrap in layout
    const html = layout('Dashboard', bodyHtml, req);

    res.send(html);
  } catch (error) {
    console.error('Error rendering dashboard:', error);
    res.status(500).send('Failed to render dashboard');
  }
});

export default router;
