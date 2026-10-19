import test from 'node:test';
import assert from 'node:assert/strict';
import { blankEntry } from '../src/types.ts';
import { validateWallet, createEncryption, decryptWallet, encryptWallet, mergeWallets } from '../src/storage.ts';
import { MAX_MAP_URL_LENGTH } from '../src/validation.ts';
const wallet = () => ({version:1 as const,updatedAt:new Date().toISOString(),entries:[{...blankEntry(),id:'test-card',name:'测试银行卡',country:'中国香港',number:'1234'}]});

test('validates supported records and discards unknown fields',()=>{
  const source=wallet();
  assert.deepEqual(validateWallet({...source,unknown:'discard'}),source);
  for(const type of ['bank','crypto','sim','address'])assert.equal(validateWallet({...source,entries:[{...source.entries[0],type}]}).entries[0].type,type);
});
test('rejects corrupt backups, duplicate IDs and active image payloads',()=>{
  const source=wallet();
  assert.throws(()=>validateWallet({...source,version:2}));
  assert.throws(()=>validateWallet({...source,entries:[source.entries[0],source.entries[0]]}));
  for(const patch of [{type:'other'},{name:''},{customImage:'data:image/svg+xml;base64,PHN2Zz4='},{color:'url(https://example.com)'},{createdAt:'bad-date'},{notes:'x'.repeat(5001)}])assert.throws(()=>validateWallet({...source,entries:[{...source.entries[0],...patch}]}));
});
test('encrypted backup round trip, wrong password, tamper detection and fresh IVs',async()=>{
  const source=wallet();
  source.entries.push({...blankEntry('address'),id:'test-address',name:'地图位置',country:'美国',line1:'123 Example Avenue',mapUrl:'https://maps.app.goo.gl/ExampleLocation'});
  const {key,envelope}=await createEncryption(source,'A-long-test-password');
  assert.ok(!JSON.stringify(envelope).includes(source.entries[0].name));
  const result=await decryptWallet(envelope,'A-long-test-password');
  assert.deepEqual(result.wallet,source);
  await assert.rejects(decryptWallet(envelope,'wrong-password'));
  const tampered={...envelope,data:(envelope.data[0]==='A'?'B':'A')+envelope.data.slice(1)};
  await assert.rejects(decryptWallet(tampered,'A-long-test-password'));
  assert.notEqual((await encryptWallet(source,key,envelope.salt)).iv,envelope.iv);
});
test('merge preserves existing data and adds only new IDs',()=>{
  const source=wallet();
  const imported=wallet();
  imported.entries[0].name='should not overwrite';
  imported.entries.push({...imported.entries[0],id:'new-card'});
  const result=mergeWallets(source,imported);
  assert.equal(result.entries.length,2);
  assert.equal(result.entries[0].name,'测试银行卡');
  assert.equal(result.entries[1].id,'new-card');
});

test('address map links survive JSON backup and merge while old records remain compatible',()=>{
  const source=wallet();
  const address={...blankEntry('address'),id:'map-address',name:'地图位置',country:'美国',line1:'123 Example Avenue'};
  for(const mapUrl of ['https://maps.app.goo.gl/ExampleLocation','https://www.google.com/maps/search/?api=1&query=25.0330%2C121.5654','http://example.com/location']){
    const imported=validateWallet(JSON.parse(JSON.stringify({...source,entries:[{...address,mapUrl}]})));
    assert.equal(imported.entries[0].mapUrl,mapUrl);
    assert.equal(mergeWallets(source,imported).entries.find(entry=>entry.id===address.id)?.mapUrl,mapUrl);
  }
  const {mapUrl,...legacy}=address;
  assert.equal(validateWallet({...source,entries:[legacy]}).entries[0].mapUrl,'');
  assert.equal(validateWallet({...source,entries:[{...address,mapUrl:'   '}]}).entries[0].mapUrl,'');
  assert.equal(validateWallet({...source,entries:[{...address,mapUrl:' https://example.com/location '}]}).entries[0].mapUrl,'https://example.com/location');
});

test('map links reject unsupported protocols and malformed or oversized values',()=>{
  const source=wallet();
  const address={...blankEntry('address'),id:'map-address',name:'地图位置',country:'美国',line1:'123 Example Avenue'};
  for(const mapUrl of ['javascript:alert(1)','data:text/html,test','file:///test','//example.com/map','https://','https:example.com','not a URL',123,'https://example.com/'+ 'a'.repeat(MAX_MAP_URL_LENGTH)]){
    assert.throws(()=>validateWallet({...source,entries:[{...address,mapUrl}]}));
  }
  const longUrl='https://www.google.com/maps/search/?query='+ 'a'.repeat(1000);
  assert.equal(validateWallet({...source,entries:[{...address,mapUrl:longUrl}]}).entries[0].mapUrl,longUrl);
});
