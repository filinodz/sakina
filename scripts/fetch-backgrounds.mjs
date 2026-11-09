#!/usr/bin/env node
/**
 * Downloads the curated, freely-licensed mosque photographs from Wikimedia Commons,
 * crops them to 16:9 and writes two variants per image:
 *   public/backgrounds/<slug>.jpg       1920×1080  (normal mode)
 *   public/backgrounds/lite/<slug>.jpg  1280×720   (lite mode for weak TVs)
 * and regenerates src/data/backgrounds.json + CREDITS.md (attribution is mandatory for CC BY / BY-SA).
 *
 * Usage: node scripts/fetch-backgrounds.mjs [--cache <dir>]
 */
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';

const ROOT = path.resolve(import.meta.dirname, '..');
const UA = { headers: { 'User-Agent': 'Sakina/1.0 (https://github.com/filinodz; open-source mosque display)' } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const cacheArg = process.argv.indexOf('--cache');
const CACHE = cacheArg > 0 ? process.argv[cacheArg + 1] : path.join(ROOT, '.cache/backgrounds');
fs.mkdirSync(CACHE, { recursive: true });

/** [slug, Commons file title, label, focal position for the crop] */
export const BACKGROUNDS = [
  ['djamaa-el-djazair-night', 'Djamaâ El-Djazaïr - 20240405 211300773.jpg', 'Djamaâ El-Djazaïr, Alger', 'center'],
  ['blue-mosque-dusk', 'Blue Mosque Courtyard Dusk Wikimedia Commons.jpg', 'Mosquée Bleue, Istanbul', 'center'],
  ['omar-ali-saifuddin', 'Sultan Omar Ali Saifuddin Mosque 02.jpg', 'Omar Ali Saifuddien, Brunei', 'center'],
  ['lotfollah-ceiling', 'Isfahan Lotfollah mosque ceiling symmetric.jpg', 'Cheikh Lotfollah, Ispahan', 'center'],
  ['shah-mosque', 'Shah Mosque (Isfahan).jpg', 'Mosquée du Shah, Ispahan', 'center'],
  ['jameh-isfahan-vault', 'Vault of the Jameh Mosque of Isfahan.jpg', 'Mosquée du Vendredi, Ispahan', 'center'],
  ['kota-kinabalu', 'KotaKinabalu Sabah CityMosque-00.jpg', 'Mosquée de Kota Kinabalu', 'center'],
  ['suleymaniye', 'Suleiman mosque Istanbul July 2022-11.jpg', 'Süleymaniye, Istanbul', 'center'],
  ['emir-abdelkader', 'Emir Abdelkader Mosque 07.jpg', 'Mosquée Émir Abdelkader, Constantine', 'center'],
  ['sultan-ahmed', 'Exterior of Sultan Ahmed I Mosque in Istanbul, Turkey 002.jpg', 'Sultan Ahmed, Istanbul', 'center'],
  ['sidi-okba', 'Sidi Okba Mosque 13.jpg', 'Mosquée Sidi Okba, Biskra', 'center'],
  ['kazan-azimov', 'Kazan Azimov Mosque Interior 2024-07-16 2153.jpg', 'Mosquée Azimov, Kazan', 'center'],
  ['khiva-juma', 'Juma Mosque (Khiva) 01.jpg', 'Mosquée Juma, Khiva', 'center'],
  ['ibn-tulun', 'Kairo Ibn Tulun Moschee BW 5.jpg', 'Ibn Touloun, Le Caire', 'center'],
  ['djamaa-el-djazair-ceiling', 'Décoration islamique sur un plafond extérieur de Djamaa el Djazaïr, avec une lampe au milieu.jpg', 'Djamaâ El-Djazaïr, plafond', 'center'],
];

const stripHtml = (s = '') => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&formatversion=2&prop=imageinfo&iiprop=url|extmetadata&iiextmetadatafilter=LicenseShortName|LicenseUrl|Artist&iiurlwidth=1920&titles=${encodeURIComponent(BACKGROUNDS.map((b) => 'File:' + b[1]).join('|'))}`;
const meta = await (await fetch(api, UA)).json();
const byTitle = Object.fromEntries(meta.query.pages.map((p) => [p.title.replace(/^File:/, ''), p.imageinfo?.[0]]));
// MediaWiki normalises titles (NFC); map back loosely.
const norm = (s) => s.normalize('NFC');
const find = (t) => byTitle[t] || Object.entries(byTitle).find(([k]) => norm(k) === norm(t))?.[1];

const outDir = path.join(ROOT, 'public/backgrounds');
fs.mkdirSync(path.join(outDir, 'lite'), { recursive: true });
const list = [];
const credits = [];

for (const [slug, title, label, position] of BACKGROUNDS) {
  const info = find(title);
  if (!info) { console.warn('missing on Commons:', title); continue; }
  const cached = path.join(CACHE, slug + '.jpg');
  if (!fs.existsSync(cached)) {
    await sleep(3000); // Wikimedia rate limits aggressively
    const r = await fetch(info.thumburl, UA);
    if (!r.ok) { console.warn('HTTP', r.status, title); continue; }
    fs.writeFileSync(cached, Buffer.from(await r.arrayBuffer()));
  }
  const img = sharp(cached).rotate();
  await img.clone().resize(1920, 1080, { fit: 'cover', position }).jpeg({ quality: 74, mozjpeg: true, progressive: true }).toFile(path.join(outDir, slug + '.jpg'));
  await img.clone().resize(1280, 720, { fit: 'cover', position }).jpeg({ quality: 68, mozjpeg: true }).toFile(path.join(outDir, 'lite', slug + '.jpg'));
  const ext = info.extmetadata || {};
  const author = stripHtml(ext.Artist?.value) || 'Unknown';
  const license = ext.LicenseShortName?.value || '';
  list.push({ id: slug, label, author, license });
  credits.push(`| ${label} | ${author} | [${license}](${ext.LicenseUrl?.value || info.descriptionurl}) | [source](${info.descriptionurl}) |`);
  console.log('✓', slug);
}

fs.writeFileSync(path.join(ROOT, 'src/data/backgrounds.json'), JSON.stringify(list, null, 1));
fs.writeFileSync(
  path.join(ROOT, 'CREDITS.md'),
  `# Crédits / Credits\n\n## Photographies d'arrière-plan\n\nToutes les photos proviennent de **Wikimedia Commons** et sont publiées sous licence libre. Elles ont été recadrées en 16:9 et compressées.\n\n| Image | Auteur | Licence | Source |\n|---|---|---|---|\n${credits.join('\n')}\n\n## Textes\n\n- **Qur'an** : texte Uthmani du projet [Tanzil](https://tanzil.net) via [alquran.cloud](https://alquran.cloud). Traductions : Muhammad Hamidullah (fr), Saheeh International (en).\n- **Adhkar** : *Hisn al-Muslim* de Sa'id ibn Wahf al-Qahtani, via [hisnmuslim.com](https://www.hisnmuslim.com).\n\n## Adhans\n\nLes enregistrements d'adhan sont diffusés en streaming depuis [Internet Archive](https://archive.org) (voir \`src/data/athans.ts\` pour chaque source). Ils ne sont pas redistribués dans ce dépôt.\n\n## Calcul des horaires\n\n[adhan-js](https://github.com/batoulapps/adhan-js) (Batoul Apps, MIT) — algorithmes astronomiques de *Astronomical Algorithms* (Jean Meeus).\n\n## Polices\n\nAmiri, Amiri Quran, Reem Kufi, Manrope, Cormorant Garamond — SIL Open Font License, via [Fontsource](https://fontsource.org).\n`
);
