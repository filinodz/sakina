import backgroundsData from '../data/backgrounds.json';
import { ATHANS } from '../data/athans';
import { METHODS, methodById, methodForCountry } from '../data/methods';
import { PRAYERS, SALAWAT, settings, type Lang, type Settings } from '../core/settings';
import { getDay, parseTimetable, verifyWithApi, warmApi } from '../core/prayer';
import { invalidate } from '../core/schedule';
import { deviceTimeZone, formatHM, isValidTimeZone, todayIn } from '../core/time';
import { prayerName, PRAYER_AR } from '../core/i18n';
import { blobs, blobUrl, resizeImage } from '../core/idb';
import { chime, downloadAthan, isNative, offlineAthans, playAthan, stopAudio, unlockAudio } from '../core/audio';
import { locate, reverseGeocode, searchCity, timezoneAt, type Place } from '../core/geo';
import { h, svg } from './dom';
import { brandMark, icons, ornament } from './icons';
import { handleArrow, isBackKey } from './spatial-nav';

const BACKGROUNDS = backgroundsData as { id: string; label: string; labelAr?: string; labelEn?: string; author: string; license: string }[];
const bgLabel = (b: (typeof BACKGROUNDS)[number]) => (lang === 'ar' ? b.labelAr || b.label : lang === 'en' ? b.labelEn || b.label : b.label);
const VERSION = '1.1.0';
const REPO = 'https://github.com/filinodz/sakina';

type Section = 'mosque' | 'location' | 'calc' | 'iqama' | 'athan' | 'display' | 'backup';
const TAB_ICONS: Record<Section, string> = {
  mosque: icons.mosque, location: icons.mapPin, calc: icons.clock, iqama: icons.hourglass,
  athan: icons.adhan, display: icons.palette, backup: icons.backup,
};

/** Tiny trilingual label helper. */
let lang: Lang = 'fr';
const L = (fr: string, en: string, ar: string) => (lang === 'ar' ? ar : lang === 'en' ? en : fr);

/* ---------- path binding ---------- */
function getPath(s: Settings, path: string): unknown {
  return path.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], s);
}
function setPath(path: string, v: unknown) {
  settings.set((s) => {
    const keys = path.split('.');
    const last = keys.pop()!;
    const obj = keys.reduce<Record<string, unknown>>((o, k) => o[k] as Record<string, unknown>, s as unknown as Record<string, unknown>);
    obj[last] = v;
  });
}

export class SettingsPanel {
  readonly el: HTMLDivElement;
  private nav: HTMLElement;
  private main: HTMLElement;
  private section: Section = 'mosque';
  private openFlag = false;
  private onCloseCb: () => void = () => undefined;
  private offline = new Set<string>();
  private previewing = '';
  private banner = '';

  constructor() {
    this.nav = h('nav', { class: 'sp-nav' });
    this.main = h('main', { class: 'sp-main' });
    this.el = h('div', { class: 'sp', role: 'dialog', 'aria-modal': 'true' }, this.nav, this.main);
    this.el.addEventListener('keydown', (e) => this.onKey(e));
    document.body.appendChild(this.el);
  }

  get isOpen() { return this.openFlag; }
  onClose(cb: () => void) { this.onCloseCb = cb; }

  open(section?: Section, banner = '') {
    unlockAudio();
    this.banner = banner;
    if (section) this.section = section;
    this.openFlag = true;
    this.el.classList.add('open');
    this.render();
    void offlineAthans().then((s) => { this.offline = s; if (this.section === 'athan') this.render(); });
    setTimeout(() => (this.nav.querySelector('.on') as HTMLElement | null)?.focus(), 50);
  }

  close() {
    stopAudio();
    this.previewing = '';
    this.openFlag = false;
    this.el.classList.remove('open');
    if (!settings.get().location.configured) settings.set((s) => { s.location.configured = true; });
    this.onCloseCb();
  }

