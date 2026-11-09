#!/usr/bin/env node
/**
 * Regenerates src/data/ayat.json and src/data/adhkar.json from authoritative sources.
 *
 *  - Qur'an text (Uthmani) + translations: https://alquran.cloud (Tanzil text)
 *      fr.hamidullah  — Muhammad Hamidullah
 *      en.sahih       — Saheeh International
 *  - Adhkar / du'a: Hisn al-Muslim (Sa'id ibn Wahf al-Qahtani) — https://www.hisnmuslim.com
 *
 * Nothing in these files is typed by hand: re-run `npm run content` to rebuild them.
 */
import fs from 'node:fs';
import path from 'node:path';

const OUT = path.resolve(import.meta.dirname, '../src/data');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Curated verses for a mosque screen. "s:a" or "s:a-b". */
const AYAT = [
  '2:255', '72:18', '9:18', '24:36', '62:9', '62:10', '29:45', '4:103', '2:238', '2:45',
  '2:152', '2:153', '2:186', '13:28', '20:14', '11:114', '17:78', '23:1-2', '39:53', '94:5-6',
  '40:60', '33:41-42', '33:56', '2:201', '3:8', '14:40', '25:74', '65:2-3', '50:16', '57:4',
  '2:110', '8:2', '3:139', '7:31', '7:205', '112:1-4', '2:286', '3:190-191', '59:22', '21:87',
];

/** Hisn al-Muslim chapters that make sense on a mosque display. */
const ADHKAR_CHAPTERS = [25, 13, 14, 12, 15, 27, 129, 130, 107, 34, 35, 43, 122];
const MAX_LEN = 430; // keep each card readable from the back of a prayer hall

async function getJson(url, tries = 4) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Sakina/1.0 (open-source mosque display)' } });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const t = (await r.text()).replace(/^﻿/, '');
      return JSON.parse(t);
    } catch (e) {
      if (i === tries - 1) throw new Error(`${url}: ${e.message}`);
      await sleep(1500 * (i + 1));
    }
  }
}

const toArabicDigits = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);

async function fetchAyat() {
  const out = [];
  for (const ref of AYAT) {
    const [s, range] = ref.split(':');
    const [a, b = a] = range.split('-').map(Number);
    const parts = { ar: [], fr: [], en: [] };
    let surah;
    for (let n = a; n <= b; n++) {
      const j = await getJson(`https://api.alquran.cloud/v1/ayah/${s}:${n}/editions/quran-uthmani,fr.hamidullah,en.sahih`);
      const [ar, fr, en] = j.data;
      surah = ar.surah;
      let text = ar.text;
      // Tanzil prefixes the first ayah of each surah (except 1 & 9) with the basmala — strip it.
      if (n === 1 && +s !== 1 && +s !== 9) text = text.replace(/^بِسْمِ\s+ٱللَّهِ\s+ٱلرَّحْمَٰنِ\s+ٱلرَّحِيمِ\s*/u, '');
      parts.ar.push(`${text} ﴿${toArabicDigits(n)}﴾`);
      parts.fr.push(fr.text);
      parts.en.push(en.text);
      await sleep(120);
    }
    out.push({
      ref,
      surah: { number: surah.number, ar: surah.name, en: surah.englishName },
      ar: parts.ar.join(' '),
      fr: parts.fr.join(' '),
      en: parts.en.join(' '),
    });
    process.stdout.write('.');
  }
  return out;
}

const clean = (s) => {
  // Hisn al-Muslim marks the words to recite with (( … )): drop the markers, then any unbalanced parenthesis.
  let t = (s || '').replace(/\(\(|\)\)/g, '').replace(/\s+/g, ' ').trim().replace(/\.$/, '');
  let depth = 0, out = '';
  for (const c of t) {
    if (c === '(') { depth++; out += c; } else if (c === ')') { if (depth > 0) { depth--; out += c; } } else out += c;
  }
  while (depth-- > 0) out = out.replace(/\((?![^(]*\))/, '');
  t = out.replace(/\s+([،,.])/g, '$1').trim();
  // Hisn al-Muslim wraps whole texts in (( … )) — peel matching outer pairs only.
  while (t.startsWith('(') && t.endsWith(')')) {
    const inner = t.slice(1, -1);
    let depth = 0, ok = true;
    for (const c of inner) { if (c === '(') depth++; else if (c === ')' && --depth < 0) { ok = false; break; } }
    if (!ok || depth !== 0) break;
    t = inner.trim().replace(/\.$/, '');
  }
  return t;
};

async function fetchAdhkar() {
  const out = [];
  for (const id of ADHKAR_CHAPTERS) {
    const ar = await getJson(`http://www.hisnmuslim.com/api/ar/${id}.json`);
    const en = await getJson(`http://www.hisnmuslim.com/api/en/${id}.json`);
    const [titleAr, itemsAr] = Object.entries(ar)[0];
    const [titleEn, itemsEn] = Object.entries(en)[0];
    for (const item of itemsAr) {
      const text = clean(item.ARABIC_TEXT);
      if (!text || text.length > MAX_LEN) continue;
      const e = itemsEn.find((x) => x.ID === item.ID) || {};
      out.push({
        id: item.ID,
        chapter: id,
        title: { ar: titleAr.trim(), en: titleEn.trim() },
        ar: text,
        // drop the glossary notes Hisn al-Muslim appends after the translation ("…promise.’al-waseelah: …")
        en: clean(e.TRANSLATED_TEXT).split(/(?<=[.’'”)])\s*(?=[A-Za-z][A-Za-z\-' ]{1,30}:\s)/)[0].trim(),
        translit: clean(e.LANGUAGE_ARABIC_TRANSLATED_TEXT),
        repeat: item.REPEAT || 1,
      });
    }
    process.stdout.write('.');
    await sleep(200);
  }
  return out;
}

fs.mkdirSync(OUT, { recursive: true });
const ayat = await fetchAyat();
fs.writeFileSync(path.join(OUT, 'ayat.json'), JSON.stringify(ayat, null, 1));
console.log(`\n✓ ${ayat.length} ayat`);
const adhkar = await fetchAdhkar();
fs.writeFileSync(path.join(OUT, 'adhkar.json'), JSON.stringify(adhkar, null, 1));
console.log(`\n✓ ${adhkar.length} adhkar`);
