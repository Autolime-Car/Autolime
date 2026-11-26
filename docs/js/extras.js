// The toolbox: Vehicular stays simple until you switch a tool on. Each tool lives on one tab, shows nothing while it is off,
// and never moves the main things (what is due, the papers, the fuel, the trip). Pure (no DOM): the registry, the data the
// tools keep on a car (car.x), and what they work out. Settings › Toolbox and the "Tools for this tab" link switch them.
import { keyOf, fromKey, startOfDay, uid } from './util.js';
import * as CC from './carcare.js';

// ───────────────────────── the registry
// [id, name, icon, tab, on by default, what it does]
export const TOOLS = [
  ['logbook', 'Logbook', '📒', 'dash', true, 'Your latest services, fill-ups and photos in one list.'],
  ['moneyDash', 'Money on the Dash', '💰', 'dash', true, 'This month, this year and what a km really costs.'],
  ['parked', 'Where I parked', '📍', 'dash', false, 'Save the spot (map pin, level, pillar, a photo) and find the car again.'],
  ['smart', 'Smarter warnings', '🧠', 'dash', false, 'Fuel use jumping, the same repair twice in 3 months, a weak battery, low tyre pressure.'],
  ['tyrelog', 'Tyre tread and pressure', '🛞', 'service', false, 'Note tread depth and cold pressures; see when the tread reaches the 1.6 mm limit.'],
  ['battery', 'Battery checks', '🔋', 'service', false, 'Note the resting voltage; a falling trend warns you before summer.'],
  ['warranty', 'Part warranties', '🛡️', 'service', false, 'Give any part in a service a warranty; see what is still covered.'],
  ['receipt', 'Read the receipt', '🧾', 'service', false, 'In the service sheet, a photo of the receipt fills in parts and prices for you to check.'],
  ['stations', 'Fuel stations', '⛽', 'fuel', false, 'Name the station at each fill-up; see where you fill and the price a litre over time.'],
  ['commute', 'Work commute', '🏥', 'fuel', false, 'Your km to work on shift days (from Mandarin): km and fuel for the next 30 days.'],
  ['insquotes', 'Insurance quotes', '📑', 'papers', false, 'Put renewal quotes side by side against what you pay now.'],
  ['fines', 'Traffic fines', '🚦', 'papers', false, 'A monthly nudge to check Absher, and fines paid counted in your car money.'],
  ['papercal', 'Papers in my calendar', '🗓', 'papers', false, 'Istimara, fahas, insurance and licence expiry as all-day events in Google Calendar.'],
  ['sell', 'Sell-ready file', '🏷️', 'papers', false, 'A printable service history and a log of what the car is worth.'],
  ['map', 'Trip map', '🗺️', 'trip', false, 'A drawn map of your legs and fuel stops that works offline.'],
  ['stock', 'Spares at home', '📦', 'garage', false, 'Oil, filters and fluids you keep; a service uses them and low ones go to your shopping list.'],
  ['codes', 'Engine codes', '🟠', 'garage', true, 'Engine-light codes and dashboard lights in plain words, offline.'],
  ['noises', 'Noises', '👂', 'garage', true, 'What is that sound? A few questions, the likely causes, the Arabic for the workshop.'],
  ['anatomy', 'Anatomy', '🔍', 'garage', true, 'Every part on a drawing, with the Arabic name, and a find-it game.'],
  ['share', 'Tell my other apps', '🔗', 'apps', true, 'Shopping needs, the trip and car money to Citrus, Calamansi, Zest, Bergamot and Sudachi. Never the plate, VIN or names.'],
];
export const TOOL = Object.fromEntries(TOOLS.map(t => [t[0], { id: t[0], name: t[1], icon: t[2], tab: t[3], def: t[4], what: t[5] }]));
export const TAB_NAME = { dash: 'Dash', service: 'Service', fuel: 'Fuel', papers: 'Papers', trip: 'Trip', garage: 'Garage', apps: 'Other apps' };
/** Presets: Simple (the essentials only), Recommended (the defaults), Everything. */
export const PRESETS = [['simple', 'Simple', 'Only the essentials'], ['recommended', 'Recommended', 'A few helpers'], ['all', 'Everything', 'Every tool on']];
export function presetMap(p) { return Object.fromEntries(TOOLS.map(([id, , , , def]) => [id, p === 'all' ? true : p === 'simple' ? id === 'share' : def])); }
/** Which preset the switches match now ('' when mixed). */
export function presetOf(on) { return PRESETS.map(p => p[0]).find(p => TOOLS.every(([id]) => presetMap(p)[id] === !!on[id])) || ''; }
/** On/off for every tool from the stored overrides ({ id: bool }); unknown ids are dropped. */
export function toolsOn(over) { const o = over && typeof over === 'object' ? over : {}; return Object.fromEntries(TOOLS.map(([id, , , , def]) => [id, typeof o[id] === 'boolean' ? o[id] : def])); }
export const toolsFor = (tab) => TOOLS.filter(t => t[3] === tab).map(t => TOOL[t[0]]);

