// Garage: the workshops you use (and what they did), quotes side by side, engine-light codes in plain words, the dashboard
// lights, "what does this noise mean" guided checks, and the car's anatomy with the Arabic names and a Find-it game.
import { h, toast, keyOf } from './util.js';
import * as L from './car.js';
import * as CC from './carcare.js';
import * as AN from './anatomy.js';
import * as GA from './garage.js';
import * as OBD from './obd.js';
import * as NZ from './noises.js';
import { ctx, S, field, dmy, sar, currentCar, carChips, viewHead, tag, undoToast, tel, careRow } from './ui-kit.js';
import { itemSheet } from './ui-sheets.js';

let part = 'shops', codeQ = '', symId = '', picks = [], anView = 'bay', game = null, cmp = new Set();
const PARTS = [['shops', '🔧', 'Workshops', 'and quotes side by side'], ['codes', '🟠', 'Codes', 'engine light in plain words'], ['noises', '👂', 'Noises', 'what is that sound?'], ['anatomy', '🔍', 'Anatomy', 'every part, in Arabic too']];
export function garagePart(p) { if (PARTS.some(x => x[0] === p)) part = p; }
export function renderGarage() {
  const s = S(), c = currentCar(s);
  return [viewHead('Garage'), carChips(s),
    h('div', { class: 'garage-tiles', role: 'tablist' }, PARTS.map(([id, ic, t, sub]) => h('button', { class: `gt ${part === id ? 'active' : ''}`, role: 'tab', 'aria-selected': String(part === id), onClick: () => { part = id; ctx.render(); } }, h('span', {}, ic), h('b', {}, t), h('small', {}, sub)))),
    ...(part === 'codes' ? codesView(c) : part === 'noises' ? noisesView(c) : part === 'anatomy' ? anatomyView(c) : shopsView(s, c))];
}

