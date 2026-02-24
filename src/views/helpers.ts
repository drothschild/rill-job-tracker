/**
 * HTML view helper functions for escaping, formatting, and rendering
 */

/**
 * Escape HTML special characters to prevent XSS
 * @param text The text to escape
 * @returns Escaped HTML string
 */
export function escapeHtml(text: string): string {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Format an ISO date string to a human-readable format
 * @param dateStr ISO date string (e.g., "2026-02-24T10:30:00")
 * @returns Formatted date string (e.g., "Feb 24, 2026")
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) {
    return 'N/A';
  }

  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
      return 'N/A';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'N/A';
  }
}

/**
 * Safely stringify JSON for use in script contexts
 * Escapes '<' to prevent </script> tag injection
 * @param data The data to stringify
 * @returns JSON string with '<' escaped
 */
export function safeJsonStringify(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

/**
 * Format salary range
 * @param min Minimum salary
 * @param max Maximum salary
 * @returns Formatted salary string (e.g., "$100,000 - $150,000" or "Not specified")
 */
export function formatSalary(
  min: number | null | undefined,
  max: number | null | undefined
): string {
  if (!min && !max) {
    return 'Not specified';
  }

  const formatNumber = (num: number): string => {
    return num.toLocaleString('en-US');
  };

  if (min && max) {
    return `$${formatNumber(min)} - $${formatNumber(max)}`;
  }

  if (min) {
    return `$${formatNumber(min)}+`;
  }

  if (max) {
    return `Up to $${formatNumber(max)}`;
  }

  return 'Not specified';
}