// ───────────────────────── the data the tools keep (car.x), cleaned like every car field
const isKey = (v) => /^\d{4}-\d\d-\d\d$/.test(v || '');
const txt = (v, n = 80) => String(v ?? '').trim().slice(0, n);
const num = (v, lo, hi, d = 0) => { const n = +String(v ?? '').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(',', '.'); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.max(lo, Math.min(hi, n)) : d; };
const arr = (v) => Array.isArray(v) ? v.filter(x => x && typeof x === 'object') : [];
const r1 = (n) => Math.round(n * 10) / 10, r2 = (n) => Math.round(n * 100) / 100;
const WHEELS = ['FL', 'FR', 'RL', 'RR'];
export const WHEEL_NAME = { FL: 'front left', FR: 'front right', RL: 'rear left', RR: 'rear right' };
const wheels = (v, lo, hi) => { const o = {}; for (const w of WHEELS) { const n = num(v?.[w], lo, hi, 0); if (n) o[w] = r1(n); } return o; };
export function cleanX(x) {
  x = x && typeof x === 'object' ? x : {};
  const byDate = (a, b) => a.date.localeCompare(b.date);
  const o = {
    tyreLog: arr(x.tyreLog).filter(r => isKey(r.date)).map(r => ({ date: r.date, tread: wheels(r.tread, 0, 12), psi: wheels(r.psi, 0, 80) })).filter(r => Object.keys(r.tread).length || Object.keys(r.psi).length).sort(byDate).slice(-60),
    battery: arr(x.battery).filter(r => isKey(r.date) && +r.v > 0).map(r => ({ date: r.date, v: r2(num(r.v, 5, 16, 0)), note: txt(r.note, 60) })).sort(byDate).slice(-60),
    stock: arr(x.stock).filter(r => txt(r.name)).map(r => ({ id: txt(r.id, 20) || 's' + uid(), name: txt(r.name, 40), qty: r1(num(r.qty, 0, 999, 0)), per: r1(num(r.per, 0, 99, 1)) || 1, unit: txt(r.unit, 10), item: CC.ITEMS[r.item] ? r.item : '' })).slice(0, 40),
    insQuotes: arr(x.insQuotes).filter(r => txt(r.company)).map(r => ({ id: txt(r.id, 20) || 'q' + uid(), date: isKey(r.date) ? r.date : '', company: txt(r.company, 40), premium: Math.round(num(r.premium, 0, 1e5, 0)), kind: ['third', 'comp'].includes(r.kind) ? r.kind : '', excess: Math.round(num(r.excess, 0, 1e5, 0)), towing: !!r.towing, agency: !!r.agency, note: txt(r.note, 80) })).slice(-20),
    fines: arr(x.fines).filter(r => isKey(r.date)).map(r => ({ date: r.date, sar: Math.round(num(r.sar, 0, 1e5, 0)), what: txt(r.what, 60), at: +r.at || 0 })).sort(byDate).slice(-100),
    finesChecked: isKey(x.finesChecked) ? x.finesChecked : '',
    parked: x.parked && typeof x.parked === 'object' && (+x.parked.at > 0) ? { at: +x.parked.at, lat: Number.isFinite(+x.parked.lat) && x.parked.lat !== null && x.parked.lat !== '' ? +x.parked.lat : null, lon: Number.isFinite(+x.parked.lon) && x.parked.lon !== null && x.parked.lon !== '' ? +x.parked.lon : null, note: txt(x.parked.note, 80), photo: txt(x.parked.photo, 40) } : null,
    values: arr(x.values).filter(r => isKey(r.date) && +r.sar > 0).map(r => ({ date: r.date, sar: Math.round(num(r.sar, 0, 1e7, 0)), src: txt(r.src, 40) })).sort(byDate).slice(-40),
  };
  for (const k of Object.keys(o)) if ((Array.isArray(o[k]) && !o[k].length) || o[k] === '' || o[k] === null) delete o[k];
  return o;
}
/** A change to car.x (the caller saves the car). */
export const withX = (c, patch) => ({ ...c, x: { ...(c.x || {}), ...patch } });

