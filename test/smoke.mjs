// Every tab and the main sheets render at phone and desktop sizes (and in each interface) with made-up data, with no page errors,
// no stray "undefined" / "NaN" / "null" on screen and no sideways scroll; deep links, the setup link, the policy PDF, a
// service with prices, a fill-up, a quote compare, the code lookup and a noise all work. Run: node test/smoke.mjs
import { chromium, serve, page, sleep, checker } from './helpers.mjs';
import { shifts, state } from './fixture.mjs';
import { toolsState } from './fixture-tools.mjs';
import fs from 'node:fs'; import path from 'node:path';
const shots = path.resolve(path.dirname(new URL(import.meta.url).pathname), 'shots/smoke'); fs.rmSync(shots, { recursive: true, force: true }); fs.mkdirSync(shots, { recursive: true });
const { server, url } = await serve(), browser = await chromium.launch(), { check, bad } = checker();
const TABS = ['dash', 'service', 'fuel', 'papers', 'trip', 'garage', 'more'];
const clean = async (p, sel, what) => {
  const txt = await p.locator(sel).last().innerText();
  check(txt.length > 30, `${what} renders (${txt.length} chars)`);
  check(!/\bundefined\b|\bNaN\b|\bnull\b|\[object Object\]/.test(txt), `${what}: no undefined / NaN / null`);
  check(!/hit a problem/.test(txt), `${what}: no crash card`);
  return txt;
};
const noScroll = async (p, what) => { const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth); check(over <= 1, `${what}: no sideways scroll (${over}px)`); };
for (const [w, hgt, time, ui] of [[390, 844, '2026-11-25T19:30:00+03:00', 'clean'], [320, 640, '2026-12-16T08:00:00+03:00', 'arcade'], [1500, 900, '2026-11-25T15:00:00+03:00', 'paper']]) {
  console.log(`${w}px at ${time.slice(5, 16)} (${ui})`);
  const { p, errors } = await page(browser, { width: w, height: hgt, time, seed: state, shifts });
  await p.addInitScript((u) => localStorage.setItem('autolime.ui', JSON.stringify({ ui: u, size: 'normal' })), ui);
  await p.goto(url); await sleep(500);
  for (const t of TABS) {
    if (t === 'more') await p.click('#btnMore'); else await p.click(`nav.tabs button[data-view=${t}]`);
    await sleep(300); await clean(p, `#view-${t}`, t); await noScroll(p, t);
    await p.screenshot({ path: `${shots}/${w}-${t}.png`, fullPage: true });
  }
  const sheetCheck = async (open, what) => { await open(); await sleep(400); const t = await clean(p, '.sheet', what); await p.screenshot({ path: `${shots}/${w}-${what.replace(/\W+/g, '-')}.png` }); await noScroll(p, what); await p.keyboard.press('Escape'); await sleep(300); while (await p.locator('.sheet').count()) { await p.keyboard.press('Escape'); await sleep(300); } return t; };
  const tab = async (t) => { await p.click(`nav.tabs button[data-view=${t}]`); await sleep(200); };
  await tab('dash');
  await sheetCheck(() => p.click('.cl-act:has-text("Log service")'), 'service sheet');
  await sheetCheck(() => p.click('.cl-act:has-text("Fuel")'), 'fuel sheet');
  const wl = await sheetCheck(() => p.click('.cl-act:has-text("Workshop list")'), 'workshop list'); check(/زيت المكينة/.test(wl) && /last 180 SAR/.test(wl), 'the counter list: big Arabic, and what you paid last time');
  await sheetCheck(() => p.click('#btnSOS'), 'accident card');
  const it = await sheetCheck(() => p.click('.item:has-text("Battery test")'), 'item sheet'); check(/Where it is/i.test(it), 'the item sheet shows where the part is');
  await sheetCheck(() => p.click('.tt:has-text("Oil")'), 'telltale opens the worst oil item');
  await tab('service'); await sheetCheck(() => p.click('#view-service button:has-text("Edit the plan")'), 'plan sheet');
  await tab('papers'); await sheetCheck(() => p.click('#view-papers button:has-text("Edit")'), 'insurance sheet');
  await tab('trip'); await sheetCheck(() => p.click('#view-trip .view-head button:has-text("Edit")'), 'trip sheet');
  await tab('garage'); await sheetCheck(() => p.click('.shop:has-text("Test workshop")'), 'workshop sheet');
  await sheetCheck(() => p.click('#view-garage button:has-text("+ Quote")'), 'quote sheet');
  if (errors.length) console.log(errors);
  check(!errors.length, `no page errors (${errors.length})`);
  await p.context().close();
}

