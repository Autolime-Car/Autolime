// Road trip: the legs (a ready Saudi loop, or your own), km and hours per leg, where to fill up, what falls due on the way,
// papers that run out, the shifts you need leave for, the checklist before you go, a quick check each morning on the road,
// and a log of what the trip costs while you travel.
import * as EXU from './ui-extras.js';
import { h, keyOf, fromKey, addDays } from './util.js';
import * as L from './car.js';
import * as CC from './carcare.js';
import * as TR from './trip.js';
import { ctx, S, field, dmy, kmT, sar, putCar, currentCar, carChips, viewHead, stat, tag, careRow, undoToast } from './ui-kit.js';
import { fuelSheet } from './ui-sheets.js';

export function renderTrip() {
  const s = S(), now = new Date(), c = currentCar(s);
  if (!c) return [viewHead('Road trip'), h('div', { class: 'card empty' }, 'Add your car on the Dash first.')];
  const t = c.trip && !c.trip.closed ? c.trip : null;
  if (!t) return [viewHead('Road trip'), carChips(s), startCard(c), pastTrips(c), EXU.toolsHint('trip')];
  const legsKm = L.legsTotal(t), km = t.km || legsKm.km, fu = km ? L.tripFuel(c, km, t.price) : null, due = L.dueByTrip(c, { ...t, km }, now), checks = new Set(t.checks || []);
  const end = t.end || (t.date ? keyOf(addDays(fromKey(t.date), 7)) : ''), today = keyOf(now), onRoad = t.date && today >= t.date && (!end || today <= end);
  const save = (patch) => { putCar({ ...c, trip: { ...t, ...patch } }); ctx.render(); };
  const paperIssues = [['Istimara', c.istimara], ['Fahas', c.fahas], ['Insurance', c.insurance], ['Licence', L.driverOf(s).licence]].filter(([, k]) => k && end && k <= keyOf(addDays(fromKey(end), 14)));
  const work = t.date && ctx.workDays ? ctx.workDays(fromKey(t.date), fromKey(end)) : [];
  const spend = L.tripSpend(t), days = L.daysUntil(t.date, now);
  const doneLegs = (t.legs || []).filter(l => l.done).length, pos = t.legs?.length ? doneLegs / t.legs.length : 0;
  return [viewHead('Road trip', h('button', { class: 'btn', onClick: () => tripSheet(c, t) }, 'Edit')), carChips(s),
    h('div', { class: 'card trip-hero' }, h('div', { class: 'title' }, t.name || 'Road trip'), h('div', { class: 'small muted' }, [t.date ? `${dmy(t.date)}${end ? ` – ${dmy(end)}` : ''}` : 'no date yet', days != null ? (days > 0 ? `in ${days} days` : onRoad ? 'on the road now' : days < 0 ? 'done' : 'today') : ''].filter(Boolean).join(' · ')),
      t.legs?.length ? h('div', { class: 'road', role: 'img', 'aria-label': `${doneLegs} of ${t.legs.length} legs driven` }, h('span', { class: 'car-dot', style: { left: `${Math.max(4, Math.min(96, pos * 100))}%` } }, '🚗')) : null,
      h('div', { class: 'stats', style: { marginTop: '10px' } }, stat(km ? km.toLocaleString('en') : '—', 'km'), legsKm.hrs ? stat(`${legsKm.hrs}`, 'hours driving') : null, fu ? stat(`${fu.litres}`, `litres (${fu.l100} L/100${fu.measured ? '' : ', typical'})`) : null, fu?.sar ? stat(fu.sar.toLocaleString('en'), `SAR fuel at ${fu.price}/L`) : null, spend.total ? stat(spend.total.toLocaleString('en'), 'SAR spent so far', 'acc') : null)),
    onRoad ? dailyCard(c, t, today) : null,
    t.legs?.length && EXU.isOn('map') ? EXU.mapCard(t) : null,
    t.legs?.length ? legsCard(c, t, fu) : h('button', { class: 'card cta', onClick: () => tripSheet(c, t) }, h('span', { class: 'ic' }, '🗺️'), h('span', { class: 'grow' }, h('b', {}, 'Add the legs'), h('span', { class: 'tiny dim' }, ' · city to city, with km, hours and fuel stops')), h('span', { class: 'arrow' }, '+')),
    work.length ? h('div', { class: 'card warn' }, h('div', { class: 'title' }, `Leave needed · ${work.length} shift${work.length === 1 ? '' : 's'}`), h('div', { class: 'small' }, `From Mandarin, you are on the rota on ${work.slice(0, 8).map(w => `${dmy(w.key).slice(0, 5)}${w.type ? ` (${w.type})` : ''}`).join(', ')}${work.length > 8 ? '…' : ''}. Ask for leave or swaps before the rota closes.`)) : null,
    due.length ? h('div', { class: 'card' }, h('div', { class: 'title' }, `Do before you go · ${due.length}`), h('div', { class: 'tiny dim', style: { marginBottom: '6px' } }, 'Overdue, or due before the trip ends by date or by its km.'), h('div', { class: 'rows' }, due.map(st0 => careRow(c, st0))),
      h('button', { class: 'btn', style: { marginTop: '8px' }, onClick: () => { const before = S(); const items = [...new Set([...(c.plan?.items || []), ...due.map(x => x.id)])]; putCar({ ...c, plan: { ...(c.plan || {}), date: c.plan?.date || '', items: CC.ITEM_ORDER.filter(i => items.includes(i)), added: c.plan?.added || [], note: c.plan?.note || `Before ${t.name || 'the trip'}` } }); ctx.render(); undoToast('Added to the planned service', before); } }, '🗓 Add them to the planned service')) : h('div', { class: 'card good' }, h('div', { class: 'small' }, '✨ Nothing falls due on this trip.')),
    paperIssues.length ? h('div', { class: 'card bad' }, h('div', { class: 'small' }, `⚠ ${paperIssues.map(([n]) => n).join(', ')} run${paperIssues.length === 1 ? 's' : ''} out during or right after the trip — renew first.`)) : null,
    h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, 'Before you leave'), tag(checks.size >= L.TRIP_CHECKS.length ? 'ok' : 'soon', `${L.TRIP_CHECKS.filter(([id]) => checks.has(id)).length}/${L.TRIP_CHECKS.length}`)),
      h('div', { class: 'steps' }, L.TRIP_CHECKS.map(([id, en, ar]) => h('button', { class: `check ${checks.has(id) ? 'on' : ''}`, 'aria-pressed': String(checks.has(id)), onClick: () => { const n = new Set(checks); n.has(id) ? n.delete(id) : n.add(id); save({ checks: [...n] }); } }, h('span', { class: 'box' }, checks.has(id) ? '✓' : ''), h('span', { class: 'grow' }, h('span', { class: 'ct small' }, en), h('span', { class: 'car', lang: 'ar' }, ar)))))),
    logCard(c, t, spend),
    h('div', { class: 'card' }, h('div', { class: 'title' }, 'On the road'), h('ul', { class: 'small', style: { margin: 0, paddingLeft: '18px', display: 'grid', gap: '4px' } }, ['Fill up at half a tank between cities — stations thin out on some stretches.', 'Check tyre pressure cold each morning; a hot tyre reads higher.', 'If the temperature needle climbs: AC off, heater on full, pull over and let it cool before opening anything.', 'Sandstorm: slow down, lights on, never stop in the lane — pull fully off the road.', 'Rest every 2 hours; long straight highways make you sleepy.', 'Camels cross at night on desert roads: slow down after dark outside cities.'].map(x => h('li', {}, x)))),
    h('div', { class: 'row wrap', style: { margin: '4px 0 14px' } }, h('button', { class: 'btn', onClick: () => { const before = S(); putCar({ ...c, trip: null, trips: [...(c.trips || []), { ...t, closed: true }].slice(-12) }); ctx.render(); undoToast('Trip finished and kept in Past trips', before); } }, '🏁 Finish the trip'), h('button', { class: 'btn ghost', onClick: () => { const before = S(); putCar({ ...c, trip: null }); ctx.render(); undoToast('Trip cleared', before); } }, 'Clear')),
    pastTrips(c), EXU.toolsHint('trip')];
}
function startCard(c) {
  return h('div', { class: 'card' }, h('div', { class: 'title' }, 'Plan a road trip'), h('div', { class: 'small muted', style: { marginBottom: '10px' } }, 'Pick a ready route or build your own. Vehicular adds up the km and hours, the fuel and its cost, what falls due on the way and the checks.'),
    h('div', { class: 'rows' }, TR.ROUTES.map(r => { const legs = TR.legsOf(r.stops), tot = legs.reduce((a, l) => ({ km: a.km + l.km, hrs: a.hrs + l.hrs }), { km: 0, hrs: 0 });
      return h('button', { class: 'item', onClick: () => tripSheet(c, { name: r.name, date: '', km: 0, price: 0, checks: [], legs, log: [], daily: {} }) }, h('span', { class: 'ii' }, '🗺️'), h('span', { class: 'im' }, h('span', { class: 'in' }, r.name), h('span', { class: 'id' }, r.stops.map(TR.cityName).join(' → '))), h('span', { class: 'val' }, kmT(tot.km))); }),
      h('button', { class: 'item', onClick: () => tripSheet(c, null) }, h('span', { class: 'ii' }, '✏️'), h('span', { class: 'im' }, h('span', { class: 'in' }, 'My own route'), h('span', { class: 'id' }, 'Add the stops one by one')))));
}
function pastTrips(c) {
  const list = [...(c.trips || [])].reverse(); if (!list.length) return null;
  return h('details', { class: 'card adv' }, h('summary', {}, `Past trips · ${list.length}`), h('div', { class: 'rows' }, list.map(t => { const sp = L.tripSpend(t), km = t.km || L.legsTotal(t).km; return h('div', { class: 'item', style: { cursor: 'default' } }, h('span', { class: 'ii' }, '🏁'), h('span', { class: 'im' }, h('span', { class: 'in' }, t.name || 'Road trip'), h('span', { class: 'id' }, [t.date ? dmy(t.date) : '', km ? kmT(km) : '', sp.total ? sar(sp.total) : '', sp.total && km ? `${(sp.total / km).toFixed(2)} SAR/km all in` : ''].filter(Boolean).join(' · ')))); })));
}
function legsCard(c, t, fu) {
  const l100 = fu?.l100 || 7.5, tank = ctx.tank?.() || 70;
  const toggle = (i) => { const legs = t.legs.map((l, j) => j === i ? { ...l, done: !l.done } : l); putCar({ ...c, trip: { ...t, legs } }); ctx.render(); };
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, `Legs · ${t.legs.length}`), h('span', { class: 'tiny dim' }, 'tap a stop when you get there')),
    h('div', { class: 'legs' }, t.legs.map((l, i) => { const fp = TR.fuelPlan(l, l100, tank), tip = TR.legTip(l);
      return h('div', { class: `leg ${l.done ? 'done' : ''}` }, h('button', { class: 'dot', 'aria-label': `${l.done ? 'Not yet at' : 'Arrived at'} ${l.to}`, 'aria-pressed': String(!!l.done), onClick: () => toggle(i), style: { cursor: 'pointer', padding: 0 } }, l.done ? '✓' : String(i + 1)),
        h('div', {}, h('div', { class: 'lt' }, `${l.from} → ${l.to}`), h('div', { class: 'ls' }, [l.day ? dmy(l.day) : '', tip].filter(Boolean).join(' · ')), fp.stops ? h('div', { class: 'fuel' }, `⛽ fill up before you leave${fp.stops ? ` and ${fp.stops === 1 ? 'once' : `${fp.stops} times`} on the way (every ~${fp.every} km)` : ''}`) : fp.fillBefore ? h('div', { class: 'fuel' }, '⛽ leave with a full tank') : null),
        h('div', { class: 'lk' }, l.km ? `${l.km.toLocaleString('en')}` : '?', h('small', {}, l.hrs ? `km · ${l.hrs} h` : 'km'))); })));
}
function dailyCard(c, t, today) {
  const done = new Set(t.daily?.[today] || []);
  const tick = (id) => { const n = new Set(done); n.has(id) ? n.delete(id) : n.add(id); putCar({ ...c, trip: { ...t, daily: { ...(t.daily || {}), [today]: [...n] } } }); ctx.render(); };
  return h('div', { class: `card ${done.size >= L.DAILY_CHECKS.length ? 'good' : 'warn'}` }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, 'This morning’s check'), tag(done.size >= L.DAILY_CHECKS.length ? 'ok' : 'soon', `${done.size}/${L.DAILY_CHECKS.length}`)),
    h('div', { class: 'tiny dim', style: { marginBottom: '6px' } }, 'Engine cold, before the first leg. Two minutes.'),
    h('div', { class: 'steps' }, L.DAILY_CHECKS.map(([id, en, ar]) => h('button', { class: `check ${done.has(id) ? 'on' : ''}`, 'aria-pressed': String(done.has(id)), onClick: () => tick(id) }, h('span', { class: 'box' }, done.has(id) ? '✓' : ''), h('span', { class: 'grow' }, h('span', { class: 'ct small' }, en), h('span', { class: 'car', lang: 'ar' }, ar))))));
}
function logCard(c, t, spend) {
  const kind = h('select', { 'aria-label': 'What for' }, L.TRIP_COSTS.map(([id, l, ic]) => h('option', { value: id }, `${ic} ${l}`))), amt = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder: 'SAR', 'aria-label': 'Amount' }), note = h('input', { maxlength: 60, placeholder: 'note', 'aria-label': 'Note' });
  const add = () => { if (!(+amt.value > 0)) return; if (kind.value === 'fuel') { fuelSheet(c); return; } putCar({ ...c, trip: { ...t, log: [...(t.log || []), { date: keyOf(new Date()), kind: kind.value, sar: +amt.value, litres: 0, note: note.value, at: Date.now() }] } }); ctx.render(); };
  const rows = [...(t.log || [])].reverse().slice(0, 10);
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, 'Trip money'), spend.total ? h('b', { class: 'n' }, sar(spend.total)) : null),
    spend.total ? h('div', { class: 'chips', style: { marginBottom: '8px' } }, L.TRIP_COSTS.filter(([id]) => spend.by[id]).map(([id, l, ic]) => h('span', { class: 'chip static' }, `${ic} ${l} ${sar(spend.by[id])}`))) : null,
    h('div', { class: 'grid3' }, kind, amt, h('button', { class: 'btn primary', onClick: add }, 'Add')), note,
    rows.length ? h('div', { class: 'fills', style: { marginTop: '8px' } }, rows.map(x => h('div', { class: 'fill' }, h('span', { class: 'n' }, dmy(x.date)), h('span', { class: 'small' }, `${L.TRIP_COSTS.find(k => k[0] === x.kind)?.[2] || ''} ${x.note || L.TRIP_COSTS.find(k => k[0] === x.kind)?.[1] || ''}${x.litres ? ` · ${x.litres} L` : ''}`), h('b', { class: 'n' }, sar(x.sar))))) : h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, 'Fill-ups logged during the trip land here too.'));
}
/** Edit the trip: name, dates, fuel price, and the legs (add a stop, km and hours fill in from the table). */
export function tripSheet(c, base) {
  const t = base || c.trip || { name: '', date: '', end: '', km: 0, price: 0, checks: [], legs: [], log: [], daily: {} };
  const name = h('input', { value: t.name || '', maxlength: 60, placeholder: 'e.g. East, West & Qassim' }), date = h('input', { type: 'date', value: t.date || '' }), end = h('input', { type: 'date', value: t.end || '' });
  const fuelNow = L.tripFuel(c, 100, 0), price = h('input', { type: 'number', min: 0, step: '0.01', inputmode: 'decimal', value: t.price || '', placeholder: fuelNow.price ? `${fuelNow.price}` : 'SAR / L' });
  let legs = (t.legs || []).map(l => ({ ...l }));
  const list = h('div', { class: 'rows' }), tot = h('div', { class: 'small muted' });
  const paint = () => {
    list.replaceChildren(...legs.map((l, i) => { const kmI = h('input', { type: 'number', min: 0, value: l.km || '', inputmode: 'numeric', 'aria-label': `km ${l.from} to ${l.to}`, onInput: (e) => { l.km = +e.target.value || 0; sum(); } }), dayI = h('input', { type: 'date', value: l.day || '', 'aria-label': `Day of ${l.from} to ${l.to}`, onChange: (e) => { l.day = e.target.value; } });
      return h('div', { class: 'item', style: { cursor: 'default', flexWrap: 'wrap' } }, h('span', { class: 'ii' }, String(i + 1)), h('span', { class: 'im' }, h('span', { class: 'in' }, `${l.from} → ${l.to}`), h('span', { class: 'id' }, l.hrs ? `${l.hrs} h` : '')), h('button', { class: 'btn sm ghost', 'aria-label': `Remove ${l.from} to ${l.to}`, onClick: () => { legs.splice(i, 1); paint(); } }, '✕'), h('div', { class: 'grid2', style: { width: '100%' } }, kmI, dayI)); }));
    sum();
  };
  const sum = () => { const s0 = legs.reduce((a, l) => ({ km: a.km + (l.km || 0), hrs: a.hrs + (l.hrs || 0) }), { km: 0, hrs: 0 }); tot.textContent = legs.length ? `${s0.km.toLocaleString('en')} km · about ${Math.round(s0.hrs * 10) / 10} h of driving` : 'No legs yet.'; };
  const cityOpts = () => CITIES_OPTS();
  const from = h('select', { 'aria-label': 'From' }, cityOpts()), to = h('select', { 'aria-label': 'To' }, cityOpts());
  if (legs.length) { const lastTo = TR.CITIES.find(x => x[1] === legs[legs.length - 1].to); if (lastTo) from.value = lastTo[0]; } else from.value = 'kharj';
  const addLeg = () => { if (from.value === to.value) return; const r = TR.road(from.value, to.value); legs.push({ from: TR.cityName(from.value), to: TR.cityName(to.value), km: r?.km || 0, hrs: r?.hrs || 0, day: '', done: false }); from.value = to.value; paint(); };
  paint();
  const box = ctx.sheet([h('h2', {}, '🛣️ Your trip'), field('Name', name), h('div', { class: 'grid3' }, field('Leaving', date), field('Back', end), field('Fuel (SAR/L)', price)),
    h('div', { class: 'title', style: { margin: '6px 0' } }, 'Legs'), list, tot, h('div', { class: 'grid3', style: { marginTop: '8px' } }, from, to, h('button', { class: 'btn', onClick: addLeg }, '+ Leg')),
    h('div', { class: 'tiny dim' }, 'km and hours come from a table of main-highway distances (approximate); change any km to what your map says.'),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => { const before = S(); putCar({ ...c, trip: { ...t, name: name.value, date: date.value, end: end.value, price: price.value, km: legs.length ? 0 : t.km || 0, legs } }); box.close(); ctx.render(); undoToast('Trip saved', before); } }, 'Save'), h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel'))]);
  box.box.classList.add('wide');
}
const CITIES_OPTS = () => TR.CITIES.map(([id, en]) => h('option', { value: id }, en));