// ───────────────────────── workshops + quotes
function shopsView(s, c) {
  const shops = GA.shopList(s), quotes = GA.quotesFor(s, c?.id);
  const sel = quotes.filter(q => cmp.has(q.id));
  return [h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, `Your workshops${shops.length ? ` · ${shops.length}` : ''}`), h('button', { class: 'btn sm primary', onClick: () => shopSheet(null) }, '+ Workshop')),
      shops.length ? h('div', { class: 'rows' }, shops.map(w => { const k = GA.KINDS.find(x => x[0] === w.kind) || GA.KINDS[0], v = GA.shopVisits(s, w);
        return h('button', { class: 'shop', onClick: () => shopSheet(w) }, h('span', { class: 'ic' }, k[2]), h('span', {}, h('b', {}, w.name), h('div', { class: 'tiny dim' }, [k[1], w.area, v.length ? `${v.length} visit${v.length === 1 ? '' : 's'}, last ${dmy(v[0].date)}` : ''].filter(Boolean).join(' · '))), w.rating ? h('span', { class: 'stars', 'aria-label': `${w.rating} of 5` }, '★'.repeat(w.rating)) : null); }))
        : h('div', { class: 'small muted' }, 'Keep the independent workshops you trust in Riyadh — name, area, phone, map pin, your own rating — and what each one did on your car.')),
    h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, `Quotes${quotes.length ? ` · ${quotes.length}` : ''}`), c ? h('button', { class: 'btn sm primary', onClick: () => quoteSheet(c, null, c.plan?.items || []) }, '+ Quote') : null),
      quotes.length ? [h('div', { class: 'tiny dim', style: { marginBottom: '6px' } }, 'Tick two or more to compare them line by line.'), h('div', { class: 'rows' }, quotes.map(q => h('div', { class: 'item', style: { cursor: 'default' } }, h('input', { type: 'checkbox', checked: cmp.has(q.id), 'aria-label': `Compare ${GA.quoteShop(s, q)}`, onChange: (e) => { e.target.checked ? cmp.add(q.id) : cmp.delete(q.id); ctx.render(); } }), h('button', { class: 'im', style: { background: 'none', border: 0, color: 'inherit', textAlign: 'left', font: 'inherit', cursor: 'pointer', padding: 0 }, onClick: () => quoteSheet(c, q) }, h('span', { class: 'in' }, GA.quoteShop(s, q)), h('span', { class: 'id' }, `${dmy(q.date)} · ${q.lines.length} line${q.lines.length === 1 ? '' : 's'}`)), h('b', { class: 'val' }, sar(GA.quoteTotal(q))))))]
        : h('div', { class: 'small muted' }, 'Ask two workshops for prices on the same list (the planned service is filled in for you) and see which is cheaper for the same work.')),
    sel.length >= 2 ? compareCard(s, sel) : null];
}
function compareCard(s, quotes) {
  const r = GA.compare(quotes);
  const el = h('div', { class: 'card' }, h('div', { class: 'title' }, 'Side by side'), h('div', { class: 'qt-wrap' }, h('table', { class: 'qt' },
    h('thead', {}, h('tr', {}, h('th', {}, 'Item'), quotes.map(q => h('th', {}, GA.quoteShop(s, q))))),
    h('tbody', {}, r.rows.map(row => h('tr', {}, h('td', {}, row.name), row.cells.map(cell => cell ? h('td', { class: row.best != null && cell.price === row.best ? 'best' : '' }, cell.price ? cell.price.toLocaleString('en') : '—', cell.part ? h('div', { class: 'tiny dim' }, cell.part) : null) : h('td', { class: 'none' }, 'not quoted'))))),
    h('tfoot', {}, h('tr', {}, h('td', {}, r.shared < r.rows.length ? `Same ${r.shared} items` : 'Total'), r.totals.map((t, i) => h('td', { class: r.cheapest === i ? 'win' : '' }, r.shared < r.rows.length ? t.shared.toLocaleString('en') : t.all.toLocaleString('en'))))))),
    r.cheapest != null ? h('div', { class: 'note' }, `${GA.quoteShop(s, quotes[r.cheapest])} is cheaper by ${sar(Math.max(...r.totals.map(t => t.shared)) - r.totals[r.cheapest].shared)} for the ${r.shared} items they all priced.${r.totals.some(t => t.missing) ? ' Some items are only in one quote — ask the other for them.' : ''}`) : null,
    h('div', { class: 'tiny dim' }, 'Cheapest per line in green. Same parts? The part names are under the prices: an Advics pad and a no-name pad are not the same price.'));
  return el;
}
export function shopSheet(w) {
  const isNew = !w, x = w || { name: '', kind: 'general', area: '', phone: '', map: '', rating: 0, note: '' }, s = S();
  const f = { name: h('input', { value: x.name, maxlength: 50, placeholder: 'e.g. Abu Fahad workshop' }), kind: h('select', {}, GA.KINDS.map(([id, l, ic]) => h('option', { value: id, selected: x.kind === id }, `${ic} ${l}`))), area: h('input', { value: x.area, maxlength: 40, placeholder: 'e.g. Sinaiyah, Riyadh' }), phone: h('input', { value: x.phone, maxlength: 20, inputmode: 'tel', placeholder: '05x xxx xxxx' }), map: h('input', { value: x.map, maxlength: 300, placeholder: 'Google Maps link' }), note: h('textarea', { rows: 2, maxlength: 200, placeholder: 'What they are good at, who to ask for' }, x.note) };
  let rating = x.rating || 0; const stars = h('div', { class: 'stars', role: 'radiogroup', 'aria-label': 'Your rating' });
  const paintStars = () => stars.replaceChildren(...[1, 2, 3, 4, 5].map(n => h('button', { type: 'button', class: n <= rating ? 'on' : '', role: 'radio', 'aria-checked': String(n === rating), 'aria-label': `${n} star${n === 1 ? '' : 's'}`, onClick: () => { rating = rating === n ? 0 : n; paintStars(); } }, '★'))); paintStars();
  const visits = w ? GA.shopVisits(s, w) : [];
  const ph = w?.phone ? `+966${w.phone.replace(/\D/g, '').replace(/^966/, '').replace(/^0/, '')}` : '';
  const box = ctx.sheet([h('h2', {}, isNew ? 'A workshop' : w.name),
    w && (w.phone || w.map) ? h('div', { class: 'row wrap', style: { marginBottom: '10px' } }, w.phone ? h('a', { class: 'btn primary', href: tel(ph) }, '📞 Call') : null, w.phone ? h('a', { class: 'btn', href: `https://wa.me/${ph.replace('+', '')}`, target: '_blank', rel: 'noopener' }, '💬 WhatsApp') : null, w.map ? h('a', { class: 'btn', href: w.map, target: '_blank', rel: 'noopener' }, '📍 Map') : null) : null,
    field('Name', f.name), h('div', { class: 'grid2' }, field('Kind', f.kind), field('Area', f.area)), h('div', { class: 'grid2' }, field('Phone', f.phone), field('Map link', f.map)), field('Your rating', stars), field('Notes', f.note),
    visits.length ? h('div', { class: 'an-sec' }, h('b', {}, 'What they did'), ...visits.slice(0, 8).map(v => h('div', { class: 'row small' }, h('span', { class: 'n', style: { minWidth: '76px' } }, dmy(v.date)), h('span', { class: 'grow' }, (v.items || []).map(i => CC.ITEMS[i]?.label).filter(Boolean).join(', ') || v.what), v.cost ? h('b', { class: 'n' }, sar(v.cost)) : null))) : null,
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => { if (!f.name.value.trim()) return toast('Give it a name', 'err'); const before = S(); ctx.update(st => GA.saveShop(st, { ...x, name: f.name.value, kind: f.kind.value, area: f.area.value, phone: f.phone.value, map: f.map.value, rating, note: f.note.value })); box.close(); ctx.render(); undoToast(isNew ? 'Workshop saved' : 'Saved', before); } }, 'Save'),
      w ? h('button', { class: 'btn danger', onClick: () => { const before = S(); ctx.update(st => GA.deleteShop(st, w.id)); box.close(); ctx.render(); undoToast(`${w.name} removed`, before); } }, 'Remove') : null, h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel'))]);
}
/** A quote: one workshop's price (parts + labour) for each item. Pre-filled with the planned service. */
export function quoteSheet(c, q, preItems = []) {
  const s = S(), isNew = !q, x = q || { car: c.id, shop: '', shopName: '', date: keyOf(new Date()), lines: preItems.map(item => ({ item, price: 0, labour: 0, part: '' })), note: '' };
  const shops = GA.shopList(s), shop = h('select', {}, h('option', { value: '' }, '— workshop —'), shops.map(w => h('option', { value: w.id, selected: x.shop === w.id }, w.name)), h('option', { value: '+', selected: !x.shop && !!x.shopName }, '+ Not in my list'));
  const shopName = h('input', { value: x.shopName || '', maxlength: 50, placeholder: 'workshop name', hidden: !( !x.shop && x.shopName) }); shop.addEventListener('change', () => { shopName.hidden = shop.value !== '+'; });
  const date = h('input', { type: 'date', value: x.date }), note = h('input', { value: x.note || '', maxlength: 200, placeholder: 'e.g. includes oil, 3-month warranty' });
  let lines = x.lines.map(l => ({ ...l })); const wrap = h('div', { class: 'rows' }), total = h('b', { class: 'n', style: { fontSize: '1.3rem' } });
  const sum = () => { total.textContent = sar(lines.reduce((t, l) => t + (+l.price || 0) + (+l.labour || 0), 0)); };
  const paint = () => { wrap.replaceChildren(...lines.map((l, i) => { const last = l.item ? GA.lastPaid(s, c.id, l.item) : null;
    return h('div', { class: 'item', style: { cursor: 'default', flexWrap: 'wrap' } }, h('span', { class: 'ii' }, CC.ITEMS[l.item]?.icon || '🔩'), h('span', { class: 'im' }, h('span', { class: 'in' }, l.item ? GA.lineName(l) : h('input', { value: l.label || '', maxlength: 60, placeholder: 'What is it?', 'aria-label': 'What is it?', onInput: (e) => { l.label = e.target.value; } }), CC.ITEMS[l.item]?.ar ? h('span', { class: 'ia', lang: 'ar' }, CC.ITEMS[l.item].ar) : null), last ? h('span', { class: 'id' }, `you paid ${sar(last.price)} on ${dmy(last.date)}`) : null), h('button', { class: 'btn sm ghost', 'aria-label': `Remove ${GA.lineName(l)}`, onClick: () => { lines.splice(i, 1); paint(); } }, '✕'),
      h('div', { class: 'grid3', style: { width: '100%' } }, h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: l.price || '', placeholder: 'parts SAR', 'aria-label': `${GA.lineName(l)} parts price`, onInput: (e) => { l.price = +e.target.value || 0; sum(); } }), h('input', { type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: l.labour || '', placeholder: 'labour SAR', 'aria-label': `${GA.lineName(l)} labour`, onInput: (e) => { l.labour = +e.target.value || 0; sum(); } }), h('input', { value: l.part || '', maxlength: 60, placeholder: 'which part', 'aria-label': `${GA.lineName(l)} part`, onInput: (e) => { l.part = e.target.value; } }))); })); sum(); };
  const addSel = h('select', { 'aria-label': 'Add an item' }, h('option', { value: '' }, '+ Add an item…'), CC.GROUPS.map(([name, , ids]) => h('optgroup', { label: name }, ids.filter(id => !CC.ITEMS[id].days).map(id => h('option', { value: id }, CC.ITEMS[id].label)))), h('option', { value: '*' }, 'Something else…'));
  addSel.addEventListener('change', () => { const v = addSel.value; addSel.value = ''; if (!v) return; if (v === '*') lines.push({ item: '', label: '', price: 0, labour: 0, part: '' }); else if (!lines.some(l => l.item === v)) lines.push({ item: v, price: 0, labour: 0, part: '' }); paint(); });
  paint();
  const box = ctx.sheet([h('h2', {}, isNew ? '💬 A quote' : `💬 ${GA.quoteShop(s, q)}`), h('div', { class: 'grid2' }, field('Workshop', shop, shopName), field('Date', date)), wrap, addSel, field('Note', note),
    h('div', { class: 'row', style: { marginTop: '6px' } }, h('span', { class: 'grow small muted' }, 'Total'), total),
    h('div', { class: 'row wrap sh-foot' }, h('button', { class: 'btn primary grow', onClick: () => { const before = S(); ctx.update(st => GA.saveQuote(st, { ...x, car: c.id, shop: shop.value === '+' ? '' : shop.value, shopName: shop.value === '+' ? shopName.value : '', date: date.value, lines, note: note.value })); box.close(); part = 'shops'; ctx.go('garage'); undoToast('Quote saved', before); } }, 'Save'),
      q ? h('button', { class: 'btn danger', onClick: () => { const before = S(); ctx.update(st => GA.deleteQuote(st, q.id)); cmp.delete(q.id); box.close(); ctx.render(); undoToast('Quote removed', before); } }, 'Remove') : null, h('button', { class: 'btn ghost', onClick: () => box.close() }, 'Cancel'))]);
  box.box.classList.add('wide');
}

