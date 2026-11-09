/** Geocoding + weather via Open-Meteo (free, no API key, CORS-enabled). */

export interface Place { name: string; country: string; countryCode: string; admin: string; lat: number; lng: number; timezone: string }

export async function searchCity(q: string, lang: string): Promise<Place[]> {
  const url = `https://geocoding-api.open-meteo.com/v1/search?count=8&format=json&language=${encodeURIComponent(lang)}&name=${encodeURIComponent(q)}`;
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const j = await r.json();
  return (j.results || []).map((x: Record<string, string | number>) => ({
    name: String(x.name), country: String(x.country || ''), countryCode: String(x.country_code || ''),
    admin: String(x.admin1 || ''), lat: +x.latitude, lng: +x.longitude, timezone: String(x.timezone || ''),
  }));
}

/** Browser/TV geolocation → coordinates. Timezone and city are resolved afterwards. */
export function locate(): Promise<{ lat: number; lng: number; accuracy: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation unavailable'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy }),
      (e) => reject(new Error(e.message)),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 },
    );
  });
}

/** Timezone of a point (Open-Meteo returns it with forecasts). */
export async function timezoneAt(lat: number, lng: number): Promise<string> {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&timezone=auto&forecast_days=1&daily=sunrise`);
  const j = await r.json();
  return j.timezone as string;
}

/** Nearest named place for coordinates (BigDataCloud free client endpoint, no key). */
export async function reverseGeocode(lat: number, lng: number, lang: string): Promise<{ city: string; country: string; countryCode: string }> {
  const r = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=${lang}`);
  const j = await r.json();
  return { city: j.city || j.locality || j.principalSubdivision || '', country: j.countryName || '', countryCode: j.countryCode || '' };
}

export interface Weather { temp: number; code: number; isDay: boolean }

export async function fetchWeather(lat: number, lng: number): Promise<Weather> {
  const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code,is_day&timezone=auto`);
  const j = await r.json();
  return { temp: Math.round(j.current.temperature_2m), code: j.current.weather_code, isDay: !!j.current.is_day };
}

/** WMO weather code → icon family. */
export function weatherKind(code: number): 'clear' | 'partly' | 'cloud' | 'fog' | 'rain' | 'snow' | 'storm' {
  if (code === 0) return 'clear';
  if (code <= 2) return 'partly';
  if (code === 3) return 'cloud';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain';
}
