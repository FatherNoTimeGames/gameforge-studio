import { generateResponse } from '../../shared/openai.ts';
import { guardApi, sendApiError } from '../../shared/apiGuard.ts';

let active = 0;
export default async function handler(req: any, res: any) {
  if (!guardApi(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed.' });
  if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Set OPENAI_API_KEY in hosting secrets. API billing is separate from ChatGPT.' });
  if (active >= 3) return res.status(429).json({ error: 'Wait for the current AI requests to finish.' });
  active++;
  try {
    const result = await generateResponse(req.body, process.env.OPENAI_API_KEY, AbortSignal.timeout(240_000));
    res.status(200).json(result);
  } catch (error) { sendApiError(error, res); }
  finally { active--; }
}
