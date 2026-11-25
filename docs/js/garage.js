// Workshops you use, quotes from them, and what each part has cost you before — so the next quote can be compared.
// Pure (no DOM). Workshops and quotes are records with their own `at` (merged record by record between devices).
import { keyOf, uid } from './util.js';
import * as CC from './carcare.js';

const isKey = (v) => /^\d{4}-\d\d-\d\d$/.test(v || '');
const txt = (v, n = 80) => String(v ?? '').trim().slice(0, n);
const num = (v, lo, hi, d = 0) => { const n = +String(v ?? '').replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 0x660)).replace(/[, ]/g, ''); return Number.isFinite(n) && String(v ?? '').trim() !== '' ? Math.max(lo, Math.min(hi, n)) : d; };
const vals = (o) => Object.values(o || {});

// ───────────────────────── workshops
export const KINDS = [['general', 'General mechanic', '🔧'], ['oil', 'Oil change / quick service', '🛢️'], ['tyres', 'Tyres & alignment', '🛞'], ['ac', 'AC specialist', '❄️'], ['electric', 'Auto electrician', '⚡'], ['gearbox', 'Gearbox specialist', '⚙️'], ['body', 'Body & paint', '🎨'], ['parts', 'Parts shop', '📦'], ['agency', 'Agency (dealer)', '🏢']];
export function saveShop(s, w) {
  const name = txt(w.name, 50); if (!name) return s; const id = w.id || 'w' + uid();
  const map = txt(w.map, 300), phone = txt(w.phone, 20).replace(/[^\d+ ]/g, '');
  const shop = { id, name, kind: KINDS.some(k => k[0] === w.kind) ? w.kind : 'general', area: txt(w.area, 40), phone, map: /^https?:\/\//i.test(map) ? map : '', rating: Math.round(num(w.rating, 0, 5, 0)), note: txt(w.note, 200), at: Date.now() };
  return { ...s, workshops: { ...(s.workshops || {}), [id]: shop } };
}
export function deleteShop(s, id) { const workshops = { ...(s.workshops || {}) }; delete workshops[id]; return { ...s, workshops, deleted: { ...(s.deleted || {}), [`shop:${id}`]: Date.now() } }; }
export const shopList = (s) => vals(s.workshops).sort((a, b) => (b.rating || 0) - (a.rating || 0) || a.name.localeCompare(b.name));
/** What a workshop has done on your cars (from the visit log: visits name the workshop by id, or by name from before). */
export function shopVisits(s, w) {
  const out = [];
  for (const c of vals(s.cars)) for (const v of c.log || []) if (v.shop === w.id || (!v.shop && v.place && v.place.toLowerCase() === w.name.toLowerCase())) out.push({ car: c, ...v });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

// ───────────────────────── quotes: one workshop's prices for a list of items, so two can be compared side by side
export function saveQuote(s, q) {
  const id = q.id || 'q' + uid();
  const lines = (Array.isArray(q.lines) ? q.lines : []).filter(l => l && (CC.ITEMS[l.item] || txt(l.label, 60))).map(l => ({ item: CC.ITEMS[l.item] ? l.item : '', label: CC.ITEMS[l.item] ? '' : txt(l.label, 60), price: Math.round(num(l.price, 0, 1e6, 0)), labour: Math.round(num(l.labour, 0, 1e6, 0)), part: txt(l.part, 60) })).slice(0, 40);
  const quote = { id, car: txt(q.car, 40), shop: txt(q.shop, 40), shopName: txt(q.shopName, 50), date: isKey(q.date) ? q.date : keyOf(new Date()), lines, note: txt(q.note, 200), at: Date.now() };
  return { ...s, quotes: { ...(s.quotes || {}), [id]: quote } };
}
export function deleteQuote(s, id) { const quotes = { ...(s.quotes || {}) }; delete quotes[id]; return { ...s, quotes, deleted: { ...(s.deleted || {}), [`quote:${id}`]: Date.now() } }; }
export const quoteTotal = (q) => (q.lines || []).reduce((t, l) => t + (l.price || 0) + (l.labour || 0), 0);
export const quotesFor = (s, carId) => vals(s.quotes).filter(q => !carId || q.car === carId).sort((a, b) => b.date.localeCompare(a.date));
export const quoteShop = (s, q) => s.workshops?.[q.shop]?.name || q.shopName || 'Workshop';
export const lineName = (l) => CC.ITEMS[l.item]?.label || l.label || '—';
/**
 * Two (or more) quotes side by side: one row per item in any of them, the price in each (null = not quoted), the cheapest
 * marked, and each quote's total over the items they all share (so a quote that leaves things out doesn't look cheaper).
 */
export function compare(quotes) {
  const key = (l) => l.item || `x:${l.label.toLowerCase()}`;
  const rows = new Map();
  for (const [i, q] of quotes.entries()) for (const l of q.lines || []) { const k = key(l); if (!rows.has(k)) rows.set(k, { key: k, name: lineName(l), item: l.item, cells: quotes.map(() => null) }); rows.get(k).cells[i] = { price: (l.price || 0) + (l.labour || 0), part: l.part }; }
  const list = [...rows.values()].sort((a, b) => (CC.ITEM_ORDER.indexOf(a.item) + 1 || 99) - (CC.ITEM_ORDER.indexOf(b.item) + 1 || 99));
  for (const r of list) { const prices = r.cells.filter(Boolean).map(c => c.price).filter(p => p > 0); r.best = prices.length > 1 ? Math.min(...prices) : null; }
  const shared = list.filter(r => r.cells.every(Boolean));
  const totals = quotes.map((q, i) => ({ all: quoteTotal(q), shared: shared.reduce((t, r) => t + r.cells[i].price, 0), missing: list.filter(r => !r.cells[i]).length }));
  const cheapest = shared.length && quotes.length > 1 ? totals.reduce((b, t, i) => t.shared < totals[b].shared ? i : b, 0) : null;
  return { rows: list, shared: shared.length, totals, cheapest };
}

// ───────────────────────── what each part has cost you (visits with lines, and quotes)
/**
 * Every price you have for an item, newest first: paid (from a visit's lines) and quoted. → [{ date, price, part, where, paid }]
 */
export function priceHistory(s, carId, item) {
  const out = [], car = s.cars?.[carId];
  for (const v of car?.log || []) for (const l of v.lines || []) if (l.item === item && l.price) out.push({ date: v.date, price: l.price, part: l.part || '', where: s.workshops?.[v.shop]?.name || v.place || '', paid: true });
  for (const q of quotesFor(s, carId)) for (const l of q.lines || []) if (l.item === item && (l.price || l.labour)) out.push({ date: q.date, price: (l.price || 0) + (l.labour || 0), part: l.part || '', where: quoteShop(s, q), paid: false });
  return out.sort((a, b) => b.date.localeCompare(a.date));
}
/** The last price paid for an item, for "last time: 180 SAR at …". */
export const lastPaid = (s, carId, item) => priceHistory(s, carId, item).find(x => x.paid) || null;
