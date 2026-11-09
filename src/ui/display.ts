import ayatData from '../data/ayat.json';
import adhkarData from '../data/adhkar.json';
import ahadithData from '../data/ahadith.json';
import backgroundsData from '../data/backgrounds.json';
import { computeState, type State } from '../core/schedule';
import { iqamaTime } from '../core/prayer';
import { clock } from '../core/clock';
import { PRAYERS, SALAWAT, settings, type PrayerKey, type Settings } from '../core/settings';
import { formatCountdown, formatHM, meridiem, tzOffsetMinutes, zoned } from '../core/time';
import { HIJRI_MONTHS_AR, toArabicDigits } from '../core/hijri';
import { locale, prayerName, PRAYER_AR, t } from '../core/i18n';
import { audioUnlocked, chime, onUnlock, playAthan, stopAudio, fadeOut } from '../core/audio';
import { blobUrl } from '../core/idb';
import { fetchWeather, weatherKind, type Weather } from '../core/geo';
import { $, h, setText, svg, toggleClass } from './dom';
import { brandMark, divider, icons, ornament } from './icons';

interface Ayah { ref: string; surah: { number: number; ar: string; en: string }; ar: string; fr: string; en: string }
interface Dhikr { id: number; chapter: number; title: { ar: string; en: string }; ar: string; en: string; translit: string; repeat: number }
type Slide = { kind: 'ayah'; v: Ayah } | { kind: 'dhikr'; v: Dhikr } | { kind: 'ann'; v: string };

const AYAT = ayatData as Ayah[];
const ADHKAR = adhkarData as Dhikr[];
interface Hadith { ref: { collection: string; number: number; ar: string; fr: string; en: string }; ar: string; fr: string; en: string }
const AHADITH = ahadithData as Hadith[];
const AFTER_SALAH = ADHKAR.filter((d) => d.chapter === 25);
const DUA_AFTER_ADHAN = ADHKAR.find((d) => d.id === 25);
const BACKGROUNDS = backgroundsData as { id: string; label: string }[];

const isArabic = (s: string) => /[؀-ۿ]/.test(s);
const shuffle = <T,>(a: T[]) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const sizeClass = (n: number) => (n < 95 ? 'sz-s' : n < 180 ? 'sz-m' : n < 300 ? 'sz-l' : 'sz-xl');
/** Hisn al-Muslim often wraps the spoken words in (( )) after a short instruction: keep the words. */
const spoken = (s: string) => { const m = /\(\(([^]*?)\)\)/.exec(s); return (m ? m[1] : s).replace(/^يَقُولُ:\s*/, '').trim(); };

export function isLite(s: Settings): boolean {
  if (s.display.lite === 'on') return true;
  if (s.display.lite === 'off') return false;
  const nav = navigator as Navigator & { deviceMemory?: number };
  return (nav.hardwareConcurrency || 4) <= 2 || (nav.deviceMemory !== undefined && nav.deviceMemory <= 1.5);
}

export class Display {
  readonly stage: HTMLDivElement;
  private s: Settings = settings.get();
  private lite = false;
  private portrait = false;
  private offsetMin = 0;
  private offsetMinuteStamp = -1;
  private lastPhaseSig = '';
  private lastPreAlert = 0;
  private lastAdhanAt = 0;
  private lastIqamaAt = 0;
  private bgList: string[] = [];
  private bgIdx = 0;
  private bgFlip = false;
  private bgTimer = 0;
  private slides: Slide[] = [];
  private slideIdx = -1;
  private slideTimer = 0;
  private adhkarIdx = 0;
  private adhkarStamp = 0;
  private weather: Weather | null = null;
  private weatherAt = 0;
  private soundPrompt: HTMLElement | null = null;
  private dateKey = '';
  private cardMinute = -1;
  private chipsSig = '';
  private cards = {} as Record<PrayerKey, { root: HTMLElement; ar: HTMLElement; lat: HTMLElement; time: HTMLElement; iqama: HTMLElement; iqamaVal: HTMLElement; prog: HTMLElement }>;
  private r!: Record<string, HTMLElement>;

  constructor(viewport: HTMLElement) {
    this.stage = h('div', { class: 'stage' });
    viewport.appendChild(this.stage);
    this.build();
    this.apply(settings.get());
    settings.subscribe((s) => this.apply(s));
    window.addEventListener('resize', () => this.fit());
    onUnlock(() => { this.soundPrompt?.remove(); this.soundPrompt = null; });
  }

