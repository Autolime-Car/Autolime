// Shared pieces of the Autolime screens: the selected car, small builders (rows, stats, tags, the plate, the gauges, the
// odometer roller, the telltales) and the ctx every screen gets from app.js.
import { h, toast, keyOf, fromKey, fmtDate } from './util.js';
import * as L from './car.js';
import * as CC from './carcare.js';

export let ctx = null;
export function initKit(c) { ctx = c; }
export const S = () => ctx.S();
export const field = (label, ...inputs) => h('div', { class: 'field' }, label ? h('label', {}, label) : null, ...inputs);
export const dmy = (k) => k ? fmtDate(fromKey(k)) : '—';
export const kmT = (n) => `${Math.round(n).toLocaleString('en')} km`;
export const sar = (n) => `${Math.round(n).toLocaleString('en')} SAR`;
export const putCar = (c) => ctx.update(st => L.saveCar(st, c));
export const undoToast = (msg, before) => toast(msg, 'ok', { action: { label: 'Undo', run: () => ctx.undoTo(before) } });
export const tel = (n) => `tel:${String(n).replace(/\s/g, '')}`;
export const today = () => keyOf(new Date());

// ── the car on screen (several cars: chips at the top of each tab pick one)
let carId = '';
export function currentCar(s = S()) { const cars = L.carList(s); return cars.find(c => c.id === carId) || cars.find(c => c.model) || cars[0] || null; }
export function pickCar(id) { carId = id; }
export function carChips(s = S()) {
  const cars = L.carList(s); if (cars.length < 2) return null; const c = currentCar(s);
  return h('div', { class: 'chips', style: { marginBottom: '10px' } }, cars.map(x => h('button', { class: `chip ${x.id === c.id ? 'sel' : ''}`, 'aria-pressed': String(x.id === c.id), onClick: () => { carId = x.id; ctx.render(); } }, `${x.icon} ${x.name}`)));
}
export function viewHead(title, ...right) { return h('div', { class: 'view-head' }, h('h1', {}, title), ...right); }

// ── small builders
export const stat = (n, l, cls = '') => h('div', { class: `stat ${cls}` }, h('b', { class: 'n' }, n), h('span', {}, l));
export const tag = (cls, text) => h('span', { class: `tag ${cls}` }, text);
export const copyBtn = (text, label) => h('button', { class: 'btn sm ghost', 'aria-label': `Copy ${label}`, title: `Copy ${label}`, onClick: async () => { try { await navigator.clipboard.writeText(text); toast(`${label} copied`, 'ok'); } catch { toast(text); } } }, '⧉');
export function careRow(c, st, { onClick } = {}) {
  const w = Math.round(Math.min(1, st.used) * 100), planned = c.plan?.items?.includes(st.id);
  return h('button', { class: `item st-${st.state}`, onClick: onClick || (() => ctx.itemSheet(c, st.id)) },
    h('span', { class: 'ii' }, st.def.icon),
    h('span', { class: 'im' }, h('span', { class: 'in' }, st.def.label, st.def.ar ? h('span', { class: 'ia', lang: 'ar' }, st.def.ar) : null), h('span', { class: 'id' }, CC.dueText(st, dmy)), st.state !== 'unknown' ? h('span', { class: 'bar' }, h('i', { style: { width: `${w}%` } })) : null),
    planned ? tag('plan', `🗓 ${c.plan.date ? dmy(c.plan.date).slice(0, 5) : 'planned'}`) : st.state === 'late' ? tag('late', 'Overdue') : st.state === 'soon' ? tag('soon', 'Soon') : null);
}

