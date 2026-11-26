// Checks a backup / restored state before it replaces this device's copy. Pure (no DOM, no storage).
// A file that parses as JSON can still blank every tab: `{"cars":{"x":"no"}}` is valid JSON but not a car.
// The rules mirror store.js sanitize() and go one level deeper, so whatever survives here also survives a reload.

// collections that are maps id → record
const MAPS = ['cars', 'workshops', 'quotes', 'photos', 'deleted', 'stamps'];
const NAME = { cars: 'name', workshops: 'name' };
const OWN = new Set([...MAPS, 'app', 'version', 'updatedAt', 'settings', 'migrated', 'outbox', 'google']);
const SCALAR_MAPS = new Set(['deleted', 'stamps']);
const isObj = (x) => !!x && typeof x === 'object' && !Array.isArray(x);

/**
 * json: the parsed file. → { ok, error, state (cleaned copy), dropped: [what was left out], summary: { savedAt, counts: {..} } }
 * ok is false (and state null) only when nothing usable is in it; otherwise bad records are dropped and listed.
 */
export function checkBackup(json) {
  if (!isObj(json)) return { ok: false, error: 'This is not an Vehicular backup (no data in it).', state: null, dropped: [], summary: null };
  if (json.app && json.app !== 'autolime') return { ok: false, error: `This is a backup of ${String(json.app).slice(0, 20)}, not Vehicular. To bring your car over from Calamansi, use Settings › Bring my car over from Calamansi.`, state: null, dropped: [], summary: null };
  if (!MAPS.slice(0, 4).some(k => isObj(json[k]))) return { ok: false, error: 'This is not an Vehicular backup: it has no cars or workshops.', state: null, dropped: [], summary: null };
  const s = JSON.parse(JSON.stringify(json)), dropped = [];
  for (const k of MAPS) {
    if (!(k in s)) continue;
    if (!isObj(s[k])) { dropped.push(`${k} (not a list)`); delete s[k]; continue; }
    if (SCALAR_MAPS.has(k)) continue;
    let bad = 0; for (const [id, v] of Object.entries(s[k])) if (!isObj(v) || (NAME[k] && typeof v[NAME[k]] !== 'string')) { delete s[k][id]; bad++; }
    if (bad) dropped.push(`${bad} unreadable ${k} entr${bad > 1 ? 'ies' : 'y'}`);
  }
  if ('outbox' in s && !Array.isArray(s.outbox)) delete s.outbox;
  // only what Vehicular owns comes in: recipes, chores and the rest stay with their own app
  const foreign = Object.keys(s).filter(k => !OWN.has(k)); for (const k of foreign) delete s[k];
  if (foreign.length) dropped.push(`not Vehicular's: ${foreign.slice(0, 6).join(', ')}${foreign.length > 6 ? '…' : ''}`);
  for (const k of ['settings', 'google']) if (k in s && !isObj(s[k])) { delete s[k]; dropped.push(`${k} (unreadable)`); }
  const n = (k) => isObj(s[k]) ? Object.keys(s[k]).length : 0;
  const counts = { cars: n('cars'), workshops: n('workshops'), quotes: n('quotes'), photos: n('photos') };
  return { ok: true, error: '', state: s, dropped, summary: { savedAt: +s.updatedAt || 0, counts } };
}

/** One line for the preview: "1 car · 3 workshops" (zeros left out). */
export const describeCounts = (c) => Object.entries(c || {}).filter(([, v]) => v).map(([k, v]) => `${v} ${v === 1 ? k.replace(/s$/, '').replace(/ie$/, 'y') : k}`).join(' · ') || 'nothing but settings';
