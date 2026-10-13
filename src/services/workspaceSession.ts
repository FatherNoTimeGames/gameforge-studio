let account: string | null = null;
export function setWorkspaceAccount(id: string | null) { account = id; }
export function accountFetch(input: RequestInfo | URL, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  if (account && typeof input === 'string' && input.startsWith('/api/')) headers.set('X-GameForge-Account', account);
  return fetch(input, { ...init, headers });
}
