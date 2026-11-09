import { deviceTimeZone } from './time';

export type PrayerKey = 'fajr' | 'sunrise' | 'dhuhr' | 'asr' | 'maghrib' | 'isha';
export type SalahKey = Exclude<PrayerKey, 'sunrise'>;
export const PRAYERS: PrayerKey[] = ['fajr', 'sunrise', 'dhuhr', 'asr', 'maghrib', 'isha'];
export const SALAWAT: SalahKey[] = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];

export type Lang = 'fr' | 'en' | 'ar';
export type MethodId =
  | 'algeria' | 'mwl' | 'egypt' | 'makkah' | 'karachi' | 'isna' | 'morocco' | 'tunisia'
  | 'france12' | 'france15' | 'france18' | 'dubai' | 'kuwait' | 'qatar' | 'singapore' | 'turkey'
  | 'tehran' | 'moonsighting' | 'jordan' | 'russia' | 'custom';

export interface IqamaRule { mode: 'offset' | 'fixed'; offset: number; time: string }

export interface Settings {
  version: 1;
  mode: 'mosque' | 'home';
  lang: Lang;
  mosque: {
    name: string; nameAr: string; address: string; phone: string; website: string;
    announcements: string[]; jumuah: string[]; hasImage: boolean; hasLogo: boolean;
  };
  location: { lat: number; lng: number; city: string; country: string; countryCode: string; timezone: string; configured: boolean };
  calc: {
    source: 'calc' | 'api' | 'table';
    method: MethodId;
    fajrAngle: number; ishaAngle: number; ishaInterval: number;
    madhab: 'shafi' | 'hanafi';
    highLat: 'auto' | 'middle' | 'seventh';
    adjust: Record<PrayerKey, number>;
    hijriAdjust: number;
    hijriAtMaghrib: boolean;
  };
  iqama: Record<SalahKey, IqamaRule> & { jumuahOffset: number };
  phases: {
    iqamaCountdown: boolean; prayerMinutes: number; jumuahMinutes: number; adhanScreenMinutes: number;
    /** after-prayer adhkar: shown automatically for as long as it takes to recite them */
    adhkar: boolean; adhkarAuto: boolean; adhkarMinutes: number; adhkarHome: boolean;
  };
  athan: {
    enabled: boolean; volume: number; sound: string; fajrSound: string;
    perPrayer: Record<SalahKey, 'athan' | 'beep' | 'off'>;
    iqamaBeep: boolean; preAlertMinutes: number;
    fajrVolume: number;
    custom: { id: string; name: string }[];
  };
  display: {
    theme: 'emerald' | 'night' | 'sand' | 'royal';
    background: 'slideshow' | 'mosque' | 'pattern';
    backgrounds: string[];
    slideSeconds: number;
    kenBurns: boolean;
    lite: 'auto' | 'on' | 'off';
    clock24: boolean;
    showSeconds: boolean;
    contentSeconds: number;
    showAyat: boolean; showAdhkar: boolean; showAnnouncements: boolean;
    ticker: boolean; weather: boolean;
    orientation: 'auto' | 'landscape' | 'portrait';
    nightDim: boolean;
    /** '' = automatic (Isha + 1 h → 45 min before Fajr) */
    nightDimFrom: string; nightDimTo: string;
    tickerHadith: boolean;
    tickerSpeed: 'slow' | 'normal' | 'fast';
    /** 'ar': Arabic texts, scrolling left → right; 'translation': French/English, scrolling right → left */
    tickerLang: 'ar' | 'translation';
    phoneNotice: boolean;
    textScale: number;
    arabicDigits: boolean;
    showSunrise: boolean;
    showIqamaOnCards: boolean;
    showDuha: boolean;
    showQiyam: boolean;
    showHijri: boolean;
    tempUnit: 'c' | 'f';
  };
  eid: { date: string; time: string };
  ramadan: { auto: boolean; force: boolean; imsakOffset: number };
  timetable: Record<string, string[]>; // "MM-DD" or "YYYY-MM-DD" → [fajr, sunrise, dhuhr, asr, maghrib, isha]
  pin: string;
}

const KEY = 'sakina.settings.v1';

