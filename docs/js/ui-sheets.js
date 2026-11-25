// The sheets every screen opens: a care item (with where it is, what it cost before, its photos), a service visit (with the
// price of each part and the workshop), a fill-up, the car, the insurance (from its PDF), the licence, the tyres, the planned
// service (with your days off and the calendar), the list for the workshop counter, the accident card and photos.
import { h, toast, keyOf, fromKey } from './util.js';
import * as L from './car.js';
import * as CC from './carcare.js';
import * as PO from './policy.js';
import * as AN from './anatomy.js';
import * as GA from './garage.js';
import * as PH from './photos.js';
import { ctx, S, field, dmy, kmT, sar, putCar, undoToast, tel, plateParts, colourName, careRow, tag } from './ui-kit.js';

const sheet = (content, cls = '') => { const b = ctx.sheet(content); if (cls) b.box.classList.add(...cls.split(' ')); return b; };
const foot = (...btns) => h('div', { class: 'row wrap sh-foot' }, ...btns);
const cancel = (box, label = 'Cancel') => h('button', { class: 'btn ghost', onClick: () => box().close() }, label);

// ───────────────────────── a care item
export function itemSheet(c, id) {
  const now = new Date(), st = CC.itemState(c, id, now), iv = st.iv, def = st.def, odo = CC.odoNow(c, now), s = S();
  const d = h('input', { type: 'date', value: st.last || keyOf(now), max: keyOf(now) }), k = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: st.lastKm || (st.last ? '' : Math.round(odo.km) || ''), placeholder: 'km' });
  const ik = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: iv.km || '', placeholder: 'km' }), im = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: iv.months || '', placeholder: 'months' }), idy = h('input', { type: 'number', min: 1, inputmode: 'numeric', value: iv.days || '', placeholder: 'days' });
  const done = () => { const before = S(); putCar(L.afterVisit(CC.logVisit(c, { date: keyOf(now), km: Math.round(odo.km) || 0, items: [id] }), [id])); box.close(); ctx.render(); ctx.cheer?.(); undoToast(`${def.label} done`, before); };
  const inPlan = !!c.plan?.items?.includes(id);
  const togglePlan = () => { const items = inPlan ? c.plan.items.filter(x => x !== id) : [...(c.plan?.items || []), id]; putCar({ ...c, plan: items.length ? { ...(c.plan || {}), date: c.plan?.date || '', note: c.plan?.note || '', added: (c.plan?.added || []).filter(x => items.includes(x)), items: CC.ITEM_ORDER.filter(x => items.includes(x)) } : null }); box.close(); ctx.render(); toast(inPlan ? 'Taken off the plan' : 'Added to the planned service', 'ok'); };
  const prices = GA.priceHistory(s, c.id, id).slice(0, 6), where = AN.partsFor(id), photos = PH.photoList(s, { car: c.id }).filter(p => p.item === id).slice(0, 6);
  const whereBox = where.length ? whereMap(where) : null;
  const box = sheet([h('h2', {}, `${def.icon} ${def.label}`), def.ar ? h('div', { class: 'ar', lang: 'ar', dir: 'rtl', style: { fontSize: '1.35rem', fontWeight: 700, marginBottom: '6px' } }, def.ar) : null, h('div', { class: 'small' }, def.what),
    CC.PARTS[id] && CC.PARTS[id] !== '—' ? h('div', { class: 'note' }, h('b', {}, 'Ask for: '), CC.PARTS[id]) : null, h('div', { class: 'tiny dim', style: { margin: '4px 0 10px' } }, def.why),
    h('div', { class: `item st-${st.state}`, style: { cursor: 'default' } }, h('span', { class: 'ii' }, st.state === 'late' ? '⛔' : st.state === 'soon' ? '⚠️' : st.state === 'ok' ? '✅' : '❔'), h('span', { class: 'im' }, h('span', { class: 'in' }, st.state === 'unknown' ? 'Not set up yet' : CC.dueText(st, dmy)), st.last ? h('span', { class: 'id' }, `Last done ${dmy(st.last)}${st.lastKm ? ` at ${kmT(st.lastKm)}` : ''}${st.count ? ` · ${st.count}× logged` : ''}`) : null)),
    foot(h('button', { class: 'btn primary grow', onClick: done }, 'Done today ✓'), def.days ? null : h('button', { class: 'btn', onClick: togglePlan }, inPlan ? '🗓 Off the plan' : '🗓 Add to plan')),
    prices.length ? h('div', { class: 'an-sec' }, h('b', {}, 'What it has cost'), ...prices.map(p => h('div', { class: 'row small' }, h('span', { class: 'n', style: { minWidth: '72px' } }, dmy(p.date)), h('span', { class: 'grow' }, [p.where, p.part].filter(Boolean).join(' · ') || (p.paid ? 'paid' : 'quoted')), tag(p.paid ? 'ok' : 'sug', p.paid ? 'paid' : 'quote'), h('b', { class: 'n' }, sar(p.price))))) : null,
    whereBox ? h('div', { class: 'an-sec' }, h('b', {}, 'Where it is'), whereBox) : null,
    CC.VOICES[id] ? h('details', { class: 'adv' }, h('summary', { class: 'small' }, 'What Toyota, Saudi workshops and owners say'), ...CC.VOICES[id].map(([who, say]) => h('div', { class: 'an-sec' }, h('b', {}, who), h('span', { class: 'small' }, say)))) : null,
    photos.length ? h('div', { class: 'wallet', style: { margin: '8px 0' } }, photos.map(p => thumb(p))) : null,
    h('details', { class: 'adv' }, h('summary', { class: 'small' }, 'Last done (set it up)'), h('div', { class: 'grid2' }, field('Date', d), def.days ? null : field('At (km)', k)),
      h('button', { class: 'btn sm', onClick: () => { if (!d.value) return; putCar(CC.setLast(c, id, { date: d.value, km: k.value })); box.close(); ctx.render(); toast('Saved', 'ok'); } }, 'Save last done')),
    h('details', { class: 'adv' }, h('summary', { class: 'small' }, 'Interval'), def.days ? h('div', { class: 'grid2' }, field('Every (days)', idy)) : h('div', { class: 'grid2' }, field('Every (km)', ik), field('or every (months)', im)),
      h('div', { class: 'tiny dim' }, `Plan: ${def.days ? `every ${def.days} days` : [def.km || def.nKm ? `${kmT(c.severe !== false ? def.km : def.nKm)}` : '', (c.severe !== false ? def.months : def.nMonths) ? `${c.severe !== false ? def.months : def.nMonths} months` : ''].filter(Boolean).join(' / ')}. Empty = the plan.`),
      h('div', { class: 'row wrap', style: { marginTop: '8px' } }, h('button', { class: 'btn sm', onClick: () => { putCar(CC.setInterval(c, id, def.days ? { days: idy.value } : { km: ik.value, months: im.value })); box.close(); ctx.render(); toast('Interval saved', 'ok'); } }, 'Save interval'),
        h('button', { class: 'btn sm ghost', onClick: () => { putCar(CC.setInterval(c, id, { off: true })); box.close(); ctx.render(); toast(`${def.label} hidden — bring it back from the car’s sheet`); } }, 'Not for my car')))]);
}
/** A small anatomy drawing with the parts for one care item lit up. */
export function whereMap(parts) {
  const view = parts[0].view, wrap = h('div', { class: 'where an-wrap' }); wrap.innerHTML = AN.drawing(view);
  const svg = wrap.firstElementChild; svg.classList.add('dimmed');
  for (const p of parts.filter(x => x.view === view)) svg.querySelector(`[data-part="${p.id}"]`)?.classList.add('lit');
  svg.addEventListener('click', (e) => { const g = e.target.closest('.an-hot'); if (g) ctx.partSheet?.(AN.PARTS.find(p => p.id === g.dataset.part)); });
  return h('div', {}, wrap, h('div', { class: 'tiny dim' }, parts.map(p => `${p.name} (${AN.VIEWS.find(v => v[0] === p.view)[1].toLowerCase()})`).join(' · ')));
}

