// Service: every part by system with its Arabic workshop name and a countdown (km or date, whichever first), the planned
// service, the tyres, the history with what each visit cost (and its receipt), and where the intervals come from.
import * as EXU from './ui-extras.js';
import { h } from './util.js';
import * as L from './car.js';
import * as CC from './carcare.js';
import * as PH from './photos.js';
import { ctx, S, dmy, kmT, sar, putCar, currentCar, carChips, viewHead, stat, tag, careRow } from './ui-kit.js';
import { visitSheet, planSheet, workshopSheet, tyreSheet, thumb } from './ui-sheets.js';
import { planCard } from './ui-dash.js';

let filter = 'all';
export function renderService() {
  const s = S(), now = new Date(), c = currentCar(s);
  if (!c) return [viewHead('Service'), h('div', { class: 'card empty' }, 'Add your car on the Dash first.')];
  if (!c.model) return [viewHead('Service'), carChips(s), h('div', { class: 'card' }, 'Give this car a care plan on the Dash.')];
  const items = CC.plan(c, now), by = Object.fromEntries(items.map(x => [x.id, x])), hp = CC.health(items);
  const counts = { late: items.filter(x => x.state === 'late').length, soon: items.filter(x => x.state === 'soon').length, unknown: items.filter(x => x.state === 'unknown').length };
  const show = (st) => filter === 'all' || (filter === 'due' ? st.state === 'late' || st.state === 'soon' : filter === 'unknown' ? st.state === 'unknown' : true);
  const sticker = PH.photoList(s, { car: c.id, kind: 'sticker' })[0];
  return [viewHead('Service', h('button', { class: 'btn primary', onClick: () => visitSheet(c) }, '🔧 Log a service')), carChips(s),
    h('div', { class: 'wide pair' }, h('div', { class: 'card' }, h('div', { class: 'stats' }, stat(hp.pct === null ? `${hp.tracked}/${hp.total}` : `${hp.pct}%`, hp.pct === null ? 'parts known' : 'health', 'acc'), stat(String(counts.late), 'overdue'), stat(String(counts.soon), 'due soon'), stat(String(counts.unknown), 'not set up')),
      h('div', { class: 'row wrap', style: { marginTop: '10px' } }, h('button', { class: 'btn', onClick: () => planSheet(c) }, c.plan ? '🗓 Edit the plan' : '🗓 Plan a service'), h('button', { class: 'btn', onClick: () => workshopSheet(c) }, '🧾 Workshop list'), h('button', { class: 'btn', onClick: () => ctx.takePhoto({ kind: 'sticker', car: c.id, note: 'Windscreen service sticker' }) }, '🏷️ Photo of the sticker'),
        h('button', { class: `chip ${c.severe !== false ? 'sel' : ''}`, 'aria-pressed': String(c.severe !== false), title: 'Toyota’s severe-use plan: heat, dust, city traffic', onClick: () => { putCar({ ...c, severe: c.severe === false }); ctx.render(); } }, c.severe !== false ? '🔥 Hot & dusty plan' : 'Normal plan')),
      sticker ? h('div', { class: 'row', style: { marginTop: '10px' } }, h('div', { style: { width: '96px' } }, thumb(sticker)), h('div', { class: 'tiny dim grow' }, `Last sticker photo ${dmy(sticker.date)}. Compare its next-change km with the plan below.`)) : null),
    c.plan ? planCard(c, now) : null),
    h('div', { class: 'seg', role: 'tablist', style: { marginBottom: '10px' } }, [['all', 'All parts'], ['due', `Due (${counts.late + counts.soon})`], ['unknown', `Not set up (${counts.unknown})`]].map(([id, l]) => h('button', { class: filter === id ? 'active' : '', role: 'tab', 'aria-selected': String(filter === id), onClick: () => { filter = id; ctx.render(); } }, l))),
    ...CC.GROUPS.map(([name, icon, ids]) => { const rows = ids.filter(id => by[id] && show(by[id])).map(id => by[id]); if (!rows.length) return null;
      const late = rows.filter(x => x.state === 'late').length;
      return h('div', { class: 'card' }, h('div', { class: 'group-h' }, h('span', { class: 'ic' }, icon), h('div', { class: 'title' }, name), late ? tag('late', `${late} overdue`) : null), h('div', { class: 'rows' }, rows.map(st => careRow(c, st)))); }),
    c.tyre ? tyreCard(c, now) : h('button', { class: 'card cta', onClick: () => tyreSheet(c) }, h('span', { class: 'ic' }, '🛞'), h('span', { class: 'grow' }, h('b', {}, 'Your tyres'), h('span', { class: 'tiny dim' }, ' · brand, size, DOT year, warranty')), h('span', { class: 'arrow' }, '+')),
    historyCard(c, s),
    ...EXU.tabTools('service', c),
    h('details', { class: 'card adv' }, h('summary', {}, 'Where these numbers come from'), h('ul', { class: 'small' }, CC.SOURCES.map(([t, u]) => h('li', {}, h('a', { href: u, target: '_blank', rel: 'noopener' }, t)))),
      h('div', { class: 'tiny dim' }, 'Intervals mix Toyota’s published schedule with what Saudi service sources and owner forums advise; the “hot & dusty” plan is Toyota’s severe-use one. Your workshop’s advice wins — change any interval by tapping the part.')), EXU.toolsHint('service')];
}
function tyreCard(c, now) {
  const t = c.tyre, age = t.dot ? now.getFullYear() - +t.dot : null, months = t.fitted ? Math.round(-L.daysUntil(t.fitted, now) / 30.4) : null;
  const warrantyEnd = t.fitted && t.warranty ? `${+t.fitted.slice(0, 4) + t.warranty}${t.fitted.slice(4)}` : '';
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('span', { class: 'ic' }, '🛞'), h('div', { class: 'grow' }, h('div', { class: 'title', style: { margin: 0 } }, t.brand || 'Tyres'), h('div', { class: 'tiny dim' }, [t.size, t.qty ? `× ${t.qty}` : ''].filter(Boolean).join(' '))), h('button', { class: 'btn sm ghost', onClick: () => tyreSheet(c) }, 'Edit')),
    h('div', { class: 'stats' }, t.fitted ? stat(dmy(t.fitted), `fitted${months != null ? ` · ${months} months ago` : ''}`) : null, t.dot ? stat(t.dot, `made (DOT)${age ? ` · ${age} y old` : ''}`) : null, warrantyEnd ? stat(dmy(warrantyEnd), `warranty (${t.warranty} y)`) : null, t.cost ? stat(t.cost.toLocaleString('en'), 'SAR for the set') : null),
    h('div', { class: 'tiny dim', style: { marginTop: '8px' } }, 'Rotate every 8,000 km and balance with it; align after any suspension work. Keep the receipt for the warranty.'));
}
function historyCard(c, s) {
  const log = [...(c.log || [])].reverse().slice(0, 12); if (!log.length) return null;
  const year = new Date().getFullYear(), spent = (c.log || []).filter(x => x.date.startsWith(String(year))).reduce((t, x) => t + (x.cost || 0), 0);
  return h('div', { class: 'card' }, h('div', { class: 'card-h' }, h('div', { class: 'title' }, 'History'), spent ? h('span', { class: 'tiny dim' }, `${sar(spent)} in ${year}`) : null),
    h('div', { class: 'rows' }, log.map(x => { const where = s.workshops?.[x.shop]?.name || x.place, rc = (x.photos || []).map(id => s.photos?.[id]).filter(Boolean);
      return h('details', { class: 'item', style: { display: 'block', cursor: 'default' } }, h('summary', { class: 'row', style: { listStyle: 'none', cursor: 'pointer' } }, h('b', { class: 'n', style: { minWidth: '78px' } }, dmy(x.date)), h('span', { class: 'grow small' }, (x.items || []).map(i => CC.ITEMS[i]?.label || i).join(', ') || x.what || 'service'), h('span', { class: 'n' }, x.cost ? sar(x.cost) : '')),
        h('div', { class: 'tiny dim', style: { marginTop: '6px' } }, [x.km ? kmT(x.km) : '', where, x.note].filter(Boolean).join(' · ')),
        x.lines?.length ? h('div', { class: 'rows', style: { marginTop: '6px' } }, x.lines.map(l => h('div', { class: 'row small' }, h('span', { class: 'grow' }, `${CC.ITEMS[l.item]?.icon || ''} ${CC.ITEMS[l.item]?.label || l.item}${l.part ? ` · ${l.part}` : ''}`), l.price ? h('b', { class: 'n' }, sar(l.price)) : null))) : null,
        rc.length ? h('div', { class: 'wallet', style: { marginTop: '8px' } }, rc.map(p => thumb(p))) : null); })));
}
