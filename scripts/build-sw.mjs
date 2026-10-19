import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
const root = path.resolve('dist');
async function walk(dir) {
  const found = [];
  for (const entry of await readdir(dir,{withFileTypes:true})) {
    const target=path.join(dir,entry.name);
    if(entry.isDirectory()) found.push(...await walk(target));
    else if(!['sw.js','_headers','_redirects','.assetsignore'].includes(entry.name)) found.push(target);
  }
  return found;
}
const files=(await walk(root)).sort();
const hash=createHash('sha256');
for(const file of files) hash.update(await readFile(file));
const cache='mrgcard-static-'+hash.digest('hex').slice(0,12);
const urls=files.map(file=>'/'+path.relative(root,file).split(path.sep).join('/'));
await writeFile(path.join(root,'sw.js'),`
const CACHE=${JSON.stringify(cache)};
const FILES=${JSON.stringify(urls)};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('mrgcard-static-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url=new URL(event.request.url);
  if(event.request.method !== 'GET' || url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if(event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }
  // These are immutable same-origin files. Preview hosts may emit Vary: Origin;
  // module requests carry Origin while install-time cache requests do not.
  if(FILES.includes(url.pathname)) event.respondWith(caches.open(CACHE).then(cache => cache.match(url.pathname,{ignoreVary:true})).then(cached => cached || fetch(event.request)));
});
`);
console.log(`Offline cache: ${urls.length} local files (${cache})`);
