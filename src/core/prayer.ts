import { CalculationMethod, CalculationParameters, Coordinates, HighLatitudeRule, Madhab, PrayerTimes } from 'adhan';
import { methodById } from '../data/methods';
import { PRAYERS, type PrayerKey, type SalahKey, type Settings } from './settings';
import { addDays, fromZoned, parseHM, todayIn, ymdKey, pad, type YMD } from './time';

export type Source = 'calc' | 'api' | 'table';
export interface DayTimes { date: YMD; times: Record<PrayerKey, Date>; source: Source }

/* ------------------------------------------------------------------ */
/*  1. Local astronomical calculation (offline, adhan-js)              */
/* ------------------------------------------------------------------ */

export function buildParams(s: Settings, ramadan = false): CalculationParameters {
  const def = methodById(s.calc.method);
  let p: CalculationParameters;
  if (def.id === 'custom') {
    p = new CalculationParameters('Other', s.calc.fajrAngle, s.calc.ishaAngle, s.calc.ishaInterval || 0);
  } else if (def.adhanPreset) {
    p = CalculationMethod[def.adhanPreset]();
  } else {
    p = new CalculationParameters('Other', def.fajr, def.isha, def.ishaInterval || 0, def.maghribAngle || 0);
  }
  if (def.maghribAdj || def.dhuhrAdj) {
    p.methodAdjustments = { ...p.methodAdjustments, dhuhr: (p.methodAdjustments.dhuhr || 0) + (def.dhuhrAdj || 0), maghrib: (p.methodAdjustments.maghrib || 0) + (def.maghribAdj || 0) };
  }
  // Umm al-Qura: Isha is 120 min after Maghrib during Ramadan.
  if (def.id === 'makkah' && ramadan) p.ishaInterval = 120;
  p.madhab = s.calc.madhab === 'hanafi' ? Madhab.Hanafi : Madhab.Shafi;
  p.highLatitudeRule =
    s.calc.highLat === 'middle' ? HighLatitudeRule.MiddleOfTheNight
    : s.calc.highLat === 'seventh' ? HighLatitudeRule.SeventhOfTheNight
    // 'auto' = angle-based portions, the convention used by Aladhan, IslamicFinder and most timetables.
    : HighLatitudeRule.TwilightAngle;
  return p;
}

export function calcDay(s: Settings, date: YMD, ramadan = false): DayTimes {
  const coords = new Coordinates(s.location.lat, s.location.lng);
  // adhan reads the local Y/M/D of the Date it receives, so build it from the mosque's calendar day.
  const pt = new PrayerTimes(coords, new Date(date.y, date.m - 1, date.d, 12), buildParams(s, ramadan));
  return {
    date, source: 'calc',
    times: { fajr: pt.fajr, sunrise: pt.sunrise, dhuhr: pt.dhuhr, asr: pt.asr, maghrib: pt.maghrib, isha: pt.isha },
  };
}

/* ------------------------------------------------------------------ */
/*  2. Aladhan API (monthly calendar, cached for offline use)          */
/* ------------------------------------------------------------------ */

const API_CACHE = 'sakina.aladhan.';

function apiParams(s: Settings): string {
  const def = methodById(s.calc.method);
  const q = new URLSearchParams({
    latitude: String(s.location.lat), longitude: String(s.location.lng),
    school: s.calc.madhab === 'hanafi' ? '1' : '0',
    timezonestring: s.location.timezone,
    iso8601: 'false',
  });
  if (def.aladhan === 99) {
    const fajr = def.id === 'custom' ? s.calc.fajrAngle : def.fajr;
    const isha = def.id === 'custom' ? (s.calc.ishaInterval ? `${s.calc.ishaInterval} min` : s.calc.ishaAngle) : def.isha;
    q.set('method', '99');
    q.set('methodSettings', `${fajr},null,${isha}`);
  } else q.set('method', String(def.aladhan));
  q.set('latitudeAdjustmentMethod', s.calc.highLat === 'middle' ? '1' : s.calc.highLat === 'seventh' ? '2' : '3');
  return q.toString();
}

function apiCacheKey(s: Settings, y: number, m: number) {
  return `${API_CACHE}${y}-${pad(m)}:${apiParams(s)}`;
}

type ApiMonth = Record<string, string[]>; // "YYYY-MM-DD" → 6 × "HH:MM"

export async function fetchApiMonth(s: Settings, y: number, m: number): Promise<ApiMonth> {
  const key = apiCacheKey(s, y, m);
  try { const c = localStorage.getItem(key); if (c) return JSON.parse(c); } catch { /* ignore */ }
  const res = await fetch(`https://api.aladhan.com/v1/calendar/${y}/${m}?${apiParams(s)}`);
  if (!res.ok) throw new Error(`Aladhan HTTP ${res.status}`);
  const json = await res.json();
  const out: ApiMonth = {};
  for (const day of json.data) {
    const [dd, mm, yyyy] = String(day.date.gregorian.date).split('-');
    const t = day.timings;
    out[`${yyyy}-${mm}-${dd}`] = [t.Fajr, t.Sunrise, t.Dhuhr, t.Asr, t.Maghrib, t.Isha].map((x: string) => x.slice(0, 5));
  }
  try {
    // Housekeeping: keep only this month and next month for the current parameters.
    const now = todayIn(s.location.timezone);
    const nxt = addDays({ ...now, d: 28 }, 7);
    const keep = [apiCacheKey(s, now.y, now.m), apiCacheKey(s, nxt.y, nxt.m), key];
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && k.startsWith(API_CACHE) && keep.indexOf(k) < 0) localStorage.removeItem(k);
    }
    localStorage.setItem(key, JSON.stringify(out));
  } catch { /* quota */ }
  return out;
}

