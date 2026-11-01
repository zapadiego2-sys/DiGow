// Genera los íconos de la PWA sin dependencias: un anillo abierto en forma de "C" sobre colors.primary.
import { mkdirSync, writeFileSync } from 'node:fs';
import { encodePng } from './png.mjs';

const PRIMARY = [0x1f, 0x38, 0x64];
const WHITE = [0xff, 0xff, 0xff];
const SAMPLES = 4;

function isInsideGlyph(x, y, outer, inner) {
  const radius = Math.hypot(x, y);
  if (radius > outer || radius < inner) return false;
  const opening = Math.abs(Math.atan2(y, x)) < Math.PI / 4;
  return !opening;
}

function drawIcon(size, scale) {
  const outer = scale / 2;
  const inner = outer * 0.62;
  return encodePng(size, size, (px, py) => {
    let hits = 0;
    for (let sx = 0; sx < SAMPLES; sx++) {
      for (let sy = 0; sy < SAMPLES; sy++) {
        const x = (px + (sx + 0.5) / SAMPLES) / size - 0.5;
        const y = (py + (sy + 0.5) / SAMPLES) / size - 0.5;
        if (isInsideGlyph(x, y, outer, inner)) hits++;
      }
    }
    const coverage = hits / SAMPLES ** 2;
    return PRIMARY.map((value, i) => Math.round(value + (WHITE[i] - value) * coverage));
  });
}

mkdirSync('public/icons', { recursive: true });
writeFileSync('public/icons/icon-192.png', drawIcon(192, 0.62));
writeFileSync('public/icons/icon-512.png', drawIcon(512, 0.62));
// La zona segura de un ícono maskable es el 80 % central.
writeFileSync('public/icons/icon-maskable-512.png', drawIcon(512, 0.48));
writeFileSync('public/icons/apple-touch-icon.png', drawIcon(180, 0.62));