  private onKey(e: KeyboardEvent) {
    if (isBackKey(e)) {
      const a = document.activeElement;
      if (a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA') && e.key === 'Escape' && this.main.contains(a)) { (a as HTMLElement).blur(); e.preventDefault(); return; }
      e.preventDefault();
      this.close();
      return;
    }
    // From the sidebar, "right" (or "left" in RTL) enters the section at its first control.
    const intoMain = lang === 'ar' ? 'ArrowLeft' : 'ArrowRight';
    if (e.key === intoMain && this.nav.contains(document.activeElement)) {
      const first = this.main.querySelector('button, input, select, textarea') as HTMLElement | null;
      if (first) { e.preventDefault(); first.focus(); first.scrollIntoView({ block: 'nearest' }); return; }
    }
    handleArrow(this.el, e);
  }

  /* ------------------------------------------------------------------ render */
  render() {
    const s = settings.get();
    lang = s.lang;
    this.el.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    this.el.setAttribute('lang', lang);
    const focusKey = (document.activeElement as HTMLElement | null)?.dataset?.key;

    const sections: [Section, string, string][] = [
      ['mosque', L('Mosquée', 'Mosque', 'المسجد'), L('Identité, photo et annonces', 'Identity, photo & notices', 'الهوية والصورة والإعلانات')],
      ['location', L('Localisation', 'Location', 'الموقع'), L('Ville, coordonnées, fuseau', 'City, coordinates, time zone', 'المدينة والإحداثيات')],
      ['calc', L('Horaires', 'Prayer times', 'المواقيت'), L('Méthode, ajustements, vérification', 'Method, adjustments, check', 'طريقة الحساب والتعديل')],
      ['iqama', L('Iqama & Joumou‘a', 'Iqamah & Jumu‘ah', 'الإقامة والجمعة'), L('Délais et écrans de prière', 'Delays and prayer screens', 'المدد وشاشات الصلاة')],
      ['athan', L('Adhan', 'Adhan', 'الأذان'), L('Voix, volume, hors-ligne', 'Voice, volume, offline', 'الصوت ومستوى الصوت')],
      ['display', L('Affichage', 'Display', 'العرض'), L('Thème, fonds, contenus', 'Theme, backgrounds, content', 'السمة والخلفيات')],
      ['backup', L('Sauvegarde', 'Backup', 'النسخ الاحتياطي'), L('Export, PIN, à propos', 'Export, PIN, about', 'التصدير والرمز')],
    ];

    this.nav.innerHTML = '';
    this.nav.append(
      h('div', { class: 'sp-brand' }, h('span', { class: 'sp-logo', html: brandMark() }), h('div', null, h('b', null, 'Sakina'), h('small', { class: 'ar' }, 'سكينة'))),
      h('div', { class: 'sp-lang', role: 'radiogroup', 'aria-label': 'Language' }, ...([['ar', 'العربية'], ['fr', 'FR'], ['en', 'EN']] as [Lang, string][]).map(([v, l]) => h('button', {
        type: 'button', class: s.lang === v ? 'on' : '', 'data-key': `lang-${v}`, role: 'radio', 'aria-checked': String(s.lang === v),
        onclick: () => { setPath('lang', v); this.render(); },
      }, l))),
      ...sections.map(([id, title, sub]) => h('button', {
        class: `sp-tab ${id === this.section ? 'on' : ''}`, 'data-key': `tab-${id}`,
        onclick: () => { this.section = id; this.render(); (this.nav.querySelector('.on') as HTMLElement)?.focus(); },
      }, svg(TAB_ICONS[id], 'ico tab-ico'), h('span', { class: 'tab-text' }, h('span', null, title), h('small', null, sub)))),
      h('div', { class: 'sp-spacer' }),
      h('button', { class: 'sp-close', 'data-key': 'close', onclick: () => this.close() }, svg(icons.check), L('Terminer', 'Done', 'تم')));

    const [, title, sub] = sections.find((x) => x[0] === this.section)!;
    this.main.innerHTML = '';
    this.main.append(
      this.banner ? h('div', { class: 'sp-banner' }, h('span', { class: 'ico', html: ornament() }), this.banner) : '',
      h('header', { class: 'sp-head' }, h('h2', null, title), h('p', null, sub)),
      h('div', { class: 'sp-body' }, ...this.renderSection(s)));

    if (focusKey) (this.el.querySelector(`[data-key="${focusKey}"]`) as HTMLElement | null)?.focus();
  }

  private renderSection(s: Settings): (Node | string)[] {
    switch (this.section) {
      case 'mosque': return this.secMosque(s);
      case 'location': return this.secLocation(s);
      case 'calc': return this.secCalc(s);
      case 'iqama': return this.secIqama(s);
      case 'athan': return this.secAthan(s);
      case 'display': return this.secDisplay(s);
      case 'backup': return this.secBackup(s);
    }
  }

  /* ------------------------------------------------------------------ controls */
  private field(label: string, control: Node | Node[], hint?: string, wide = false) {
    return h('label', { class: `f ${wide ? 'wide' : ''}` }, h('span', { class: 'f-label' }, label), ...(Array.isArray(control) ? control : [control]), hint ? h('small', { class: 'f-hint' }, hint) : '');
  }
  private text(path: string, opts: { placeholder?: string; type?: string; dir?: string } = {}) {
    const s = settings.get();
    return h('input', {
      class: 'in', type: opts.type || 'text', value: String(getPath(s, path) ?? ''), placeholder: opts.placeholder || '', dir: opts.dir || 'auto', 'data-key': path,
      onchange: (e: Event) => setPath(path, (e.target as HTMLInputElement).value),
    });
  }
  private num(path: string, min: number, max: number, step = 1, rerender = false) {
    const s = settings.get();
    return h('input', {
      class: 'in num', type: 'number', min, max, step, value: String(getPath(s, path)), 'data-key': path, inputmode: 'decimal',
      onchange: (e: Event) => {
        const v = parseFloat((e.target as HTMLInputElement).value);
        if (!isNaN(v)) { setPath(path, Math.max(min, Math.min(max, v))); invalidate(); if (rerender) this.render(); }
      },
    });
  }
  private select(path: string, options: [string, string][], rerender = false, after?: () => void) {
    const cur = String(getPath(settings.get(), path));
    return h('select', {
      class: 'in', 'data-key': path,
      onchange: (e: Event) => {
        const raw = (e.target as HTMLSelectElement).value;
        const old = getPath(settings.get(), path);
        setPath(path, typeof old === 'number' ? +raw : raw);
        invalidate();
        after?.();
        if (rerender) this.render();
      },
    }, ...options.map(([v, l]) => h('option', { value: v, selected: v === cur }, l)));
  }
  private seg(path: string, options: [string, string][], after?: () => void) {
    const cur = String(getPath(settings.get(), path));
    return h('div', { class: 'seg', role: 'radiogroup' }, ...options.map(([v, l]) => h('button', {
      class: v === cur ? 'on' : '', role: 'radio', 'aria-checked': String(v === cur), 'data-key': `${path}=${v}`, type: 'button',
      onclick: (e: Event) => { e.preventDefault(); setPath(path, typeof getPath(settings.get(), path) === 'number' ? +v : v); invalidate(); after?.(); this.render(); },
    }, l)));
  }
  private toggle(path: string, label: string, hint?: string, rerender = false) {
    const on = !!getPath(settings.get(), path);
    return h('button', {
      class: `tg ${on ? 'on' : ''}`, role: 'switch', 'aria-checked': String(on), 'data-key': path, type: 'button',
      onclick: (e: Event) => {
        e.preventDefault();
        const v = !getPath(settings.get(), path);
        setPath(path, v); invalidate();
        const b = e.currentTarget as HTMLElement;
        b.classList.toggle('on', v); b.setAttribute('aria-checked', String(v));
        if (rerender) this.render();
      },
    }, h('span', { class: 'tg-text' }, h('b', null, label), hint ? h('small', null, hint) : ''), h('i', { class: 'tg-knob' }));
  }
  private btn(label: string, onclick: (e: Event) => void, icon?: string, cls = '') {
    return h('button', { class: `btn ${cls}`, type: 'button', 'data-key': `btn-${label}`, onclick }, icon ? svg(icon) : '', h('span', null, label));
  }
  private group(title: string, ...kids: (Node | string)[]) {
    return h('section', { class: 'grp' }, h('h3', null, title), h('div', { class: 'grp-body' }, ...kids));
  }
  private preview(s: Settings) {
    const tz = s.location.timezone;
    const d = getDay(s, todayIn(tz));
    const src = { calc: L('calcul local', 'local calculation', 'حساب محلي'), api: 'API Aladhan', table: L('calendrier importé', 'imported timetable', 'جدول مستورد') }[d.source];
    return h('div', { class: 'preview' },
      h('div', { class: 'preview-head' }, L('Aujourd’hui', 'Today', 'اليوم'), ' · ', s.location.city || `${s.location.lat.toFixed(3)}, ${s.location.lng.toFixed(3)}`, h('small', null, `${src} · ${tz}`)),
      h('div', { class: 'preview-grid' }, ...PRAYERS.map((k) => h('div', null, h('span', { class: 'ar' }, PRAYER_AR[k]), h('small', null, prayerName(k, lang === 'ar' ? 'fr' : lang)), h('b', { class: 'num' }, formatHM(d.times[k], tz, true))))));
  }

  /* ------------------------------------------------------------------ sections */
  private secMosque(s: Settings) {
    const imgSlot = (key: 'mosque' | 'logo', label: string, hint: string) => {
      const box = h('div', { class: 'img-slot' });
      const has = key === 'mosque' ? s.mosque.hasImage : s.mosque.hasLogo;
      if (has) void blobUrl(key).then((u) => { if (u) box.style.backgroundImage = `url("${u}")`; });
      const input = h('input', {
        type: 'file', accept: 'image/*', class: 'file',
        onchange: async (e: Event) => {
          const f = (e.target as HTMLInputElement).files?.[0];
          if (!f) return;
          const blob = key === 'mosque' ? await resizeImage(f, 1920, 1080) : await resizeImage(f, 512, 512, 'image/png');
          await blobs.set(key, blob);
          settings.set((x) => {
            if (key === 'mosque') { x.mosque.hasImage = true; x.display.background = 'mosque'; } else x.mosque.hasLogo = true;
          });
          this.render();
        },
      });
      return this.field(label, [
        h('div', { class: 'img-row' }, box,
          h('div', { class: 'img-actions' },
            this.btn(L('Choisir une image', 'Choose image', 'اختيار صورة'), () => input.click(), icons.upload),
            has ? this.btn(L('Retirer', 'Remove', 'حذف'), async () => {
              await blobs.del(key);
              settings.set((x) => { if (key === 'mosque') { x.mosque.hasImage = false; if (x.display.background === 'mosque') x.display.background = 'slideshow'; } else x.mosque.hasLogo = false; });
              this.render();
            }, icons.close, 'ghost') : '', input)),
      ], hint, true);
    };

    return [
      this.group(L('Usage', 'Usage', 'الاستخدام'),
        this.field(L('Mode', 'Mode', 'الوضع'), this.seg('mode', [['mosque', L('Mosquée — iqama & écrans de prière', 'Mosque — iqamah & prayer screens', 'مسجد — إقامة وشاشات الصلاة')], ['home', L('Maison — horaires & adhan', 'Home — times & adhan', 'منزل — المواقيت والأذان')]]), undefined, true)),
      this.group(L('Identité', 'Identity', 'الهوية'),
        this.field(L('Nom en arabe', 'Arabic name', 'الاسم بالعربية'), this.text('mosque.nameAr', { dir: 'rtl', placeholder: 'مسجد النور' })),
        this.field(L('Nom (latin)', 'Name (latin)', 'الاسم باللاتينية'), this.text('mosque.name', { placeholder: 'Mosquée An-Nour' })),
        this.field(L('Adresse', 'Address', 'العنوان'), this.text('mosque.address')),
        this.field(L('Téléphone', 'Phone', 'الهاتف'), this.text('mosque.phone', { type: 'tel' })),
        this.field(L('Site web', 'Website', 'الموقع الإلكتروني'), this.text('mosque.website', { type: 'url' }))),
      this.group(L('Images', 'Images', 'الصور'),
        imgSlot('mosque', L('Photo de la mosquée (arrière-plan)', 'Mosque photo (background)', 'صورة المسجد (خلفية)'), L('Redimensionnée automatiquement en 1920×1080 et stockée sur l’appareil.', 'Automatically resized to 1920×1080 and stored on this device.', 'يتم تصغيرها تلقائياً وحفظها على الجهاز.')),
        imgSlot('logo', L('Logo', 'Logo', 'الشعار'), L('Carré, fond transparent de préférence.', 'Square, ideally transparent.', 'مربع، ويفضل بخلفية شفافة.'))),
      this.group(L('Annonces', 'Notices', 'الإعلانات'),
        this.field(L('Une annonce par ligne', 'One notice per line', 'إعلان في كل سطر'), h('textarea', {
          class: 'in', rows: 5, dir: 'auto', 'data-key': 'mosque.announcements',
          onchange: (e: Event) => setPath('mosque.announcements', (e.target as HTMLTextAreaElement).value.split('\n').map((x) => x.trim()).filter(Boolean)),
        }, s.mosque.announcements.join('\n')), L('Affichées dans le bandeau défilant et entre les versets.', 'Shown in the ticker and between verses.', 'تظهر في الشريط وبين الآيات.'), true)),
    ];
  }

  private secLocation(s: Settings) {
    const results = h('div', { class: 'results' });
    const status = h('div', { class: 'status' });
    const q = h('input', { class: 'in', type: 'search', placeholder: L('Ex. : Alger, Oran, Paris, Casablanca…', 'e.g. Algiers, London, Cairo…', 'مثال: الجزائر، وهران…'), 'data-key': 'city-q', dir: 'auto' });
    const applyPlace = (p: { lat: number; lng: number; city: string; country: string; countryCode?: string; timezone: string }) => {
      const prevCc = settings.get().location.countryCode;
      settings.set((x) => {
        x.location = { ...x.location, lat: +p.lat.toFixed(5), lng: +p.lng.toFixed(5), city: p.city, country: p.country, countryCode: p.countryCode || x.location.countryCode, timezone: p.timezone || x.location.timezone, configured: true };
        // Suggest the national convention when the country changes (still editable in "Prayer times").
        if (p.countryCode && p.countryCode.toUpperCase() !== prevCc.toUpperCase()) x.calc.method = methodForCountry(p.countryCode);
      });
      invalidate();
      this.render();
    };
    const doSearch = async () => {
      if (!q.value.trim()) return;
      status.textContent = L('Recherche…', 'Searching…', 'جارٍ البحث…');
      results.innerHTML = '';
      try {
        const list: Place[] = await searchCity(q.value.trim(), lang);
        status.textContent = list.length ? '' : L('Aucun résultat', 'No results', 'لا توجد نتائج');
        results.append(...list.map((p) => h('button', {
          class: 'result', type: 'button',
          onclick: () => applyPlace({ lat: p.lat, lng: p.lng, city: p.name, country: p.country, countryCode: p.countryCode, timezone: p.timezone }),
        }, h('b', null, p.name), h('span', null, [p.admin, p.country].filter(Boolean).join(', ')), h('small', { class: 'num' }, `${p.lat.toFixed(3)}, ${p.lng.toFixed(3)} · ${p.timezone}`))));
        (results.firstElementChild as HTMLElement | null)?.focus();
      } catch {
        status.textContent = L('Pas de connexion internet — saisissez les coordonnées manuellement.', 'No internet — enter coordinates manually.', 'لا يوجد اتصال — أدخل الإحداثيات يدوياً.');
      }
    };
    q.addEventListener('keydown', (e) => { if ((e as KeyboardEvent).key === 'Enter') { e.preventDefault(); void doSearch(); } });

    const gps = async () => {
      status.textContent = L('Localisation en cours…', 'Locating…', 'جارٍ تحديد الموقع…');
      try {
        const p = await locate();
        const [tz, place] = await Promise.all([timezoneAt(p.lat, p.lng).catch(() => deviceTimeZone()), reverseGeocode(p.lat, p.lng, lang).catch(() => ({ city: '', country: '', countryCode: '' }))]);
        applyPlace({ lat: p.lat, lng: p.lng, city: place.city, country: place.country, countryCode: place.countryCode, timezone: tz });
      } catch (e) {
        status.textContent = `${L('Échec de la géolocalisation', 'Geolocation failed', 'فشل تحديد الموقع')} : ${(e as Error).message}`;
      }
    };

    const zones = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.('timeZone') ?? [];
    const tzInput = h('input', {
      class: 'in', type: 'text', value: s.location.timezone, list: 'tz-list', 'data-key': 'location.timezone',
      onchange: (e: Event) => {
        const v = (e.target as HTMLInputElement).value.trim();
        if (isValidTimeZone(v)) { setPath('location.timezone', v); invalidate(); this.render(); }
        else (e.target as HTMLInputElement).classList.add('bad');
      },
    });

    return [
      this.preview(s),
      this.group(L('Rechercher une ville', 'Search a city', 'البحث عن مدينة'),
        h('div', { class: 'row wide' }, q, this.btn(L('Rechercher', 'Search', 'بحث'), () => void doSearch(), icons.search, 'primary')),
        this.btn(L('Utiliser ma position (GPS)', 'Use my position (GPS)', 'استخدام موقعي'), () => void gps(), icons.locate),
        status, results),
      this.group(L('Coordonnées précises', 'Exact coordinates', 'الإحداثيات الدقيقة'),
        this.field(L('Latitude', 'Latitude', 'خط العرض'), this.num('location.lat', -90, 90, 0.0001, true)),
        this.field(L('Longitude', 'Longitude', 'خط الطول'), this.num('location.lng', -180, 180, 0.0001, true)),
        this.field(L('Ville affichée', 'Displayed city', 'المدينة المعروضة'), this.text('location.city')),
        this.field(L('Fuseau horaire (IANA)', 'Time zone (IANA)', 'المنطقة الزمنية'), [tzInput, h('datalist', { id: 'tz-list' }, ...zones.map((z) => h('option', { value: z })))],
          L('Heure d’été gérée automatiquement. Indépendant de l’horloge système de la TV.', 'DST handled automatically, independent of the TV’s own zone.', 'التوقيت الصيفي يُحسب تلقائياً.')),
        h('p', { class: 'note wide' }, L('Astuce : pour une précision maximale, utilisez les coordonnées exactes de la mosquée (clic droit sur Google Maps → copier les coordonnées).', 'Tip: for maximum precision use the mosque’s exact coordinates (right-click in Google Maps → copy coordinates).', 'نصيحة: استخدم إحداثيات المسجد الدقيقة من خرائط Google.'))),
    ];
  }

  private secCalc(s: Settings) {
    const m = methodById(s.calc.method);
    const verifyOut = h('div', { class: 'verify' });
    const csvStatus = h('div', { class: 'status' }, Object.keys(s.timetable).length ? `${Object.keys(s.timetable).length} ${L('jours importés', 'days imported', 'يوماً مستورداً')}` : '');
    const csvInput = h('input', {
      type: 'file', accept: '.csv,.tsv,.txt', class: 'file',
      onchange: async (e: Event) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) return;
        const { rows, errors } = parseTimetable(await f.text());
        const n = Object.keys(rows).length;
        if (n) { settings.set((x) => { x.timetable = rows; x.calc.source = 'table'; }); invalidate(); }
        this.render();
        setTimeout(() => { const st = this.el.querySelector('.csv-status'); if (st) st.textContent = `${n} ${L('jours importés', 'days imported', 'يوماً مستورداً')}${errors ? ` · ${errors} ${L('lignes ignorées', 'lines skipped', 'سطراً متجاهلاً')}` : ''}`; }, 0);
      },
    });
    csvStatus.classList.add('csv-status');