// ───────────────────────── a service visit: what was done, what each part cost, where
export function visitSheet(c, pre = null) {
  const now = new Date(), s = S(), odo = CC.odoNow(c, now), items = CC.plan(c, now);
  const pick = new Set(pre || items.filter(x => x.state === 'late' || x.state === 'soon').filter(x => !x.def.days).map(x => x.id));
  const d = h('input', { type: 'date', value: keyOf(now), max: keyOf(now) }), k = h('input', { type: 'number', min: 0, inputmode: 'numeric', value: odo.km ? Math.round(odo.km) : '', placeholder: 'km on the dash' });
  const shops = GA.shopList(s), shopSel = h('select', { 'aria-label': 'Workshop' }, h('option', { value: '' }, '— workshop —'), shops.map(w => h('option', { value: w.id, selected: c.plan?.shop === w.id }, w.name)), h('option', { value: '+' }, '+ Another (type below)'));
  const place = h('input', { maxlength: 60, placeholder: 'workshop name', hidden: true }); shopSel.addEventListener('change', () => { place.hidden = shopSel.value !== '+'; if (!place.hidden) place.focus(); });
  const note = h('input', { maxlength: 140, placeholder: 'note (optional)' }), total = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder: 'or the total' });
  const line = {}; const lines = h('div', { class: 'rows' });
  const paintLines = () => lines.replaceChildren(...[...pick].filter(id => CC.ITEMS[id]).map(id => { const L0 = line[id] ||= { price: h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder: 'SAR', 'aria-label': `${CC.ITEMS[id].label} price` }), part: h('input', { maxlength: 60, placeholder: CC.PARTS[id] && CC.PARTS[id] !== '—' ? CC.PARTS[id].split(/[,.—(]/)[0].slice(0, 30) : 'part / brand', 'aria-label': `${CC.ITEMS[id].label} part` }) }; const last = GA.lastPaid(s, c.id, id);
    return h('div', { class: 'item', style: { cursor: 'default', flexWrap: 'wrap' } }, h('span', { class: 'ii' }, CC.ITEMS[id].icon), h('span', { class: 'im' }, h('span', { class: 'in' }, CC.ITEMS[id].label), last ? h('span', { class: 'id' }, `last time ${sar(last.price)}${last.where ? ` at ${last.where}` : ''}`) : null), h('div', { class: 'grid2', style: { width: '100%' } }, L0.part, L0.price)); }));
  // the parts by system, the ones due first in each, so a visit is ticked in a few taps
  const chips = h('div'); const chip = (x) => h('button', { class: `chip ${pick.has(x.id) ? 'sel' : ''}`, 'aria-pressed': String(pick.has(x.id)), onClick: () => { pick.has(x.id) ? pick.delete(x.id) : pick.add(x.id); paint(); } }, `${x.def.icon} ${x.def.label}${x.state === 'late' ? ' ⚠' : ''}`);
  const paint = () => { chips.replaceChildren(...CC.GROUPS.map(([name, icon, ids]) => { const its = ids.map(id => items.find(x => x.id === id)).filter(x => x && (!x.def.days || pick.has(x.id))); return its.length ? h('div', { style: { marginBottom: '6px' } }, h('div', { class: 'tiny dim', style: { margin: '2px 0 4px' } }, `${icon} ${name}`), h('div', { class: 'chips' }, its.map(chip))) : null; })); paintLines(); }; paint();
  let receipt = null; const rc = h('button', { class: 'btn', onClick: async () => { receipt = await ctx.takePhoto({ kind: 'receipt', car: c.id, note: 'Service receipt', save: false }); if (receipt) { rc.textContent = '🧾 Receipt added ✓'; } } }, '🧾 Photo of the receipt');
  const err = h('div', { class: 'err', role: 'alert' });
  const box = sheet([h('h2', {}, `🔧 Service for ${c.name}`), h('div', { class: 'small muted' }, 'Tick what was done. Each ticked item restarts from this date and reading.'), chips,
    h('div', { class: 'grid2', style: { marginTop: '10px' } }, field('Date', d), field('Odometer (km)', k)), field('Workshop', shopSel, place),
    h('details', { class: 'adv', open: pick.size > 0 && pick.size <= 6 }, h('summary', { class: 'small' }, 'Parts and prices (for comparing next time)'), lines), h('div', { class: 'grid2' }, field('Total paid (SAR)', total), field('Note', note)), rc, err,
    foot(h('button', { class: 'btn primary grow', onClick: () => {
      if (!pick.size) { err.textContent = 'Tick at least one thing'; return; }
      const before = S(), last = (c.odoLog || []).filter(r => r.date <= d.value).pop();
      if (+k.value && last && +k.value < last.km) { err.textContent = `The odometer read ${kmT(last.km)} on ${dmy(last.date)} — check the km`; return; }
      const ln = [...pick].map(id => ({ item: id, price: line[id]?.price.value || 0, part: line[id]?.part.value || '' }));
      const shopId = shopSel.value && shopSel.value !== '+' ? shopSel.value : '', shopName = shopId ? s.workshops[shopId]?.name : place.value;
      const visitId = `v${Date.now().toString(36)}`;
      putCar(L.afterVisit(CC.logVisit(c, { date: d.value, km: k.value, items: [...pick], cost: total.value, place: shopName || '', shop: shopId, note: note.value, lines: ln, photos: receipt ? [receipt.id] : [] }), [...pick]));
      if (receipt) ctx.update(st => PH.savePhoto(st, { ...receipt, visit: visitId, date: d.value }));
      box.close(); ctx.render(); ctx.cheer?.(); undoToast(`${pick.size} item${pick.size === 1 ? '' : 's'} logged`, before); } }, 'Save the service'), cancel(() => box))], 'wide');
}

