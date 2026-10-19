import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
const script=fileURLToPath(new URL('../scripts/provision-account.mjs',import.meta.url));
test('fresh self-hosted account has a random password, hashed SQL and repeatable initialization',async()=>{
  const cwd=await mkdtemp(join(tmpdir(),'folio-account-'));
  try {
    const run=()=>spawnSync(process.execPath,[script,'--local','--username','example-admin'],{cwd,encoding:'utf8'});
    const first=run();assert.equal(first.status,0,first.stderr);
    const credentials=JSON.parse(await readFile(join(cwd,'.secrets/local-credentials.json'),'utf8'));
    assert.equal(credentials.username,'example-admin');assert.ok(credentials.password.length>=32);
    assert.ok(!first.stdout.includes(credentials.password));
    const sql=await readFile(join(cwd,'.secrets/local-account.sql'),'utf8');
    assert.ok(sql.startsWith('INSERT OR IGNORE'));assert.ok(!sql.includes(credentials.password));
    assert.equal(run().status,0);
    assert.deepEqual(JSON.parse(await readFile(join(cwd,'.secrets/local-credentials.json'),'utf8')),credentials);
    assert.notEqual(spawnSync(process.execPath,[script,'--local','--username',"bad'name"],{cwd}).status,0);
  } finally { await rm(cwd,{recursive:true,force:true}); }
});