// ───────────────────────── tyres
export const TREAD_LEGAL = 1.6, TREAD_NEW = 8;
/** Recommended cold pressure (psi): the door-pillar sticker of a 2016 Camry says 35; others ask the sticker. */
export const psiFor = (c) => c.model === 'camry-2016' ? 35 : 0;
/** The lowest tread at each reading, and when it will reach the legal 1.6 mm at the rate seen so far. */
export function treadForecast(c, now = new Date()) {
  const pts = (c.x?.tyreLog || []).map(r => ({ date: r.date, mm: Math.min(...Object.values(r.tread || {})) })).filter(p => Number.isFinite(p.mm));
  if (!pts.length) return null;
  const last = pts[pts.length - 1], out = { mm: last.mm, date: last.date, state: last.mm <= 2 ? 'late' : last.mm <= 3 ? 'soon' : 'ok', points: pts };
  const first = pts[0], days = (fromKey(last.date) - fromKey(first.date)) / 864e5;
  if (pts.length >= 2 && days >= 14 && first.mm > last.mm) {
    const perDay = (first.mm - last.mm) / days, left = Math.max(0, (last.mm - TREAD_LEGAL) / perDay);
    const at = new Date(fromKey(last.date)); at.setDate(at.getDate() + Math.round(left));
    out.legal = keyOf(at); out.perMonth = r2(perDay * 30.4); out.daysLeft = Math.round((at - startOfDay(now)) / 864e5);
  }
  return out;
}
/** Pressure readings that need air: more than 3 psi under the sticker, or 3 psi apart on one axle. */
export function pressureIssues(c) {
  const r = [...(c.x?.tyreLog || [])].reverse().find(x => Object.keys(x.psi || {}).length); if (!r) return [];
  const rec = psiFor(c), out = [];
  for (const w of WHEELS) if (rec && r.psi[w] && r.psi[w] < rec - 3) out.push(`${WHEEL_NAME[w]} ${r.psi[w]} psi (should be ${rec})`);
  for (const [a, b] of [['FL', 'FR'], ['RL', 'RR']]) if (r.psi[a] && r.psi[b] && Math.abs(r.psi[a] - r.psi[b]) > 3) out.push(`${WHEEL_NAME[a]} and ${WHEEL_NAME[b]} differ by ${r1(Math.abs(r.psi[a] - r.psi[b]))} psi`);
  return out;
}

// ───────────────────────── battery
/** Resting voltage (engine off a few hours): 12.6+ good, 12.4–12.6 fair, under 12.4 weak. A drop of 0.2 V over the last three readings warns early. */
export function batteryState(c) {
  const b = c.x?.battery || []; if (!b.length) return null;
  const last = b[b.length - 1], v = last.v, state = v >= 12.6 ? 'good' : v >= 12.4 ? 'fair' : 'weak';
  const prev = b.slice(-3)[0], falling = b.length >= 3 && prev.v - v >= 0.2;
  return { v, date: last.date, state, falling, word: state === 'good' ? 'Good' : state === 'fair' ? 'Getting tired' : 'Weak — test it at a battery shop', tone: state === 'good' && !falling ? 'good' : state === 'weak' ? 'late' : 'soon' };
}

// ───────────────────────── warranties (a warranty in months on a service line: line.wm)
function addMonths(key, n) { const d = fromKey(key), day = d.getDate(), x = new Date(d.getFullYear(), d.getMonth() + n, 1); x.setDate(Math.min(day, new Date(x.getFullYear(), x.getMonth() + 1, 0).getDate())); return keyOf(x); }
/** Parts still under warranty (newest end first), and the ones that ended in the last 3 months. */
export function warranties(c, now = new Date()) {
  const t = keyOf(now), out = [];
  for (const v of c.log || []) for (const l of v.lines || []) if (l.wm > 0) { const until = addMonths(v.date, l.wm); out.push({ item: l.item, part: l.part, date: v.date, until, months: l.wm, shop: v.shop || '', place: v.place || '', active: until >= t, days: Math.round((fromKey(until) - startOfDay(now)) / 864e5) }); }
  return out.filter(w => w.active || w.days > -92).sort((a, b) => b.until.localeCompare(a.until));
}
/** The warranty that covers an item now, if any. */
export const coveredNow = (c, item, now = new Date()) => warranties(c, now).find(w => w.item === item && w.active) || null;