// ───────────────────────── fuel
export function fuelSheet(c) {
  const now = new Date(), odo = CC.odoNow(c, now), lastPrice = (c.fuel || []).filter(f => f.cost && f.litres).slice(-1)[0];
  const d = h('input', { type: 'date', value: keyOf(now), max: keyOf(now) }), l = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder: 'litres', class: 'big', 'aria-label': 'Litres' }), sr = h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', placeholder: 'SAR', class: 'big', 'aria-label': 'Paid (SAR)' }), k = h('input', { type: 'number', min: 0, inputmode: 'numeric', placeholder: odo.km ? `≈ ${Math.round(odo.km)}` : 'km', 'aria-label': 'Odometer (km)' });
  const per = h('div', { class: 'tiny dim' });
  const upd = () => { const a = +l.value, b = +sr.value; per.textContent = a && b ? `${(b / a).toFixed(2)} SAR a litre` : lastPrice ? `Last time ${(lastPrice.cost / lastPrice.litres).toFixed(2)} SAR a litre` : ''; };
  l.addEventListener('input', () => { if (!sr.value && lastPrice && +l.value) sr.placeholder = `≈ ${Math.round(+l.value * lastPrice.cost / lastPrice.litres)}`; upd(); }); sr.addEventListener('input', upd); upd();
  const full = h('input', { type: 'checkbox', checked: true }), trip = c.trip && !c.trip.closed && c.trip.date && c.trip.date <= keyOf(now) && (!c.trip.end || c.trip.end >= keyOf(now)) ? h('input', { type: 'checkbox', checked: true }) : null, err = h('div', { class: 'err', role: 'alert' });
  const box = sheet([h('h2', {}, '⛽ Fill-up'), h('div', { class: 'grid2' }, field('Litres', l), field('Paid (SAR)', sr)), per, h('div', { class: 'grid2', style: { marginTop: '8px' } }, field('Odometer (km)', k), field('Date', d)), h('label', { class: 'row small' }, full, ' Filled to full (needed for L/100 km)'), trip ? h('label', { class: 'row small' }, trip, ` Count it in the trip “${c.trip.name || 'road trip'}”`) : null, err,
    h('div', { class: 'tiny dim' }, 'Fill to full twice with the odometer and Autolime works out your consumption and cost per km.'),
    foot(h('button', { class: 'btn primary grow', onClick: () => { if (!(+l.value > 0)) { err.textContent = 'How many litres?'; return; } const before = S(); let car = CC.addFuel(c, { date: d.value, litres: l.value, cost: sr.value || (lastPrice ? Math.round(+l.value * lastPrice.cost / lastPrice.litres * 100) / 100 : 0), km: k.value, full: full.checked });
      if (trip?.checked) car = { ...car, trip: { ...car.trip, log: [...(car.trip.log || []), { date: d.value, kind: 'fuel', sar: +sr.value || 0, litres: +l.value, note: '', at: Date.now() }] } };
      putCar(car); box.close(); ctx.render(); undoToast('Fill-up saved', before); } }, 'Save'), cancel(() => box))]);
}

