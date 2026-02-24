import type { Request, Response } from 'express';
import { Router } from 'express';
import bcrypt from 'bcrypt';
import { getDb } from '../db/connection';

const router = Router();

// GET /auth/login - Render login page
router.get('/login', (_req: Request, res: Response): void => {
  // Check if password hash exists
  const db = getDb();
  const passwordHash = db
    .prepare("SELECT value FROM settings WHERE key = 'password_hash'")
    .get() as { value: string } | undefined;

  if (!passwordHash) {
    // No password set yet - redirect to setup
    res.redirect('/auth/setup');
    return;
  }

  // Render login page
  const errorMessage = _req.session.loginError || '';
  delete _req.session.loginError;
  _req.session.save(() => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Login</title>
        <style>
          body { font-family: sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 400px; margin: 100px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { text-align: center; color: #333; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
          input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
          button { width: 100%; padding: 10px; background: #007bff; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
          button:hover { background: #0056b3; }
          .error { color: #d32f2f; margin-bottom: 15px; padding: 10px; background: #ffebee; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Login</h1>
          ${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ''}
          <form method="POST" action="/auth/login">
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required>
            </div>
            <button type="submit">Login</button>
          </form>
        </div>
      </body>
      </html>
    `);
  });
});

// GET /auth/setup - Render first-run setup page
router.get('/setup', (_req: Request, res: Response): void => {
  const db = getDb();
  const passwordHash = db
    .prepare("SELECT value FROM settings WHERE key = 'password_hash'")
    .get() as { value: string } | undefined;

  if (passwordHash) {
    // Password already set - redirect to login
    res.redirect('/auth/login');
    return;
  }

  // Render setup page
  const errorMessage = _req.session.setupError || '';
  delete _req.session.setupError;
  _req.session.save(() => {
    res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Initial Setup</title>
        <style>
          body { font-family: sans-serif; margin: 0; padding: 0; background: #f5f5f5; }
          .container { max-width: 400px; margin: 100px auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          h1 { text-align: center; color: #333; }
          .form-group { margin-bottom: 15px; }
          label { display: block; margin-bottom: 5px; font-weight: bold; color: #555; }
          input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
          button { width: 100%; padding: 10px; background: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 16px; }
          button:hover { background: #218838; }
          .error { color: #d32f2f; margin-bottom: 15px; padding: 10px; background: #ffebee; border-radius: 4px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Initial Setup</h1>
          <p>Set your password to secure the job tracker.</p>
          ${errorMessage ? `<div class="error">${escapeHtml(errorMessage)}</div>` : ''}
          <form method="POST" action="/auth/setup">
            <div class="form-group">
              <label for="password">Password</label>
              <input type="password" id="password" name="password" required>
            </div>
            <div class="form-group">
              <label for="confirm_password">Confirm Password</label>
              <input type="password" id="confirm_password" name="confirm_password" required>
            </div>
            <button type="submit">Set Password</button>
          </form>
        </div>
      </body>
      </html>
    `);
  });
});

// POST /auth/setup - Create initial password
router.post('/setup', async (req: Request, res: Response): Promise<void> => {
  const { password, confirm_password } = req.body;

  // Validate inputs
  if (!password || !confirm_password) {
    req.session.setupError = 'Password and confirmation are required';
    req.session.save(() => {
      res.redirect('/auth/setup');
    });
    return;
  }

  if (password !== confirm_password) {
    req.session.setupError = 'Passwords do not match';
    req.session.save(() => {
      res.redirect('/auth/setup');
    });
    return;
  }

  try {
    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Store in settings table
    const db = getDb();
    db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(
      'password_hash',
      passwordHash
    );

    // Mark session as authenticated
    req.session.authenticated = true;
    req.session.save(() => {
      res.redirect('/');
    });
  } catch (error) {
    req.session.setupError = 'An error occurred while setting password';
    req.session.save(() => {
      res.redirect('/auth/setup');
    });
  }
});

// POST /auth/login - Authenticate user
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { password } = req.body;

  if (!password) {
    req.session.loginError = 'Password is required';
    req.session.save(() => {
      res.redirect('/auth/login');
    });
    return;
  }

  try {
    const db = getDb();
    const result = db
      .prepare("SELECT value FROM settings WHERE key = 'password_hash'")
      .get() as { value: string } | undefined;

    if (!result) {
      req.session.loginError = 'Invalid password';
      req.session.save(() => {
        res.redirect('/auth/login');
      });
      return;
    }

    // Compare password with hash
    const isMatch = await bcrypt.compare(password, result.value);

    if (!isMatch) {
      req.session.loginError = 'Invalid password';
      req.session.save(() => {
        res.redirect('/auth/login');
      });
      return;
    }

    // Set authenticated session
    req.session.authenticated = true;
    req.session.save(() => {
      res.redirect('/');
    });
  } catch (error) {
    req.session.loginError = 'An error occurred during login';
    req.session.save(() => {
      res.redirect('/auth/login');
    });
  }
});

// POST /auth/logout - Destroy session
router.post('/logout', (req: Request, res: Response): void => {
  req.session.destroy((err) => {
    if (err) {
      res.status(500).json({ error: 'Failed to logout' });
      return;
    }
    res.redirect('/auth/login');
  });
});

// POST /auth/change-password - Change password (requires authentication)
router.post('/change-password', async (req: Request, res: Response): Promise<void> => {
  if (!req.session.authenticated) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }

  const { current_password, new_password, confirm_password } = req.body;

  // Validate inputs
  if (!current_password || !new_password || !confirm_password) {
    res.status(400).json({ error: 'All fields are required' });
    return;
  }

  if (new_password !== confirm_password) {
    res.status(400).json({ error: 'New passwords do not match' });
    return;
  }

  try {
    const db = getDb();
    const result = db
      .prepare("SELECT value FROM settings WHERE key = 'password_hash'")
      .get() as { value: string } | undefined;

    if (!result) {
      res.status(500).json({ error: 'Password not found in settings' });
      return;
    }

    // Verify current password
    const isMatch = await bcrypt.compare(current_password, result.value);

    if (!isMatch) {
      res.status(401).json({ error: 'Current password is incorrect' });
      return;
    }

    // Hash new password
    const newPasswordHash = await bcrypt.hash(new_password, 10);

    // Update in settings table
    db.prepare('UPDATE settings SET value = ? WHERE key = ?').run(
      newPasswordHash,
      'password_hash'
    );

    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ error: 'An error occurred while changing password' });
  }
});

// Helper function to escape HTML
function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

export default router;
