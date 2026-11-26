// Bringing the car over from Calamansi (where the Car tab lived until Vehicular, 16–25/11/2026): its cars and the driver
// (settings.driver), read once from Calamansi's state.json (tag calamansi) or a Calamansi backup file. Nothing is deleted in
// Calamansi. Pure (no DOM).
import { sanitize } from './store.js';
import * as L from './car.js';

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
/** What a Calamansi state holds for Vehicular. */
export function carPart(cal) {
  const cars = isObj(cal?.cars) ? Object.values(cal.cars).filter(c => isObj(c) && typeof c.name === 'string' && c.name.trim()) : [];
  const driver = isObj(cal?.settings?.driver) ? L.cleanDriver(cal.settings.driver) : null;
  const hasDriver = !!driver && Object.values(driver).some(Boolean);
  return { cars, driver: hasDriver ? driver : null, counts: { cars: cars.length, driver: hasDriver ? 1 : 0, visits: cars.reduce((t, c) => t + (c.log?.length || 0), 0), fills: cars.reduce((t, c) => t + (c.fuel?.length || 0), 0) } };
}
/**
 * Merge Calamansi's cars into Vehicular: a car already here (same VIN, or the same name when there is no VIN) keeps whichever
 * copy was edited last; anything new comes in. The driver comes in field by field where Vehicular has nothing yet.
 */
export function applyMigration(local, cal, { now = Date.now() } = {}) {
  const { cars, driver, counts } = carPart(cal);
  if (!cars.length && !driver) return { state: local, changed: false, counts };
  let s = sanitize(local);
  for (const c of cars) {
    const here = L.carList(s).find(x => (c.vin && x.vin === c.vin) || (!c.vin && !x.vin && x.name === c.name));
    if (here && (here.at || 0) >= (c.at || 0)) continue;
    s = L.saveCar(s, { ...c, id: here?.id || c.id });
  }
  if (driver) { const cur = L.driverOf(s); s = L.setDriver(s, Object.fromEntries(Object.entries(driver).map(([k, v]) => [k, cur[k] || v]))); }
  s = { ...s, migrated: { from: 'calamansi', at: now, counts } };
  return { state: s, changed: true, counts };
}
export function describe(c) {
  const p = [];
  if (c?.cars) p.push(`${c.cars} car${c.cars === 1 ? '' : 's'}`);
  if (c?.visits) p.push(`${c.visits} service${c.visits === 1 ? '' : 's'} logged`);
  if (c?.fills) p.push(`${c.fills} fill-up${c.fills === 1 ? '' : 's'}`);
  if (c?.driver) p.push('your licence');
  return p.join(', ') || 'nothing';
}
/** A Calamansi backup or state (not an Vehicular one). */
export const looksLikeCalamansi = (j) => isObj(j) && (j.app === 'calamansi' || (!j.app && ('recipes' in j || 'chores' in j) && 'cars' in j));
