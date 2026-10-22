import { MAX_BACKUP_BYTES } from '../src/validation.ts';
import { davRedirectTarget, MAX_DAV_METADATA_BYTES, runWebDav, type DavRequest, type DavWireRequest } from '../src/webdav.ts';

export function assertPublicDavUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  // This server-side relay is for public HTTPS services, never local services.
  if (url.protocol !== 'https:' || /^[\d.]+$/.test(host) || host.includes(':') || !host.includes('.') || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid)$/.test(host)) throw new Error('网页版需要可从公网访问的 HTTPS WebDAV 域名，不支持本机或内网地址。');
}

export async function boundedText(response: Response, limit: number) {
  if (Number(response.headers.get('Content-Length')) > limit) { await response.body?.cancel(); throw new Error('WebDAV 响应超过大小限制。'); }
  const reader = response.body?.getReader();
  if (!reader) return '';
  const parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) { await reader.cancel(); throw new Error('WebDAV 响应超过大小限制。'); }
      parts.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return new TextDecoder().decode(bytes);
}

async function transport(request: DavWireRequest) {
  assertPublicDavUrl(request.url);
  const auth = new TextEncoder().encode(`${request.username}:${request.password}`);
  const headers: Record<string, string> = { Authorization: `Basic ${btoa(String.fromCharCode(...auth))}`, 'Cache-Control': 'no-cache', Accept: 'application/json, application/xml;q=0.9, */*;q=0.1' };
  if (request.method === 'PROPFIND') headers.Depth = '0';
  if (request.method === 'PUT') {
    headers['Content-Type'] = 'application/json; charset=utf-8';
    headers[request.etag === null ? 'If-None-Match' : 'If-Match'] = request.etag ?? '*';
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30_000);
  try {
    let url = request.url;
    const visited = new Set([url]);
    for (let redirects = 0; ; redirects++) {
      assertPublicDavUrl(url);
      // Never forward Folio cookies; never restore provider auth after leaving its origin.
      const response = await fetch(url, { method: request.method, headers, body: request.method === 'PUT' ? request.body : undefined, redirect: 'manual', signal: controller.signal }).catch(() => {
        throw new Error(request.method === 'PUT' ? '上传连接中断或超时，远程文件可能已写入。请先拉取检查，再重试。' : '无法连接 WebDAV 或请求超时，请检查地址、网络和证书。');
      });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('Location') ?? '';
        await response.body?.cancel();
        const next = davRedirectTarget(url, location, request.method, response.status);
        if (redirects >= 5 || visited.has(next.href)) throw new Error('WebDAV 重定向次数过多或发生循环。');
        if (next.origin !== new URL(url).origin) delete headers.Authorization;
        visited.add(next.href);
        url = next.href;
        continue;
      }
      const limit = request.method === 'GET' && response.status === 200 ? MAX_BACKUP_BYTES : request.method === 'PROPFIND' && response.status === 207 ? MAX_DAV_METADATA_BYTES : 0;
      const body = limit ? await boundedText(response, limit) : '';
      if (!limit) await response.body?.cancel();
      return { status: response.status, etag: response.headers.get('ETag'), body, redirected: redirects > 0 };
    }
  } finally { clearTimeout(timer); }
}

export const handleWebDav = (input: DavRequest) => runWebDav(input, transport);
