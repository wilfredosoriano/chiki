/**
 * Chiki icon generator
 * Produces icon.png, adaptive-icon.png and splash-icon.png in /assets
 *
 * Run with:  node scripts/generate-icon.js
 * Requires only built-in Node.js modules (zlib, fs, path, crypto).
 */

const zlib = require('zlib');
const fs = require('fs');
const path = require('path');

// ─── CRC-32 ────────────────────────────────────────────────────────────────

const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c;
}
function crc32(data) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) crc = CRC_TABLE[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ─── PNG encoder (RGBA) ───────────────────────────────────────────────────

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n >>> 0);
  return b;
}
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.concat([t, data]);
  return Buffer.concat([u32be(data.length), t, data, u32be(crc32(crcBuf))]);
}

/** Encode a Uint8Array of RGBA pixels as a PNG. */
function encodePNG(w, h, rgba) {
  const sig = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  const ihdrData = Buffer.concat([u32be(w), u32be(h), Buffer.from([8, 6, 0, 0, 0])]);
  const ihdr = pngChunk('IHDR', ihdrData);
  // Raw image data: filter byte 0 + row pixels
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0;
    for (let x = 0; x < w; x++) {
      const pi = (y * w + x) * 4;
      raw[y * (1 + w * 4) + 1 + x * 4]     = rgba[pi];
      raw[y * (1 + w * 4) + 1 + x * 4 + 1] = rgba[pi + 1];
      raw[y * (1 + w * 4) + 1 + x * 4 + 2] = rgba[pi + 2];
      raw[y * (1 + w * 4) + 1 + x * 4 + 3] = rgba[pi + 3];
    }
  }
  const idat = pngChunk('IDAT', zlib.deflateSync(raw, { level: 9 }));
  const iend = pngChunk('IEND', Buffer.alloc(0));
  return Buffer.concat([sig, ihdr, idat, iend]);
}

// ─── Math helpers ─────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * Math.max(0, Math.min(1, t)); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ─── ₱ symbol renderer ────────────────────────────────────────────────────

/**
 * Returns true if (px, py) is inside the ₱ symbol.
 * ox, oy: top-left origin of the character bounding box.
 * s: scale factor (pixels per unit).
 *
 * The symbol occupies units:
 *   width  0 .. 7  (bars extend –1 .. 6)
 *   height 0 .. 12
 */
function inPeso(px, py, ox, oy, s) {
  const rx = px - ox;  // relative x from character origin
  const ry = py - oy;  // relative y

  // 1. Vertical stem: 0 ≤ rx < 1.5s, 0 ≤ ry < 12s
  if (rx >= 0 && rx < 1.5 * s && ry >= 0 && ry < 12 * s) return true;

  // 2. Right arch (half-annulus): only right of stem, top 7 units
  if (rx >= 0 && ry >= 0 && ry <= 7 * s) {
    const dx = rx / s - 1.5;
    const dy = ry / s - 3.5;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (dx >= 0 && d >= 2 && d <= 3.5) return true;
  }

  // 3. Horizontal bars (cross the full width)
  const barL = -1 * s, barR = 6 * s;
  if (rx >= barL && rx <= barR) {
    if (ry >= 4.5 * s && ry <= 5.2 * s) return true;
    if (ry >= 5.8 * s && ry <= 6.5 * s) return true;
  }

  return false;
}

// ─── Icon designs ─────────────────────────────────────────────────────────

// Gradient palette: indigo-700 → violet-600
const BG1 = [67, 56, 202];   // #4338CA
const BG2 = [124, 58, 237];  // #7C3AED

function bgColor(x, y, size) {
  const t = (x + y) / (size * 2);
  return [lerp(BG1[0], BG2[0], t), lerp(BG1[1], BG2[1], t), lerp(BG1[2], BG2[2], t)];
}

/**
 * Full app icon:
 * Gradient background → white disc → indigo ₱ symbol.
 */
function generateMainIcon(size) {
  const cx = size / 2, cy = size / 2;
  const rgba = new Uint8Array(size * size * 4);

  const circleR = size * 0.40;
  const edgeSoft = Math.max(2, size * 0.004);

  // Symbol scale: bars span –1s..6s (7s total), centered on circle
  const s = size * 0.043;
  const ox = cx - 2.5 * s;   // center bars on cx
  const oy = cy - 6 * s;     // center char vertically on cy

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      let [r, g, b] = bgColor(x, y, size);
      let a = 255;

      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < circleR + edgeSoft) {
        const ca = clamp((circleR - dist) / edgeSoft, 0, 1);
        // Blend background → white
        r = Math.round(lerp(r, 255, ca));
        g = Math.round(lerp(g, 255, ca));
        b = Math.round(lerp(b, 255, ca));

        // Draw ₱ symbol in gradient indigo over the white disc
        if (ca > 0.5 && inPeso(x, y, ox, oy, s)) {
          const [sr, sg, sb] = bgColor(x, y, size);
          r = Math.round(lerp(r, sr, ca));
          g = Math.round(lerp(g, sg, ca));
          b = Math.round(lerp(b, sb, ca));
        }
      }

      rgba[i] = r; rgba[i + 1] = g; rgba[i + 2] = b; rgba[i + 3] = a;
    }
  }
  return rgba;
}

/**
 * Adaptive icon foreground:
 * White ₱ symbol on transparent background.
 * Android applies its own background colour from app.config.ts.
 */
function generateAdaptiveIcon(size) {
  const cx = size / 2, cy = size / 2;
  const rgba = new Uint8Array(size * size * 4);

  const s = size * 0.043;
  const ox = cx - 2.5 * s;
  const oy = cy - 6 * s;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (inPeso(x, y, ox, oy, s)) {
        rgba[i] = 255; rgba[i + 1] = 255; rgba[i + 2] = 255; rgba[i + 3] = 255;
      } else {
        rgba[i] = 0; rgba[i + 1] = 0; rgba[i + 2] = 0; rgba[i + 3] = 0;
      }
    }
  }
  return rgba;
}

// ─── Main ──────────────────────────────────────────────────────────────────

const ASSETS = path.join(__dirname, '..', 'assets');

console.log('🎨  Generating Chiki icons…\n');

const SIZE = 1024;
const main = generateMainIcon(SIZE);
const adaptive = generateAdaptiveIcon(SIZE);

fs.writeFileSync(path.join(ASSETS, 'icon.png'), encodePNG(SIZE, SIZE, main));
console.log('✓  assets/icon.png');

fs.writeFileSync(path.join(ASSETS, 'adaptive-icon.png'), encodePNG(SIZE, SIZE, adaptive));
console.log('✓  assets/adaptive-icon.png');

fs.writeFileSync(path.join(ASSETS, 'splash-icon.png'), encodePNG(SIZE, SIZE, main));
console.log('✓  assets/splash-icon.png');

console.log('\n✅  Done!  Restart Expo to pick up the new icons.');
