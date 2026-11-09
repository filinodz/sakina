#!/usr/bin/env node
/**
 * Renders every brand image from real typography (no hand-drawn vectors):
 *   mark: Phosphor Icons "mosque" (MIT) · "Sakina" in Cormorant Garamond · "سكينة" in Reem Kufi
 * through headless Edge/Chrome, then writes:
 *   public/icons/*            PWA icons (+ maskable)
 *   landing/assets/*          favicon / touch icon / og.jpg
 *   android/app/src/main/res  launcher icons, adaptive foreground, Android TV banner, splash screens
 * Usage: node scripts/brand-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const RES = path.join(ROOT, 'android/app/src/main/res');
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const exe = BROWSERS.find((b) => fs.existsSync(b));
if (!exe) throw new Error('Edge or Chrome not found');

const font = (pkg, file) => `url(data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'node_modules', pkg, 'files', file)).toString('base64')}) format('woff2')`;
const CSS = `
@font-face { font-family: Q; src: ${font('@fontsource/amiri-quran', 'amiri-quran-arabic-400-normal.woff2')}; }
@font-face { font-family: C; font-weight: 600; src: ${font('@fontsource/cormorant-garamond', 'cormorant-garamond-latin-600-normal.woff2')}; }
@font-face { font-family: K; font-weight: 600; src: ${font('@fontsource/reem-kufi', 'reem-kufi-arabic-600-normal.woff2')}; }
@font-face { font-family: O; src: url(data:font/woff2;base64,${fs.readFileSync(path.join(ROOT, 'src/assets/ornament.woff2')).toString('base64')}) format('woff2'); }
@font-face { font-family: M; font-weight: 700; src: ${font('@fontsource-variable/manrope', 'manrope-latin-wght-normal.woff2')}; }
* { margin: 0; box-sizing: border-box; }
html, body { background: transparent; }
.bg { background: radial-gradient(120% 90% at 30% 15%, #14402f 0%, #0a2219 45%, #04110d 100%); }
.gold { background: linear-gradient(160deg, #f6e3ad 0%, #e8c77d 42%, #b98d3f 100%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.orn { font-family: O; line-height: 1; }
.c { display: flex; align-items: center; justify-content: center; }
.ring { position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 2px rgba(232,199,125,.22), inset 0 2px 0 rgba(255,255,255,.06); }
`;

const b = await puppeteer.launch({ executablePath: exe, headless: true });
const page = await b.newPage();

async function shot(html, w, h, transparent = false) {
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><style>${CSS}</style></head><body>${html}</body></html>`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  return page.screenshot({ type: 'png', omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
}

// The mark: Phosphor Icons "mosque" (fill, MIT licence) painted with the gold gradient.
const MOSQUE = fs.readFileSync(path.join(ROOT, 'node_modules/@phosphor-icons/core/assets/fill/mosque-fill.svg'), 'utf8');
const GOLD = '<defs><linearGradient id="gd" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e3ad"/><stop offset=".45" stop-color="#e8c77d"/><stop offset="1" stop-color="#b98d3f"/></linearGradient></defs>';
const glyph = (size, dy = -0.03) => MOSQUE
  .replace('<svg', `<svg width="${size}" height="${size}" style="display:block;transform:translateY(${dy * size}px)" fill="url(#gd)"`)
  .replace(/currentColor/g, 'url(#gd)').replace(/(<svg[^>]*>)/, `$1${GOLD}`);

const iconRounded = await shot(`<div class="bg c" style="position:relative;width:1024px;height:1024px;border-radius:230px">${glyph(620)}<div class="ring"></div></div>`, 1024, 1024, true);
const iconSquare = await shot(`<div class="bg c" style="width:1024px;height:1024px">${glyph(500)}</div>`, 1024, 1024);
const iconCircle = await shot(`<div class="bg c" style="position:relative;width:1024px;height:1024px;border-radius:50%">${glyph(560)}<div class="ring"></div></div>`, 1024, 1024, true);
const foreground = await shot(`<div class="c" style="width:1024px;height:1024px">${glyph(470)}</div>`, 1024, 1024, true);
const banner = await shot(`
  <div class="bg c" style="position:relative;width:1280px;height:720px;gap:56px">
    ${glyph(300)}
    <div style="display:flex;flex-direction:column;gap:6px">
      <div style="font-family:C;font-weight:600;font-size:176px;line-height:.9;color:#f6f1e4">Sakina</div>
      <div style="display:flex;align-items:center;gap:26px">
        <span class="gold" style="font-family:K;font-weight:600;font-size:84px;line-height:1.2">سكينة</span>
        <span style="font-family:M;font-weight:700;font-size:30px;letter-spacing:.32em;color:rgba(246,241,228,.6)">PRAYER TIMES</span>
      </div>
    </div>
  </div>`, 1280, 720);

const write = (buf, file, size, fmt = 'png') => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const img = sharp(buf).resize(size, size);
  return (fmt === 'jpg' ? img.jpeg({ quality: 88 }) : img.png()).toFile(file);
};

// PWA + landing
for (const s of [192, 512]) await write(iconRounded, path.join(ROOT, `public/icons/icon-${s}.png`), s);
await write(iconSquare, path.join(ROOT, 'public/icons/icon-maskable-512.png'), 512);
await write(iconRounded, path.join(ROOT, 'landing/assets/icon-192.png'), 192);
await write(iconRounded, path.join(ROOT, 'landing/assets/icon-64.png'), 64);
for (const f of ['public/icons/icon.svg', 'landing/assets/icon.svg']) fs.rmSync(path.join(ROOT, f), { force: true });

// Android launcher icons
if (fs.existsSync(RES)) {
  const dens = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };
  for (const [d, k] of Object.entries(dens)) {
    const dir = path.join(RES, `mipmap-${d}`);
    await write(iconRounded, path.join(dir, 'ic_launcher.png'), Math.round(48 * k));
    await write(iconCircle, path.join(dir, 'ic_launcher_round.png'), Math.round(48 * k));
    await write(foreground, path.join(dir, 'ic_launcher_foreground.png'), Math.round(108 * k));
  }
  fs.writeFileSync(path.join(RES, 'values/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <color name="ic_launcher_background">#0A2219</color>\n</resources>\n');
  await sharp(banner).resize(320, 180).png().toFile(path.join(RES, 'drawable-xhdpi/banner.png'));
  await sharp(banner).resize(640, 360).png().toFile(path.join(RES, 'drawable/banner_large.png'));
  // Splash screens: dark background, centred glyph
  for (const dir of fs.readdirSync(RES).filter((d) => d.startsWith('drawable'))) {
    const f = path.join(RES, dir, 'splash.png');
    if (!fs.existsSync(f)) continue;
    const { width, height } = await sharp(f).metadata();
    const g = Math.round(Math.min(width, height) * 0.26);
    const png = await shot(`<div class="c" style="width:${width}px;height:${height}px;background:#04110d">${glyph(g)}</div>`, width, height);
    fs.writeFileSync(f, png);
  }
}

// Social preview for the landing page (1200×630)
const dash = path.join(ROOT, 'landing/assets/dashboard.webp');
if (fs.existsSync(dash)) {
  const shotB64 = (await sharp(dash).resize(1040).png().toBuffer()).toString('base64');
  const og = await shot(`
    <div class="bg" style="position:relative;width:1200px;height:630px;overflow:hidden">
      <div style="position:absolute;top:34px;left:0;right:0;display:flex;justify-content:center;align-items:center;gap:22px">
        ${glyph(58, -0.02)}
        <span style="font-family:C;font-weight:600;font-size:60px;color:#f6f1e4;line-height:1">Sakina</span>
        <span class="gold" style="font-family:K;font-weight:600;font-size:44px;line-height:1.3">سكينة</span>
      </div>
      <img src="data:image/png;base64,${shotB64}" style="position:absolute;left:80px;top:126px;width:1040px;border-radius:18px;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 1px rgba(232,199,125,.25)">
    </div>`, 1200, 630);
  await sharp(og).jpeg({ quality: 86 }).toFile(path.join(ROOT, 'landing/assets/og.jpg'));
}

await b.close();
console.log('✓ brand assets rendered');
