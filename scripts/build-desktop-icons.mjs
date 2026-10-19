import { mkdir, readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const root = new URL('../src-tauri/icons/', import.meta.url);
await mkdir(root, { recursive: true });
const source = await readFile(new URL('../src/assets/folio-icon.svg', import.meta.url));
const sizes = [16, 32, 48, 64, 128, 256];
const images = await Promise.all(sizes.map(size => sharp(source).resize(size, size).ensureAlpha().png().toBuffer()));
await writeFile(new URL('icon.png', root), images.at(-1));
const directory = Buffer.alloc(6 + images.length * 16);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(images.length, 4);
let offset = directory.length;
for (const [index, bytes] of images.entries()) {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index] % 256;
  directory[entry + 1] = sizes[index] % 256;
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(bytes.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += bytes.length;
}
await writeFile(new URL('icon.ico', root), Buffer.concat([directory, ...images]));
console.log('Generated Folio Windows icons.');
