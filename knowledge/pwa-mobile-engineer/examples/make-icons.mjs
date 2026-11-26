// Generates the example PNG icons with no dependencies (Node zlib only).
// Usage: node make-icons.mjs   -> writes app/icons/*.png
// Each icon is an opaque dark-blue square with a lighter "water" disc.
// The maskable icon keeps the disc inside the central safe zone
// (circle of radius 40% of the width, per web.dev/articles/maskable-icon).
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, 'app', 'icons');
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, discRadiusRatio) {
  const bg = [0x0b, 0x1d, 0x2a]; // matches manifest background_color
  const fg = [0x3a, 0xa0, 0xd8];
  const raw = Buffer.alloc((size * 3 + 1) * size);
  const c = size / 2, r = size * discRadiusRatio;
  for (let y = 0; y < size; y++) {
    const row = y * (size * 3 + 1);
    raw[row] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const inside = (x + 0.5 - c) ** 2 + (y + 0.5 - c) ** 2 <= r * r;
      const px = inside ? fg : bg;
      raw.set(px, row + 1 + x * 3);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0; // 8-bit RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0)),
  ]);
}

const icons = [
  ['icon-192.png', 192, 0.42],
  ['icon-512.png', 512, 0.42],
  ['maskable-512.png', 512, 0.30], // well inside the 40% safe-zone radius
  ['apple-touch-icon-180.png', 180, 0.42],
];
for (const [name, size, ratio] of icons) {
  writeFileSync(join(outDir, name), png(size, ratio));
  console.log('wrote', name, `${size}x${size}`);
}