// ── the plate
const AR_DIG = (n) => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const AR2LAT = { 'ا': 'A', 'أ': 'A', 'ب': 'B', 'ح': 'J', 'د': 'D', 'ر': 'R', 'س': 'S', 'ص': 'X', 'ط': 'T', 'ع': 'E', 'ق': 'G', 'ك': 'K', 'ل': 'L', 'م': 'Z', 'ن': 'N', 'ه': 'H', 'و': 'U', 'ى': 'V', 'ي': 'V' };
const COLOURS = { 'ازرق فاتح': ['Light blue', '#8ec5f2'], 'ازرق': ['Blue', '#2f6fd6'], 'ابيض': ['White', '#f4f4f4'], 'أبيض': ['White', '#f4f4f4'], 'اسود': ['Black', '#1b1b1b'], 'أسود': ['Black', '#1b1b1b'], 'فضي': ['Silver', '#c7cbd1'], 'رمادي': ['Grey', '#8a8f98'], 'احمر': ['Red', '#d33a3a'], 'أحمر': ['Red', '#d33a3a'], 'بيج': ['Beige', '#d9c7a3'], 'ذهبي': ['Gold', '#cfa94a'], 'بني': ['Brown', '#7a5236'], 'اخضر': ['Green', '#3a9a5b'] };
export const colourOf = (c) => COLOURS[(c || '').trim()] || Object.values(COLOURS).find(([en]) => en.toLowerCase() === (c || '').trim().toLowerCase()) || null;
export const colourName = (c) => colourOf(c)?.[0] || c || '';
/** "ر س ط 4821" → Arabic letters, digits; Latin letters read the other way (T S R), as on the plate itself. */
export function plateParts(c) {
  const m = /^(.*?)\s*(\d{1,4})\s*$/.exec((c.plate || '').trim()) || /^(\d{1,4})\s*(.*)$/.exec((c.plate || '').trim());
  if (!m) return null;
  const [digits, letters] = /^\d/.test(m[1]) ? [m[1], m[2]] : [m[2], m[1]];
  const ar = [...letters.replace(/\s/g, '')];
  const lat = c.plateLatin ? c.plateLatin.replace(/\s/g, '').split('') : ar.map(x => AR2LAT[x] || '?').reverse();
  return { digits, ar, lat };
}
export function plateBadge(c) {
  const p = plateParts(c); if (!p) return c.plate ? h('div', { class: 'tiny' }, c.plate) : null;
  return h('div', { class: 'ksa-plate', role: 'img', 'aria-label': `Plate ${p.digits} ${p.lat.join(' ')}` },
    h('div', { class: 'kp-grid' }, h('span', { class: 'kp-ar', dir: 'ltr' }, AR_DIG(p.digits)), h('span', { class: 'kp-ar', dir: 'rtl' }, p.ar.join(' ')), h('span', {}, p.digits), h('span', {}, p.lat.join(' '))),
    h('div', { class: 'kp-strip' }, h('span', {}, 'السعودية'), h('b', {}, 'KSA')));
}

