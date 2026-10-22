import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeDavConfig, runWebDav, strongEtag, validateDavBackup, davMetadataEtag, davRedirectTarget, DAV_FOLDER, DAV_FILENAME, type DavConfig, type DavTransport } from '../src/webdav.ts';
import { createEncryption, decryptWallet } from '../src/storage.ts';
import { assertPublicDavUrl, boundedText } from '../worker/webdav.ts';
import { MAX_BACKUP_BYTES } from '../src/validation.ts';

const config: DavConfig = { url: 'https://dav.example.com/dav', username: 'tester', password: 'test-only-password' };
const wallet = { version: 1 as const, entries: [], updatedAt: '2026-10-22T00:00:00.000Z' };
const raw = JSON.stringify(wallet);

function provider() {
  const files = new Map<string, { raw: string; etag: string }>();
  const folders = new Set([normalizeDavConfig(config).url]);
  let revision = 0;
  const transport: DavTransport = async request => {
    const file = files.get(request.url);
    if (request.method === 'PROPFIND') return { status: file || folders.has(request.url) ? 207 : 404, body: '', etag: null };
    if (request.method === 'MKCOL') {
      const status = folders.has(request.url) ? 405 : 201;
      folders.add(request.url);
      return { status, body: '', etag: null };
    }
    if (request.method === 'GET') return { status: file ? 200 : 404, body: file?.raw ?? '', etag: file?.etag ?? null };
    if ((file && file.etag !== request.etag) || (!file && request.etag !== null)) return { status: 412, body: '', etag: null };
    const etag = `"${++revision}"`;
    files.set(request.url, { raw: request.body, etag });
    return { status: 201, body: '', etag };
  };
  return { files, folders, transport };
}

test('validates HTTPS settings and public relay targets', () => {
  assert.equal(normalizeDavConfig(config).url, 'https://dav.example.com/dav/');
  for (const url of ['http://dav.example.com/', 'file:///wallet.json', 'https://user:pass@dav.example.com/', 'https://dav.example.com/?secret=x']) assert.throws(() => normalizeDavConfig({ ...config, url }));
  for (const url of ['https://127.0.0.1/', 'https://2130706433/', 'https://[::1]/', 'https://server.local/', 'https://localhost./']) assert.throws(() => assertPublicDavUrl(url));
  assert.doesNotThrow(() => assertPublicDavUrl(config.url));
  assert.equal(strongEtag('W/"x"'), false);
  assert.equal(strongEtag('"x"\r\nInjected: y'), false);
});

test('upload creates the fixed backup folder and read automatically uses the same path', async () => {
  const { transport, files, folders } = provider();
  await runWebDav({ config, action: 'test' }, transport);
  assert.equal(files.size, 0);
  assert.equal((await runWebDav({ config, action: 'read' }, transport)).exists, false);
  assert.equal(folders.size, 1, 'connection test and pull do not create folders');
  await runWebDav({ config, action: 'write', raw, etag: null }, transport);
  assert.ok(folders.has(`https://dav.example.com/dav/${DAV_FOLDER}/`));
  assert.ok(files.has(`https://dav.example.com/dav/${DAV_FOLDER}/${DAV_FILENAME}`));
  assert.equal((await runWebDav({ config, action: 'read' }, transport)).raw, raw);
  const separate = { ...config, url: 'https://dav.example.com/other/' };
  assert.equal((await runWebDav({ config: separate, action: 'read' }, transport)).exists, false);
  assert.equal(files.size, 1);
});

test('folder creation errors stop upload; 405 only proceeds for a verified existing collection', async () => {
  for (const creationStatus of [403, 409, 405]) {
    const methods: string[] = [];
    const transport: DavTransport = async request => {
      methods.push(request.method);
      return { status: request.method === 'MKCOL' ? creationStatus : 404, body: '', etag: null };
    };
    await assert.rejects(runWebDav({ config, action: 'write', raw, etag: null }, transport));
    assert.ok(!methods.includes('PUT'));
  }
});

test('stale overwrites and concurrent creation preserve the newer remote file', async () => {
  const { transport } = provider();
  await runWebDav({ config, action: 'write', raw, etag: null }, transport);
  const before = await runWebDav({ config, action: 'read' }, transport);
  const newer = JSON.stringify({ ...wallet, updatedAt: '2026-10-22T01:00:00.000Z' });
  await runWebDav({ config, action: 'write', raw: newer, etag: before.etag }, transport);
  await assert.rejects(runWebDav({ config, action: 'write', raw, etag: before.etag }, transport), /其他设备/);
  await assert.rejects(runWebDav({ config, action: 'write', raw, etag: null }, transport), /其他设备/);
  assert.equal((await runWebDav({ config, action: 'read' }, transport)).raw, newer);
});

test('encrypted envelopes remain opaque and decrypt on another client', async () => {
  const { transport } = provider();
  const { envelope } = await createEncryption(wallet, 'a-test-encryption-password');
  const encrypted = JSON.stringify(envelope);
  await runWebDav({ config, action: 'write', raw: encrypted, etag: null }, transport);
  const pulled = await runWebDav({ config, action: 'read' }, transport);
  assert.equal(pulled.raw, encrypted);
  assert.deepEqual((await decryptWallet(JSON.parse(pulled.raw!), 'a-test-encryption-password')).wallet, wallet);
  assert.ok(!pulled.raw!.includes(config.password));
});

