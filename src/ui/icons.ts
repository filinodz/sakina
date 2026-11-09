/**
 * Icons come from Lucide (https://lucide.dev, ISC licence) — a professional, consistent
 * icon set — rendered to inline SVG strings. Only the icons imported here are bundled.
 * The Islamic ornament is the real Unicode glyph ۞ (U+06DE, "start of rub el hizb")
 * from Noto Kufi Arabic (SIL OFL), not a drawing.
 */
import {
  Settings, Maximize, Volume2, BellOff, Play, Square, Download, Check, X, Upload, LocateFixed, Search,
  Sun, Moon, MoonStar, Sunrise, Sunset, SunMedium, CloudSun, CloudMoon, Cloud, CloudFog, CloudRain, CloudSnow, CloudLightning,
  Landmark, Users, MapPin, Clock, Hourglass, Volume1, Palette, HardDriveDownload, BookOpen, ScrollText, Megaphone,
  type IconNode,
} from 'lucide';
// Brand mark (Phosphor Icons, MIT) — same artwork as the app icon.
import mosqueMark from '@phosphor-icons/core/assets/fill/mosque-fill.svg?raw';

function render(node: IconNode, strokeWidth = 1.75): string {
  const body = node.map(([tag, attrs]) =>
    `<${tag} ${Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ')}/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const icons = {
  gear: render(Settings), expand: render(Maximize), sound: render(Volume2), phoneOff: render(BellOff),
  play: render(Play), stop: render(Square), download: render(Download), check: render(Check, 2),
  close: render(X), upload: render(Upload), locate: render(LocateFixed), search: render(Search),
  // weather
  clear: render(Sun), moon: render(Moon), partly: render(CloudSun), partlyNight: render(CloudMoon), cloud: render(Cloud),
  fog: render(CloudFog), rain: render(CloudRain), snow: render(CloudSnow), storm: render(CloudLightning),
  // prayers
  fajr: render(MoonStar), sunrise: render(Sunrise), dhuhr: render(Sun), asr: render(SunMedium), maghrib: render(Sunset), isha: render(Moon),
  // content & settings sections
  mosque: render(Landmark), mapPin: render(MapPin), clock: render(Clock), hourglass: render(Hourglass), adhan: render(Volume1),
  palette: render(Palette), backup: render(HardDriveDownload), book: render(BookOpen), scroll: render(ScrollText), megaphone: render(Megaphone), rows: render(Users),
};

/** ۞ — Rub el Hizb, the Qur'anic section mark, as a real glyph. */
export const ornament = (cls = 'orn') => `<span class="${cls}" aria-hidden="true">۞</span>`;

/** Hairline — ۞ — hairline. */
export const divider = () => `<span class="divider" aria-hidden="true"><i></i><b>۞</b><i></i></span>`;

/** The Sakina brand mark (a mosque), used where no mosque logo was uploaded. */
export const brandMark = () => mosqueMark.replace('<svg', '<svg class="brand-mark" aria-hidden="true" fill="currentColor"');
