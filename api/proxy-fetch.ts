import { ApiError } from '../shared/openai.ts';
import { guardApi, sendApiError } from '../shared/apiGuard.ts';
import { htmlToPlainText } from '../shared/htmlText.ts';
import { fetchPublicText } from '../server/safeFetch.ts';

export default async function handler(req: any, res: any) {
  if (!guardApi(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  try {
    if (typeof req.body?.url !== 'string') throw new ApiError(400, 'Provide a source URL.');
    const text = htmlToPlainText(await fetchPublicText(req.body.url, AbortSignal.timeout(15_000)));
    res.status(200).json({ text, length: text.length });
  } catch (error) { sendApiError(error, res); }
}