function cachedApiDay(s: Settings, date: YMD): string[] | null {
  try {
    const c = localStorage.getItem(apiCacheKey(s, date.y, date.m));
    if (c) return (JSON.parse(c) as ApiMonth)[ymdKey(date)] ?? null;
  } catch { /* ignore */ }
  return null;
}

/* ------------------------------------------------------------------ */
/*  3. Imported official timetable (CSV)                               */
/* ------------------------------------------------------------------ */

function tableDay(s: Settings, date: YMD): string[] | null {
  return s.timetable[ymdKey(date)] ?? s.timetable[`${pad(date.m)}-${pad(date.d)}`] ?? null;
}

/**
 * Accepts CSV/TSV/semicolon files with a date column then 6 times:
 *   date, fajr, sunrise, dhuhr, asr, maghrib, isha
 * Dates: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY or DD/MM (yearly table). A header row is skipped.
 */
export function parseTimetable(text: string): { rows: Record<string, string[]>; errors: number } {
  const rows: Record<string, string[]> = {};
  let errors = 0;
  for (const line of text.split(/\r?\n/)) {
    const cells = line.split(/[;,\t]/).map((c) => c.trim()).filter(Boolean);
    if (cells.length < 7) continue;
    const key = parseDateCell(cells[0]);
    const times = cells.slice(1, 7).map((c) => { const v = parseHM(c); return v === null ? null : `${pad(Math.floor(v / 60))}:${pad(v % 60)}`; });
    if (!key || times.some((t) => t === null)) { if (/\d/.test(cells[0])) errors++; continue; }
    rows[key] = times as string[];
  }
  return { rows, errors };
}

function parseDateCell(c: string): string | null {
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(c);
  if (m) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(c);
  if (m) return `${m[3]}-${pad(+m[2])}-${pad(+m[1])}`;
  m = /^(\d{1,2})[/.-](\d{1,2})$/.exec(c);
  if (m) return `${pad(+m[2])}-${pad(+m[1])}`;
  return null;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

function fromStrings(s: Settings, date: YMD, arr: string[], source: Source): DayTimes | null {
  const times = {} as Record<PrayerKey, Date>;
  for (let i = 0; i < PRAYERS.length; i++) {
    const v = parseHM(arr[i]);
    if (v === null) return null;
    times[PRAYERS[i]] = fromZoned(date.y, date.m, date.d, Math.floor(v / 60), v % 60, s.location.timezone);
  }
  return { date, times, source };
}

function applyAdjustments(s: Settings, day: DayTimes): DayTimes {
  const t = { ...day.times };
  for (const k of PRAYERS) t[k] = new Date(t[k].getTime() + (s.calc.adjust[k] || 0) * 60000);
  return { ...day, times: t };
}

/** Times for a calendar day in the mosque's zone. Never throws: falls back to local calculation. */
export function getDay(s: Settings, date: YMD, ramadan = false): DayTimes {
  let day: DayTimes | null = null;
  if (s.calc.source === 'table') {
    const r = tableDay(s, date);
    if (r) day = fromStrings(s, date, r, 'table');
  } else if (s.calc.source === 'api') {
    const r = cachedApiDay(s, date);
    if (r) day = fromStrings(s, date, r, 'api');
  }
  return applyAdjustments(s, day ?? calcDay(s, date, ramadan));
}

/** Pre-fetch API months (current + next) so the screen keeps working offline. */
export async function warmApi(s: Settings): Promise<void> {
  if (s.calc.source !== 'api') return;
  const t = todayIn(s.location.timezone);
  const next = addDays({ ...t, d: 28 }, 7);
  await fetchApiMonth(s, t.y, t.m);
  await fetchApiMonth(s, next.y, next.m).catch(() => undefined);
}

export function iqamaTime(s: Settings, key: SalahKey, adhan: Date, date: YMD): Date {
  const r = s.iqama[key];
  if (r.mode === 'fixed') {
    const v = parseHM(r.time);
    if (v !== null) {
      const fixed = fromZoned(date.y, date.m, date.d, Math.floor(v / 60), v % 60, s.location.timezone);
      if (fixed.getTime() >= adhan.getTime()) return fixed;
    }
  }
  return new Date(adhan.getTime() + Math.max(0, r.offset) * 60000);
}

/** Compare local calculation with Aladhan for today — used by the "verify" button in settings. */
export async function verifyWithApi(s: Settings): Promise<{ key: PrayerKey; local: Date; api: Date; diff: number }[]> {
  const date = todayIn(s.location.timezone);
  const month = await fetchApiMonth(s, date.y, date.m);
  const api = fromStrings(s, date, month[ymdKey(date)], 'api');
  const local = calcDay(s, date);
  if (!api) throw new Error('No API data');
  return PRAYERS.map((key) => ({
    key, local: local.times[key], api: api.times[key],
    diff: Math.round((local.times[key].getTime() - api.times[key].getTime()) / 60000),
  }));
}
