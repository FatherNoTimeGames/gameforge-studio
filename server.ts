import express from 'express';
import dotenv from 'dotenv';
import path from 'node:path';
import { createHash, timingSafeEqual } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { AI_CONFIG, ApiError, generateResponse } from './server/ai.ts';
import { fetchPublicText } from './server/safeFetch.ts';
import { WorkspaceStore } from './server/workspaceStore.ts';

dotenv.config();
const directory = path.dirname(fileURLToPath(import.meta.url));

export async function createApp() {
  const app = express();
  const isProd = process.env.NODE_ENV === 'production';
  const password = process.env.APP_PASSWORD;
  if (isProd && (!password || password.length < 16)) {
    throw new Error('Set APP_PASSWORD to at least 16 characters before starting a public production server.');
  }
  const store = process.env.DATA_DIR ? new WorkspaceStore(process.env.DATA_DIR) : null;
  // Fail startup on corrupt/unreadable data rather than replacing it with an empty workspace.
  if (store) await store.load();
  app.disable('x-powered-by');
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));
  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    next();
  });
  if (password) {
    const expected = createHash('sha256').update(`${process.env.APP_USERNAME || 'owner'}:${password}`).digest();
    app.use((req, res, next) => {
      const authorization = req.get('authorization') || '';
      const decoded = authorization.startsWith('Basic ') ? Buffer.from(authorization.slice(6), 'base64').toString('utf8') : '';
      const actual = createHash('sha256').update(decoded).digest();
      if (!timingSafeEqual(actual, expected)) {
        res.setHeader('WWW-Authenticate', 'Basic realm="GameForge Studio", charset="UTF-8"');
        return res.status(401).send('Sign in to your private GameForge workspace.');
      }
      next();
    });
  }
  app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    // Reject cross-origin browser writes, including requests using cached Basic credentials.
    const origin = req.get('origin');
    const expectedOrigin = process.env.APP_URL ? new URL(process.env.APP_URL).origin : null;
    if (req.method !== 'GET' && (req.get('sec-fetch-site') === 'cross-site' || (origin && (expectedOrigin ? origin !== expectedOrigin : new URL(origin).host !== req.get('host'))))) {
      return res.status(403).json({ error: 'Use this workspace from its own address.' });
    }
    next();
  });
  app.use(express.json({ limit: '25mb' }));
  app.get('/api/status', (_req, res) => res.json({
    status: 'ok', hasServerApiKey: Boolean(process.env.OPENAI_API_KEY),
    provider: 'openai', defaultModel: AI_CONFIG.model, reasoningEffort: 'high', serviceTier: 'default',
    durableStorage: Boolean(store),
    availableEngines: ['GDScript - Godot 4', 'C# - Unity', 'GDScript - Godot 3', 'C++ / Blueprints - Unreal Engine 5', 'TypeScript - Phaser 3', 'Python - Pygame 2', 'Rust - Bevy Engine'],
  }));
  app.get('/api/workspace', async (req, res, next) => {
    try {
      const workspace = store ? await store.load() : null;
      const unchanged = workspace !== null && req.query.revision !== undefined && Number(req.query.revision) === workspace.revision;
      res.json({ enabled: Boolean(store), workspace: unchanged ? undefined : workspace, unchanged, syncMode: 'merge' });
    }
    catch (error) { next(error); }
  });
  app.put('/api/workspace', async (req, res, next) => {
    try {
      if (!store) throw new ApiError(503, 'Durable storage is not configured. Set DATA_DIR to a persistent disk.');
      res.json(await store.save(req.body));
    } catch (error) { next(error); }
  });
  app.post('/api/proxy-fetch', async (req, res, next) => {
    try {
      if (typeof req.body?.url !== 'string') throw new ApiError(400, 'Valid HTTP/HTTPS URL required.');
      const text = await fetchPublicText(req.body.url, AbortSignal.timeout(15_000));
      const cleanText = /<html|<!doctype/i.test(text.slice(0, 500)) ? text
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ').replace(/\n\s*\n/g, '\n\n').trim() : text;
      res.json({ text: cleanText, length: cleanText.length });
    } catch (error) { next(error); }
  });
  let activeRequests = 0;
  let windowStart = Date.now();
  let requestsInWindow = 0;
  app.post(['/api/openai/chat', '/api/ai/generate'], async (req, res, next) => {
    if (!process.env.OPENAI_API_KEY) return res.status(503).json({ error: 'Set OPENAI_API_KEY in server hosting secrets. OpenAI API billing is separate from ChatGPT.' });
    if (Date.now() - windowStart > 60_000) { windowStart = Date.now(); requestsInWindow = 0; }
    if (activeRequests >= 3 || requestsInWindow >= 30) return res.status(429).json({ error: 'Too many AI requests. Wait for the current tasks to finish and try again.' });
    activeRequests++;
    requestsInWindow++;
    const controller = new AbortController();
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', cancel);
    try {
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(240_000)]);
      const result = await generateResponse(req.body, process.env.OPENAI_API_KEY, signal);
      if (!res.destroyed) res.json(result);
    } catch (error) { if (!res.destroyed) next(error); }
    finally { activeRequests--; res.off('close', cancel); }
  });
  app.use('/api', (_req, res) => res.status(404).json({ error: 'Unknown API route.' }));
  if (!isProd) {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(directory, 'dist');
    app.use(express.static(distPath, { index: false }));
    app.get('*', (_req, res) => { res.setHeader('Cache-Control', 'no-cache'); res.sendFile(path.join(distPath, 'index.html')); });
  }
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error instanceof ApiError ? error.status : error.type === 'entity.too.large' ? 413 : error.type === 'entity.parse.failed' ? 400 : error.name === 'TimeoutError' || error.name === 'AbortError' ? 504 : 500;
    const message = error instanceof ApiError ? error.message : status === 413 ? 'Request exceeds the 25 MB limit.' : status === 400 ? 'Invalid JSON request.' : status === 504 ? 'Request timed out. Try a smaller request.' : 'The server could not complete this request.';
    if (status === 500) console.error('Server request failed:', error.name, error.code || 'unknown');
    res.status(status).json({ error: message });
  });
  return app;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  createApp().then((app) => {
    const port = Number(process.env.PORT) || 3000;
    const server = app.listen(port, '0.0.0.0', () => console.log(`[GameForge] Listening on port ${port}`));
    server.requestTimeout = 300_000;
    const shutdown = () => server.close(() => process.exit(0));
    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }).catch((error) => { console.error('Startup failed:', error.message); process.exit(1); });
}
