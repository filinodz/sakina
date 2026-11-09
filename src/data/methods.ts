import type { MethodId } from '../core/settings';

/**
 * Calculation conventions. Angles are those published by each authority
 * (cross-checked against https://api.aladhan.com/v1/methods).
 * `aladhan` is the method id used when the source is the Aladhan API.
 * `ishaInterval` (minutes after Maghrib) replaces the Isha angle when set.
 * `dhuhrAdj` / `maghribAdj` are fixed precautionary offsets (ihtiyat) some authorities apply
 * (same values as Aladhan's method offsets).
 */
export interface MethodDef {
  id: MethodId;
  label: string;
  region: string;
  fajr: number;
  isha: number;
  ishaInterval?: number;
  maghribAngle?: number;
  dhuhrAdj?: number;
  maghribAdj?: number;
  adhanPreset?: 'MuslimWorldLeague' | 'Egyptian' | 'Karachi' | 'UmmAlQura' | 'Dubai' | 'MoonsightingCommittee' | 'NorthAmerica' | 'Kuwait' | 'Qatar' | 'Singapore' | 'Tehran' | 'Turkey';
  aladhan: number;
}

export const METHODS: MethodDef[] = [
  { id: 'algeria', label: 'Algérie — Ministère des Affaires religieuses', region: 'DZ', fajr: 18, isha: 17, aladhan: 19 },
  { id: 'morocco', label: 'Maroc — Ministère des Habous', region: 'MA', fajr: 19, isha: 17, dhuhrAdj: 5, maghribAdj: 5, aladhan: 21 },
  { id: 'tunisia', label: 'Tunisie', region: 'TN', fajr: 18, isha: 18, aladhan: 18 },
  { id: 'mwl', label: 'Ligue Islamique Mondiale (MWL)', region: 'EU', fajr: 18, isha: 17, adhanPreset: 'MuslimWorldLeague', aladhan: 3 },
  { id: 'egypt', label: 'Égypte — Autorité Générale d’Arpentage', region: 'EG', fajr: 19.5, isha: 17.5, adhanPreset: 'Egyptian', aladhan: 5 },
  { id: 'makkah', label: 'Umm al-Qura, La Mecque', region: 'SA', fajr: 18.5, isha: 0, ishaInterval: 90, adhanPreset: 'UmmAlQura', aladhan: 4 },
  { id: 'france12', label: 'France — UOIF (12°)', region: 'FR', fajr: 12, isha: 12, aladhan: 12 },
  { id: 'france15', label: 'France — 15°', region: 'FR', fajr: 15, isha: 15, aladhan: 2 },
  { id: 'france18', label: 'France — Grande Mosquée de Paris (18°)', region: 'FR', fajr: 18, isha: 18, aladhan: 99 },
  { id: 'isna', label: 'Amérique du Nord (ISNA)', region: 'US', fajr: 15, isha: 15, adhanPreset: 'NorthAmerica', aladhan: 2 },
  { id: 'karachi', label: 'Karachi — Univ. des Sciences Islamiques', region: 'PK', fajr: 18, isha: 18, adhanPreset: 'Karachi', aladhan: 1 },
  { id: 'dubai', label: 'Dubaï', region: 'AE', fajr: 18.2, isha: 18.2, adhanPreset: 'Dubai', aladhan: 16 },
  { id: 'kuwait', label: 'Koweït', region: 'KW', fajr: 18, isha: 17.5, adhanPreset: 'Kuwait', aladhan: 9 },
  { id: 'qatar', label: 'Qatar', region: 'QA', fajr: 18, isha: 0, ishaInterval: 90, adhanPreset: 'Qatar', aladhan: 10 },
  { id: 'jordan', label: 'Jordanie — Ministère des Awqaf', region: 'JO', fajr: 18, isha: 18, maghribAdj: 5, aladhan: 23 },
  { id: 'singapore', label: 'Singapour / Malaisie / Indonésie', region: 'SG', fajr: 20, isha: 18, adhanPreset: 'Singapore', aladhan: 11 },
  { id: 'turkey', label: 'Turquie — Diyanet', region: 'TR', fajr: 18, isha: 17, adhanPreset: 'Turkey', aladhan: 13 },
  { id: 'russia', label: 'Russie — Administration spirituelle', region: 'RU', fajr: 16, isha: 15, aladhan: 14 },
  { id: 'tehran', label: 'Téhéran — Institut de géophysique', region: 'IR', fajr: 17.7, isha: 14, maghribAngle: 4.5, adhanPreset: 'Tehran', aladhan: 7 },
  { id: 'moonsighting', label: 'Moonsighting Committee Worldwide', region: 'WW', fajr: 18, isha: 18, adhanPreset: 'MoonsightingCommittee', aladhan: 15 },
  { id: 'custom', label: 'Personnalisée (angles manuels)', region: '', fajr: 18, isha: 17, aladhan: 99 },
];

export const methodById = (id: MethodId) => METHODS.find((m) => m.id === id) ?? METHODS[0];

/** Best default convention for a country code (ISO-3166 alpha-2). */
export function methodForCountry(cc: string): MethodId {
  const c = (cc || '').toUpperCase();
  const map: Record<string, MethodId> = {
    DZ: 'algeria', MA: 'morocco', TN: 'tunisia', LY: 'egypt', EG: 'egypt', SD: 'egypt', SY: 'egypt', LB: 'egypt', IQ: 'mwl',
    SA: 'makkah', YE: 'makkah', BH: 'makkah', OM: 'makkah', AE: 'dubai', KW: 'kuwait', QA: 'qatar', JO: 'jordan', PS: 'jordan',
    FR: 'france12', BE: 'mwl', CH: 'mwl', DE: 'mwl', NL: 'mwl', GB: 'mwl', ES: 'mwl', IT: 'mwl',
    US: 'isna', CA: 'isna', PK: 'karachi', IN: 'karachi', BD: 'karachi', AF: 'karachi',
    MY: 'singapore', SG: 'singapore', ID: 'singapore', BN: 'singapore', TR: 'turkey', RU: 'russia', IR: 'tehran',
  };
  return map[c] ?? 'mwl';
}