test('invalid backups and unsupported versions never reach PUT', async () => {
  let calls = 0;
  const transport: DavTransport = async () => { calls++; return { status: 200, etag: null, body: raw }; };
  for (const invalid of ['<html>login</html>', '{}', JSON.stringify({ ...wallet, version: 9 }), JSON.stringify({ format: 'mrgcard-encrypted' })]) {
    await assert.rejects(runWebDav({ config, action: 'write', raw: invalid, etag: null }, transport));
  }
  await assert.rejects(runWebDav({ config, action: 'write', raw }, transport), /缺少远程文件版本/);
  assert.equal(calls, 0);
  assert.throws(() => validateDavBackup(' '.repeat(MAX_BACKUP_BYTES + 1)), /12 MB/);
});

test('readback detects a provider that did not persist the uploaded bytes', async () => {
  const transport: DavTransport = async request => ({ status: request.method === 'PUT' ? 201 : 200, etag: '"x"', body: JSON.stringify({ ...wallet, updatedAt: '2026-01-01T00:00:00Z' }) });
  await assert.rejects(runWebDav({ config, action: 'write', raw, etag: null }, transport), /校验不一致/);
});

test('provider errors and redirects become actionable errors without exposing response bodies', async () => {
  for (const status of [301, 401, 403, 409, 412, 423, 429, 500, 507]) {
    await assert.rejects(runWebDav({ config, action: 'write', raw, etag: null }, async () => ({ status, etag: null, body: 'private upstream diagnostic' })), error => error instanceof Error && !error.message.includes('private upstream'));
  }
  await assert.rejects(runWebDav({ config, action: 'test' }, async () => ({ status: 200, etag: null, body: '<html>login</html>' })), /WebDAV 响应/);
  const result = await runWebDav({ config, action: 'read' }, async request => ({ status: request.method === 'PROPFIND' ? 207 : 200, etag: 'W/"weak"', body: request.method === 'PROPFIND' ? '' : raw }));
  assert.equal(result.etag, null);
});

const fileUrl = 'https://dav.example.com/dav/Folio_Backup/folio-wallet.json';
function metadata(etag = '&quot;dav-v1&quot;', status = 'HTTP/1.1 200 OK', href = '/dav/Folio_Backup/folio-wallet.json') {
  return `<d:multistatus xmlns:d="DAV:"><d:response><d:href>${href}</d:href><d:propstat><d:prop><d:getetag>${etag}</d:getetag></d:prop><d:status>${status}</d:status></d:propstat></d:response></d:multistatus>`;
}

test('WebDAV metadata selects the original file and ignores weak, failed, or unsafe XML properties', () => {
  assert.equal(davMetadataEtag(metadata(), fileUrl), '"dav-v1"');
  assert.equal(davMetadataEtag(metadata('&#34;v1&#34;'), fileUrl), '"v1"');
  for (const xml of [metadata('W/&quot;weak&quot;'), metadata(undefined, 'HTTP/1.1 404 Not Found'), metadata(undefined, undefined, '/other.json'), '<bad>', '<!DOCTYPE a [<!ENTITY e "value">]>' + metadata(), metadata().repeat(1000)]) {
    assert.equal(davMetadataEtag(xml, fileUrl), null);
  }
});

test('redirected reads keep the WebDAV ETag, detect concurrent changes and do not treat missing download links as absent backups', async () => {
  let metadataReads = 0;
  const transport: DavTransport = async request => request.method === 'PROPFIND'
    ? (metadataReads++, {status:207, etag:null, body:metadata()})
    : {status:200, body:raw, etag:'"storage-etag"', redirected:true};
  const result = await runWebDav({config,action:'read'},transport);
  assert.equal(result.etag,'"dav-v1"');
  assert.equal(metadataReads,2);
  let reads = 0;
  await assert.rejects(runWebDav({config,action:'read'},async request => request.method === 'PROPFIND'
    ? {status:207, etag:null, body:metadata(`&quot;v${reads++}&quot;`)}
    : {status:200, body:raw, etag:'"storage-etag"', redirected:true}), /已改变/);
  await assert.rejects(runWebDav({config,action:'read'},async request => request.method === 'PROPFIND'
    ? {status:207, etag:null, body:metadata()}
    : {status:404, body:'', etag:null, redirected:true}), /不存在/);
});

test('redirect policy allows signed HTTPS downloads but rejects cross-site writes and unsafe targets', () => {
  assert.equal(davRedirectTarget(fileUrl,'https://download.example.com/file?sign=test','GET',302).hostname,'download.example.com');
  assert.equal(davRedirectTarget(fileUrl,'../canonical/','PROPFIND',301).pathname,'/dav/canonical/');
  for (const method of ['PUT','MKCOL','PROPFIND'] as const) {
    assert.throws(()=>davRedirectTarget(fileUrl,'https://download.example.com/file',method,307),/重定向/);
    assert.throws(()=>davRedirectTarget(fileUrl,'/other',method,303),/重定向/);
  }
  for (const target of ['http://download.example.com/file','https://user:pass@download.example.com/file','', '#fragment']) {
    assert.throws(()=>davRedirectTarget(fileUrl,target,'GET',302));
  }
});

test('bounded reads reject oversized Content-Length and chunked bodies', async () => {
  assert.equal(await boundedText(new Response(raw), 1000), raw);
  await assert.rejects(boundedText(new Response('x', { headers: { 'Content-Length': '1001' } }), 1000), /大小限制/);
  let cancelled = false;
  const stream = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1001)); }, cancel() { cancelled = true; } });
  await assert.rejects(boundedText(new Response(stream), 1000), /大小限制/);
  assert.equal(cancelled, true);
});