    const verify = async () => {
      verifyOut.innerHTML = '';
      verifyOut.append(L('Comparaison avec api.aladhan.com…', 'Comparing with api.aladhan.com…', 'جارٍ المقارنة…'));
      try {
        const rows = await verifyWithApi(settings.get());
        const tz = settings.get().location.timezone;
        verifyOut.innerHTML = '';
        verifyOut.append(h('table', null,
          h('tr', null, h('th', null, ''), h('th', null, L('Calcul local', 'Local', 'محلي')), h('th', null, 'Aladhan'), h('th', null, 'Δ')),
          ...rows.map((r) => h('tr', { class: Math.abs(r.diff) > 1 ? 'warn' : 'ok' },
            h('td', null, prayerName(r.key, lang === 'ar' ? 'fr' : lang)), h('td', { class: 'num' }, formatHM(r.local, tz, true)), h('td', { class: 'num' }, formatHM(r.api, tz, true)),
            h('td', { class: 'num' }, r.diff === 0 ? '✓' : `${r.diff > 0 ? '+' : ''}${r.diff} min`)))),
          h('small', null, L('Les ajustements manuels ne sont pas inclus dans cette comparaison. Un écart de ±1 min est dû aux arrondis.', 'Manual adjustments are excluded. ±1 min differences come from rounding.', 'التعديلات اليدوية غير مشمولة.')));
      } catch {
        verifyOut.textContent = L('Impossible de joindre l’API (hors ligne ?).', 'Could not reach the API (offline?).', 'تعذر الوصول إلى الخدمة.');
      }
    };