  /* ------------------------------------------------------------------ build */
  private build() {
    const r: Record<string, HTMLElement> = {};
    const mk = <K extends keyof HTMLElementTagNameMap>(name: string, tag: K, cls: string, ...kids: (Node | string)[]) => (r[name] = h(tag, { class: cls }, ...kids));

    const bg = h('div', { class: 'bg' },
      mk('bgA', 'div', 'bg-layer'), mk('bgB', 'div', 'bg-layer'), h('div', { class: 'bg-shade' }));

    const top = h('header', { class: 'top' },
      h('div', { class: 'brand' },
        mk('logo', 'div', 'logo'),
        h('div', { class: 'brand-text' }, mk('brandAr', 'div', 'brand-ar ar'), mk('brandLat', 'div', 'brand-lat'))),
      h('div', { class: 'top-right' },
        mk('weather', 'div', 'weather hidden'),
        h('div', { class: 'dates' }, mk('dateG', 'div', 'date-g'), mk('dateH', 'div', 'date-h ar'))));

    const hero = h('section', { class: 'hero' },
      h('div', { class: 'clock num' }, h('span', { class: 'hm' }, mk('hh', 'span', ''), h('span', { class: 'colon' }, ':'), mk('mm', 'span', '')), mk('sec', 'span', 'sec'), mk('ampm', 'span', 'ampm')),
      mk('next', 'div', 'next',
        h('div', { class: 'next-label' }, mk('nextLabel', 'span', ''), mk('nextAr', 'span', 'ar')),
        h('div', { class: 'next-row' }, mk('nextName', 'span', 'next-name'), mk('nextIn', 'span', 'next-in'), mk('nextCount', 'span', 'next-count num')),
        h('div', { class: 'next-bar' }, mk('nextBar', 'i', ''))),
      mk('chips', 'div', 'chips'));

    const feature = h('aside', { class: 'feature glass' },
      h('div', { class: 'feature-head' }, mk('featureKind', 'div', 'feature-kind'), mk('featureDots', 'div', 'feature-dots')),
      mk('featureBody', 'div', 'feature-body'));

    const prayers = mk('prayers', 'section', 'prayers');
    for (const k of PRAYERS) {
      const c = {
        root: h('div', { class: `card glass ${k}` }),
        ar: h('div', { class: 'card-ar ar' }),
        lat: h('div', { class: 'card-lat' }),
        time: h('div', { class: 'card-time num' }),
        iqama: h('div', { class: 'card-iqama' }),
        iqamaVal: h('b', { class: 'num' }),
        prog: h('i', { class: 'card-progress' }),
      };
      c.iqama.append(h('span', null, ''), c.iqamaVal);
      c.root.append(svg(icons[k], 'ico card-ico'), h('div', { class: 'card-name' }, c.ar, c.lat), c.time, c.iqama, c.prog);
      this.cards[k] = c;
      prayers.appendChild(c.root);
    }

    const ticker = h('footer', { class: 'ticker' },
      h('div', { class: 'ticker-label' }, svg(icons.megaphone)),
      h('div', { class: 'ticker-track' }, mk('tickerText', 'div', 'ticker-text'), mk('tickerAlert', 'div', 'ticker-alert')));

    const layout = h('div', { class: 'layout' }, top, hero, feature, prayers, ticker);
    this.stage.append(bg, layout, mk('overlay', 'div', 'overlay'), mk('dim', 'div', 'dim'));
    this.r = r;
  }

