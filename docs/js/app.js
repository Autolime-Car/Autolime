// Autolime — the car app of the citrus family. Care by km or date with the Arabic workshop words, the planned service and
// the list for the counter, quotes and workshops, papers and renewals, fuel and money, road trips, codes, noises, the anatomy
// and the accident card. Split out of Calamansi's Car tab (25/11/2026). Vanilla ES modules, no build step.
import * as store from './store.js';
import { mergeStates } from './store.js';
import * as G from './google.js';
import * as R from './roster.js';
import * as L from './car.js';
import * as CC from './carcare.js';
import * as CZ from './custom.js';
import * as HUB from './hub.js';
import * as MIG from './migrate.js';
import * as PH from './photos.js';
import * as GA from './garage.js';
import * as OBD from './obd.js';
import * as NZ from './noises.js';
import * as AN from './anatomy.js';
import { initKit, currentCar } from './ui-kit.js';
import * as SH from './ui-sheets.js';
import { renderDash } from './ui-dash.js';
import { renderService } from './ui-service.js';
import { renderFuel } from './ui-fuel.js';
import { renderPapers } from './ui-papers.js';
import { renderTrip } from './ui-trip.js';
import { renderGarage, garagePart, quoteSheet, partSheet } from './ui-garage.js';
import { checkBackup, describeCounts } from './backup-check.js';
import { h, toast, keyOf, addDays, startOfDay, fromKey, fmtDate, DAY_NAMES, MONTHS, uid } from './util.js';

export const VERSION = '1.0.0';
const CITRUS_URL = 'https://amaerys.github.io/citrus-maxima/';
const CALAMANSI_URL = 'https://calamansi-food.github.io/Calamansi/';

const rt = { view: 'dash', calendars: [], syncing: false, online: navigator.onLine, hub: { at: 0, shiftsAt: '' }, fromCitrus: false };
const $ = (s, el = document) => el.querySelector(s);
const S = () => store.get();

// ---------------- boot ----------------
async function boot() {
  applyTheme(); applyLook(); watchSheets();
  for (const b of document.querySelectorAll('nav.tabs button')) b.addEventListener('click', () => go(b.dataset.view));
  $('#btnRefresh').addEventListener('click', () => refreshAll(true));
  $('#btnMore').addEventListener('click', () => show('more'));
  $('#btnSearch').addEventListener('click', () => openSearch());
  $('#btnSOS').addEventListener('click', () => SH.accidentSheet(currentCar()));
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement?.tagName || '') || document.activeElement?.isContentEditable;
    if (e.key === 'Escape') { const sr = document.querySelector('.search'); if (sr) { sr.remove(); e.stopImmediatePropagation(); return; } closeTopSheet(); return; }
    if (typing) return;
    if (e.key === '/' && !document.querySelector('.search')) { openSearch(); e.preventDefault(); return; }
    if (document.querySelector('.sheet-bg, .search')) return;
    const tabs = CZ.visibleTabs(S()), c = currentCar();
    if (/^[1-6]$/.test(e.key) && tabs[+e.key - 1]) { show(tabs[+e.key - 1]); e.preventDefault(); }
    else if (e.key === 'r') refreshAll(true);
    else if (e.key === ',') show('more');
    else if (e.key === 's' && c?.model) { SH.visitSheet(c); e.preventDefault(); }
    else if (e.key === 'f' && c) { SH.fuelSheet(c); e.preventDefault(); }
    else if (e.key === 'w' && c?.model) { SH.workshopSheet(c); e.preventDefault(); }
    else if (e.key === 'c') { go('garage', 'codes'); e.preventDefault(); }
    else if (e.key === '!') { SH.accidentSheet(c); e.preventDefault(); }
    else if (e.key === '?') { shortcutsSheet(); e.preventDefault(); }
  });
  window.addEventListener('online', () => { rt.online = true; renderSync(); flushPhotos().catch(() => {}); });
  window.addEventListener('offline', () => { rt.online = false; renderSync(); });
  initKit({ S, update: (fn) => store.update(fn), sheet, render: () => render(), go, undoTo, cheer, checkSetup: () => checkSetup(true), migrateNow,
    itemSheet: SH.itemSheet, partSheet, quoteSheet, takePhoto, photoUrl, binPhoto, calendarForPlan, signedIn: () => G.isSignedIn(),
    daysOff: (a, b) => HUB.daysOff(a, b), workDays: (a, b) => HUB.workDays(a, b), tank: () => CZ.custom(S()).car.tank });
  store.subscribe(() => { applyLook(); render(); publishSoon(); });
  store.onRemoteSync(scheduleRemoteSave);
  R.load(); loadHubCache();
  handleIncoming();
  if (!rt.handled) show(location.hash.replace('#', '') || CZ.custom(S()).start);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
  const cid = S().settings.clientId;
  G.onAuthChange(() => { renderSync(); render(); });
  G.renewOnTap(() => { render(); refreshAll(false); });
  if (cid && rt.online) {
    try { await G.init(cid); } catch (e) { console.warn(e); }
    if (G.isSignedIn()) refreshAll(false);
    else if (G.wasSignedIn()) { G.auth.needsSignIn = true; render(); }
  }
  navigator.storage?.persist?.().then(ok => { rt.storagePersisted = ok; }).catch(() => {});
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { flushRemoteSave(); return; }
    if (G.isSignedIn() && Date.now() - (S().google.lastSync || 0) > 2 * 60000) refreshAll(false);
    render();
  });
  window.addEventListener('pagehide', flushRemoteSave);
  setInterval(() => { if (document.visibilityState === 'visible' && G.isSignedIn() && rt.online && Date.now() - (S().google.lastSync || 0) > 5 * 60000) refreshAll(false); }, 60000);
  renderSync();
}
function applyLook() { const l = CZ.custom(S()).look, r = document.documentElement; r.dataset.accent = l.accent; r.dataset.density = l.density; r.dataset.motion = l.motion ? 'on' : 'off'; }
function cheer(from) {
  if (!CZ.custom(S()).look.fun || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const r = (from?.getBoundingClientRect?.() || { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 }), x = r.left + r.width / 2, y = r.top + r.height / 2;
  const colors = ['#b6f23a', '#ff7a1a', '#ffb020', '#3ad6f2', '#eef3ec'];
  for (let i = 0; i < 18; i++) { const p = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 50 + Math.random() * 90; p.className = 'confetti'; p.style.cssText = `left:${x}px;top:${y}px;background:${colors[i % colors.length]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d - 40}px;--r:${Math.random() * 540 - 270}deg;`; document.body.append(p); setTimeout(() => p.remove(), 1000); }
}
function undoTo(before) { store.replaceState(before, { bump: true, exact: S() }); render(); toast('Undone'); }

// Arriving from another app or a link: ?from=citrus shows "← Citrus"; ?do=<action> jumps straight there; #setup=… proposes a car.
const DO = { dash: ['dash'], car: ['dash'], service: ['service'], plan: ['service'], fuel: ['fuel'], money: ['fuel'], papers: ['papers'], insurance: ['papers'], trip: ['trip'], garage: ['garage'], workshops: ['garage', 'shops'], quotes: ['garage', 'shops'], codes: ['garage', 'codes'], noises: ['garage', 'noises'], anatomy: ['garage', 'anatomy'], accident: ['dash', 'accident'], log: ['dash', 'log'], fill: ['fuel', 'fill'] };
function handleIncoming() {
  try {
    const q = new URLSearchParams(location.search);
    const from = String(q.get('from') || '').toLowerCase(), action = String(q.get('do') || '').toLowerCase();
    if (from === 'citrus') { rt.fromCitrus = true; try { sessionStorage.setItem('autolime.fromCitrus', '1'); } catch {} }
    else { try { if (sessionStorage.getItem('autolime.fromCitrus')) rt.fromCitrus = true; } catch {} }
    const sm = /(?:^#|&)setup=([A-Za-z0-9_\-]+)/.exec(location.hash); let setup = null;
    if (sm) { try { setup = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(sm[1].replace(/-/g, '+').replace(/_/g, '/')), ch => ch.charCodeAt(0)))); } catch { toast('That setup link is damaged', 'err'); } history.replaceState(null, '', location.pathname + (location.search || '') + '#dash'); }
    const target = setup ? DO.dash : DO[action] || DO[location.hash.replace('#', '')] || null;
    if (setup) { rt.handled = true; go('dash'); setTimeout(() => SH.setupSheet(setup), 400); }
    if (q.toString()) history.replaceState(null, '', location.pathname + (target ? `#${target[0]}` : location.hash || '#dash'));
    if (!target || setup) return;
    rt.handled = true; go(target[0], target[1]);
    const later = (fn) => setTimeout(fn, 300), c = currentCar();
    if (target[1] === 'accident') later(() => SH.accidentSheet(c));
    else if (target[1] === 'log' && c?.model) later(() => SH.visitSheet(c));
    else if (target[1] === 'fill' && c) later(() => SH.fuelSheet(c));
  } catch (e) { console.warn('incoming', e); }
}
function authBanner() {
  if (!G.auth.needsSignIn || !rt.online) return null;
  return h('div', { class: 'banner' }, h('span', { class: 'grow' }, 'Google needs a tap to reconnect — nothing is lost, sync resumes after.'),
    h('button', { class: 'btn sm primary', onClick: async () => { try { await G.signIn({ renew: G.wasSignedIn() }); refreshAll(true); } catch (e) { try { await G.signIn(); refreshAll(true); } catch (e2) { toast(e2.message, 'err'); } } } }, 'Reconnect'));
}
function backBar() {
  if (!rt.fromCitrus) return null;
  return h('div', { class: 'back-bar' }, h('a', { class: 'btn sm ghost', href: `${CITRUS_URL}?from=autolime` }, '← Citrus'), h('button', { class: 'btn sm ghost', 'aria-label': 'Hide', onClick: () => { rt.fromCitrus = false; try { sessionStorage.removeItem('autolime.fromCitrus'); } catch {} render(); } }, '✕'));
}

