import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from './ai.ts';

export interface WorkspaceRecord {
  projects: unknown[];
  activeProjectId: string;
  revision: number;
}

// One private workspace, one server instance, on a persistent disk.
export class WorkspaceStore {
  private queue: Promise<unknown> = Promise.resolve();
  private directory: string;
  constructor(directory: string) { this.directory = directory; }
  async load(): Promise<WorkspaceRecord | null> {
    try { return JSON.parse(await readFile(path.join(this.directory, 'workspace.json'), 'utf8')); }
    catch (error: any) { if (error.code === 'ENOENT') return null; throw error; }
  }
  save(input: any): Promise<WorkspaceRecord> {
    const operation = this.queue.then(async () => {
      if (!input || !Array.isArray(input.projects) || !input.projects.length || typeof input.activeProjectId !== 'string' || !Number.isSafeInteger(input.revision)) {
        throw new ApiError(400, 'Invalid workspace data.');
      }
      if (input.projects.some((p: any) => !p || typeof p.id !== 'string' || typeof p.name !== 'string' || !Array.isArray(p.pages)) || !input.projects.some((p: any) => p.id === input.activeProjectId)) {
        throw new ApiError(400, 'Invalid workspace projects or active project.');
      }
      const current = await this.load();
      if (input.revision !== (current?.revision || 0)) throw new ApiError(409, 'This workspace changed in another tab or device. Export your current project, then reload to load the latest saved workspace.');
      const record = { projects: input.projects, activeProjectId: input.activeProjectId, revision: input.revision + 1 };
      await mkdir(this.directory, { recursive: true, mode: 0o700 });
      const target = path.join(this.directory, 'workspace.json');
      await writeFile(`${target}.tmp`, JSON.stringify(record), { mode: 0o600 });
      await rename(`${target}.tmp`, target);
      return record;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