// ───────────────────────── engine-light codes and dashboard lights
function codesView(c) {
  const inp = h('input', { class: 'code-in', value: codeQ, placeholder: 'P0171', maxlength: 20, autocapitalize: 'characters', spellcheck: false, 'aria-label': 'Code or word', onInput: (e) => { codeQ = e.target.value; paint(); } });
  const out = h('div');
  const paint = () => { const hits = OBD.search(codeQ); out.replaceChildren(...(!codeQ.trim() ? [] : hits.length ? hits.map(r => codeCard(c, r)) : [h('div', { class: 'small muted' }, 'Not a code (a letter and four digits, like P0420) and no code mentions that word.')])); };
  paint();
  setTimeout(() => { if (codeQ) { inp.focus(); inp.setSelectionRange(codeQ.length, codeQ.length); } }, 0);
  return [h('div', { class: 'card' }, h('div', { class: 'title' }, 'Engine light code'), inp, h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, `Type the code from any OBD-II reader (a cheap Bluetooth one and a free app work), or a word like “misfire”. ${Object.keys(OBD.CODES).length} common codes are explained offline.`), out),
    h('div', { class: 'card' }, h('div', { class: 'title' }, 'Dashboard lights'), h('div', { class: 'lights' }, OBD.LIGHTS.map(l => h('details', { class: 'item', style: { display: 'block' } }, h('summary', { class: 'row', style: { listStyle: 'none', cursor: 'pointer' } }, h('span', { class: 'ii' }, l.icon), h('b', { class: 'grow small' }, l.name), h('span', { class: `lvl ${l.level}` }, OBD.LEVELS[l.level].label)), h('div', { class: 'small', style: { marginTop: '6px' } }, l.say)))))];
}
function codeCard(c, r) {
  const lv = OBD.LEVELS[r.level];
  return h('div', { class: 'an-sec code-card', style: { marginTop: '10px' } }, h('div', { class: 'row' }, h('span', { class: 'cc' }, r.code), h('span', { class: `lvl ${r.level}` }, lv.label)), h('div', { class: 'small', style: { fontWeight: 700 } }, r.title), r.ar ? h('div', { class: 'ia', lang: 'ar', dir: 'rtl' }, r.ar) : null,
    h('div', { class: 'tiny dim' }, lv.say), h('b', {}, 'Usual causes'), h('ol', { class: 'small', style: { margin: 0, paddingLeft: '18px' } }, r.causes.map(x => h('li', {}, x))),
    c?.model && r.care.length ? h('div', { class: 'rows' }, r.care.map(id => careRow(c, CC.itemState(c, id)))) : null);
}

