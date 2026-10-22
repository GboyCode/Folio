import { isEncrypted, MAX_BACKUP_BYTES, validateWallet } from './validation.ts';
import { XMLParser } from 'fast-xml-parser';

export const DAV_FOLDER = 'Folio_Backup';
export const DAV_FILENAME = 'folio-wallet.json';
export type DavConfig = { url: string; username: string; password: string };
export type DavRequest = { config: DavConfig; action: 'test' | 'read' | 'write'; raw?: string; etag?: string | null };
export type DavResponse = { status: number; etag: string | null; body: string; redirected?: boolean };
export type DavResult = { exists?: boolean; raw?: string; etag?: string | null };
export type DavWireRequest = { url: string; method: 'PROPFIND' | 'MKCOL' | 'GET' | 'PUT'; username: string; password: string; body: string; etag: string | null };
export type DavTransport = (request: DavWireRequest) => Promise<DavResponse>;

export function normalizeDavConfig(input: DavConfig): DavConfig {
  if (!input || typeof input.url !== 'string' || input.url.length > 2048) throw new Error('请填写 WebDAV 地址。');
  let url: URL;
  try { url = new URL(input.url.trim()); } catch { throw new Error('WebDAV 地址无效。'); }
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password || url.search || url.hash) throw new Error('请使用 HTTPS 文件夹地址，不要在网址中包含账号、密码或查询参数。');
  if (typeof input.username !== 'string' || !input.username.trim() || input.username.length > 300 || /[:\r\n]/.test(input.username)) throw new Error('请填写有效的 WebDAV 用户名。');
  if (typeof input.password !== 'string' || !input.password || input.password.length > 1000 || /[\r\n]/.test(input.password)) throw new Error('请填写 WebDAV 密码或应用专用密码。');
  url.pathname = url.pathname.replace(/\/+$/, '') + '/';
  return { url: url.href, username: input.username.trim(), password: input.password };
}

export function validateDavBackup(raw: string) {
  if (typeof raw !== 'string' || new TextEncoder().encode(raw).length > MAX_BACKUP_BYTES) throw new Error('备份文件不能超过 12 MB。');
  let value: unknown;
  try { value = JSON.parse(raw); } catch { throw new Error('远程文件不是有效的 Folio JSON 备份。'); }
  if (!isEncrypted(value)) return validateWallet(value);
  if (value.version !== 1 || value.iterations !== 600000 || typeof value.salt !== 'string' || !/^[A-Za-z0-9+/]{22}==$/.test(value.salt) || typeof value.iv !== 'string' || !/^[A-Za-z0-9+/]{16}$/.test(value.iv) || typeof value.data !== 'string' || value.data.length < 24 || value.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value.data)) throw new Error('加密备份格式不正确。');
  return value;
}

export function strongEtag(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 512 && /^"[^"\x00-\x20\x7f]*"$/.test(value);
}

export const MAX_DAV_METADATA_BYTES = 64 * 1024;

// Only downloads may leave the WebDAV origin. The transport must strip auth then.
export function davRedirectTarget(current: string, location: string, method: DavWireRequest['method'], status: number): URL {
  let next: URL;
  try { next = new URL(location, current); } catch { throw new Error('WebDAV 返回了无效的重定向地址。'); }
  if (!location || next.href.length > 8192 || next.protocol !== 'https:' || next.username || next.password || next.hash) throw new Error('WebDAV 重定向必须使用不含账号信息的 HTTPS 地址。');
  if (method !== 'GET' && (next.origin !== new URL(current).origin || status === 303)) throw new Error('WebDAV 写入或目录请求发生跨站重定向，请使用最终 WebDAV 服务地址。');
  return next;
}

function xmlText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.replace(/&(quot|apos|lt|gt|amp|#\d+|#x[\da-f]+);/gi, (entity, name: string) => {
    const named: Record<string, string> = { quot: '"', apos: "'", lt: '<', gt: '>', amp: '&' };
    if (name in named) return named[name];
    const n = name.startsWith('#x') ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return Number.isInteger(n) && n > 0 && n <= 0x10ffff ? String.fromCodePoint(n) : entity;
  });
}

