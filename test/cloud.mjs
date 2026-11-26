// The cloud, tested like a saboteur would (the family test bar, claude/cloud-model.md, after Sudachi's test/cloud.mjs): the Drive
// layout (a small core + 8 parts), only changed parts going up or coming down, two devices editing at once, a car deleted on
// another device, a hung connection, a damaged part file, data too big for localStorage, a cut-off save on the device, two
// tabs at once, and a Drive copy from before the split. Made-up data only. Run: node test/cloud.mjs
import { chromium, serve, sleep, checker } from './helpers.mjs';
import { createFakeGoogle } from './fake-google.mjs';
import { shifts, state as fixture } from './fixture.mjs';

const { server, url } = await serve(), browser = await chromium.launch(), { check, bad } = checker();
const NOW = '2026-11-25T19:30:00+03:00', PARTS = 8;
function world() {
  const g = createFakeGoogle();
  const life = g.path(['Citrus', 'Life']); g.files.get(life).appProperties = { citrusArea: 'life' };
  const man = g.path(['Citrus', 'Work', 'Mandarin']); g.files.get(man).appProperties = { citrusApp: 'mandarin' }; g.put('shifts.json', man, shifts);
  return g;
}
const g = world(), ME = ['Citrus', 'Life', 'Car - Vehicular'];
const part = (i) => `records-${i}.json`;
const COLLS = ['cars', 'workshops', 'quotes', 'photos'];
const driveState = (gg = g) => { const core = gg.readJsonAt(ME, 'state.json'); if (!core) return null; const out = { ...core }; for (const c of COLLS) { out[c] = { ...(core[c] || {}) }; for (let i = 0; i < PARTS; i++) Object.assign(out[c], gg.readJsonAt(ME, part(i))?.[c] || {}); } return out; };

async function device(label, { seed = null, ctx = null, width = 390, google = g } = {}) {
  ctx ||= await browser.newContext({ viewport: { width, height: 844 }, isMobile: width < 700, hasTouch: width < 700, serviceWorkers: 'block', timezoneId: 'Asia/Riyadh' });
  if (!ctx.__attached) { await google.attach(ctx); ctx.__attached = true; }
  const p = await ctx.newPage(); p.errors = []; p.label = label;
  p.on('pageerror', e => p.errors.push(e.message));
  await p.clock.install({ time: new Date(NOW) });
  await p.addInitScript(([s]) => {
    if (!localStorage.getItem('autolime.google')) localStorage.setItem('autolime.google', JSON.stringify({ access_token: 'tok', exp: Date.now() + 3600e3, email: 'tester@example.com' }));
    if (s && !localStorage.getItem('autolime.seeded')) { localStorage.setItem('autolime.state.v1', JSON.stringify(s)); localStorage.setItem('autolime.seeded', '1'); }
  }, [seed]);
  await p.goto(url); await p.waitForSelector('section.view.active');
  return { ctx, p };
}
const ours = (l) => l.filter(n => n === 'state.json' || /^records-\d\.json$/.test(n));
const resetCounts = () => { g.counts.up = 0; g.counts.down = 0; g.counts.upNames = []; g.counts.downNames = []; };
const S = (p) => p.evaluate(() => window.__autolime.store.get());
const until = async (p, fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await sleep(150); } return false; };
const sync = async (p) => { await until(p, () => !window.__autolime.rt.syncing); await p.evaluate(() => window.__autolime.refreshAll(true)); await until(p, () => !window.__autolime.rt.syncing, 15000); await sleep(300); };
const act = (p, fn, arg) => p.evaluate(([f, a]) => { const w = window.__autolime; w.store.update(s => new Function('w', 's', 'a', `return (${f})(w, s, a)`)(w, s, a)); }, [fn.toString(), arg]);
const closeSheets = async (p) => { while (await p.locator('.sheet').count()) { await p.keyboard.press('Escape'); await sleep(250); } };