  /* ------------------------------------------------------------------ settings */
  apply(s: Settings) {
    const prev = this.s;
    this.s = s;
    this.lite = isLite(s);
    const root = document.documentElement;
    root.setAttribute('data-theme', s.display.theme);
    root.setAttribute('lang', s.lang);
    toggleClass(this.stage, 'lite', this.lite);
    toggleClass(document.body, 'lite', this.lite);
    toggleClass(this.stage, 'kb', s.display.kenBurns && !this.lite);
    toggleClass(this.stage, 'no-sec', !s.display.showSeconds);
    toggleClass(this.stage, 'no-ticker', !s.display.ticker || (!s.display.tickerHadith && !s.mosque.announcements.some((a) => a.trim())));
    toggleClass(this.stage, 'no-sunrise', !s.display.showSunrise);
    toggleClass(this.stage, 'no-iqama', !s.display.showIqamaOnCards);
    toggleClass(this.stage, 'no-hijri', !s.display.showHijri);
    this.stage.style.setProperty('--ts', String(s.display.textScale || 1));
    this.fit();

    // Brand
    setText(this.r.brandAr, s.mosque.nameAr || s.mosque.name);
    this.r.brandLat.innerHTML = '';
    this.r.brandLat.append(s.mosque.nameAr ? s.mosque.name : '', h('span', { class: 'city' }, s.location.city));
    void this.renderLogo();

    // Labels
    const L = s.lang;
    setText(this.r.nextLabel, t('next', L));
    setText(this.r.nextIn, t('in', L));
    for (const k of PRAYERS) {
      const c = this.cards[k];
      setText(c.lat, L === 'ar' ? '' : prayerName(k, L));
      setText(c.iqama.firstChild as HTMLElement, t('iqama', L));
      toggleClass(c.iqama, 'none', k === 'sunrise' || s.mode === 'home');
    }

    // Ticker
    this.buildTicker();
    this.r.tickerAlert.innerHTML = '';
    this.r.tickerAlert.append(svg(icons.phoneOff), h('span', { class: 'ar' }, 'يرجى إغلاق الهواتف النقالة'), L === 'ar' ? '' : h('span', null, t('silence', L)));

    // Background & slides only rebuild when relevant settings changed
    const bgSig = (x: Settings) => JSON.stringify([x.display.background, x.display.backgrounds, x.display.slideSeconds, x.mosque.hasImage, this.lite]);
    if (!this.bgList.length || bgSig(prev) !== bgSig(s) || prev === s) void this.setupBackground();
    const slideSig = (x: Settings) => JSON.stringify([x.lang, x.display.showAyat, x.display.showAdhkar, x.display.showAnnouncements, x.mosque.announcements, x.display.contentSeconds]);
    if (!this.slides.length || slideSig(prev) !== slideSig(s) || prev === s) this.setupSlides();

    this.dateKey = '';
    this.weatherAt = s.display.weather && prev.location.lat === s.location.lat ? this.weatherAt : 0;
    this.tick(true);
  }

  private async renderLogo() {
    const url = this.s.mosque.hasLogo ? await blobUrl('logo') : null;
    this.r.logo.innerHTML = '';
    if (url) this.r.logo.appendChild(h('img', { src: url, alt: '' }));
    else this.r.logo.innerHTML = brandMark();
  }

  fit() {
    const vw = window.innerWidth, vh = window.innerHeight;
    const o = this.s.display.orientation;
    const aspect = vw / Math.max(1, vh);
    // Square-ish browser windows use the vertical layout; TVs (16:9) the horizontal one.
    this.portrait = o === 'portrait' || (o === 'auto' && aspect < 1.25);
    toggleClass(this.stage, 'portrait', this.portrait);
    toggleClass(this.stage, 'landscape', !this.portrait);
    // The stage takes the window's exact aspect ratio (no black bars) while never shrinking
    // below the reference design size (1920×1080 / 1080×1920); the grid absorbs the extra space.
    const minW = this.portrait ? 1080 : 1920, minH = this.portrait ? 1920 : 1080;
    let W = minW, H = W / aspect;
    if (H < minH) { H = minH; W = H * aspect; }
    W = Math.round(W); H = Math.round(H);
    this.stage.style.width = `${W}px`;
    this.stage.style.height = `${H}px`;
    const k = Math.min(vw / W, vh / H);
    this.stage.style.transform = `translate(${(vw - W * k) / 2}px, ${(vh - H * k) / 2}px) scale(${k})`;
  }

  /* ------------------------------------------------------------------ background */
  private async setupBackground() {
    clearTimeout(this.bgTimer);
    const s = this.s;
    const dir = this.lite ? 'backgrounds/lite/' : 'backgrounds/';
    let list: string[] = [];
    if (s.display.background === 'mosque' && s.mosque.hasImage) {
      const u = await blobUrl('mosque');
      if (u) list = [u];
    }
    if (!list.length && s.display.background !== 'pattern') {
      const ids = s.display.backgrounds.length ? s.display.backgrounds : BACKGROUNDS.map((b) => b.id);
      list = shuffle(ids.filter((id) => BACKGROUNDS.some((b) => b.id === id))).map((id) => `${dir}${id}.jpg`);
    }
    this.bgList = list;
    this.bgIdx = 0;
    this.stage.style.setProperty('--kb-dur', `${s.display.slideSeconds + 6}s`);
    if (!list.length) { this.r.bgA.classList.remove('on'); this.r.bgB.classList.remove('on'); return; }
    this.nextBackground();
  }

