import express from 'express';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
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
  app.get('/api/status', (req, res) => {
    res.json({
      status: 'ok',
      hasServerApiKey: Boolean(process.env.GEMINI_API_KEY),
      defaultModel: 'gemini-3.8-flash',
      availableEngines: [
        'GDScript - Godot 4',
        'C# - Unity',
        'GDScript - Godot 3',
        'C++ / Blueprints - Unreal Engine 5',
        'TypeScript - Phaser 3',
        'Python - Pygame 2',
        'Rust - Bevy Engine'
      ]
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

      const text = await response.text();
      // Strip scripts and styles if HTML is returned
      let cleanText = text;
      if (/<html|<!doctype/i.test(text.slice(0, 500))) {
        cleanText = text
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\n\s*\n/g, '\n\n')
          .trim();
      }

      return res.json({ text: cleanText, length: cleanText.length });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to fetch remote URL.';
      return res.status(500).json({ error: message });
    }
  });

  // Gemini API Proxy (Supports text & multimodal images)
  app.post('/api/gemini/generate', async (req, res) => {
    const {
      systemInstruction,
      prompt,
      model = 'gemini-3.8-flash',
      clientApiKey,
      imageBase64,
      imageMimeType
    } = req.body;

    const apiKey = clientApiKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(400).json({
        error: 'No Gemini API key available. Configure GEMINI_API_KEY in server secrets or provide one in workspace settings.'
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });

    // Structure contents: multimodal if image provided, otherwise plain prompt
    type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };
    let contentsPayload: string | { parts: ContentPart[] } = prompt;
    if (imageBase64) {
      contentsPayload = {
        parts: [
          {
            inlineData: {
              mimeType: imageMimeType || 'image/png',
              data: imageBase64
            }
          },
          {
            text: prompt || 'Analyze this game engine screenshot or error.'
          }
        ]
      };
    }

    // Fallback models in priority order
    const candidateModels = [
      model,
      'gemini-3.8-flash',
      'gemini-3.1-pro-preview',
      'gemini-3.1-flash-lite'
    ].filter((m, idx, self) => self.indexOf(m) === idx);

    let lastError: unknown = null;

    for (const targetModel of candidateModels) {
      try {
        const response = await ai.models.generateContent({
          model: targetModel,
          contents: contentsPayload,
          config: systemInstruction
            ? {
                systemInstruction: systemInstruction
              }
            : undefined
        });

        const text = response.text || '';
        return res.json({
          text,
          modelUsed: targetModel
        });
      } catch (err: unknown) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`Model ${targetModel} failed: ${msg}. Retrying fallback if available...`);
      }
    }

    const errorMessage = lastError instanceof Error ? lastError.message : 'Failed to generate response from Gemini API.';
    console.error('All model generation attempts failed:', lastError);
    return res.status(500).json({
      error: errorMessage
    });
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