console.log('doing things (phone)');
const { p, errors } = await page(browser, { time: '2026-11-25T19:30:00+03:00', seed: state, shifts });
await p.goto(url); await sleep(500);
// log a service with a price
await p.click('.cl-act:has-text("Log service")'); await sleep(300);
await p.click('.sheet .chip:has-text("Wiper blades")');
await p.evaluate(() => { for (const d of document.querySelectorAll('.sheet details')) d.open = true; }); await sleep(100);
const priceIn = p.locator('.sheet input[aria-label="Battery test price"]'); if (await priceIn.count()) await priceIn.fill('25');
await p.fill('.sheet input[placeholder="km on the dash"]', '49900');
await p.click('.sheet button:has-text("Save the service")'); await sleep(400);
let st = await p.evaluate(() => JSON.parse(localStorage.getItem('autolime.state.v1')));
const last = st.cars.car1.log.at(-1); check(last.date === '2026-11-25' && last.items.includes("wipers"), 'a service is logged from the Dash');
check(last.lines?.some(l => l.item === 'battery' && l.price === 25), 'with the price of a part');
// a fill-up
await p.click('nav.tabs button[data-view=fuel]'); await sleep(200);
await p.click('#view-fuel button:has-text("Fill-up")'); await sleep(300);
await p.fill('.sheet input[aria-label="Litres"]', '42'); await p.fill('.sheet input[aria-label="Paid (SAR)"]', '97.86'); await p.fill('.sheet input[aria-label="Odometer (km)"]', '50300');
await p.click('.sheet button:has-text("Save")'); await sleep(300);
st = await p.evaluate(() => JSON.parse(localStorage.getItem('autolime.state.v1')));
check(st.cars.car1.fuel.some(f => f.litres === 42 && f.km === 50300), 'a fill-up is saved with the reading');
// quotes side by side
await p.click('nav.tabs button[data-view=garage]'); await sleep(200);
for (const cb of await p.locator('#view-garage input[type=checkbox]').all()) await cb.check();
await sleep(300); const cmpTxt = await p.locator('#view-garage').innerText();
check(/Side by side/i.test(cmpTxt) && /cheaper by 10 SAR/.test(cmpTxt), 'two quotes compared: the cheaper for the same work');
// the code lookup
await p.click('.gt:has-text("Codes")'); await sleep(200); await p.fill('.code-in', 'p0171'); await sleep(200);
check(/Running lean/.test(await p.locator('#view-garage').innerText()), 'P0171 explained in plain words');
// a noise
await p.click('.gt:has-text("Noises")'); await sleep(200); await p.click('#view-garage .item:has-text("Humming")'); await sleep(200); await p.click('#view-garage .item:has-text("louder one way")'); await sleep(200);
const nz = await p.locator('#view-garage').innerText(); check(/wheel bearing/i.test(nz) && /صوت هدير/.test(nz), 'a hum on bends: a wheel bearing, with the Arabic for the workshop');
// anatomy game
await p.click('.gt:has-text("Anatomy")'); await sleep(200); await p.click('#view-garage button:has-text("Find it")'); await sleep(200);
check(/Find:/.test(await p.locator('#view-garage').innerText()), 'Find-it game starts');
// a renewal tick
await p.click('nav.tabs button[data-view=papers]'); await sleep(200);
await p.click('#view-papers .check:has-text("Book a slot")'); await sleep(200);
st = await p.evaluate(() => JSON.parse(localStorage.getItem('autolime.state.v1')));
check((st.cars.car1.renew?.['fahas:2026-12-10'] || []).includes('book'), 'a renewal step is ticked and kept');
// the trip: a daily check on the road, then finish it
await p.clock.setFixedTime(new Date('2026-12-16T07:00:00+03:00'));
await p.click('nav.tabs button[data-view=trip]'); await sleep(300);
check(/morning’s check/i.test(await p.locator('#view-trip').innerText()), 'on the road: this morning’s check');
await p.click('#view-trip button:has-text("Finish the trip")'); await sleep(300);
st = await p.evaluate(() => JSON.parse(localStorage.getItem('autolime.state.v1')));
check(!st.cars.car1.trip && st.cars.car1.trips.length === 1, 'a finished trip goes to Past trips');
check(!errors.length, `no page errors (${errors.join(' | ')})`);
await p.context().close();

