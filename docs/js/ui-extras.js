// The toolbox on screen: Settings › Toolbox, the quiet "Tools for this tab" link at the end of each tab, and the cards and
// sheets of each tool. A tool that is off renders nothing anywhere; the main cards of a tab never depend on a tool.
import { h, toast, keyOf, fromKey } from './util.js';
import * as L from './car.js';
import * as CC from './carcare.js';
import * as EX from './extras.js';
import * as CZ from './custom.js';
import * as TR from './trip.js';
import * as PH from './photos.js';
import { ctx, S, field, dmy, kmT, sar, putCar, undoToast, stat, tag } from './ui-kit.js';
import { thumb } from './ui-sheets.js';

const sheet = (content, cls = '') => { const b = ctx.sheet(content); if (cls) b.box.classList.add(...cls.split(' ')); return b; };
const foot = (...btns) => h('div', { class: 'row wrap sh-foot' }, ...btns);
const cancel = (box, label = 'Cancel') => h('button', { class: 'btn ghost', onClick: () => box().close() }, label);
const num = (attrs = {}) => h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', ...attrs });
const date = (v = keyOf(new Date())) => h('input', { type: 'date', value: v, max: keyOf(new Date()) });
export const isOn = (id, s = S()) => CZ.on(s, id);
const saveX = (c, patch, msg) => { const before = S(); putCar(EX.withX(c, patch)); ctx.render(); if (msg) undoToast(msg, before); };

// ───────────────────────── the toolbox
function toolRow(t, on, onFlip) {
  return h('button', { class: `tool ${on ? 'on' : ''}`, role: 'switch', 'aria-checked': String(on), onClick: () => onFlip(!on) },
    h('span', { class: 'ti', 'aria-hidden': 'true' }, t.icon),
    h('span', { class: 'tm' }, h('span', { class: 'tn' }, t.name), h('span', { class: 'td' }, t.what)),
    h('span', { class: 'sw', 'aria-hidden': 'true' }, h('i')));
}
const flip = (id, v) => { ctx.update(s => CZ.setTools(s, { [id]: v })); ctx.render(); toast(`${EX.TOOL[id].name} ${v ? 'on' : 'off'}`, 'ok'); };
/** Settings › Toolbox: three presets and a switch for every tool, grouped by the tab it appears on. */
export function toolboxCard() {
  const on = CZ.allOn(S()), pre = EX.presetOf(on), n = Object.values(on).filter(Boolean).length;
  return h('div', { class: 'card wide', id: 'toolbox' },
    h('div', { class: 'card-h' }, h('div', { class: 'title' }, '🧰 Toolbox'), h('span', { class: 'tiny dim' }, `${n} of ${EX.TOOLS.length} on`)),
    h('div', { class: 'small muted', style: { marginBottom: '10px' } }, 'Autolime stays simple until you want more. A tool only adds a card or a field where it belongs; what is due, your papers, fuel and the trip never move. Synced to your devices.'),
    h('div', { class: 'seg', role: 'radiogroup', 'aria-label': 'Toolbox preset', style: { marginBottom: '12px' } }, EX.PRESETS.map(([id, label, sub]) => h('button', { class: pre === id ? 'active' : '', role: 'radio', 'aria-checked': String(pre === id), title: sub, onClick: () => { const before = S(); ctx.update(s => CZ.setTools(s, EX.presetMap(id), true)); ctx.render(); undoToast(`Toolbox: ${label}`, before); } }, label))),
    h('div', { class: 'tool-groups' }, Object.keys(EX.TAB_NAME).map(tab => { const ts = EX.toolsFor(tab); return ts.length ? h('div', { class: 'tool-group' }, h('div', { class: 'tool-gh' }, EX.TAB_NAME[tab]), ts.map(t => toolRow(t, on[t.id], (v) => flip(t.id, v)))) : null; })));
}
/** The quiet link at the end of a tab: which tools this tab has, and a sheet to switch them. */
export function toolsHint(tab) {
  const ts = EX.toolsFor(tab); if (!ts.length) return null;
  const on = CZ.allOn(S()), k = ts.filter(t => on[t.id]).length;
  return h('button', { class: 'tools-hint wide', onClick: () => toolsSheet(tab) }, h('span', { 'aria-hidden': 'true' }, '🧰'), ` Tools for ${EX.TAB_NAME[tab]} · ${k} of ${ts.length} on`);
}
export function toolsSheet(tab) {
  const list = h('div', { class: 'tool-group' });
  const paint = () => { const on = CZ.allOn(S()); list.replaceChildren(...EX.toolsFor(tab).map(t => toolRow(t, on[t.id], (v) => { flip(t.id, v); paint(); }))); };
  paint();
  const box = sheet([h('h2', {}, `🧰 Tools for ${EX.TAB_NAME[tab]}`), h('div', { class: 'small muted' }, 'Switch on only what you will use. You can change it any time; nothing you saved is lost when a tool is off.'), list,
    foot(h('button', { class: 'btn ghost', onClick: () => { box.close(); ctx.go('more'); setTimeout(() => document.getElementById('toolbox')?.scrollIntoView({ block: 'start' }), 60); } }, 'All tools'), h('button', { class: 'btn primary grow', onClick: () => box.close() }, 'Done'))]);
}