// ───────────────────────── the car
export function carSheet(c, base = null) {
  const isNew = !c, now = new Date(), src = c || base || CC.fromModel('generic');
  const n = h('input', { value: src.name || '', maxlength: 40, placeholder: 'e.g. Camry' }), ic = h('input', { value: src.icon || '🚗', style: { width: '70px' }, 'aria-label': 'Icon' });
  const model = h('select', {}, Object.entries(CC.MODELS).map(([id, m]) => h('option', { value: id, selected: (src.model || 'generic') === id }, m.name)));
  const dates = Object.fromEntries(L.CAR_PAPERS.map(([k]) => [k, h('input', { type: 'date', value: src[k] || '' })]));
  const odo = h('input', { type: 'number', min: 0, inputmode: 'numeric', placeholder: c?.odo ? `${c.odo}` : 'km now' }), err = h('div', { class: 'err', role: 'alert' });
  const hidden = Object.entries(src.care || {}).filter(([, v]) => v.off).map(([id]) => id);
  const idf = { plate: h('input', { value: src.plate || '', maxlength: 24, placeholder: 'د أ أ 1234', dir: 'auto' }), plateLatin: h('input', { value: src.plateLatin || '', maxlength: 12, placeholder: 'A A D' }), vin: h('input', { value: src.vin || '', maxlength: 17, placeholder: '17 characters', autocapitalize: 'characters' }),
    year: h('input', { type: 'number', min: 1950, max: 2100, value: src.year || '' }), colour: h('input', { value: src.colour || '', maxlength: 24, placeholder: 'Light blue' }) };
  const box = sheet([h('h2', {}, isNew ? 'Your car' : c.name), h('div', { class: 'row', style: { alignItems: 'end' } }, field('Icon', ic), h('div', { class: 'grow' }, field('Name', n))), field('Model', model),
    h('div', { class: 'grid3' }, ...L.CAR_PAPERS.map(([k, label]) => field(`${label.replace(/ \(.*\)$/, '')} expires`, dates[k]))), field(isNew ? 'Odometer now (km)' : 'New odometer reading (km)', odo),
    h('details', { class: 'adv', open: isNew }, h('summary', { class: 'small' }, 'Plate, VIN, year, colour'), h('div', { class: 'grid2' }, field('Plate (Arabic)', idf.plate), field('Plate (Latin)', idf.plateLatin)), field('VIN (on the istimara)', idf.vin), h('div', { class: 'grid2' }, field('Model year', idf.year), field('Colour', idf.colour))),
    hidden.length ? h('div', { class: 'chips' }, h('span', { class: 'tiny dim' }, 'Hidden:'), hidden.map(id => h('button', { class: 'chip', onClick: () => { putCar(CC.setInterval(c, id, { off: false })); box.close(); ctx.render(); } }, `${CC.ITEMS[id].icon} ${CC.ITEMS[id].label} — show`))) : null, err,
    foot(h('button', { class: 'btn primary grow', onClick: () => {
      if (!n.value.trim()) { err.textContent = 'Give it a name'; return; }
      let car = { ...src, ...(c || {}), id: c?.id, name: n.value, icon: ic.value, model: model.value, ...Object.fromEntries(Object.entries(dates).map(([k, i]) => [k, i.value])), ...Object.fromEntries(Object.entries(idf).map(([k, i]) => [k, i.value])) };
      if (idf.vin.value.trim() && !PO.vinInfo(idf.vin.value).ok) { err.textContent = 'A VIN has 17 letters and numbers (no I, O or Q)'; return; }
      if (+odo.value) { const r = CC.addReading(car, odo.value, keyOf(now)); if (!r) { err.textContent = 'That is less than the last reading'; return; } car = r; }
      ctx.update(s => L.saveCar(s, car, now)); box.close(); ctx.render(); toast(isNew ? `${car.name} added — now say when things were last done` : 'Saved', 'ok'); } }, 'Save'),
      !isNew ? h('button', { class: 'btn danger', onClick: () => { const before = S(); ctx.update(s => L.deleteCar(s, c.id)); box.close(); ctx.render(); undoToast(`${c.name} removed`, before); } }, 'Remove') : null, cancel(() => box))]);
}
export function tyreSheet(c) {
  const t = c.tyre || {}, f = { brand: h('input', { value: t.brand || '', maxlength: 40, placeholder: 'Brand and model' }), size: h('input', { value: t.size || '', maxlength: 24, placeholder: '215/60R16 99V' }), dot: h('input', { value: t.dot || '', maxlength: 4, inputmode: 'numeric', placeholder: 'YYYY' }),
    warranty: h('input', { type: 'number', min: 0, max: 10, value: t.warranty || '' }), fitted: h('input', { type: 'date', value: t.fitted || '' }), qty: h('input', { type: 'number', min: 1, max: 6, value: t.qty || 4 }), cost: h('input', { type: 'number', min: 0, step: 'any', value: t.cost || '' }), where: h('input', { value: t.where || '', maxlength: 60 }) };
  const box = sheet([h('h2', {}, '🛞 Tyres'), field('Brand and model', f.brand), h('div', { class: 'grid2' }, field('Size', f.size), field('DOT year', f.dot)), h('div', { class: 'grid3' }, field('Fitted', f.fitted), field('How many', f.qty), field('Warranty (years)', f.warranty)), h('div', { class: 'grid2' }, field('Paid (SAR)', f.cost), field('Where', f.where)),
    foot(h('button', { class: 'btn primary grow', onClick: () => { const before = S(); let car = { ...c, tyre: Object.fromEntries(Object.entries(f).map(([k, i]) => [k, i.value])) }; if (f.fitted.value && f.fitted.value !== t.fitted) car = CC.setLast(CC.setLast(car, 'tyres', { date: f.fitted.value }), 'balancing', { date: f.fitted.value }); putCar(car); box.close(); ctx.render(); undoToast('Tyres saved', before); } }, 'Save'), cancel(() => box))]);
}

