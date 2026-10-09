#!/usr/bin/env node
/**
 * Generates the ClinNote app icons (original artwork, MIT like the rest of the project).
 * Replaces the Expo template icons, which show Expo's own logo.
 *
 *   node mobile/scripts/generate-icons.js
 *
 * Motif: a white note page with a folded corner, a pulse line and two text lines, on a teal field.
 * Rendered with 4x4 supersampling into mobile/assets/ using pngjs (already a transitive dependency).
 */
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const TEAL_DARK = [15, 118, 110];
const TEAL_LIGHT = [20, 184, 166];
const SS = 4;

// Glyph geometry in a unit square (0..1), y down.
const PAGE = { x0: 0.2, y0: 0.1, x1: 0.8, y1: 0.9, r: 0.07, fold: 0.17 };
const PULSE = [[0.27, 0.46], [0.38, 0.46], [0.44, 0.33], [0.52, 0.6], [0.58, 0.4], [0.62, 0.46], [0.73, 0.46]];
const LINES = [[0.3, 0.68, 0.7], [0.3, 0.78, 0.56]];
const STROKE = 0.035;

function segDist(px, py, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}

function inRoundRect(x, y, { x0, y0, x1, y1, r }) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.max(x0 + r, Math.min(x1 - r, x)), cy = Math.max(y0 + r, Math.min(y1 - r, y));
  return Math.hypot(x - cx, y - cy) <= r;
}

/** 'page' | 'ink' (pulse/lines over the page) | 'fold' | null */
function glyph(x, y) {
  const p = PAGE;
  if (!inRoundRect(x, y, p)) return null;
  const fx = p.x1 - p.fold, fy = p.y0 + p.fold;
  if (x > fx && y < fy) {
    if (x - fx > y - p.y0) return null; // cut corner
    return 'fold';
  }
  for (let i = 0; i < PULSE.length - 1; i++) if (segDist(x, y, PULSE[i], PULSE[i + 1]) <= STROKE) return 'ink';
  for (const [a, ly, b] of LINES) if (segDist(x, y, [a, ly], [b, ly]) <= STROKE * 0.85) return 'ink';
  return 'page';
}

const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

function bgColor(u, v) {
  return mix(TEAL_LIGHT, TEAL_DARK, Math.min(1, (u + v) / 2));
}

/**
 * mode: 'full' (opaque icon), 'foreground' (glyph only), 'background' (field only), 'mono' (white glyph, ink cut out)
 * scale: glyph size as a fraction of the canvas.
 */
function render(size, mode, scale, rounded = false) {
  const png = new PNG({ width: size, height: size });
  const off = (1 - scale) / 2;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const u = (px + (sx + 0.5) / SS) / size, v = (py + (sy + 0.5) / SS) / size;
          let col = null;
          if (mode === 'full' || mode === 'background') {
            if (!rounded || inRoundRect(u, v, { x0: 0, y0: 0, x1: 1, y1: 1, r: 0.22 })) col = bgColor(u, v);
          }
          if (mode !== 'background') {
            const k = glyph((u - off) / scale, (v - off) / scale);
            if (mode === 'mono') {
              if (k === 'page' || k === 'fold') col = [255, 255, 255];
            } else if (k === 'page') col = [255, 255, 255];
            else if (k === 'fold') col = [204, 240, 235];
            else if (k === 'ink') col = TEAL_DARK;
          }
          if (col) { r += col[0]; g += col[1]; b += col[2]; a += 1; }
        }
      }
      const i = (py * size + px) * 4;
      if (a) { png.data[i] = r / a; png.data[i + 1] = g / a; png.data[i + 2] = b / a; }
      png.data[i + 3] = Math.round((255 * a) / (SS * SS));
    }
  }
  return PNG.sync.write(png);
}

const out = path.join(__dirname, '..', 'assets');
const files = {
  'icon.png': render(1024, 'full', 0.62),
  'android-icon-background.png': render(512, 'background', 1),
  // Adaptive icons: keep the glyph inside the 66% safe zone.
  'android-icon-foreground.png': render(512, 'foreground', 0.5),
  'android-icon-monochrome.png': render(432, 'mono', 0.5),
  'splash-icon.png': render(1024, 'full', 0.62, true),
  'favicon.png': render(48, 'full', 0.7, true),
};
for (const [name, buf] of Object.entries(files)) {
  fs.writeFileSync(path.join(out, name), buf);
  console.log(`${name} ${buf.length} bytes`);
}
