/**
 * Time-zone helpers.
 *
 * The screen must show the mosque's wall-clock time even if the TV's own time zone is
 * mis-configured (very common on cheap Android boxes). Everything here works on absolute
 * instants (Date) + an IANA zone, using Intl only once per minute to keep weak CPUs idle.
 */

export interface YMD { y: number; m: number; d: number }

const fmtCache = new Map<string, Intl.DateTimeFormat>();
function partsFormatter(tz: string): Intl.DateTimeFormat {
  let f = fmtCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    fmtCache.set(tz, f);
  }
  return f;
}

export function isValidTimeZone(tz: string): boolean {
  try { new Intl.DateTimeFormat('en-US', { timeZone: tz }); return true; } catch { return false; }
}

export function deviceTimeZone(): string {
  try { return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'; } catch { return 'UTC'; }
}

/** Offset of `tz` from UTC at instant `date`, in minutes (e.g. +60 for Africa/Algiers). */
export function tzOffsetMinutes(tz: string, date: Date): number {
  const p: Record<string, number> = {};
  for (const x of partsFormatter(tz).formatToParts(date)) if (x.type !== 'literal') p[x.type] = +x.value;
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour === 24 ? 0 : p.hour, p.minute, p.second);
  return Math.round((asUtc - (date.getTime() - date.getMilliseconds())) / 60000);
}

/** Wall-clock components of `date` in `tz`. */
export function zoned(date: Date, tz: string, offsetMin = tzOffsetMinutes(tz, date)) {
  const t = new Date(date.getTime() + offsetMin * 60000);
  return {
    y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(),
    h: t.getUTCHours(), min: t.getUTCMinutes(), s: t.getUTCSeconds(), dow: t.getUTCDay(),
  };
}

export function todayIn(tz: string, now = new Date()): YMD {
  const z = zoned(now, tz);
  return { y: z.y, m: z.m, d: z.d };
}

/** Convert a wall-clock time in `tz` to an absolute instant (handles DST transitions). */
export function fromZoned(y: number, m: number, d: number, h: number, min: number, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d, h, min);
  let off = tzOffsetMinutes(tz, new Date(guess));
  let t = guess - off * 60000;
  const off2 = tzOffsetMinutes(tz, new Date(t));
  if (off2 !== off) { off = off2; t = guess - off * 60000; }
  return new Date(t);
}

export function addDays(d: YMD, n: number): YMD {
  const t = new Date(Date.UTC(d.y, d.m - 1, d.d + n));
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() };
}

export const ymdKey = (d: YMD) => `${d.y}-${pad(d.m)}-${pad(d.d)}`;
export const pad = (n: number) => (n < 10 ? '0' : '') + n;

/** "HH:MM" → minutes since midnight, or null. */
export function parseHM(s: string | undefined | null): number | null {
  const m = /^\s*(\d{1,2})[:hH.](\d{2})/.exec(s || '');
  if (!m) return null;
  const h = +m[1], mi = +m[2];
  return h < 24 && mi < 60 ? h * 60 + mi : null;
}

export function formatHM(date: Date, tz: string, h24: boolean, offsetMin?: number): string {
  const z = zoned(date, tz, offsetMin);
  if (h24) return `${pad(z.h)}:${pad(z.min)}`;
  const h = z.h % 12 || 12;
  return `${h}:${pad(z.min)}`;
}

export function meridiem(date: Date, tz: string, offsetMin?: number): 'AM' | 'PM' {
  return zoned(date, tz, offsetMin).h < 12 ? 'AM' : 'PM';
}

/** 3725 s → "01:02:05", 125 s → "02:05" */
export function formatCountdown(totalSec: number, forceHours = false): string {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 || forceHours ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}
