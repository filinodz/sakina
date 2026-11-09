import '@fontsource/amiri-quran/arabic-400.css';
import '@fontsource/amiri/arabic-400.css';
import '@fontsource/amiri/arabic-700.css';
import '@fontsource/amiri/latin-400.css'; // punctuation such as ( ) — without it a fallback font mirrors them wrongly
import '@fontsource/amiri/latin-700.css';
import '@fontsource/reem-kufi/arabic-500.css';
import '@fontsource/reem-kufi/arabic-600.css';
import '@fontsource-variable/manrope/wght.css';
import '@fontsource/cormorant-garamond/latin-500.css';
import '@fontsource/cormorant-garamond/latin-600.css';
import '@fontsource/cormorant-garamond/latin-500-italic.css';
import './styles/base.css';
import './styles/display.css';
import './styles/settings.css';

import { settings } from './core/settings';
import { warmApi } from './core/prayer';
import { invalidate } from './core/schedule';
import { isNative, unlockAudio } from './core/audio';
import { t } from './core/i18n';
import { clock } from './core/clock';
import { fromZoned, todayIn } from './core/time';
import { Display } from './ui/display';
import { SettingsPanel, askPin } from './ui/settings-panel';
import { h, svg } from './ui/dom';
import { icons } from './ui/icons';

const params = new URLSearchParams(location.search);

// Showcase mode (screenshots, kiosk demos): ?demo&theme=night&lang=ar&orient=portrait&settings=athan
const demo = params.has('demo');
if (demo) {
  document.documentElement.classList.add('demo');
  settings.set((s) => {
    s.location.configured = true;
    if (s.mosque.name === 'Mosquée') { s.mosque.name = 'Mosquée An-Nour'; s.mosque.nameAr = 'مسجد النور'; }
    const theme = params.get('theme');
    if (theme === 'emerald' || theme === 'night' || theme === 'sand' || theme === 'royal') s.display.theme = theme;
    const lang = params.get('lang');
    if (lang === 'fr' || lang === 'en' || lang === 'ar') s.lang = lang;
    const o = params.get('orient');
    if (o === 'portrait' || o === 'landscape' || o === 'auto') s.display.orientation = o;
    const bg = params.get('bg');
    if (bg) s.display.backgrounds = [bg];
  });
}

// Preview helper: ?at=HH:MM[:SS] shifts the display clock to that time today (mosque time zone).
const at = params.get('at');
if (at) {
  const m = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(at);
  if (m) {
    const s = settings.get();
    const d = todayIn(s.location.timezone);
    const target = fromZoned(d.y, d.m, d.d, +m[1], +m[2], s.location.timezone).getTime() + (+(m[3] || 0)) * 1000;
    clock.offset = target - Date.now();
  }
}

const viewport = document.getElementById('viewport')!;
const display = new Display(viewport);
const panel = new SettingsPanel();

/* ---------------- Clock loop, aligned on the second boundary ---------------- */
let timer = 0;
function loop() {
  display.tick();
  timer = window.setTimeout(loop, 1000 - (Date.now() % 1000) + 5);
}
loop();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') { clearTimeout(timer); loop(); void keepAwake(); }
});

/* ---------------- Settings access (remote OK / Menu, keyboard, toolbar) ---------------- */
async function openSettings(section?: Parameters<SettingsPanel['open']>[0], banner?: string) {
  if (panel.isOpen) return;
  const s = settings.get();
  if (s.pin && !(await askPin(s.lang, s.pin))) return;
  panel.open(section, banner);
}
panel.onClose(() => { invalidate(); display.apply(settings.get()); viewport.focus(); });

document.addEventListener('keydown', (e) => {
  unlockAudio();
  if (panel.isOpen || document.querySelector('.pin')) return;
  switch (e.key) {
    case 'Enter': case 'ContextMenu': case 'Menu': case 's': case 'S':
      e.preventDefault(); void openSettings(); break;
    case 'ArrowRight': display.nav(document.documentElement.dir === 'rtl' ? -1 : 1); break;
    case 'ArrowLeft': display.nav(document.documentElement.dir === 'rtl' ? 1 : -1); break;
    case 'f': case 'F': void toggleFullscreen(); break;
  }
});

/* ---------------- Android TV remote "Back" button ---------------- */
// By default Back would quit the app — on an unattended mosque screen it must only close the settings.
if (isNative()) {
  void import('@capacitor/app').then(({ App }) => {
    void App.addListener('backButton', () => {
      const pin = document.querySelector('.pin');
      if (pin) pin.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      else if (panel.isOpen) panel.close();
    });
  });
}

/* ---------------- Mouse / touch toolbar ---------------- */
const toolbar = h('div', { class: 'toolbar' },
  h('button', { type: 'button', 'aria-label': t('fullscreen', settings.get().lang), onclick: () => void toggleFullscreen() }, svg(icons.expand)),
  h('button', { type: 'button', 'aria-label': t('settings', settings.get().lang), onclick: () => void openSettings() }, svg(icons.gear)));
document.body.appendChild(toolbar);
let hideTb = 0;
const showToolbar = () => {
  toolbar.classList.add('show');
  clearTimeout(hideTb);
  hideTb = window.setTimeout(() => toolbar.classList.remove('show'), 3500);
};
document.addEventListener('mousemove', showToolbar, { passive: true });
document.addEventListener('touchstart', () => { unlockAudio(); showToolbar(); }, { passive: true });
document.addEventListener('click', () => unlockAudio());

async function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen();
    else await document.exitFullscreen();
  } catch { /* not allowed (e.g. iOS) */ }
}

/* ---------------- Keep the screen on ---------------- */
type WakeLockNav = Navigator & { wakeLock?: { request: (t: 'screen') => Promise<unknown> } };
async function keepAwake() {
  try { await (navigator as WakeLockNav).wakeLock?.request('screen'); } catch { /* unsupported */ }
}
void keepAwake();

/* ---------------- Offline support (PWA) ---------------- */
if (import.meta.env.PROD && 'serviceWorker' in navigator && location.protocol.indexOf('http') === 0 && !isNative()) {
  navigator.serviceWorker.register('./sw.js').catch(() => undefined); // unsupported context: the app still works online
}

/* ---------------- Online data (Aladhan cache) ---------------- */
async function refreshOnline() {
  try { await warmApi(settings.get()); invalidate(); display.tick(true); } catch { /* offline: local calculation keeps running */ }
}
void refreshOnline();
window.addEventListener('online', () => void refreshOnline());
setInterval(() => void refreshOnline(), 6 * 3600 * 1000);

/* ---------------- First run ---------------- */
(window as unknown as { __sakinaBooted: boolean }).__sakinaBooted = true;
// setTimeout rather than requestAnimationFrame: rAF is paused in background or throttled windows,
// which left the splash star stuck over the dashboard.
setTimeout(() => {
  document.getElementById('splash')?.classList.add('gone');
  setTimeout(() => document.getElementById('splash')?.remove(), 1000);
  const s = settings.get();
  const section = params.get('settings');
  if (demo && section) void openSettings(section as Parameters<SettingsPanel['open']>[0]);
  else if (!s.location.configured) {
    const lang = s.lang;
    void openSettings('location', lang === 'ar'
      ? 'السلام عليكم! حدّد موقع المسجد للحصول على مواقيت دقيقة.'
      : lang === 'en'
        ? 'Assalamu alaykum! Set the mosque’s location to get exact prayer times.'
        : 'As-salâm ‘alaykoum ! Indiquez l’emplacement de la mosquée pour obtenir des horaires exacts.');
  }
}, 60);
