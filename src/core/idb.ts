/** Minimal IndexedDB key/value store for blobs (mosque photo, logo, custom & offline adhans). */
const DB = 'sakina';
const STORE = 'blobs';
let dbp: Promise<IDBDatabase> | null = null;

function db(): Promise<IDBDatabase> {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbp;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return db().then((d) => new Promise<T>((resolve, reject) => {
    const r = fn(d.transaction(STORE, mode).objectStore(STORE));
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  }));
}

export const blobs = {
  get: (k: string) => tx<Blob | undefined>('readonly', (s) => s.get(k) as IDBRequest<Blob | undefined>).catch(() => undefined),
  set: (k: string, v: Blob) => tx('readwrite', (s) => s.put(v, k)),
  del: (k: string) => tx('readwrite', (s) => s.delete(k)),
  keys: () => tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys()).then((k) => k.map(String)).catch(() => [] as string[]),
};

const urlCache = new Map<string, string>();
/** Object URL for a stored blob (memoised; revoked when replaced). */
export async function blobUrl(k: string): Promise<string | null> {
  const b = await blobs.get(k);
  const old = urlCache.get(k);
  if (old) URL.revokeObjectURL(old);
  if (!b) { urlCache.delete(k); return null; }
  const u = URL.createObjectURL(b);
  urlCache.set(k, u);
  return u;
}

/** Downscale an uploaded image so a 12-MP phone photo does not choke a TV. */
export function resizeImage(file: Blob, maxW: number, maxH: number, type = 'image/jpeg', quality = 0.82): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const r = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight);
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * r);
      c.height = Math.round(img.naturalHeight * r);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), type, quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('invalid image')); };
    img.src = url;
  });
}
