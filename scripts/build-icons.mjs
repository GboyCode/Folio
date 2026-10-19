import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import sharp from 'sharp';

// Keep the favicon and installable app icons in sync with the vector brand mark.
const source = await readFile(new URL('../src/assets/folio-icon.svg', import.meta.url));
const output = name => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
await writeFile(output('icon.svg'), source);
for (const size of [192, 512]) {
  await sharp(source).resize(size, size).png().toFile(output(`icon-${size}.png`));
}
await sharp(source).resize(180, 180).flatten({background:'#242426'}).png().toFile(output('apple-touch-icon.png'));
const inset = await sharp(source).resize(416, 416).png().toBuffer();
await sharp({create:{width:512,height:512,channels:4,background:'#242426'}})
  .composite([{input:inset,left:48,top:48}]).png().toFile(output('icon-maskable-512.png'));

const sizes = [16, 32, 48];
const images = await Promise.all(sizes.map(size => sharp(source).resize(size, size).png().toBuffer()));
await writeFile(output('favicon-32.png'), images[1]);
const directory = Buffer.alloc(6 + 16 * images.length);
directory.writeUInt16LE(1, 2);
directory.writeUInt16LE(images.length, 4);
let offset = directory.length;
images.forEach((png, index) => {
  const entry = 6 + index * 16;
  directory[entry] = sizes[index];
  directory[entry + 1] = sizes[index];
  directory.writeUInt16LE(1, entry + 4);
  directory.writeUInt16LE(32, entry + 6);
  directory.writeUInt32LE(png.length, entry + 8);
  directory.writeUInt32LE(offset, entry + 12);
  offset += png.length;
});
await writeFile(output('favicon.ico'), Buffer.concat([directory, ...images]));
console.log('Updated Folio SVG, favicon, Apple and PWA icons.');
