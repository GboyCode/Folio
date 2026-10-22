import test from 'node:test';
import assert from 'node:assert/strict';
import { createWebDavFixture } from './helpers/webdav-worker.mjs';

test('Worker runtime enforces authentication/origin and relays conditional WebDAV without touching D1 wallet', async () => {
  const fixture = await createWebDavFixture();
  const { mf, call, davConfig: config, requests, db } = fixture;
  try {
    assert.equal((await call({ config, action: 'test' }, { Cookie: '' })).status, 401);
    assert.equal((await call({ config, action: 'test' }, { Origin: 'https://other.example.com' })).status, 403);
    assert.equal(requests.length, 0);
    assert.equal((await call({ config, action: 'test' })).status, 200);
    assert.equal(requests[0].depth, '0');
    const raw = JSON.stringify({ version: 1, entries: [], updatedAt: '2026-10-22T00:00:00Z' });
    assert.equal((await call({ config, action: 'read' })).data.exists, false);
    const uploaded = await call({ config, action: 'write', raw, etag: null });
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.data));
    assert.ok(fixture.folders.has('/dav/Folio_Backup/'));
    assert.ok(fixture.files.has('/dav/Folio_Backup/folio-wallet.json'));
    assert.equal(requests.find(r => r.method === 'PUT').none, '*');
    const read = await call({ config, action: 'read' });
    assert.equal(read.data.raw, raw);
    assert.equal((await call({ config, action: 'write', raw, etag: read.data.etag })).status, 200);
    const stale = await call({ config, action: 'write', raw, etag: read.data.etag });
    assert.equal(stale.status, 400);
    assert.match(stale.data.error, /其他设备/);
    assert.ok(requests.every(r => r.cookie === null));
    const before = requests.length;
    assert.equal((await call({ config: { ...config, url: 'https://127.0.0.1/' }, action: 'test' })).status, 400);
    assert.equal(requests.length, before);
    const redirect = await call({ config: { ...config, url: 'https://dav.example.com/redirect/' }, action: 'read' });
    assert.equal(redirect.status, 400);
    assert.match(redirect.data.error, /重定向/);
    assert.equal(requests.length, before + 1);
    assert.equal((await db.prepare('SELECT revision FROM wallet_state WHERE id=1').first()).revision, 0);
    assert.equal((await db.prepare('SELECT COUNT(*) AS count FROM wallet_chunks').first()).count, 0);
  } finally { await mf.dispose(); }
});

test('Cloudreve-style signed downloads work on read, overwrite and readback without forwarding credentials', async () => {
  const fixture = await createWebDavFixture();
  const {call,davConfig:config,requests,redirects,mf} = fixture;
  const file='https://dav.example.com/dav/Folio_Backup/folio-wallet.json';
  const cdn='https://download.example.com/step?sign=test-only';
  const bounce='https://dav.example.com/signed?sign=test-only';
  const final='https://download.example.com/file?sign=test-only';
  const raw=JSON.stringify({version:1,entries:[],updatedAt:'2026-10-22T00:00:00Z'});
  try {
    assert.equal((await call({config,action:'write',raw,etag:null})).status,200);
    redirects.set('GET '+file,{url:cdn});
    redirects.set('GET '+cdn,{url:bounce,status:307});
    redirects.set('GET '+bounce,{url:final,status:303});
    const before=requests.length;
    const read=await call({config,action:'read'});
    assert.equal(read.status,200,JSON.stringify(read.data));
    assert.equal(read.data.raw,raw);
    assert.equal(read.data.etag,'"v1"');
    const hops=requests.slice(before).filter(r=>r.method==='GET');
    assert.deepEqual(hops.map(r=>r.authorized),[true,false,false,false]);
    assert.ok(hops.every(r=>r.cookie===null));
    const updated=JSON.stringify({version:1,entries:[],updatedAt:'2026-10-22T01:00:00Z'});
    const write=await call({config,action:'write',raw:updated,etag:read.data.etag});
    assert.equal(write.status,200,JSON.stringify(write.data));
    assert.equal(requests.findLast(r=>r.method==='PUT').match,'"v1"');
    assert.equal(fixture.files.get('/dav/Folio_Backup/folio-wallet.json').raw,updated);
    for(const target of ['http://download.example.com/file','https://127.0.0.1/file',file]){
      redirects.set('GET '+file,{url:target});
      const count=requests.length;
      const blocked=await call({config,action:'read'});
      assert.equal(blocked.status,400);
      assert.equal(requests.length,count+2,'only metadata and the original GET may run');
    }
    redirects.set('GET '+file,{url:'https://download.example.com/hop0'});
    for(let i=0;i<6;i++) redirects.set('GET https://download.example.com/hop'+i,{url:'https://download.example.com/hop'+(i+1)});
    const loop=await call({config,action:'read'});
    assert.equal(loop.status,400);
    assert.match(loop.data.error,/重定向次数/);
    redirects.set('PUT '+file,{url:'https://download.example.com/upload',status:307});
    const count=requests.length;
    const blockedWrite=await call({config,action:'write',raw,etag:'"v2"'});
    assert.equal(blockedWrite.status,400);
    assert.match(blockedWrite.data.error,/跨站重定向/);
    assert.ok(requests.slice(count).every(r=>new URL(r.url).hostname==='dav.example.com'));
  } finally {await mf.dispose();}
});
