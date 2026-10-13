import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { ApiError } from './ai.ts';
import { workspaceFromSave } from '../shared/workspaceSync.ts';

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
      const current = await this.load();
      let record: WorkspaceRecord;
      try { record = workspaceFromSave(current, input); }
      catch (error: any) { throw new ApiError(400, error.message); }
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
