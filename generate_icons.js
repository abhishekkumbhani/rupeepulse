// generate_icons.js — Pure Node.js icon generator (zero dependencies)
// Generates icons/icon-16.png, icon-32.png, icon-48.png, icon-128.png
// Design: Deep navy background, ₹ (green) + $ (white) symbols, live dot

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const ICONS_DIR = path.join(__dirname, 'icons');
if (!fs.existsSync(ICONS_DIR)) fs.mkdirSync(ICONS_DIR, { recursive: true });

// ─── Minimal PNG encoder ────────────────────────────────────────────────────
function crc32(buf) {
  let crc = 0xFFFFFFFF;
  const table = crc32.table || (crc32.table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = (c & 1) ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })());
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcBuf = Buffer.concat([typeBytes, data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(crcBuf));
  return Buffer.concat([len, typeBytes, data, crc]);
}

function encodePNG(pixels, width, height) {
  // pixels: Uint8Array of RGBA, row-major
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0); ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB (no alpha needed but we use RGBA in pixels)
  // Actually use RGBA: color type 6
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const raw = [];
  for (let y = 0; y < height; y++) {
    raw.push(0); // filter type None
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      raw.push(pixels[idx], pixels[idx+1], pixels[idx+2], pixels[idx+3]);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(raw), { level: 9 });
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

// ─── Drawing helpers ─────────────────────────────────────────────────────────
function setPixel(buf, width, x, y, r, g, b, a) {
  if (x < 0 || x >= width || y < 0 || y >= width) return;
  const idx = (y * width + x) * 4;
  const sa = a / 255, da = buf[idx + 3] / 255;
  const oa = sa + da * (1 - sa);
  if (oa <= 0) return;
  buf[idx]   = Math.round((r * sa + buf[idx]   * da * (1 - sa)) / oa);
  buf[idx+1] = Math.round((g * sa + buf[idx+1] * da * (1 - sa)) / oa);
  buf[idx+2] = Math.round((b * sa + buf[idx+2] * da * (1 - sa)) / oa);
  buf[idx+3] = Math.round(oa * 255);
}

function fillCircle(buf, width, cx, cy, r, R, G, B, A) {
  for (let y = Math.floor(cy - r) - 1; y <= Math.ceil(cy + r) + 1; y++) {
    for (let x = Math.floor(cx - r) - 1; x <= Math.ceil(cx + r) + 1; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const alpha = Math.max(0, Math.min(1, r - d + 0.5));
      if (alpha > 0) setPixel(buf, width, x, y, R, G, B, Math.round(A * alpha));
    }
  }
}

function drawLine(buf, width, x1, y1, x2, y2, R, G, B, A, thickness) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  const steps = Math.ceil(len * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const cx = x1 + dx * t, cy = y1 + dy * t;
    fillCircle(buf, width, cx, cy, thickness / 2, R, G, B, A);
  }
}

function fillRoundedRect(buf, size, r, R, G, B) {
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Distance to nearest corner arc
      const cx = x < r ? r : x > size - 1 - r ? size - 1 - r : x;
      const cy = y < r ? r : y > size - 1 - r ? size - 1 - r : y;
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      const alpha = Math.max(0, Math.min(1, r - dist + 0.5));
      const inRect = x >= r && x < size - r ? 1 : y >= r && y < size - r ? 1 : 0;
      const inCorner = (x < r || x >= size - r) && (y < r || y >= size - r);
      if ((!inCorner) || alpha > 0) {
        const a = inCorner ? Math.round(255 * alpha) : 255;
        setPixel(buf, size, x, y, R, G, B, a);
      }
    }
  }
}

// ─── Icon renderer ───────────────────────────────────────────────────────────
// Since we can't render text as pixels without a font library,
// we'll pre-render the ₹ and $ as SVG embedded in the icon using
// a different approach: embed each icon as a self-contained SVG file
// and use PowerShell's built-in XAML/WPF renderer to convert to PNG.

// Actually let's use SVG → PNG via a different pure-JS trick:
// Embed the SVG as a data URI in an HTML file and use Puppeteer...
// But we don't have puppeteer either.

// BEST PURE APPROACH: Generate inline SVG icons directly
// Chrome extensions accept SVG as icons since Chrome 40+
// But manifest only supports PNG. So let's write high-quality SVGs and
// convert them with the built-in Windows "rsvg-convert" or "inkscape" if available.

// Let's check what's available and fall back to writing SVG files temporarily.

const { execSync, spawnSync } = require('child_process');