// ───────────────────────── reading a receipt (the OCR text in, lines out — the owner checks them before saving)
const KEYWORDS = {
  oil: ['oil', 'زيت', 'motor oil', 'engine oil', '5w', '0w', 'oil filter', 'فلتر زيت', 'فلتر الزيت'], airFilter: ['air filter', 'فلتر هواء', 'فلتر الهواء'],
  cabinFilter: ['cabin', 'ac filter', 'فلتر مكيف', 'فلتر المكيف'], brakes: ['pad', 'brake', 'فحمات', 'فحمة', 'فرامل'], rotors: ['disc', 'rotor', 'هوبات', 'ديسك'], brakeFluid: ['brake fluid', 'زيت فرامل'],
  batteryNew: ['battery', 'بطارية'], coolant: ['coolant', 'antifreeze', 'موية رديتر', 'ماء رديتر'], plugs: ['spark', 'plug', 'بواجي', 'بوجي'], wipers: ['wiper', 'مساحات', 'مساحة'],
  rotate: ['rotation', 'تدوير'], balancing: ['balanc', 'ترصيص', 'وزن كفرات'], alignment: ['alignment', 'ميزان', 'وزن اذرعة'], atf: ['atf', 'transmission', 'زيت قير', 'زيت القير'], belt: ['belt', 'سير'],
  shocks: ['shock', 'مساعد', 'مساعدات'], tyres: ['tyre', 'tire', 'كفر', 'كفرات'], ac: ['freon', 'فريون', 'a/c gas'],
};
const TOTAL_WORDS = /\b(total|grand total|net|amount due)\b|الإجمالي|الاجمالي|المجموع|الصافي/i, SKIP_WORDS = /vat|tax|ضريبة|discount|خصم|change|cash|card|مدى|visa/i;
/** Lines of a receipt → [{ item, price, part, text }] for the items it names, and the total if printed. Labour and parts on two lines add up. */
export function parseReceipt(text) {
  const lines = String(text || '').replace(/[٠-٩]/g, (ch) => String(ch.charCodeAt(0) - 0x660)).replace(/٫/g, '.').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const found = {}, ids = Object.keys(KEYWORDS).filter(id => CC.ITEMS[id]); let total = 0;
  const priceOf = (l) => { const m = [...l.matchAll(/(\d{1,5}(?:[.,]\d{1,2})?)(?!\s*(?:w|l|lt|ml|km|%|x)\b)/gi)].map(x => +x[1].replace(',', '.')).filter(n => n > 0 && n < 20000); return m.length ? m[m.length - 1] : 0; };
  for (const l of lines) {
    const low = l.toLowerCase(), p = priceOf(l);
    if (TOTAL_WORDS.test(low)) { if (p) total = Math.max(total, p); continue; }
    if (SKIP_WORDS.test(low)) continue;
    // the longest keyword wins ("oil filter" over "oil")
    let best = null, len = 0; for (const id of ids) for (const k of KEYWORDS[id]) if (low.includes(k) && k.length > len) { best = id; len = k.length; }
    if (!best) continue;
    const f = found[best] ||= { item: best, price: 0, part: '', text: [] }; f.price = r2(f.price + p); f.text.push(l);
    if (!f.part) f.part = l.replace(/(\d{1,5}(?:[.,]\d{1,2})?)\s*(sar|ر\.?س|ريال)?\s*$/i, '').replace(/\s{2,}/g, ' ').trim().slice(0, 60);
  }
  return { lines: Object.values(found).map(f => ({ ...f, text: f.text.join(' · ') })), total };
}

// ───────────────────────── fuel stations (fuel entries carry `station`)
/** Where you fill up: visits, litres, SAR a litre on average and last time. Saudi pump prices are set nationally, so this is about habit and service, not hunting. */
export function stations(c) {
  const by = {};
  for (const f of c.fuel || []) { if (!f.station) continue; const s = by[f.station] ||= { name: f.station, visits: 0, litres: 0, sar: 0, last: '' }; s.visits++; s.litres += f.litres; s.sar += f.cost || 0; if (f.date > s.last) s.last = f.date; }
  return Object.values(by).map(s => ({ ...s, litres: Math.round(s.litres), sar: Math.round(s.sar), perL: s.litres && s.sar ? r2(s.sar / s.litres) : 0 })).sort((a, b) => b.visits - a.visits || b.last.localeCompare(a.last));
}
/** SAR a litre over time (one point per fill-up with a price): shows when the national price changed. */
export const pricePerLitre = (c) => (c.fuel || []).filter(f => f.cost && f.litres).map(f => ({ date: f.date, perL: r2(f.cost / f.litres) }));

