import { access, cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// Compile the existing interface with this target's React installation.
// Generated copies are ignored; the root src/ and shared/ remain authoritative.
const root = new URL('../', import.meta.url);
const destination = new URL('ui/', root);
await rm(destination, { recursive: true, force: true });
await mkdir(destination, { recursive: true });
for (const name of ['src', 'shared']) {
  let source = new URL(`../${name}/`, root);
  try { await access(source); } catch { source = new URL(`source/${name}/`, root); }
  await cp(fileURLToPath(source), fileURLToPath(new URL(`${name}/`, destination)), { recursive: true });
}
