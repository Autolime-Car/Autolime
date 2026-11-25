// Autolime against an in-memory Google (Drive + Calendar + sign-in): the first sign-in makes "Car - Autolime" inside the
// tagged Life area (and tags it), offers to bring the car over from Calamansi's state.json (with Undo), reads days off from
// Mandarin's shifts.json, writes status.json only in its own folder, uploads a photo to photos/<kind>, puts the service day
// in the calendar, and two devices converge. A fresh device finds the folder by tag after Citrus moves it.
// Made-up data only. Run: node test/hub.mjs
import { chromium, serve, sleep, checker } from './helpers.mjs';
import { createFakeGoogle } from './fake-google.mjs';
import { shifts, calamansi } from './fixture.mjs';

const { server, url } = await serve(), browser = await chromium.launch(), { check, bad } = checker();
const g = createFakeGoogle();
// the Citrus layout: Citrus/Life (tagged area), Calamansi's and Mandarin's folders (tagged)
const life = g.path(['Citrus', 'Life']); g.files.get(life).appProperties = { citrusArea: 'life' };
const calDir = g.path(['Citrus', 'Life', 'Home & Kitchen - Calamansi']); g.files.get(calDir).appProperties = { citrusApp: 'calamansi' };
const manDir = g.path(['Citrus', 'Work', 'Mandarin']); g.files.get(manDir).appProperties = { citrusApp: 'mandarin' };
g.put('state.json', calDir, calamansi); g.put('shifts.json', manDir, shifts);
const calBefore = JSON.stringify(g.readJsonAt(['Citrus', 'Life', 'Home & Kitchen - Calamansi'], 'state.json'));

async function device(label) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'block', timezoneId: 'Asia/Riyadh' });
  await g.attach(ctx);
  const p = await ctx.newPage(); p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  await p.clock.install({ time: new Date('2026-11-25T19:30:00+03:00') });
  await p.addInitScript(() => { if (!localStorage.getItem('autolime.google')) localStorage.setItem('autolime.google', JSON.stringify({ access_token: 'tok', exp: Date.now() + 3600e3, email: 'tester@example.com' })); });
  await p.goto(url); await p.waitForSelector('#view-dash.active'); p.label = label;
  return { ctx, p };
}
const state = (p) => p.evaluate(() => JSON.parse(localStorage.getItem('autolime.state.v1') || 'null'));
const until = async (p, fn, ms = 8000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (await p.evaluate(fn).catch(() => false)) return true; await sleep(150); } return false; };
const sync = async (p) => { await until(p, () => !window.__autolime.rt.syncing); await p.evaluate(() => window.__autolime.refreshAll(true, { full: true })); await until(p, () => !window.__autolime.rt.syncing); await sleep(300); };

console.log('first sign-in on the phone');
const A = await device('phone');
check(await until(A.p, () => !!document.querySelector('.sheet h2')?.textContent.includes('Bring your car over')), 'offers to bring the car over from Calamansi');
const own = [...g.files.values()].filter(f => f.name === 'Car - Autolime' && !f.trashed);
check(own.length === 1 && own[0].parents.includes(life) && own[0].appProperties?.citrusApp === 'autolime', 'its folder is made once, inside Citrus/Life, and tagged');
check(![...g.files.values()].some(f => f.name === 'My Apps'), 'no My Apps folder is made');
await A.p.click('.sheet button:has-text("Bring it over")'); await sleep(500);
let st = await state(A.p);
check(Object.values(st.cars).length === 1 && st.migrated?.from === 'calamansi', 'the car came over');
check(st.settings.driver?.licence === '2030-04-06', 'the licence came over');
check(/Brought over/.test(await A.p.locator('#toasts').innerText()), 'a toast with Undo');
check(JSON.stringify(g.readJsonAt(['Citrus', 'Life', 'Home & Kitchen - Calamansi'], 'state.json')) === calBefore, 'Calamansi’s file is untouched');
check([...g.files.values()].some(f => /before-migration/.test(f.name)), 'a backup is kept before the migration');

console.log('sync, status, days off');
await sync(A.p);
const status = g.readJsonAt(['Citrus', 'Life', 'Car - Autolime'], 'status.json');
check(status?.app === 'autolime' && status.drive?.byTag, 'status.json in its own folder, by tag');
check(status.extra?.car?.name === 'Test Camry', 'the car tile for Citrus');
check(g.readJsonAt(['Citrus', 'Life', 'Car - Autolime'], 'state.json')?.app === 'autolime', 'state.json saved');
check(await A.p.evaluate(() => window.__autolime.R.has()), 'shifts read from Mandarin');
const writesElsewhere = [...g.files.values()].filter(f => !f.trashed && f.mimeType !== 'application/vnd.google-apps.folder' && (f.parents.includes(calDir) || f.parents.includes(manDir))).map(f => f.name).sort();
check(writesElsewhere.join() === 'shifts.json,state.json', `nothing written into Calamansi or Mandarin (${writesElsewhere.join(', ')})`);

