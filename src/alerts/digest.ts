export interface AlertItem {
  jobId: number;
  companyName: string;
  role: string;
  type: 'follow_up' | 'no_response';
  message: string;
}

/**
 * Format alerts as HTML for email digest
 */
export function formatDigestHtml(alerts: AlertItem[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Group alerts by type
  const followUpAlerts = alerts.filter((a) => a.type === 'follow_up');
  const noResponseAlerts = alerts.filter((a) => a.type === 'no_response');

  let alertsHtml = '';

  if (followUpAlerts.length > 0) {
    alertsHtml += '<h3 style="color: #1976d2; margin-top: 20px; border-bottom: 2px solid #1976d2; padding-bottom: 10px;">Follow-Up Due</h3>';
    followUpAlerts.forEach((alert) => {
      alertsHtml += `
        <div style="background: #e3f2fd; border-left: 4px solid #1976d2; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
          <p style="margin: 0 0 10px 0; font-weight: bold;">${escapeHtml(alert.companyName)} - ${escapeHtml(alert.role)}</p>
          <p style="margin: 0; color: #555;">${escapeHtml(alert.message)}</p>
        </div>
      `;
    });
  }

  if (noResponseAlerts.length > 0) {
    alertsHtml += '<h3 style="color: #f57c00; margin-top: 20px; border-bottom: 2px solid #f57c00; padding-bottom: 10px;">No Response</h3>';
    noResponseAlerts.forEach((alert) => {
      alertsHtml += `
        <div style="background: #fff3e0; border-left: 4px solid #f57c00; padding: 15px; margin-bottom: 15px; border-radius: 4px;">
          <p style="margin: 0 0 10px 0; font-weight: bold;">${escapeHtml(alert.companyName)} - ${escapeHtml(alert.role)}</p>
          <p style="margin: 0; color: #555;">${escapeHtml(alert.message)}</p>
        </div>
      `;
    });
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Job Tracker Alert Digest</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #333; line-height: 1.6;">
      <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
        <h1 style="color: #1a73e8; margin-bottom: 10px;">Job Tracker Alert Digest</h1>
        <p style="color: #999; margin-bottom: 30px;">Generated on ${dateStr}</p>

        ${alertsHtml}

        <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
        <p style="color: #999; font-size: 14px; text-align: center;">
          <a href="http://localhost:3000" style="color: #1a73e8; text-decoration: none;">Open Job Tracker</a>
        </p>
      </div>
    </body>
    </html>
  `;
}

/**
 * Format alerts as plain text for email fallback
 */
export function formatDigestPlainText(alerts: AlertItem[]): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let text = `JOB TRACKER ALERT DIGEST\nGenerated on ${dateStr}\n\n`;

  // Group alerts by type
  const followUpAlerts = alerts.filter((a) => a.type === 'follow_up');
  const noResponseAlerts = alerts.filter((a) => a.type === 'no_response');

  if (followUpAlerts.length > 0) {
    text += 'FOLLOW-UP DUE\n';
    text += '=============\n';
    followUpAlerts.forEach((alert) => {
      text += `${alert.companyName} - ${alert.role}\n`;
      text += `${alert.message}\n\n`;
    });
  }

  if (noResponseAlerts.length > 0) {
    text += 'NO RESPONSE\n';
    text += '===========\n';
    noResponseAlerts.forEach((alert) => {
      text += `${alert.companyName} - ${alert.role}\n`;
      text += `${alert.message}\n\n`;
    });
  }

  text += '---\n';
  text += 'Open Job Tracker: http://localhost:3000\n';

  return text;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (c) => map[c]);
}
