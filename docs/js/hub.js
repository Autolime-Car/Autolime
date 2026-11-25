// What Autolime tells the other apps (pure, no DOM): status.json in its own Drive folder (HUB.md contract v2) — the one-line
// summary, the next thing to do, metrics, what is waiting on you, dated tasks for care and papers, the service slot it asks
// Citrus for (on a day off before the planned service), deep links, and extra { car, plan, trip, papers } for Citrus's tile.
// Never the plate, VIN, policy number or any money beyond your own totals.
import { keyOf, fromKey, addDays, startOfDay } from './util.js';
import * as L from './car.js';
import * as CC from './carcare.js';
import * as R from './roster.js';
import * as M from './money.js';
import * as EX from './extras.js';
import * as CZ from './custom.js';

export const SITE_URL = 'https://autolime-car.github.io/Autolime/';
export const CONTRACT = 2;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

/** Your days off between two dates, from Mandarin's shifts (only days the roster covers; unknown days are left out). */
export function daysOff(from, to) {
  if (!R.has()) return [];
  const out = [], me = R.meKey();
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) { const sh = R.shiftOf(me, d); if (sh && sh.kind !== 'work') out.push(keyOf(d)); }
  return out;
}
/** Days you work between two dates (for "the trip needs leave"). */
export function workDays(from, to) {
  if (!R.has()) return [];
  const out = [], me = R.meKey();
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) { const sh = R.shiftOf(me, d); if (sh?.kind === 'work') out.push({ key: keyOf(d), type: sh.type || '', code: sh.code || '' }); }
  return out;
}
/** The trip's last day: its end date, or the start + 7 days. */
export const tripEnd = (t) => t?.end || (t?.date ? keyOf(addDays(fromKey(t.date), 7)) : '');

