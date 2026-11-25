// The car on paper and on the road: saving a car (identity, papers, insurance, tyres, the planned service, the trip), the
// driver, and what needs you (papers within their window, care items due). Pure (no DOM). Dates are dd/mm/yyyy on screen.
// Autolime only reminds: renewals are done in Absher, at the inspection centre and with the insurer.
import { keyOf, fromKey, addDays, startOfDay, uid } from './util.js';
import * as CC from './carcare.js';
import { cleanX } from './extras.js';

const isKey = (v) => /^\d{4}-\d\d-\d\d$/.test(v || '');
const rec = (o) => Object.values(o || {});
const txt = (v, n = 80) => String(v ?? '').trim().slice(0, n);
const num = (v, lo, hi, d = 0) => { const n = +String(v ?? '').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(',', '.'); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.max(lo, Math.min(hi, n)) : d; };
/** The same day `n` months later (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(key, n) { const d = fromKey(key), day = d.getDate(), x = new Date(d.getFullYear(), d.getMonth() + n, 1); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return keyOf(x); }
export const daysUntil = (key, now = new Date()) => isKey(key) ? Math.round((fromKey(key) - startOfDay(now)) / 864e5) : null;

// ───────────────────────── the car
// Saudi papers: istimara (registration), fahas (periodic inspection, MVPI), and the insurance. Renewals are done in Absher /
// the inspection centres; Autolime only remembers the dates.
export const CAR_PAPERS = [['istimara', 'Istimara (registration)', '📄', 30], ['fahas', 'Fahas (inspection)', '🔧', 30], ['insurance', 'Insurance', '🛡️', 21]];
export function saveCar(s, c, now = new Date()) {
  const name = txt(c.name, 40); if (!name) return s; const id = c.id || 'c' + uid();
  const car = { id, name, icon: txt(c.icon, 8) || '🚗', ...Object.fromEntries(CAR_PAPERS.map(([k]) => [k, isKey(c[k]) ? c[k] : ''])),
    serviceMonths: Math.round(num(c.serviceMonths, 0, 36, 6)), serviceKm: Math.round(num(c.serviceKm, 0, 100000, 10000)), lastService: isKey(c.lastService) ? c.lastService : '', lastServiceKm: Math.round(num(c.lastServiceKm, 0, 2e6, 0)),
    ...cleanIdentity(c), ins: cleanIns(c.ins),
    odo: Math.round(num(c.odo, 0, 2e6, 0)), odoAt: isKey(c.odoAt) ? c.odoAt : c.odo ? keyOf(now) : '', log: (Array.isArray(c.log) ? c.log : []).filter(x => x && isKey(x.date)).slice(-200), ...CC.cleanCare(c), at: Date.now() };
  if (!car.odoLog.length && car.odo && car.odoAt) car.odoLog = [{ date: car.odoAt, km: car.odo }];   // cars from 1.0 keep their reading
  if (car.odoLog.length) { const l = car.odoLog[car.odoLog.length - 1]; car.odo = l.km; car.odoAt = l.date; }
  return { ...s, cars: { ...(s.cars || {}), [id]: car } };
}
/** Who the car is on paper: plate (Arabic letters + digits, and the Latin letters), VIN, year, colour, seats, weight. */
function cleanIdentity(c) {
  const vin = String(c.vin || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const yr = Math.round(num(c.year, 0, 2100, 0));
  return { plate: txt(c.plate, 24), plateLatin: txt(c.plateLatin, 12).toUpperCase(), vin: /^[A-HJ-NPR-Z0-9]{17}$/.test(vin) ? vin : '', year: yr >= 1950 ? yr : 0,
    colour: txt(c.colour, 24), seats: Math.round(num(c.seats, 0, 60, 0)), weight: Math.round(num(c.weight, 0, 50000, 0)), regType: txt(c.regType, 20),
    tyre: cleanTyre(c.tyre), plan: cleanPlan(c.plan), trip: cleanTrip(c.trip), renew: cleanRenew(c.renew), x: cleanX(c.x), trips: (Array.isArray(c.trips) ? c.trips : []).filter(x => x && typeof x === 'object').map(cleanTrip).filter(Boolean).slice(-12) };
}
/** The tyres on the car: brand + model, size (215/60R16 99V), DOT year, warranty, when fitted. */
function cleanTyre(t) {
  if (!t || typeof t !== 'object') return null;
  const o = { brand: txt(t.brand, 40), size: txt(t.size, 24).toUpperCase(), dot: /^\d{4}$/.test(String(t.dot || '')) ? String(t.dot) : '', warranty: Math.round(num(t.warranty, 0, 10, 0)), fitted: isKey(t.fitted) ? t.fitted : '', qty: Math.round(num(t.qty, 0, 6, 0)), cost: num(t.cost, 0, 1e5, 0), where: txt(t.where, 60) };
  return o.brand || o.size || o.fitted ? o : null;
}
/** A service you mean to do (e.g. before a trip): when, which items, a note. Logged items leave it. */
function cleanPlan(p) {
  if (!p || typeof p !== 'object') return null;
  const items = [...new Set((Array.isArray(p.items) ? p.items : []).filter(i => CC.ITEMS[i]))].slice(0, 30);
  const added = (Array.isArray(p.added) ? p.added : []).filter(i => items.includes(i));
  return items.length ? { date: isKey(p.date) ? p.date : '', items, added, note: txt(p.note, 140), shop: txt(p.shop, 30), ...(p.eventId ? { eventId: txt(p.eventId, 200), calendarId: txt(p.calendarId, 200) } : {}) } : null;
}
/** A road trip: when, how far, the legs, the checklist ticked so far, the daily checks on the way, and what it cost. */
function cleanTrip(t) {
  if (!t || typeof t !== 'object') return null;
  const legs = (Array.isArray(t.legs) ? t.legs : []).filter(l => l && typeof l === 'object').map(l => ({ from: txt(l.from, 30), to: txt(l.to, 30), km: Math.round(num(l.km, 0, 5000, 0)), hrs: Math.round(num(l.hrs, 0, 48, 0) * 10) / 10, day: isKey(l.day) ? l.day : '', done: !!l.done })).filter(l => l.from || l.to).slice(0, 20);
  const log = (Array.isArray(t.log) ? t.log : []).filter(x => x && isKey(x.date)).map(x => ({ date: x.date, kind: TRIP_COSTS.some(k => k[0] === x.kind) ? x.kind : 'other', sar: Math.round(num(x.sar, 0, 1e5, 0) * 100) / 100, litres: Math.round(num(x.litres, 0, 200, 0) * 100) / 100, note: txt(x.note, 60), at: +x.at || 0 })).slice(-200);
  const daily = {}; for (const [k, v] of Object.entries(t.daily && typeof t.daily === 'object' ? t.daily : {})) if (isKey(k) && Array.isArray(v)) daily[k] = v.map(x => txt(x, 20)).filter(x => DAILY_CHECKS.some(d => d[0] === x));
  const o = { date: isKey(t.date) ? t.date : '', end: isKey(t.end) ? t.end : '', km: Math.round(num(t.km, 0, 20000, 0)), price: num(t.price, 0, 20, 0), name: txt(t.name, 60), checks: (Array.isArray(t.checks) ? t.checks : []).map(x => txt(x, 20)).filter(Boolean).slice(0, 40), legs, log, daily, ...(t.closed ? { closed: true } : {}) };
  return o.date || o.km || o.name || legs.length ? o : null;
}
/** Renewal checklists: ticks per paper and per expiry date ("fahas:2027-04-15" → ["book", …]), so they start fresh after a renewal. */
function cleanRenew(r) {
  const o = {}; if (!r || typeof r !== 'object') return o;
  for (const [k, v] of Object.entries(r)) if (/^(istimara|fahas|insurance|licence):\d{4}-\d\d-\d\d$/.test(k) && Array.isArray(v)) o[k] = v.map(x => txt(x, 20)).filter(Boolean).slice(0, 20);
  return o;
}
export const TRIP_COSTS = [['fuel', 'Fuel', '⛽'], ['food', 'Food', '🍽️'], ['hotel', 'Stay', '🛏️'], ['toll', 'Parking / tolls', '🅿️'], ['car', 'Car (repair, wash)', '🔧'], ['other', 'Other', '🧾']];
/** The quick check each morning on a trip (engine cold, before the first leg). */
export const DAILY_CHECKS = [['tyres', 'Tyres: pressure cold, look for bulges and nails', 'ضغط الكفرات'], ['coolant', 'Coolant between LOW and FULL', 'موية الرديتر'], ['oil', 'Oil on the dipstick', 'الزيت'], ['leaks', 'Nothing dripping under the car', 'تسريب تحت السيارة'], ['water', 'Drinking water in the car', 'ماء للشرب']];
/** Trip money so far: by kind, and fuel litres. */
export function tripSpend(t) {
  const by = {}; let total = 0, litres = 0;
  for (const x of t?.log || []) { by[x.kind] = (by[x.kind] || 0) + x.sar; total += x.sar; litres += x.litres || 0; }
  return { by, total: Math.round(total), litres: Math.round(litres) };
}
/** The legs add up to the trip's distance and driving time. */
export const legsTotal = (t) => (t?.legs || []).reduce((a, l) => ({ km: a.km + l.km, hrs: Math.round((a.hrs + l.hrs) * 10) / 10 }), { km: 0, hrs: 0 });
/** A road trip's fuel: litres and SAR from your measured L/100 km (or a typical figure) and the price you last paid. */
export function tripFuel(c, km, price) {
  const eco = CC.economy(c), l100 = eco.length ? eco.reduce((a, e) => a + e.l100, 0) / eco.length : 0, last = (c.fuel || []).filter(f => f.cost && f.litres).slice(-1)[0];
  const use = l100 || (c.model === 'camry-2016' ? 7.5 : 9), p = price || (last ? last.cost / last.litres : 0);
  const litres = km * use / 100;
  return { l100: Math.round(use * 10) / 10, measured: !!l100, litres: Math.round(litres), price: p ? Math.round(p * 100) / 100 : 0, sar: p ? Math.round(litres * p) : 0, tanks: Math.round(litres / 60 * 10) / 10 };
}
/** What falls due before the trip ends: by the trip's date, or within its km. */
export function dueByTrip(c, trip, now = new Date()) {
  if (!trip) return [];
  return CC.plan(c, now).filter(st => !st.def.days && st.state !== 'unknown' && (st.state === 'late' || (trip.km && st.kmLeft != null && st.kmLeft <= trip.km) || (trip.date && st.date && st.date <= trip.date)));
}
/** Logging a service takes its items off the plan; an empty plan is gone. */
export function afterVisit(c, items) { if (!c.plan) return c; const left = c.plan.items.filter(i => !items.includes(i)); return { ...c, plan: left.length ? { ...c.plan, items: left, added: (c.plan.added || []).filter(i => left.includes(i)) } : null }; }
export const TRIP_CHECKS = [
  ['oil', 'Oil level on the dipstick', 'مستوى الزيت'], ['coolant', 'Coolant between MIN and MAX (engine cold)', 'مستوى موية الرديتر'], ['tyres', 'Tyre pressure, cold — spare too', 'ضغط الكفرات والاحتياطي'],
  ['spare', 'Spare wheel, jack and wheel brace in the boot', 'الاستبنة والعفريتة والمفتاح'], ['lights', 'All lights, indicators and brake lights', 'الأنوار والإشارات'], ['wipers', 'Wipers and washer fluid', 'المساحات وماء الغسيل'],
  ['ac', 'AC blowing cold', 'المكيف'], ['triangle', 'Warning triangle and fire extinguisher', 'المثلث والطفاية'], ['kit', 'First-aid kit', 'شنطة الإسعافات'], ['water', 'Drinking water (several litres) + 1 L coolant', 'ماء للشرب وموية رديتر'],
  ['papers', 'Istimara, licence, insurance valid for the whole trip', 'الاستمارة والرخصة والتأمين'], ['charger', 'Phone charger and offline maps', 'شاحن الجوال والخرائط'],
];
/** The insurance policy, as far as it is known (from its PDF, pasted text or typed). The expiry stays in c.insurance. */
export function cleanIns(i) {
  if (!i || typeof i !== 'object') return null;
  const o = { company: txt(i.company, 40), policy: txt(i.policy, 48), kind: ['third', 'comp'].includes(i.kind) ? i.kind : '', repair: txt(i.repair, 40),
    deductible: i.deductible === '' || i.deductible == null ? null : num(i.deductible, 0, 1e6, 0), premium: i.premium === '' || i.premium == null ? null : num(i.premium, 0, 1e6, 0),
    phone: txt(i.phone, 20), start: isKey(i.start) ? i.start : '', limit: txt(i.limit, 80), perks: (Array.isArray(i.perks) ? i.perks : []).map(p => txt(p, 60)).filter(Boolean).slice(0, 10) };
  return Object.values(o).some(v => v !== '' && v !== null && !(Array.isArray(v) && !v.length)) ? o : null;
}
export const INS_KIND = { third: 'Third party', comp: 'Comprehensive' };

// ───────────────────────── you, the driver (settings.driver: one value, merged by its edit time like every setting)
export const LICENCE_WARN = 60;
export function cleanDriver(d) {
  d = d && typeof d === 'object' ? d : {};
  return { licence: isKey(d.licence) ? d.licence : '', issued: isKey(d.issued) ? d.issued : '', type: txt(d.type, 20), blood: ['', 'O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].includes(d.blood) ? d.blood : '', ice: txt(d.ice, 40) };
}
export const driverOf = (s) => cleanDriver(s.settings?.driver);
export const setDriver = (s, d) => ({ ...s, settings: { ...(s.settings || {}), driver: cleanDriver({ ...driverOf(s), ...d }) } });
/** Years and days a licence has been held: experience matters for insurance prices. */
export function heldFor(issued, now = new Date()) { if (!issued) return null; const d = -daysUntil(issued, now); return d >= 0 ? { years: Math.floor(d / 365.25), days: d } : null; }

/** Car + policy fields from a parsed policy, onto a car (or a new one). Only fields that were found replace what is there. */
export function fromPolicy(c, p) {
  const ins = { ...(c.ins || {}) };
  for (const k of ['company', 'policy', 'kind', 'repair', 'deductible', 'premium', 'phone', 'start', 'limit', 'perks']) if (p[k] !== undefined && p[k] !== '') ins[k] = p[k];
  const out = { ...c, ins };
  if (p.end) out.insurance = p.end;
  for (const k of ['vin', 'plate', 'year']) if (p[k] && !c[k]) out[k] = p[k];
  return out;
}

export const updateCar = (s, id, patch) => s.cars?.[id] ? saveCar(s, { ...s.cars[id], ...patch, id }) : s;
export function deleteCar(s, id) { const cars = { ...(s.cars || {}) }; delete cars[id]; return { ...s, cars, deleted: { ...(s.deleted || {}), [`car:${id}`]: Date.now() } }; }
export const carList = (s) => rec(s.cars).sort((a, b) => a.name.localeCompare(b.name));
/** A service: logged with the reading, and it resets the clock. */
export const serviced = (s, id, { date, km = 0, note = '' }) => { const c = s.cars?.[id]; if (!c) return s; const k = Math.round(num(km, 0, 2e6, 0)); return updateCar(s, id, { lastService: date, lastServiceKm: k || c.lastServiceKm, odo: Math.max(c.odo || 0, k), odoAt: k > (c.odo || 0) ? date : c.odoAt, log: [...(c.log || []), { date, km: k, note: txt(note, 80), what: 'service' }] }); };
/** When the next service is due: by date, by km (from your km per day so far), whichever comes first. */
export function serviceDue(c, now = new Date()) {
  const byDate = c.lastService && c.serviceMonths ? addMonths(c.lastService, c.serviceMonths) : '';
  let byKm = '', kmLeft = null;
  if (c.serviceKm && c.lastServiceKm && c.odo) {
    kmLeft = c.lastServiceKm + c.serviceKm - c.odo;
    const days = c.lastService && c.odoAt ? Math.max(1, daysUntil(c.odoAt, fromKey(c.lastService))) : 0, perDay = days ? (c.odo - c.lastServiceKm) / days : 0;
    if (perDay > 1) byKm = keyOf(addDays(c.odoAt ? fromKey(c.odoAt) : now, Math.round(kmLeft / perDay)));
  }
  const due = [byDate, byKm].filter(Boolean).sort()[0] || '';
  return { due, byDate, byKm, kmLeft, days: due ? daysUntil(due, now) : null };
}
/** Everything about the cars that needs you within its warning window (papers 3–4 weeks ahead, the service 2 weeks). */
export function carAlerts(s, now = new Date()) {
  const out = [];
  for (const c of carList(s)) {
    for (const [k, label, icon, warn] of CAR_PAPERS) { const d = daysUntil(c[k], now); if (d !== null && d <= warn) out.push({ car: c, kind: k, label, icon, date: c[k], days: d }); }
    if (c.model) { for (const st of CC.careAlerts(c, now)) if (!CC.ITEMS[st.id].days) out.push({ car: c, kind: st.id, label: CC.ITEMS[st.id].label, icon: CC.ITEMS[st.id].icon, date: st.date || keyOf(now), days: st.days ?? 0, kmLeft: st.kmLeft, care: true }); continue; }
    const sv = serviceDue(c, now); if (sv.due && sv.days <= 14) out.push({ car: c, kind: 'service', label: 'Service', icon: '🛠️', date: sv.due, days: sv.days, kmLeft: sv.kmLeft });
  }
  const dr = driverOf(s), dl = daysUntil(dr.licence, now);
  if (dl !== null && dl <= LICENCE_WARN) out.push({ car: { id: 'me', name: 'You' }, driver: true, kind: 'licence', label: 'Driving licence', icon: '🪪', date: dr.licence, days: dl });
  return out.sort((a, b) => a.days - b.days);
}
export const alertText = (a) => {
  if (a.driver) return `Driving licence ${a.days < 0 ? `expired ${-a.days} day${a.days === -1 ? '' : 's'} ago` : a.days === 0 ? 'expires today' : `expires in ${a.days} day${a.days === 1 ? '' : 's'}`}`;
  if (a.care && a.kmLeft != null && a.kmLeft < 0) return `${a.car.name}: ${a.label} ${(-a.kmLeft).toLocaleString('en')} km overdue`;
  const when = a.days < 0 ? (a.care ? `overdue by ${-a.days} day${a.days === -1 ? '' : 's'}` : `expired ${-a.days} day${a.days === -1 ? '' : 's'} ago`) : a.days === 0 ? 'due today' : `due in ${a.days} day${a.days === 1 ? '' : 's'}`;
  return `${a.car.name}: ${a.label.replace(/ \(.*\)$/, '')} ${when}${a.kmLeft != null && (a.kind === 'service' || a.care) && a.kmLeft < 1500 ? ` (${Math.max(0, a.kmLeft).toLocaleString('en')} km left)` : ''}`;
};
