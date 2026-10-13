import handler from 'vinext/server/fetch-handler';
import type { ExecutionContext } from '@cloudflare/workers-types';
import { handleGameForge } from '../server/handler.ts';

export default {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext) {
    const response = await handleGameForge(request, env);
    return response ?? handler.fetch(request, env, ctx);
  },
};
