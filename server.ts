import express from 'express';
import { createServer as createViteServer } from 'vite';
import { openAiGenerateWithFallback, DEFAULT_MODEL } from './shared/openai';
import { AVAILABLE_ENGINES } from './shared/constants';
import { htmlToPlainText } from './shared/htmlText';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;
  const isProd = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '25mb' }));

  // Health and environment status
  app.get('/api/status', (_req, res) => {
    res.json({
      status: 'ok',
      hasServerApiKey: Boolean(process.env.OPENAI_API_KEY),
      provider: 'openai',
      defaultModel: DEFAULT_MODEL,
      availableEngines: AVAILABLE_ENGINES
    });
  });

  // CORS-free URL content fetcher for Wiki Builder sources
  app.post('/api/proxy-fetch', async (req, res) => {
    try {
      const { url } = req.body;
      if (!url || typeof url !== 'string' || !url.startsWith('http')) {
        return res.status(400).json({ error: 'Valid HTTP/HTTPS URL required.' });
      }

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GameForgeWikiBuilder/1.0)'
        },
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        return res.status(response.status).json({ error: `Remote server responded with ${response.status} ${response.statusText}` });
      }

      const cleanText = htmlToPlainText(await response.text());
      return res.json({ text: cleanText, length: cleanText.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch remote URL.';
      return res.status(500).json({ error: message });
    }
  });

  // OpenAI API Proxy (Supports text & multimodal images)
  app.post('/api/openai/chat', async (req, res) => {
    const {
      systemInstruction,
      prompt,
      model = DEFAULT_MODEL,
      clientApiKey,
      imageBase64,
      imageMimeType
    } = req.body;

    const apiKey = clientApiKey || process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'No OpenAI API key available. Configure OPENAI_API_KEY in server secrets or provide one in workspace settings.'
      });
    }

    const outcome = await openAiGenerateWithFallback({
      prompt,
      systemInstruction,
      model,
      apiKey,
      imageBase64,
      imageMimeType
    });

    if (!outcome.ok) {
      console.error('All OpenAI generation attempts failed:', outcome.error);
      return res.status(500).json({ error: outcome.error || 'Failed to generate response from OpenAI.' });
    }

    return res.json({ text: outcome.text, modelUsed: outcome.modelUsed });
  });

  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[GameForge Server] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
