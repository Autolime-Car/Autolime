// Autolime's logic without a browser: care by km or date, health, visits with prices, fuel and money, workshops and quotes,
// OBD codes, noises, trip legs and fuel stops, renewals, photos records, the migration from Calamansi, the status.json for
// Citrus (with days off from Mandarin), backups and the merge of two devices. Made-up data only. Run: node test/autolime.mjs
import * as L from '../docs/js/car.js';
import * as CC from '../docs/js/carcare.js';
import * as PO from '../docs/js/policy.js';
import * as GA from '../docs/js/garage.js';
import * as M from '../docs/js/money.js';
import * as OBD from '../docs/js/obd.js';
import * as NZ from '../docs/js/noises.js';
import * as TR from '../docs/js/trip.js';
import * as PA from '../docs/js/papers.js';
import * as PH from '../docs/js/photos.js';
import * as MIG from '../docs/js/migrate.js';
import * as HUB from '../docs/js/hub.js';
import * as R from '../docs/js/roster.js';
import * as AN from '../docs/js/anatomy.js';
import * as CZ from '../docs/js/custom.js';
import * as EX from '../docs/js/extras.js';
import { mergeStates, sanitize } from '../docs/js/store.js';
import { checkBackup } from '../docs/js/backup-check.js';
import * as CP from '../docs/js/cloudparts.js';
import { POLICY_TEXT } from './policy-sample.mjs';
import { checker } from './helpers-node.mjs';
import { shifts, state, calamansi } from './fixture.mjs';

const { check, bad } = checker();
const now = new Date('2026-11-25T10:00:00+03:00');
const s0 = sanitize(state), car = s0.cars.car1;

console.log('care by km or date');
const items = CC.plan(car, now), by = Object.fromEntries(items.map(x => [x.id, x]));
check(by.oil.state === 'late' && by.oil.kmLeft < 0, `oil is overdue by km (${by.oil.kmLeft} km)`);
check(by.cabinFilter.state === 'ok', 'cabin filter on time');
check(by.plugs.state === 'unknown', 'spark plugs never logged: unknown');
const hp = CC.health(items); check(hp.pct !== null && hp.pct >= 0 && hp.pct <= 100, `health score ${hp.pct}% from ${hp.tracked}/${hp.total} known`);
check(CC.health(items.map(x => ({ ...x, state: 'unknown' }))).pct === null, 'no score while too few parts are known');
check(/^Oil \+ oil filter .* km over$/.test(CC.shortDue(by.oil)), `short line: "${CC.shortDue(by.oil)}"`);
check(CC.odoNow(car, now).guessed && CC.odoNow(car, now).km > 49200, 'odometer moves on between readings');

console.log('a visit with prices; the price log');
const v = CC.logVisit(car, { date: '2026-11-25', km: 49800, items: ['oil', 'brakes'], lines: [{ item: 'oil', price: 190, part: 'Test oil' }, { item: 'brakes', price: 320, part: 'Test pads' }], shop: 'w1', place: 'Test workshop' });
check(v.log.at(-1).cost === 510 && v.log.at(-1).lines.length === 2, 'total from the lines when none was typed');
check(CC.itemState(v, 'oil', now).state === 'ok', 'oil restarts from the visit');
const s1 = L.saveCar(s0, v);
check(GA.lastPaid(s1, 'car1', 'oil').price === 190, 'last paid for oil: 190');
check(GA.priceHistory(s1, 'car1', 'oil').some(p => !p.paid), 'quotes appear in the price history');
check(L.afterVisit({ ...v, plan: car.plan }, ['oil', 'brakes']).plan.items.length === 3, 'logged items leave the plan');

console.log('quotes side by side');
const cmp = GA.compare([s0.quotes.q1, s0.quotes.q2]);
check(cmp.rows.length === 3 && cmp.shared === 2, `3 lines, 2 shared (${cmp.rows.length}/${cmp.shared})`);
check(cmp.totals[0].shared === 530 && cmp.totals[1].shared === 540, 'shared totals add parts and labour');
check(cmp.cheapest === 0, 'the cheaper for the same work is found');
check(cmp.rows.find(r => r.item === 'oil').best === 180, 'cheapest per line');
const s2 = GA.deleteShop(s0, 'w2'); check(!s2.workshops.w2 && s2.deleted['shop:w2'], 'deleting a workshop leaves a tombstone');