// ───────────────────────── the commute (settings.custom.car.commute = km one way)
/** Km and fuel for the shifts in the next 30 days. `workDays(from, to)` comes from Mandarin's rota (list of day keys). */
export function commute(c, kmOneWay, workDays, now = new Date(), l100 = 0, perL = 0) {
  if (!kmOneWay) return null;
  const to = new Date(now); to.setDate(to.getDate() + 30); const days = workDays(startOfDay(now), to) || [];
  const km = Math.round(days.length * kmOneWay * 2), litres = l100 ? km * l100 / 100 : 0;
  return { shifts: days.length, km, litres: Math.round(litres), sar: perL ? Math.round(litres * perL) : 0, perDay: Math.round(km / 30) };
}

// ───────────────────────── insurance quotes
export function compareQuotes(c) {
  const now = +c.ins?.premium || 0, list = [...(c.x?.insQuotes || [])].filter(q => q.premium).sort((a, b) => a.premium - b.premium);
  return list.map((q, i) => ({ ...q, cheapest: i === 0, vsNow: now ? q.premium - now : null }));
}

// ───────────────────────── traffic fines
/** A check in Absher is due once a month. */
export function finesDue(c, now = new Date()) { const last = c.x?.finesChecked; if (!last) return true; return (startOfDay(now) - fromKey(last)) / 864e5 >= 30; }
export const finesTotal = (c, year) => (c.x?.fines || []).filter(f => !year || f.date.startsWith(String(year))).reduce((t, f) => t + f.sar, 0);

// ───────────────────────── spares at home
/** A service uses one `per` of each spare linked to a done item. → the car with less stock. */
export function useStock(c, items) {
  const st = c.x?.stock; if (!st?.length) return c;
  return withX(c, { stock: st.map(s => s.item && items.includes(s.item) ? { ...s, qty: Math.max(0, r1(s.qty - s.per)) } : s) });
}
/** Spares with less than one service's worth left. */
export const lowStock = (c) => (c.x?.stock || []).filter(s => s.qty < s.per);

// ───────────────────────── worth a look (smarter warnings)
/** Things the numbers say, each with what to do: fuel use up after a service, a repeat repair, the battery, the tyres. */
export function smartWarnings(c, now = new Date()) {
  const out = [];
  const eco = CC.economy(c);
  if (eco.length >= 4) {
    const recent = eco.slice(-2), before = eco.slice(-6, -2), avg = (l) => l.reduce((t, e) => t + e.l100, 0) / l.length;
    if (before.length >= 2) { const a = avg(recent), b = avg(before), up = (a - b) / b; if (up >= 0.15) out.push({ id: 'fuel', icon: '⛽', tone: 'soon', title: `Fuel use up ${Math.round(up * 100)} %`, text: `${r1(a)} L/100 km on the last tanks against ${r1(b)} before. Check the tyre pressures first, then the air filter and dragging brakes.` }); }
  }
  const visits = (c.log || []).filter(v => v.items?.length).sort((a, b) => a.date.localeCompare(b.date)), seen = {};
  for (const v of visits) for (const i of v.items) {
    const def = CC.ITEMS[i]; if (!def || def.days || ['oil', 'rotate', 'balancing', 'alignment', 'wash', 'tyrePressure'].includes(i)) { seen[i] = v.date; continue; }
    if (seen[i] && (fromKey(v.date) - fromKey(seen[i])) / 864e5 <= 92 && (startOfDay(now) - fromKey(v.date)) / 864e5 <= 365) out.push({ id: `repeat-${i}`, icon: '🔁', tone: 'soon', item: i, title: `${def.label} done twice in 3 months`, text: `On ${seen[i]} and ${v.date}. Ask the workshop why, and whether the first job is under warranty.` });
    seen[i] = v.date;
  }
  const b = batteryState(c); if (b && (b.state !== 'good' || b.falling)) out.push({ id: 'battery', icon: '🔋', tone: b.tone, title: `Battery ${b.v} V`, text: b.falling ? 'Falling over your last three checks. Have it load-tested before the heat.' : b.word + '.' });
  const p = pressureIssues(c); if (p.length) out.push({ id: 'psi', icon: '🛞', tone: 'soon', title: 'Tyres need air', text: p.join('; ') + '.' });
  const t = treadForecast(c, now); if (t && t.state !== 'ok') out.push({ id: 'tread', icon: '🛞', tone: t.state, title: `Tread ${t.mm} mm`, text: t.mm <= TREAD_LEGAL ? 'At the legal limit: change the tyres.' : 'Plan new tyres soon (legal limit 1.6 mm; under 3 mm they grip badly in rain).' });
  return out;
}

