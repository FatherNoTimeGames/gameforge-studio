// Serverless OpenAI proxy for Vercel / Netlify free-tier deployment.
// Reads OPENAI_API_KEY from project environment variables (never exposed to the browser).
import { openAiGenerateWithFallback, DEFAULT_MODEL } from '../../shared/openai';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const {
    systemInstruction,
    prompt,
    model = DEFAULT_MODEL,
    clientApiKey,
    imageBase64,
    imageMimeType
  } = req.body || {};

  const apiKey = clientApiKey || process.env.OPENAI_API_KEY;
  if (!apiKey) {
    res.status(400).json({
      error:
        'No OpenAI API key available. Set OPENAI_API_KEY in your host env vars or provide one in the app API Key settings.'
    });
    return;
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
    res.status(500).json({ error: outcome.error || 'Failed to generate response from OpenAI.' });
    return;
  }

  res.status(200).json({ text: outcome.text, modelUsed: outcome.modelUsed });
}
