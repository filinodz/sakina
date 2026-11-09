import type { YMD } from './time';

export interface Hijri { y: number; m: number; d: number }

export const HIJRI_MONTHS_AR = ['محرّم', 'صفر', 'ربيع الأول', 'ربيع الآخر', 'جمادى الأولى', 'جمادى الآخرة', 'رجب', 'شعبان', 'رمضان', 'شوّال', 'ذو القعدة', 'ذو الحجّة'];
export const HIJRI_MONTHS_LAT = ['Mouharram', 'Safar', 'Rabi‘ al-Awwal', 'Rabi‘ ath-Thani', 'Joumada al-Oula', 'Joumada ath-Thania', 'Rajab', 'Cha‘bane', 'Ramadan', 'Chawwal', 'Dhou al-Qi‘da', 'Dhou al-Hijja'];

let umalqura: Intl.DateTimeFormat | null | undefined;
function umalquraFormatter(): Intl.DateTimeFormat | null {
  if (umalqura !== undefined) return umalqura;
  try {
    const f = new Intl.DateTimeFormat('en-u-ca-islamic-umalqura-nu-latn', { timeZone: 'UTC', day: 'numeric', month: 'numeric', year: 'numeric' });
    umalqura = f.resolvedOptions().calendar.indexOf('islamic') === 0 ? f : null;
  } catch { umalqura = null; }
  return umalqura;
}

/** Tabular (Kuwaiti) algorithm — used when the WebView has no Umm al-Qura calendar (old TVs). */
function tabular(g: YMD): Hijri {
  let { y, m } = g; const d = g.d;
  if (m < 3) { y -= 1; m += 12; }
  const a = Math.floor(y / 100);
  const b = 2 - a + Math.floor(a / 4);
  const jd = Math.floor(365.25 * (y + 4716)) + Math.floor(30.6001 * (m + 1)) + d + b - 1524;
  const l0 = jd - 1948440 + 10632;
  const n = Math.floor((l0 - 1) / 10631);
  const l1 = l0 - 10631 * n + 354;
  const j = Math.floor((10985 - l1) / 5316) * Math.floor((50 * l1) / 17719) + Math.floor(l1 / 5670) * Math.floor((43 * l1) / 15238);
  const l2 = l1 - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const hm = Math.floor((24 * l2) / 709);
  const hd = l2 - Math.floor((709 * hm) / 24);
  const hy = 30 * n + j - 30;
  return { y: hy, m: hm, d: hd };
}

/** Gregorian civil day → Hijri date, with a manual ±days correction (local moon sighting). */
export function toHijri(g: YMD, adjustDays = 0): Hijri {
  const t = new Date(Date.UTC(g.y, g.m - 1, g.d + adjustDays, 12));
  const f = umalquraFormatter();
  if (f) {
    const p: Record<string, number> = {};
    for (const x of f.formatToParts(t)) if (x.type !== 'literal') p[x.type] = parseInt(x.value, 10);
    if (p.year && p.month && p.day) return { y: p.year, m: p.month, d: p.day };
  }
  return tabular({ y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate() });
}

export const toArabicDigits = (s: string | number) => String(s).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[+d]);
