import { getDay, iqamaTime, type DayTimes } from './prayer';
import { sequenceSeconds } from './after-salah';
import { SALAWAT, type PrayerKey, type SalahKey, type Settings } from './settings';
import { toHijri, type Hijri } from './hijri';
import { addDays, fromZoned, parseHM, todayIn, ymdKey, zoned, type YMD } from './time';

export type Phase = 'idle' | 'adhan' | 'iqama' | 'prayer' | 'adhkar';

export interface SalahEvent {
  key: SalahKey;
  jumuah: boolean;
  adhan: Date;
  iqama: Date;
  prayerEnd: Date;
  adhkarEnd: Date;
  date: YMD;
}

export interface State {
  now: Date;
  today: DayTimes;
  tomorrow: DayTimes;
  todayIqama: Record<SalahKey, Date>;
  friday: boolean;
  hijri: Hijri;
  ramadan: boolean;
  /** Next adhan (or sunrise) — target of the main countdown. */
  next: { key: PrayerKey | 'jumuah'; at: Date; tomorrow: boolean; prev: Date };
  /** Prayer whose time is currently running (for the highlighted card). */
  current: PrayerKey | null;
  phase: Phase;
  event: SalahEvent | null;
  imsak: Date | null;
  iftar: Date | null;
  nightDim: boolean;
  duha: Date;
  qiyam: Date;
  eid: Date | null;
}

const dayCache = new Map<string, DayTimes>();
let cacheSig = '';

function signature(s: Settings) {
  return JSON.stringify([s.location, s.calc, s.timetable && Object.keys(s.timetable).length]);
}

export function invalidate() { dayCache.clear(); }

function day(s: Settings, d: YMD, ramadan: boolean): DayTimes {
  const sig = signature(s);
  if (sig !== cacheSig) { dayCache.clear(); cacheSig = sig; }
  const k = ymdKey(d) + (ramadan ? 'R' : '');
  let v = dayCache.get(k);
  if (!v) {
    v = getDay(s, d, ramadan);
    if (dayCache.size > 8) dayCache.clear();
    dayCache.set(k, v);
  }
  return v;
}

function isFriday(d: YMD) { return new Date(Date.UTC(d.y, d.m - 1, d.d)).getUTCDay() === 5; }

function hijriFor(s: Settings, d: YMD) { return toHijri(d, s.calc.hijriAdjust); }

function events(s: Settings, d: YMD, dt: DayTimes): SalahEvent[] {
  const fri = isFriday(d);
  return SALAWAT.map((key) => {
    const adhan = dt.times[key];
    const jumuah = fri && key === 'dhuhr';
    let iqama = iqamaTime(s, key, adhan, d);
    if (jumuah) {
      const j = parseHM(s.mosque.jumuah[0]);
      if (j !== null) {
        const fixed = fromZoned(d.y, d.m, d.d, Math.floor(j / 60), j % 60, s.location.timezone);
        iqama = new Date(Math.max(fixed.getTime(), adhan.getTime()) + s.iqama.jumuahOffset * 60000);
      }
    }
    const prayerEnd = new Date(iqama.getTime() + (jumuah ? s.phases.jumuahMinutes : s.phases.prayerMinutes) * 60000);
    const adhkarMs = !s.phases.adhkar ? 0 : s.phases.adhkarAuto ? sequenceSeconds(key) * 1000 : s.phases.adhkarMinutes * 60000;
    const adhkarEnd = new Date(prayerEnd.getTime() + adhkarMs);
    return { key, jumuah, adhan, iqama, prayerEnd, adhkarEnd, date: d };
  });
}