  private nextBackground() {
    clearTimeout(this.bgTimer);
    const url = this.bgList[this.bgIdx % this.bgList.length];
    this.bgIdx++;
    const img = new Image();
    const show = () => {
      const [inEl, outEl] = this.bgFlip ? [this.r.bgB, this.r.bgA] : [this.r.bgA, this.r.bgB];
      this.bgFlip = !this.bgFlip;
      inEl.style.backgroundImage = `url("${url}")`;
      inEl.classList.remove('on', 'alt');
      void inEl.offsetWidth; // restart Ken Burns
      inEl.classList.add('on');
      if (this.bgIdx % 2) inEl.classList.add('alt');
      outEl.classList.remove('on');
      if (this.bgList.length > 1) this.bgTimer = window.setTimeout(() => this.nextBackground(), this.s.display.slideSeconds * 1000);
    };
    img.onload = show;
    img.onerror = () => { if (this.bgList.length > 1) this.bgTimer = window.setTimeout(() => this.nextBackground(), 3000); };
    img.src = url;
  }

  /* ------------------------------------------------------------------ content */
  private setupSlides() {
    const s = this.s;
    const ayat = s.display.showAyat ? shuffle(AYAT).map((v) => ({ kind: 'ayah', v }) as Slide) : [];
    const adhkar = s.display.showAdhkar ? shuffle(ADHKAR.filter((d) => d.chapter !== 15)).map((v) => ({ kind: 'dhikr', v }) as Slide) : [];
    const ann = s.display.showAnnouncements ? s.mosque.announcements.filter((a) => a.trim()).map((v) => ({ kind: 'ann', v }) as Slide) : [];
    const out: Slide[] = [];
    let a = 0, d = 0, n = 0;
    while (a < ayat.length || d < adhkar.length) {
      if (a < ayat.length) out.push(ayat[a++]);
      if (d < adhkar.length) out.push(adhkar[d++]);
      if (ann.length && out.length % 5 === 0) out.push(ann[n++ % ann.length]);
    }
    if (!out.length) out.push(...ann);
    this.slides = out;
    this.slideIdx = -1;
    this.showSlide(1, true);
  }

  showSlide(step = 1, immediate = false) {
    clearTimeout(this.slideTimer);
    if (!this.slides.length) { this.r.featureBody.innerHTML = ''; return; }
    this.slideIdx = (this.slideIdx + step + this.slides.length) % this.slides.length;
    const slide = this.slides[this.slideIdx];
    const body = this.r.featureBody;
    const swap = () => {
      this.renderSlide(slide);
      body.classList.remove('out');
    };
    if (immediate) swap();
    else { body.classList.add('out'); setTimeout(swap, this.lite ? 400 : 900); }
    const base = this.s.display.contentSeconds * 1000;
    const len = slide.kind === 'ann' ? slide.v.length : slide.v.ar.length;
    this.slideTimer = window.setTimeout(() => this.showSlide(1), base + Math.min(20000, len * 25));
  }

  private renderSlide(sl: Slide) {
    const L = this.s.lang;
    const kind = this.r.featureKind;
    const body = this.r.featureBody;
    body.innerHTML = '';
    kind.innerHTML = '';
    const label = sl.kind === 'ayah' ? ['ayah', 'قال الله تعالى'] : sl.kind === 'dhikr' ? ['dhikr', sl.v.title.ar] : ['info', 'إعلان'];
    kind.append(svg(sl.kind === 'ayah' ? icons.book : sl.kind === 'dhikr' ? icons.scroll : icons.megaphone), L === 'ar' ? '' : h('span', null, t(label[0] as 'ayah', L)), h('span', { class: 'ar' }, label[1]));
    if (sl.kind === 'ayah') {
      const v = sl.v;
      const tr = L === 'ar' ? '' : L === 'fr' ? v.fr : v.en;
      body.className = `feature-body ${sizeClass(v.ar.length + tr.length * 0.45)}`;
      body.append(
        h('div', { class: 'f-ar' }, v.ar),
        tr ? h('div', { class: 'f-tr' }, `« ${tr} »`) : '',
        h('div', { class: 'f-ref' }, L === 'ar' ? '' : `${v.surah.en} · ${v.ref}`, h('span', { class: 'ar' }, v.surah.ar)));
    } else if (sl.kind === 'dhikr') {
      const v = sl.v;
      const tr = L === 'en' ? v.en : '';
      body.className = `feature-body ${sizeClass(v.ar.length + tr.length * 0.45)}`;
      body.append(
        h('div', { class: 'f-ar dhikr' }, v.ar),
        tr ? h('div', { class: 'f-tr' }, tr) : '',
        h('div', { class: 'f-ref' }, L === 'ar' ? '' : 'Hisn al-Muslim', h('span', { class: 'ar' }, 'حصن المسلم')));
    } else {
      body.className = 'feature-body';
      body.append(h('div', { class: `f-ann ${isArabic(sl.v) ? 'ar-text' : ''}` }, sl.v));
    }
    // progress dots (max 7, windowed)
    const dots = this.r.featureDots;
    if (!dots.childElementCount) for (let i = 0; i < 7; i++) dots.appendChild(h('i'));
    const on = this.slideIdx % 7;
    Array.prototype.forEach.call(dots.children, (d: Element, i: number) => toggleClass(d, 'on', i === on));
  }

