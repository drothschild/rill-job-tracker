import type { Request, Response, NextFunction } from 'express';
import { getDb } from '../db/connection';

declare module 'express-session' {
  interface SessionData {
    authenticated: boolean;
    loginError?: string;
    setupError?: string;
  }
}

export function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Allow requests to /auth paths without authentication checking
  // (the routes themselves will handle redirects)
  if (req.path.startsWith('/auth/')) {
    next();
    return;
  }

  // Check if user is authenticated
  if (req.session.authenticated) {
    next();
    return;
  }

  // Check if password has been set
  const db = getDb();
  const passwordHash = db
    .prepare("SELECT value FROM settings WHERE key = 'password_hash'")
    .get() as { value: string } | undefined;

  if (!passwordHash) {
    // No password set yet - redirect to setup
    res.redirect('/auth/setup');
    return;
  }

  // Password exists but user not authenticated - redirect to login
  res.redirect('/auth/login');
}