    return [
      this.preview(s),
      this.group(L('Source des horaires', 'Source', 'مصدر المواقيت'),
        this.field('', this.seg('calc.source', [
          ['calc', L('Calcul astronomique (hors-ligne)', 'Astronomical (offline)', 'حساب فلكي (دون إنترنت)')],
          ['api', 'API Aladhan'],
          ['table', L('Calendrier officiel (CSV)', 'Official timetable (CSV)', 'جدول رسمي (CSV)')],
        ], () => { void warmApi(settings.get()).then(() => { invalidate(); this.render(); }).catch(() => undefined); }), s.calc.source === 'calc'
          ? L('Algorithmes de Jean Meeus (adhan-js), précision à la minute, fonctionne sans internet.', 'Jean Meeus algorithms (adhan-js), minute precision, works offline.', 'خوارزميات فلكية دقيقة بالدقيقة، تعمل دون إنترنت.')
          : s.calc.source === 'api' ? L('Mois courant et suivant mis en cache : l’écran continue sans internet. Repli automatique sur le calcul local.', 'Current and next month cached for offline use, with automatic fallback to local calculation.', 'يتم حفظ الشهر الحالي والقادم.')
            : L('Pour suivre exactement le calendrier de votre ministère / fédération. Repli sur le calcul pour les jours absents.', 'Follow your ministry’s timetable exactly. Missing days fall back to calculation.', 'لاتباع جدول الوزارة بدقة.'), true)),
      s.calc.source === 'table' ? this.group(L('Importer un calendrier', 'Import timetable', 'استيراد جدول'),
        h('p', { class: 'note wide' }, L('Format CSV : date;fajr;chourouq;dhohr;asr;maghrib;icha — dates AAAA-MM-JJ, JJ/MM/AAAA ou JJ/MM (calendrier annuel).', 'CSV: date,fajr,sunrise,dhuhr,asr,maghrib,isha — dates YYYY-MM-DD, DD/MM/YYYY or DD/MM (yearly).', 'الصيغة: التاريخ؛ الفجر؛ الشروق؛ الظهر؛ العصر؛ المغرب؛ العشاء')),
        h('div', { class: 'row wide' }, this.btn(L('Choisir un fichier CSV', 'Choose CSV file', 'اختيار ملف'), () => csvInput.click(), icons.upload, 'primary'), csvInput,
          Object.keys(s.timetable).length ? this.btn(L('Effacer', 'Clear', 'مسح'), () => { settings.set((x) => { x.timetable = {}; }); invalidate(); this.render(); }, icons.close, 'ghost') : ''),
        csvStatus) : '',
      this.group(L('Convention de calcul', 'Calculation convention', 'طريقة الحساب'),
        this.field(L('Méthode', 'Method', 'الطريقة'), this.select('calc.method', METHODS.map((x) => [x.id, lang === 'ar' ? x.ar : lang === 'en' ? x.en : x.label]), true),
          m.id === 'custom' ? '' : `Fajr ${m.fajr}° · ${m.ishaInterval ? `Isha ${m.ishaInterval} min` : `Isha ${m.isha}°`}${m.dhuhrAdj ? ` · Dhohr +${m.dhuhrAdj} min` : ''}${m.maghribAdj ? ` · Maghrib +${m.maghribAdj} min` : ''}`, true),
        m.id === 'custom' ? this.field(L('Angle Fajr (°)', 'Fajr angle (°)', 'زاوية الفجر'), this.num('calc.fajrAngle', 5, 25, 0.1)) : '',
        m.id === 'custom' ? this.field(L('Angle Icha (°)', 'Isha angle (°)', 'زاوية العشاء'), this.num('calc.ishaAngle', 5, 25, 0.1)) : '',
        m.id === 'custom' ? this.field(L('Ou Icha = Maghrib + minutes', 'Or Isha = Maghrib + minutes', 'أو العشاء بعد المغرب بـ'), this.num('calc.ishaInterval', 0, 180), L('0 = utiliser l’angle', '0 = use angle', '0 = استخدام الزاوية')) : '',
        this.field(L('Asr', 'Asr', 'العصر'), this.seg('calc.madhab', [['shafi', L('Majorité (Chafi‘i, Maliki, Hanbali)', 'Standard (Shafi‘i, Maliki, Hanbali)', 'الجمهور')], ['hanafi', 'Hanafi']]), undefined, true),
        this.field(L('Hautes latitudes', 'High latitudes', 'خطوط العرض العليا'), this.select('calc.highLat', [['auto', L('Angle crépusculaire (recommandé)', 'Twilight angle (recommended)', 'زاوية الشفق (موصى به)')], ['middle', L('Milieu de la nuit', 'Middle of the night', 'منتصف الليل')], ['seventh', L('Septième de la nuit', 'Seventh of the night', 'سُبع الليل')]]))),
      this.group(L('Ajustements manuels (minutes)', 'Manual adjustments (minutes)', 'تعديل يدوي (بالدقائق)'),
        h('p', { class: 'note wide' }, L('Pour aligner l’écran sur le calendrier local de la mosquée (ihtiyat). Ex. : Maghrib +3.', 'Align the screen with your local timetable (ihtiyat). E.g. Maghrib +3.', 'لمطابقة التقويم المحلي (الاحتياط). مثال: المغرب +3.')),
        h('div', { class: 'adj wide' }, ...PRAYERS.map((k) => h('label', { class: 'adj-cell' }, h('span', { class: 'ar' }, PRAYER_AR[k]), this.num(`calc.adjust.${k}`, -60, 60, 1, true))))),
      this.group(L('Vérification', 'Verification', 'التحقق'),
        this.btn(L('Comparer avec l’API Aladhan', 'Compare with Aladhan API', 'المقارنة مع Aladhan'), () => void verify(), icons.check, 'primary'), verifyOut),
      this.group(L('Calendrier hégirien', 'Hijri calendar', 'التقويم الهجري'),
        this.field(L('Correction (jours)', 'Correction (days)', 'تصحيح (أيام)'), this.num('calc.hijriAdjust', -3, 3), L('Selon l’observation locale du croissant.', 'Per local moon sighting.', 'حسب رؤية الهلال المحلية.')),
        this.toggle('calc.hijriAtMaghrib', L('Changer de jour au Maghrib', 'New day at Maghrib', 'يبدأ اليوم عند المغرب'))),
    ];
  }

  private secIqama(s: Settings) {
    return [
      this.group(L('Iqama par prière', 'Iqamah per prayer', 'الإقامة لكل صلاة'),
        h('div', { class: 'iq wide' },
          ...SALAWAT.map((k) => {
            const rule = s.iqama[k];
            return h('div', { class: 'iq-row' },
              h('div', { class: 'iq-name' }, h('span', { class: 'ar' }, PRAYER_AR[k]), h('small', null, prayerName(k, lang === 'ar' ? 'fr' : lang))),
              this.select(`iqama.${k}.mode`, [['offset', L('Après l’adhan', 'After adhan', 'بعد الأذان')], ['fixed', L('Heure fixe', 'Fixed time', 'وقت ثابت')]], true),
              rule.mode === 'offset'
                ? h('div', { class: 'iq-val' }, this.num(`iqama.${k}.offset`, 0, 90), h('span', null, 'min'))
                : h('div', { class: 'iq-val' }, this.text(`iqama.${k}.time`, { type: 'time' })));
          }))),
      this.group(L('Joumou‘a', 'Jumu‘ah', 'الجمعة'),
        this.field(L('Heure de la prière du vendredi', 'Friday prayer time', 'وقت صلاة الجمعة'), h('input', {
          class: 'in', type: 'time', value: s.mosque.jumuah[0] || '', 'data-key': 'jumuah',
          onchange: (e: Event) => settings.set((x) => { x.mosque.jumuah = [(e.target as HTMLInputElement).value, x.mosque.jumuah[1] || ''].filter(Boolean); }),
        }), L('Heure de début du prêche / iqama. Laisser vide pour suivre Dhohr.', 'Khutbah / iqamah start. Empty = follow Dhuhr.', 'وقت بداية الخطبة. اتركه فارغاً لاتباع الظهر.')),
        this.field(L('Deuxième Joumou‘a (optionnel)', 'Second Jumu‘ah (optional)', 'جمعة ثانية (اختياري)'), h('input', {
          class: 'in', type: 'time', value: s.mosque.jumuah[1] || '', 'data-key': 'jumuah2',
          onchange: (e: Event) => settings.set((x) => { x.mosque.jumuah = [x.mosque.jumuah[0] || '', (e.target as HTMLInputElement).value].filter(Boolean); }),
        }), L('Affichée dans le bandeau des horaires.', 'Shown with the prayer times.', 'تظهر مع المواقيت.'))),
      this.group(L('Prière de l’Aïd', 'Eid prayer', 'صلاة العيد'),
        this.field(L('Date', 'Date', 'التاريخ'), this.text('eid.date', { type: 'date' })),
        this.field(L('Heure', 'Time', 'الوقت'), this.text('eid.time', { type: 'time' }), L('Annoncée sur l’écran trois jours avant.', 'Announced on screen three days before.', 'يُعلن عنها قبل ثلاثة أيام.')),
        Object.keys(s.eid).some((k) => (s.eid as Record<string, string>)[k]) ? this.btn(L('Effacer', 'Clear', 'مسح'), () => { settings.set((x) => { x.eid = { date: '', time: '' }; }); this.render(); }, icons.close, 'ghost') : '',
        this.field(L('Durée de l’écran Joumou‘a (min)', 'Jumu‘ah screen (min)', 'مدة شاشة الجمعة'), this.num('phases.jumuahMinutes', 0, 120))),
      this.group(L('Écrans automatiques', 'Automatic screens', 'الشاشات التلقائية'),
        this.field(L('Écran d’adhan (min)', 'Adhan screen (min)', 'شاشة الأذان (دقائق)'), this.num('phases.adhanScreenMinutes', 0, 15)),
        this.toggle('phases.iqamaCountdown', L('Compte à rebours plein écran avant l’iqama', 'Full-screen iqamah countdown', 'عدّ تنازلي للإقامة')),
        this.field(L('Écran « prière en cours » (min)', '“Prayer in progress” (min)', 'شاشة الصلاة (دقائق)'), this.num('phases.prayerMinutes', 0, 40), L('Écran sombre pendant la prière.', 'Dark screen during prayer.', 'شاشة داكنة أثناء الصلاة.')),
        this.toggle('phases.adhkar', L('Adhkar après la prière', 'After-prayer adhkar', 'أذكار بعد الصلاة'), L('Dans l’ordre de Hisn al-Muslim, avec le nombre de répétitions ; adhkar propres au Fajr et au Maghrib inclus.', 'In Hisn al-Muslim order, with repetition counts; Fajr- and Maghrib-specific adhkar included.', 'بترتيب حصن المسلم مع عدد التكرار، وأذكار الفجر والمغرب الخاصة.'), true),
        s.phases.adhkar ? this.toggle('phases.adhkarAuto', L('Durée automatique', 'Automatic duration', 'مدة تلقائية'), L('Le temps de réciter chaque dhikr (≈ 4 min, un peu plus après Fajr et Maghrib).', 'Time to recite each dhikr (≈ 4 min, a little longer after Fajr and Maghrib).', 'وقت قراءة كل ذكر (حوالي ٤ دقائق).'), true) : '',
        s.phases.adhkar && !s.phases.adhkarAuto ? this.field(L('Durée (min)', 'Duration (min)', 'المدة (دقائق)'), this.num('phases.adhkarMinutes', 1, 20)) : '',
        s.phases.adhkar ? this.toggle('phases.adhkarHome', L('Aussi en mode maison', 'Also in home mode', 'في وضع المنزل أيضاً'), L('Après le temps estimé de la prière.', 'After the estimated prayer time.', 'بعد الوقت المقدّر للصلاة.')) : ''),
    ];
  }

  private secAthan(s: Settings) {
    const all: { id: string; name: string; nameAr: string; origin: string; seconds: number; custom?: boolean }[] = [
      ...s.athan.custom.map((c) => ({ id: c.id, name: c.name, nameAr: 'تسجيل خاص', origin: L('Personnel', 'Custom', 'خاص'), seconds: 0, custom: true })),
      ...ATHANS,
    ];
    const upload = h('input', {
      type: 'file', accept: 'audio/*', class: 'file',
      onchange: async (e: Event) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) return;
        const id = `custom:${Date.now()}`;
        await blobs.set(id, f);
        settings.set((x) => { x.athan.custom.push({ id, name: f.name.replace(/\.[^.]+$/, '') }); x.athan.sound = id; });
        this.render();
      },
    });
    const togglePreview = async (id: string) => {
      unlockAudio();
      if (this.previewing === id) { stopAudio(); this.previewing = ''; }
      else { this.previewing = id; const ok = await playAthan(id, settings.get().athan.volume); if (!ok) this.previewing = ''; }
      this.render();
    };
    const offline = async (id: string, btn: HTMLElement) => {
      btn.classList.add('busy');
      const label = btn.querySelector('span');
      try {
        await downloadAthan(id, (p) => { if (label) label.textContent = `${Math.round(p * 100)} %`; });
        this.offline.add(id);
      } catch { if (label) label.textContent = L('Échec', 'Failed', 'فشل'); return; }
      this.render();
    };
    const fmt = (sec: number) => (sec ? `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}` : '');

    return [
      this.group(L('Général', 'General', 'عام'),
        this.toggle('athan.enabled', L('Jouer l’adhan', 'Play the adhan', 'تشغيل الأذان'), L('Sur Android TV, l’adhan démarre seul. Dans un navigateur, touchez l’écran une fois après chaque démarrage.', 'On Android TV it starts by itself. In a browser, tap the screen once after each start.', 'على Android TV يبدأ تلقائياً.'), true),
        this.field(L('Volume', 'Volume', 'مستوى الصوت'), [h('input', {
          class: 'range', type: 'range', min: 0, max: 1, step: 0.05, value: String(s.athan.volume), 'data-key': 'athan.volume',
          onchange: (e: Event) => setPath('athan.volume', +(e.target as HTMLInputElement).value),
        })]),
        this.field(L('Volume du Fajr', 'Fajr volume', 'مستوى صوت الفجر'), [h('input', {
          class: 'range', type: 'range', min: 0, max: 1, step: 0.05, value: String(s.athan.fajrVolume), 'data-key': 'athan.fajrVolume',
          onchange: (e: Event) => setPath('athan.fajrVolume', +(e.target as HTMLInputElement).value),
        })], L('Souvent plus bas, pour les voisins.', 'Often lower, for the neighbours.', 'غالباً أخفض مراعاةً للجيران.')),
        this.btn(L('Tester le carillon', 'Test chime', 'تجربة التنبيه'), () => { unlockAudio(); chime(settings.get().athan.volume); }, icons.sound),
        this.toggle('athan.iqamaBeep', L('Carillon à l’iqama', 'Chime at iqamah', 'تنبيه عند الإقامة')),
        this.field(L('Rappel avant l’adhan (min)', 'Reminder before adhan (min)', 'تنبيه قبل الأذان'), this.num('athan.preAlertMinutes', 0, 30), L('0 = désactivé', '0 = off', '0 = معطل'))),
      this.group(L('Par prière', 'Per prayer', 'لكل صلاة'),
        h('div', { class: 'adj wide' }, ...SALAWAT.map((k) => h('label', { class: 'adj-cell' }, h('span', { class: 'ar' }, PRAYER_AR[k]),
          this.select(`athan.perPrayer.${k}`, [['athan', L('Adhan', 'Adhan', 'أذان')], ['beep', L('Carillon', 'Chime', 'تنبيه')], ['off', L('Silence', 'Silent', 'صامت')]]))))),
      this.group(L('Voix de l’adhan', 'Adhan voice', 'صوت الأذان'),
        h('div', { class: 'row wide' }, this.btn(L('Importer l’adhan de votre muezzin (MP3)', 'Upload your muezzin’s adhan (MP3)', 'رفع أذان مؤذنكم'), () => upload.click(), icons.upload, 'primary'), upload),
        h('div', { class: 'athans wide' }, ...all.map((a) => {
          const isMain = s.athan.sound === a.id, isFajr = s.athan.fajrSound === a.id;
          const off = a.custom || this.offline.has(a.id);
          return h('div', { class: `athan ${isMain || isFajr ? 'sel' : ''}` },
            h('button', { class: `ath-play ${this.previewing === a.id ? 'on' : ''}`, type: 'button', 'aria-label': 'preview', 'data-key': `pv-${a.id}`, onclick: () => void togglePreview(a.id) }, svg(this.previewing === a.id ? icons.stop : icons.play)),
            h('div', { class: 'ath-info' }, h('b', { class: lang === 'ar' ? 'ar' : '' }, lang === 'ar' ? a.nameAr : a.name), h('span', { class: lang === 'ar' ? '' : 'ar' }, lang === 'ar' ? a.name : a.nameAr), h('small', null, [lang === 'ar' ? '' : a.origin, fmt(a.seconds), off ? L('✓ hors-ligne', '✓ offline', '✓ محفوظ للعمل دون إنترنت') : ''].filter(Boolean).join(' · '))),
            h('div', { class: 'ath-actions' },
              h('button', { class: `chip-btn ${isMain ? 'on' : ''}`, type: 'button', 'data-key': `main-${a.id}`, onclick: () => { setPath('athan.sound', a.id); this.render(); } }, L('Adhan', 'Adhan', 'الأذان')),
              h('button', { class: `chip-btn ${isFajr ? 'on' : ''}`, type: 'button', 'data-key': `fajr-${a.id}`, onclick: () => { setPath('athan.fajrSound', a.id); this.render(); } }, L('Fajr', 'Fajr', 'الفجر')),
              off ? (a.custom ? h('button', {
                class: 'chip-btn ghost', type: 'button', 'data-key': `del-${a.id}`,
                onclick: async () => { await blobs.del(a.id); settings.set((x) => { x.athan.custom = x.athan.custom.filter((c) => c.id !== a.id); if (x.athan.sound === a.id) x.athan.sound = 'mishary-afasy'; if (x.athan.fajrSound === a.id) x.athan.fajrSound = 'mishary-fajr'; }); this.render(); },
              }, svg(icons.close)) : '')
                : h('button', { class: 'chip-btn ghost', type: 'button', 'data-key': `dl-${a.id}`, title: L('Disponible hors-ligne', 'Make available offline', 'حفظ للاستخدام دون إنترنت'), onclick: (e: Event) => void offline(a.id, e.currentTarget as HTMLElement) }, svg(icons.download), h('span', null, ''))));
        })),
        h('p', { class: 'note wide' }, L('Les enregistrements sont diffusés depuis archive.org. Téléchargez ceux que vous utilisez (⬇) pour qu’ils fonctionnent sans internet.', 'Recordings stream from archive.org. Download the ones you use (⬇) so they work offline.', 'التسجيلات من archive.org. احفظ ما تستخدمه للعمل دون إنترنت.'))),
    ];
  }

  private secDisplay(s: Settings) {
    const themes: [Settings['display']['theme'], string, string][] = [
      ['emerald', L('Émeraude', 'Emerald', 'زمردي'), 'linear-gradient(135deg,#0a2219,#04110d 60%,#e8c77d)'],
      ['night', L('Nuit', 'Night', 'ليلي'), 'linear-gradient(135deg,#0c1330,#050816 60%,#e6d3a3)'],
      ['sand', L('Sable', 'Sand', 'رملي'), 'linear-gradient(135deg,#2a1c0e,#140d06 60%,#f0c27a)'],
      ['royal', L('Royal', 'Royal', 'ملكي'), 'linear-gradient(135deg,#2a0d22,#12060f 60%,#eccb84)'],
    ];
    const selected = new Set(s.display.backgrounds);
    return [
      this.group(L('Langue & thème', 'Language & theme', 'اللغة والسمة'),
        this.field(L('Langue', 'Language', 'اللغة'), this.seg('lang', [['fr', 'Français'], ['en', 'English'], ['ar', 'العربية']]), L('L’arabe est toujours affiché ; cette langue est la seconde.', 'Arabic is always shown; this is the secondary language.', 'العربية تظهر دائماً.'), true),
        h('div', { class: 'themes wide' }, ...themes.map(([id, label, bg]) => h('button', {
          class: `theme ${s.display.theme === id ? 'on' : ''}`, type: 'button', 'data-key': `theme-${id}`,
          onclick: () => { setPath('display.theme', id); this.render(); },
        }, h('i', { style: `background:${bg}` }), h('span', null, label))))),
      this.group(L('Arrière-plan', 'Background', 'الخلفية'),
        this.field('', this.seg('display.background', [['slideshow', L('Diaporama de mosquées', 'Mosque slideshow', 'عرض صور المساجد')], ['mosque', L('Photo de ma mosquée', 'My mosque photo', 'صورة مسجدي')], ['pattern', L('Dégradé sobre', 'Plain gradient', 'خلفية متدرجة')]]),
          s.display.background === 'mosque' && !s.mosque.hasImage ? L('Ajoutez d’abord une photo dans l’onglet Mosquée.', 'Add a photo in the Mosque tab first.', 'أضف صورة أولاً.') : undefined, true),
        s.display.background === 'slideshow' ? h('div', { class: 'bgs wide' }, ...BACKGROUNDS.map((b) => h('button', {
          class: `bg-thumb ${selected.size === 0 || selected.has(b.id) ? 'on' : ''}`, type: 'button', 'data-key': `bg-${b.id}`, title: `${bgLabel(b)} — © ${b.author}, ${b.license}`,
          style: `background-image:url("backgrounds/lite/${b.id}.jpg")`,
          onclick: () => {
            settings.set((x) => {
              const cur = new Set(x.display.backgrounds.length ? x.display.backgrounds : BACKGROUNDS.map((y) => y.id));
              if (cur.has(b.id)) cur.delete(b.id); else cur.add(b.id);
              x.display.backgrounds = cur.size === BACKGROUNDS.length || cur.size === 0 ? [] : Array.from(cur);
            });
            this.render();
          },
        }, h('span', null, bgLabel(b))))) : '',
        this.field(L('Durée par photo (s)', 'Seconds per photo', 'مدة كل صورة'), this.num('display.slideSeconds', 10, 600)),
        this.toggle('display.kenBurns', L('Effet de mouvement lent (Ken Burns)', 'Slow pan & zoom (Ken Burns)', 'حركة بطيئة للصور'))),
      this.group(L('Contenus', 'Content', 'المحتوى'),
        this.toggle('display.showAyat', L('Versets du Coran', 'Qur’an verses', 'آيات قرآنية')),
        this.toggle('display.showAdhkar', L('Adhkar & invocations', 'Adhkar & supplications', 'أذكار وأدعية')),
        this.toggle('display.showAnnouncements', L('Annonces de la mosquée', 'Mosque notices', 'إعلانات المسجد')),
        this.toggle('display.ticker', L('Bandeau défilant', 'Scrolling ticker', 'شريط متحرك')),
        this.toggle('display.tickerHadith', L('Ahadith dans le bandeau', 'Ahadith in the ticker', 'أحاديث في الشريط'), L('Hadiths authentiques de Sahih al-Bukhari, avec référence.', 'Authentic hadiths from Sahih al-Bukhari, with reference.', 'أحاديث صحيحة من صحيح البخاري مع رقمها.')),
        lang === 'ar' ? '' : this.field(L('Langue du bandeau', 'Ticker language', 'لغة الشريط'), this.seg('display.tickerLang', [['ar', L('Arabe (défile de gauche à droite)', 'Arabic (scrolls left → right)', 'العربية')], ['translation', L('Traduction française', 'English translation', 'الترجمة')]]), undefined, true),
        this.field(L('Vitesse du bandeau', 'Ticker speed', 'سرعة الشريط'), this.seg('display.tickerSpeed', [['slow', L('Lente', 'Slow', 'بطيئة')], ['normal', L('Normale', 'Normal', 'عادية')], ['fast', L('Rapide', 'Fast', 'سريعة')]])),
        this.toggle('display.phoneNotice', L('« Éteignez vos téléphones » à l’heure de la prière', '“Switch off phones” at prayer time', 'تنبيه إغلاق الهواتف وقت الصلاة'), L('Remplace le bandeau de l’adhan jusqu’à la fin de la prière.', 'Replaces the ticker from the adhan until the end of the prayer.', 'يظهر من الأذان حتى نهاية الصلاة.')),
        this.toggle('display.weather', L('Météo', 'Weather', 'الطقس')),
        this.field(L('Unité de température', 'Temperature unit', 'وحدة الحرارة'), this.seg('display.tempUnit', [['c', '°C'], ['f', '°F']])),
        this.field(L('Durée d’affichage (s)', 'Display time (s)', 'مدة العرض'), this.num('display.contentSeconds', 8, 120), L('Allongée automatiquement pour les textes longs.', 'Extended automatically for long texts.', 'تُمدد تلقائياً للنصوص الطويلة.'))),
      this.group(L('Horloge & écran', 'Clock & screen', 'الساعة والشاشة'),
        this.toggle('display.clock24', L('Format 24 h', '24-hour clock', 'نظام 24 ساعة')),
        this.toggle('display.showSeconds', L('Afficher les secondes', 'Show seconds', 'إظهار الثواني')),
        this.field(L('Orientation', 'Orientation', 'الاتجاه'), this.seg('display.orientation', [['auto', L('Auto', 'Auto', 'تلقائي')], ['landscape', L('Paysage', 'Landscape', 'أفقي')], ['portrait', L('Portrait', 'Portrait', 'عمودي')]]), undefined, true),
        this.field(L('Mode léger (TV peu puissantes)', 'Lite mode (weak TVs)', 'الوضع الخفيف'), this.seg('display.lite', [['auto', L('Auto', 'Auto', 'تلقائي')], ['on', L('Activé', 'On', 'مفعّل')], ['off', L('Désactivé', 'Off', 'معطّل')]]), L('Supprime flous et animations coûteuses, images 720p.', 'Removes blur & heavy animations, 720p images.', 'يزيل المؤثرات الثقيلة.'), true),
        this.toggle('display.arabicDigits', L('Chiffres arabes (١٢:٣٠)', 'Arabic-Indic digits (١٢:٣٠)', 'أرقام هندية (١٢:٣٠)')),
        this.field(L('Taille des textes', 'Text size', 'حجم النصوص'), this.seg('display.textScale', [['0.9', '90 %'], ['1', '100 %'], ['1.15', '115 %'], ['1.3', '130 %']])),
        this.toggle('display.nightDim', L('Assombrir la nuit', 'Dim at night', 'تعتيم ليلاً'), L('Par défaut : de Icha + 1 h à 45 min avant Fajr.', 'Default: from Isha + 1 h to 45 min before Fajr.', 'افتراضياً: من العشاء +1س إلى قبل الفجر بـ45 د.'), true),
        s.display.nightDim ? this.field(L('Assombrir de', 'Dim from', 'من الساعة'), this.text('display.nightDimFrom', { type: 'time' }), L('Laisser vide = automatique', 'Empty = automatic', 'فارغ = تلقائي')) : '',
        s.display.nightDim ? this.field(L('jusqu’à', 'until', 'إلى الساعة'), this.text('display.nightDimTo', { type: 'time' })) : ''),
      this.group(L('Informations affichées', 'Displayed information', 'المعلومات المعروضة'),
        this.toggle('display.showSunrise', L('Carte du Chourouq', 'Sunrise card', 'بطاقة الشروق')),
        this.toggle('display.showIqamaOnCards', L('Heures d’iqama sur les cartes', 'Iqamah times on cards', 'أوقات الإقامة على البطاقات')),
        this.toggle('display.showHijri', L('Date hégirienne', 'Hijri date', 'التاريخ الهجري')),
        this.toggle('display.showDuha', L('Heure du Duha', 'Duha time', 'وقت الضحى'), L('15 min après le lever du soleil.', '15 min after sunrise.', 'بعد الشروق بربع ساعة.')),
        this.toggle('display.showQiyam', L('Dernier tiers de la nuit (Qiyam)', 'Last third of the night (Qiyam)', 'الثلث الأخير من الليل'))),
      this.group(L('Ramadan', 'Ramadan', 'رمضان'),
        this.toggle('ramadan.auto', L('Mode Ramadan automatique', 'Automatic Ramadan mode', 'وضع رمضان تلقائي'), L('Imsak et Iftar affichés pendant le mois de Ramadan.', 'Shows Imsak & Iftar during Ramadan.', 'إظهار الإمساك والإفطار.')),
        this.toggle('ramadan.force', L('Forcer le mode Ramadan', 'Force Ramadan mode', 'فرض وضع رمضان')),
        this.field(L('Imsak = Fajr − minutes', 'Imsak = Fajr − minutes', 'الإمساك قبل الفجر بـ'), this.num('ramadan.imsakOffset', 0, 30))),
    ];
  }

  /** What the screen needs to run without internet, and whether it is in place. */
  private offlineStatus() {
    const s = settings.get();
    const list = h('ul', { class: 'checklist wide' });
    const row = (ok: boolean | null, label: string, hint: string) => h('li', { class: ok === null ? 'na' : ok ? 'ok' : 'todo' },
      svg(ok ? icons.check : icons.close), h('span', null, h('b', null, label), h('small', null, hint)));
    const fill = async () => {
      const off = await offlineAthans();
      const sw = !!navigator.serviceWorker?.controller || isNative();
      const athans = [s.athan.sound, s.athan.fajrSound].every((id) => id.indexOf('custom:') === 0 || off.has(id));
      list.innerHTML = '';
      list.append(
        row(sw, L('Application installée sur l’appareil', 'App stored on the device', 'التطبيق محفوظ على الجهاز'), sw ? L('Photos, polices et versets disponibles sans internet.', 'Photos, fonts and verses available offline.', 'الصور والخطوط والآيات متاحة دون إنترنت.') : L('Rechargez la page une fois connecté (ou utilisez l’APK).', 'Reload once while online (or use the APK).', 'أعد تحميل الصفحة مع الاتصال مرة واحدة.')),
        row(s.calc.source !== 'api' || null, L('Horaires de prière', 'Prayer times', 'مواقيت الصلاة'), s.calc.source === 'api' ? L('Source API : 2 mois en cache, puis calcul local automatique.', 'API source: 2 months cached, then local calculation.', 'مصدر API: شهران محفوظان ثم حساب محلي.') : L('Calculés sur l’appareil : aucun internet nécessaire.', 'Computed on the device: no internet needed.', 'تُحسب على الجهاز دون إنترنت.')),
        row(!s.athan.enabled || athans, L('Voix d’adhan choisies', 'Selected adhan voices', 'أصوات الأذان المختارة'), athans ? L('Enregistrées sur l’appareil.', 'Stored on the device.', 'محفوظة على الجهاز.') : L('Téléchargement automatique dès que l’appareil est connecté.', 'Downloaded automatically as soon as the device is online.', 'تُحمَّل تلقائياً عند الاتصال.')),
        row(null, L('Météo', 'Weather', 'الطقس'), L('Seule fonction qui a besoin d’internet ; masquée hors-ligne.', 'The only feature needing internet; hidden offline.', 'الميزة الوحيدة التي تحتاج إلى إنترنت.')));
    };
    void fill();
    return this.group(L('Fonctionnement hors-ligne', 'Offline readiness', 'العمل دون إنترنت'), list);
  }

  private secBackup(s: Settings) {
    const importInput = h('input', {
      type: 'file', accept: 'application/json,.json', class: 'file',
      onchange: async (e: Event) => {
        const f = (e.target as HTMLInputElement).files?.[0];
        if (!f) return;
        try { settings.replace(JSON.parse(await f.text())); invalidate(); this.render(); }
        catch { alert(L('Fichier invalide', 'Invalid file', 'ملف غير صالح')); }
      },
    });
    let resetArmed = false;
    return [
      this.group(L('Sauvegarde', 'Backup', 'النسخ الاحتياطي'),
        h('p', { class: 'note wide' }, L('Exportez la configuration pour la copier sur d’autres écrans de la mosquée (les images et MP3 restent sur l’appareil).', 'Export settings to copy them to other screens (images and MP3s stay on the device).', 'صدّر الإعدادات لنسخها إلى شاشات أخرى.')),
        h('div', { class: 'row wide' },
          this.btn(L('Exporter (.json)', 'Export (.json)', 'تصدير'), () => {
            const a = h('a', { href: URL.createObjectURL(new Blob([settings.export()], { type: 'application/json' })), download: `sakina-${(s.mosque.name || 'config').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json` });
            document.body.appendChild(a); a.click(); a.remove();
          }, icons.download, 'primary'),
          this.btn(L('Importer', 'Import', 'استيراد'), () => importInput.click(), icons.upload), importInput)),
      this.offlineStatus(),
      this.group(L('Sécurité', 'Security', 'الأمان'),
        this.field(L('Code PIN des réglages', 'Settings PIN', 'الرمز السري للإعدادات'), this.text('pin', { type: 'password', placeholder: '••••' }), L('Laisser vide pour désactiver. Empêche les modifications non autorisées.', 'Empty = disabled. Prevents unauthorised changes.', 'اتركه فارغاً للتعطيل.'))),
      this.group(L('Réinitialiser', 'Reset', 'إعادة التعيين'),
        this.btn(L('Réinitialiser tous les réglages', 'Reset all settings', 'إعادة تعيين كل الإعدادات'), (e) => {
          const b = e.currentTarget as HTMLElement;
          if (!resetArmed) { resetArmed = true; b.querySelector('span')!.textContent = L('Confirmer la réinitialisation ?', 'Confirm reset?', 'تأكيد؟'); b.classList.add('danger'); return; }
          settings.reset(); invalidate(); this.render();
        }, icons.close, 'ghost')),
      this.group(L('À propos', 'About', 'حول'),
        h('div', { class: 'about wide' },
          h('div', { class: 'about-logo', html: brandMark() }),
          h('div', null,
            h('b', null, `Sakina ${VERSION}`), h('span', { class: 'ar' }, ' — سكينة'),
            h('p', null, L('Application libre et gratuite (licence MIT), réalisée fi sabilillah. Horaires : adhan-js (Jean Meeus), API Aladhan. Coran : Tanzil. Adhkar : Hisn al-Muslim. Photos : Wikimedia Commons.', 'Free & open-source (MIT), made fi sabilillah. Times: adhan-js (Jean Meeus), Aladhan API. Qur’an: Tanzil. Adhkar: Hisn al-Muslim. Photos: Wikimedia Commons.', 'تطبيق مجاني ومفتوح المصدر، في سبيل الله.')),
            h('a', { href: REPO, target: '_blank', rel: 'noopener' }, REPO.replace('https://', ''))))),
    ];
  }
}

