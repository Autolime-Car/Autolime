// Dash: the instrument cluster — health as a tachometer, the odometer roller, fuel use on a small gauge, the warning lights
// that would be on, the plate, and the four things you do most (log a service, fuel, the workshop list, the accident card).
// Under it: what is due, the papers at a glance, the planned service, the trip and this month's money.
import { h, toast, keyOf } from './util.js';
import * as L from './car.js';
import * as CC from './carcare.js';
import * as M from './money.js';
import * as PA from './papers.js';
import { ctx, S, dmy, kmT, sar, putCar, currentCar, carChips, stat, tag, careRow, plateBadge, colourName, gauge, odometer, telltales, icon } from './ui-kit.js';
import { visitSheet, fuelSheet, workshopSheet, accidentSheet, carSheet, insSheet, planSheet, itemSheet, driverSheet } from './ui-sheets.js';

export function renderDash() {
  const s = S(), now = new Date(), c = currentCar(s);
  if (!c) return welcome();
  if (!c.model) return [carChips(s), legacy(c)];
  const items = CC.plan(c, now), urgent = items.filter(x => x.state === 'late' || x.state === 'soon'), known = items.filter(x => x.state === 'ok'), unknown = items.filter(x => x.state === 'unknown');
  const planned = new Set(c.plan?.items || []), renew = PA.openRenewals(s, c, now);
  return [h('h1', { class: 'sr-only' }, 'Dash'), carChips(s), cluster(c, items, now),
    h('div', { class: 'dash-grid' },
      h('div', {},
        urgent.length ? h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, `Due now · ${urgent.length}`), h('button', { class: 'btn sm', onClick: () => planSheet(c) }, c.plan ? '🗓 Plan' : '🗓 Plan them')), h('div', { class: 'rows' }, urgent.filter(x => !planned.has(x.id)).slice(0, 7).map(st => careRow(c, st))), urgent.some(x => planned.has(x.id)) ? h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, `${urgent.filter(x => planned.has(x.id)).length} more are in your planned service.`) : null)
          : h('div', { class: 'card good' }, h('div', { class: 'small' }, unknown.length === items.length ? h('span', {}, h('b', {}, 'Start the countdowns. '), 'Say when each part was last done (Service), or tap one here.') : `✨ Nothing due. Next: ${known[0] ? `${known[0].def.label} ${CC.dueText(known[0], dmy)}` : '—'}`),
            unknown.length === items.length ? h('div', { class: 'rows', style: { marginTop: '8px' } }, items.filter(x => ['oil', 'brakes', 'battery', 'tyres', 'atf'].includes(x.id)).map(st => careRow(c, st))) : null),
        c.plan ? planCard(c, now) : null,
        known.length ? h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, 'Coming up'), h('button', { class: 'btn sm ghost', onClick: () => ctx.go('service') }, 'All parts →')), h('div', { class: 'rows' }, known.slice(0, 4).map(st => careRow(c, st)))) : null),
      h('div', {},
        paperTiles(c, now),
        renew.length ? h('button', { class: 'card cta warn', onClick: () => ctx.go('papers') }, h('span', { class: 'ic' }, renew[0].icon), h('span', { class: 'grow' }, h('b', {}, `Renew the ${renew[0].label.replace(/ \(.*\)$/, '').toLowerCase()}`), h('span', { class: 'tiny dim' }, ` · ${renew[0].days < 0 ? `expired ${-renew[0].days} d ago` : `${renew[0].days} d left`} · ${renew[0].done}/${renew[0].total} steps`)), h('span', { class: 'arrow' }, '→')) : null,
        tripTeaser(c, now), moneyCard(c, now),
        c.model === 'camry-2016' && !urgent.length && known.length > 8 ? h('button', { class: 'card cta', onClick: () => ctx.go('garage', 'noises') }, h('span', { class: 'ic' }, '👂'), h('span', { class: 'grow' }, h('b', {}, 'A new noise?'), h('span', { class: 'tiny dim' }, ' · the guided checks tell you what it probably is')), h('span', { class: 'arrow' }, '→')) : null)),
  ];
}
function welcome() {
  return [h('h1', {}, 'Autolime'),
    h('div', { class: 'cluster' }, h('div', { class: 'cl-name' }, 'Your car, looked after'), h('div', { class: 'cl-sub', style: { margin: '6px 0 12px', maxWidth: '520px' } }, 'Oil, brakes, tyres, suspension and the rest — each due by km or by date, with the Arabic words for the workshop. The papers and renewals, fuel and money, road trips and the accident card.'),
      h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', onClick: () => carSheet(null, CC.fromModel('camry-2016')) }, '🚗 Toyota Camry 2016'), h('button', { class: 'btn', onClick: () => carSheet(null, CC.fromModel('generic')) }, 'Another car'), h('button', { class: 'btn', onClick: () => insSheet(null) }, '📄 From my insurance PDF'))),
    h('div', { class: 'card' }, h('div', { class: 'title' }, 'Already set up in Calamansi?'), h('div', { class: 'small muted' }, 'Your car, its service history, fuel log and licence come over in one tap once you sign in to Google (Settings). Nothing is deleted in Calamansi.'),
      h('div', { class: 'row wrap', style: { marginTop: '10px' } }, h('button', { class: 'btn primary', onClick: () => ctx.migrateNow() }, '🍋 Bring my car over from Calamansi'), h('button', { class: 'btn', onClick: () => ctx.checkSetup?.() }, '📥 Look for a setup file on Drive'), h('button', { class: 'btn ghost', onClick: () => ctx.go('more') }, 'Settings'))),
    h('button', { class: 'card cta', onClick: driverSheet }, h('span', { class: 'ic' }, '🪪'), h('span', { class: 'grow' }, h('b', {}, 'Your licence'), h('span', { class: 'tiny dim' }, ' · reminded two months before it ends')), h('span', { class: 'arrow' }, '→'))];
}
function legacy(c) {
  return h('div', { class: 'card' }, h('div', { class: 'title' }, `${c.icon} ${c.name}`), h('div', { class: 'small', style: { margin: '8px 0' } }, 'Give it a care plan: oil, tyres, filters, battery and more, each by km or date.'),
    h('div', { class: 'row wrap' }, h('button', { class: 'btn primary', onClick: () => { putCar({ ...c, ...CC.fromModel('camry-2016'), name: c.name, icon: c.icon }); ctx.render(); } }, 'It’s a Camry 2016'), h('button', { class: 'btn', onClick: () => { putCar({ ...c, ...CC.fromModel('generic'), name: c.name, icon: c.icon }); ctx.render(); } }, 'Another car'), h('button', { class: 'btn ghost', onClick: () => carSheet(c) }, 'Edit')));
}

/** The hero: an instrument cluster. */
function cluster(c, items, now) {
  const odo = CC.odoNow(c, now), kpd = CC.kmPerDay(c), hp = CC.health(items), cost = CC.costs(c, now), m = CC.MODELS[c.model];
  const tone = hp.pct === null ? 'good' : hp.pct >= 85 ? 'good' : hp.pct >= 60 ? 'mid' : 'bad';
  const tacho = gauge(hp.pct === null ? hp.tracked / Math.max(1, hp.total) : hp.pct / 100, { read: hp.pct === null ? `${hp.tracked}/${hp.total}` : `${hp.pct}`, sub: hp.pct === null ? 'parts known' : 'health', ticks: ['0', '20', '40', '60', '80', '100'], red: [0, .4], tone, label: 'Car health' });
  tacho.title = hp.pct === null ? `${hp.tracked} of ${hp.total} parts have a last-done date; the health score starts once a third are known` : `${hp.tracked - hp.late - hp.soon} on time · ${hp.soon} soon · ${hp.late} overdue`;
  const l100 = cost.l100, eco = gauge(l100 ? Math.max(0, Math.min(1, (l100 - 5) / 10)) : 0, { read: l100 ? `${l100}` : '—', sub: 'L/100 km', ticks: ['5', '', '', '', '', '15'], red: [.6, 1], tone: !l100 ? 'good' : l100 <= 8.5 ? 'good' : l100 <= 10.5 ? 'mid' : 'bad', small: true, label: 'Fuel use' });
  const papers = L.carAlerts(S(), now).filter(a => (a.car.id === c.id || a.driver) && !a.care), pstate = papers.some(a => a.days < 0) ? 'late' : papers.length ? 'soon' : 'ok';
  const lights = telltales(c, items, pstate);
  const odoIn = h('input', { type: 'number', min: 0, inputmode: 'numeric', placeholder: 'km on the dash now', 'aria-label': `Odometer for ${c.name}` });
  const saveKm = () => { const v = +odoIn.value; if (!(v > 0)) return toast('Type the km on the dash'); const nc = CC.addReading(c, v, keyOf(new Date())); if (!nc) return toast(`That is less than the last reading (${kmT(odo.last || c.odo)})`, 'err'); putCar(nc); ctx.render(); toast('Reading saved', 'ok'); };
  odoIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveKm(); });
  const tt = (x) => h('button', { class: `tt ${x.state}`, title: x.papers ? 'Papers' : x.worst ? `${x.label}: ${CC.dueText(x.worst, dmy)}` : x.label, 'aria-label': `${x.label}: ${x.state === 'late' ? 'overdue' : x.state === 'soon' ? 'due soon' : x.state === 'ok' ? 'on time' : 'not tracked'}`, onClick: () => x.papers ? ctx.go('papers') : x.worst ? itemSheet(c, x.worst.id) : ctx.go('service') }, icon(x.id), x.label, x.count > 1 ? ` ${x.count}` : '');
  return h('div', { class: 'cluster' },
    h('div', { class: 'cl-top' }, h('div', { class: 'grow' }, h('div', { class: 'cl-name' }, c.name), h('div', { class: 'cl-sub' }, [c.year || '', colourName(c.colour), m?.name && !c.year ? m.name : (c.model === 'camry-2016' ? '2.5 L · 6-speed' : '')].filter(Boolean).join(' · ')), c.plate ? plateBadge(c) : null), h('button', { class: 'btn sm ghost', 'aria-label': `Edit ${c.name}`, onClick: () => carSheet(c) }, '⋯')),
    h('div', { class: 'cl-gauges' }, tacho, h('div', { class: 'cl-side' }, h('div', {}, odometer(odo.km, { guessed: odo.guessed }), h('div', { class: 'odo-line' }, odo.km ? `${odo.guessed ? `≈ from ${dmy(odo.at)} · ` : ''}${kpd ? `${kpd} km a day` : 'two readings a week apart give your km a day'}` : 'Type today’s reading below')), eco)),
    h('div', { class: 'odo-in' }, odoIn, h('button', { class: 'btn sm primary', onClick: saveKm }, 'Save km')),
    h('div', { class: 'telltales', role: 'group', 'aria-label': 'Warning lights' }, lights.map(tt)),
    h('div', { class: 'cl-acts' },
      h('button', { class: 'cl-act', onClick: () => visitSheet(c) }, h('span', {}, '🔧'), 'Log service'),
      h('button', { class: 'cl-act', onClick: () => fuelSheet(c) }, h('span', {}, '⛽'), 'Fuel'),
      h('button', { class: 'cl-act', onClick: () => workshopSheet(c) }, h('span', {}, '🧾'), 'Workshop list'),
      h('button', { class: 'cl-act sos', onClick: () => accidentSheet(c) }, h('span', {}, '🚨'), 'Accident')));
}
function paperTiles(c, now) {
  const d = L.driverOf(S());
  const tile = (ic, label, key, warn) => { const n = L.daysUntil(key, now); return h('button', { class: `tile ${n === null ? 'none' : n < 0 ? 'late' : n <= warn ? 'soon' : ''}`, onClick: () => ctx.go('papers'), 'aria-label': `${label}: ${n === null ? 'not set' : n < 0 ? 'expired' : `${n} days left`}` }, h('span', { class: 'ti' }, ic), h('b', {}, n === null ? '—' : n < 0 ? 'exp.' : n > 365 ? `${(n / 365).toFixed(1)}y` : `${n}d`), h('span', {}, label)); };
  return h('div', { class: 'tiles' }, tile('📄', 'Istimara', c.istimara, 30), tile('🔧', 'Fahas', c.fahas, 30), tile('🛡️', 'Insurance', c.insurance, 21), tile('🪪', 'Licence', d.licence, L.LICENCE_WARN));
}
export function planCard(c, now) {
  const p = c.plan, days = L.daysUntil(p.date, now), added = new Set(p.added || []), shop = S().workshops?.[p.shop];
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('span', { class: 'ic' }, '🗓'), h('div', { class: 'grow' }, h('div', { class: 'title', style: { margin: 0 } }, 'Planned service'), h('div', { class: 'tiny dim' }, [p.date ? `${dmy(p.date)}${days != null ? (days < 0 ? ` · ${-days} d ago` : days === 0 ? ' · today' : ` · in ${days} d`) : ''}` : 'no date yet', `${p.items.length} items`, shop ? shop.name : '', p.eventId ? '📅 in your calendar' : ''].filter(Boolean).join(' · '))), h('button', { class: 'btn sm ghost', onClick: () => planSheet(c) }, 'Edit')),
    p.note ? h('div', { class: 'small', style: { margin: '0 0 8px' } }, p.note) : null,
    h('div', { class: 'chips' }, p.items.slice(0, 12).map(id => h('button', { class: 'chip', onClick: () => itemSheet(c, id) }, `${CC.ITEMS[id].icon} ${CC.ITEMS[id].label}`, added.has(id) ? tag('sug', 'suggested') : null)), p.items.length > 12 ? h('span', { class: 'chip static' }, `+${p.items.length - 12}`) : null),
    h('div', { class: 'row wrap', style: { marginTop: '10px' } }, h('button', { class: 'btn primary', onClick: () => workshopSheet(c) }, '🧾 Show the workshop'), h('button', { class: 'btn', onClick: () => visitSheet(c, p.items) }, '✓ Done — log it'), h('button', { class: 'btn ghost', onClick: () => ctx.quoteSheet(c, null, p.items) }, '💬 Quote')));
}
function tripTeaser(c, now) {
  const t = c.trip; if (!t || t.closed) return h('button', { class: 'card cta', onClick: () => ctx.go('trip') }, h('span', { class: 'ic' }, '🛣️'), h('span', { class: 'grow' }, h('b', {}, 'Road trip?'), h('span', { class: 'tiny dim' }, ' · legs, fuel, what falls due on the way, the checks')), h('span', { class: 'arrow' }, '→'));
  const days = L.daysUntil(t.date, now), due = L.dueByTrip(c, t, now), km = t.km || L.legsTotal(t).km, fu = km ? L.tripFuel(c, km, t.price) : null;
  return h('button', { class: 'card cta trip-hero', onClick: () => ctx.go('trip') }, h('span', { class: 'ic' }, '🛣️'), h('span', { class: 'grow' }, h('b', {}, t.name || 'Road trip'), h('span', { class: 'tiny dim', style: { display: 'block' } }, [t.date ? (days < 0 ? 'on the road' : days === 0 ? 'today' : `in ${days} days`) : '', km ? kmT(km) : '', fu?.sar ? `≈ ${sar(fu.sar)} fuel` : '', due.length ? `${due.length} to do first` : ''].filter(Boolean).join(' · '))), h('span', { class: 'arrow' }, '→'));
}
function moneyCard(c, now) {
  const sm = M.summary(c, now), tc = M.trueCost(c, now);
  if (!sm.year && !c.fuel?.length) return null;
  return h('button', { class: 'card cta', onClick: () => ctx.go('fuel'), style: { display: 'block' } }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, 'Money'), h('span', { class: 'arrow' }, '→')),
    h('div', { class: 'stats' }, stat(sm.month.toLocaleString('en'), 'SAR this month', 'acc'), stat(sm.year.toLocaleString('en'), `SAR in ${now.getFullYear()}`), stat(tc.perKm ? tc.perKm.toFixed(2) : '—', 'SAR per km, all in')));
}