  /* ------------------------------------------------------------------ tick */
  tick(force = false) {
    const s = this.s;
    const now = clock.now();
    const tz = s.location.timezone;
    const minute = Math.floor(now.getTime() / 60000);
    if (minute !== this.offsetMinuteStamp) { this.offsetMin = tzOffsetMinutes(tz, now); this.offsetMinuteStamp = minute; }
    const z = zoned(now, tz, this.offsetMin);
    const st = computeState(s, now);
    const L = s.lang;
    const h24 = s.display.clock24;

    // Clock
    const hh = h24 ? z.h : z.h % 12 || 12;
    const D = this.digits;
    setText(this.r.hh, D(`${hh < 10 && h24 ? '0' : ''}${hh}`));
    setText(this.r.mm, D(`${z.min < 10 ? '0' : ''}${z.min}`));
    setText(this.r.sec, D(`${z.s < 10 ? '0' : ''}${z.s}`));
    setText(this.r.ampm, h24 ? '' : meridiem(now, tz, this.offsetMin));

    // Dates (once per day / on settings change / at Maghrib for the Hijri day)
    const dk = `${z.y}-${z.m}-${z.d}-${st.hijri.d}-${L}`;
    if (dk !== this.dateKey || force) {
      this.dateKey = dk;
      let g = '';
      try { g = new Intl.DateTimeFormat(locale(L), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: tz }).format(now); }
      catch { g = `${z.d}/${z.m}/${z.y}`; }
      setText(this.r.dateG, g);
      setText(this.r.dateH, `${toArabicDigits(st.hijri.d)} ${HIJRI_MONTHS_AR[st.hijri.m - 1]} ${toArabicDigits(st.hijri.y)} هـ`);
      this.renderCards(st);
    }

    // Next prayer
    const n = st.next;
    const remain = (n.at.getTime() - now.getTime()) / 1000;
    setText(this.r.nextAr, PRAYER_AR[n.key]);
    setText(this.r.nextName, L === 'ar' ? PRAYER_AR[n.key] : prayerName(n.key, L));
    toggleClass(this.r.nextName, 'ar', L === 'ar');
    setText(this.r.nextCount, D(formatCountdown(remain, true)));
    toggleClass(this.r.next, 'soon', remain < 600);
    const span = n.at.getTime() - n.prev.getTime();
    const prog = span > 0 ? Math.min(1, Math.max(0, (now.getTime() - n.prev.getTime()) / span)) : 0;
    this.r.nextBar.style.transform = `scaleX(${prog.toFixed(4)})`;
    for (const k of PRAYERS) {
      const c = this.cards[k];
      const isNext = !n.tomorrow ? (n.key === 'jumuah' ? 'dhuhr' : n.key) === k : k === 'fajr';
      c.prog.style.transform = isNext ? `scaleX(${prog.toFixed(4)})` : 'scaleX(0)';
      toggleClass(c.root, 'next', isNext);
      toggleClass(c.root, 'now', st.current === k && !isNext);
      toggleClass(c.root, 'passed', !isNext && st.current !== k && (n.tomorrow || st.today.times[k].getTime() <= now.getTime()));
    }
    if (minute !== this.cardMinute) { this.cardMinute = minute; this.renderCards(st); }

    // Ramadan chips
    this.renderChips(st, h24);

    // Phases & sounds
    this.handlePhase(st, now);

    // Dimming
    toggleClass(this.r.dim, 'on', st.nightDim);

    // From the adhan until the end of the prayer, the ticker asks to silence phones.
    const atPrayer = s.display.phoneNotice && s.mode === 'mosque' && !!st.event && st.phase !== 'adhkar';
    toggleClass(this.stage, 'prayer-time', atPrayer);

    // Weather (every 30 min)
    if (s.display.weather && navigator.onLine !== false && now.getTime() - this.weatherAt > 30 * 60000) {
      this.weatherAt = now.getTime();
      fetchWeather(s.location.lat, s.location.lng).then((w) => { this.weather = w; this.renderWeather(); }).catch(() => undefined);
    }
    if (!s.display.weather && this.weather) { this.weather = null; this.renderWeather(); }