export function computeState(s: Settings, now = new Date()): State {
  const tz = s.location.timezone;
  const todayYmd = todayIn(tz, now);
  const yesterdayYmd = addDays(todayYmd, -1);
  const tomorrowYmd = addDays(todayYmd, 1);

  // Ramadan is decided on the civil day (needed for Umm al-Qura's 120-min Isha).
  const hToday = hijriFor(s, todayYmd);
  const ramadanDay = s.ramadan.force || (s.ramadan.auto && hToday.m === 9);

  const today = day(s, todayYmd, ramadanDay);
  const tomorrow = day(s, tomorrowYmd, ramadanDay);
  const yesterday = day(s, yesterdayYmd, ramadanDay);

  // Hijri day starts at Maghrib.
  const afterMaghrib = now.getTime() >= today.times.maghrib.getTime();
  const hijri = s.calc.hijriAtMaghrib && afterMaghrib ? hijriFor(s, tomorrowYmd) : hToday;
  const ramadan = s.ramadan.force || (s.ramadan.auto && hijri.m === 9);

  const evToday = events(s, todayYmd, today);
  const all = [...events(s, yesterdayYmd, yesterday), ...evToday, ...events(s, tomorrowYmd, tomorrow)];
  const t = now.getTime();

  // Phase
  let phase: Phase = 'idle';
  let event: SalahEvent | null = null;
  const adhanMs = s.phases.adhanScreenMinutes * 60000;
  for (const e of all) {
    const a = e.adhan.getTime();
    if (t < a || t >= e.adhkarEnd.getTime()) continue;
    if (s.mode === 'home') {
      // At home: the adhan, then the adhkar once the prayer has (most likely) been prayed.
      if (t < a + adhanMs) { phase = 'adhan'; event = e; }
      else if (s.phases.adhkarHome && t >= e.prayerEnd.getTime()) { phase = 'adhkar'; event = e; }
      continue;
    }
    event = e;
    if (t < a + adhanMs && t < e.iqama.getTime()) phase = 'adhan';
    else if (t < e.iqama.getTime()) phase = s.phases.iqamaCountdown ? 'iqama' : 'idle';
    else if (t < e.prayerEnd.getTime()) phase = s.phases.prayerMinutes > 0 || e.jumuah ? 'prayer' : 'idle';
    else phase = e.adhkarEnd.getTime() > e.prayerEnd.getTime() ? 'adhkar' : 'idle';
    if (phase === 'idle') event = null;
  }

  // Next target (includes sunrise so the countdown is meaningful after Fajr)
  const order: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
  const fri = isFriday(todayYmd);
  let next: State['next'] | null = null;
  let prev = yesterday.times.isha;
  for (const k of order) {
    const at = today.times[k];
    if (at.getTime() > t) { next = { key: fri && k === 'dhuhr' ? 'jumuah' : k, at, tomorrow: false, prev }; break; }
    prev = at;
  }
  if (!next) next = { key: 'fajr', at: tomorrow.times.fajr, tomorrow: true, prev: today.times.isha };

  let current: PrayerKey | null = null;
  for (const k of order) if (today.times[k].getTime() <= t) current = k;
  if (current === 'sunrise') current = null; // Shuruq is a time marker, not a prayer
  if (!current) current = t < today.times.fajr.getTime() ? 'isha' : null;

  const todayIqama = {} as Record<SalahKey, Date>;
  for (const e of evToday) todayIqama[e.key] = e.iqama;

  // Ramadan helpers
  let imsak: Date | null = null, iftar: Date | null = null;
  if (ramadan) {
    const fajrRef = t < today.times.fajr.getTime() ? today.times.fajr : tomorrow.times.fajr;
    imsak = new Date(fajrRef.getTime() - s.ramadan.imsakOffset * 60000);
    iftar = today.times.maghrib;
  }

  // Night dimming: 1h after Isha iqama → 45 min before Fajr
  let nightDim = false;
  if (s.display.nightDim && phase === 'idle') {
    const ishaEnd = todayIqama.isha.getTime() + 60 * 60000;
    const fajrStart = (t < today.times.fajr.getTime() ? today.times.fajr : tomorrow.times.fajr).getTime() - 45 * 60000;
    const yIshaEnd = yesterday.times.isha.getTime() + 75 * 60000;
    nightDim = (t > ishaEnd && t < fajrStart) || (t > yIshaEnd && t < today.times.fajr.getTime() - 45 * 60000);
    // Custom hours override the automatic window
    const from = parseHM(s.display.nightDimFrom), to = parseHM(s.display.nightDimTo);
    if (from !== null && to !== null) {
      const z = zoned(now, tz); const m = z.h * 60 + z.min;
      nightDim = from <= to ? m >= from && m < to : m >= from || m < to;
    }
  }

  // Duha starts ~15 min after sunrise; the last third of the night runs from Maghrib to the next Fajr.
  const duha = new Date(today.times.sunrise.getTime() + 15 * 60000);
  const nightStart = t < today.times.fajr.getTime() ? yesterday.times.maghrib : today.times.maghrib;
  const nightEnd = t < today.times.fajr.getTime() ? today.times.fajr : tomorrow.times.fajr;
  const qiyam = new Date(nightEnd.getTime() - (nightEnd.getTime() - nightStart.getTime()) / 3);

  // Eid prayer: shown from three days before
  let eid: Date | null = null;
  const em = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.eid.date);
  const et = parseHM(s.eid.time);
  if (em && et !== null) {
    const at = fromZoned(+em[1], +em[2], +em[3], Math.floor(et / 60), et % 60, tz);
    if (at.getTime() > t - 2 * 3600000 && at.getTime() - t < 3 * 86400000) eid = at;
  }

  return { now, today, tomorrow, todayIqama, friday: fri, hijri, ramadan, next, current, phase, event, imsak, iftar, nightDim, duha, qiyam, eid };
}

/** Minutes since local midnight in the mosque zone — handy for UI. */
export function minutesOfDay(d: Date, tz: string) { const z = zoned(d, tz); return z.h * 60 + z.min; }