console.log('the service day in the calendar, with days off');
await A.p.click('nav.tabs button[data-view=service]'); await sleep(200);
await A.p.click('#view-service button:has-text("Plan a service")'); await sleep(300);
const offChips = await A.p.locator('.sheet .chips .chip').allInnerTexts();
check(offChips.some(t => /Fri 27\/11/.test(t)), `days off offered from Mandarin (${offChips.slice(0, 3).join(', ')})`);
await A.p.click('.sheet .chip:has-text("Fri 27/11")');
await A.p.click('.sheet button:has-text("Everything due")');
await A.p.click('.sheet button:has-text("Save the plan")');
check(await until(A.p, () => { const s = JSON.parse(localStorage.getItem('autolime.state.v1')); return Object.values(s.cars)[0].plan?.eventId; }), 'the plan remembers its calendar event');
const evs = [...g.calendars.get('primary').events.values()];
check(evs.length === 1 && /service/.test(evs[0].summary) && evs[0].start.dateTime.startsWith('2026-11-27'), 'one event on the day off');
await sleep(500); await A.p.click('#view-service button:has-text("Edit the plan")'); await sleep(400);
await A.p.click('.sheet button:has-text("Clear")'); await A.p.click('.sheet button:has-text("Save the plan")');
check(await until(A.p, () => true) && await (async () => { await sleep(800); return g.calendars.get('primary').events.size === 0; })(), 'clearing the plan takes it out of the calendar');

console.log('a photo goes to Drive');
await A.p.click('nav.tabs button[data-view=papers]'); await sleep(200);
const [chooser] = await Promise.all([A.p.waitForEvent('filechooser'), A.p.click('.thumb.add:has-text("Istimara")')]);
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
await chooser.setFiles({ name: 'ist.png', mimeType: 'image/png', buffer: png });
check(await until(A.p, () => Object.values(JSON.parse(localStorage.getItem('autolime.state.v1')).photos || {}).some(p => p.file)), 'the photo uploads and its record gets the Drive id');
const photo = [...g.files.values()].find(f => f.appProperties?.autolime === 'istimara');
const pdir = photo && g.files.get(photo.parents[0]), pparent = pdir && g.files.get(pdir.parents[0]);
check(pdir?.name === 'istimara' && pparent?.name === 'photos', 'it lives in Car - Autolime/photos/istimara');

console.log('a second device');
await sync(A.p);
const B = await device('tablet');
await until(B.p, () => !window.__autolime.rt.syncing && window.__autolime.rt.stateLoaded, 10000);
let sb = await state(B.p);
check(Object.values(sb.cars || {}).length === 1 && Object.values(sb.photos || {}).length === 1, 'the tablet gets the car and the photo record');
check(!(await B.p.locator('.sheet h2:has-text("Bring your car over")').count()), 'and is not offered the migration again');
await B.p.evaluate(() => window.__autolime.store.update(s => ({ ...s, workshops: { w9: { id: 'w9', name: 'Tablet workshop', kind: 'general', area: '', phone: '', map: '', rating: 3, note: '', at: Date.now() } } })));
await sync(B.p); await sync(A.p);
st = await state(A.p);
check(st.workshops?.w9?.name === 'Tablet workshop', 'a workshop added on the tablet reaches the phone');

console.log('after Citrus moves the folder');
const moved = own[0]; const archive = g.path(['Citrus', 'Somewhere else']); moved.parents = [archive]; moved.name = 'Car (moved)'; g.touch(moved);
const C = await device('laptop');
await until(C.p, () => !window.__autolime.rt.syncing && window.__autolime.rt.stateLoaded, 10000);
check([...g.files.values()].filter(f => f.appProperties?.citrusApp === 'autolime' && !f.trashed).length === 1, 'a fresh device finds the moved folder by tag and makes no twin');
check(Object.values((await state(C.p)).cars || {}).length === 1, 'and reads the car from it');

for (const d of [A, B, C]) check(!d.p.errors.length, `${d.p.label}: no page errors (${d.p.errors.join(' | ')})`);
await browser.close(); server.close();
if (bad()) { console.log(g.tree()); console.log(`FAILED: ${bad()}`); process.exit(1); }
console.log('all good');
