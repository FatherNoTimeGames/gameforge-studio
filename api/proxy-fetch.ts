// Serverless URL fetcher (CORS-free) for Wiki Builder sources on Vercel / Netlify.
import { htmlToPlainText } from '../../shared/htmlText';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string' || !url.startsWith('http')) {
      res.status(400).json({ error: 'Valid HTTP/HTTPS URL required.' });
      return;
    }

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GameForgeWikiBuilder/1.0)' },
      signal: AbortSignal.timeout(15000)
    });

    if (!response.ok) {
      res
        .status(response.status)
        .json({ error: `Remote server responded with ${response.status} ${response.statusText}` });
      return;
    }

    const cleanText = htmlToPlainText(await response.text());
    res.status(200).json({ text: cleanText, length: cleanText.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to fetch remote URL.';
    res.status(500).json({ error: message });
  }
}
