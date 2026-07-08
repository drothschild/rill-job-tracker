const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
  '&nbsp;': ' ',
};

function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#39|apos|nbsp);/g, (match) => HTML_ENTITIES[match] ?? match);
}

export function extractTextFromHtml(html: string): string {
  const withoutScriptsAndStyles = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ');

  const withNewlinesForTags = withoutScriptsAndStyles.replace(/<[^>]+>/g, '\n');
  const decoded = decodeEntities(withNewlinesForTags);

  const lines = decoded
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length > 0);

  return lines.join('\n\n');
}

export async function fetchJobDescription(url: string): Promise<string> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; RillJobTracker/1.0)' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Failed to fetch job listing: ${message}`);
  }

  if (!response.ok) {
    throw new Error(`Failed to fetch job listing: received status ${response.status}`);
  }

  const html = await response.text();
  return extractTextFromHtml(html);
}
