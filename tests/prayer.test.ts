import { describe, expect, it } from 'vitest';
import fixtures from './fixtures/aladhan.json';
import { defaults, PRAYERS, type MethodId, type Settings } from '../src/core/settings';
import { calcDay, parseTimetable, iqamaTime } from '../src/core/prayer';
import { computeState } from '../src/core/schedule';
import { fromZoned, formatHM, tzOffsetMinutes, todayIn } from '../src/core/time';
import { toHijri } from '../src/core/hijri';

interface Fixture { id: string; city: string; lat: number; lng: number; tz: string; method: MethodId; date: string; times: string[] }

function cfg(f: Pick<Fixture, 'lat' | 'lng' | 'tz' | 'method'>): Settings {
  const s = defaults();
  s.location = { ...s.location, lat: f.lat, lng: f.lng, timezone: f.tz, configured: true };
  s.calc.method = f.method;
  return s;
}

const toMin = (hm: string) => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };

describe('offline astronomical calculation vs. Aladhan reference', () => {
  for (const f of fixtures as Fixture[]) {
    it(`${f.city} ${f.date} (${f.method})`, () => {
      const s = cfg(f);
      const [y, m, d] = f.date.split('-').map(Number);
      const day = calcDay(s, { y, m, d });
      PRAYERS.forEach((k, i) => {
        const ours = toMin(formatHM(day.times[k], f.tz, true));
        let diff = Math.abs(ours - toMin(f.times[i]));
        if (diff > 720) diff = 1440 - diff;
        // Both engines round to the nearest minute from slightly different solar models (Meeus vs PrayTimes),
        // and some adhan-js presets add the authority's +1 min Dhuhr ihtiyat (MUIS rounds up as well).
        // Winter Asr at high latitude is very sensitive to the shadow-length model.
        const tol = (k === 'asr' && Math.abs(f.lat) > 45) || (k === 'dhuhr' && f.method === 'singapore') ? 3 : 1;
        expect(diff, `${k}: ours ${formatHM(day.times[k], f.tz, true)} vs aladhan ${f.times[i]}`).toBeLessThanOrEqual(tol);
      });
    });
  }
});

describe('time zones', () => {
  it('converts wall-clock times across DST (Paris)', () => {
    const summer = fromZoned(2026, 7, 1, 12, 0, 'Europe/Paris');
    const winter = fromZoned(2026, 12, 1, 12, 0, 'Europe/Paris');
    expect(summer.toISOString()).toBe('2026-07-01T10:00:00.000Z');
    expect(winter.toISOString()).toBe('2026-12-01T11:00:00.000Z');
    expect(tzOffsetMinutes('Africa/Algiers', winter)).toBe(60);
  });
  it('uses the mosque calendar day, not the device one', () => {
    // 23:30 UTC on Nov 9 is already Nov 10 in Kuala Lumpur
    expect(todayIn('Asia/Kuala_Lumpur', new Date('2026-11-09T23:30:00Z'))).toEqual({ y: 2026, m: 11, d: 10 });
  });
});

describe('iqama', () => {
  const s = cfg({ lat: 36.7538, lng: 3.0588, tz: 'Africa/Algiers', method: 'algeria' });
  const date = { y: 2026, m: 11, d: 9 };
  const adhan = fromZoned(2026, 11, 9, 12, 32, 'Africa/Algiers');
  it('offset after adhan', () => {
    s.iqama.dhuhr = { mode: 'offset', offset: 15, time: '' };
    expect(formatHM(iqamaTime(s, 'dhuhr', adhan, date), 'Africa/Algiers', true)).toBe('12:47');
  });
  it('fixed time, never before the adhan', () => {
    s.iqama.dhuhr = { mode: 'fixed', offset: 10, time: '13:15' };
    expect(formatHM(iqamaTime(s, 'dhuhr', adhan, date), 'Africa/Algiers', true)).toBe('13:15');
    s.iqama.dhuhr = { mode: 'fixed', offset: 10, time: '12:00' };
    expect(formatHM(iqamaTime(s, 'dhuhr', adhan, date), 'Africa/Algiers', true)).toBe('12:42');
  });
});

describe('phases', () => {
  const s = cfg({ lat: 36.7538, lng: 3.0588, tz: 'Africa/Algiers', method: 'algeria' });
  const at = (h: number, m: number) => fromZoned(2026, 11, 10, h, m, 'Africa/Algiers'); // a Tuesday
  const dhuhr = calcDay(s, { y: 2026, m: 11, d: 10 }).times.dhuhr;
  const plus = (min: number) => new Date(dhuhr.getTime() + min * 60000);
  it('idle → adhan → iqama → prayer → adhkar → idle', () => {
    expect(computeState(s, plus(-1)).phase).toBe('idle');
    expect(computeState(s, plus(1)).phase).toBe('adhan');
    expect(computeState(s, plus(8)).phase).toBe('iqama');
    expect(computeState(s, plus(16)).phase).toBe('prayer');
    expect(computeState(s, plus(26)).phase).toBe('adhkar');
    expect(computeState(s, plus(40)).phase).toBe('idle');
  });
  it('home mode only shows the adhan', () => {
    const h = { ...s, mode: 'home' as const };
    expect(computeState(h, plus(1)).phase).toBe('adhan');
    expect(computeState(h, plus(8)).phase).toBe('idle');
  });
  it('after Isha the next prayer is tomorrow’s Fajr', () => {
    const st = computeState(s, at(23, 30));
    expect(st.next.key).toBe('fajr');
    expect(st.next.tomorrow).toBe(true);
  });
});

describe('national conventions', () => {
  it('Morocco applies the Habous +5 min on Dhuhr and Maghrib', () => {
    const base = cfg({ lat: 33.5731, lng: -7.5898, tz: 'Africa/Casablanca', method: 'mwl' });
    const ma = cfg({ lat: 33.5731, lng: -7.5898, tz: 'Africa/Casablanca', method: 'morocco' });
    const d = { y: 2026, m: 11, d: 9 };
    const a = calcDay(base, d).times, b = calcDay(ma, d).times;
    // MWL already carries +1 min on Dhuhr in adhan-js
    expect(Math.round((b.dhuhr.getTime() - a.dhuhr.getTime()) / 60000)).toBe(4);
    expect(Math.round((b.maghrib.getTime() - a.maghrib.getTime()) / 60000)).toBe(5);
    expect(tzOffsetMinutes('Africa/Casablanca', b.dhuhr)).toBe(60);
  });
});

describe('official timetable import', () => {
  it('parses CSV with several date formats and skips headers', () => {
    const { rows, errors } = parseTimetable('date;fajr;chourouq;dhohr;asr;maghrib;icha\n09/11/2026;05:51;07:19;12:32;15:21;17:43;19:07\n2026-11-10;5:52;7:20;12:32;15:20;17:42;19:06\n10/11;05:52;07:20;12:32;15:20;17:42;19:06\n');
    expect(errors).toBe(0);
    expect(rows['2026-11-09'][0]).toBe('05:51');
    expect(rows['2026-11-10'][1]).toBe('07:20');
    expect(rows['11-10'][5]).toBe('19:06');
  });
});

describe('hijri', () => {
  it('Umm al-Qura date', () => {
    // 1 Ramadan 1447 = 18 Feb 2026 (Umm al-Qura)
    expect(toHijri({ y: 2026, m: 2, d: 18 })).toEqual({ y: 1447, m: 9, d: 1 });
  });
  it('manual correction', () => {
    expect(toHijri({ y: 2026, m: 2, d: 18 }, -1).m).toBe(8);
  });
});
