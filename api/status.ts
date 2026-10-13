import { AI_CONFIG } from '../shared/openai.ts';
import { AVAILABLE_ENGINES } from '../shared/constants.ts';
import { guardApi } from '../shared/apiGuard.ts';

export default function handler(req: any, res: any) {
  if (!guardApi(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed.' });
  res.status(200).json({ status: 'ok', hasServerApiKey: Boolean(process.env.OPENAI_API_KEY), provider: 'openai', defaultModel: AI_CONFIG.model, reasoningEffort: 'high', serviceTier: 'default', durableStorage: false, availableEngines: AVAILABLE_ENGINES });
}
