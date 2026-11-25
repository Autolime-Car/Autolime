// Fuel & money: fill-ups, consumption tank by tank, money month by month (fuel, servicing, trips) and what a km really
// costs once the insurance and the tyres are counted.
import { h } from './util.js';
import * as CC from './carcare.js';
import * as M from './money.js';
import { ctx, S, dmy, sar, putCar, currentCar, carChips, viewHead, stat, undoToast } from './ui-kit.js';
import { fuelSheet } from './ui-sheets.js';

export function renderFuel() {
  const s = S(), now = new Date(), c = currentCar(s);
  if (!c) return [viewHead('Fuel'), h('div', { class: 'card empty' }, 'Add your car on the Dash first.')];
  const cost = CC.costs(c, now), eco = CC.economy(c), months = M.months(c, now, 12), tc = M.trueCost(c, now), sm = M.summary(c, now);
  const fills = [...(c.fuel || [])].reverse();
  const lastPrice = (c.fuel || []).filter(f => f.cost && f.litres).slice(-1)[0];
  return [viewHead('Fuel & money', h('button', { class: 'btn primary', onClick: () => fuelSheet(c) }, '⛽ Fill-up')), carChips(s),
    h('div', { class: 'card' }, h('div', { class: 'stats' }, stat(cost.l100 ? `${cost.l100}` : '—', 'L / 100 km (last 3 tanks)', 'acc'), stat(cost.perKm ? cost.perKm.toFixed(2) : '—', 'SAR fuel per km'), stat(lastPrice ? (lastPrice.cost / lastPrice.litres).toFixed(2) : '—', 'SAR a litre, last'), stat(sm.month.toLocaleString('en'), 'SAR this month')),
      !eco.length ? h('div', { class: 'tiny dim', style: { marginTop: '8px' } }, 'Fill to full and type the odometer each time: from the second full tank Autolime shows your real consumption.') : null),
    h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, 'Month by month'), h('span', { class: 'tiny dim' }, `${sar(sm.year)} in ${now.getFullYear()}`)), monthChart(months),
      h('div', { class: 'legend' }, h('span', {}, h('i', { style: { background: 'var(--acc)' } }), 'Fuel'), h('span', {}, h('i', { style: { background: 'var(--cyan)' } }), 'Servicing'), h('span', {}, h('i', { style: { background: 'var(--amber)' } }), 'Trips (food, stays…)'))),
    h('div', { class: 'card' }, h('div', { class: 'title' }, 'What a km really costs'),
      tc.parts.length ? [h('div', { class: 'row', style: { alignItems: 'baseline' } }, h('b', { class: 'n', style: { fontSize: '2.2rem', color: 'var(--acc)' } }, tc.perKm.toFixed(2)), h('span', { class: 'small muted' }, `SAR per km · about ${tc.kmYear.toLocaleString('en')} km a year`)),
        h('div', { class: 'split', role: 'img', 'aria-label': tc.parts.map(p => `${p.label} ${p.perKm}`).join(', ') }, tc.parts.map((p, i) => h('i', { style: { width: `${(p.perKm / tc.perKm * 100).toFixed(1)}%`, background: ['var(--acc)', 'var(--cyan)', 'var(--sig)', 'var(--amber)'][i] } }))),
        h('div', { class: 'legend' }, tc.parts.map((p, i) => h('span', {}, h('i', { style: { background: ['var(--acc)', 'var(--cyan)', 'var(--sig)', 'var(--amber)'][i] } }), `${p.label} ${p.perKm.toFixed(2)}`)))]
        : h('div', { class: 'small muted' }, 'Log a few fill-ups with the odometer, and your servicing, and this adds up fuel, servicing, the insurance premium and the tyres per km.')),
    eco.length ? h('div', { class: 'card' }, h('div', { class: 'title' }, 'Tank by tank'), ecoChart(eco.slice(-12))) : null,
    h('div', { class: 'card' }, h('div', { class: 'title' }, `Fill-ups${fills.length ? ` · ${fills.length}` : ''}`), fills.length ? h('div', { class: 'fills' }, fills.slice(0, 20).map(f => h('div', { class: 'fill' }, h('span', { class: 'n' }, dmy(f.date)), h('span', { class: 'small' }, `${f.litres} L${f.cost ? ` · ${sar(f.cost)}` : ''}${f.km ? ` · ${f.km.toLocaleString('en')} km` : ''}${f.full ? '' : ' · part fill'}`),
      h('button', { class: 'btn sm ghost', 'aria-label': `Remove the fill-up of ${dmy(f.date)}`, onClick: () => { const before = S(); const i = c.fuel.indexOf(f); putCar({ ...c, fuel: c.fuel.filter((_, j) => j !== i) }); ctx.render(); undoToast('Fill-up removed', before); } }, '✕')))) : h('div', { class: 'empty small' }, 'No fill-ups yet.'))];
}
/** Stacked bars for 12 months; the pip marks this month. */
function monthChart(months) {
  const W = 360, H = 150, pad = 18, bw = (W - pad * 2) / months.length, max = Math.max(100, ...months.map(m => m.total));
  const y = (v) => (H - 36) * (v / max);
  let bars = '';
  months.forEach((m, i) => { const x = pad + i * bw + 3, w = bw - 6; let base = H - 18;
    for (const [k, cls] of [['fuel', 'b-fuel'], ['care', 'b-care'], ['trip', 'b-trip']]) { const hh = y(m[k]); if (hh > 0) { bars += `<rect class="${cls}" x="${x.toFixed(1)}" y="${(base - hh).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" rx="2"/>`; base -= hh; } }
    bars += `<text class="lab" x="${(x + w / 2).toFixed(1)}" y="${H - 4}" text-anchor="middle">${m.label[0]}</text>`;
    if (m.total) bars += `<text class="lab" x="${(x + w / 2).toFixed(1)}" y="${(base - 3).toFixed(1)}" text-anchor="middle">${m.total >= 1000 ? `${(m.total / 1000).toFixed(1)}k` : m.total}</text>`;
  });
  const last = months.length - 1, px = pad + last * bw + bw / 2;
  const el = h('div', { role: 'img', 'aria-label': months.map(m => `${m.label} ${m.year}: ${m.total} SAR`).join('; ') });
  el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}"><line class="ax" x1="${pad}" y1="${H - 18}" x2="${W - pad}" y2="${H - 18}"/>${bars}<ellipse class="pip" cx="${px.toFixed(1)}" cy="${H - 13}" rx="2.4" ry="3.2"/></svg>`;
  return el;
}
function ecoChart(eco) {
  const W = 360, H = 120, pad = 22, vals = eco.map(e => e.l100), lo = Math.min(...vals) - .5, hi = Math.max(...vals) + .5;
  const x = (i) => pad + (eco.length === 1 ? (W - pad * 2) / 2 : i * (W - pad * 2) / (eco.length - 1)), y = (v) => 10 + (H - 34) * (1 - (v - lo) / Math.max(.1, hi - lo));
  const line = eco.map((e, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(e.l100).toFixed(1)}`).join('');
  const dots = eco.map((e, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(e.l100).toFixed(1)}" r="3.5" fill="var(--acc)"/><text class="lab" x="${x(i).toFixed(1)}" y="${(y(e.l100) - 7).toFixed(1)}" text-anchor="middle">${e.l100}</text>`).join('');
  const el = h('div', { role: 'img', 'aria-label': eco.map(e => `${e.date}: ${e.l100} L/100 km`).join('; ') });
  el.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}"><path d="${line}" fill="none" stroke="var(--acc)" stroke-width="2.5" stroke-linejoin="round"/>${dots}<text class="lab" x="${pad}" y="${H - 6}">${dmy(eco[0].date).slice(0, 5)}</text><text class="lab" x="${W - pad}" y="${H - 6}" text-anchor="end">${dmy(eco[eco.length - 1].date).slice(0, 5)}</text></svg>`;
  return el;
}
