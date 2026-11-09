#!/usr/bin/env node
/**
 * Builds src/data/ahadith.json: short, authentic hadiths for the ticker.
 *
 * Source: Sahih al-Bukhari and Sahih Muslim from the open hadith-api
 * (https://github.com/fawazahmed0/hadith-api) — Arabic + French + English.
 *
 * Only hadiths where the Prophet ﷺ is unambiguously the speaker are kept:
 *   - the Arabic text has exactly one quoted segment, introduced by "صلى الله عليه وسلم … قال/يقول",
 *   - the French says "(ﷺ) a dit" and the English "(ﷺ) said",
 *   - the spoken words are short enough for a scrolling ticker.
 * Nothing is typed by hand; each entry keeps its collection and number for verification.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../src/data/ahadith.json');
const BASE = 'https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/';
const COLLECTIONS = [
  { id: 'bukhari', ar: 'صحيح البخاري', fr: 'Sahih al-Bukhari', en: 'Sahih al-Bukhari' },
];
const MAX_AR = 150, MIN_AR = 30, MAX_TR = 240;
/**
 * Hand-reviewed selection (Bukhari numbers) of sayings that read well on a mosque screen
 * without commentary: prayer, the mosque, the adhan, manners, mercy, the Qur'an, Ramadan.
 * Sayings that need scholarly context (rulings, end-times, etc.) are deliberately left out.
 */
const CURATED = new Set([13, 55, 69, 444, 552, 574, 611, 645, 662, 723, 998, 1302, 1898, 2076, 2472, 3257, 4006, 5027, 5991, 6013, 6014, 6479, 6951, 7235]);

async function edition(name) {
  for (let i = 0; i < 4; i++) {
    try {
      const r = await fetch(BASE + name + '.min.json');
      if (r.ok) return new Map((await r.json()).hadiths.map((h) => [h.hadithnumber, h.text]));
    } catch { /* retry */ }
    await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
  }
  throw new Error('cannot download ' + name);
}

const clean = (s) => s.replace(/[‏‎]/g, '').replace(/\s+/g, ' ').trim();
const PROPHET = /(صلى الله عليه وسلم|صَلَّى اللَّهُ عَلَيْهِ وَسَلَّمَ)\s*[،,]?\s*(قَالَ|يَقُولُ|قال|يقول)\s*[:،]?\s*"([^"]+)"/;

function arabicMatn(text) {
  const t = clean(text);
  if ((t.match(/"/g) || []).length !== 2) return null;
  const m = PROPHET.exec(t);
  return m ? m[3].replace(/[\s.،]+$/, '').trim() : null;
}

function translatedMatn(text, lang) {
  const t = clean(text);
  const said = lang === 'fr' ? /\(ﷺ\) a dit\s*:?\s*/ : /\(ﷺ\) said,?\s*/;
  const m = said.exec(t);
  if (!m) return null;
  const narrator = (lang === 'fr' ? /^Rapporté par ([^:]{2,40}):/ : /^Narrated ([^:]{2,40}):/).exec(t)?.[1]?.trim() ?? '';
  let rest = t.slice(m.index + m[0].length).trim();
  rest = rest.replace(/^[«"“]\s*/, '').replace(/\s*[»"”]\s*\.?$/, '').replace(/[»"”]$/, '').trim();
  if (/[«"“»”]/.test(rest)) return null; // a second quotation: not a single saying
  return { text: rest.replace(/\s*\.$/, '') + '.', narrator };
}

const out = [];
for (const c of COLLECTIONS) {
  const [ar, fr, en] = await Promise.all([edition('ara-' + c.id), edition('fra-' + c.id), edition('eng-' + c.id)]);
  for (const [n, text] of ar) {
    if (c.id === 'bukhari' && !CURATED.has(n)) continue;
    const a = arabicMatn(text);
    if (!a || a.length < MIN_AR || a.length > MAX_AR) continue;
    const f = fr.get(n) && translatedMatn(fr.get(n), 'fr');
    const e = en.get(n) && translatedMatn(en.get(n), 'en');
    if (!f || !e || f.text.length > MAX_TR || e.text.length > MAX_TR) continue;
    out.push({ ref: { collection: c.id, number: n, ar: c.ar, fr: c.fr, en: c.en }, ar: a, fr: f.text, en: e.text, narrator: { fr: f.narrator, en: e.narrator } });
  }
  console.log(c.id, out.length);
}

// Drop duplicates (the same saying narrated through several chains)
const seen = new Set();
const unique = out.filter((h) => { const k = h.ar.replace(/[ً-ْ\s]/g, ''); if (seen.has(k)) return false; seen.add(k); return true; });
fs.writeFileSync(OUT, JSON.stringify(unique, null, 1));
console.log(`✓ ${unique.length} ahadith`);