console.log('the toolbox (simple by default, more when switched on)');
{
  const tb = await page(browser, { time: '2026-11-25T19:30:00+03:00', seed: state, shifts }), q = tb.p;
  const S2 = () => q.evaluate(() => JSON.parse(localStorage.getItem('autolime.state.v1')));
  await q.goto(url); await sleep(500);
  check(!(await q.locator('#view-dash :text("I parked here")').count()) && !(await q.locator('#view-dash :text("Worth a look")').count()), 'new tools are off: no parking or warnings card');
  check(await q.locator('#view-dash .tools-hint').count() === 1, 'the Dash ends with a quiet "Tools for Dash" link');
  await q.click('#view-dash .tools-hint'); await sleep(300);
  check(await q.locator('.sheet [role=switch]').count() === 4, 'it opens the Dash tools as switches');
  await q.click('.sheet [role=switch]:has-text("Where I parked")'); await sleep(300);
  check((await q.locator('.sheet [role=switch][aria-checked=true]:has-text("Where I parked")').count()) === 1, 'the switch flips and says so (aria-checked)');
  await q.keyboard.press('Escape'); await sleep(400);
  check(await q.locator('#view-dash :text("I parked here")').count() === 1, 'the parking card appears on the Dash');
  // Settings: presets
  await q.click('#btnMore'); await sleep(300);
  await q.click('#toolbox [role=radio]:has-text("Simple")'); await sleep(300);
  let st2 = await S2(); check(Object.entries(st2.settings.custom.tools).every(([id, v]) => v === (id === 'share')), 'Simple: every tool off but sharing');
  await q.click('nav.tabs button[data-view=garage]'); await sleep(300);
  check(!(await q.locator('#view-garage .garage-tiles').count()), 'Simple Garage: just workshops and quotes, no tiles');
  await q.click('nav.tabs button[data-view=dash]'); await sleep(300);
  check(!(await q.locator('#view-dash :text("Logbook")').count()) && await q.locator('#view-dash :text("Due now")').count() === 1, 'Simple Dash: no logbook, what is due stays');
  await q.click('#btnMore'); await sleep(300);
  await q.click('#toolbox [role=radio]:has-text("Everything")'); await sleep(300);
  st2 = await S2(); check(Object.values(st2.settings.custom.tools).every(Boolean), 'Everything: every tool on');
  // a tyre reading, a battery check, a fine, a quote, a spare
  await q.click('nav.tabs button[data-view=service]'); await sleep(300);
  await q.click('#view-service button:has-text("+ Reading")'); await sleep(200);
  await q.fill('.sheet input[aria-label="front left tread mm"]', '5.2'); await q.fill('.sheet input[aria-label="front left pressure psi"]', '29');
  await q.click('.sheet button:has-text("Save")'); await sleep(300);
  await q.click('#view-service button:has-text("+ Check")'); await sleep(200); await q.fill('.sheet input[aria-label="Volts"]', '12.3'); await q.click('.sheet button:has-text("Save")'); await sleep(300);
  st2 = await S2(); check(st2.cars.car1.x?.tyreLog?.[0]?.tread?.FL === 5.2 && st2.cars.car1.x?.battery?.[0]?.v === 12.3, 'a tyre reading and a battery check are saved');
  check(/Add air/.test(await q.locator('#view-service').innerText()), 'low pressure says "Add air"');
  // the service sheet gains warranty fields and the receipt reader
  await q.click('#view-service button:has-text("Log a service")'); await sleep(300);
  await q.evaluate(() => { for (const d of document.querySelectorAll('.sheet details')) d.open = true; }); await sleep(100);
  check(await q.locator('.sheet input[aria-label$="warranty (months)"]').count() > 0 && await q.locator('.sheet button:has-text("Read the receipt")').count() === 1, 'the service sheet gets warranty months and "Read the receipt"');
  await q.keyboard.press('Escape'); await sleep(400);
  await q.click('nav.tabs button[data-view=papers]'); await sleep(300);
  await q.click('#view-papers button:has-text("+ A fine")'); await sleep(200); await q.fill('.sheet input[aria-label="Fine (SAR)"]', '300'); await q.click('.sheet button:has-text("Save")'); await sleep(300);
  await q.click('#view-papers button:has-text("+ Quote")'); await sleep(200); await q.fill('.sheet input[placeholder="insurer"]', 'Test Insurer'); await q.fill('.sheet input[aria-label="Premium (SAR a year)"]', '990'); await q.click('.sheet button:has-text("Save")'); await sleep(300);
  st2 = await S2(); check(st2.cars.car1.x?.fines?.[0]?.sar === 300 && st2.cars.car1.x?.finesChecked === '2026-11-25' && st2.cars.car1.x?.insQuotes?.[0]?.premium === 990, 'a fine (marks the check done) and an insurance quote');
  await q.click('nav.tabs button[data-view=garage]'); await sleep(300);
  await q.click('#view-garage button:has-text("+ Spare")'); await sleep(200); await q.fill('.sheet input[placeholder="e.g. 5W-30 oil"]', 'Test oil'); await q.fill('.sheet input[aria-label="Quantity"]', '1'); await q.selectOption('.sheet select[aria-label="Used for"]', 'oil'); await q.click('.sheet button:has-text("Save")'); await sleep(300);
  await q.click('#view-garage button[aria-label="One less Test oil"]'); await sleep(300);
  st2 = await S2(); check(st2.cars.car1.x?.stock?.[0]?.qty === 0, 'a spare is added and counted down');
  check(/1 low/i.test(await q.locator('#view-garage').innerText()), 'and shows as low');
  // a fill-up with a station
  await q.click('nav.tabs button[data-view=fuel]'); await sleep(300);
  await q.click('#view-fuel button:has-text("Fill-up")'); await sleep(200);
  await q.fill('.sheet input[aria-label="Litres"]', '40'); await q.fill('.sheet input[aria-label="Paid (SAR)"]', '93.2'); await q.fill('.sheet input[aria-label="Station"]', 'Test Station'); await q.click('.sheet button:has-text("Save")'); await sleep(300);
  st2 = await S2(); check(st2.cars.car1.fuel.at(-1).station === 'Test Station', 'a fill-up keeps its station');
  check(/Test Station/.test(await q.locator('#view-fuel').innerText()), 'and Fuel shows where you fill up');
  check(!tb.errors.length, `toolbox: no page errors (${tb.errors.join(' | ')})`);
  await q.context().close();
  // every tool on, every tab, three sizes: no blanks, no NaN, no sideways scroll
  for (const [w, hgt, ui] of [[390, 844, 'clean'], [320, 640, 'arcade'], [1500, 900, 'paper']]) {
    const ev = await page(browser, { width: w, height: hgt, time: '2026-11-25T19:30:00+03:00', seed: toolsState, shifts });
    await ev.p.addInitScript((u) => localStorage.setItem('autolime.ui', JSON.stringify({ ui: u, size: 'normal' })), ui);
    await ev.p.goto(url); await sleep(500);
    for (const t of TABS) { if (t === 'more') await ev.p.click('#btnMore'); else await ev.p.click(`nav.tabs button[data-view=${t}]`); await sleep(250); await clean(ev.p, `#view-${t}`, `everything on, ${w}px ${ui}: ${t}`); await noScroll(ev.p, `everything on, ${w}px: ${t}`); }
    check(!ev.errors.length, `everything on, ${w}px: no page errors (${ev.errors.join(' | ')})`);
    await ev.p.context().close();
  }
}

