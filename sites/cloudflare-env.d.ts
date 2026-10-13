import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
declare global {
  namespace Cloudflare {
    interface Env { DB: D1Database; BUCKET: R2Bucket; }
  }
}
