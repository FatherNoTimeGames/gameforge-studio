export const AI_CONFIG = Object.freeze({
  model: 'gpt-6.1-sol',
  reasoningEffort: 'high',
  serviceTier: 'default',
});

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

const stringArray = { type: 'array', items: { type: 'string' } };
const formats: Record<string, Record<string, unknown>> = {
  wiki_build: { type: 'object', additionalProperties: false, required: ['pages'], properties: {
    pages: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'content', 'parentTitle'], properties: {
      title: { type: 'string' }, content: { type: 'string' }, parentTitle: { type: ['string', 'null'] },
    } } },
  } },
  verification: { type: 'object', additionalProperties: false, required: ['status', 'issues', 'unsupported', 'missing'], properties: {
    status: { type: 'string', enum: ['ok', 'warning', 'error'] }, issues: stringArray, unsupported: stringArray, missing: stringArray,
  } },
  index: { type: 'object', additionalProperties: false, required: ['summary', 'keywords'], properties: {
    summary: { type: 'string' }, keywords: stringArray,
  } },
};

export function createResponseBody(input: unknown) {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'A request body is required.');
  const { prompt, systemInstruction, imageBase64, imageMimeType, outputKind } = input as Record<string, unknown>;
  if (typeof prompt !== 'string' || !prompt.trim() || prompt.length > 500_000) {
    throw new ApiError(400, 'Provide a prompt between 1 and 500,000 characters.');
  }
  if (systemInstruction !== undefined && (typeof systemInstruction !== 'string' || systemInstruction.length > 1_000_000)) {
    throw new ApiError(400, 'The instructions are too large or invalid.');
  }
  if (outputKind !== undefined && (typeof outputKind !== 'string' || !formats[outputKind])) throw new ApiError(400, 'Invalid response format.');
  const content: Record<string, unknown>[] = [{ type: 'input_text', text: prompt }];
  if (imageBase64 !== undefined) {
    if (typeof imageBase64 !== 'string' || !imageBase64.length || imageBase64.length > 14_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(imageBase64)) {
      throw new ApiError(400, 'Provide a valid image under 10 MB.');
    }
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(String(imageMimeType))) {
      throw new ApiError(400, 'Supported image types: PNG, JPEG, WebP, and GIF.');
    }
    content.push({ type: 'input_image', image_url: `data:${imageMimeType};base64,${imageBase64}` });
  }
  // The server owns the model and processing settings. Never silently fall back.
  return {
    model: AI_CONFIG.model,
    reasoning: { effort: AI_CONFIG.reasoningEffort },
    service_tier: AI_CONFIG.serviceTier,
    store: false,
    text: typeof outputKind === 'string' ? { format: { type: 'json_schema', name: outputKind, strict: true, schema: formats[outputKind] } } : undefined,
    max_output_tokens: 32_768,
    instructions: systemInstruction || undefined,
    input: [{ role: 'user', content }],
  };
}

export async function generateResponse(input: unknown, apiKey: string, signal: AbortSignal, fetcher: typeof fetch = fetch) {
  const body = createResponseBody(input);
  const response = await fetcher('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok) {
    // Avoid returning upstream bodies that may contain prompt fragments or secrets.
    const messages: Record<number, string> = {
      401: 'The server OpenAI API key is invalid. Update OPENAI_API_KEY in hosting settings.',
      403: 'This OpenAI project does not have access to GPT-6.1 Sol.',
      404: 'GPT-6.1 Sol is unavailable for this OpenAI project.',
      429: 'OpenAI quota or rate limit reached. Check API billing or try again later.',
    };
    throw new ApiError(response.status === 429 ? 429 : 502, messages[response.status] || 'OpenAI could not complete this request. Try again later.');
  }
  const data = await response.json();
  if (data.status !== 'completed') {
    throw new ApiError(502, 'The response was incomplete. Try a smaller request; partial wiki edits were not applied.');
  }
  const parts = (data.output || []).filter((item: any) => item.type === 'message').flatMap((item: any) => item.content || []);
  if (parts.some((part: any) => part.type === 'refusal')) throw new ApiError(422, 'The model could not fulfill this request. Please revise it.');
  const text = parts.filter((part: any) => part.type === 'output_text').map((part: any) => part.text).join('\n');
  if (!text.trim()) throw new ApiError(502, 'OpenAI returned no text. Try again with a smaller request.');
  return { text, modelUsed: data.model || AI_CONFIG.model, reasoningEffort: 'high', serviceTier: data.service_tier || 'default' };
}