// ───────────────────────── dash: where I parked, worth a look
export function parkedCard(c) {
  const p = c.x?.parked;
  if (!p) return h('button', { class: 'card cta', onClick: () => parkSheet(c) }, h('span', { class: 'ic' }, '📍'), h('span', { class: 'grow' }, h('b', {}, 'I parked here'), h('span', { class: 'tiny dim' }, ' · pin, level, a photo')), h('span', { class: 'arrow' }, '+'));
  const mins = Math.round((Date.now() - p.at) / 6e4), ago = mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} d ago`;
  const ph = p.photo ? S().photos?.[p.photo] : null;
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, '📍 Parked'), h('span', { class: 'tiny dim' }, ago)),
    p.note ? h('div', { class: 'big-note' }, p.note) : null, ph ? h('div', { style: { width: '120px', margin: '6px 0' } }, thumb(ph)) : null,
    h('div', { class: 'row wrap', style: { marginTop: '8px' } },
      p.lat != null ? h('a', { class: 'btn primary', href: `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`, target: '_blank', rel: 'noopener' }, '🧭 Walk me there') : null,
      h('button', { class: 'btn', onClick: () => parkSheet(c) }, 'Parked again'), h('button', { class: 'btn ghost', onClick: () => saveX(c, { parked: null }, 'Parking spot cleared') }, 'Found it')));
}
function parkSheet(c) {
  const note = h('input', { maxlength: 80, placeholder: 'level, pillar, gate — e.g. B2 · pillar 14' }), st = h('div', { class: 'tiny dim' }, 'Finding where you are…');
  let pos = null, photo = null;
  if (navigator.geolocation) navigator.geolocation.getCurrentPosition((g) => { pos = { lat: +g.coords.latitude.toFixed(6), lon: +g.coords.longitude.toFixed(6) }; st.textContent = `📍 Got it (±${Math.round(g.coords.accuracy)} m)`; }, () => { st.textContent = 'No location (indoors or not allowed) — the note and photo still help.'; }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 });
  else st.textContent = 'This device has no location.';
  const ph = h('button', { class: 'btn', onClick: async () => { photo = await ctx.takePhoto({ kind: 'parking', car: c.id, note: 'Where I parked' }); if (photo) ph.textContent = '📷 Photo added ✓'; } }, '📷 Photo of the spot');
  const box = sheet([h('h2', {}, '📍 I parked here'), st, field('Note', note), ph,
    foot(h('button', { class: 'btn primary grow', onClick: () => { saveX(c, { parked: { at: Date.now(), lat: pos?.lat ?? null, lon: pos?.lon ?? null, note: note.value, photo: photo?.id || '' } }); box.close(); toast('Spot saved', 'ok'); } }, 'Save the spot'), cancel(() => box))]);
  setTimeout(() => note.focus(), 50);
}
export function smartCard(c) {
  const w = EX.smartWarnings(c); if (!w.length) return null;
  return h('div', { class: 'card' }, h('div', { class: 'title' }, `🧠 Worth a look · ${w.length}`), h('div', { class: 'rows' }, w.map(x => h('div', { class: `item st-${x.tone === 'late' ? 'late' : 'soon'}`, style: { cursor: 'default' } }, h('span', { class: 'ii' }, x.icon), h('span', { class: 'im' }, h('span', { class: 'in' }, x.title), h('span', { class: 'id' }, x.text))))));
}

// ───────────────────────── service: tyres, battery, warranties
export function treadCard(c) {
  const f = EX.treadForecast(c), last = [...(c.x?.tyreLog || [])].pop(), rec = EX.psiFor(c), issues = EX.pressureIssues(c);
  const cell = (w) => h('div', { class: 'wheel' }, h('span', { class: 'tiny dim' }, w), h('b', { class: 'n' }, last?.tread?.[w] != null ? `${last.tread[w]} mm` : '—'), h('span', { class: `tiny ${rec && last?.psi?.[w] && last.psi[w] < rec - 3 ? 'warn' : 'dim'}` }, last?.psi?.[w] ? `${last.psi[w]} psi` : ''));
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, '🛞 Tread and pressure'), h('button', { class: 'btn sm primary', onClick: () => treadSheet(c) }, '+ Reading')),
    last ? h('div', {}, h('div', { class: 'wheels', role: 'img', 'aria-label': `Last reading ${dmy(last.date)}` }, ['FL', 'FR', 'RL', 'RR'].map(cell)),
      h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, `Read ${dmy(last.date)}${rec ? ` · sticker pressure ${rec} psi cold` : ''}`),
      f?.legal ? h('div', { class: 'small', style: { marginTop: '6px' } }, `At ${f.perMonth} mm a month the tread reaches 1.6 mm around `, h('b', {}, dmy(f.legal)), '.') : f ? h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, 'Two readings a few weeks apart show when you’ll need new tyres.') : null,
      issues.length ? h('div', { class: 'banner warn', style: { marginTop: '8px' } }, `Add air: ${issues.join('; ')}.`) : null)
      : h('div', { class: 'small muted' }, 'A 10-riyal tread gauge and the pump at the station: note each wheel once a month, cold.'));
}
function treadSheet(c) {
  const d = date(), ins = {}; const row = (w) => { ins[w] = { t: num({ max: 12, placeholder: 'mm', 'aria-label': `${EX.WHEEL_NAME[w]} tread mm` }), p: num({ max: 80, placeholder: 'psi', 'aria-label': `${EX.WHEEL_NAME[w]} pressure psi` }) }; return h('div', { class: 'grid3' }, h('span', { class: 'small' }, EX.WHEEL_NAME[w]), ins[w].t, ins[w].p); };
  const err = h('div', { class: 'err', role: 'alert' });
  const box = sheet([h('h2', {}, '🛞 Tyre reading'), h('div', { class: 'small muted' }, 'Tread in mm (new ≈ 8, legal limit 1.6). Pressure cold, before driving.'), field('Date', d), ...['FL', 'FR', 'RL', 'RR'].map(row), err,
    foot(h('button', { class: 'btn primary grow', onClick: () => {
      const tread = {}, psi = {}; for (const [w, x] of Object.entries(ins)) { if (+x.t.value) tread[w] = +x.t.value; if (+x.p.value) psi[w] = +x.p.value; }
      if (!Object.keys(tread).length && !Object.keys(psi).length) { err.textContent = 'Type at least one number'; return; }
      saveX(c, { tyreLog: [...(c.x?.tyreLog || []), { date: d.value, tread, psi }] }, 'Tyre reading saved'); box.close(); } }, 'Save'), cancel(() => box))]);
}
export function batteryCard(c) {
  const b = EX.batteryState(c), log = (c.x?.battery || []).slice(-5).reverse();
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, '🔋 Battery'), h('button', { class: 'btn sm primary', onClick: () => batterySheet(c) }, '+ Check')),
    b ? h('div', {}, h('div', { class: 'row' }, h('b', { class: `n big st-${b.tone}` }, `${b.v} V`), h('span', { class: 'small' }, ` ${b.word}${b.falling ? ' · falling' : ''}`)),
      h('div', { class: 'fills', style: { marginTop: '6px' } }, log.map(r => h('div', { class: 'fill' }, h('span', { class: 'n' }, dmy(r.date)), h('span', { class: 'small' }, `${r.v} V${r.note ? ` · ${r.note}` : ''}`), h('span')))))
      : h('div', { class: 'small muted' }, 'Engine off a few hours, a cheap multimeter on the two terminals: 12.6 V or more is healthy. Saudi heat kills batteries in 2–3 years.'));
}
function batterySheet(c) {
  const d = date(), v = num({ min: 5, max: 16, placeholder: '12.6', class: 'big', 'aria-label': 'Volts' }), note = h('input', { maxlength: 60, placeholder: 'note (optional)' }), err = h('div', { class: 'err', role: 'alert' });
  const box = sheet([h('h2', {}, '🔋 Battery check'), h('div', { class: 'grid2' }, field('Volts (engine off)', v), field('Date', d)), field('Note', note), err,
    foot(h('button', { class: 'btn primary grow', onClick: () => { if (!(+v.value >= 5 && +v.value <= 16)) { err.textContent = 'Between 5 and 16 volts'; return; } saveX(c, { battery: [...(c.x?.battery || []), { date: d.value, v: +v.value, note: note.value }] }, 'Battery check saved'); box.close(); } }, 'Save'), cancel(() => box))]);
  setTimeout(() => v.focus(), 50);
}
export function warrantyCard(c) {
  const w = EX.warranties(c), s = S();
  return h('div', { class: 'card' }, h('div', { class: 'title' }, `🛡️ Warranties${w.filter(x => x.active).length ? ` · ${w.filter(x => x.active).length} active` : ''}`),
    w.length ? h('div', { class: 'rows' }, w.map(x => h('button', { class: `item ${x.active ? '' : 'st-unknown'}`, onClick: () => ctx.itemSheet(c, x.item) }, h('span', { class: 'ii' }, CC.ITEMS[x.item]?.icon || '🔩'), h('span', { class: 'im' }, h('span', { class: 'in' }, CC.ITEMS[x.item]?.label || x.item, x.part ? h('span', { class: 'tiny dim' }, ` · ${x.part}`) : null), h('span', { class: 'id' }, `${x.active ? 'Until' : 'Ended'} ${dmy(x.until)} · fitted ${dmy(x.date)}${s.workshops?.[x.shop]?.name || x.place ? ` at ${s.workshops?.[x.shop]?.name || x.place}` : ''}`)), x.active ? tag(x.days <= 30 ? 'soon' : 'ok', x.days <= 30 ? `${x.days} d left` : 'Covered') : null)))
      : h('div', { class: 'small muted' }, 'When you log a service, open “Parts and prices” and give a part its warranty in months (batteries and pads often have one).'));
}

// ───────────────────────── reading a receipt
let tess = null;
function loadTesseract() {
  if (window.Tesseract) return Promise.resolve(window.Tesseract);
  return tess ||= new Promise((ok, no) => { const sc = h('script', { src: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js' }); sc.onload = () => ok(window.Tesseract); sc.onerror = () => { tess = null; no(new Error('Couldn’t load the reader — are you online?')); }; document.head.append(sc); });
}
/** A receipt photo → its text (English + Arabic). The reader downloads once (~10 MB) the first time. */
export async function ocr(file, onProgress = () => {}) {
  const T = await loadTesseract();
  const r = await T.recognize(file, 'eng+ara', { logger: (m) => m.status === 'recognizing text' && onProgress(Math.round(m.progress * 100)) });
  return r.data.text || '';
}
/** The button in the service sheet: pick a photo, read it, tick the items and fill the prices. `apply(lines, total)` is the sheet's. */
export function receiptButton(apply) {
  const b = h('button', { class: 'btn', onClick: () => {
    const inp = h('input', { type: 'file', accept: 'image/*', capture: 'environment', style: { display: 'none' } });
    inp.addEventListener('change', async () => { const f = inp.files?.[0]; inp.remove(); if (!f) return; b.disabled = true; b.textContent = '🧾 Reading…';
      try { const text = await ocr(f, (p) => { b.textContent = `🧾 Reading… ${p} %`; }); const r = EX.parseReceipt(text); apply(r.lines, r.total); b.textContent = r.lines.length ? `🧾 Found ${r.lines.length} line${r.lines.length === 1 ? '' : 's'} — check them` : '🧾 Nothing recognised — type it in'; }
      catch (e) { toast(e.message, 'err'); b.textContent = '🧾 Read the receipt'; } finally { b.disabled = false; } });
    document.body.append(inp); inp.click(); } }, '🧾 Read the receipt');
  return b;
}

// ───────────────────────── fuel: stations, commute
export function stationsCard(c) {
  const st = EX.stations(c), pl = EX.pricePerLitre(c), changes = pl.filter((p, i) => i === 0 || Math.abs(p.perL - pl[i - 1].perL) >= 0.05).slice(-4);
  return h('div', { class: 'card' }, h('div', { class: 'title' }, '⛽ Where you fill up'),
    st.length ? h('div', { class: 'rows' }, st.slice(0, 6).map(x => h('div', { class: 'row small' }, h('b', { class: 'grow' }, x.name), h('span', { class: 'dim' }, `${x.visits}× · ${x.litres} L${x.perL ? ` · ${x.perL.toFixed(2)} SAR/L` : ''} · ${dmy(x.last)}`))))
      : h('div', { class: 'small muted' }, 'Name the station when you log a fill-up (Aldrees, Petromin, SASCO…).'),
    changes.length > 1 ? h('div', { class: 'tiny dim', style: { marginTop: '8px' } }, 'Price a litre: ', changes.map(p => `${p.perL.toFixed(2)} (${dmy(p.date).slice(0, 5)})`).join(' → ')) : null,
    h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, 'Pump prices are set nationally, so stations differ in service, not price.'));
}
export function commuteCard(c) {
  const km = CZ.custom(S()).car.commute;
  const inp = num({ max: 300, value: km || '', placeholder: 'km one way', 'aria-label': 'Km to work, one way' });
  const set = h('div', { class: 'row', style: { marginTop: '8px' } }, inp, h('button', { class: 'btn sm', onClick: () => { ctx.update(s => CZ.setCustom(s, 'car', { commute: +inp.value || 0 })); ctx.render(); toast('Commute saved', 'ok'); } }, 'Save'));
  if (!km) return h('div', { class: 'card' }, h('div', { class: 'title' }, '🏥 Work commute'), h('div', { class: 'small muted' }, 'How far is work, one way? Your shifts come from Mandarin.'), set);
  const cost = CC.costs(c, new Date()), last = (c.fuel || []).filter(f => f.cost && f.litres).pop();
  const m = EX.commute(c, km, ctx.workDays, new Date(), cost.l100 || (c.model === 'camry-2016' ? 7.5 : 9), last ? last.cost / last.litres : 0);
  return h('div', { class: 'card' }, h('div', { class: 'title' }, '🏥 Work commute · next 30 days'),
    m.shifts ? h('div', { class: 'stats' }, stat(String(m.shifts), 'shifts'), stat(m.km.toLocaleString('en'), 'km'), m.sar ? stat(String(m.sar), 'SAR fuel') : null)
      : h('div', { class: 'small muted' }, 'No shifts from Mandarin in the next 30 days (or the rota isn’t on this device yet).'),
    h('details', { class: 'adv' }, h('summary', { class: 'small' }, `${km} km each way · change`), set));
}

// ───────────────────────── papers: insurance quotes, fines, calendar, sell-ready
export function quotesCard(c) {
  const q = EX.compareQuotes(c), now = +c.ins?.premium || 0;
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, '📑 Insurance quotes'), h('button', { class: 'btn sm primary', onClick: () => insQuoteSheet(c) }, '+ Quote')),
    now ? h('div', { class: 'small' }, `Now: ${sar(now)} a year${c.ins?.company ? ` with ${c.ins.company}` : ''}${c.ins?.kind ? ` · ${L.INS_KIND[c.ins.kind]}` : ''}`) : null,
    q.length ? h('div', { class: 'rows', style: { marginTop: '6px' } }, q.map(x => h('div', { class: `item ${x.cheapest ? 'st-ok' : ''}`, style: { cursor: 'default' } }, h('span', { class: 'im' }, h('span', { class: 'in' }, x.company, x.kind ? h('span', { class: 'tiny dim' }, ` · ${L.INS_KIND[x.kind]}`) : null), h('span', { class: 'id' }, [x.excess ? `excess ${sar(x.excess)}` : '', x.towing ? 'towing' : '', x.agency ? 'agency repair' : '', x.note].filter(Boolean).join(' · ') || ' ')),
      h('b', { class: 'n' }, sar(x.premium)), x.vsNow != null ? tag(x.vsNow < 0 ? 'ok' : 'late', `${x.vsNow < 0 ? '−' : '+'}${Math.abs(x.vsNow)}`) : null,
      h('button', { class: 'btn sm ghost', 'aria-label': `Remove ${x.company}`, onClick: () => saveX(c, { insQuotes: (c.x?.insQuotes || []).filter(y => y.id !== x.id) }, 'Quote removed') }, '✕'))))
      : h('div', { class: 'small muted', style: { marginTop: '4px' } }, 'Ask two or three insurers (or an aggregator) a month before renewal and note them here.'));
}
function insQuoteSheet(c) {
  const co = h('input', { maxlength: 40, placeholder: 'insurer' }), pr = num({ placeholder: 'SAR a year', 'aria-label': 'Premium (SAR a year)' }), ex = num({ placeholder: 'SAR', 'aria-label': 'Excess (SAR)' }), note = h('input', { maxlength: 80, placeholder: 'note' });
  const kind = h('select', {}, h('option', { value: 'third' }, 'Third party'), h('option', { value: 'comp' }, 'Comprehensive')), tow = h('input', { type: 'checkbox' }), ag = h('input', { type: 'checkbox' }), err = h('div', { class: 'err', role: 'alert' });
  const box = sheet([h('h2', {}, '📑 Insurance quote'), field('Insurer', co), h('div', { class: 'grid2' }, field('Premium (SAR a year)', pr), field('Excess (SAR)', ex)), field('Cover', kind), h('label', { class: 'row small' }, tow, ' Towing included'), h('label', { class: 'row small' }, ag, ' Agency repair'), field('Note', note), err,
    foot(h('button', { class: 'btn primary grow', onClick: () => { if (!co.value.trim() || !(+pr.value > 0)) { err.textContent = 'Insurer and premium, please'; return; } saveX(c, { insQuotes: [...(c.x?.insQuotes || []), { date: keyOf(new Date()), company: co.value, premium: +pr.value, excess: +ex.value || 0, kind: kind.value, towing: tow.checked, agency: ag.checked, note: note.value }] }, 'Quote saved'); box.close(); } }, 'Save'), cancel(() => box))]);
}
export function finesCard(c) {
  const due = EX.finesDue(c), y = new Date().getFullYear(), list = (c.x?.fines || []).slice(-5).reverse(), tot = EX.finesTotal(c, y);
  return h('div', { class: `card ${due ? 'warn' : ''}` }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, '🚦 Traffic fines'), tot ? h('span', { class: 'tiny dim' }, `${sar(tot)} in ${y}`) : null),
    due ? h('div', { class: 'small' }, c.x?.finesChecked ? `Last checked ${dmy(c.x.finesChecked)}. ` : '', 'Check Absher › Traffic violations once a month — unpaid fines double and can block renewals.') : h('div', { class: 'small muted' }, `Checked ${dmy(c.x.finesChecked)} · next check in ${30 - Math.round((Date.now() - fromKey(c.x.finesChecked)) / 864e5)} days`),
    h('div', { class: 'row wrap', style: { marginTop: '8px' } }, h('button', { class: `btn ${due ? 'primary' : ''}`, onClick: () => saveX(c, { finesChecked: keyOf(new Date()) }, 'Marked as checked') }, '✓ Checked — none new'), h('button', { class: 'btn', onClick: () => fineSheet(c) }, '+ A fine')),
    list.length ? h('div', { class: 'fills', style: { marginTop: '8px' } }, list.map(f => h('div', { class: 'fill' }, h('span', { class: 'n' }, dmy(f.date)), h('span', { class: 'small' }, `${sar(f.sar)}${f.what ? ` · ${f.what}` : ''}`), h('span')))) : null);
}
function fineSheet(c) {
  const d = date(), s = num({ placeholder: 'SAR', class: 'big', 'aria-label': 'Fine (SAR)' }), w = h('input', { maxlength: 60, placeholder: 'speeding, parking, seatbelt…' }), err = h('div', { class: 'err', role: 'alert' });
  const box = sheet([h('h2', {}, '🚦 A fine'), h('div', { class: 'grid2' }, field('SAR', s), field('Date', d)), field('What for', w), err,
    foot(h('button', { class: 'btn primary grow', onClick: () => { if (!(+s.value > 0)) { err.textContent = 'How much?'; return; } saveX(c, { fines: [...(c.x?.fines || []), { date: d.value, sar: +s.value, what: w.value, at: Date.now() }], finesChecked: keyOf(new Date()) }, 'Fine saved'); box.close(); } }, 'Save'), cancel(() => box))]);
}
export function papercalCard(c) {
  const ev = EX.paperEvents(c, L.driverOf(S()).licence, L.CAR_PAPERS), signed = ctx.signedIn();
  return h('div', { class: 'card' }, h('div', { class: 'title' }, '🗓 Papers in my calendar'),
    ev.length ? h('div', { class: 'tiny dim' }, ev.map(e => `${e.title.replace(/^\S+ /, '')} ${dmy(e.date)}`).join(' · ')) : h('div', { class: 'small muted' }, 'Add the paper dates first.'),
    h('div', { class: 'row wrap', style: { marginTop: '8px' } }, signed ? h('button', { class: 'btn primary', disabled: !ev.length, onClick: async (e) => { e.target.disabled = true; try { const r = await ctx.calendarForPapers(c.id); toast(r.created || r.deleted ? `Calendar updated (${r.created} added, ${r.deleted} removed)` : 'Calendar already up to date', 'ok'); } catch (x) { toast(x.message, 'err'); } finally { e.target.disabled = false; } } }, 'Put them in my calendar') : h('span', { class: 'small muted' }, 'Sign in with Google (Settings) to add them.')),
    h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, 'All-day events on the expiry day, with reminders four weeks and one week before. Renewing a paper and tapping again moves them.'));
}
export function sellCard(c) {
  const v = EX.valueTrend(c), lt = EX.lifetime(c);
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, '🏷️ Sell-ready'), h('button', { class: 'btn sm', onClick: () => valueSheet(c) }, '+ Value')),
    h('div', { class: 'stats' }, v ? stat(v.now.toLocaleString('en'), `SAR worth · ${dmy(v.date)}`) : null, v?.perYear ? stat(v.perYear.toLocaleString('en'), 'SAR lost a year') : null, stat(String(lt.visits), 'services logged'), stat(lt.care.toLocaleString('en'), 'SAR on care')),
    h('div', { class: 'row wrap', style: { marginTop: '8px' } }, h('button', { class: 'btn primary', onClick: () => historyPrint(c) }, '🖨 Service history')),
    h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, 'A full, dated history is the best thing to show a buyer. Check Haraj or Syarah for similar cars to note a value.'));
}
function valueSheet(c) {
  const d = date(), s = num({ placeholder: 'SAR', class: 'big', 'aria-label': 'Value (SAR)' }), src = h('input', { maxlength: 40, placeholder: 'Haraj, Syarah, a dealer offer…' }), err = h('div', { class: 'err', role: 'alert' });
  const box = sheet([h('h2', {}, '🏷️ What the car is worth'), h('div', { class: 'grid2' }, field('SAR', s), field('Date', d)), field('From', src), err,
    foot(h('button', { class: 'btn primary grow', onClick: () => { if (!(+s.value > 0)) { err.textContent = 'How much?'; return; } saveX(c, { values: [...(c.x?.values || []), { date: d.value, sar: +s.value, src: src.value }] }, 'Value saved'); box.close(); } }, 'Save'), cancel(() => box))]);
}
/** A clean, printable page: the car, then every service with parts and prices. */
function historyPrint(c) {
  const s = S(), lt = EX.lifetime(c), log = [...(c.log || [])].filter(v => v.items?.length || v.what === 'service').sort((a, b) => b.date.localeCompare(a.date));
  const page = h('div', { class: 'print-area' }, h('h2', {}, `${c.name} — service history`), h('div', { class: 'small' }, [c.year, c.colour, c.vin ? `VIN ${c.vin}` : '', CC.odoNow(c, new Date()).km ? `${kmT(CC.odoNow(c, new Date()).km)} now` : ''].filter(Boolean).join(' · ')),
    h('div', { class: 'small', style: { margin: '6px 0 10px' } }, `${lt.visits} services${lt.since ? ` since ${dmy(lt.since)}` : ''} · ${sar(lt.care)} on care`),
    h('table', { class: 'ptable' }, h('thead', {}, h('tr', {}, ['Date', 'km', 'Work', 'Where', 'SAR'].map(x => h('th', {}, x)))), h('tbody', {}, log.map(v => h('tr', {}, h('td', {}, dmy(v.date)), h('td', {}, v.km ? v.km.toLocaleString('en') : ''), h('td', {}, (v.lines?.length ? v.lines.map(l => `${CC.ITEMS[l.item]?.label || l.item}${l.part ? ` (${l.part})` : ''}`) : (v.items || []).map(i => CC.ITEMS[i]?.label || i)).join(', ') || v.note || 'Service'), h('td', {}, s.workshops?.[v.shop]?.name || v.place || ''), h('td', {}, v.cost ? v.cost.toLocaleString('en') : ''))))));
  const box = sheet([page, foot(h('button', { class: 'btn primary grow', onClick: () => { document.body.classList.add('printing'); window.print(); setTimeout(() => document.body.classList.remove('printing'), 500); } }, '🖨 Print or save as PDF'), cancel(() => box, 'Close'))], 'wide print-sheet');
}

// ───────────────────────── trip: the map
export function mapCard(t) {
  const ids = Object.fromEntries(TR.CITIES.flatMap(([id, en, ar]) => [[en, id], [en.toLowerCase(), id], [ar, id], [id, id]]));
  const m = EX.mapOf(t?.legs || [], ids, 600, 360);
  if (!m) return h('div', { class: 'card' }, h('div', { class: 'title' }, '🗺️ Trip map'), h('div', { class: 'small muted' }, 'Add legs between known cities to see them drawn.'));
  const tank = (ctx.tank?.() || 70), stopKm = Math.round(tank / 2 / 7.5 * 100);
  const label = `Route: ${m.pts.map(p => p.name).join(', ')}`;
  return h('div', { class: 'card' }, h('div', { class: 'title' }, '🗺️ Trip map'),
    svg(m, stopKm, label),
    h('div', { class: 'tiny dim' }, `⛽ marks a fill-up on legs longer than about ${stopKm} km (half a ${tank} L tank). Drawn from city positions, not roads.`));
}
function svg(m, stopKm, label) {
  const NS = 'http://www.w3.org/2000/svg', el = (n, a = {}, ...kids) => { const e = document.createElementNS(NS, n); for (const [k, v] of Object.entries(a)) e.setAttribute(k, v); e.append(...kids); return e; };
  const g = el('svg', { viewBox: `0 0 ${m.W} ${m.H}`, class: 'tripmap', role: 'img', 'aria-label': label });
  g.append(el('title', {}, label));
  for (const s of m.segs) {
    g.append(el('line', { x1: s.a.x, y1: s.a.y, x2: s.b.x, y2: s.b.y, class: `leg ${s.done ? 'done' : ''}` }));
    const mx = (s.a.x + s.b.x) / 2, my = (s.a.y + s.b.y) / 2;
    g.append(el('text', { x: mx, y: my - 8, class: 'km', 'text-anchor': 'middle' }, `${s.km} km`));
    if (s.km > stopKm) g.append(el('text', { x: mx, y: my + 14, class: 'stop', 'text-anchor': 'middle' }, '⛽'));
  }
  for (const p of m.pts) { g.append(el('circle', { cx: p.x, cy: p.y, r: 7, class: 'city' })); g.append(el('text', { x: p.x, y: p.y + (p.y > m.H - 30 ? -14 : 24), class: 'name', 'text-anchor': 'middle' }, p.name)); }
  return g;
}

// ───────────────────────── garage: spares at home
export function stockCard(c) {
  const st = c.x?.stock || [], low = EX.lowStock(c);
  const step = (sp, d) => saveX(c, { stock: st.map(x => x.id === sp.id ? { ...x, qty: Math.max(0, Math.round((x.qty + d) * 10) / 10) } : x) });
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, `📦 Spares at home${low.length ? ` · ${low.length} low` : ''}`), h('button', { class: 'btn sm primary', onClick: () => stockSheet(c) }, '+ Spare')),
    st.length ? h('div', { class: 'rows' }, st.map(sp => h('div', { class: `item ${sp.qty < sp.per ? 'st-soon' : ''}`, style: { cursor: 'default' } }, h('span', { class: 'ii' }, CC.ITEMS[sp.item]?.icon || '📦'), h('span', { class: 'im' }, h('span', { class: 'in' }, sp.name), h('span', { class: 'id' }, `${sp.qty} ${sp.unit || ''} · a service uses ${sp.per}${sp.item ? ` (${CC.ITEMS[sp.item].label})` : ''}`)),
      h('button', { class: 'btn sm ghost', 'aria-label': `One less ${sp.name}`, onClick: () => step(sp, -1) }, '−'), h('button', { class: 'btn sm ghost', 'aria-label': `One more ${sp.name}`, onClick: () => step(sp, 1) }, '+'))))
      : h('div', { class: 'small muted' }, 'Keep oil and filters at home? Add them: a logged service uses them up, and low ones go to your shopping list in Calamansi.'),
    low.length && isOn('share') ? h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, `On your shopping list: ${low.map(x => x.name).join(', ')}`) : null);
}
function stockSheet(c) {
  const n = h('input', { maxlength: 40, placeholder: 'e.g. 5W-30 oil' }), q = num({ placeholder: 'how many', 'aria-label': 'Quantity' }), per = num({ value: 1, 'aria-label': 'Used per service' }), u = h('input', { maxlength: 10, placeholder: 'L, pcs' });
  const it = h('select', { 'aria-label': 'Used for' }, h('option', { value: '' }, '— not linked —'), Object.entries(CC.ITEMS).filter(([, d]) => !d.days).map(([id, d]) => h('option', { value: id }, d.label))), err = h('div', { class: 'err', role: 'alert' });
  const box = sheet([h('h2', {}, '📦 A spare'), field('What', n), h('div', { class: 'grid3' }, field('Have', q), field('Per service', per), field('Unit', u)), field('Used for', it), err,
    foot(h('button', { class: 'btn primary grow', onClick: () => { if (!n.value.trim()) { err.textContent = 'What is it?'; return; } saveX(c, { stock: [...(c.x?.stock || []), { name: n.value, qty: +q.value || 0, per: +per.value || 1, unit: u.value, item: it.value }] }, 'Spare added'); box.close(); } }, 'Save'), cancel(() => box))]);
}

// ───────────────────────── which tool cards each tab shows (in this order, after the main cards)
export function tabTools(tab, c, extra = {}) {
  if (!c) return [];
  const T = { dash: [['parked', parkedCard], ['smart', smartCard]], service: [['tyrelog', treadCard], ['battery', batteryCard], ['warranty', warrantyCard]], fuel: [['stations', stationsCard], ['commute', commuteCard]], papers: [['insquotes', quotesCard], ['fines', finesCard], ['papercal', papercalCard], ['sell', sellCard]], trip: [['map', () => mapCard(extra.trip)]], garage: [['stock', stockCard]] }[tab] || [];
  const on = CZ.allOn(S());
  return T.filter(([id]) => on[id]).map(([, f]) => f(c));
}