// ───────────────────────── noises and feelings
function noisesView(c) {
  const sym = NZ.symptom(symId);
  if (!sym) return [h('div', { class: 'card' }, h('div', { class: 'title' }, 'What are you noticing?'), h('div', { class: 'tiny dim', style: { marginBottom: '8px' } }, 'Pick the closest. One or two questions, then the likely causes in order, how urgent, and what to tell the workshop in Arabic.'),
    ...NZ.GROUPS.map(([g, label, ic]) => h('div', { style: { marginBottom: '10px' } }, h('div', { class: 'tiny dim', style: { margin: '4px 0' } }, `${ic} ${label}`), h('div', { class: 'sym-grid' }, NZ.SYMPTOMS.filter(x => x.group === g).map(x => h('button', { class: 'item', onClick: () => { symId = x.id; picks = []; ctx.render(); } }, h('span', { class: 'ii' }, x.icon), h('span', { class: 'im' }, h('span', { class: 'in' }, x.title))))))))];
  const step = sym.ask && picks.length < sym.ask.length ? sym.ask[picks.length] : null, res = step ? null : NZ.answer(sym, picks), lv = res ? OBD.LEVELS[res.level] : null;
  return [h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('span', { class: 'ic' }, sym.icon), h('div', { class: 'title grow' }, sym.title), h('button', { class: 'btn sm ghost', onClick: () => { symId = ''; picks = []; ctx.render(); } }, '← All')),
    step ? [h('div', { class: 'small', style: { fontWeight: 700, margin: '6px 0' } }, step.q), h('div', { class: 'rows' }, step.options.map(([id, l]) => h('button', { class: 'item', onClick: () => { picks = [...picks, id]; ctx.render(); } }, h('span', { class: 'im' }, h('span', { class: 'in' }, l)), h('span', { class: 'arrow' }, '→'))))]
      : [h('div', { class: 'row', style: { margin: '6px 0' } }, h('span', { class: `lvl ${res.level}` }, lv.label), h('span', { class: 'tiny dim grow' }, lv.say)),
        h('div', { class: 'an-sec' }, h('b', {}, 'Most likely'), h('ol', { class: 'small', style: { margin: 0, paddingLeft: '18px' } }, res.causes.map(x => h('li', {}, x)))),
        h('div', { class: 'an-sec' }, h('b', {}, 'Check'), ...res.check.map(x => h('div', { class: 'small' }, x))),
        h('div', { class: 'an-sec' }, h('b', {}, 'Tell the workshop'), h('div', { class: 'ar', lang: 'ar', dir: 'rtl', style: { fontSize: '1.3rem', fontWeight: 700 } }, sym.ar)),
        c?.model && res.care.length ? h('div', { class: 'rows' }, res.care.map(id => careRow(c, CC.itemState(c, id)))) : null,
        sym.ask ? h('button', { class: 'btn sm ghost', style: { marginTop: '8px' }, onClick: () => { picks = []; ctx.render(); } }, 'Answer again') : null])];
}