// ── instruments
const pt = (a, r, cx = 100, cy = 100) => [cx + r * Math.cos(a * Math.PI / 180), cy + r * Math.sin(a * Math.PI / 180)];
const arc = (a0, a1, r) => { const [x0, y0] = pt(a0, r), [x1, y1] = pt(a1, r); return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
/**
 * A dial like the tachometer: value 0–1 sweeps 240° (lower-left round the top to lower-right). opts: { label, read, sub,
 * ticks: [labels], red: [from, to] fractions shaded red, tone: 'good'|'mid'|'bad', small }.
 */
export function gauge(frac, { read = '', sub = '', ticks = [], red = null, tone = 'good', small = false, label = '' } = {}) {
  const A0 = 150, A1 = 390, f = Math.max(0, Math.min(1, frac ?? 0)), ang = A0 + (A1 - A0) * f;
  const n = Math.max(2, ticks.length), parts = [];
  for (let i = 0; i <= (n - 1) * 5; i++) { const fr = i / ((n - 1) * 5), a = A0 + (A1 - A0) * fr, big = i % 5 === 0, isRed = red && fr >= red[0] - 1e-6 && fr <= red[1] + 1e-6; const [x0, y0] = pt(a, big ? 70 : 74), [x1, y1] = pt(a, 80); parts.push(`<line class="g-tick ${big ? 'big' : ''} ${isRed ? 'red' : ''}" x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}"/>`); if (big && ticks[i / 5] !== undefined && !small) { const [lx, ly] = pt(a, 59); parts.push(`<text class="g-lab" x="${lx.toFixed(1)}" y="${(ly + 3).toFixed(1)}" text-anchor="middle">${ticks[i / 5]}</text>`); } }
  const [nx, ny] = pt(ang, small ? 56 : 62);
  const svg = `<svg viewBox="0 0 200 172" aria-hidden="true"><path class="g-track" d="${arc(A0, A1, 88)}" stroke-width="8"/><path class="g-val" d="${arc(A0, A1, 88)}" stroke-width="8" pathLength="100" stroke-dasharray="100 100" stroke-dashoffset="${(100 - f * 100).toFixed(1)}"/>${parts.join('')}<line class="g-needle" x1="100" y1="100" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}"/><circle class="g-hub" cx="100" cy="100" r="7"/><ellipse class="pip" cx="${pt(ang, 96)[0].toFixed(1)}" cy="${pt(ang, 96)[1].toFixed(1)}" rx="3.2" ry="4.4" transform="rotate(${(ang + 90).toFixed(0)} ${pt(ang, 96)[0].toFixed(1)} ${pt(ang, 96)[1].toFixed(1)})"/></svg>`;
  const el = h('div', { class: `gauge ${tone} ${small ? 'small' : ''}`, role: 'img', 'aria-label': `${label}: ${read} ${sub}`.trim() });
  el.innerHTML = svg; el.append(h('div', { class: 'g-read' }, h('b', {}, read), h('small', {}, sub)));
  return el;
}
/** The odometer as a mechanical roller: each digit rolls up to its place when it is drawn. */
export function odometer(km, { guessed = false } = {}) {
  const digits = String(Math.max(0, Math.round(km || 0))).padStart(6, '0').split('');
  const el = h('div', { class: 'odo', role: 'img', 'aria-label': `${guessed ? 'About ' : ''}${Math.round(km || 0).toLocaleString('en')} km` });
  for (const d of digits) { const col = h('span', {}, ...Array.from({ length: 10 }, (_, i) => h('i', {}, String(i)))); el.append(h('span', { class: 'dg' }, col)); col.dataset.to = d; }
  el.append(h('span', { class: 'unit' }, 'KM'));
  requestAnimationFrame(() => requestAnimationFrame(() => { for (const col of el.querySelectorAll('.dg > span')) col.style.transform = `translateY(-${+col.dataset.to * 1.45}em)`; }));
  return el;
}
const ICONS = {
  oil: '<path d="M2.5 13.5h11.5l6-5 2 1.5-7.5 7.5H6z"/><path d="M6 13.5v-3h5v3M8.5 10.5V8.5"/><path d="M21 15.5c0 1-.6 1.8-1.3 1.8s-1.2-.8-1.2-1.8.7-2 1.2-2.6c.5.6 1.3 1.6 1.3 2.6z"/>',
  brake: '<circle cx="12" cy="12" r="6"/><path d="M12 9v3.5M12 15v.01"/><path d="M4.5 6.5a9 9 0 0 0 0 11M19.5 6.5a9 9 0 0 1 0 11"/>',
  battery: '<rect x="3" y="8" width="18" height="11" rx="1.5"/><path d="M7 8V6h3v2M14 8V6h3v2M6 13.5h4M15 11.5v4M13 13.5h4"/>',
  tyre: '<path d="M6.5 6.5C4.6 8.4 4 10.4 4 12.6c0 2.8 1.4 5 3.4 6.4h9.2c2-1.4 3.4-3.6 3.4-6.4 0-2.2-.6-4.2-2.5-6.1"/><path d="M12 8.5v5M12 16.2v.01"/>',
  temp: '<path d="M12 3.5v10"/><circle cx="12" cy="16.5" r="2.8"/><path d="M12 6.5h3M12 9.5h3"/><path d="M3.5 21c1.4-.9 2.8-.9 4.2 0s2.8.9 4.3 0 2.8-.9 4.2 0 2.8.9 4.3 0"/>',
  wrench: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L3.5 17.3a1.7 1.7 0 0 0 2.4 2.4l5.8-5.8a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.1-.4-.4-2.1z"/>',
  doc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8.5 8h7M8.5 12h7M8.5 16h4"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
};
export const icon = (id) => { const s = h('span', { 'aria-hidden': 'true' }); s.innerHTML = `<svg viewBox="0 0 24 24">${ICONS[id] || ''}</svg>`; return s.firstElementChild; };
/** The telltales: which warning lights would be on, from the care plan and the papers. */
export const TELLTALES = [
  ['oil', 'Oil', ['oil']], ['brake', 'Brakes', ['brakes', 'rotors', 'brakeFluid']], ['battery', 'Battery', ['battery', 'batteryNew']],
  ['tyre', 'Tyres', ['tyrePressure', 'rotate', 'tyres', 'balancing', 'alignment', 'bearings']], ['temp', 'Cooling', ['coolant', 'waterPump']],
  ['gear', 'Gearbox', ['atf']], ['wrench', 'Service', ['airFilter', 'cabinFilter', 'plugs', 'belt', 'ac', 'wipers', 'shocks', 'arms', 'cvBoots', 'mounts']],
];
export function telltales(c, items, paperState) {
  const by = Object.fromEntries(items.map(x => [x.id, x]));
  const rank = { late: 3, soon: 2, ok: 1, unknown: 0 };
  const out = TELLTALES.map(([id, label, ids]) => { const sts = ids.map(i => by[i]).filter(Boolean); const worst = sts.sort((a, b) => rank[b.state] - rank[a.state])[0]; return { id, label, state: worst ? (worst.state === 'unknown' ? 'off' : worst.state) : 'off', worst, count: sts.filter(x => x.state === 'late' || x.state === 'soon').length }; });
  out.push({ id: 'doc', label: 'Papers', state: paperState, papers: true });
  return out;
}
