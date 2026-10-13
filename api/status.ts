// Lightweight status endpoint so the frontend can detect that an API proxy exists
// (serverless or Express) and prefer it over direct browser calls.
import { DEFAULT_MODEL } from '../../shared/openai';
import { AVAILABLE_ENGINES } from '../../shared/constants';

export default function handler(_req: any, res: any) {
  res.status(200).json({
    status: 'ok',
    hasServerApiKey: Boolean(process.env.OPENAI_API_KEY),
    provider: 'openai',
    defaultModel: DEFAULT_MODEL,
    availableEngines: AVAILABLE_ENGINES
  });
}