// Generate SVG for each size
function generateSVG(size) {
  const r = Math.round(size * 0.22); // corner radius
  const fontSize1 = Math.round(size * 0.54); // ₹ size
  const fontSize2 = Math.round(size * 0.50); // $ size
  const dotR = Math.round(size * 0.09);
  const dotCx = Math.round(size * 0.80);
  const dotCy = Math.round(size * 0.14);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <clipPath id="rr">
      <rect width="${size}" height="${size}" rx="${r}" ry="${r}"/>
    </clipPath>
  </defs>
  <!-- Background -->
  <rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#0D1117"/>
  <g clip-path="url(#rr)">
    <!-- Subtle sparkline -->
    ${size >= 48 ? `<polyline points="${Math.round(size*0.05)},${Math.round(size*0.78)} ${Math.round(size*0.18)},${Math.round(size*0.72)} ${Math.round(size*0.30)},${Math.round(size*0.75)} ${Math.round(size*0.44)},${Math.round(size*0.62)} ${Math.round(size*0.56)},${Math.round(size*0.65)} ${Math.round(size*0.68)},${Math.round(size*0.52)} ${Math.round(size*0.80)},${Math.round(size*0.55)} ${Math.round(size*0.95)},${Math.round(size*0.44)}" fill="none" stroke="#10B981" stroke-opacity="0.18" stroke-width="${Math.max(1, Math.round(size*0.025))}" stroke-linejoin="round" stroke-linecap="round"/>` : ''}
    <!-- ₹ symbol (green, left-center) -->
    <text x="${size <= 16 ? size*0.5 : size*0.20}" y="${Math.round(size*0.70)}"
      font-family="'Arial','Helvetica Neue',sans-serif"
      font-weight="900"
      font-size="${fontSize1}"
      fill="#10B981"
      text-anchor="${size <= 16 ? 'middle' : 'start'}">₹</text>
    <!-- $ symbol (white, right-center) — only 32px+ -->
    ${size >= 32 ? `<text x="${Math.round(size*0.42)}" y="${Math.round(size*0.68)}"
      font-family="'Arial','Helvetica Neue',sans-serif"
      font-weight="900"
      font-size="${fontSize2}"
      fill="#F8FAFC"
      fill-opacity="0.95"
      text-anchor="start">$</text>` : ''}
    <!-- Live pulse dot (top-right) -->
    ${size >= 32 ? `<circle cx="${dotCx}" cy="${dotCy}" r="${dotR}" fill="#10B981"/>
    <circle cx="${dotCx}" cy="${dotCy}" r="${dotR}" fill="none" stroke="#ffffff" stroke-opacity="0.8" stroke-width="${Math.max(1, Math.round(size*0.025))}"/>` : ''}
  </g>
</svg>`;
}

const sizes = [16, 32, 48, 128];

// Try inkscape first, then rsvg-convert, then fall back to writing SVG
let converter = null;
try { execSync('inkscape --version', { stdio: 'pipe' }); converter = 'inkscape'; } catch(e) {}
try { if (!converter) { execSync('rsvg-convert --version', { stdio: 'pipe' }); converter = 'rsvg'; } } catch(e) {}

if (converter) {
  for (const size of sizes) {
    const svgPath = path.join(ICONS_DIR, `_tmp_icon_${size}.svg`);
    const pngPath = path.join(ICONS_DIR, `icon-${size}.png`);
    fs.writeFileSync(svgPath, generateSVG(size), 'utf8');
    if (converter === 'inkscape') {
      execSync(`inkscape "${svgPath}" --export-png="${pngPath}" --export-width=${size} --export-height=${size}`, { stdio: 'pipe' });
    } else {
      execSync(`rsvg-convert -w ${size} -h ${size} "${svgPath}" -o "${pngPath}"`, { stdio: 'pipe' });
    }
    fs.unlinkSync(svgPath);
    console.log(`✓ Generated icon-${size}.png`);
  }
} else {
  // No SVG converter available — write SVG files and guide user
  for (const size of sizes) {
    const svgPath = path.join(ICONS_DIR, `icon-${size}.svg`);
    fs.writeFileSync(svgPath, generateSVG(size), 'utf8');
    console.log(`✓ Wrote icon-${size}.svg`);
  }
  console.log('\nNo SVG-to-PNG converter found (inkscape/rsvg-convert).');
  console.log('Falling back to PowerShell WPF renderer...');
  process.exit(2); // signal to caller to use WPF fallback
}
