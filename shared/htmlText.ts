// Shared HTML-to-text extraction used by every URL-fetch path
// (Express server route and serverless function). Keeping one copy
// guarantees identical behavior regardless of deployment target.

export function htmlToPlainText(text: string): string {
  if (!/<html|<!doctype/i.test(text.slice(0, 500))) return text;
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
}