// ───────────────────────── anatomy: tap a part to learn it; "Find it" to test yourself
function anatomyView(c) {
  const wrap = h('div', { class: 'an-wrap' }); wrap.innerHTML = AN.drawing(anView);
  const svg = wrap.firstElementChild;
  const open = (id) => { const p = AN.PARTS.find(x => x.id === id); if (!p) return; if (game) return guess(id); partSheet(p); };
  svg.addEventListener('click', (e) => { const g = e.target.closest('.an-hot'); if (g) open(g.dataset.part); });
  svg.addEventListener('keydown', (e) => { const g = e.target.closest('.an-hot'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(g.dataset.part); } });
  if (game?.flash) for (const [id, cls] of Object.entries(game.flash)) svg.querySelector(`[data-part="${id}"]`)?.classList.add(cls);
  const parts = AN.partsIn(anView);
  return [h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'grow' }, h('div', { class: 'title', style: { margin: 0 } }, 'Camry 2016 anatomy'), h('div', { class: 'small muted' }, game ? `Find: ${game.list[game.i]?.name || '—'}` : 'Tap a number: what it does, how to check it, the signs of trouble.')),
      h('button', { class: `btn ${game ? '' : 'primary'}`, onClick: () => { game = game ? null : { list: AN.findRound(anView), i: 0, right: 0, flash: null }; ctx.render(); } }, game ? 'Stop' : '🎯 Find it')),
      h('div', { class: 'seg', style: { marginBottom: '10px' } }, AN.VIEWS.map(([id, l]) => h('button', { class: anView === id ? 'active' : '', onClick: () => { anView = id; game = null; ctx.render(); } }, l))),
      game ? h('div', { class: 'n', style: { fontSize: '1.3rem' } }, `${game.right}/${game.list.length}`, h('span', { class: 'tiny dim' }, ` · part ${Math.min(game.i + 1, game.list.length)} of ${game.list.length}`)) : null,
      wrap, h('div', { class: 'tiny dim' }, anView === 'bay' ? 'Seen from above: the grille at the top, the driver’s side on the left. Positions are approximate.' : anView === 'under' ? 'Seen from below, as if lying under the car: the front at the top, so the driver’s side is on the right. Positions are approximate.' : 'Seen from the driver’s side, the front on the left. Positions are approximate.')),
    h('div', { class: 'card' }, h('div', { class: 'an-list' }, parts.map((p, i) => h('button', { class: 'item', onClick: () => game ? guess(p.id) : partSheet(p) }, h('span', { class: 'an-n' }, i + 1), h('span', { class: 'im' }, h('span', { class: 'in' }, `${p.icon} ${p.name}`), h('span', { class: 'ia', lang: 'ar' }, p.ar)))))),
    h('div', { class: 'card' }, h('div', { class: 'title' }, 'Good to know about the XV50 2.5 L'), h('ul', { class: 'an-notes small' }, AN.NOTES.map(n => h('li', {}, n))))];
}
function guess(id) {
  const want = game.list[game.i]; if (!want) return;
  const ok = want.id === id;
  game.flash = { [id]: ok ? 'right' : 'wrong', ...(ok ? {} : { [want.id]: 'show' }) };
  if (ok) { game.right++; ctx.cheer?.(); }
  toast(ok ? `Yes — ${want.name}` : `That’s ${AN.PARTS.find(p => p.id === id)?.name}. ${want.name} is lit up.`, ok ? 'ok' : '');
  game.i++; ctx.render();
  if (game.i >= game.list.length) { const r = game.right, n = game.list.length; setTimeout(() => { toast(`${r}/${n}${r === n ? ' — you know this car' : r >= n - 2 ? ' — nearly' : ' — again?'}`, 'ok'); game = null; ctx.render(); }, 900); }
  else setTimeout(() => { if (game) { game.flash = null; ctx.render(); } }, 1100);
}
export function partSheet(p) {
  if (!p) return;
  const s = S(), car = L.carList(s).find(c => c.model === 'camry-2016') || L.carList(s)[0];
  const care = car?.model ? p.care.map(id => CC.itemState(car, id)) : [];
  const box = ctx.sheet([h('h2', {}, `${p.icon} ${p.name}`), p.ar ? h('div', { class: 'ar', lang: 'ar', dir: 'rtl', style: { fontSize: '1.3rem', fontWeight: 700, marginBottom: '8px' } }, p.ar) : null, h('div', { class: 'an-sec' }, h('b', {}, 'What it does'), h('div', { class: 'small' }, p.does)),
    h('div', { class: 'an-sec' }, h('b', {}, 'How to check'), h('div', { class: 'small' }, p.check)), p.warn !== '—' ? h('div', { class: 'an-sec warn' }, h('b', {}, 'Signs of trouble'), h('div', { class: 'small' }, p.warn)) : null,
    care.length ? h('div', { class: 'an-sec' }, h('b', {}, `On ${car.name}`), h('div', { class: 'rows' }, care.map(st => careRow(car, st, { onClick: () => { box.close(); itemSheet(car, st.id); } })))) : null]);
}
