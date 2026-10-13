import vinext from 'vinext';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import hosting from './.openai/hosting.json';
import { sites } from './build/sites-vite-plugin';
import { readExecutionProfile } from './scripts/execution-profile.mjs';

export default defineConfig(async () => {
  const { cloudflare } = await import('@cloudflare/vite-plugin');
  const managed = readExecutionProfile() === 'managed-linux';
  return {
    server: managed ? { host: '0.0.0.0', allowedHosts: ['terminal.local'] } : {},
    plugins: [vinext(), sites({ mockAuth: !managed }), tailwindcss(), cloudflare({
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      inspectorPort: false,
      config: {
        main: './build/sites-worker.ts',
        compatibility_date: '2026-05-15',
        compatibility_flags: ['nodejs_compat'],
        d1_databases: [{ binding: hosting.d1, database_name: 'gameforge-local', database_id: '00000000-0000-4000-8000-000000000000' }],
        r2_buckets: [{ binding: hosting.r2, bucket_name: 'gameforge-local' }],
      },
    })],
  };
});
