import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchArtworks } from '../src/artwork-search.ts';
import type { Artwork } from '../src/types.ts';

const catalog = JSON.parse(readFileSync(new URL('../src/catalog.json', import.meta.url), 'utf8')) as Artwork[];

test('new SAVO artwork is searchable across the full catalog', () => {
  assert.equal(searchArtworks(catalog, '').length, catalog.length);
  assert.deepEqual(searchArtworks(catalog, '  ＳＡＶＯ  ').map(art => art.id), ['savo', 'savo-platinum-purple', 'savo-nova-ii-green']);
  assert.equal(searchArtworks(catalog, 'savo')[0].type, 'crypto');
});

test('one-character brand typos fall back to SAVO without broad fuzzy matches', () => {
  assert.deepEqual(searchArtworks(catalog, 'savoi').map(art => art.id), ['savo', 'savo-platinum-purple', 'savo-nova-ii-green']);
  assert.equal(searchArtworks(catalog, 'savooi').length, 0);
  assert.equal(searchArtworks(catalog, 'unrelated-brand').length, 0);
});

test('direct matches take precedence and explicit category filtering stays respected', () => {
  const exact = { ...catalog.find(art => art.id === 'savo')!, id: 'exact-search-test', name: 'Savoi', issuer: 'Savoi' };
  assert.deepEqual(searchArtworks([...catalog, exact], 'savoi').map(art => art.id), ['exact-search-test']);
  assert.equal(searchArtworks(catalog.filter(art => art.type === 'bank'), 'savo').length, 0);
});