// ───────────────────────── the planned service: parts, a day (your days off first), the calendar, the workshop
export function planSheet(c) {
  const p = c.plan || { date: '', items: [], added: [], note: '' }, pick = new Set(p.items), now = new Date(), s = S();
  const d = h('input', { type: 'date', value: p.date, min: keyOf(now) }), note = h('input', { value: p.note || '', maxlength: 140, placeholder: 'e.g. before the road trip' });
  const shops = GA.shopList(s), shop = h('select', {}, h('option', { value: '' }, '— not chosen —'), shops.map(w => h('option', { value: w.id, selected: p.shop === w.id }, `${w.name}${w.area ? ` · ${w.area}` : ''}`)));
  const off = ctx.daysOff ? ctx.daysOff(now, new Date(now.getFullYear(), now.getMonth(), now.getDate() + 35)) : [];
  const offChips = off.length ? h('div', { class: 'chips', style: { marginBottom: '8px' } }, h('span', { class: 'tiny dim', style: { width: '100%' } }, 'Your days off (from Mandarin):'), off.slice(0, 10).map(k => h('button', { class: 'chip', onClick: (e) => { d.value = k; for (const b of e.currentTarget.parentNode.querySelectorAll('.chip')) b.classList.toggle('sel', b === e.currentTarget); } }, `${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][fromKey(k).getDay()]} ${dmy(k).slice(0, 5)}`))) : null;
  const items = CC.plan(c, now), wrap = h('div');
  const paint = () => wrap.replaceChildren(...CC.GROUPS.map(([name, icon, ids]) => { const its = ids.filter(id => items.some(x => x.id === id) && !CC.ITEMS[id].days); if (!its.length) return null;
    return h('div', { style: { marginBottom: '8px' } }, h('div', { class: 'tiny dim' }, `${icon} ${name}`), h('div', { class: 'chips' }, its.map(id => { const st0 = items.find(x => x.id === id); return h('button', { class: `chip ${pick.has(id) ? 'sel' : ''}`, 'aria-pressed': String(pick.has(id)), onClick: () => { pick.has(id) ? pick.delete(id) : pick.add(id); paint(); } }, `${CC.ITEMS[id].label}${st0.state === 'late' ? ' ⚠' : ''}`); }))); }));
  paint();
  const cal = h('input', { type: 'checkbox', checked: !!p.eventId || ctx.signedIn() });
  const box = sheet([h('h2', {}, '🗓 Plan a service'), offChips, h('div', { class: 'grid2' }, field('When', d), field('Workshop', shop)), field('Note', note),
    ctx.signedIn() ? h('label', { class: 'row small', style: { marginBottom: '8px' } }, cal, ' Put the service day in my Google Calendar (09:00–12:00)') : null,
    h('div', { class: 'row wrap', style: { gap: '6px', margin: '4px 0 8px' } }, h('button', { class: 'btn sm', onClick: () => { for (const x of items) if ((x.state === 'late' || x.state === 'soon') && !x.def.days) pick.add(x.id); paint(); } }, '+ Everything due'), h('button', { class: 'btn sm ghost', onClick: () => { pick.clear(); paint(); } }, 'Clear')),
    wrap,
    foot(h('button', { class: 'btn primary grow', onClick: async () => {
      const before = S(), plan = pick.size ? { ...p, date: d.value, items: CC.ITEM_ORDER.filter(i => pick.has(i)), added: (p.added || []).filter(i => pick.has(i)), note: note.value, shop: shop.value } : null;
      putCar({ ...c, plan }); box.close(); ctx.render(); undoToast(pick.size ? `${pick.size} items planned` : 'Plan cleared', before);
      if (ctx.signedIn()) ctx.calendarForPlan(c.id, cal?.checked && plan?.date ? plan : null, c.plan).catch(e => toast(`Calendar: ${e.message}`, 'err'));
    } }, 'Save the plan'), cancel(() => box))], 'wide');
}
/** The list to show at the counter: big Arabic first, English and the part to ask for under it, the car's details on top. */
export function workshopSheet(c) {
  const s = S(), ids = c.plan?.items?.length ? c.plan.items : CC.plan(c, new Date()).filter(x => (x.state === 'late' || x.state === 'soon') && !x.def.days).map(x => x.id);
  const m = CC.MODELS[c.model], odo = CC.odoNow(c, new Date()), done = new Set();
  const list = h('ol', { class: 'wlist' });
  const paint = () => list.replaceChildren(...ids.map(id => { const d = CC.ITEMS[id], last = GA.lastPaid(s, c.id, id); return h('li', { class: done.has(id) ? 'done' : '', onClick: () => { done.has(id) ? done.delete(id) : done.add(id); paint(); } }, h('div', { class: 'war', lang: 'ar' }, d.ar), h('div', { class: 'row' }, h('span', { class: 'small grow' }, `${d.icon} ${d.label}`), last ? h('span', { class: 'price tiny' }, `last ${sar(last.price)}`) : null), CC.PARTS[id] && CC.PARTS[id] !== '—' ? h('div', { class: 'tiny dim' }, CC.PARTS[id]) : null); }));
  paint();
  const carAr = [c.model === 'camry-2016' ? 'تويوتا كامري ٢٠١٦ — مكينة ٢٫٥ (2AR-FE)' : c.name, odo.km ? `الممشى: ${Math.round(odo.km).toLocaleString('ar-SA')} كم` : ''].filter(Boolean);
  const box = sheet([h('h2', {}, '🧾 For the workshop'),
    h('div', { class: 'wcar' }, carAr.map(t => h('div', { class: 'ar', dir: 'rtl', lang: 'ar' }, t)), c.vin ? h('div', { class: 'n', style: { fontSize: '1.2rem', letterSpacing: '.08em' } }, `VIN ${c.vin}`) : null, m?.facts?.length ? h('div', { class: 'tiny dim' }, m.facts.slice(0, 4).map(([k, v]) => `${k}: ${v}`).join(' · ')) : null),
    ids.length ? list : h('div', { class: 'small' }, 'Nothing planned or due. Plan a service first.'),
    h('div', { class: 'tiny dim' }, 'Tap a line to tick it off at the counter. The part makes are common good choices; the shop matches the exact part to the VIN.'),
    foot(h('button', { class: 'btn', onClick: () => shareList(c, ids) }, '📤 Share'), h('button', { class: 'btn', onClick: () => { box.close(); ctx.quoteSheet(c, null, ids); } }, '💬 Note their prices'), h('button', { class: 'btn ghost grow', onClick: () => box.close() }, 'Close'))], 'wide wsheet');
}
export function shareList(c, ids = c.plan?.items || []) {
  const odo = CC.odoNow(c, new Date());
  const text = [`${c.name}${c.year ? ` ${c.year}` : ''}${c.vin ? ` — VIN ${c.vin}` : ''}${odo.km ? ` — ${Math.round(odo.km).toLocaleString('en')} km` : ''}`, '', ...ids.map((id, i) => `${i + 1}. ${CC.ITEMS[id].ar} — ${CC.ITEMS[id].label}`)].join('\n');
  if (navigator.share) navigator.share({ title: `${c.name}: service list`, text }).catch(() => {});
  else navigator.clipboard?.writeText(text).then(() => toast('List copied', 'ok'), () => toast(text));
}