console.log('fuel and money');
const eco = CC.economy(car); check(eco.length === 2 && eco[0].l100 > 5 && eco[0].l100 < 12, `L/100 km tank by tank: ${eco.map(e => e.l100).join(', ')}`);
const months = M.months(car, now, 12); check(months.length === 12 && months.at(-1).key === '2026-11', 'twelve months up to this one');
check(months.find(m => m.key === '2026-10').fuel === 212, `October fuel ${months.find(m => m.key === '2026-10').fuel} SAR`);
check(months.find(m => m.key === '2026-10').km > 1000, 'km per month from the odometer log');
const tc = M.trueCost(car, now); check(tc.perKm > 0 && tc.parts.some(p => p.label === 'Insurance') && tc.parts.some(p => p.label === 'Tyres'), `true cost per km ${tc.perKm} with insurance and tyres`);

console.log('engine codes and noises');
check(OBD.normalise('p 0171') === 'P0171' && OBD.normalise('0420') === 'P0420' && OBD.normalise('hello') === '', 'codes are cleaned');
check(OBD.lookup('P0301').level === 'stop' && OBD.lookup('P0301').care.includes('plugs'), 'a misfire: stop, plugs');
check(OBD.lookup('P0999').known === false && /Engine/.test(OBD.lookup('P0999').title), 'an unknown code is still read by its digits');
check(OBD.search('evap').length >= 3, 'search by word');
check(Object.values(OBD.CODES).every(c => c.care.every(id => CC.ITEMS[id])), 'every code links to real care items');
check(NZ.SYMPTOMS.every(sy => Object.values(sy.answers).every(a => a.care.every(id => CC.ITEMS[id]) && OBD.LEVELS[a.level])), 'every noise answer links to real care items and levels');
check(NZ.answer(NZ.symptom('hum'), ['changes']).care.includes('bearings'), 'a hum that changes on bends: bearings');
check(NZ.SYMPTOMS.every(sy => !sy.ask || sy.ask[0].options.every(([id]) => sy.answers[id])), 'every option has an answer');

console.log('trip legs and fuel stops');
const loop = TR.legsOf(TR.ROUTES[0].stops); check(loop.every(l => l.km > 0), 'the ready loop has a km for every leg');
const total = loop.reduce((t, l) => t + l.km, 0); check(total > 2800 && total < 3800, `the loop is about ${total} km`);
const fp = TR.fuelPlan({ km: 870 }, 7.5, 70); check(fp.stops >= 1 && fp.every >= 400, `870 km: ${fp.stops} stop(s) every ${fp.every} km`);
const t2 = { ...car.trip, log: [{ date: '2026-12-15', kind: 'food', sar: 45 }, { date: '2026-12-15', kind: 'fuel', sar: 100, litres: 43 }] };
const sp = L.tripSpend(L.saveCar(s0, { ...car, trip: t2 }).cars.car1.trip); check(sp.total === 145 && sp.litres === 43, 'trip money adds up');
check(L.legsTotal(car.trip).km === 935, 'legs add up');
check(L.saveCar(s0, { ...car, trip: { ...car.trip, daily: { '2026-12-15': ['tyres', 'bogus'] } } }).cars.car1.trip.daily['2026-12-15'].join() === 'tyres', 'daily checks are cleaned');

console.log('renewals');
const open = PA.openRenewals(s0, car, now); check(open.some(r => r.id === 'fahas') && open.some(r => r.id === 'insurance'), `open: ${open.map(r => r.id).join(', ')}`);
const ticked = PA.tick(car, 'fahas', car.fahas, 'book'); check(PA.openRenewals(s0, L.saveCar(s0, ticked).cars.car1, now).find(r => r.id === 'fahas').done === 1, 'a tick is kept through saving');
check(!PA.openRenewals(s0, L.saveCar(s0, { ...ticked, fahas: '2028-01-01' }).cars.car1, now).some(r => r.id === 'fahas'), 'a renewed paper leaves the list');

