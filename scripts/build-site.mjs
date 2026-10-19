import { cp, mkdir, readFile, readdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = path.join(root, 'dist-site');
// Only generated output in this checkout is replaced; never touch wallet data.
if (path.dirname(output) !== root || path.basename(output) !== 'dist-site') throw new Error('Unsafe output path');
await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });
await build({ root, mode: 'demo', base: '/demo/', build: { outDir: path.join(output, 'demo') } });
await cp(path.join(root, 'site/public'), output, { recursive: true });

// These shared app assets have stable root-relative URLs in records and CSS.
for (const name of ['cards', 'addresses', 'world-map.svg']) {
  await rename(path.join(output, 'demo', name), path.join(output, name));
}
await rm(path.join(output, 'demo/_headers'));
await rm(path.join(output, 'demo/manifest.webmanifest'));

// Fail the build if the public demo accidentally imports the cloud account adapter.
const assets = path.join(output, 'demo/assets');
for (const name of await readdir(assets)) {
  if (!name.endsWith('.js')) continue;
  const code = await readFile(path.join(assets, name), 'utf8');
  if (code.includes('/api/') || code.includes('serviceWorker.register(')) throw new Error(`Unexpected cloud API or service worker in demo: ${name}`);
}
console.log('Product site and isolated demo ready in dist-site/');