// ───────────────────────── the value of the car
export function valueTrend(c) {
  const v = c.x?.values || []; if (!v.length) return null;
  const last = v[v.length - 1], first = v[0], days = (fromKey(last.date) - fromKey(first.date)) / 864e5;
  return { now: last.sar, date: last.date, perYear: v.length >= 2 && days >= 30 ? Math.round((first.sar - last.sar) / days * 365) : null };
}
/** Everything spent on the car, from the logs: for the sell-ready file. */
export function lifetime(c) {
  const care = (c.log || []).reduce((t, v) => t + (v.cost || 0), 0), fuel = (c.fuel || []).reduce((t, f) => t + (f.cost || 0), 0);
  return { visits: (c.log || []).filter(v => v.items?.length).length, care: Math.round(care), fuel: Math.round(fuel), fines: finesTotal(c), since: [...(c.log || []), ...(c.fuel || [])].map(x => x.date).sort()[0] || '' };
}

// ───────────────────────── papers as calendar events
/** All-day events for the papers that have a date: what the calendar should hold. */
export function paperEvents(c, driverLicence, papers) {
  const ev = [];
  for (const [k, label, icon] of papers) if (isKey(c[k])) ev.push({ title: `${icon} ${c.name}: ${label.replace(/ \(.*\)$/, '')} expires`, date: c[k], key: `paper-${c.id}-${k}` });
  if (isKey(driverLicence)) ev.push({ title: '🪪 Driving licence expires', date: driverLicence, key: 'paper-licence' });
  return ev;
}

// ───────────────────────── the trip map (rough positions, enough to draw the legs)
export const CITY_POS = {
  kharj: [24.15, 47.31], riyadh: [24.71, 46.68], muzahmiyah: [24.47, 46.26], qiddiyah: [24.58, 46.33], buraidah: [26.33, 43.97], unaizah: [26.08, 43.99], hail: [27.52, 41.69],
  madinah: [24.47, 39.61], makkah: [21.39, 39.86], jeddah: [21.49, 39.19], taif: [21.27, 40.42], dammam: [26.43, 50.1], khobar: [26.28, 50.21], jubail: [27.01, 49.66],
  hofuf: [25.38, 49.59], abha: [18.22, 42.51], tabuk: [28.38, 36.57], alula: [26.61, 37.92],
};
/** Legs as points on a W×H drawing (longitude → x, latitude → y), with the frame fitted to the trip. Unknown cities are skipped. */
export function mapOf(legs, ids, W = 600, H = 400) {
  const id = (name) => ids[name] || ids[String(name).toLowerCase()] || null;
  const pts = []; for (const l of legs) for (const n of [l.from, l.to]) { const k = id(n); if (k && CITY_POS[k] && !pts.some(p => p.id === k)) pts.push({ id: k, name: n, lat: CITY_POS[k][0], lon: CITY_POS[k][1] }); }
  if (pts.length < 2) return null;
  const lo = (f) => Math.min(...pts.map(f)), hi = (f) => Math.max(...pts.map(f)), pad = 0.6;
  const x0 = lo(p => p.lon) - pad, x1 = hi(p => p.lon) + pad, y0 = lo(p => p.lat) - pad, y1 = hi(p => p.lat) + pad;
  const sc = Math.min(W / (x1 - x0), H / (y1 - y0)), ox = (W - (x1 - x0) * sc) / 2, oy = (H - (y1 - y0) * sc) / 2;
  const at = (lat, lon) => [Math.round(ox + (lon - x0) * sc), Math.round(oy + (y1 - lat) * sc)];
  for (const p of pts) [p.x, p.y] = at(p.lat, p.lon);
  const segs = legs.map(l => { const a = pts.find(p => p.id === id(l.from)), b = pts.find(p => p.id === id(l.to)); return a && b ? { a, b, km: l.km, done: !!l.done } : null; }).filter(Boolean);
  return { pts, segs, W, H };
}
