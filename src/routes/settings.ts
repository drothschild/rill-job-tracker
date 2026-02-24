import type { Request, Response } from 'express';
import { Router } from 'express';
import { getDb } from '../db/connection';
import { getAlertSettings, setSetting } from '../db/queries';
import { layout } from '../views/layout';
import { settingsView } from '../views/settings';

const router = Router();

/**
 * GET /settings
 * Render the settings page with all current settings
 */
router.get('/', (req: Request, res: Response) => {
  const db = getDb();

  try {
    const settings = getAlertSettings(db);

    const bodyHtml = settingsView({
      alert_threshold_days: settings.alert_threshold_days,
      alerts_enabled: settings.alerts_enabled,
      gmail_user: settings.gmail_user,
      gmail_app_password: settings.gmail_app_password,
      alert_recipient_email: settings.alert_recipient_email,
    });

    const isHtmxRequest = req.get('HX-Request') === 'true';
    if (isHtmxRequest) {
      return res.send(bodyHtml);
    }

    const html = layout('Settings', bodyHtml, req);
    res.send(html);
  } catch (error) {
    console.error('Error rendering settings:', error);
    res.status(500).send('Failed to render settings');
  }
});

/**
 * POST /settings/alerts
 * Update alert threshold and enable/disable alerts
 */
router.post('/alerts', (req: Request, res: Response) => {
  const db = getDb();

  try {
    const { alert_threshold_days, alerts_enabled } = req.body;

    // Validate and save alert threshold
    if (alert_threshold_days !== undefined) {
      const threshold = parseInt(String(alert_threshold_days), 10);
      if (!isNaN(threshold) && threshold > 0) {
        setSetting(db, 'alert_threshold_days', String(threshold));
      }
    }

    // Save alerts_enabled flag (will be 'true' if checkbox is submitted, undefined if not)
    // Convert checkbox value: if present it's 'true', otherwise 'false'
    const enabledValue = alerts_enabled === 'true' ? 'true' : 'false';
    setSetting(db, 'alerts_enabled', enabledValue);

    const settings = getAlertSettings(db);

    const bodyHtml = settingsView({
      alert_threshold_days: settings.alert_threshold_days,
      alerts_enabled: settings.alerts_enabled,
      gmail_user: settings.gmail_user,
      gmail_app_password: settings.gmail_app_password,
      alert_recipient_email: settings.alert_recipient_email,
      message: 'Alert settings saved successfully!',
      messageType: 'success',
    });

    const isHtmxRequest = req.get('HX-Request') === 'true';
    if (isHtmxRequest) {
      return res.send(bodyHtml);
    }

    const html = layout('Settings', bodyHtml, req);
    res.send(html);
  } catch (error) {
    console.error('Error updating alert settings:', error);
    const settings = getAlertSettings(db);

    const bodyHtml = settingsView({
      alert_threshold_days: settings.alert_threshold_days,
      alerts_enabled: settings.alerts_enabled,
      gmail_user: settings.gmail_user,
      gmail_app_password: settings.gmail_app_password,
      alert_recipient_email: settings.alert_recipient_email,
      message: 'Failed to save alert settings',
      messageType: 'error',
    });

    const isHtmxRequest = req.get('HX-Request') === 'true';
    if (isHtmxRequest) {
      return res.send(bodyHtml);
    }

    const html = layout('Settings', bodyHtml, req);
    res.status(500).send(html);
  }
});

/**
 * POST /settings/gmail
 * Update Gmail credentials and recipient email
 */
router.post('/gmail', (req: Request, res: Response) => {
  const db = getDb();

  try {
    const { gmail_user, gmail_app_password, alert_recipient_email } = req.body;

    // Save Gmail credentials
    if (gmail_user !== undefined) {
      setSetting(db, 'gmail_user', String(gmail_user));
    }
    if (gmail_app_password !== undefined) {
      setSetting(db, 'gmail_app_password', String(gmail_app_password));
    }
    if (alert_recipient_email !== undefined) {
      setSetting(db, 'alert_recipient_email', String(alert_recipient_email));
    }

    const settings = getAlertSettings(db);

    const bodyHtml = settingsView({
      alert_threshold_days: settings.alert_threshold_days,
      alerts_enabled: settings.alerts_enabled,
      gmail_user: settings.gmail_user,
      gmail_app_password: settings.gmail_app_password,
      alert_recipient_email: settings.alert_recipient_email,
      message: 'Gmail settings saved successfully!',
      messageType: 'success',
    });

    const isHtmxRequest = req.get('HX-Request') === 'true';
    if (isHtmxRequest) {
      return res.send(bodyHtml);
    }

    const html = layout('Settings', bodyHtml, req);
    res.send(html);
  } catch (error) {
    console.error('Error updating Gmail settings:', error);
    const settings = getAlertSettings(db);

    const bodyHtml = settingsView({
      alert_threshold_days: settings.alert_threshold_days,
      alerts_enabled: settings.alerts_enabled,
      gmail_user: settings.gmail_user,
      gmail_app_password: settings.gmail_app_password,
      alert_recipient_email: settings.alert_recipient_email,
      message: 'Failed to save Gmail settings',
      messageType: 'error',
    });

    const isHtmxRequest = req.get('HX-Request') === 'true';
    if (isHtmxRequest) {
      return res.send(bodyHtml);
    }

    const html = layout('Settings', bodyHtml, req);
    res.status(500).send(html);
  }
});

export default router;
