import { cp, mkdir, rm, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('../', import.meta.url));
const output = path.join(repository, '.sites-export', 'gameforge');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
const excluded = new Set(['node_modules', 'dist', 'ui', '.next', '.wrangler', '.sites-runtime']);
await cp(path.join(repository, 'sites'), output, { recursive: true,
  filter: (source) => !path.relative(path.join(repository, 'sites'), source).split(path.sep).some((segment) => excluded.has(segment)) });
for (const name of ['src', 'shared']) {
  await cp(path.join(repository, name), path.join(output, 'source', name), { recursive: true });
}
// Server imports are adjusted for the standalone export; source/src continues
// to find source/shared through its existing relative imports.
for (const name of ['store.ts', 'mcp.ts', 'handler.ts']) {
  const target = path.join(output, 'server', name);
  await writeFile(target, (await readFile(target, 'utf8')).replaceAll('../../shared/', '../source/shared/'));
}
console.log(`Standalone Sites source prepared at ${output}`);
