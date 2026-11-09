import { athanById, athanUrl } from '../data/athans';
import { blobs, blobUrl } from './idb';

/**
 * Adhan playback.
 *  - "custom:<key>"  → a recording uploaded by the mosque (IndexedDB)
 *  - catalogue id    → offline copy in IndexedDB if downloaded, otherwise streamed from archive.org
 * Browsers block autoplay until the first user gesture; `unlocked` tracks that.
 */
const el = new Audio();
el.preload = 'none';
if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__sakinaAudio = el;
let ctx: AudioContext | null = null;
let unlocked = false;
const unlockListeners = new Set<() => void>();

export const isNative = () => !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();

export function audioUnlocked() { return unlocked || isNative(); }
export function onUnlock(fn: () => void) { unlockListeners.add(fn); }

/** Call from a user-gesture handler. */
export function unlockAudio() {
  if (unlocked) return;
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx || new AC();
    if (ctx.state === 'suspended') void ctx.resume();
    const buf = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(ctx.destination); src.start(0);
  } catch { /* no WebAudio */ }
  // Never interrupt an adhan that is already playing.
  if (!el.paused && !el.ended) { unlocked = true; unlockListeners.forEach((f) => f()); return; }
  // Prime the <audio> element (inside the gesture) with a generated silent WAV so later .play() calls are allowed.
  el.src = URL.createObjectURL(silentWav());
  const p = pending;
  pending = null;
  el.play().catch(() => undefined).then(() => {
    // An adhan that the browser blocked a moment ago plays as soon as someone touches the screen.
    if (p && Date.now() - p.at < 180000) void playAthan(p.id, p.volume);
  });
  unlocked = true;
  unlockListeners.forEach((f) => f());
}

function silentWav(): Blob {
  const samples = 800, buf = new ArrayBuffer(44 + samples), v = new DataView(buf);
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + samples, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true);
  w(36, 'data'); v.setUint32(40, samples, true);
  for (let i = 0; i < samples; i++) v.setUint8(44 + i, 128);
  return new Blob([buf], { type: 'audio/wav' });
}

async function resolveSrc(id: string): Promise<string | null> {
  if (id.indexOf('custom:') === 0) return blobUrl(id);
  const a = athanById(id);
  if (!a) return null;
  const offline = await blobUrl('athan:' + id);
  return offline ?? athanUrl(a);
}

let stopTimer = 0;
let pending: { id: string; volume: number; at: number } | null = null;
export async function playAthan(id: string, volume: number, maxSeconds = 0): Promise<boolean> {
  stopAudio();
  const src = await resolveSrc(id);
  if (!src) return false;
  el.src = src;
  el.volume = Math.max(0, Math.min(1, volume));
  try {
    await el.play();
    // Autoplay is evidently allowed here (kiosk browser, Android WebView…): no need to ask for a tap.
    if (!unlocked) { unlocked = true; unlockListeners.forEach((f) => f()); }
    if (maxSeconds > 0) stopTimer = window.setTimeout(() => fadeOut(), maxSeconds * 1000);
    return true;
  } catch (e) {
    if (import.meta.env.DEV) console.warn('[sakina] adhan playback failed:', (e as Error).name, (e as Error).message);
    if ((e as Error).name === 'NotAllowedError') { pending = { id, volume, at: Date.now() }; unlocked = false; }
    return false;
  }
}

export function fadeOut(ms = 2500) {
  // setInterval (not requestAnimationFrame): rAF stops in background tabs and the adhan would never stop.
  if (el.paused) return;
  const start = el.volume; const t0 = Date.now();
  const id = window.setInterval(() => {
    const k = Math.min(1, (Date.now() - t0) / ms);
    el.volume = start * (1 - k);
    if (k >= 1) { clearInterval(id); stopAudio(); }
  }, 50);
}

export function stopAudio() {
  clearTimeout(stopTimer);
  try { el.pause(); el.currentTime = 0; } catch { /* ignore */ }
}

export const isPlaying = () => !el.paused && !el.ended;
export function onEnded(fn: () => void) { el.addEventListener('ended', fn); }

/** Soft two-tone chime (WebAudio, no file needed) for iqama / reminders. */
export function chime(volume = 0.6) {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx || new AC();
    const c = ctx;
    if (c.state === 'suspended') void c.resume();
    const tone = (freq: number, at: number, dur: number) => {
      const o = c.createOscillator(); const g = c.createGain();
      o.type = 'sine'; o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, c.currentTime + at);
      g.gain.exponentialRampToValueAtTime(volume * 0.5, c.currentTime + at + 0.04);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + at + dur);
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime + at); o.stop(c.currentTime + at + dur + 0.05);
    };
    tone(659.25, 0, 1.4); tone(880, 0.35, 1.8); tone(1318.5, 0.35, 1.2);
  } catch { /* no audio */ }
}

/** Download a catalogue adhan into IndexedDB so it plays without internet. */
export async function downloadAthan(id: string, onProgress?: (p: number) => void): Promise<void> {
  const a = athanById(id);
  if (!a) throw new Error('unknown adhan');
  const res = await fetch(athanUrl(a));
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
  const total = +(res.headers.get('content-length') || 0);
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = []; let got = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value); got += value.length;
    if (total && onProgress) onProgress(got / total);
  }
  await blobs.set('athan:' + id, new Blob(chunks as BlobPart[], { type: 'audio/mpeg' }));
}

export async function offlineAthans(): Promise<Set<string>> {
  const keys = await blobs.keys();
  return new Set(keys.filter((k) => k.indexOf('athan:') === 0).map((k) => k.slice(6)));
}
