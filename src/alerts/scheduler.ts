import cron from 'node-cron';
import type Database from 'better-sqlite3';
import { getAlertSettings, getActiveJobsForAlerts, updateJobAlertSentAt } from '../db/queries';
import { evaluateRule } from '../rill/bridge';
import { createMailTransport, sendDigestEmail } from './mailer';
import { formatDigestHtml, formatDigestPlainText } from './digest';
import type { AlertItem } from './digest';

interface RuleEvalResult {
  follow_up_due: boolean;
  no_response: boolean;
  is_active: boolean;
}

/**
 * Start the hourly alert scheduler
 * Returns the cron task reference for testing/cleanup
 */
export function startAlertScheduler(db: Database.Database) {
  // Run hourly at minute 0 of every hour
  const task = cron.schedule('0 * * * *', async () => {
    try {
      await runAlertScheduler(db);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Alert scheduler error:', errorMessage);
    }
  });

  console.log('Alert scheduler started (hourly at minute 0)');
  return task;
}

/**
 * Internal function that runs the alert evaluation logic
 * Exported for testing purposes
 */
export async function runAlertScheduler(db: Database.Database): Promise<void> {
  // Read alert settings
  const settings = getAlertSettings(db);

  // Check if alerts are enabled
  if (settings.alerts_enabled !== 'true') {
    return;
  }

  // Check if Gmail credentials are configured
  if (!settings.gmail_user || !settings.gmail_app_password) {
    console.warn('Alert scheduler: Gmail credentials not configured, skipping');
    return;
  }

  // Get active jobs for alert evaluation
  const activeJobs = getActiveJobsForAlerts(db);

  // Collect alerts
  const alerts: AlertItem[] = [];
  const alertedJobIds: number[] = [];

  for (const job of activeJobs) {
    // Check 24-hour dedup
    if (job.last_alert_sent_at) {
      const lastAlertTime = new Date(job.last_alert_sent_at);
      const now = new Date();
      const hoursSinceAlert = (now.getTime() - lastAlertTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceAlert < 24) {
        continue;
      }
    }

    // Evaluate rule for this job
    const ruleResult = evaluateRule('rules/alerts.lv', {
      job: {
        current_stage: job.stage_name,
        days_since_update: job.days_since_update,
        follow_up_date_passed: job.follow_up_date_passed,
        company_name: job.company_name,
      },
      alert_threshold: settings.alert_threshold_days,
    });

    if (!ruleResult.success || !ruleResult.value) {
      continue;
    }

    const ruleValue = ruleResult.value as RuleEvalResult;

    // Check if any alert condition triggered
    if (ruleValue.follow_up_due) {
      alerts.push({
        jobId: job.id,
        companyName: job.company_name,
        role: job.role,
        type: 'follow_up',
        message: 'Follow-up date has passed',
      });
      alertedJobIds.push(job.id);
    }

    if (ruleValue.no_response) {
      alerts.push({
        jobId: job.id,
        companyName: job.company_name,
        role: job.role,
        type: 'no_response',
        message: `No response for ${settings.alert_threshold_days} days`,
      });
      if (!alertedJobIds.includes(job.id)) {
        alertedJobIds.push(job.id);
      }
    }
  }

  // If no alerts, skip sending
  if (alerts.length === 0) {
    return;
  }

  // Format and send digest email
  const htmlBody = formatDigestHtml(alerts);
  _formatDigestPlainText(alerts); // Ensure we validate formatting

  // Create transport and send
  const transport = createMailTransport(settings.gmail_user, settings.gmail_app_password);
  const result = await sendDigestEmail(
    transport,
    settings.alert_recipient_email,
    settings.gmail_user,
    alerts,
    htmlBody
  );

  if (!result.success) {
    console.error('Failed to send digest email:', result.error);
    transport.close();
    return;
  }

  // Update last_alert_sent_at for all jobs that triggered alerts
  for (const jobId of alertedJobIds) {
    updateJobAlertSentAt(db, jobId);
  }

  transport.close();
}

// Helper to validate digest formatting (for testing)
function _formatDigestPlainText(alerts: AlertItem[]): string {
  return formatDigestPlainText(alerts);
}

// Re-export digest formatting functions for testing
export { formatDigestHtml, formatDigestPlainText } from './digest';