console.log('deep links and the setup link');
const dl = await page(browser, { time: '2026-11-25T19:30:00+03:00', seed: state, shifts });
await dl.p.goto(url.replace('index.html', 'index.html?do=accident')); await sleep(700);
check(/After an accident/.test(await dl.p.locator('.sheet').innerText().catch(() => '')), '?do=accident opens the accident card');
await dl.p.context().close();
const setup = { car: { name: 'Setup Car', model: 'camry-2016', istimara: '2028-01-01', vin: '1M8GDM9AXKP042788' }, driver: { licence: '2030-01-01' } };
const b64 = Buffer.from(JSON.stringify(setup)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const sl = await page(browser, { time: '2026-11-25T19:30:00+03:00' });
await sl.p.goto(`${url}#setup=${b64}`); await sleep(900);
check(/Add your car/.test(await sl.p.locator('.sheet').innerText().catch(() => '')), 'the setup link proposes the car');
check(!/setup=/.test(await sl.p.evaluate(() => location.href)), 'the setup link is wiped from the address bar');
await sl.p.click('.sheet button:has-text("Add it")'); await sleep(400);
const ss = await sl.p.evaluate(() => JSON.parse(localStorage.getItem('autolime.state.v1')));
check(Object.values(ss.cars).some(c => c.name === 'Setup Car') && ss.settings.driver.licence === '2030-01-01', 'the car and licence are added after the tap');
// the policy PDF on a fresh app
await sl.p.click('#view-papers').catch(() => {});
await sl.p.click('nav.tabs button[data-view=papers]'); await sleep(200);
await sl.p.click('#view-papers .card.cta:has-text("Insurance")'); await sleep(300);
await sl.p.setInputFiles('.sheet input[type=file]', path.resolve(path.dirname(new URL(import.meta.url).pathname), 'policy-sample.pdf')); await sleep(2500);
check(/Found:/.test(await sl.p.locator('.sheet').innerText()), 'the policy PDF is read on the device');
check(!sl.errors.length, `no page errors (${sl.errors.join(' | ')})`);
await sl.p.context().close();

await browser.close(); server.close();
if (bad()) { console.log(`FAILED: ${bad()}`); process.exit(1); }
console.log('all good');
