// 외부 의존성 없이 PWA 아이콘 PNG 생성 (말풍선 안의 V)
import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const outDir = fileURLToPath(new URL('../public/icons/', import.meta.url));
mkdirSync(outDir, { recursive: true });

const CRC = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const stride = size * 3 + 1;
  const raw = Buffer.alloc(stride * size);
  for (let y = 0; y < size; y++) {
    raw[y * stride] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * stride + 1 + x * 3;
      raw[o] = r;
      raw[o + 1] = g;
      raw[o + 2] = b;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const BG = [79, 70, 229];
const WHITE = [255, 255, 255];
function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function sign(p, a, b) {
  return (p[0] - b[0]) * (a[1] - b[1]) - (a[0] - b[0]) * (p[1] - b[1]);
}
function inTri(p, a, b, c) {
  const d1 = sign(p, a, b);
  const d2 = sign(p, b, c);
  const d3 = sign(p, c, a);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}
function shade(u, v, k) {
  const cx = 0.5;
  const cy = 0.46;
  const r = 0.33 * k;
  const tail = inTri([u, v], [cx - 0.16 * k, cy + 0.26 * k], [cx - 0.02 * k, cy + 0.3 * k], [cx - 0.2 * k, cy + 0.42 * k]);
  if (!(Math.hypot(u - cx, v - cy) <= r || tail)) return BG;
  const w = 0.055 * k;
  const ax = cx - 0.17 * k;
  const ay = cy - 0.15 * k;
  const bx = cx;
  const by = cy + 0.17 * k;
  const cxx = cx + 0.17 * k;
  const inV = segDist(u, v, ax, ay, bx, by) <= w || segDist(u, v, cxx, ay, bx, by) <= w;
  return inV ? BG : WHITE;
}
function render(size, k) {
  return png(size, (x, y) => {
    let r = 0;
    let g = 0;
    let b = 0;
    for (let sy = 0; sy < 3; sy++) {
      for (let sx = 0; sx < 3; sx++) {
        const c = shade((x + (sx + 0.5) / 3) / size, (y + (sy + 0.5) / 3) / size, k);
        r += c[0];
        g += c[1];
        b += c[2];
      }
    }
    return [Math.round(r / 9), Math.round(g / 9), Math.round(b / 9)];
  });
}
writeFileSync(outDir + 'icon-192.png', render(192, 1));
writeFileSync(outDir + 'icon-512.png', render(512, 1));
writeFileSync(outDir + 'maskable-512.png', render(512, 0.8));
console.log('아이콘 생성 완료:', outDir);