const VIEWS = ['dash', 'service', 'fuel', 'papers', 'trip', 'garage', 'more'];
const VIEW_NAMES = { dash: 'Dash', service: 'Service', fuel: 'Fuel & money', papers: 'Papers', trip: 'Road trip', garage: 'Garage', more: 'Settings' };
function applyTabs(c) {
  const nav = document.querySelector('nav.tabs'); if (!nav) return;
  for (const id of c.tabs.order) { const b = nav.querySelector(`button[data-view="${id}"]`); if (b) nav.insertBefore(b, nav.querySelector('button[data-view="more"]')); }
  for (const b of nav.querySelectorAll('button[data-view]')) b.hidden = c.tabs.hidden.includes(b.dataset.view);
  nav.style.setProperty('--tabs', String(CZ.TABS.length - c.tabs.hidden.length));
  // a dot on Service and Papers when something there is overdue or due
  const s = S(), car = currentCar(s), now = new Date(), al = car ? L.carAlerts(s, now).filter(a => a.car.id === car.id || a.driver) : [];
  const dot = (view, list) => { const b = nav.querySelector(`button[data-view="${view}"]`); if (!b) return; b.querySelector('.tab-dot')?.remove(); if (list.length) b.append(h('span', { class: `tab-dot ${list.some(a => a.days < 0 || (a.kmLeft != null && a.kmLeft < 0)) ? 'late' : ''}`, 'aria-hidden': 'true' })); };
  dot('service', al.filter(a => a.care)); dot('papers', al.filter(a => !a.care));
}
function go(view, part) {
  if (view === 'garage' && part) garagePart(part);
  show(view);
}
function show(view) {
  if (!VIEWS.includes(view)) view = 'dash';
  document.documentElement.dataset.view = view; rt.view = view;
  for (const s of document.querySelectorAll('section.view')) s.classList.toggle('active', s.id === `view-${view}`);
  for (const b of document.querySelectorAll('nav.tabs button')) { b.classList.toggle('active', b.dataset.view === view); if (b.dataset.view === view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
  history.replaceState(null, '', `#${view}`);
  render(); window.scrollTo(0, 0);
}
function render() {
  applyTabs(CZ.custom(S()));
  const fn = { dash: renderDash, service: renderService, fuel: renderFuel, papers: renderPapers, trip: renderTrip, garage: renderGarage, more: renderMore }[rt.view] || renderDash;
  const el = $(`#view-${rt.view}`); if (!el) return;
  const y = window.scrollY, focusCode = document.activeElement?.classList?.contains('code-in');
  let body; try { body = fn(); } catch (e) { console.error(e); body = crashCard(e); }
  el.replaceChildren(...[backBar(), authBanner(), body].flat(Infinity).filter(Boolean));
  if (!el.querySelector('h1')) el.prepend(h('h1', { class: 'sr-only' }, VIEW_NAMES[rt.view] || 'Autolime'));
  if (focusCode) el.querySelector('.code-in')?.focus();
  if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
  const pt = document.getElementById('pageTitle'), d = new Date(); if (pt) pt.textContent = `${DAY_NAMES[d.getDay()].slice(0, 3)} ${d.getDate()} ${MONTHS[d.getMonth()].slice(0, 3)}`;
}
function crashCard(e) {
  return h('div', { class: 'card warn' }, h('div', { class: 'title' }, 'This screen hit a problem'), h('div', { class: 'small' }, 'Your data is safe. Try another tab, sync, or download a backup and tell Claude what you tapped.'),
    h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, String(e?.message || e).slice(0, 160)),
    h('div', { class: 'row wrap', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onClick: () => location.reload() }, 'Reload'), h('button', { class: 'btn sm', onClick: downloadBackup }, '⬇ Backup')));
}

// Interfaces: Clean / Paper / Arcade + text size, chosen per device (never synced); index.html applies them before first paint.
const UI_KEY = 'autolime.ui';
function getUi() { let u = {}; try { u = JSON.parse(localStorage.getItem(UI_KEY) || '{}') || {}; } catch {} if (!u.ui) u.ui = 'clean'; if (!u.size) u.size = 'normal'; return u; }
function setUi(patch) { const u = { ...getUi(), ...patch }; try { localStorage.setItem(UI_KEY, JSON.stringify(u)); } catch {} applyTheme(); render(); }
function applyTheme() { const u = getUi(), r = document.documentElement; r.dataset.ui = u.ui; r.dataset.size = u.size; r.dataset.theme = u.ui === 'paper' ? 'light' : 'dark'; const m = document.querySelector('meta[name=theme-color]'); if (m) m.content = u.ui === 'paper' ? '#f3f1e8' : u.ui === 'arcade' ? '#12141f' : '#0d0f0e'; }