    // Sound prompt (browsers need one interaction before autoplay)
    if (s.athan.enabled && !audioUnlocked() && !this.soundPrompt) {
      this.soundPrompt = h('div', { class: 'sound-prompt' }, svg(icons.sound), t('enableSound', L));
      this.stage.appendChild(this.soundPrompt);
    }
  }

  private digits = (x: string) => (this.s.display.arabicDigits ? toArabicDigits(x) : x);

  /** Ticker: authentic ahadith (Sahih al-Bukhari) interleaved with the mosque's notices. */
  private buildTicker() {
    const s = this.s, L = s.lang;
    const el = this.r.tickerText;
    el.innerHTML = '';
    const items: Node[] = [];
    const ann = s.mosque.announcements.filter((a) => a.trim());
    const hadiths = s.display.tickerHadith ? shuffle(AHADITH) : [];
    const n = Math.max(hadiths.length, ann.length);
    let chars = 0;
    for (let i = 0; i < n; i++) {
      if (i < hadiths.length) {
        const hd = hadiths[i];
        const tr = L === 'fr' ? hd.fr : L === 'en' ? hd.en : '';
        const src = L === 'ar' ? hd.ref.ar : L === 'fr' ? hd.ref.fr : hd.ref.en;
        items.push(h('span', { class: 'hadith' },
          h('span', { class: 'ar' }, 'قال رسول الله ﷺ: «', hd.ar, '»'),
          tr ? h('span', { class: 'tr' }, ` — ${tr}`) : '',
          h('small', null, ` ${src} ${this.digits(String(hd.ref.number))}`)));
        chars += hd.ar.length + tr.length;
      }
      if (i < ann.length) {
        items.push(h('span', { class: `ann ${isArabic(ann[i]) ? 'ar' : ''}` }, svg(icons.megaphone), ann[i]));
        chars += ann[i].length;
      }
    }
    items.forEach((node, i) => { if (i) el.appendChild(h('span', { class: 'sep', html: ornament('') })); el.appendChild(node); });
    const speed = s.display.tickerSpeed === 'slow' ? 0.42 : s.display.tickerSpeed === 'fast' ? 0.2 : 0.3;
    el.style.setProperty('--dur', `${Math.max(30, chars * speed)}s`);
  }

  private renderCards(st: State) {
    const s = this.s, tz = s.location.timezone, h24 = s.display.clock24;
    for (const k of PRAYERS) {
      const c = this.cards[k];
      const key = st.friday && k === 'dhuhr' ? 'jumuah' : k;
      setText(c.ar, PRAYER_AR[key]);
      setText(c.lat, s.lang === 'ar' ? '' : prayerName(key, s.lang));
      // After Isha, the Fajr card already shows tomorrow's Fajr.
      const tomorrowFajr = k === 'fajr' && st.next.tomorrow;
      const at = tomorrowFajr ? st.tomorrow.times.fajr : st.today.times[k];
      c.time.innerHTML = '';
      c.time.append(this.digits(formatHM(at, tz, h24, this.offsetMin)), h24 ? '' : h('small', null, meridiem(at, tz, this.offsetMin)));
      if (k !== 'sunrise') {
        const iq = tomorrowFajr ? iqamaTime(s, 'fajr', at, st.tomorrow.date) : st.todayIqama[k];
        setText(c.iqamaVal, this.digits(formatHM(iq, tz, h24, this.offsetMin)));
      }
    }
  }

  private renderChips(st: State, h24: boolean) {
    const tz = this.s.location.timezone, L = this.s.lang;
    const d = this.s.display;
    const sig = JSON.stringify([st.ramadan && st.imsak?.getTime(), st.iftar?.getTime(), d.showDuha && st.duha.getTime(), d.showQiyam && st.qiyam.getTime(), st.eid?.getTime(), L, h24, d.arabicDigits]);
    if (this.chipsSig === sig) return;
    this.chipsSig = sig;
    this.r.chips.innerHTML = '';
    const chip = (ar: string, lat: string, at: Date) => h('div', { class: 'chip' }, h('span', { class: 'ar' }, ar), L === 'ar' ? '' : h('span', null, lat), h('b', { class: 'num' }, this.digits(formatHM(at, tz, h24))));
    if (st.ramadan && st.imsak && st.iftar) {
      this.r.chips.append(
        h('div', { class: 'chip' }, h('span', { class: 'ar' }, 'رمضان كريم')),
        chip('الإمساك', t('imsak', L), st.imsak),
        chip('الإفطار', t('iftar', L), st.iftar));
    }
    if (st.eid) this.r.chips.append(chip('صلاة العيد', t('eid', L), st.eid));
    if (d.showDuha) this.r.chips.append(chip('الضحى', t('duha', L), st.duha));
    if (d.showQiyam) this.r.chips.append(chip('الثلث الأخير', t('qiyam', L), st.qiyam));
  }

  private renderWeather() {
    const el = this.r.weather;
    el.innerHTML = '';
    toggleClass(el, 'hidden', !this.weather);
    if (!this.weather) return;
    const kind = weatherKind(this.weather.code);
    const night = !this.weather.isDay;
    const ic = kind === 'clear' && night ? icons.moon : kind === 'partly' && night ? icons.partlyNight : icons[kind];
    const temp = this.s.display.tempUnit === 'f' ? Math.round(this.weather.temp * 9 / 5 + 32) : this.weather.temp;
    el.append(svg(ic), h('span', { class: 'num' }, `${this.digits(String(temp))}°`));
  }

  /* ------------------------------------------------------------------ phases */
  private handlePhase(st: State, now: Date) {
    const s = this.s;
    const ev = st.event;
    const sig = `${st.phase}:${ev ? ev.key + ev.adhan.getTime() : ''}:${s.lang}`;
    const ov = this.r.overlay;
    if (sig !== this.lastPhaseSig) {
      this.lastPhaseSig = sig;
      this.renderOverlay(st);
      if (st.phase === 'prayer') stopAudio();
    }

    // Sounds are driven by the clock crossing adhan / iqama times — independent of which
    // screens are enabled — and fire at most once per event (within 15 s of the time).
    const tNow = now.getTime();
    for (const k of SALAWAT) {
      const adhanAt = st.today.times[k].getTime();
      if (tNow >= adhanAt && tNow - adhanAt < 15000 && this.lastAdhanAt !== adhanAt) {
        this.lastAdhanAt = adhanAt;
        const mode = s.athan.perPrayer[k];
        if (s.athan.enabled && mode === 'athan') void playAthan(k === 'fajr' ? s.athan.fajrSound : s.athan.sound, k === 'fajr' ? s.athan.fajrVolume : s.athan.volume);
        else if (s.athan.enabled && mode === 'beep') chime(s.athan.volume);
      }
      if (s.mode !== 'mosque') continue;
      const iqAt = st.todayIqama[k].getTime();
      if (tNow >= iqAt && tNow - iqAt < 15000 && this.lastIqamaAt !== iqAt) {
        this.lastIqamaAt = iqAt;
        fadeOut(1200);
        if (s.athan.iqamaBeep) setTimeout(() => chime(s.athan.volume * 0.8), 1300);
      }
    }

    // Pre-adhan reminder
    if (s.athan.preAlertMinutes > 0 && s.athan.enabled) {
      const at = st.next.at.getTime() - s.athan.preAlertMinutes * 60000;
      if (now.getTime() >= at && now.getTime() - at < 5000 && this.lastPreAlert !== at && st.next.key !== 'sunrise') { this.lastPreAlert = at; chime(s.athan.volume * 0.7); }
    }

    // Live parts of overlays
    if (st.phase === 'iqama' && ev) {
      const total = (ev.iqama.getTime() - ev.adhan.getTime()) / 1000;
      const left = (ev.iqama.getTime() - now.getTime()) / 1000;
      setText($('.ring-count', ov), this.digits(formatCountdown(left)));
      const prog = $('.ring .prog', ov) as unknown as SVGCircleElement | null;
      if (prog) prog.style.strokeDashoffset = String(1696.46 * (1 - Math.max(0, Math.min(1, left / Math.max(1, total)))));
      const last = left <= 60;
      const notice = $('.notice', ov);
      if (notice && notice.dataset.last !== String(last)) {
        notice.dataset.last = String(last);
        notice.innerHTML = '';
        notice.append(svg(last ? icons.rows : icons.phoneOff), h('span', { class: 'ar' }, last ? 'استووا واعتدلوا وسدّوا الخلل' : 'يرجى إغلاق الهواتف النقالة'), s.lang === 'ar' ? '' : h('span', null, `· ${t(last ? 'straighten' : 'silence', s.lang)}`));
      }
    }
    if (st.phase === 'prayer') setText($('.ov-clock', ov), this.digits(formatHM(now, s.location.timezone, s.display.clock24, this.offsetMin)));
    if (st.phase === 'adhkar' && now.getTime() - this.adhkarStamp > 22000) { this.adhkarStamp = now.getTime(); this.renderAdhkar(); }
  }

  private renderOverlay(st: State) {
    const ov = this.r.overlay;
    const s = this.s, L = s.lang, ev = st.event;
    ov.className = 'overlay';
    ov.innerHTML = '';
    if (st.phase === 'idle' || !ev) return;
    const key = ev.jumuah ? 'jumuah' : ev.key;
    const lat = L === 'ar' ? '' : prayerName(key, L);
    ov.classList.add('on', st.phase);

    if (st.phase === 'adhan') {
      const dua = DUA_AFTER_ADHAN ? spoken(DUA_AFTER_ADHAN.ar) : '';
      ov.append(
        h('div', { class: 'ov-star', html: ornament() }),
        h('div', { class: 'ov-kicker' }, L === 'ar' ? 'الأذان' : `${t('adhan', L)} · ${lat}`),
        h('div', { class: 'ov-title' }, ev.jumuah ? 'حان الآن موعد ' : 'حان الآن موعد أذان ', h('b', null, ev.jumuah ? 'صلاة الجمعة' : PRAYER_AR[ev.key])),
        L === 'ar' ? '' : h('div', { class: 'ov-sub' }, `${t('adhanNow', L)} — ${lat}`),
        h('div', { class: 'ov-divider', html: divider() }),
        dua ? h('div', { class: 'ov-text small' }, dua) : '',
        L === 'en' && DUA_AFTER_ADHAN ? h('div', { class: 'ov-tr' }, spoken(DUA_AFTER_ADHAN.en)) : '',
        s.mode === 'mosque' && s.display.phoneNotice ? h('div', { class: 'notice' }, svg(icons.phoneOff), h('span', { class: 'ar' }, 'يرجى إغلاق الهواتف النقالة'), L === 'ar' ? '' : h('span', null, `· ${t('silence', L)}`)) : '');
    } else if (st.phase === 'iqama') {
      const C = 2 * Math.PI * 270;
      ov.append(
        h('div', { class: 'ov-kicker' }, L === 'ar' ? PRAYER_AR[key] : `${lat} · ${PRAYER_AR[key]}`),
        h('div', {
          class: 'ring',
          html: `<svg viewBox="0 0 560 560"><circle class="track" cx="280" cy="280" r="270"/><circle class="prog" cx="280" cy="280" r="270" stroke-dasharray="${C.toFixed(2)}" stroke-dashoffset="0"/></svg>`,
        }, h('div', { class: 'ring-inner' },
          h('div', { class: 'ring-label' }, 'الإقامة بعد'),
          h('div', { class: 'ring-count num' }, '--:--'),
          L === 'ar' ? '' : h('div', { class: 'ring-label-lat' }, t('iqamaIn', L)))),
        h('div', { class: 'notice' }));
    } else if (st.phase === 'prayer') {
      ov.append(
        h('div', { class: 'ov-star', html: ornament() }),
        h('div', { class: 'ov-title' }, ev.jumuah ? 'خطبة وصلاة الجمعة' : 'الصلاة قائمة'),
        L === 'ar' ? '' : h('div', { class: 'ov-sub' }, `${t('prayerNow', L)} — ${lat}`),
        h('div', { class: 'ov-clock num' }));
    } else if (st.phase === 'adhkar') {
      this.adhkarIdx = 0;
      this.adhkarStamp = clock.now().getTime();
      ov.append(
        h('div', { class: 'ov-kicker' }, L === 'ar' ? 'أذكار بعد الصلاة' : `${t('afterPrayer', L)} · أذكار بعد الصلاة`),
        h('div', { class: 'ov-divider', html: divider() }),
        h('div', { class: 'ov-text adhkar-text' }),
        h('div', { class: 'ov-tr adhkar-tr' }));
      this.renderAdhkar();
    }
  }

  private renderAdhkar() {
    if (!AFTER_SALAH.length) return;
    const d = AFTER_SALAH[this.adhkarIdx++ % AFTER_SALAH.length];
    const ov = this.r.overlay;
    const text = $('.adhkar-text', ov), tr = $('.adhkar-tr', ov);
    if (!text || !tr) return;
    text.style.fontSize = d.ar.length > 300 ? '38px' : d.ar.length > 160 ? '46px' : '58px';
    setText(text, d.ar);
    setText(tr, this.s.lang === 'en' ? d.en : this.s.lang === 'fr' ? d.translit : '');
  }

  /** Called by main for remote-control left/right. */
  nav(step: number) { this.showSlide(step); }
}
