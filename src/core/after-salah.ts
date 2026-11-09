import data from '../data/after-salah.json';
import type { SalahKey } from './settings';

/**
 * Adhkar after the prayer (Hisn al-Muslim, ch. 25), in the order they are recited.
 * Some are only said after Fajr and/or Maghrib; the Mu'awwidhat are said three times after those two.
 * The screen shows each one long enough to be recited, so the whole sequence is time-based and
 * survives a reload (the current item is derived from the time elapsed since the end of the prayer).
 */
export interface AfterItem {
  id: string;
  ar: string;
  en?: string;
  translit?: string;
  quran?: boolean;
  title?: string;
  note?: string;
  prayers: SalahKey[];
  repeat: number;
  repeatFajrMaghrib?: number;
}

const ITEMS = data as AfterItem[];

export interface Step { item: AfterItem; repeat: number; seconds: number }

/** Reading time: a calm recitation pace, plus time for repetitions (capped so 33× tasbih stays reasonable). */
function secondsFor(item: AfterItem, repeat: number): number {
  const words = item.ar.split(/\s+/).length;
  const once = 6 + words * 0.75;
  const extra = repeat > 1 ? Math.min(repeat, 33) * (item.id === 'tasbih' ? 1.3 : 2) : 0;
  return Math.round(Math.min(90, once + extra));
}

export function sequence(key: SalahKey): Step[] {
  return ITEMS.filter((it) => it.prayers.indexOf(key) >= 0).map((item) => {
    const repeat = (key === 'fajr' || key === 'maghrib') && item.repeatFajrMaghrib ? item.repeatFajrMaghrib : item.repeat;
    return { item, repeat, seconds: secondsFor(item, repeat) };
  });
}

export function sequenceSeconds(key: SalahKey): number {
  return sequence(key).reduce((a, s) => a + s.seconds, 0);
}

/** The step to show `elapsed` seconds after the adhkar started (loops if the phase is longer). */
export function stepAt(key: SalahKey, elapsed: number): { index: number; total: number; step: Step; progress: number } {
  const seq = sequence(key);
  const total = seq.reduce((a, s) => a + s.seconds, 0);
  let t = ((elapsed % total) + total) % total;
  for (let i = 0; i < seq.length; i++) {
    if (t < seq[i].seconds) return { index: i, total: seq.length, step: seq[i], progress: t / seq[i].seconds };
    t -= seq[i].seconds;
  }
  return { index: seq.length - 1, total: seq.length, step: seq[seq.length - 1], progress: 1 };
}
