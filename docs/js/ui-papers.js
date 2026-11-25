// Papers: istimara, fahas, insurance and your licence with days left, the renewal checklists (Absher, the inspection booking,
// insurance quotes before the loyalty discount runs out), the insurance card read from its PDF, the papers wallet (photos on
// your own Drive), the car's identity and the accident card.
import * as EXU from './ui-extras.js';
import { h, fromKey } from './util.js';
import * as L from './car.js';
import * as CC from './carcare.js';
import * as PO from './policy.js';
import * as PA from './papers.js';
import * as PH from './photos.js';
import { ctx, S, dmy, sar, putCar, currentCar, carChips, viewHead, stat, tag, copyBtn, colourOf, tel } from './ui-kit.js';
import { carSheet, insSheet, driverSheet, accidentSheet, thumb } from './ui-sheets.js';

export function renderPapers() {
  const s = S(), now = new Date(), c = currentCar(s);
  if (!c) return [viewHead('Papers'), driverCard(now), h('div', { class: 'card empty' }, 'Add your car on the Dash to keep its papers here.')];
  const renew = PA.openRenewals(s, c, now);
  return [viewHead('Papers', h('button', { class: 'btn sos', onClick: () => accidentSheet(c) }, '🚨 Accident card')), carChips(s),
    papersCard(c, now), ...renew.map((r, i) => renewCard(c, r, i === 0)), insCard(c, now), driverCard(now), walletCard(c, s), ...EXU.tabTools('papers', c), idCard(c, CC.MODELS[c.model]),
    h('div', { class: 'tiny dim', style: { margin: '4px 2px 14px' } }, 'Autolime only reminds. The istimara and the licence renew in Absher, the fahas at an inspection centre (book first), the insurance with your insurer.'), EXU.toolsHint('papers')];
}
function papersCard(c, now) {
  const dr = L.driverOf(S()), next = PA.fahasBookBy(c);
  const rows = [...L.CAR_PAPERS.map(([k, label, icon, warn]) => [k, label, icon, warn, c[k]]), ['licence', 'Driving licence', '🪪', L.LICENCE_WARN, dr.licence]];
  const line = ([k, label, icon, warn, key]) => { const d = L.daysUntil(key, now), span = k === 'licence' ? 3650 : k === 'istimara' ? 1095 : 365, used = d === null ? 0 : Math.max(0, Math.min(1, 1 - d / span));
    return h('div', { class: `paper ${d === null ? '' : d < 0 ? 'late' : d <= warn ? 'soon' : ''}` }, h('span', { class: 'ic' }, icon), h('div', { class: 'grow' }, h('b', { class: 'small' }, label), h('div', { class: 'tiny dim' }, key ? `until ${dmy(key)}${k === 'fahas' && next && d > 30 ? ` · book from ${dmy(next)}` : ''}` : 'not set'), key ? h('span', { class: `bar ${d < 0 ? 'late' : d <= warn ? 'soon' : ''}`, style: { marginTop: '5px' } }, h('i', { style: { width: `${Math.round(used * 100)}%` } })) : null),
      h('div', { class: 'pd' }, d === null ? '—' : d < 0 ? `${-d}` : d > 365 ? `${(d / 365).toFixed(1)}` : `${d}`, h('small', {}, d === null ? '' : d < 0 ? 'days ago' : d > 365 ? 'years' : 'days'))); };
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, 'Papers'), h('button', { class: 'btn sm ghost', onClick: () => carSheet(c) }, 'Edit dates'), h('button', { class: 'btn sm ghost', onClick: driverSheet }, 'Licence')), rows.map(line));
}
function renewCard(c, r, open) {
  const first = L.carList(S())[0], owner = r.id === 'licence' ? first : c;
  if (!(r.id in renewOpen)) renewOpen[r.id] = open;
  return h('details', { class: `card ${r.days < 0 ? 'bad' : 'warn'}`, open: renewOpen[r.id], onToggle: (e) => { renewOpen[r.id] = e.currentTarget.open; } }, h('summary', { class: 'card-h', style: { listStyle: 'none', cursor: 'pointer', marginBottom: 0 } }, h('span', { class: 'ic' }, r.icon), h('div', { class: 'grow' }, h('div', { class: 'title', style: { margin: 0 } }, `Renew: ${r.label.replace(/ \(.*\)$/, '')}`), h('div', { class: 'tiny dim' }, `${r.days < 0 ? `expired ${-r.days} days ago` : `${r.days} days left`} · ${r.where}`)), tag(r.done === r.total ? 'ok' : 'soon', `${r.done}/${r.total}`)),
    h('div', { class: 'steps', style: { marginTop: '10px' } }, r.steps.map(([id, en, ar]) => { const on = r.ticks.includes(id); return h('button', { class: `check ${on ? 'on' : ''}`, 'aria-pressed': String(on), onClick: () => { putCar(PA.tick(owner, r.id, r.date, id)); ctx.render(); } }, h('span', { class: 'box' }, on ? '✓' : ''), h('span', { class: 'grow' }, h('span', { class: 'ct small' }, en), h('span', { class: 'car', lang: 'ar' }, ar))); })),
    r.id === 'insurance' && c.ins?.perks?.some(p => /loyal/i.test(p)) ? h('div', { class: 'note' }, '💎 Your policy mentions a loyalty discount for renewing before it ends.') : null,
    h('div', { class: 'row wrap', style: { marginTop: '8px' } }, r.id === 'insurance' ? h('button', { class: 'btn sm', onClick: () => insSheet(c) }, '📄 Read the new policy') : r.id === 'licence' ? h('button', { class: 'btn sm', onClick: driverSheet }, 'New expiry date') : h('button', { class: 'btn sm', onClick: () => carSheet(c) }, 'New date')));
}
const renewOpen = {};
const perkIcon = (p) => /tow/i.test(p) ? '🛻' : /battery/i.test(p) ? '🔋' : /fuel/i.test(p) ? '⛽' : /tyre/i.test(p) ? '🛞' : /taxi/i.test(p) ? '🚕' : /loyal/i.test(p) ? '💎' : /claim/i.test(p) ? '⭐' : '✓';
function insCard(c, now) {
  const i = c.ins, days = L.daysUntil(c.insurance, now);
  if (!i) return h('button', { class: 'card cta', onClick: () => insSheet(c) }, h('span', { class: 'ic' }, '🛡️'), h('span', { class: 'grow' }, h('b', {}, 'Insurance'), h('span', { class: 'tiny dim' }, ' · read your policy PDF: the cover, the helpline, the extras and the renewal date')), h('span', { class: 'arrow' }, '+'));
  const total = i.start && c.insurance ? Math.max(1, L.daysUntil(c.insurance, fromKey(i.start))) : 365, left = Math.max(0, days ?? 0), used = Math.min(1, Math.max(0, 1 - left / total)), third = i.kind === 'third';
  return h('div', { class: `card ${third ? 'ins-third' : ''}` },
    h('div', { class: 'card-h' }, h('span', { class: 'ic' }, '🛡️'), h('div', { class: 'grow' }, h('div', { class: 'title', style: { margin: 0 } }, i.company || 'Insurance'), h('div', { class: 'tiny dim' }, [L.INS_KIND[i.kind], i.policy].filter(Boolean).join(' · '))), i.policy ? copyBtn(i.policy, 'Policy number') : null, h('button', { class: 'btn sm ghost', onClick: () => insSheet(c) }, 'Edit')),
    c.insurance ? h('div', { class: 'period' }, h('div', { class: 'row' }, h('span', { class: 'grow' }, i.start ? dmy(i.start) : ''), h('b', {}, days < 0 ? `Expired ${-days} d ago` : `${days} days left`), h('span', { class: 'grow', style: { textAlign: 'right' } }, dmy(c.insurance))), h('span', { class: `bar ${days < 0 ? 'late' : days <= 21 ? 'soon' : ''}` }, h('i', { style: { width: `${Math.round(used * 100)}%` } }))) : null,
    third ? h('div', { class: 'note warn' }, h('b', {}, 'Third party only. '), 'It pays for damage you cause to others', i.limit ? ` (${i.limit.replace(/^Up to /, 'up to ').replace(' for damage to others', '')})` : '', ' — repairs to your own car, theft and fire are not covered. A comprehensive policy would cover those.') : i.kind === 'comp' ? h('div', { class: 'note' }, 'Comprehensive: your own car is covered too, after the deductible.') : null,
    h('div', { class: 'stats' }, i.premium != null ? stat(i.premium.toLocaleString('en'), 'SAR a year') : null, i.deductible != null ? stat(i.deductible.toLocaleString('en'), 'SAR deductible') : null, i.repair ? stat(i.repair, third ? 'repairs to the other car' : 'repairs') : null),
    i.perks?.length ? h('div', { class: 'chips', style: { marginTop: '8px' } }, i.perks.map(p => h('span', { class: 'chip static' }, perkIcon(p), ' ', p))) : null,
    h('div', { class: 'row wrap', style: { marginTop: '10px' } }, i.phone ? h('a', { class: 'btn primary', href: tel(i.phone) }, `📞 ${i.phone}`) : null, h('button', { class: 'btn', onClick: () => accidentSheet(c) }, '🚨 If you have an accident')));
}
function driverCard(now) {
  const d = L.driverOf(S()), days = L.daysUntil(d.licence, now), held = L.heldFor(d.issued, now);
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('span', { class: 'ic' }, '🪪'), h('div', { class: 'grow' }, h('div', { class: 'title', style: { margin: 0 } }, 'You, the driver'), h('div', { class: 'tiny dim' }, d.licence ? `${d.type || 'Driving'} licence until ${dmy(d.licence)}` : 'Add your licence expiry: Autolime reminds you two months before.')),
      d.licence ? tag(days < 0 ? 'late' : days <= L.LICENCE_WARN ? 'soon' : 'ok', days < 0 ? 'Expired' : days > 365 ? `${Math.floor(days / 365)} y ${Math.floor(days % 365 / 30)} m` : `${days} d`) : null, h('button', { class: 'btn sm ghost', onClick: driverSheet }, d.licence ? 'Edit' : 'Add')),
    held || d.blood ? h('div', { class: 'stats' }, held ? stat(`${held.years}`, `years driving (since ${dmy(d.issued)})`) : null, d.blood ? stat(d.blood, 'blood type (accident card)') : null) : null);
}
function walletCard(c, s) {
  const ph = PH.photoList(s, { car: c.id, kinds: PH.WALLET }), byKind = Object.fromEntries(PH.WALLET.map(k => [k, ph.find(p => p.kind === k)]));
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, 'Papers wallet'), h('span', { class: 'tiny dim' }, 'photos on your own Drive')),
    h('div', { class: 'wallet' }, PH.WALLET.map(k => byKind[k] ? thumb(byKind[k]) : h('button', { class: 'thumb add', onClick: () => ctx.takePhoto({ kind: k, car: c.id, note: PH.kindOf(k)[1] }) }, `+ ${PH.kindOf(k)[2]} ${PH.kindOf(k)[1]}`)), ph.filter(p => !PH.WALLET.some(k => byKind[k] === p)).slice(0, 6).map(p => thumb(p)), h('button', { class: 'thumb add', onClick: () => ctx.takePhoto({ kind: 'other', car: c.id }) }, '+ Another')),
    h('div', { class: 'tiny dim', style: { marginTop: '8px' } }, 'Handy when a checkpoint or the workshop asks. Absher and Tawakkalna hold the official digital copies.'));
}
function idCard(c, m) {
  const v = c.vin ? PO.vinInfo(c.vin) : null, col = colourOf(c.colour);
  const rows = [c.vin ? ['VIN', h('span', { class: 'n' }, c.vin, ' ', copyBtn(c.vin, 'VIN'))] : null, v?.maker ? ['Built by', `${v.maker}${v.year ? ` · model year ${v.year}` : ''}${v.check ? ' · VIN check ✓' : ''}`] : null,
    c.colour ? ['Colour', h('span', {}, col ? h('i', { style: { display: 'inline-block', width: '12px', height: '12px', borderRadius: '50%', background: col[1], verticalAlign: '-1px', border: '1px solid var(--line2)' } }) : null, ` ${col ? `${col[0]} (${c.colour})` : c.colour}`)] : null,
    c.seats ? ['Seats', `${c.seats}`] : null, c.weight ? ['Weight on the istimara', `${c.weight.toLocaleString('en')} kg`] : null, c.regType ? ['Registration', c.regType] : null, ...(m?.facts || [])].filter(Boolean);
  if (!rows.length) return null;
  return h('details', { class: 'card adv' }, h('summary', {}, `${c.name}: the details`), h('div', { class: 'kv' }, rows.flatMap(([k, val]) => [h('b', {}, k), h('span', {}, val)])), h('div', { class: 'tiny dim', style: { marginTop: '8px' } }, 'The VIN is what parts shops and the agency ask for: it pins down the exact engine, gearbox and trim.'));
}
