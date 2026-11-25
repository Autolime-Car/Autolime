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
import { mergeStates, sanitize } from '../docs/js/store.js';
import { checkBackup } from '../docs/js/backup-check.js';
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

if (bad()) { console.log(`FAILED: ${bad()}`); process.exit(1); }
console.log('all good');