export function davMetadataEtag(xml: string, file: string): string | null {
  if (new TextEncoder().encode(xml).length > MAX_DAV_METADATA_BYTES || /<!DOCTYPE|<!ENTITY/i.test(xml)) return null;
  try {
    const parsed = new XMLParser({ ignoreAttributes: true, removeNSPrefix: true, parseTagValue: false, processEntities: false, isArray: name => name === 'response' || name === 'propstat' }).parse(xml, true);
    const responses = parsed?.multistatus?.response;
    if (!Array.isArray(responses)) return null;
    const matches = responses.filter(response => {
      const href = xmlText(response.href);
      return href !== null && new URL(href, file).href === file;
    });
    if (matches.length !== 1 || !Array.isArray(matches[0].propstat)) return null;
    const etags = matches[0].propstat.filter((prop: { status?: unknown }) => typeof prop.status === 'string' && /^HTTP\/\d(?:\.\d)? 200(?:\s|$)/.test(prop.status))
      .map((prop: { prop?: { getetag?: unknown } }) => xmlText(prop.prop?.getetag)).filter(strongEtag);
    return etags.length === 1 ? etags[0] : null;
  } catch { return null; }
}

function checkStatus(status: number) {
  if (status === 401 || status === 403) throw new Error('WebDAV 认证失败或没有读写权限，请检查用户名、应用密码和文件夹权限。');
  if (status >= 300 && status < 400) throw new Error('WebDAV 返回了无法处理的重定向，请检查网盘服务配置。');
  if (status === 404 || status === 409) throw new Error('WebDAV 地址不存在或备份目录无法创建，请检查服务地址和权限。');
  if (status === 412) throw new Error('远程备份已被其他设备修改。请重新拉取或重新检查后上传，未覆盖远程文件。');
  if (status === 423) throw new Error('远程文件已锁定，请稍后重试。');
  if (status === 413 || status === 507) throw new Error('网盘空间不足，或网盘限制了上传文件大小。');
  if (status === 429) throw new Error('网盘请求过于频繁，请稍后重试。');
  if (status < 200 || status >= 300) throw new Error(`WebDAV 请求失败（HTTP ${status}）。`);
}

// Shared by the Worker and desktop bridge; credentials never enter the backup.
export async function runWebDav(input: DavRequest, transport: DavTransport): Promise<DavResult> {
  const config = normalizeDavConfig(input.config);
  if (!['test', 'read', 'write'].includes(input.action)) throw new Error('不支持的 WebDAV 操作。');
  const directory = new URL(`${DAV_FOLDER}/`, config.url).href;
  const file = new URL(DAV_FILENAME, directory).href;
  const request = (method: DavWireRequest['method'], body = '', etag: string | null = null, url = file) => transport({
    url,
    method, body, etag, username: config.username, password: config.password,
  });
  if (input.action === 'test') {
    const response = await request('PROPFIND', '', null, config.url);
    checkStatus(response.status);
    if (response.status !== 207) throw new Error('该地址没有返回 WebDAV 响应，请确认填写的是 WebDAV 文件夹地址。');
    return {};
  }
  if (input.action === 'read') {
    // Download URLs can have a different ETag from the original WebDAV resource.
    const metadata = await request('PROPFIND');
    if (metadata.status === 404) return { exists: false, etag: null };
    checkStatus(metadata.status);
    if (metadata.status !== 207) throw new Error('网盘未返回 WebDAV 文件信息，请检查服务地址。');
    const beforeEtag = davMetadataEtag(metadata.body, file);
    const response = await request('GET');
    checkStatus(response.status);
    validateDavBackup(response.body);
    if (response.redirected && beforeEtag) {
      const after = await request('PROPFIND');
      if (after.status !== 207 || davMetadataEtag(after.body, file) !== beforeEtag) throw new Error('读取期间远程备份已改变，请重新拉取后再试。');
    }
    return { exists: true, raw: response.body, etag: response.redirected ? beforeEtag : strongEtag(response.etag) ? response.etag : beforeEtag };
  }
  validateDavBackup(input.raw!);
  if (input.etag !== null && !strongEtag(input.etag)) throw new Error('缺少远程文件版本，请重新检查后上传。');
  const folder = await request('MKCOL', '', null, directory);
  if (folder.status === 405) {
    // WebDAV returns 405 for an existing collection. Verify it before writing.
    const existing = await request('PROPFIND', '', null, directory);
    checkStatus(existing.status);
    if (existing.status !== 207) throw new Error('无法确认备份目录，请检查网盘是否支持 WebDAV 文件夹。');
  } else checkStatus(folder.status);
  const response = await request('PUT', input.raw, input.etag);
  checkStatus(response.status);
  // Read back: a successful PUT alone does not prove that the provider kept the file.
  const stored = await request('GET');
  checkStatus(stored.status);
  if (stored.body !== input.raw) throw new Error('上传后校验不一致，远程文件可能已被修改。请重新拉取确认。');
  return { exists: true, etag: stored.redirected ? (strongEtag(response.etag) ? response.etag : null) : (strongEtag(stored.etag) ? stored.etag : null) };
}