console.log('the Drive layout');
const A = await device('phone', { seed: fixture });
await sleep(500); await sync(A.p); await closeSheets(A.p);
const core = g.readJsonAt(ME, 'state.json'), nParts = [...Array(PARTS).keys()].filter(i => g.readJsonAt(ME, part(i))).length;
check(core && !core.cars && !core.workshops && core.layout === 2 && nParts === PARTS, `state.json is a small core (no records) and the records sit in ${PARTS} parts (${nParts})`);
const ds = driveState();
check(COLLS.every(c => Object.keys(ds[c]).length === Object.keys(fixture[c]).length), 'every record is on Drive');
const where = []; for (let i = 0; i < PARTS; i++) for (const c of COLLS) for (const id of Object.keys(g.readJsonAt(ME, part(i))?.[c] || {})) where.push(`${c}:${id}`);
check(where.length === new Set(where).size, 'each record in exactly one part');

console.log('only what changed moves');
resetCounts();
await act(A.p, (w, s) => w.L.saveCar(s, w.CC.addFuel(s.cars.car1, { date: '2026-11-25', litres: 40, cost: 93, km: 49900, full: true })));
await sync(A.p);
check(ours(g.counts.upNames).length === 1 && /^records-\d\.json$/.test(ours(g.counts.upNames)[0]), `a fill-up uploads one part, not everything (${g.counts.upNames.join(', ')})`);
const B = await device('tablet', { width: 800 });
await sleep(400); await sync(B.p); await closeSheets(B.p);
check(Object.keys((await S(B.p)).cars).length === 1 && Object.keys((await S(B.p)).workshops).length === 2, 'a fresh device reads everything');
await act(A.p, (w, s) => w.GA.saveShop(s, { ...s.workshops.w1, rating: 5 })); await sync(A.p);
resetCounts(); await sync(B.p);
check(ours(g.counts.downNames).length === 1 && (await S(B.p)).workshops.w1.rating === 5, `the other device downloads only the part that moved (${ours(g.counts.downNames).join(', ')})`);
resetCounts(); await sync(B.p);
check(!ours(g.counts.downNames).length && !ours(g.counts.upNames).length, `a sync with nothing new moves none of the data (${[...g.counts.downNames, ...g.counts.upNames].join(', ') || 'nothing at all'})`);

console.log('two devices editing at once');
await act(A.p, (w, s) => w.L.saveCar(s, w.CC.setLast(s.cars.car1, 'plugs', { date: '2026-11-20', km: 49500 })));
await act(B.p, (w, s) => w.GA.saveShop(s, { id: 'wB', name: 'Tablet tyre shop', kind: 'tyres' }));
await act(B.p, (w, s) => w.GA.saveQuote(s, { id: 'qB', car: 'car1', shop: 'wB', lines: [{ item: 'tyres', price: 1500 }] }));
await sync(A.p); await sync(B.p); await sync(A.p);
const [sa, sb] = [await S(A.p), await S(B.p)];
check(sa.cars.car1.care.plugs?.last === '2026-11-20' && sb.cars.car1.care.plugs?.last === '2026-11-20' && sa.workshops.wB && sa.quotes.qB, 'both devices end up with both sets of edits');

console.log('a car deleted on another device');
await act(B.p, (w, s) => w.L.deleteCar(s, 'car1'));
await sync(B.p); await sync(A.p);
check(await until(A.p, () => /removed on another device/.test(document.querySelector('.sheet')?.innerText || ''), 4000), 'the phone stops and asks before a car goes');
check(g.tree().some(l => /before-mass-delete/.test(l)), 'a copy from just before is kept on Drive');
await A.p.click('.sheet button:has-text("Bring them back")'); await sleep(400);
await sync(A.p); await sync(B.p);
check(!!(await S(B.p)).cars.car1 && !!(await S(A.p)).cars.car1, 'Bring them back restores the car on both devices');