// ───────────────────────── the accident card (one tap from the top bar, ?do=accident and the home-screen shortcut)
export function accidentSheet(c) {
  const s = S(), dr = L.driverOf(s), i = c?.ins, pp = c ? plateParts(c) : null;
  const shots = PH.photoList(s, { car: c?.id, kind: 'accident' }).filter(p => p.date === keyOf(new Date()));
  const box = sheet([h('h2', {}, '🚨 After an accident'),
    h('div', { class: 'calls' }, PO.CALLS.slice(0, 4).map(([l, n, ic]) => h('a', { class: `btn ${n === '199033' ? 'sos' : ''}`, href: n === '920000560' ? 'https://wa.me/966920000560' : tel(n), target: n === '920000560' ? '_blank' : null, rel: 'noopener' }, `${ic} ${l.replace(/ \(.*\)/, '')}`, h('br'), h('b', { class: 'n' }, n))),
      i?.phone ? h('a', { class: 'btn', href: tel(i.phone), style: { gridColumn: '1 / -1' } }, `🛡️ ${i.company || 'Insurer'} · ${i.phone}`) : null),
    h('button', { class: 'btn primary', style: { width: '100%', minHeight: '56px', fontSize: '1.05rem' }, onClick: async () => { const p = await ctx.takePhoto({ kind: 'accident', car: c?.id || '', note: 'Accident' }); if (p) { box.close(); accidentSheet(c); } } }, `📷 Take photos${shots.length ? ` (${shots.length} today)` : ''}`),
    h('div', { class: 'tiny dim', style: { margin: '4px 0 10px' } }, 'Saved on this phone at once, then to your Drive (Car - Autolime › photos › accident). Both cars from all sides, the plates, the damage, the road.'),
    shots.length ? h('div', { class: 'wallet', style: { marginBottom: '10px' } }, shots.map(p => thumb(p))) : null,
    c ? h('div', { class: 'card', style: { boxShadow: 'none' } }, h('div', { class: 'tiny dim', style: { marginBottom: '6px' } }, 'Read these out when asked'), h('div', { class: 'read-out' },
      ...[c.plate ? ['Plate', `${c.plate}${pp ? ` (${pp.digits} ${pp.lat.join(' ')})` : ''}`] : null, c.vin ? ['VIN', c.vin] : null, i?.company ? ['Insurer', i.company] : null, i?.policy ? ['Policy', i.policy] : null, i?.kind ? ['Cover', L.INS_KIND[i.kind]] : null, dr.blood ? ['Your blood type', dr.blood] : null, dr.ice ? ['Emergency contact', dr.ice] : null]
        .filter(Boolean).flatMap(([k, v]) => [h('span', { class: 'tiny dim' }, k), h('b', {}, v)]))) : null,
    h('ol', { class: 'how' }, PO.ACCIDENT_STEPS.map(([t, b]) => h('li', {}, h('b', {}, t), h('span', { class: 'small' }, b)))),
    foot(h('button', { class: 'btn ghost grow', onClick: () => box.close() }, 'Close'))]);
}