// ---------------- sync ----------------
function renderSync() {
  const dot = $('#syncDot'), txt = $('#syncText'), signed = G.isSignedIn();
  dot.className = 'sync ' + (rt.syncing ? 'busy' : signed && rt.online ? 'on' : '');
  txt.textContent = !rt.online ? 'offline' : rt.syncing ? 'syncing…' : '';
}
let saveTimer = null, saving = null;
function scheduleRemoteSave() {
  if (!G.wasSignedIn()) return;
  rt.saveDirty = true; clearTimeout(saveTimer);
  if (!G.isSignedIn() || !rt.online) return;
  saveTimer = setTimeout(() => saveStateNow().catch(e => console.warn('remote save failed', e.message)), 2500);
}
function flushRemoteSave() { if (rt.saveDirty && G.isSignedIn() && rt.online) { clearTimeout(saveTimer); saveStateNow().catch(() => {}); } }
async function saveStateNow() {
  if (saving) { await saving.catch(() => {}); if (!rt.saveDirty) return; }
  saving = (async () => {
    const root = S().settings.driveFolder; rt.saveDirty = false;
    if (store.needsMerge()) await pullState(true);
    try { await G.saveRemoteState(root, stripForRemote(S())); }
    catch (e) {
      if (!e.conflict) { rt.saveDirty = true; throw e; }
      await pullState(true);
      try { await G.saveRemoteState(root, stripForRemote(S()), { force: true }); } catch (e2) { rt.saveDirty = true; throw e2; }
    }
    rt.lastSave = Date.now();
  })().finally(() => { saving = null; });
  return saving;
}
function stripForRemote(s) { const { outbox, google, ...rest } = s; return rest; }
const comparable = (s) => G.fingerprint(stripForRemote(s || {}), ['updatedAt']);
async function pullState(fromConflict = false) {
  const remote = await G.loadRemoteState(S().settings.driveFolder);
  if (!remote) { store.merged(); scheduleRemoteSave(); return false; }
  if (typeof remote !== 'object' || (remote.app && remote.app !== 'autolime')) throw new Error('state.json on Drive is not Autolime’s — kept your copy');
  const force = fromConflict || store.needsMerge(); store.merged();
  if ((!force && (remote.updatedAt || 0) === (S().updatedAt || 0)) || comparable(remote) === comparable(S())) return false;
  const merged = mergeStates(S(), remote);
  merged.updatedAt = Math.max(S().updatedAt || 0, remote.updatedAt || 0) + (comparable({ ...merged, updatedAt: 0 }) !== comparable({ ...remote, updatedAt: 0 }) ? 1 : 0);
  store.replaceState(merged);
  if (comparable(merged) !== comparable(remote)) { if (fromConflict) rt.saveDirty = true; else scheduleRemoteSave(); }
  return true;
}
const WATCH_KEY = 'autolime.drive.watch';
function loadWatch() { try { const w = JSON.parse(localStorage.getItem(WATCH_KEY) || 'null'); return w && w.root === S().settings.driveFolder ? w : null; } catch { return null; } }
function saveWatch(w) { try { w ? localStorage.setItem(WATCH_KEY, JSON.stringify(w)) : localStorage.removeItem(WATCH_KEY); } catch {} }
/** setup.json in Autolime's own Drive folder (left there by Claude) → the "Add your car?" sheet. */
async function checkSetup(manual) {
  if (manual && !G.isSignedIn()) { toast('Sign in to Google first (Settings)'); return; }
  let f = null;
  try { f = await G.readSetupFile(S().settings.driveFolder); } catch (e) { if (manual) toast(`Couldn’t look on Drive: ${e.message}`, 'err'); else throw e; return; }
  if (!f) { if (manual) toast('No car setup file on Drive right now'); return; }
  if (!manual && rt.setupSeen === f.id) return;
  rt.setupSeen = f.id;
  setTimeout(() => { go('dash'); SH.setupSheet(f.data, { onAdded: () => G.binSetupFile(f.id).catch(e => console.warn('setup bin', e.message)) }); }, manual ? 0 : 300);
}
async function refreshAll(manual, { full = false } = {}) {
  if (!rt.online) { if (manual) toast('Offline — Autolime syncs when you are back online'); return; }
  if (!G.isSignedIn()) { if (manual) toast(G.wasSignedIn() ? 'Google needs a tap to reconnect' : 'Sign in to Google in Settings'); render(); return; }
  if (rt.syncing) { if (manual) toast('Already syncing…'); return; }
  rt.syncing = true; renderSync();
  const root = S().settings.driveFolder, problems = [];
  const step = async (label, fn) => { try { await fn(); } catch (e) { problems.push(`${label}: ${e.message}`); } };
  const t0 = performance.now();
  try {
    let watch = loadWatch(), plan = null, newToken = '';
    const stale = !watch?.token || Date.now() - (watch.fullAt || 0) > 12 * 3600000;
    if (!full && !manual && !stale) {
      try { const ch = await G.changesSince(watch.token); if (ch) { newToken = ch.token; plan = classifyChanges(ch.changes, watch); if (ch.more) plan = null; } }
      catch (e) { if (e.auth) throw e; }
    }
    if (!plan) { G.reverify(); newToken = await G.startToken().catch(() => ''); plan = { full: true, state: true, hub: true }; }
    if (!G.seenStateRev() && !rt.stateLoaded) plan.state = true;
    rt.syncMode = plan.full ? 'full' : plan.state || plan.hub ? 'changes' : 'nothing new';
    if (plan.state) await step('state', async () => { await pullState(); rt.stateLoaded = true; });
    if (plan.full || plan.setup || !rt.setupChecked) await step('setup', async () => { rt.setupChecked = true; await checkSetup(false); });
    await Promise.all([
      step('account', async () => { if (!S().google.email) { const u = await G.userInfo(); store.update(s => ({ ...s, google: { ...s.google, email: u.email } }), { remote: false, silent: true }); } }),
      plan.hub || !rt.hub.at ? step('hub', () => syncHub()) : null,
      step('photos', flushPhotos),
    ]);
    if (rt.saveDirty) await step('save', saveStateNow);
    if (!problems.length && newToken) {
      const next = { ...(watch || {}), root, token: newToken };
      if (plan.full) Object.assign(next, await G.watchedFolders(root).catch(() => ({})), { fullAt: Date.now() });
      saveWatch(next);
    }
    if (!problems.length) G.backupDaily(root, stripForRemote(S()), keyOf(new Date())).catch(e => console.warn('backup', e.message));
    await step('publish', publish);
    store.update(s => ({ ...s, google: { ...s.google, lastSync: Date.now() } }), { remote: false, silent: true });
    rt.lastProblems = problems; rt.lastSyncMs = Math.round(performance.now() - t0);
    if (manual) toast(problems.length ? 'Synced with issues — see Settings › Diagnostics' : 'Synced', problems.length ? 'err' : 'ok');
  } catch (e) { rt.lastProblems = [e.message]; if (manual) toast(e.message, 'err'); }
  finally { rt.syncing = false; renderSync(); render(); }
}
const TAG_WATCH = { autolime: 'me', mandarin: 'mandarin', citrus: 'citrus' };
function classifyChanges(changes, w) {
  const plan = { state: false, hub: false };
  for (const c of changes) {
    if (c.id === w.me && (c.removed || c.trashed || !(c.parents || []).length)) { G.forgetFolders(); return null; }
    const par = c.parents || [];
    if (par.includes(w.me) && c.name === 'setup.json' && !c.trashed && !c.removed) plan.setup = true;
    if (par.includes(w.me) && c.name === 'state.json' && (c.props?.rev || '') !== G.seenStateRev()) plan.state = true;
    if (w.mandarin && par.includes(w.mandarin) && c.name === 'shifts.json') plan.hub = true;
    const tag = c.mimeType === 'application/vnd.google-apps.folder' && !c.trashed && !c.removed ? c.props?.citrusApp : '';
    if (tag && TAG_WATCH[tag] && c.id !== w[TAG_WATCH[tag]]) { G.forgetApp(tag); return null; }
  }
  return plan;
}

