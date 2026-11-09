#!/usr/bin/env node
/** Generates Android launcher icons, the Android TV banner and splash screens from public/icons/icon.svg. */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const RES = path.join(ROOT, 'android/app/src/main/res');
const icon = fs.readFileSync(path.join(ROOT, 'public/icons/icon.svg'));
const star = `<g fill="none" stroke="url(#o)" stroke-width="7" stroke-linejoin="round"><rect x="-58" y="-58" width="116" height="116"/><rect x="-58" y="-58" width="116" height="116" transform="rotate(45)"/></g><circle r="23" fill="url(#o)"/>`;
const defs = `<defs><radialGradient id="g" cx="40%" cy="30%" r="90%"><stop offset="0" stop-color="#0f3326"/><stop offset="1" stop-color="#04110d"/></radialGradient><linearGradient id="o" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d99b"/><stop offset="1" stop-color="#b98d3f"/></linearGradient></defs>`;

const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
for (const [d, k] of Object.entries(densities)) {
  const dir = path.join(RES, `mipmap-${d}`);
  fs.mkdirSync(dir, { recursive: true });
  await sharp(icon).resize(Math.round(48 * k)).png().toFile(path.join(dir, 'ic_launcher.png'));
  await sharp(icon).resize(Math.round(48 * k)).png().toFile(path.join(dir, 'ic_launcher_round.png'));
  // adaptive foreground: 108dp canvas, art inside the 66dp safe zone
  const fg = Math.round(108 * k);
  const fgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${fg}" height="${fg}" viewBox="-180 -180 360 360">${defs}<g transform="scale(0.95)">${star}</g></svg>`;
  await sharp(Buffer.from(fgSvg)).png().toFile(path.join(dir, 'ic_launcher_foreground.png'));
}
fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#04110D</color>\n</resources>\n`);

// Android TV banner 320×180 (xhdpi)
const banner = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360">${defs}<rect width="640" height="360" fill="url(#g)"/><g transform="translate(150 180) scale(0.95)">${star}</g><text x="250" y="178" font-family="Georgia, 'Times New Roman', serif" font-size="74" fill="#f6f1e4">Sakina</text><text x="252" y="228" font-family="Segoe UI, Arial, sans-serif" font-size="25" letter-spacing="6" fill="#e8c77d">ÉCRAN DE PRIÈRE</text></svg>`;
fs.mkdirSync(path.join(RES, 'drawable-xhdpi'), { recursive: true });
await sharp(Buffer.from(banner)).resize(320, 180).png().toFile(path.join(RES, 'drawable-xhdpi/banner.png'));
await sharp(Buffer.from(banner)).resize(640, 360).png().toFile(path.join(RES, 'drawable/banner_large.png'));

// Splash screens (dark, centred star)
for (const dir of fs.readdirSync(RES).filter((d) => d.startsWith('drawable'))) {
  const f = path.join(RES, dir, 'splash.png');
  if (!fs.existsSync(f)) continue;
  const { width, height } = await sharp(f).metadata();
  const s = Math.min(width, height) * 0.22;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${defs}<rect width="100%" height="100%" fill="#04110d"/><g transform="translate(${width / 2} ${height / 2}) scale(${s / 130})">${star}</g></svg>`;
  await sharp(Buffer.from(svg)).png().toFile(f + '.tmp');
  fs.renameSync(f + '.tmp', f);
}
console.log('✓ Android assets generated');