// ───────────────────────── papers: insurance (from the PDF), the licence, a setup proposal
export function driverSheet() {
  const d = L.driverOf(S());
  const lic = h('input', { type: 'date', value: d.licence }), iss = h('input', { type: 'date', value: d.issued }), ty = h('select', {}, ['Private', 'Public', 'Motorcycle', 'Heavy', 'Temporary'].map(x => h('option', { selected: d.type === x }, x)));
  const bl = h('select', {}, ['', 'O-', 'O+', 'A-', 'A+', 'B-', 'B+', 'AB-', 'AB+'].map(x => h('option', { value: x, selected: d.blood === x }, x || '—'))), ice = h('input', { value: d.ice, maxlength: 40, placeholder: 'e.g. Brother 05x xxx xxxx' });
  const box = sheet([h('h2', {}, '🪪 Your licence'), h('div', { class: 'grid2' }, field('Expires', lic), field('Issued', iss)), field('Type', ty),
    h('div', { class: 'grid2' }, field('Blood type (optional)', bl), field('Emergency contact (optional)', ice)),
    h('div', { class: 'tiny dim' }, 'Blood type and the emergency contact only show on the accident card. Renew the licence in Absher.'),
    foot(h('button', { class: 'btn primary grow', onClick: () => { const before = S(); ctx.update(st => L.setDriver(st, { licence: lic.value, issued: iss.value, type: ty.value, blood: bl.value, ice: ice.value })); box.close(); ctx.render(); undoToast('Saved', before); } }, 'Save'), cancel(() => box))]);
}
/** Insurance: typed, or read from the policy PDF / pasted text. With no car yet, the policy starts one (make, model, year, plate, VIN). */
export function insSheet(c) {
  const i = c?.ins || {}, file = h('input', { type: 'file', accept: 'application/pdf,.pdf', class: 'sr-only', 'aria-label': 'Policy PDF' });
  const f = { company: h('input', { value: i.company || '', maxlength: 40, list: 'al-insurers' }), policy: h('input', { value: i.policy || '', maxlength: 48 }), kind: h('select', {}, [['', '—'], ['third', 'Third party'], ['comp', 'Comprehensive']].map(([v, l]) => h('option', { value: v, selected: (i.kind || '') === v }, l))),
    start: h('input', { type: 'date', value: i.start || '' }), end: h('input', { type: 'date', value: c?.insurance || '' }), premium: h('input', { type: 'number', min: 0, step: 'any', value: i.premium ?? '' }), deductible: h('input', { type: 'number', min: 0, step: 'any', value: i.deductible ?? '' }),
    phone: h('input', { value: i.phone || '', maxlength: 20, inputmode: 'tel' }), repair: h('input', { value: i.repair || '', maxlength: 40 }) };
  let extra = { perks: i.perks || [], limit: i.limit || '' }, carBits = {};
  const found = h('div', { class: 'note', role: 'status', hidden: true }), paste = h('textarea', { rows: 3, placeholder: 'Or paste the policy text here' });
  const say = (cls, t) => { found.hidden = false; found.className = `note ${cls}`; found.textContent = t; };
  const apply = (p) => {
    if (!p.found.length) return say('bad', 'Nothing recognisable in that — type the details below.');
    for (const k of ['company', 'policy', 'kind', 'start', 'phone', 'repair']) if (p[k]) f[k].value = p[k];
    if (p.end) f.end.value = p.end; if (p.premium != null) f.premium.value = p.premium; if (p.deductible != null) f.deductible.value = p.deductible;
    extra = { perks: p.perks || extra.perks, limit: p.limit || extra.limit }; carBits = { vin: p.vin, plate: p.plate, year: p.year, make: p.make, modelName: p.modelName };
    say('', `Found: ${p.found.join(', ')}. Check them, then Save.`);
  };
  file.addEventListener('change', async () => {
    const fl = file.files?.[0]; if (!fl) return; say('', 'Reading the PDF…');
    try { const { pdfText } = await import('./pdftext.js'); apply(PO.parsePolicy(await pdfText(fl))); } catch (e) { say('bad', `Couldn’t read that PDF (${e.message}). Paste its text instead.`); }
    file.value = '';
  });
  paste.addEventListener('input', () => { if (paste.value.trim().length > 40) apply(PO.parsePolicy(paste.value)); });
  const box = sheet([h('h2', {}, c ? `🛡️ ${c.name}: insurance` : '📄 Start from your policy'),
    h('label', { class: 'btn primary', style: { width: '100%' } }, file, '📄 Read my policy PDF'), h('div', { class: 'tiny dim', style: { margin: '4px 0 8px' } }, 'Read on this phone only: the PDF isn’t uploaded or kept. Your name, ID and date of birth on it are ignored.'), paste, found,
    h('datalist', { id: 'al-insurers' }, PO.INSURERS.map(([n]) => h('option', { value: n }))),
    h('div', { class: 'grid2', style: { marginTop: '10px' } }, field('Insurer', f.company), field('Cover', f.kind)), field('Policy number', f.policy), h('div', { class: 'grid2' }, field('Starts', f.start), field('Ends', f.end)),
    h('div', { class: 'grid3' }, field('Paid (SAR)', f.premium), field('Deductible', f.deductible), field('Helpline', f.phone)), field('Repairs', f.repair),
    foot(h('button', { class: 'btn primary grow', onClick: () => {
      const ins = { company: f.company.value, policy: f.policy.value, kind: f.kind.value, start: f.start.value, premium: f.premium.value, deductible: f.deductible.value, phone: f.phone.value, repair: f.repair.value, ...extra };
      const before = S(); let car;
      if (c) car = { ...c, ins, insurance: f.end.value || c.insurance };
      else {
        const camry = /camry/i.test(carBits.modelName || '') && (carBits.year === 2016 || !carBits.year);
        const base = CC.fromModel(camry ? 'camry-2016' : 'generic');
        car = { ...base, name: carBits.modelName ? `${carBits.make || ''} ${carBits.modelName}`.trim() : base.name || 'My car', vin: carBits.vin, plate: carBits.plate, year: carBits.year, ins, insurance: f.end.value };
      }
      ctx.update(st => L.saveCar(st, car)); box.close(); ctx.render(); undoToast(c ? 'Insurance saved' : `${car.name} added from your policy`, before);
    } }, 'Save'), cancel(() => box))]);
}
/** A setup link (…#setup=<base64url JSON>, never sent to a server) or setup.json on Drive proposes a car + papers + policy + licence; nothing is kept until tapped. */
export function setupSheet(o, { onAdded } = {}) {
  const car = o?.car || {}, dr = o?.driver || null;
  if (!car.name && !dr) { onAdded?.(); toast('Nothing new to add'); return; }
  const existing = L.carList(S()).find(x => (car.vin && x.vin === car.vin) || (!car.vin && x.name === car.name));
  const lines = [car.name && `🚗 ${car.name}${car.year ? ` ${car.year}` : ''}${car.colour ? `, ${colourName(car.colour).toLowerCase()}` : ''}`, car.plate && `🔢 Plate ${car.plate}${car.plateLatin ? ` (${car.plateLatin})` : ''}`, car.vin && `🧬 VIN ${car.vin}`,
    car.istimara && `📄 Istimara until ${dmy(car.istimara)}`, car.fahas && `🔧 Fahas until ${dmy(car.fahas)}`, car.insurance && `🛡️ ${car.ins?.company || 'Insurance'} until ${dmy(car.insurance)}${car.ins?.kind ? ` · ${L.INS_KIND[car.ins.kind]}` : ''}`,
    dr?.licence && `🪪 Licence until ${dmy(dr.licence)}`, car.tyre && `🛞 ${car.tyre.brand || 'Tyres'} ${car.tyre.size || ''}${car.tyre.fitted ? `, fitted ${dmy(car.tyre.fitted)}` : ''}`, car.plan && `🗓 Planned service${car.plan.date ? ` ${dmy(car.plan.date)}` : ''}: ${car.plan.items?.length || 0} items`, car.trip && `🛣️ ${car.trip.name || 'Road trip'}${car.trip.date ? ` from ${dmy(car.trip.date)}` : ''}`].filter(Boolean);
  const box = sheet([h('h2', {}, car.name ? (existing ? `Update ${existing.name}?` : 'Add your car?') : 'Add this to Autolime?'), h('ul', { class: 'small' }, lines.map(l => h('li', {}, l))),
    h('div', { class: 'tiny dim' }, existing ? 'Your care plan, readings and history stay as they are.' : 'Then say when the oil and the rest were last done to start the countdowns.'),
    foot(h('button', { class: 'btn primary grow', onClick: () => {
      const before = S();
      ctx.update(st => { let n = st; if (!car.name) { if (dr) n = L.setDriver(n, dr); return n; } const base = existing || { ...CC.fromModel(car.model && CC.MODELS[car.model] ? car.model : 'generic') }; n = L.saveCar(n, { ...base, ...car, id: existing?.id, care: { ...(car.care || {}), ...(base.care || {}) }, odoLog: base.odoLog?.length ? base.odoLog : car.odoLog || [], log: [...(base.log || []), ...(car.log || []).filter(x => !(base.log || []).some(y => y.date === x.date && y.what === x.what))].sort((a, b) => a.date.localeCompare(b.date)), fuel: base.fuel?.length ? base.fuel : car.fuel || [], ins: { ...(base.ins || {}), ...(car.ins || {}) }, plan: base.plan || car.plan, trip: base.trip || car.trip, tyre: base.tyre || car.tyre }); if (dr) n = L.setDriver(n, dr); return n; });
      box.close(); ctx.go('dash'); onAdded?.(); undoToast(!car.name ? 'Added' : existing ? 'Updated' : 'Car added', before);
    } }, existing ? 'Update' : 'Add it'), cancel(() => box, 'Not now'))]);
}