console.log('photos, anatomy');
const s3 = PH.savePhoto(s0, { kind: 'receipt', car: 'car1', note: 'x' }); const ph = Object.values(s3.photos).find(p => p.kind === 'receipt');
check(ph && !ph.file && PH.photoList(s3, { car: 'car1', kind: 'receipt' }).length === 1, 'a photo record waits for its upload');
check(PH.deletePhoto(s3, ph.id).deleted[`photo:${ph.id}`], 'removing a photo leaves a tombstone');
check(AN.partsFor('oil').length >= 2 && AN.partsFor('atf').length >= 1, 'care items know where they are on the car');

console.log('policy and VIN');
const pol = PO.parsePolicy(POLICY_TEXT); check(pol.kind === 'third' && pol.company && pol.end, `policy read: ${pol.found.join(', ')}`);
check(PO.vinInfo('1M8GDM9AXKP042788').check, 'VIN check digit');

console.log('the migration from Calamansi');
const empty = sanitize({ app: 'autolime' });
const mg = MIG.applyMigration(empty, calamansi);
check(mg.changed && Object.keys(mg.state.cars).length === 1 && mg.state.migrated.from === 'calamansi', `brought over: ${MIG.describe(mg.counts)}`);
check(L.driverOf(mg.state).licence === '2030-04-06', 'the licence comes too');
check(!('recipes' in mg.state), 'nothing of the kitchen comes in');
const again = MIG.applyMigration(mg.state, calamansi); check(Object.keys(again.state.cars).length === 1, 'running it twice makes no twin car');
const newer = MIG.applyMigration(s0, calamansi); check(newer.state.cars.car1.plan?.items?.length === 5, 'a car already here that was edited later keeps its own copy');
check(MIG.looksLikeCalamansi(calamansi) && !MIG.looksLikeCalamansi(state), 'a Calamansi file is told apart');

console.log('status.json for Citrus');
R.set(shifts);
const off = HUB.daysOff(now, new Date('2026-12-05')); check(off.includes('2026-11-27') && !off.includes('2026-11-26'), `days off: ${off.slice(0, 4).join(', ')}…`);
const st = HUB.buildStatus(s0, now);
check(st.app === 'autolime' && st.contract === 2 && st.drive.byTag, 'contract v2, by tag');
check(st.summary.length > 5 && st.summary.length <= 140, `summary: "${st.summary}"`);
check(st.inbox.some(x => x.id.startsWith('care-car1-oil-')) && st.inbox.some(x => x.id.startsWith('plan-car1-')), 'care items and the service day as dated tasks');
check(st.asks.length === 1 && off.includes(st.asks[0].date), `asks for a workshop slot on a day off: ${st.asks[0]?.date}`);
check(st.metrics.some(m => m.key === 'health') && st.metrics.some(m => m.key === 'l100'), 'metrics');
check(st.pending.some(p => /leave/.test(p)), 'the trip needs leave');
const raw = JSON.stringify(st); check(!raw.includes(car.vin) && !raw.includes('4821') && !raw.includes(car.ins.policy), 'no VIN, plate or policy number in status.json');
check(HUB.buildStatus(sanitize({}), now).summary === 'No car yet', 'an empty app still publishes');

console.log('backups and two devices');
const chk = checkBackup(state); check(chk.ok && chk.summary.counts.cars === 1 && chk.summary.counts.workshops === 2, 'a backup is checked and counted');
check(!checkBackup(calamansi).ok, 'a Calamansi backup is not restored as Autolime');
const a = GA.saveShop(s0, { name: 'Phone workshop' }), b = GA.saveQuote(s0, { car: 'car1', shop: 'w1', lines: [{ item: 'oil', price: 1 }] });
const m = mergeStates(a, b); check(Object.keys(m.workshops).length === 3 && Object.keys(m.quotes).length === 3, 'a workshop on one device and a quote on the other both survive');
check(CZ.custom({ settings: { custom: { tabs: { hidden: ['dash', 'trip'] } } } }).tabs.hidden.join() === 'trip', 'Dash can never be hidden');

