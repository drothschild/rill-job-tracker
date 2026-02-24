import type { Request } from 'express';

/**
 * Wraps body HTML in a full page layout with navigation, stylesheets, and scripts.
 * If the request is from HTMX (HX-Request header present), returns only the body content.
 * Otherwise, returns the full HTML page.
 *
 * @param title Page title (used in <title> and <h1>)
 * @param bodyHtml The main content HTML
 * @param req Express request object (used to check HX-Request header)
 * @returns Full page HTML or just the body HTML depending on HX-Request header
 */
/**
 * Determine if the current path matches the tab route.
 */
function isActivePath(currentPath: string, tabPath: string): boolean {
  if (tabPath === '/') {
    return currentPath === '/';
  }
  return currentPath === tabPath;
}

export function layout(title: string, bodyHtml: string, req: Request): string {
  // Check if this is an HTMX request
  const isHtmxRequest = req.get('HX-Request') === 'true';

  // If it's an HTMX request, return only the body content
  if (isHtmxRequest) {
    return bodyHtml;
  }

  const currentPath = req.path;

  // Generate nav tab links with active styling
  const navTabs = [
    { path: '/', label: 'Dashboard', icon: '🏠' },
    { path: '/jobs', label: 'Jobs', icon: '📋' },
    { path: '/pipeline', label: 'Pipeline', icon: '📊' },
    { path: '/settings', label: 'Settings', icon: '⚙️' }
  ];

  const desktopNavHtml = navTabs.map(tab => {
    const isActive = isActivePath(currentPath, tab.path);
    const textClass = isActive ? 'text-gray-900 font-semibold' : 'text-gray-600';
    return `<a href="${tab.path}" class="${textClass} hover:text-blue-600">${tab.label}</a>`;
  }).join('\n          ');

  const mobileNavHtml = navTabs.map(tab => {
    const isActive = isActivePath(currentPath, tab.path);
    const textClass = isActive ? 'text-blue-600' : 'text-gray-600';
    return `<a href="${tab.path}" hx-get="${tab.path}" hx-target="main" class="${textClass} hover:text-blue-600 flex flex-col items-center gap-1 text-xs">${tab.icon}<span>${tab.label}</span></a>`;
  }).join('\n      ');

  // Otherwise, return the full page
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - Job Tracker</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://unpkg.com/htmx.org@2.0.4"></script>
  <script src="https://cdn.jsdelivr.net/npm/alpinejs@3/dist/cdn.min.js" defer></script>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
  </style>
</head>
<body class="bg-gray-50 pb-24 md:pb-0">
  <!-- Desktop Navigation Bar -->
  <nav class="hidden md:flex bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 py-3 w-full">
      <div class="flex justify-between items-center">
        <div class="flex space-x-6">
          ${desktopNavHtml}
        </div>
        <form method="POST" action="/auth/logout" style="display: inline;">
          <button type="submit" class="text-gray-600 hover:text-gray-900">Logout</button>
        </form>
      </div>
    </div>
  </nav>

  <main class="max-w-7xl mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold text-gray-900 mb-6">${title}</h1>
    ${bodyHtml}
  </main>

  <!-- Mobile Bottom Navigation Bar -->
  <nav class="flex md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-lg">
    <div class="flex w-full justify-around items-center py-2">
      ${mobileNavHtml}
    </div>
  </nav>
</body>
</html>`;
}
