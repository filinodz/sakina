/** Hand-drawn inline SVG icons (stroke = currentColor). */
const s = (body: string, vb = '0 0 24 24') =>
  `<svg viewBox="${vb}" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;

export const icons = {
  gear: s('<circle cx="12" cy="12" r="3.2"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  expand: s('<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>'),
  sound: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  phoneOff: s('<rect x="7" y="2.5" width="10" height="19" rx="2.4"/><path d="M11 18.5h2M3 3l18 18"/>'),
  pin: s('<path d="M12 21s-6.5-6.1-6.5-11.2A6.5 6.5 0 0 1 18.5 9.8C18.5 14.9 12 21 12 21z"/><circle cx="12" cy="9.8" r="2.3"/>'),
  play: s('<path d="M8 5.5v13l10.5-6.5z" fill="currentColor"/>'),
  stop: s('<rect x="6.5" y="6.5" width="11" height="11" rx="1.5" fill="currentColor"/>'),
  download: s('<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>'),
  check: s('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  close: s('<path d="M6 6l12 12M18 6 6 18"/>'),
  upload: s('<path d="M12 20V9M7.5 13.5 12 9l4.5 4.5M5 4.5h14"/>'),
  locate: s('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>'),
  search: s('<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>'),
  // Weather
  clear: s('<circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>'),
  moon: s('<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>'),
  partly: s('<path d="M8.5 5.2V3.8M4.2 9.5H2.8M5.4 6.4l-1-1M12.6 6.4l1-1"/><path d="M5.6 11.4a3.4 3.4 0 0 1 6.3-2.2"/><path d="M7.5 19.5h10a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.3A2.9 2.9 0 0 0 7.5 19.5z"/>'),
  cloud: s('<path d="M7 18.5h10.5a4 4 0 0 0 .3-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18.5z"/>'),
  fog: s('<path d="M4 9h16M3 13h18M5 17h14"/>'),
  rain: s('<path d="M7 14.5h10.5a4 4 0 0 0 .3-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 14.5z"/><path d="M8.5 17.5 7.5 20M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5"/>'),
  snow: s('<path d="M7 14h10.5a4 4 0 0 0 .3-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 14z"/><path d="M8.5 18h.01M12 20h.01M15.5 18h.01" stroke-width="2.6"/>'),
  storm: s('<path d="M7 14h10.5a4 4 0 0 0 .3-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 14z"/><path d="m12.5 14-2 3.5h3l-2 3.5"/>'),
};

/** Eight-pointed star (Rub el Hizb) — the recurring ornament. */
export const star8 = (cls = 'star8') =>
  `<svg class="${cls}" viewBox="0 0 100 100" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="2.2"><rect x="21" y="21" width="58" height="58"/><rect x="21" y="21" width="58" height="58" transform="rotate(45 50 50)"/><circle cx="50" cy="50" r="13"/></g></svg>`;

/** Ornamental divider: line — star — line. */
export const divider = () =>
  `<svg class="divider" viewBox="0 0 400 24" preserveAspectRatio="none" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.2"><path d="M0 12h168M232 12h168"/><path d="M200 2l10 10-10 10-10-10z"/><path d="M178 12l6-6 6 6-6 6zM210 12l6-6 6 6-6 6z"/></g></svg>`;

/**
 * Seamless girih-style tile (8-fold star & cross) for the pattern background
 * and subtle panel textures. Returned as a data-URI usable in CSS.
 */
export function patternDataUri(color: string, opacity = 0.14): string {
  const c = encodeURIComponent(color);
  const svgStr = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'><g fill='none' stroke='${c}' stroke-opacity='${opacity}' stroke-width='1.1'><path d='M60 14 73 47 106 60 73 73 60 106 47 73 14 60 47 47Z'/><path d='M27.5 27.5 60 41 92.5 27.5 79 60 92.5 92.5 60 79 27.5 92.5 41 60Z'/><circle cx='60' cy='60' r='12'/><path d='M0 0 14 0 0 14ZM120 0 106 0 120 14ZM0 120 14 120 0 106ZM120 120 106 120 120 106Z'/><path d='M60 0v14M60 106v14M0 60h14M106 60h14'/></g></svg>`;
  return `url("data:image/svg+xml,${svgStr.replace(/#/g, '%23').replace(/</g, '%3C').replace(/>/g, '%3E').replace(/"/g, "'")}")`;
}
