// Photos: receipts, the windscreen service sticker, the istimara and policy (the papers wallet), and accident pictures.
// A picture is shrunk on the phone (longest side 1600 px, JPEG), kept on this device first (IndexedDB) so it is never lost
// offline or mid-accident, then uploaded to your own Drive (Car - Autolime/photos/<kind>/) on the next sync. Only the
// record (kind, date, note, Drive id) is synced in state.json; the picture itself lives in Drive.
import { keyOf, uid } from './util.js';

export const KINDS = [['receipt', 'Receipt', '🧾'], ['sticker', 'Service sticker', '🏷️'], ['istimara', 'Istimara', '📄'], ['policy', 'Insurance policy', '🛡️'], ['licence', 'Licence', '🪪'], ['accident', 'Accident', '🚨'], ['part', 'A part / damage', '🔩'], ['other', 'Other', '📷']];
export const kindOf = (k) => KINDS.find(x => x[0] === k) || KINDS[KINDS.length - 1];
export const WALLET = ['istimara', 'policy', 'licence'];

const txt = (v, n = 80) => String(v ?? '').trim().slice(0, n);
const isKey = (v) => /^\d{4}-\d\d-\d\d$/.test(v || '');
export function savePhoto(s, p) {
  const id = p.id || 'p' + uid();
  const rec = { id, car: txt(p.car, 40), kind: kindOf(p.kind)[0], file: txt(p.file, 120), name: txt(p.name, 80), date: isKey(p.date) ? p.date : keyOf(new Date()), note: txt(p.note, 140), visit: txt(p.visit, 40), item: txt(p.item, 20), at: Date.now() };
  return { ...s, photos: { ...(s.photos || {}), [id]: rec } };
}
export function deletePhoto(s, id) { const photos = { ...(s.photos || {}) }; delete photos[id]; return { ...s, photos, deleted: { ...(s.deleted || {}), [`photo:${id}`]: Date.now() } }; }
export const photoList = (s, { car, kind, kinds } = {}) => Object.values(s.photos || {}).filter(p => (!car || p.car === car) && (!kind || p.kind === kind) && (!kinds || kinds.includes(p.kind))).sort((a, b) => b.date.localeCompare(a.date) || b.at - a.at);

// ── shrinking (browser only)
export async function shrink(file, max = 1600, q = 0.82) {
  if (typeof createImageBitmap !== 'function') return file;
  try {
    const bmp = await createImageBitmap(file), k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); bmp.close?.();
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', q));
    return blob && blob.size < file.size ? blob : file;
  } catch { return file; }
}

// ── this device's copies (IndexedDB): pending uploads and a cache of pictures already seen
const DB = 'autolime.photos', STORE = 'blobs';
let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res, rej) => { if (typeof indexedDB === 'undefined') return rej(new Error('No storage for photos in this browser')); const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return dbp;
}
const tx = async (mode, fn) => { const d = await db(); return new Promise((res, rej) => { const t = d.transaction(STORE, mode), st = t.objectStore(STORE), r = fn(st); t.oncomplete = () => res(r?.result); t.onerror = () => rej(t.error); }); };
export const putLocal = (id, blob) => tx('readwrite', st => st.put(blob, id));
export const getLocal = (id) => tx('readonly', st => st.get(id)).catch(() => null);
export const dropLocal = (id) => tx('readwrite', st => st.delete(id)).catch(() => {});

/** Upload every photo that is still only on this device. upload(kind, name, blob) → {id}. Returns how many went up. */
export async function flush(s, upload, onDone) {
  let n = 0;
  for (const p of Object.values(s.photos || {})) {
    if (p.file) continue;
    const blob = await getLocal(p.id); if (!blob) continue;   // taken on another device: that one uploads it
    const r = await upload(p.kind, p.name || `${p.kind}-${p.date}-${p.id}.jpg`, blob, { photo: p.id });
    onDone(p.id, r.id); n++;
  }
  return n;
}
/** An object URL for showing a photo: this device's copy, else Drive's (cached here after the first view). */
const urls = new Map();
export async function urlOf(p, download) {
  if (urls.has(p.id)) return urls.get(p.id);
  let blob = await getLocal(p.id);
  if (!blob && p.file && download) { blob = await download(p.file); putLocal(p.id, blob).catch(() => {}); }
  if (!blob) return '';
  const u = URL.createObjectURL(blob); urls.set(p.id, u); return u;
}