console.log('a dead connection');
g.faults.hang = 1;
await A.p.evaluate(() => { window.__autolime.refreshAll(false); });
await sleep(400); await A.p.clock.fastForward(35000); await sleep(600);
check(await until(A.p, () => !window.__autolime.rt.syncing, 5000), 'a request that never answers times out; syncing does not freeze');
check(await A.p.evaluate(() => window.__autolime.rt.nextRetry > Date.now() || !(window.__autolime.rt.lastProblems || []).length), 'and it either recovered by itself or a retry is scheduled');
check(await A.p.evaluate(() => window.__autolime.G.stats.timeouts) >= 1, 'the timeout is counted for Diagnostics');
g.faults.hang = 0;
await sync(A.p);
check(await A.p.evaluate(() => !(window.__autolime.rt.lastProblems || []).length), 'the next sync works');
await A.p.click('#btnMore'); await sleep(300);
check(/Everything is saved to Drive/.test(await A.p.locator('#view-more .cloud').innerText()), 'Settings › Your data says in plain words that everything is saved');

console.log('a damaged part on Drive');
const carPart = [...Array(PARTS).keys()].find(i => g.readJsonAt(ME, part(i))?.cars?.car1);
const dmg = [...g.files.values()].find(f => f.name === part(carPart) && !f.trashed);
dmg.content = Buffer.from('{"part":1,"cars":{"car1":{'); dmg.appProperties = { ...dmg.appProperties, rev: 'broken' }; g.touch(dmg);
await sync(A.p); await sync(A.p);
check(g.tree().some(l => new RegExp(`records-${carPart}\\.damaged-`).test(l)), 'the unreadable part is set aside (renamed), never overwritten');
check(!!g.readJsonAt(ME, part(carPart))?.cars?.car1, 'a fresh good copy of that part is written from the device');

console.log('more data than browser storage holds');
await act(A.p, (w, s) => { let x = s; for (let k = 0; k < 1800; k++) x = w.PH.savePhoto(x, { id: `pbig${k}`, car: 'car1', kind: 'receipt', file: `drive-file-${k}`, name: `receipt-${k}-${'x'.repeat(40)}.jpg`, note: 'Test receipt with a fairly long note '.repeat(3) }); for (let k = 0; k < 300; k++) x = w.GA.saveQuote(x, { id: `qbig${k}`, car: 'car1', shopName: `Test garage ${k}`, lines: Array.from({ length: 20 }, (_, j) => ({ item: '', label: `Test line ${j} ${'y'.repeat(30)}`, price: j, labour: 1, part: 'Test part '.repeat(4) })), note: 'n'.repeat(150) }); return x; });
await sleep(800);
const ls = await A.p.evaluate(() => ({ main: !!localStorage.getItem('autolime.state.v1'), flag: !!localStorage.getItem('autolime.state.inIdb'), n: Object.keys(window.__autolime.store.get().photos).length, ok: window.__autolime.store.persistence.ok }));
check(!ls.main && ls.flag && ls.ok, `over the limit, the data moves to IndexedDB only, still saved (${ls.n} photo records)`);
await A.p.reload(); await A.p.waitForSelector('section.view.active'); await sleep(500);
check(Object.keys((await S(A.p)).photos).length === ls.n, 'after a reload every record is still there');
resetCounts(); await sync(A.p);
check(Object.keys(driveState().photos).length === ls.n && ours(g.counts.upNames).length <= PARTS + 1, `changes made just before a reload still reach Drive, as parts (${Object.keys(driveState().photos).length} photo records on Drive)`);
await act(A.p, (w, s) => w.GA.saveShop(s, { ...s.workshops.w2, rating: 2 })); resetCounts(); await sync(A.p);
check(ours(g.counts.upNames).length === 1, `one change in big data still sends one part (${g.counts.upNames.join(', ')})`);

