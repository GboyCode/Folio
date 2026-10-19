import test from 'node:test';
import assert from 'node:assert/strict';
import { applyArtwork } from '../src/artwork-entry.ts';
import { blankEntry, type Artwork } from '../src/types.ts';

const sim: Artwork = { id: 'sim-test', name: 'SIM sample', issuer: 'Carrier', type: 'sim', subtype: '实体 SIM', network: '', region: 'uk', image: '/cards/sim-test.png', color: '#123456', source: 'https://example.com/image', providerSource: 'https://example.com', collectedAt: '2026-10-17' };

test('selecting physical SIM artwork fills SIM type and carrier instead of payment fields', () => {
  const result = applyArtwork(blankEntry(), sim);
  assert.equal(result.type, 'sim');
  assert.equal(result.simType, '实体 SIM');
  assert.equal(result.issuer, 'Carrier');
  assert.equal(result.network, '');
  assert.equal(result.country, '英国');
});

test('changing SIM artwork preserves personal fields and replaces custom artwork', () => {
  const entry = { ...blankEntry('sim'), name: 'My number', phone: '+447700900123', country: '中国香港', plan: 'My plan', customImage: 'data:image/png;base64,AA' };
  const result = applyArtwork(entry, { ...sim, subtype: 'eSIM' });
  assert.equal(result.name, entry.name);
  assert.equal(result.phone, entry.phone);
  assert.equal(result.country, entry.country);
  assert.equal(result.plan, entry.plan);
  assert.equal(result.artId, sim.id);
  assert.equal(result.customImage, '');
  assert.equal(result.simType, 'eSIM');
});

test('payment artwork still switches category and fills the card network', () => {
  const result = applyArtwork(blankEntry(), { ...sim, type: 'crypto', subtype: '虚拟卡', network: 'Visa' });
  assert.equal(result.type, 'crypto');
  assert.equal(result.network, 'Visa');
  assert.equal(result.subtype, '虚拟卡');
});
