// The car's money, month by month: fuel, servicing, trips, and what the car really costs per km once the insurance and the
// tyres are spread over the km you drive. Pure (no DOM).
import { keyOf, fromKey } from './util.js';
import * as CC from './carcare.js';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const ym = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
/** The last `n` months up to now: [{ key: '2026-11', label: 'Nov', fuel, care, trip, litres, km }] */
export function months(car, now = new Date(), n = 12) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); out.push({ key: ym(d), label: MON[d.getMonth()], year: d.getFullYear(), fuel: 0, care: 0, trip: 0, litres: 0, km: 0 }); }
  const at = Object.fromEntries(out.map(m => [m.key, m]));
  for (const f of car.fuel || []) { const m = at[f.date.slice(0, 7)]; if (m) { m.fuel += f.cost || 0; m.litres += f.litres || 0; } }
  for (const v of car.log || []) { const m = at[v.date.slice(0, 7)]; if (m) m.care += v.cost || 0; }
  for (const t of [car.trip, ...(car.trips || [])].filter(Boolean)) for (const x of t.log || []) if (x.kind !== 'fuel') { const m = at[x.date.slice(0, 7)]; if (m) m.trip += x.sar || 0; }
  // km per month from the odometer log (straight line between readings)
  const log = (car.odoLog || []).slice().sort((a, b) => a.date.localeCompare(b.date));
  for (let i = 1; i < log.length; i++) {
    const a = log[i - 1], b = log[i], da = fromKey(a.date), db = fromKey(b.date), days = Math.max(1, Math.round((db - da) / 864e5)), per = (b.km - a.km) / days;
    for (let d = new Date(da); d < db; d.setDate(d.getDate() + 1)) { const m = at[ym(d)]; if (m) m.km += per; }
  }
  for (const m of out) { m.km = Math.round(m.km); m.fuel = Math.round(m.fuel); m.care = Math.round(m.care); m.trip = Math.round(m.trip); m.litres = Math.round(m.litres); m.total = m.fuel + m.care + m.trip; }
  return out;
}
/**
 * What a km really costs: fuel (measured), plus servicing over the last 12 months, plus the insurance premium and the tyres
 * spread over a year of your km. → { perKm, parts: [{ label, perKm }], kmYear }
 */
export function trueCost(car, now = new Date()) {
  const m = months(car, now, 12), kpd = CC.kmPerDay(car), kmYear = kpd ? Math.round(kpd * 365) : m.reduce((t, x) => t + x.km, 0);   // km a day (last ~6 months) beats a year of months the log doesn't cover yet
  const c = CC.costs(car, now), fuelKm = c.perKm || 0;
  const care = m.reduce((t, x) => t + x.care, 0), ins = +car.ins?.premium || 0;
  const tyre = car.tyre?.cost ? car.tyre.cost / Math.max(1, (car.tyre.warranty || 5)) : 0;
  if (!kmYear) return { perKm: fuelKm, parts: fuelKm ? [{ label: 'Fuel', perKm: fuelKm }] : [], kmYear: 0 };
  const parts = [['Fuel', fuelKm], ['Servicing', care / kmYear], ['Insurance', ins / kmYear], ['Tyres', tyre / kmYear]].filter(([, v]) => v > 0).map(([label, v]) => ({ label, perKm: Math.round(v * 100) / 100 }));
  return { perKm: Math.round(parts.reduce((t, p) => t + p.perKm, 0) * 100) / 100, parts, kmYear };
}
/** This month vs last month and the year so far. */
export function summary(car, now = new Date()) {
  const m = months(car, now, 12), cur = m[m.length - 1], prev = m[m.length - 2];
  const y = String(now.getFullYear()), year = m.filter(x => x.key.startsWith(y)).reduce((t, x) => t + x.total, 0);
  return { month: cur.total, prev: prev?.total || 0, year, kmMonth: cur.km, key: keyOf(now) };
}