// ---------------- the hub ----------------
const HUB_KEY = 'autolime.hub';
function loadHubCache() { try { const j = JSON.parse(localStorage.getItem(HUB_KEY) || 'null'); if (j && typeof j === 'object') rt.hub = { ...rt.hub, ...j }; } catch {} }
function saveHubCache() { try { localStorage.setItem(HUB_KEY, JSON.stringify(rt.hub)); } catch {} }
/** Mandarin's shifts.json (days off for the service, shifts during a trip) and, until the car came over, Calamansi's state once. Read only. */
async function syncHub() {
  const root = S().settings.driveFolder;
  const sh = await G.readOtherFile(root, 'mandarin', 'shifts.json').catch(() => null);
  if (sh?.data) { if (R.set(sh.data)) { rt.hub.shiftsAt = sh.modifiedTime || ''; rt.hub.shiftsError = ''; } else rt.hub.shiftsError = 'Mandarin’s shifts.json could not be read'; }
  else rt.hub.shiftsError = 'Mandarin has not published shifts.json yet';
  rt.hub.at = Date.now();
  if (!S().migrated) { const cal = await G.readOtherFile(root, 'calamansi', 'state.json').catch(() => null); if (cal?.data && !S().migrated) offerMigration(cal.data, 'Calamansi on Drive'); }
  saveHubCache();
}
let migrationOffered = false;
function offerMigration(cal, source) {
  const { counts } = MIG.carPart(cal); if (!counts.cars && !counts.driver) { if (source !== 'Calamansi on Drive') toast(`No car in ${source}`); return; } if (migrationOffered) return;
  migrationOffered = true;
  setTimeout(() => {
    const { close } = sheet([h('h2', {}, 'Bring your car over from Calamansi?'),
      h('p', { class: 'small' }, `Found in ${source}: ${MIG.describe(counts)}.`),
      h('p', { class: 'small muted' }, 'Autolime copies them and owns them from now on; nothing is deleted in Calamansi. A car already here keeps whichever copy was edited last. A copy of your Autolime data as it is now is kept on Drive first, and you can Undo.'),
      h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => { close(); runMigration(cal); } }, 'Bring it over'), h('button', { class: 'btn ghost', onClick: () => { close(); store.update(s => ({ ...s, migrated: { from: 'skipped', at: Date.now(), counts: {} } })); toast('Skipped. You can do it later in Settings › Backup and data.'); } }, 'Not now'))]);
  }, 300);
}
function backupBefore(what) { if (G.isSignedIn()) G.backupBefore(S().settings.driveFolder, stripForRemote(S()), what).catch(e => console.warn('backup before', e.message)); }
function runMigration(cal) {
  const before = S(), r = MIG.applyMigration(before, cal);
  if (!r.changed) { toast('No car found'); return; }
  backupBefore('migration');
  try { store.replaceState(r.state, { bump: true }); smokeRender(); }
  catch (e) { console.warn(e); store.replaceState(before, { bump: true, exact: S() }); toast(`That copy would break the app (${String(e.message).slice(0, 60)}). Nothing was changed.`, 'err'); return; }
  go('dash'); toast(`Brought over: ${MIG.describe(r.counts)}`, 'ok', { action: { label: 'Undo', run: () => { store.replaceState(before, { bump: true, exact: S() }); render(); toast('Undone: back to before'); } } });
}
async function migrateNow() {
  if (!G.isSignedIn()) { show('more'); return toast('Sign in with Google first, then tap it again', 'err'); }
  try { const c = await G.readOtherFile(S().settings.driveFolder, 'calamansi', 'state.json'); if (!c?.data) return toast('No Calamansi data found on Drive'); migrationOffered = false; offerMigration(c.data, 'Calamansi on Drive'); }
  catch (e) { toast(e.message, 'err'); }
}
let pubTimer = null;
function publishSoon() { clearTimeout(pubTimer); if (!G.isSignedIn() || !rt.online) return; pubTimer = setTimeout(() => publish().catch(e => console.warn('publish', e.message)), 4000); }
async function publish() {
  if (!G.isSignedIn() || !rt.online) return;
  await G.writeOwnFile(S().settings.driveFolder, 'status.json', HUB.buildStatus(S(), new Date()), { omit: ['updatedAt'] });
  rt.publishedAt = Date.now();
}

// ---------------- calendar: the planned service day ----------------
/** Put the planned service in Google Calendar (09:00–12:00, a reminder the evening before), replacing an older one. */
async function calendarForPlan(carId, plan, prev = null) {
  const s = S(), c = s.cars?.[carId]; if (!c) return;
  const was = prev || c.plan, old = was?.eventId ? { id: was.eventId, cal: was.calendarId || 'primary' } : null;
  if (!plan && !old) return;
  const calId = s.settings.planCalendarId || 'primary';
  if (old) await G.deleteEvent(old.cal, old.id).catch(() => {});
  if (!plan?.date) { if (old) store.update(st => ({ ...st, cars: { ...st.cars, [carId]: { ...st.cars[carId], plan: st.cars[carId].plan ? { ...st.cars[carId].plan, eventId: '', calendarId: '' } : null, at: Date.now() } } })); return; }
  const start = fromKey(plan.date); start.setHours(9, 0, 0, 0); const end = new Date(start); end.setHours(12);
  const shop = s.workshops?.[plan.shop];
  const ev = await G.createEvent(calId, { title: `🔧 ${c.name}: service (${plan.items.length} items)`, start, end, location: shop?.area || '', description: [`Autolime planned service${shop ? ` at ${shop.name}` : ''}.`, '', ...plan.items.map(i => `• ${CC.ITEMS[i]?.label} — ${CC.ITEMS[i]?.ar}`), '', `${HUB.SITE_URL}?do=service`].join('\n'), tag: 'service', key: `svc-${carId}-${plan.date}`, reminders: [15 * 60, 60] });
  store.update(st => { const car = st.cars?.[carId]; if (!car?.plan) return st; return L.saveCar(st, { ...car, plan: { ...car.plan, eventId: ev.id, calendarId: calId } }); });
  toast('In your calendar', 'ok');
}