export function defaults(): Settings {
  const tz = deviceTimeZone();
  return {
    version: 1,
    mode: 'mosque',
    lang: (navigator.language || 'fr').slice(0, 2) === 'ar' ? 'ar' : (navigator.language || '').startsWith('en') ? 'en' : 'fr',
    mosque: {
      name: 'Mosquée', nameAr: 'المسجد', address: '', phone: '', website: '',
      announcements: [],
      jumuah: ['13:00'], hasImage: false, hasLogo: false,
    },
    // Default: Algiers. A first-run wizard asks for the real location.
    location: { lat: 36.7538, lng: 3.0588, city: 'Alger', country: 'Algérie', countryCode: 'DZ', timezone: tz === 'UTC' ? 'Africa/Algiers' : tz, configured: false },
    calc: {
      source: 'calc', method: 'algeria', fajrAngle: 18, ishaAngle: 17, ishaInterval: 0,
      madhab: 'shafi', highLat: 'auto',
      adjust: { fajr: 0, sunrise: 0, dhuhr: 0, asr: 0, maghrib: 0, isha: 0 },
      hijriAdjust: 0, hijriAtMaghrib: true,
    },
    iqama: {
      fajr: { mode: 'offset', offset: 20, time: '06:00' },
      dhuhr: { mode: 'offset', offset: 15, time: '13:15' },
      asr: { mode: 'offset', offset: 15, time: '16:00' },
      maghrib: { mode: 'offset', offset: 7, time: '19:00' },
      isha: { mode: 'offset', offset: 15, time: '21:00' },
      jumuahOffset: 0,
    },
    phases: { iqamaCountdown: true, prayerMinutes: 10, jumuahMinutes: 45, adhanScreenMinutes: 4, adhkar: true, adhkarAuto: true, adhkarMinutes: 5, adhkarHome: true },
    athan: {
      enabled: true, volume: 0.9, sound: 'mishary-afasy', fajrSound: 'mishary-fajr',
      perPrayer: { fajr: 'athan', dhuhr: 'athan', asr: 'athan', maghrib: 'athan', isha: 'athan' },
      iqamaBeep: true, preAlertMinutes: 0, fajrVolume: 0.9, custom: [],
    },
    display: {
      theme: 'emerald', background: 'slideshow', backgrounds: [], slideSeconds: 45, kenBurns: true,
      lite: 'auto', clock24: true, showSeconds: true, contentSeconds: 20,
      showAyat: true, showAdhkar: true, showAnnouncements: true, ticker: true, weather: true,
      orientation: 'auto', nightDim: false, nightDimFrom: '', nightDimTo: '',
      tickerHadith: true, tickerSpeed: 'normal', tickerLang: 'ar', phoneNotice: true, textScale: 1, arabicDigits: false,
      showSunrise: true, showIqamaOnCards: true, showDuha: false, showQiyam: false, showHijri: true, tempUnit: 'c',
    },
    eid: { date: '', time: '' },
    ramadan: { auto: true, force: false, imsakOffset: 10 },
    timetable: {},
    pin: '',
  };
}

/** Deep-merge stored values onto defaults so new settings appear after an update. */
function merge<T>(base: T, over: unknown): T {
  if (Array.isArray(base)) return (Array.isArray(over) ? over : base) as T;
  if (base && typeof base === 'object') {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    if (over && typeof over === 'object') {
      for (const k of Object.keys(over as object)) {
        const bv = (base as Record<string, unknown>)[k];
        const ov = (over as Record<string, unknown>)[k];
        out[k] = bv === undefined ? ov : merge(bv, ov);
      }
    }
    return out as T;
  }
  return (over === undefined || over === null || typeof over !== typeof base ? base : over) as T;
}

type Listener = (s: Settings) => void;
const listeners = new Set<Listener>();
let current: Settings = load();

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = merge(defaults(), JSON.parse(raw));
      // v1.0 shipped the phone reminder as a default notice; it is now shown automatically at prayer time.
      const legacy = ['Merci de mettre vos téléphones en mode silencieux', 'يرجى إغلاق الهواتف النقالة'];
      s.mosque.announcements = s.mosque.announcements.filter((a) => legacy.indexOf(a) < 0);
      return s;
    }
  } catch { /* private mode / corrupted — fall back to defaults */ }
  return defaults();
}

export const settings = {
  get: () => current,
  set(mutator: (s: Settings) => void) {
    const next: Settings = JSON.parse(JSON.stringify(current));
    mutator(next);
    current = next;
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* quota */ }
    listeners.forEach((l) => l(current));
  },
  replace(raw: unknown) {
    current = merge(defaults(), raw);
    try { localStorage.setItem(KEY, JSON.stringify(current)); } catch { /* quota */ }
    listeners.forEach((l) => l(current));
  },
  reset() { this.replace({}); },
  subscribe(l: Listener) { listeners.add(l); return () => listeners.delete(l); },
  export: () => JSON.stringify(current, null, 2),
};
