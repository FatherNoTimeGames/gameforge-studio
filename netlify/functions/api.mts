import chat from '../../api/openai/chat.ts';
import proxyFetch from '../../api/proxy-fetch.ts';
import status from '../../api/status.ts';

// Adapt Netlify's Request/Response runtime to the retained Vercel-style handlers.
export default async function handler(request: Request): Promise<Response> {
  const pathname = new URL(request.url).pathname;
  const route = pathname.replace(/^\/\.netlify\/functions\/api\//, '').replace(/^\/api\//, '');
  const target = route === 'status' ? status : route === 'openai/chat' ? chat : route === 'proxy-fetch' ? proxyFetch : null;
  if (!target) return Response.json({ error: 'Unknown API route.' }, { status: 404 });
  const headers = Object.fromEntries(request.headers.entries());
  let body: unknown;
  if (request.method !== 'GET') {
    try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON.' }, { status: 400 }); }
  }
  let code = 200;
  let payload: unknown = null;
  const outputHeaders = new Headers({ 'Content-Type': 'application/json' });
  const response = {
    setHeader: (name: string, value: string) => { outputHeaders.set(name, value); },
    status: (value: number) => { code = value; return response; },
    json: (value: unknown) => { payload = value; return response; },
  };
  await target({ method: request.method, headers, body }, response);
  return new Response(JSON.stringify(payload), { status: code, headers: outputHeaders });
}