console.log('the toolbox');
{
  const on0 = CZ.allOn(s0);
  check(on0.logbook && on0.codes && on0.share && !on0.parked && !on0.stock, 'defaults: a few helpers on, new tools off');
  check(EX.presetOf(on0) === 'recommended', 'the defaults are the Recommended preset');
  const simple = CZ.setTools(s0, EX.presetMap('simple'), true), on1 = CZ.allOn(simple);
  check(!on1.logbook && !on1.codes && !on1.anatomy && on1.share && EX.presetOf(on1) === 'simple', 'Simple turns every tool off except sharing');
  const every = CZ.setTools(s0, EX.presetMap('all'), true); check(Object.values(CZ.allOn(every)).every(Boolean) && EX.presetOf(CZ.allOn(every)) === 'all', 'Everything turns every tool on');
  const one = CZ.setTools(simple, { stock: true }); check(CZ.on(one, 'stock') && !CZ.on(one, 'codes') && EX.presetOf(CZ.allOn(one)) === '', 'one switch keeps the others; the preset shows as mixed');
  check(!('bogus' in CZ.custom(CZ.setTools(s0, { bogus: true, parked: 'yes' })).tools) && !('parked' in CZ.custom(CZ.setTools(s0, { parked: 'yes' })).tools), 'unknown tools and non-boolean values are dropped');
  check(EX.TOOLS.every(t => EX.TAB_NAME[t[3]]) && new Set(EX.TOOLS.map(t => t[0])).size === EX.TOOLS.length, 'every tool has a home tab and a unique id');
}
console.log('tool data is kept and cleaned (car.x)');
{
  const c1 = L.saveCar(s0, EX.withX(car, { tyreLog: [{ date: '2026-08-01', tread: { FL: 6.5, FR: 6.4, RL: 7, RR: 7 }, psi: { FL: 35, FR: 34 } }, { date: '2026-11-01', tread: { FL: 5.6, FR: 5.5, RL: 6.6, RR: 6.6 }, psi: { FL: 30, FR: 35, RL: 35, RR: 35 } }, { date: 'bad', tread: { FL: 3 } }], battery: [{ date: '2026-06-01', v: 12.7 }, { date: '2026-09-01', v: 12.55 }, { date: '2026-11-20', v: 12.45, note: 'after a hot week' }], junk: 1, parked: { at: 0 } })).cars.car1;
  check(c1.x.tyreLog.length === 2 && c1.x.battery.length === 3 && !('junk' in c1.x) && !('parked' in c1.x), 'saveCar keeps tool data, drops bad rows and unknown keys');
  const tf = EX.treadForecast(c1, now); check(tf.mm === 5.5 && tf.legal > '2027-06-01' && tf.legal < '2028-06-01' && tf.perMonth > 0.2 && tf.perMonth < 0.4, `tread forecast from the lowest wheel (${tf.legal}, ${tf.perMonth} mm/month)`);
  const pi = EX.pressureIssues(c1); check(pi.length === 2 && pi[0].includes('front left 30'), 'pressure: a wheel 5 psi low and an uneven axle');
  const bs = EX.batteryState(c1); check(bs.state === 'fair' && bs.falling && bs.tone === 'soon', 'battery: 12.45 V is fair, and falling over three checks');
  const sw = EX.smartWarnings(c1, now).map(w => w.id); check(sw.includes('battery') && sw.includes('psi') && !sw.includes('tread'), `smart warnings: ${sw.join(', ')}`);
  const sMerged = mergeStates(L.saveCar(s0, c1), s0); check(sMerged.cars.car1.x?.tyreLog?.length === 2, 'tool data syncs with the car record');
}
{
  // a repeat repair and fuel use creeping up
  let c2 = CC.logVisit(car, { date: '2026-09-01', items: ['brakes'], lines: [{ item: 'brakes', price: 220, wm: 12, part: 'Test pads' }] });
  c2 = CC.logVisit(c2, { date: '2026-10-20', items: ['brakes'], lines: [{ item: 'brakes', price: 200 }] });
  check(c2.log.slice(-2)[0].lines[0].wm === 12 && !('wm' in c2.log.slice(-1)[0].lines[0]), 'a warranty in months is kept on its line');
  check(EX.smartWarnings(c2, now).some(w => w.id === 'repeat-brakes'), 'brakes done twice in 7 weeks is flagged');
  const w = EX.warranties(c2, now); check(w.length === 1 && w[0].until === '2027-09-01' && w[0].active && EX.coveredNow(c2, 'brakes', now), 'warranty until 01/09/2027, covers the pads now');
  check(!EX.coveredNow(c2, 'brakes', new Date('2027-10-01T10:00:00+03:00')), 'and not after it ends');
  let c3 = { ...car, fuel: [] }; const fills = [[0, 50, 100], [700, 50, 105], [1400, 52, 108], [2100, 51, 106], [2700, 52, 108], [3250, 52, 108]];
  fills.forEach(([k, l, sr], i) => { c3 = CC.addFuel(c3, { date: `2026-0${i + 4}-01`, litres: l, cost: sr, km: 40000 + k, full: true }); });
  check(EX.smartWarnings(c3, now).some(w => w.id === 'fuel'), 'fuel use up 15 %+ on the last tanks is flagged');
}
console.log('reading a receipt');
{
  const r = EX.parseReceipt('TEST AUTO CENTRE\nEngine oil 5W-30 4L    120.00\nOil filter            35.50\nفحمات امامية ٢٢٠\nLabour brakes 80\nCabin filter 45\nVAT 15% 75.08\nTotal 575.58');
  const by = Object.fromEntries(r.lines.map(l => [l.item, l]));
  check(by.oil?.price === 155.5 && by.brakes?.price === 300 && by.cabinFilter?.price === 45 && r.total === 575.58, `oil + filter, pads + labour, cabin filter, total (${JSON.stringify(r.lines.map(l => [l.item, l.price]))})`);
  check(!r.lines.some(l => /vat/i.test(l.text)) && by.oil.part.startsWith('Engine oil'), 'VAT is not a part; the part keeps its words');
  check(EX.parseReceipt('').lines.length === 0 && EX.parseReceipt('hello\n12').total === 0, 'nothing recognised → nothing ticked');
}
console.log('fuel stations, commute, quotes, fines, stock, value, papers in the calendar, the map');
{
  let c4 = { ...car, fuel: [] };
  c4 = CC.addFuel(c4, { date: '2026-10-01', litres: 40, cost: 93.2, km: 48000, station: 'Test Station A' });
  c4 = CC.addFuel(c4, { date: '2026-10-15', litres: 45, cost: 104.85, km: 48500, station: 'Test Station A' });
  c4 = CC.addFuel(c4, { date: '2026-11-01', litres: 30, cost: 70, km: 49000, station: 'Test Station B' });
  const sts = EX.stations(c4); check(sts[0].name === 'Test Station A' && sts[0].visits === 2 && sts[0].perL === 2.33, 'stations: most used first, SAR a litre');
  check(L.saveCar(s0, c4).cars.car1.fuel.filter(f => f.station).length === 3, 'the station survives saving the car');
  const cm = EX.commute(car, 45, () => ['a', 'b', 'c', 'd'], now, 7.5, 2.33); check(cm.shifts === 4 && cm.km === 360 && cm.litres === 27 && cm.sar === 63, 'commute: 4 shifts × 45 km × 2');
  check(EX.commute(car, 0, () => [], now) === null, 'no commute set → nothing');
  const c5 = EX.withX({ ...car, ins: { premium: 1200 } }, { insQuotes: [{ company: 'Test Ins B', premium: 1350 }, { company: 'Test Ins A', premium: 980 }] });
  const q = EX.compareQuotes(L.saveCar(s0, c5).cars.car1); check(q[0].company === 'Test Ins A' && q[0].cheapest && q[0].vsNow === -220 && q[1].vsNow === 150, 'quotes: cheapest first, against what you pay now');
  const c6 = L.saveCar(s0, EX.withX(car, { fines: [{ date: '2026-11-03', sar: 300, what: 'speeding' }], finesChecked: '2026-10-01' })).cars.car1;
  check(EX.finesDue(c6, now) && !EX.finesDue({ ...c6, x: { ...c6.x, finesChecked: '2026-11-20' } }, now), 'fines: a check is due after 30 days');
  check(M.months(c6, now).find(m => m.key === '2026-11').fines === 300 && M.months(c6, now).find(m => m.key === '2026-11').total >= 300, 'fines count in the month\'s car money');
  const c7 = L.saveCar(s0, EX.withX(car, { stock: [{ name: 'Test oil 4L', qty: 1, per: 1, item: 'oil' }, { name: 'Wiper fluid', qty: 3, per: 1 }] })).cars.car1;
  const c8 = EX.useStock(c7, ['oil', 'brakes']); check(c8.x.stock[0].qty === 0 && c8.x.stock[1].qty === 3 && EX.lowStock(c8).length === 1, 'a service uses linked spares; the empty one is low');
  const c9 = L.saveCar(s0, EX.withX(car, { values: [{ date: '2025-11-25', sar: 42000, src: 'test' }, { date: '2026-11-25', sar: 38000 }] })).cars.car1;
  const vt = EX.valueTrend(c9); check(vt.now === 38000 && vt.perYear === 4000, 'value: 4,000 SAR lost a year');
  const pe = EX.paperEvents(car, '2027-01-10', L.CAR_PAPERS); check(pe.length === 4 && pe.every(e => /^\d{4}-\d\d-\d\d$/.test(e.date) && e.key) && pe.some(e => e.key === 'paper-licence'), 'papers become all-day events with stable keys');
  const ids = Object.fromEntries(TR.CITIES.flatMap(([id, en]) => [[en, id], [id, id]]));
  const mp = EX.mapOf([{ from: 'Riyadh', to: 'Buraidah', km: 350 }, { from: 'Buraidah', to: 'Madinah', km: 500, done: true }, { from: 'Nowhere', to: 'Madinah', km: 10 }], ids, 600, 360);
  check(mp.pts.length === 3 && mp.segs.length === 2 && mp.pts.every(p => p.x >= 0 && p.x <= 600 && p.y >= 0 && p.y <= 360) && mp.pts.find(p => p.id === 'riyadh').x > mp.pts.find(p => p.id === 'madinah').x, 'map: legs fit the frame, Riyadh east of Madinah, unknown city skipped');
  check(EX.mapOf([{ from: 'Riyadh', to: 'Nowhere' }], ids) === null, 'map: one known city → no map');
}
console.log('the toolbox and the other apps (status.json)');
{
  const withStock = L.saveCar(s0, EX.withX(car, { stock: [{ name: 'Test oil 4L', qty: 0, per: 1, item: 'oil' }] }));
  const st1 = HUB.buildStatus(withStock, now);
  check(st1.extra.supplies?.need?.[0]?.name === 'Test oil 4L' && st1.extra.supplies.need[0].level === 'out' && st1.extra.money?.currency === 'SAR', 'shares spares to buy and the car money');
  const st2 = HUB.buildStatus(CZ.setTools(withStock, { share: false }), now);
  check(!st2.extra.supplies && !st2.extra.money && st2.extra.car, 'with sharing off only the basic car tile goes out');
  const st3 = HUB.buildStatus(CZ.setTools(L.saveCar(s0, EX.withX(car, { finesChecked: '2026-09-01' })), { fines: true }), now);
  check(st3.inbox.some(i => i.id.startsWith('fines-') && i.type === 'task'), 'the monthly fines check goes to Citrus\'s inbox');
  const js = JSON.stringify(st1); check(!js.includes(car.vin || '##') && !js.includes('P0000-TEST'), 'no VIN or policy number in what is shared');
}

console.log('the Drive layout (cloud model)');
const spl = CP.split(s0);
check(!spl.core.cars && !spl.core.workshops && spl.core.layout === 2 && Object.keys(spl.parts).length === CP.PARTS, 'split: a core without records + every part');
const back = CP.join(spl.core, spl.parts); check(['cars', 'workshops', 'quotes', 'photos'].every(c => JSON.stringify(Object.keys(back[c]).sort()) === JSON.stringify(Object.keys(s0[c]).sort())), 'join(split(s)) gives every record back');
check(Object.keys(CP.join(s0, {}).cars).length === 1, 'an old single state.json still reads');
if (bad()) { console.log(`FAILED: ${bad()}`); process.exit(1); }
console.log('all good');