// ---------------- photos ----------------
/** Take or pick a photo, shrink it, keep it on this device, and (by default) save its record; it uploads on the next sync. */
function takePhoto({ kind, car = '', note = '', item = '', save = true } = {}) {
  return new Promise((resolve) => {
    const inp = h('input', { type: 'file', accept: 'image/*', capture: kind === 'accident' || kind === 'sticker' || kind === 'part' ? 'environment' : null, style: { display: 'none' } });
    inp.addEventListener('change', async () => {
      const f = inp.files?.[0]; inp.remove(); if (!f) return resolve(null);
      try {
        const blob = await PH.shrink(f), id = 'p' + uid(), date = keyOf(new Date());
        await PH.putLocal(id, blob);
        const rec = { id, car, kind, file: '', name: `${kind}-${date}-${id.slice(1, 7)}.jpg`, date, note, item };
        if (save) { store.update(s => PH.savePhoto(s, rec)); toast(`${PH.kindOf(kind)[1]} photo saved${G.isSignedIn() ? '' : ' on this phone (goes to Drive once you sign in)'}`, 'ok'); }
        resolve(rec); flushPhotos().catch(e => console.warn('photos', e.message));
      } catch (e) { toast(`Couldn’t keep that photo: ${e.message}`, 'err'); resolve(null); }
    });
    document.body.append(inp); inp.click();
    setTimeout(() => { if (inp.isConnected && !inp.files?.length) { /* still choosing: leave it */ } }, 0);
  });
}
let photoFlight = null;
function flushPhotos() {
  if (!G.isSignedIn() || !rt.online) return Promise.resolve(0);
  if (!photoFlight) photoFlight = PH.flush(S(), (kind, name, blob, props) => G.uploadPhoto(S().settings.driveFolder, kind, name, blob, props), (pid, fileId) => store.update(s => s.photos?.[pid] ? { ...s, photos: { ...s.photos, [pid]: { ...s.photos[pid], file: fileId, at: Date.now() } } } : s)).finally(() => { photoFlight = null; });
  return photoFlight;
}
const photoUrl = (p) => PH.urlOf(p, G.isSignedIn() ? (id) => G.photoBlob(id) : null);
/** A removed photo goes to Drive's bin after the Undo window, unless it came back. */
function binPhoto(p) { setTimeout(() => { if (!S().photos?.[p.id]) { PH.dropLocal(p.id); if (p.file && G.isSignedIn()) G.binPhoto(p.file).catch(() => {}); } }, 8000); }