/** status.json for Citrus (HUB.md v2). */
export function buildStatus(s, now = new Date()) {
  const t = keyOf(now), cars = L.carList(s), car = cars.find(c => c.model) || cars[0] || null;
  const base = SITE_URL, alerts = L.carAlerts(s, now);
  const actions = [
    { id: 'car', label: 'The car', url: `${base}?do=dash`, icon: '🚗' },
    { id: 'service', label: 'Service', url: `${base}?do=service`, icon: '🔧', minutes: 2 },
    { id: 'papers', label: 'Papers', url: `${base}?do=papers`, icon: '📄', minutes: 2 },
    { id: 'trip', label: 'Road trip', url: `${base}?do=trip`, icon: '🛣️', minutes: 3 },
    { id: 'fuel', label: 'Log fuel', url: `${base}?do=fuel`, icon: '⛽', minutes: 1 },
    { id: 'accident', label: 'Accident card', url: `${base}?do=accident`, icon: '🚨' },
  ];
  const head = { app: 'autolime', title: 'Autolime', icon: '🚗', color: '#b6f23a', url: base, contract: CONTRACT, updatedAt: now.toISOString(), drive: { byTag: true } };
  if (!car) return { ...head, summary: 'No car yet', today: { date: t, done: true }, next: null, asks: [], metrics: [], pending: [], inbox: [], actions, extra: {} };

  const items = car.model ? CC.plan(car, now) : [], hp = CC.health(items), urgent = items.filter(x => x.state === 'late' || x.state === 'soon');
  const papers = L.CAR_PAPERS.map(([k, label]) => ({ kind: k, label: label.replace(/ \(.*\)$/, ''), date: car[k] || '', days: L.daysUntil(car[k], now) })).filter(p => p.date);
  const dr = L.driverOf(s); if (dr.licence) papers.push({ kind: 'licence', label: 'Licence', date: dr.licence, days: L.daysUntil(dr.licence, now) });
  const nextPaper = [...papers].sort((a, b) => a.days - b.days)[0];

  const bits = [];
  const known = items.filter(x => x.state !== 'unknown');
  const first = urgent[0] || known.filter(x => !x.def.days)[0];
  if (first) bits.push(CC.shortDue(first).toLowerCase().replace(/^./, c => c));
  if (nextPaper) bits.push(`${nextPaper.label.toLowerCase()} ${nextPaper.days < 0 ? 'expired' : `in ${nextPaper.days} d`}`);
  if (car.plan?.date && car.plan.date >= t) bits.push(`service ${car.plan.date === t ? 'today' : `in ${L.daysUntil(car.plan.date, now)} d`}`);
  if (!bits.length) bits.push(known.length ? 'car on track' : 'say when things were last done');

  const pending = alerts.slice(0, 8).map(a => L.alertText(a));
  const inbox = [];
  for (const a of alerts.slice(0, 10)) {
    // care items are due by km too, so their date moves a little each day: the id is pinned to when the item was last done
    const id = a.care ? `care-${a.car.id}-${a.kind}-${a.car.care?.[a.kind]?.last || 'x'}` : a.driver ? `licence-${a.date}` : `car-${a.car.id}-${a.kind}-${a.date}`;
    const title = a.care ? `${a.label} for ${a.car.name}${a.kmLeft != null ? (a.kmLeft < 0 ? ` (${(-a.kmLeft).toLocaleString('en')} km over)` : ` (${a.kmLeft.toLocaleString('en')} km left)`) : ''}` : a.driver ? 'Renew your driving licence (Absher)' : a.kind === 'fahas' ? `Book the fahas for ${a.car.name}` : `Renew ${a.label.replace(/ \(.*\)$/, '').toLowerCase()} for ${a.car.name}`;
    inbox.push({ id: id.slice(0, 60), type: 'task', title, date: a.date < t ? t : a.date, minutes: a.care ? 30 : 20, pri: a.days <= 7 ? 1 : 2, url: `${base}?do=${a.care ? 'service' : 'papers'}`, expires: keyOf(addDays(fromKey(a.date < t ? t : a.date), 14)) });
  }
  if (car.plan?.date && car.plan.date >= t) inbox.push({ id: `plan-${car.id}-${car.plan.date}`.slice(0, 60), type: 'task', title: `Service day: ${plural(car.plan.items.length, 'item')} for ${car.name}`, date: car.plan.date, minutes: 180, pri: 1, url: `${base}?do=service`, expires: keyOf(addDays(fromKey(car.plan.date), 3)) });

  // toolbox: the monthly fines check, and a journal note after a trip (Bergamot)
  const tools = CZ.allOn(s);
  if (tools.fines && EX.finesDue(car, now)) inbox.push({ id: `fines-${car.id}-${t.slice(0, 7)}`, type: 'task', title: 'Check Absher for traffic fines', date: t, minutes: 5, pri: 2, url: `${base}?do=papers`, expires: keyOf(addDays(now, 10)) });
  const lastTrip = (car.trips || []).filter(x => x.closed && x.date).slice(-1)[0], lastEnd = lastTrip ? tripEnd(lastTrip) : '';
  if (tools.share && lastTrip && lastEnd <= t && (startOfDay(now) - fromKey(lastEnd)) / 864e5 <= 10) inbox.push({ id: `trip-journal-${car.id}-${lastTrip.date}`.slice(0, 60), type: 'note', title: `Trip journal: ${lastTrip.name || 'road trip'} (${L.legsTotal(lastTrip).km || lastTrip.km || 0} km)`, date: t, url: `${base}?do=trip` });

  // a service slot on a day off before the planned date (or in the next 10 days when something is overdue)
  const asks = [];
  const until = car.plan?.date ? fromKey(car.plan.date) : urgent.some(x => x.state === 'late') ? addDays(now, 10) : null;
  if (until && until >= startOfDay(now)) {
    const off = daysOff(addDays(now, 1), until);
    const day = car.plan?.date && off.includes(car.plan.date) ? car.plan.date : off[0];
    if (day) asks.push({ date: day, title: `Autolime: workshop for ${car.name}`, minutes: 180, slot: 'free' });
  }
  const trip = car.trip && !car.trip.closed ? car.trip : null;
  if (trip?.date && trip.date >= t) { const work = workDays(fromKey(trip.date), fromKey(tripEnd(trip))); if (work.length) pending.push(`Road trip: ${plural(work.length, 'shift')} to take leave for`); }

  const odo = CC.odoNow(car, now), kpd = CC.kmPerDay(car), cost = CC.costs(car, now), month = M.summary(car, now);
  const metrics = [
    { key: 'km-week', label: 'km this week', value: kpd ? Math.round(kpd * 7) : 0, unit: 'km', date: t },
    { key: 'l100', label: 'Fuel use', value: cost.l100 || 0, unit: 'L/100 km', date: t },
    { key: 'sar-month', label: 'On the car this month', value: month.month, unit: 'SAR', date: t },
  ];
  if (hp.pct !== null) metrics.push({ key: 'health', label: 'Car health', value: hp.pct, goal: 100, unit: '%', date: t });
  if (urgent.length) metrics.push({ key: 'due', label: 'Care items due', value: urgent.length, goal: 0, unit: 'items', date: t });

  const next = first ? { title: `🔧 ${CC.shortDue(first)}`, minutes: 30 } : nextPaper && nextPaper.days <= 30 ? { title: `📄 ${nextPaper.label} ${nextPaper.days < 0 ? 'expired' : `in ${nextPaper.days} d`}`, minutes: 20 } : null;
  return {
    ...head,
    summary: bits.slice(0, 3).join(' · ').slice(0, 140),
    today: { date: t, done: !urgent.some(x => x.state === 'late') && !alerts.some(a => a.days < 0) },
    next, asks: asks.slice(0, 3), metrics, pending: pending.slice(0, 10), inbox: inbox.slice(0, 25), actions,
    extra: {
      car: { name: car.name, odo: Math.round(odo.km) || 0, guessed: !!odo.guessed, health: hp.pct, kmPerDay: kpd || 0 },
      plan: car.plan ? { date: car.plan.date, items: car.plan.items.map(i => CC.ITEMS[i]?.label || i) } : null,
      trip: trip ? { name: trip.name, date: trip.date, end: tripEnd(trip), km: trip.km || L.legsTotal(trip).km } : null,
      papers: papers.map(p => ({ kind: p.kind, date: p.date, days: p.days })),
      roster: R.has() ? R.updatedAt() : null,
      ...(tools.share ? shared(car, trip, month, now) : {}),
    },
  };
}

/** What the other apps can use (toolbox "Tell my other apps"): spares to buy (Zest's list, Calamansi's format), the trip's days and
 *  driving hours (Zest snacks, Sudachi's listening queue), and the car's money (any money view). Never the plate, VIN or names. */
function shared(car, trip, month, now) {
  const t = keyOf(now), out = {};
  const low = EX.lowStock(car); if (low.length) out.supplies = { need: low.map(x => ({ name: x.name, level: x.qty <= 0 ? 'out' : 'low', since: t, cat: 'car' })) };
  if (trip) { const lt = L.legsTotal(trip), end = tripEnd(trip); out.tripPlan = { date: trip.date, end, days: trip.date && end ? Math.round((fromKey(end) - fromKey(trip.date)) / 864e5) + 1 : 0, driveHours: lt.hrs || Math.round((trip.km || 0) / 95 * 10) / 10, legs: (trip.legs || []).map(l => ({ from: l.from, to: l.to, km: l.km, hrs: l.hrs, day: l.day })) }; }
  const tc = M.trueCost(car, now);
  out.money = { month: month.month, prevMonth: month.prev, year: month.year, perKm: tc.perKm, currency: 'SAR' };
  return out;
}