console.log('a save cut off on the device');
await A.p.evaluate(async () => { const db = await new Promise(r => { const q = indexedDB.open('autolime', 1); q.onsuccess = () => r(q.result); }); const all = await new Promise(r => { const q = db.transaction('slots').objectStore('slots').getAll(); q.onsuccess = () => r(q.result); }); const newest = all.sort((a, b) => b.savedAt - a.savedAt)[0]; await new Promise(r => { const t = db.transaction('slots', 'readwrite'); t.objectStore('slots').put({ ...newest, raw: newest.raw.slice(0, 5000), hi: newest.hi + 1e9, savedAt: Date.now() + 1 }); t.oncomplete = r; }); db.close(); });
await A.p.reload(); await A.p.waitForSelector('section.view.active'); await sleep(500);
check(Object.keys((await S(A.p)).photos).length >= ls.n - 1 && !!(await S(A.p)).cars.car1, 'a half-written copy is skipped: the other slot loads');

console.log('two tabs at once');
const A2 = await device('phone, second tab', { ctx: A.ctx });
await sleep(400);
await act(A.p, (w, s) => w.GA.saveShop(s, { id: 'tab1', name: 'Added in tab one' }));
check(await until(A2.p, () => !!window.__autolime.store.get().workshops.tab1, 4000), 'the other tab sees a change within moments');
await act(A2.p, (w, s) => w.GA.saveShop(s, { ...s.workshops.tab1, rating: 3 }));
check(await until(A.p, () => window.__autolime.store.get().workshops.tab1?.rating === 3, 4000), 'and the other way round');
g.faults.delay = 600;
await A.p.evaluate(() => { window.__autolime.refreshAll(false); }); await sleep(150);
await A2.p.evaluate(() => window.__autolime.refreshAll(false)); await sleep(100);
check(await A.p.evaluate(() => window.__autolime.rt.syncing) && !(await A2.p.evaluate(() => window.__autolime.rt.syncing)), 'only one tab talks to Drive at a time');
g.faults.delay = 0; await until(A.p, () => !window.__autolime.rt.syncing, 20000);

console.log('a Drive copy from before the split (one big state.json)');
const g2 = world(), at = Date.parse('2026-11-10T10:00:00Z');
const dir = g2.path(ME); g2.files.get(dir).appProperties = { citrusApp: 'autolime' };
g2.put('state.json', dir, { app: 'autolime', version: 1, updatedAt: at, cars: { old1: { ...fixture.cars.car1, id: 'old1', name: 'Old layout car', at } }, workshops: {}, quotes: {}, photos: {}, deleted: {}, stamps: {}, settings: {}, migrated: { from: 'skipped', at, counts: {} } });
const C = await device('old-layout device', { google: g2 }); await sleep(400); await sync(C.p);
check(!!(await S(C.p)).cars.old1, 'the old single-file copy is read');
const c2 = g2.readJsonAt(ME, 'state.json'), inParts = [...Array(PARTS).keys()].some(i => g2.readJsonAt(ME, part(i))?.cars?.old1);
check(c2 && !c2.cars && inParts, 'and rewritten as core + parts on the next save');
const f = [...g2.files.values()].find(x => x.name === 'state.json' && !x.trashed); f.content = Buffer.from(JSON.stringify({ ...c2, workshops: { oldw: { id: 'oldw', name: 'Workshop from an old device', at: at + 9e6 } } })); f.appProperties = { ...f.appProperties, rev: 'old-device' }; g2.touch(f);
await sync(C.p);
check(!!(await S(C.p)).workshops.oldw && !!(await S(C.p)).cars.old1, 'a record written by an old-version device still arrives');

check([A, B, A2, C].every(d => !d.p.errors.length), `no page errors ${[A, B, A2, C].flatMap(d => d.p.errors).slice(0, 2).join(' | ')}`);
await browser.close(); server.close();
console.log(bad() ? `\n${bad()} FAILED` : '\nall passed');
process.exit(bad() ? 1 : 0);