// ---------------- sheets ----------------
const topSheet = () => [...document.querySelectorAll('.sheet-bg, body > .search')].pop() || null;
const sheetOpeners = new WeakMap();
function sheet(content) {
  const opener = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
  const bg = h('div', { class: 'sheet-bg', onClick: (e) => { if (e.target === bg) close(); } });
  const x = h('button', { class: 'sheet-x', type: 'button', 'aria-label': 'Close', title: 'Close (Esc)', onClick: () => { if (topSheet() === bg) closeTopSheet(); else close(); } }, '✕');
  const box = h('div', { class: 'sheet', role: 'dialog', 'aria-modal': 'true', tabindex: '-1' }, h('div', { class: 'handle' }), x, ...[content].flat());
  const title = box.querySelector('h2'); if (title) { title.id ||= 'sh-' + uid(); box.setAttribute('aria-labelledby', title.id); } else box.setAttribute('aria-label', 'Details');
  box.addEventListener('input', (e) => { if (e.target.matches?.('textarea, input:not([type=checkbox]):not([type=radio]):not([type=file])')) bg.dataset.dirty = '1'; });
  bg.append(box); document.body.append(bg); sheetOpeners.set(bg, opener);
  const close = () => bg.remove();
  queueMicrotask(() => { if (!bg.isConnected || box.contains(document.activeElement)) return; const f = box.querySelector('input:not([type=hidden]):not([type=file]):not([type=checkbox]):not([data-nofocus]), textarea, select'); (f && !matchMedia('(hover: none)').matches ? f : box).focus({ preventScroll: true }); });
  return { close, box };
}
function closeTopSheet() {
  const bg = topSheet(); if (!bg) return false;
  if (bg.dataset.dirty && !bg.dataset.warned) { bg.dataset.warned = '1'; toast('Unsaved changes: press Esc again to discard'); setTimeout(() => { delete bg.dataset.warned; }, 4000); return true; }
  bg.remove(); return true;
}
function shortcutsSheet() {
  const rows = [['1 – 6', 'Dash, Service, Fuel, Papers, Trip, Garage'], [',', 'Settings'], ['/', 'Search'], ['s', 'Log a service'], ['f', 'Fill-up'], ['w', 'The workshop list'], ['c', 'Engine-light codes'], ['!', 'Accident card'], ['r', 'Sync now'], ['Esc', 'Close the top sheet'], ['?', 'This list']];
  sheet([h('h2', {}, 'Keyboard shortcuts'), h('div', { class: 'kv keys' }, rows.flatMap(([k, v]) => [h('kbd', {}, k), h('span', {}, v)]))]);
}
let sheetGuard = false, sheetSelfBack = false, lastSheetClose = 0;
document.addEventListener('click', (e) => { if (Date.now() - lastSheetClose < 280 && !e.target.closest?.('.sheet, .toast')) { e.preventDefault(); e.stopPropagation(); } }, true);
function watchSheets() {
  new MutationObserver((muts) => {
    const removed = muts.flatMap(m => [...m.removedNodes]).filter(n => n.classList?.contains('sheet-bg') || n.classList?.contains('search')), open = document.querySelectorAll('.sheet-bg, body > .search').length;
    if (removed.length) lastSheetClose = Date.now();
    for (const bg of removed) { const o = sheetOpeners.get(bg); if (o?.isConnected && !topSheet()) o.focus({ preventScroll: true }); }
    if (open && !sheetGuard) { history.pushState({ aSheet: 1 }, '', location.href); sheetGuard = true; }
    else if (!open && sheetGuard && !sheetSelfBack && history.state?.aSheet) { sheetSelfBack = true; history.back(); }
  }).observe(document.body, { childList: true });
  addEventListener('popstate', () => {
    if (sheetSelfBack) { sheetSelfBack = false; sheetGuard = false; if (topSheet()) { history.pushState({ aSheet: 1 }, '', location.href); sheetGuard = true; } return; }
    sheetGuard = false; const bg = topSheet(); if (bg) { bg.remove(); if (topSheet()) { history.pushState({ aSheet: 1 }, '', location.href); sheetGuard = true; } }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return; const bg = topSheet(); if (!bg) return;
    const f = [...bg.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter(x => x.offsetParent !== null || x === document.activeElement);
    if (!f.length) { e.preventDefault(); return; }
    const i = f.indexOf(document.activeElement);
    if (!bg.contains(document.activeElement) || (e.shiftKey && i <= 0) || (!e.shiftKey && i === f.length - 1)) { e.preventDefault(); (e.shiftKey ? f[f.length - 1] : f[0]).focus(); }
  });
}

// ---------------- search: parts, codes, noises, workshops, anatomy ----------------
function openSearch() {
  if (document.querySelector('.search')) return;
  const s = S(), c = currentCar(s), all = [];
  if (c?.model) for (const id of CC.ITEM_ORDER) { const d = CC.ITEMS[id]; all.push({ name: `${d.icon} ${d.label}`, sub: `part · ${d.ar}`, open: () => SH.itemSheet(c, id) }); }
  for (const code of Object.values(OBD.CODES)) all.push({ name: `🟠 ${code.code}`, sub: `code · ${code.title}`, open: () => { go('garage', 'codes'); } , code: code.code });
  for (const x of NZ.SYMPTOMS) all.push({ name: `${x.icon} ${x.title}`, sub: `noise or feeling · ${x.ar}`, open: () => go('garage', 'noises') });
  for (const w of GA.shopList(s)) all.push({ name: `🔧 ${w.name}`, sub: `workshop · ${w.area}`, open: () => go('garage', 'shops') });
  for (const p of AN.PARTS) all.push({ name: `${p.icon} ${p.name}`, sub: `anatomy · ${p.ar}`, open: () => partSheet(p) });
  let sel = 0, hits = [];
  const list = h('div', { class: 'res' });
  const paint = (q) => {
    const qq = q.trim().toLowerCase();
    hits = qq ? all.filter(x => x.name.toLowerCase().includes(qq) || x.sub.toLowerCase().includes(qq)).slice(0, 30) : all.slice(0, 10); sel = 0;
    list.replaceChildren(...(hits.length ? hits.map((x, i) => h('button', { class: `item ${i === sel ? 'hl' : ''}`, onClick: () => { box.remove(); x.open(); } }, h('span', { class: 'im' }, h('span', { class: 'in' }, x.name), h('span', { class: 'id' }, x.sub.slice(0, 90))))) : [h('div', { class: 'empty small' }, 'Nothing found')]));
  };
  const inp = h('input', { type: 'search', placeholder: 'Search parts, codes, noises, workshops', onInput: (e) => paint(e.target.value), onKeydown: (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { sel = Math.max(0, Math.min(hits.length - 1, sel + (e.key === 'ArrowDown' ? 1 : -1))); [...list.children].forEach((ch, i) => ch.classList.toggle('hl', i === sel)); e.preventDefault(); }
    else if (e.key === 'Enter' && hits[sel]) { box.remove(); hits[sel].open(); }
  } });
  const box = h('div', { class: 'search', onClick: (e) => { if (e.target === box) box.remove(); } }, h('div', { class: 'box', role: 'dialog', 'aria-label': 'Search' }, inp, list));
  document.body.append(box); paint(''); setTimeout(() => inp.focus(), 30);
}

// ---------------- backups, restore ----------------
async function backupsSheet() {
  let list = [];
  try { list = await G.listBackups(S().settings.driveFolder); } catch (e) { return toast(e.message, 'err'); }
  const { close } = sheet([h('h2', {}, 'Restore a daily backup'),
    h('p', { class: 'small muted' }, 'Autolime keeps one snapshot of your cars, workshops, quotes and photo records per day on Drive (Car - Autolime › backups, newest 14). Photos themselves stay in their folder.'),
    list.length ? h('div', { class: 'rows' }, ...list.map(b => h('div', { class: 'item', style: { cursor: 'default' } }, h('span', { class: 'im' }, h('span', { class: 'in' }, b.name.replace(/^state-|\.json$/g, '')), h('span', { class: 'id' }, `${Math.max(1, Math.round(b.size / 1024))} KB`)),
      h('button', { class: 'btn sm', onClick: async () => { try { const j = await G.readBackup(b.id); close(); restoreSheet(j, { source: `Drive backup ${b.name}` }); } catch (e) { toast(e.message, 'err'); } } }, 'Restore')))) : h('div', { class: 'muted small' }, 'No backups yet — the first is made after today’s sync.')]);
}
const PRE_KEY = 'autolime.preRestore';
function preRestore() { if (rt.preRestore) return rt.preRestore; try { return JSON.parse(localStorage.getItem(PRE_KEY) || 'null'); } catch { return null; } }
function keepPreRestore() { const snap = { at: Date.now(), state: S() }; rt.preRestore = snap; try { localStorage.setItem(PRE_KEY, JSON.stringify(snap)); return true; } catch { return false; } }
function dropPreRestore() { rt.preRestore = null; try { localStorage.removeItem(PRE_KEY); } catch {} }
function smokeRender() { for (const fn of [renderDash, renderService, renderFuel, renderPapers, renderTrip, renderGarage]) fn(); HUB.buildStatus(S(), new Date()); }
const when = (t) => t ? new Date(t).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'unknown date';
function restoreSheet(json, { source = 'Backup file' } = {}) {
  const chk = checkBackup(json); if (!chk.ok) { toast(`${source}: ${chk.error}`, 'err'); return; }
  const sm = chk.summary, cur = checkBackup({ ...S(), app: 'autolime' }).summary;
  const kv = (rows) => h('div', { class: 'kv' }, ...rows.flatMap(([a, b]) => [h('b', {}, a), h('span', {}, b)]));
  const { close } = sheet([h('h2', {}, 'Restore this backup?'), h('div', { class: 'small muted', style: { marginBottom: '10px' } }, source),
    h('div', { class: 'grid2' }, h('div', { class: 'card' }, h('div', { class: 'title' }, 'In the backup'), kv([['Saved', when(sm.savedAt)], ['Holds', describeCounts(sm.counts)]])), h('div', { class: 'card' }, h('div', { class: 'title' }, 'On this device'), kv([['Saved', when(S().updatedAt)], ['Holds', describeCounts(cur?.counts)]]))),
    chk.dropped.length ? h('div', { class: 'note warn' }, `Left out: ${chk.dropped.slice(0, 8).join(' · ')}`) : null,
    h('p', { class: 'small muted' }, 'Replace puts the backup in place of everything here, then on your other devices. Merge keeps both: for each record the newest edit wins. Either way a copy of your data as it is now is kept, so you can undo.'),
    h('div', { class: 'row wrap' }, h('button', { class: 'btn danger grow', onClick: () => { close(); applyRestore(chk.state, { merge: false }); } }, 'Replace everything'), h('button', { class: 'btn primary grow', onClick: () => { close(); applyRestore(chk.state, { merge: true }); } }, 'Merge into mine'), h('button', { class: 'btn ghost', onClick: () => close() }, 'Cancel'))]);
}
function applyRestore(next, { merge = false } = {}) {
  const before = S(), kept = keepPreRestore();
  backupBefore(merge ? 'merge' : 'restore');
  const target = merge ? { ...mergeStates(before, next), updatedAt: Math.max(before.updatedAt || 0, next.updatedAt || 0) } : { ...next, outbox: before.outbox, google: before.google };
  try { store.replaceState(target); smokeRender(); }
  catch (e) { console.warn('restore rolled back', e); store.replaceState(before); dropPreRestore(); render(); toast(`That backup would break the app (${String(e.message).slice(0, 60)}). Nothing was changed.`, 'err'); return false; }
  store.replaceState(S(), { bump: true, exact: merge ? null : before });
  render(); toast(`${merge ? 'Merged' : 'Restored'}${kept ? '' : ' (undo copy kept until you close the app)'}`, 'ok', { action: { label: 'Undo', run: undoRestore } });
  return true;
}
function undoRestore() { const snap = preRestore(); if (!snap?.state) { toast('Nothing to undo'); return; } store.replaceState(snap.state, { bump: true, exact: S() }); dropPreRestore(); render(); toast(`Back to your data from ${when(snap.at)}`, 'ok'); }

// ---------------- SETTINGS ----------------
function customiseCard() {
  const c = CZ.custom(S()), set = (part, patch) => store.update(s => CZ.setCustom(s, part, patch));
  const chip = (on, label, onClick) => h('button', { class: `chip ${on ? 'sel' : ''}`, 'aria-pressed': on ? 'true' : 'false', onClick }, label);
  const sec = (title, sub, open, ...kids) => h('details', { class: 'cz-sec', open }, h('summary', {}, h('b', {}, title), h('small', {}, sub)), ...kids);
  return h('div', { class: 'card' }, h('div', { class: 'title' }, 'Customise'), h('div', { class: 'tiny dim' }, 'Synced to all your devices.'),
    sec('Look', 'accent, spacing, motion, celebrations', true,
      h('div', { class: 'cz-accents', role: 'radiogroup', 'aria-label': 'Accent colour' }, CZ.ACCENTS.map(([id, l, hex]) => h('button', { class: `cz-acc ${c.look.accent === id ? 'sel' : ''}`, role: 'radio', 'aria-checked': String(c.look.accent === id), style: { '--c': hex }, onClick: () => set('look', { accent: id }) }, h('i'), l))),
      h('div', { class: 'cz-row' }, h('span', { class: 'grow small' }, 'Spacing'), h('div', { class: 'seg' }, [['comfy', 'Comfy'], ['compact', 'Compact']].map(([k, l]) => h('button', { class: c.look.density === k ? 'active' : '', onClick: () => set('look', { density: k }) }, l)))),
      h('div', { class: 'cz-row' }, h('span', { class: 'grow small' }, 'Moving needles and rollers'), chip(c.look.motion, c.look.motion ? 'On' : 'Off', () => set('look', { motion: !c.look.motion }))),
      h('div', { class: 'cz-row' }, h('span', { class: 'grow small' }, 'Confetti when you finish a service'), chip(c.look.fun, c.look.fun ? 'On' : 'Off', () => set('look', { fun: !c.look.fun })))),
    sec('The car', 'tank size for the trip fuel stops', false, h('div', { class: 'cz-row' }, h('span', { class: 'grow small' }, 'Fuel tank (litres)'), h('input', { type: 'number', min: 30, max: 150, value: c.car.tank, style: { maxWidth: '100px' }, 'aria-label': 'Fuel tank', onChange: (e) => set('car', { tank: +e.target.value }) }))),
    sec('Tabs', 'order, hide, start tab', false, ...c.tabs.order.map((id, i) => { const lab = CZ.TABS.find(t => t[0] === id)[1], hidden = c.tabs.hidden.includes(id);
      return h('div', { class: 'cz-row' }, h('span', { class: 'grow' }, lab), h('button', { class: 'btn sm ghost', 'aria-label': `Move ${lab} up`, disabled: i === 0, onClick: () => set('tabs', { order: CZ.move(c.tabs.order, id, -1) }) }, '↑'), h('button', { class: 'btn sm ghost', 'aria-label': `Move ${lab} down`, disabled: i === c.tabs.order.length - 1, onClick: () => set('tabs', { order: CZ.move(c.tabs.order, id, 1) }) }, '↓'), id === 'dash' ? h('span', { class: 'tiny dim' }, 'always') : chip(!hidden, hidden ? 'Hidden' : 'Shown', () => set('tabs', { hidden: CZ.toggleIn(c.tabs.hidden, id) }))); }),
      h('div', { class: 'cz-row' }, h('span', { class: 'grow small' }, 'Open on'), h('select', { 'aria-label': 'Open on', style: { maxWidth: '160px' }, onChange: (e) => set('start', e.target.value) }, CZ.TABS.filter(([id]) => !c.tabs.hidden.includes(id)).map(([id, l]) => h('option', { value: id, selected: c.start === id }, l))))));
}
function uiPicker() {
  const u = getUi(), opt = (id, name, note) => h('button', { class: `ui-opt ${u.ui === id ? 'sel' : ''}`, 'aria-pressed': u.ui === id ? 'true' : 'false', onClick: () => setUi({ ui: id }) }, h('span', { class: `ui-thumb ui-${id}` }, h('i'), h('i'), h('i')), h('b', {}, name), h('small', {}, note));
  return h('div', { class: 'card' }, h('div', { class: 'title' }, 'Interface on this device'), h('div', { class: 'ui-opts' }, opt('clean', 'Clean', 'Carbon dashboard'), opt('paper', 'Paper', 'The workshop manual'), opt('arcade', 'Arcade', '8-bit, the family look')),
    h('div', { class: 'row', style: { marginTop: '10px' } }, h('span', { class: 'small grow' }, 'Text size'), h('div', { class: 'seg' }, [['small', 'S'], ['normal', 'M'], ['large', 'L']].map(([k, l]) => h('button', { class: u.size === k ? 'active' : '', 'aria-label': `Text size ${k}`, 'aria-pressed': String(u.size === k), onClick: () => setUi({ size: k }) }, l)))));
}
function diagnosticsCard() {
  const s = S(), n = (k) => Object.keys(s[k] || {}).length, pend = Object.values(s.photos || {}).filter(p => !p.file).length;
  const rows = [
    ['Google', G.isSignedIn() ? `signed in as ${G.accountEmail() || s.google.email || '?'}` : G.wasSignedIn() ? 'session expired — tap Reconnect' : 'not signed in'],
    ['Last sync', s.google.lastSync ? `${new Date(s.google.lastSync).toLocaleString('en-GB')}${rt.syncMode ? ` · ${rt.syncMode}` : ''}${rt.lastSyncMs ? ` · ${(rt.lastSyncMs / 1000).toFixed(1)} s` : ''}` : 'never'],
    ['Drive requests', `${G.stats.requests} sent · ${G.stats.retries} retried · ${G.stats.errors} failed · ${G.stats.skippedWrites} unchanged writes skipped`],
    ['Last Google error', G.stats.lastError || 'none'],
    ['Unsaved to Drive', rt.saveDirty ? 'yes — saves on the next sync' : 'no'],
    ['This device', `${store.persistence.ok ? 'saved' : '⚠ ' + store.persistence.lastError} · ${Math.round(store.persistence.bytes / 1024)} KB${rt.storagePersisted ? ' · protected from clean-up' : ''}`],
    ['Photos waiting to upload', String(pend)],
    ['Sync issues', (rt.lastProblems || []).length ? rt.lastProblems.join(' · ') : 'none'],
    ['Shifts from Mandarin', R.has() ? `you: ${R.meName() || 'not picked in Mandarin'} · to ${R.coverEnd() ? fmtDate(R.coverEnd()) : '?'}` : (rt.hub.shiftsError || 'not read yet')],
    ['Published to Citrus', rt.publishedAt ? `status.json at ${new Date(rt.publishedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : 'not yet this session'],
    ['Your data', `${n('cars')} car${n('cars') === 1 ? '' : 's'} · ${n('workshops')} workshops · ${n('quotes')} quotes · ${n('photos')} photos`],
    ['From Calamansi', s.migrated ? (s.migrated.from === 'skipped' ? 'skipped' : `${new Date(s.migrated.at).toLocaleDateString('en-GB')} · ${MIG.describe(s.migrated.counts || {})}`) : 'not yet'],
    ['Version', VERSION], ['Installed', window.matchMedia('(display-mode: standalone)').matches ? 'yes (home screen)' : 'browser tab'],
  ];
  return h('details', { class: 'card adv' }, h('summary', {}, 'Diagnostics'), h('div', { class: 'kv' }, ...rows.flatMap(([a, b]) => [h('b', {}, a), h('span', {}, b)])),
    h('div', { class: 'row wrap', style: { marginTop: '10px' } }, h('button', { class: 'btn sm', onClick: () => refreshAll(true, { full: true }) }, 'Full sync'), h('button', { class: 'btn sm', onClick: async () => { const regs = await navigator.serviceWorker?.getRegistrations?.() || []; for (const r of regs) await r.unregister(); const ks = await caches.keys(); for (const k of ks) await caches.delete(k); location.reload(); } }, 'Reinstall app files'), h('button', { class: 'btn sm ghost', onClick: shortcutsSheet }, 'Keyboard shortcuts')));
}
function renderMore() {
  const s = S(), signed = G.isSignedIn();
  const out = [h('h1', {}, 'Settings'), uiPicker(), customiseCard()];
  const cid = h('input', { type: 'text', value: s.settings.clientId, spellcheck: false, 'aria-label': 'OAuth client ID' });
  out.push(h('div', { class: 'card' }, h('div', { class: 'title' }, 'Google'),
    h('div', { class: 'small muted' }, 'Drive keeps Autolime in step on all your devices (Citrus › Life › Car - Autolime), holds your photos, tells Citrus how the car is doing and reads your days off from Mandarin. Calendar holds the service day.'),
    h('div', { class: 'row wrap', style: { marginTop: '8px' } },
      signed ? h('button', { class: 'btn', onClick: () => { G.signOut(); saveWatch(null); render(); } }, 'Sign out') : h('button', { class: 'btn primary', onClick: async () => { try { await G.init(cid.value.trim() || s.settings.clientId); await G.signIn({ renew: G.wasSignedIn() }).catch(() => G.signIn()); toast('Signed in', 'ok'); refreshAll(true, { full: true }); } catch (e) { toast(e.message, 'err'); } } }, G.wasSignedIn() ? 'Reconnect Google' : 'Sign in with Google'),
      signed ? h('button', { class: 'btn', onClick: () => refreshAll(true) }, '↻ Sync now') : null, signed ? h('button', { class: 'btn', onClick: backupsSheet }, '⟲ Daily backups') : null),
    signed ? h('div', { class: 'tiny muted', style: { marginTop: '8px' } }, `${s.google.email || 'signed in'}${s.google.lastSync ? ` · last sync ${new Date(s.google.lastSync).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}` : ''}`) : null,
    signed ? h('div', { class: 'field', style: { marginTop: '10px' } }, h('label', {}, 'Service days go on'), (() => { const sel = h('select', { onChange: (e) => store.update(x => ({ ...x, settings: { ...x.settings, planCalendarId: e.target.value } })) }, h('option', { value: 'primary' }, 'My main calendar')); G.listCalendars().then(cals => { for (const c of cals.filter(c => /owner|writer/.test(c.accessRole || 'owner') && !c.primary)) sel.append(h('option', { value: c.id, selected: s.settings.planCalendarId === c.id }, c.name)); }).catch(() => {}); return sel; })()) : null,
    h('details', { class: 'adv' }, h('summary', { class: 'small' }, 'Advanced'), h('div', { class: 'field' }, h('label', {}, 'OAuth client ID (the one Google Cloud client all your apps share)'), cid, h('div', { class: 'tiny dim' }, 'Only the client ID, never the secret. This site must be in the client’s “Authorised JavaScript origins”.')),
      h('button', { class: 'btn sm', onClick: async () => { store.update(x => ({ ...x, settings: { ...x.settings, clientId: cid.value.trim() } }), { remote: false }); try { await G.init(cid.value.trim()); toast('Saved', 'ok'); } catch (e) { toast(e.message, 'err'); } } }, 'Save ID'))));
  out.push(h('div', { class: 'card' }, h('div', { class: 'title' }, 'Your apps'),
    h('div', { class: 'small muted' }, 'Autolime owns the car: care, papers, the driver, fuel, trips, workshops and quotes. It writes status.json for Citrus (the car tile, the service day and the trip on Plan, renewals as dated tasks) and reads Mandarin’s shifts.json for your days off. It never writes into another app’s folder.'),
    h('div', { class: 'row wrap', style: { marginTop: '8px' } }, h('a', { class: 'btn sm', href: `${CITRUS_URL}?from=autolime`, target: '_blank', rel: 'noopener' }, '🍊 Open Citrus'), h('a', { class: 'btn sm', href: `${CALAMANSI_URL}?from=autolime`, target: '_blank', rel: 'noopener' }, '🍋 Open Calamansi'), signed ? h('button', { class: 'btn sm', onClick: () => publish().then(() => toast('Published', 'ok')).catch(e => toast(e.message, 'err')) }, 'Publish now') : null)));
  out.push(h('div', { class: 'card' }, h('div', { class: 'title' }, 'Backup and data'),
    h('div', { class: 'row wrap' },
      h('button', { class: 'btn', onClick: downloadBackup }, '⬇ Backup'),
      (() => { const inp = h('input', { type: 'file', accept: '.json,application/json', style: { display: 'none' }, onChange: async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; let j; try { j = JSON.parse(await f.text()); } catch { return toast(`${f.name} is not a backup file`, 'err'); } if (MIG.looksLikeCalamansi(j)) { migrationOffered = false; offerMigration(j, f.name); return; } restoreSheet(j, { source: f.name }); } }); return h('span', {}, inp, h('button', { class: 'btn', title: 'An Autolime backup, or a Calamansi backup to bring the car over', onClick: () => inp.click() }, '⬆ Restore or import')); })(),
      preRestore() ? h('button', { class: 'btn', onClick: undoRestore }, '↶ Undo restore') : null,
      h('button', { class: 'btn', onClick: migrateNow }, '🍋 Bring my car over from Calamansi'),
      h('button', { class: 'btn danger', onClick: eraseSheet }, 'Erase this device…')),
    h('div', { class: 'tiny dim', style: { marginTop: '10px' } }, `Autolime ${VERSION} · your data lives in this browser and your own Google Drive.`)));
  out.push(diagnosticsCard());
  return out;
}
function downloadBackup() { const blob = new Blob([store.exportJSON()], { type: 'application/json' }); const a = h('a', { href: URL.createObjectURL(blob), download: `autolime-backup-${keyOf(new Date())}.json` }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); }
const ownKeys = () => { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith('autolime.')) out.push(k); } } catch {} return out; };
function eraseSheet() {
  const signed = G.isSignedIn() || G.wasSignedIn();
  const { close } = sheet([h('h2', {}, 'Erase Autolime on this device?'),
    h('p', { class: 'small' }, `This removes Autolime's data from this browser only (${ownKeys().length} saved items) and the photos kept on this phone.`),
    h('p', { class: 'small muted' }, signed ? 'Your Google Drive copy is not touched: sign in again and the next sync brings everything back. Photos still waiting to upload would be lost.' : 'You are not using Google sync, so nothing else holds a copy: download a backup first.'),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn', onClick: downloadBackup }, '⬇ Backup first'), h('button', { class: 'btn danger grow', onClick: () => { for (const k of ownKeys()) try { localStorage.removeItem(k); } catch {} try { indexedDB.deleteDatabase('autolime.photos'); } catch {} close(); location.reload(); } }, 'Erase this device'), h('button', { class: 'btn ghost', onClick: () => close() }, 'Cancel'))]);
}

window.__autolime = { refreshAll, checkSetup, publish, saveStateNow, pullState, store, G, R, rt, VERSION, HUB };   // for the console and the tests
boot();
