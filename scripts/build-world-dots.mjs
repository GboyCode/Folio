import { readFile, writeFile } from 'node:fs/promises';
import sharp from 'sharp';

// Sample the existing, locally bundled coastline on the same grid as its SVG dots.
const source = await readFile(new URL('../public/world-map.svg', import.meta.url), 'utf8');
const land = source.match(/<g fill="#f5f5f6"[^>]*>(.*?)<\/g>/s)?.[1];
if (!land) throw new Error('World map coastline group is missing');
const mask = `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="450"><g fill="white">${land}</g></svg>`;
const { data, info } = await sharp(Buffer.from(mask)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const points = [];
for (let y = 17; y < 407; y += 5) {
  for (let x = 2; x < 1000; x += 5) {
    if (data[(y * info.width + x) * info.channels + 3] > 127) points.push([x, y]);
  }
}
await writeFile(new URL('../src/world-dots.json', import.meta.url), JSON.stringify(points));
console.log(`Generated ${points.length} land dots from the bundled coastline.`);
