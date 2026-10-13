import { lookup } from 'node:dns/promises';
import http from 'node:http';
import https from 'node:https';
import { isIP } from 'node:net';
import { ApiError } from './ai.ts';

export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split('.').map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0)) || (a === 100 && b >= 64 && b <= 127) || (a === 198 && (b === 18 || b === 19)));
  }
  // Only global unicast IPv6; reject mapped IPv4, local, multicast and reserved prefixes.
  return isIP(address) === 6 && /^[23]/.test(address) && !/^2001:(?:0:|db8:|2:|10:|20:)/i.test(address) && !/^2002:/i.test(address);
}

export function validateSourceUrl(value: string): URL {
  let url: URL;
  try { url = new URL(value); } catch { throw new ApiError(400, 'Valid HTTP/HTTPS URL required.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || (url.port && !['80', '443'].includes(url.port))) {
    throw new ApiError(400, 'Use a public HTTP/HTTPS URL without credentials or a custom port.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || /\.(localhost|local|internal)$/i.test(hostname) || (isIP(hostname) && !isPublicAddress(hostname))) {
    throw new ApiError(400, 'Only public internet sources can be imported.');
  }
  return url;
}

export async function fetchPublicText(value: string, signal: AbortSignal, redirects = 0): Promise<string> {
  if (redirects > 5) throw new ApiError(400, 'Too many source redirects.');
  const url = validateSourceUrl(value);
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(hostname) ? [{ address: hostname, family: isIP(hostname) }] : await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) throw new ApiError(400, 'Source resolves to a private or reserved network.');
  // Pin the validated address to the actual request to prevent DNS rebinding.
  const result = await new Promise<{ redirect?: string; text?: string }>((resolve, reject) => {
    const transport = url.protocol === 'https:' ? https : http;
    const request = transport.get(url, {
      signal,
      headers: { 'User-Agent': 'GameForgeWikiBuilder/2.0', 'Accept-Encoding': 'identity' },
      lookup: (_host, options, callback) => {
        const chosen = addresses[0];
        if (options.all) callback(null, [chosen]);
        else callback(null, chosen.address, chosen.family);
      },
    }, (response) => {
      const status = response.statusCode || 500;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        response.resume();
        resolve({ redirect: new URL(response.headers.location, url).href });
        return;
      }
      if (status < 200 || status >= 300) { response.resume(); reject(new ApiError(502, `Source returned HTTP ${status}.`)); return; }
      const type = response.headers['content-type'] || '';
      if (type && !/text\/|application\/(json|xml|javascript|x-yaml)/i.test(type)) { response.resume(); reject(new ApiError(400, 'This source is not a text document.')); return; }
      let bytes = 0;
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > 2_000_000) { request.destroy(new ApiError(413, 'Source exceeds the 2 MB import limit.')); return; }
        chunks.push(chunk);
      });
      response.on('end', () => resolve({ text: Buffer.concat(chunks).toString('utf8') }));
      response.on('error', reject);
    });
    request.on('error', reject);
  });
  if (result.redirect) return fetchPublicText(result.redirect, signal, redirects + 1);
  return result.text || '';
}
