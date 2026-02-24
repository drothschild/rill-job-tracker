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
export function layout(title: string, bodyHtml: string, req: Request): string {
  // Check if this is an HTMX request
  const isHtmxRequest = req.get('HX-Request') === 'true';

  // If it's an HTMX request, return only the body content
  if (isHtmxRequest) {
    return bodyHtml;
  }

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
<body class="bg-gray-50">
  <nav class="bg-white shadow-sm border-b border-gray-200">
    <div class="max-w-7xl mx-auto px-4 py-3">
      <div class="flex justify-between items-center">
        <div class="flex space-x-6">
          <a href="/" class="text-gray-900 font-semibold hover:text-blue-600">Dashboard</a>
          <a href="/jobs" class="text-gray-600 hover:text-gray-900">Jobs</a>
          <a href="/pipeline" class="text-gray-600 hover:text-gray-900">Pipeline</a>
          <a href="/settings" class="text-gray-600 hover:text-gray-900">Settings</a>
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
</body>
</html>`;
}
