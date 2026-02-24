import { describe, it, expect } from 'vitest';
import { Request } from 'express';
import { layout } from '../src/views/layout';

describe('Layout - Mobile Bottom Tab Navigation', () => {
  it('should include mobile bottom tab navigation with 4 tabs', () => {
    const mockReq = { get: () => undefined, path: '/' } as unknown as Request;
    const result = layout('Dashboard', '<p>Test content</p>', mockReq);

    // Check for mobile bottom nav container
    expect(result).toContain('md:hidden'); // Hidden on desktop
    expect(result).toContain('flex'); // Visible on mobile

    // Check for all 4 tabs
    expect(result).toContain('href="/"'); // Dashboard
    expect(result).toContain('href="/jobs"'); // Jobs
    expect(result).toContain('href="/pipeline"'); // Pipeline
    expect(result).toContain('href="/settings"'); // Settings
  });

  it('should hide top navigation on mobile', () => {
    const mockReq = { get: () => undefined, path: '/' } as unknown as Request;
    const result = layout('Dashboard', '<p>Test content</p>', mockReq);

    // Check for desktop-only nav bar
    expect(result).toContain('hidden md:flex');
  });

  it('should highlight active tab based on current path', () => {
    const mockReq = { get: () => undefined, path: '/jobs' } as unknown as Request;
    const result = layout('Jobs', '<p>Test content</p>', mockReq);

    // Jobs tab should be active (highlighted)
    // Check for active styling on /jobs link
    expect(result).toMatch(/href="\/jobs"[^>]*text-blue-600/);
  });

  it('should use simple text/emoji icons for mobile nav tabs', () => {
    const mockReq = { get: () => undefined, path: '/' } as unknown as Request;
    const result = layout('Dashboard', '<p>Test content</p>', mockReq);

    // Check for text-based icons or simple SVG
    // Should contain home icon indicator (🏠 or text "Home" or similar)
    expect(result).toMatch(/Dashboard|home|Home/i);
    expect(result).toMatch(/Jobs|jobs|list|List/i);
    expect(result).toMatch(/Pipeline|pipeline|Kanban|kanban/i);
    expect(result).toMatch(/Settings|settings|gear|Gear/i);
  });

  it('should use HTMX links for tab navigation', () => {
    const mockReq = { get: () => undefined, path: '/' } as unknown as Request;
    const result = layout('Dashboard', '<p>Test content</p>', mockReq);

    // Check for HTMX attributes on links
    expect(result).toContain('hx-get');
    expect(result).toContain('hx-target');
  });

  it('should fix bottom nav when scrolling', () => {
    const mockReq = { get: () => undefined, path: '/' } as unknown as Request;
    const result = layout('Dashboard', '<p>Test content</p>', mockReq);

    // Check for fixed positioning classes
    expect(result).toContain('fixed');
    expect(result).toContain('bottom-0');
    expect(result).toContain('w-full');
  });

  it('should highlight Dashboard tab when on root path', () => {
    const mockReq = { get: () => undefined, path: '/' } as unknown as Request;
    const result = layout('Dashboard', '<p>Test content</p>', mockReq);

    // Dashboard link should be active
    expect(result).toMatch(/href="\/"[^>]*text-blue-600/);
  });

  it('should highlight Settings tab when on /settings path', () => {
    const mockReq = { get: () => undefined, path: '/settings' } as unknown as Request;
    const result = layout('Settings', '<p>Test content</p>', mockReq);

    // Settings link should be active
    expect(result).toMatch(/href="\/settings"[^>]*text-blue-600/);
  });

  it('should use responsive classes properly', () => {
    const mockReq = { get: () => undefined, path: '/' } as unknown as Request;
    const result = layout('Dashboard', '<p>Test content</p>', mockReq);

    // Should have responsive nav (visible on desktop, hidden on mobile)
    expect(result).toContain('hidden md:flex'); // Desktop nav
    expect(result).toContain('flex md:hidden'); // Mobile nav
  });

  it('should not appear in HTMX requests', () => {
    const mockReq = {
      get: (header: string) => header === 'HX-Request' ? 'true' : undefined,
      path: '/'
    } as unknown as Request;
    const result = layout('Dashboard', '<p>Test content</p>', mockReq);

    // Should return only body content for HTMX requests
    expect(result).toBe('<p>Test content</p>');
  });

  it('should include full page structure on non-HTMX requests', () => {
    const mockReq = { get: () => undefined, path: '/' } as unknown as Request;
    const result = layout('Dashboard', '<p>Test content</p>', mockReq);

    // Should include DOCTYPE and html structure
    expect(result).toContain('<!DOCTYPE html>');
    expect(result).toContain('<html');
    expect(result).toContain('<head>');
    expect(result).toContain('<body');
  });
});