/** PIN gate shown before the settings when a PIN is set. */
export function askPin(lng: Lang, expected: string): Promise<boolean> {
  lang = lng;
  return new Promise((resolve) => {
    const input = h('input', { class: 'in pin-in num', type: 'password', inputmode: 'numeric', autocomplete: 'off', maxlength: 12 });
    const msg = h('div', { class: 'pin-msg' });
    const done = (ok: boolean) => { wrap.remove(); resolve(ok); };
    const check = () => { if (input.value === expected) done(true); else { msg.textContent = L('Code incorrect', 'Wrong code', 'رمز خاطئ'); input.value = ''; } };
    const pad = h('div', { class: 'pin-pad' }, ...['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map((k) => h('button', {
      type: 'button', class: k === '✓' ? 'ok' : '',
      onclick: () => { if (k === '⌫') input.value = input.value.slice(0, -1); else if (k === '✓') check(); else input.value += k; },
    }, k)));
    const box = h('div', { class: 'pin-box' }, h('div', { class: 'pin-star', html: brandMark() }), h('h3', null, L('Code PIN', 'PIN code', 'الرمز السري')), input, msg, pad);
    const wrap = h('div', { class: 'pin', dir: lng === 'ar' ? 'rtl' : 'ltr' }, box);
    wrap.addEventListener('keydown', (e) => {
      if (isBackKey(e)) { e.preventDefault(); done(false); return; }
      if (e.key === 'Enter' && document.activeElement === input) { e.preventDefault(); check(); return; }
      handleArrow(wrap, e);
    });
    document.body.appendChild(wrap);
    setTimeout(() => input.focus(), 30);
  });
}