// ───────────────────────── photos
export function thumb(p, { label = true } = {}) {
  const img = h('img', { alt: '', loading: 'lazy' }), btn = h('button', { class: 'thumb', 'aria-label': `${PH.kindOf(p.kind)[1]} ${dmy(p.date)}`, onClick: () => photoSheet(p) }, img, label ? h('span', { class: 'tl tiny' }, `${PH.kindOf(p.kind)[2]} ${dmy(p.date).slice(0, 5)}`) : null, p.file ? null : h('span', { class: 'pend' }, 'on this phone'));
  ctx.photoUrl(p).then(u => { if (u) img.src = u; else img.replaceWith(h('span', {}, PH.kindOf(p.kind)[2])); }).catch(() => img.replaceWith(h('span', {}, PH.kindOf(p.kind)[2])));
  return btn;
}
export function photoSheet(p) {
  const img = h('img', { class: 'photo-big', alt: `${PH.kindOf(p.kind)[1]} photo` }); ctx.photoUrl(p).then(u => { if (u) img.src = u; else img.alt = 'Not on this device yet — it is on the phone that took it until that one syncs'; }).catch(e => { img.alt = e.message; });
  const note = h('input', { value: p.note || '', maxlength: 140, placeholder: 'Note' });
  const box = sheet([h('h2', {}, `${PH.kindOf(p.kind)[2]} ${PH.kindOf(p.kind)[1]} · ${dmy(p.date)}`), img, field('Note', note),
    h('div', { class: 'tiny dim' }, p.file ? 'Kept in your Drive: Car - Autolime › photos.' : 'Kept on this phone; it goes to your Drive on the next sync.'),
    foot(h('button', { class: 'btn primary grow', onClick: () => { ctx.update(st => PH.savePhoto(st, { ...p, note: note.value })); box.close(); ctx.render(); } }, 'Save'), h('button', { class: 'btn danger', onClick: () => { const before = S(); ctx.update(st => PH.deletePhoto(st, p.id)); ctx.binPhoto(p); box.close(); ctx.render(); undoToast('Photo removed', before); } }, 'Remove'), cancel(() => box, 'Close'))], 'wide');
}
export { careRow };
