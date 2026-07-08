import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { extractTextFromHtml, fetchJobDescription } from '../src/utils/fetchJobDescription';

describe('extractTextFromHtml', () => {
  it('strips tags and returns visible text', () => {
    const html = '<html><body><h1>Software Engineer</h1><p>Build great things.</p></body></html>';
    expect(extractTextFromHtml(html)).toBe('Software Engineer\n\nBuild great things.');
  });

  it('strips script and style content entirely', () => {
    const html = `
      <html>
        <head><style>.a { color: red; }</style></head>
        <body>
          <script>console.log('should not appear');</script>
          <p>Visible text</p>
        </body>
      </html>
    `;
    const text = extractTextFromHtml(html);
    expect(text).toContain('Visible text');
    expect(text).not.toContain('console.log');
    expect(text).not.toContain('color: red');
  });

  it('decodes common HTML entities and collapses whitespace', () => {
    const html = '<p>Salary:   $100k &amp; up</p>\n\n\n<p>Great   team</p>';
    expect(extractTextFromHtml(html)).toBe('Salary: $100k & up\n\nGreat team');
  });
});

describe('fetchJobDescription', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('fetches the URL and returns extracted text on success', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => '<html><body><p>Job description here</p></body></html>',
    });

    const result = await fetchJobDescription('https://example.com/job/123');

    expect(result).toBe('Job description here');
    expect(global.fetch).toHaveBeenCalledWith(
      'https://example.com/job/123',
      expect.objectContaining({ headers: expect.any(Object) })
    );
  });

  it('throws a descriptive error when the response is not ok', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => '',
    });

    await expect(fetchJobDescription('https://example.com/missing')).rejects.toThrow(/404/);
  });

  it('throws a descriptive error when the fetch itself fails', async () => {
    (global.fetch as any).mockRejectedValue(new Error('network down'));

    await expect(fetchJobDescription('https://example.com/job/123')).rejects.toThrow(/network down/);
  });
});
