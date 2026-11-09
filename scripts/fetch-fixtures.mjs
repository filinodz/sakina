#!/usr/bin/env node
/** Downloads reference timetables from api.aladhan.com for the accuracy tests (tests/fixtures/aladhan.json). */
import fs from 'node:fs';
import path from 'node:path';
const CASES = [
  // id, city, lat, lng, tz, our method, aladhan method, methodSettings
  ['algiers', 'Alger', 36.7538, 3.0588, 'Africa/Algiers', 'algeria', 19],
  ['constantine', 'Constantine', 36.365, 6.6147, 'Africa/Algiers', 'algeria', 19],
  ['tamanrasset', 'Tamanrasset', 22.785, 5.5228, 'Africa/Algiers', 'algeria', 19],
  // Casablanca is left out: Aladhan returns UTC+0 wall times for part of the year whereas Morocco
  // is legally UTC+1 outside Ramadan (IANA Africa/Casablanca) — the comparison would be meaningless.
  ['tunis', 'Tunis', 36.8065, 10.1815, 'Africa/Tunis', 'tunisia', 18],
  ['cairo', 'Le Caire', 30.0444, 31.2357, 'Africa/Cairo', 'egypt', 5],
  ['makkah', 'La Mecque', 21.4225, 39.8262, 'Asia/Riyadh', 'makkah', 4],
  ['paris', 'Paris', 48.8566, 2.3522, 'Europe/Paris', 'france12', 12],
  ['london', 'Londres', 51.5074, -0.1278, 'Europe/London', 'mwl', 3],
  ['istanbul', 'Istanbul', 41.0082, 28.9784, 'Europe/Istanbul', 'turkey', 13],
  ['montreal', 'Montréal', 45.5019, -73.5674, 'America/Toronto', 'isna', 2],
  ['kualalumpur', 'Kuala Lumpur', 3.139, 101.6869, 'Asia/Kuala_Lumpur', 'singapore', 11],
];
const DATES = [['2026', '06'], ['2026', '12']];
const out = [];
for (const [id, city, lat, lng, tz, method, aladhan] of CASES) {
  for (const [y, m] of DATES) {
    const url = `https://api.aladhan.com/v1/calendar/${y}/${+m}?latitude=${lat}&longitude=${lng}&method=${aladhan}&school=0&timezonestring=${encodeURIComponent(tz)}&iso8601=false`;
    const j = await (await fetch(url)).json();
    for (const d of j.data.filter((_, i) => i % 5 === 0)) {
      const [dd, mm, yyyy] = d.date.gregorian.date.split('-');
      const t = d.timings;
      out.push({ id, city, lat, lng, tz, method, date: `${yyyy}-${mm}-${dd}`, meta: d.meta.method.params, times: [t.Fajr, t.Sunrise, t.Dhuhr, t.Asr, t.Maghrib, t.Isha].map((x) => x.slice(0, 5)) });
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  process.stdout.write('.');
}
fs.writeFileSync(path.resolve(import.meta.dirname, '../tests/fixtures/aladhan.json'), JSON.stringify(out, null, 1));
console.log(`\n✓ ${out.length} reference days`);
