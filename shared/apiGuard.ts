import { createHash, timingSafeEqual } from 'node:crypto';
import { ApiError } from './openai.ts';

// Equivalent owner protection for the retained serverless deployment adapters.
export function guardApi(req: any, res: any): boolean {
  res.setHeader('Cache-Control', 'no-store');
  const password = process.env.APP_PASSWORD;
  if (process.env.OPENAI_API_KEY && (!password || password.length < 16)) {
    res.status(503).json({ error: 'Set APP_PASSWORD to at least 16 characters before exposing a server OpenAI key.' });
    return false;
  }
  if (password) {
    const header = String(req.headers?.authorization || '');
    const decoded = header.startsWith('Basic ') ? Buffer.from(header.slice(6), 'base64').toString('utf8') : '';
    const expected = createHash('sha256').update(`${process.env.APP_USERNAME || 'owner'}:${password}`).digest();
    if (!timingSafeEqual(createHash('sha256').update(decoded).digest(), expected)) {
      res.setHeader('WWW-Authenticate', 'Basic realm="GameForge Studio", charset="UTF-8"');
      res.status(401).json({ error: 'Sign in to your private workspace.' });
      return false;
    }
  }
  const origin = req.headers?.origin;
  const allowed = process.env.APP_URL;
  if (req.method !== 'GET' && (req.headers?.['sec-fetch-site'] === 'cross-site' || (origin && (allowed ? origin !== new URL(allowed).origin : new URL(origin).host !== req.headers?.host)))) {
    res.status(403).json({ error: 'Use the app from its own address.' });
    return false;
  }
  return true;
}

export function sendApiError(error: unknown, res: any) {
  const status = error instanceof ApiError ? error.status : (error as Error)?.name === 'TimeoutError' ? 504 : 502;
  res.status(status).json({ error: error instanceof ApiError ? error.message : 'Request failed or timed out. Try again later.' });
}
