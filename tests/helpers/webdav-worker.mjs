import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { createHash, pbkdf2Sync } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export async function createWebDavFixture({ port = 0, assets = false } = {}) {
  const root = fileURLToPath(new URL('../../', import.meta.url));
  const bundle = await build({ entryPoints: [root + 'worker/index.ts'], bundle: true, write: false, format: 'esm', platform: 'browser' });
  const files = new Map(); const folders = new Set(['/dav/']); const requests = []; const redirects = new Map(); let version = 0;
  const davConfig = { url: 'https://dav.example.com/dav/', username: 'dav-test', password: 'dav-test-password' };
  const mf = new Miniflare(convertV4MiniflareOptions({
    host: '127.0.0.1', port, workers: [{ name: 'webdav-test', script: bundle.outputFiles[0].text, modules: true, compatibilityDate: '2026-10-07', d1Databases: ['DB'],
    ...(assets ? { assets: { directory: root + 'dist', binding: 'ASSETS', run_worker_first: ['/api/*'], routerConfig: { has_user_worker: true } } } : {}),
    outboundService: async request => {
      const url = new URL(request.url);
      if (!['dav.example.com', 'download.example.com'].includes(url.hostname)) throw new Error('Unexpected external request in isolated test');
      requests.push({ method: request.method, url: request.url, authorized: request.headers.has('Authorization'), cookie: request.headers.get('Cookie'), match: request.headers.get('If-Match'), none: request.headers.get('If-None-Match'), depth: request.headers.get('Depth') });
      const redirect = redirects.get(request.method + ' ' + request.url);
      if (redirect) return new Response(null, {status: redirect.status ?? 302, headers: {Location: redirect.url}});
      if (url.hostname === 'download.example.com') {
        const file = files.get('/dav/Folio_Backup/folio-wallet.json');
        return file ? new Response(file.raw, {headers: {ETag: '"storage-etag"'}}) : new Response(null, {status:404});
      }
      if (request.headers.get('Authorization') !== 'Basic ' + Buffer.from(`${davConfig.username}:${davConfig.password}`).toString('base64')) return new Response('Unauthorized', { status: 401 });
      if (url.pathname.includes('redirect')) return new Response(null, { status: 302, headers: { Location: 'https://unexpected.example.com/' } });
      if (request.method === 'PROPFIND') {
        const file = files.get(url.pathname);
        const body = file ? `<d:multistatus xmlns:d="DAV:"><d:response><d:href>${url.pathname}</d:href><d:propstat><d:prop><d:getetag>${file.etag.replaceAll('"','&quot;')}</d:getetag></d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>` : '<multistatus xmlns="DAV:"/>';
        return new Response(body, { status: file || folders.has(url.pathname) ? 207 : 404, headers: { 'Content-Type': 'application/xml' } });
      }
      if (request.method === 'MKCOL') {
        const status = folders.has(url.pathname) ? 405 : 201;
        folders.add(url.pathname);
        return new Response(null, { status });
      }
      const file = files.get(url.pathname);
      if (request.method === 'GET') return file ? new Response(file.raw, { headers: { 'Content-Type': 'application/json', ETag: file.etag } }) : new Response(null, { status: 404 });
      if (request.method !== 'PUT') return new Response(null, { status: 405 });
      if (!folders.has(url.pathname.slice(0, url.pathname.lastIndexOf('/') + 1))) return new Response(null, { status: 409 });
      if (file ? request.headers.get('If-Match') !== file.etag : request.headers.get('If-None-Match') !== '*') return new Response(null, { status: 412 });
      const etag = `"v${++version}"`;
      files.set(url.pathname, { raw: await request.text(), etag });
      return new Response(null, { status: 201, headers: { ETag: etag } });
    }, }],
  }));
  const url = (await mf.ready).origin;
  const db = await mf.getD1Database('DB');
  const schema = await readFile(root + 'migrations/0001_initial.sql', 'utf8');
  for (const sql of schema.split(';').filter(x => x.trim())) await db.prepare(sql).run();
  const password = 'folio-test-password';
  await db.prepare('INSERT INTO account(id,username,password_hash,password_salt,password_iterations,auth_version,updated_at) VALUES(1,?,?,?,?,1,?)').bind('webdav-test', pbkdf2Sync(password, 'test-salt', 100000, 32, 'sha256').toString('hex'), 'test-salt', 100000, new Date().toISOString()).run();
  const token = 'a'.repeat(64);
  await db.prepare('INSERT INTO sessions(token_hash,auth_version,expires_at) VALUES(?,1,?)').bind(createHash('sha256').update(token).digest('hex'), Date.now() + 3600000).run();
  const call = async (input, overrides = {}) => {
    const response = await mf.dispatchFetch(`${url}/api/webdav`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: url, Cookie: `mrgcard_session=${token}`, ...overrides }, body: JSON.stringify(input) });
    return { status: response.status, data: await response.json() };
  };
  return { mf, db, url, files, folders, requests, redirects, davConfig, call, login: { username: 'webdav-test', password } };
}
