#!/usr/bin/env node
/**
 * Captures showcase screenshots of the running dev server (npm run dev) with headless Edge/Chrome
 * and writes optimised WebP files to landing/assets/. Usage: node scripts/screenshots.mjs [baseUrl]
 */
import puppeteer from 'puppeteer-core';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const BASE = process.argv[2] || 'http://localhost:5173/';
const OUT = path.join(ROOT, 'landing/assets');
const BROWSERS = [
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
const browser = BROWSERS.find((b) => fs.existsSync(b));
if (!browser) throw new Error('Edge or Chrome not found');

const SHOTS = [
  ['dashboard', 1920, 1080, 'demo&at=10:41:20&bg=blue-mosque-dusk'],
  ['portrait', 1080, 1920, 'demo&at=16:05:10&orient=portrait&bg=emir-abdelkader'],
  ['adhan', 1920, 1080, 'demo&at=12:32:20&bg=suleymaniye'],
  ['iqama', 1920, 1080, 'demo&at=12:41:23&bg=suleymaniye'],
  ['prayer', 1920, 1080, 'demo&at=12:50:12&bg=suleymaniye'],
  ['adhkar', 1920, 1080, 'demo&at=12:58:40&bg=suleymaniye'],
  ['night-ar', 1920, 1080, 'demo&theme=night&lang=ar&at=20:14:30&bg=djamaa-el-djazair-night'],
  ['sand-en', 1920, 1080, 'demo&theme=sand&lang=en&at=14:20:05&bg=khiva-juma'],
  ['royal', 1920, 1080, 'demo&theme=royal&at=06:58:40&bg=lotfollah-ceiling'],
  ['settings-calc', 1600, 1000, 'demo&settings=calc'],
  ['settings-athan', 1600, 1000, 'demo&settings=athan'],
];

fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await puppeteer.launch({ executablePath: browser, headless: true, args: ['--mute-audio', '--hide-scrollbars'] });
for (const [name, w, h, q] of SHOTS) {
  // fresh storage per shot: an incognito-like browser context
  const ctx = await b.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(`${BASE}?${q}`, { waitUntil: 'networkidle2', timeout: 60000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await sleep(4500); // splash fade + background cross-fade
  const png = await page.screenshot({ type: 'png' });
  const target = w > h ? 1600 : 900;
  await sharp(png).resize({ width: target }).webp({ quality: 82 }).toFile(path.join(OUT, `${name}.webp`));
  await ctx.close();
  console.log('✓', name);
}
await b.close();
