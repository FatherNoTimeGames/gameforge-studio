// Structural types keep the request/storage layer testable without a Worker runtime.
export interface Statement {
  bind(...values: unknown[]): Statement;
  first<T = any>(): Promise<T | null>;
  all<T = any>(): Promise<{ results: T[] }>;
  run(): Promise<{ meta: { changes: number } }>;
}
export interface StorageEnv {
  DB: { prepare(sql: string): Statement };
  BUCKET: {
    put(key: string, value: string): Promise<unknown>;
    get(key: string): Promise<{ text(): Promise<string> } | null>;
    delete(key: string): Promise<unknown>;
  };
}
export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}
export interface Job {
  id: string; owner: string; fingerprint: string; state: string;
  blob_key: string; result_key: string | null; created_at: number;
}
