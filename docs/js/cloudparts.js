// How Vehicular's data is laid out on Drive (the family cloud model, claude/cloud-model.md, after Sudachi's cloudparts.js):
// one small core file (state.json: settings, tombstones, edit times, the migration mark) and every record — cars, workshops,
// quotes, photo records — split over 8 part files (records-0.json … records-7.json) by a hash of "<collection>:<id>". Logging
// a fill-up changes one car, so one part is uploaded instead of everything; a sync where another device changed one record
// downloads one part. Every file carries its own revision (appProperties.rev), so one folder listing says which parts moved.
// A state.json from before the split (records inside it) is still read, and merges the same way. Pure (no network).
import { RECORD_MAPS } from './store.js';

export const PARTS = 8;                  // fixed forever: changing it needs a migration
export const LAYOUT = 2;                 // 1 = everything in state.json, 2 = core + parts
export const partName = (i) => `records-${i}.json`;
export const isPart = (name) => /^records-\d\.json$/.test(name || '');
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
/** Which part a record lives in (stable forever). */
export const partOf = (coll, id) => hash(`${coll}:${id}`) % PARTS;
const COLLS = () => Object.keys(RECORD_MAPS);

/** A state → { core, parts: { 'records-0.json': {part, cars, workshops, …}, … } } (every part, empty ones included, so a part
 *  emptied by deletes is written empty rather than left with stale records). */
export function split(state) {
  const s = state || {}, rest = { ...s }, parts = {};
  for (const c of COLLS()) delete rest[c];
  for (let i = 0; i < PARTS; i++) { parts[partName(i)] = { part: i, layout: LAYOUT }; for (const c of COLLS()) parts[partName(i)][c] = {}; }
  for (const c of COLLS()) for (const [id, r] of Object.entries(s[c] || {})) parts[partName(partOf(c, id))][c][id] = r;
  return { core: { ...rest, layout: LAYOUT, parts: PARTS }, parts };
}
/** core (may be a legacy state.json with the records inside) + any parts read → one state for the merge. For the same record,
 *  the newer edit wins (they are merged record by record afterwards anyway). */
export function join(core, parts = {}) {
  const { layout, parts: _n, ...rest } = core || {}, out = { ...rest };
  for (const c of COLLS()) {
    const m = { ...((core && core[c]) || {}) };
    for (const p of Object.values(parts)) if (p && typeof p === 'object' && p[c] && typeof p[c] === 'object') for (const [id, r] of Object.entries(p[c])) { if (!m[id] || (+r?.at || 0) >= (+m[id]?.at || 0)) m[id] = r; }
    out[c] = m;
  }
  return out;
}
