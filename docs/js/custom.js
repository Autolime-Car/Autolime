// Your choices for how Autolime looks and behaves — synced with your state (settings.custom), unlike the per-device interface.
// Pure: defaults, sanitising and small getters. Settings › Customise edits it.
export const TABS = [['dash', 'Dash'], ['service', 'Service'], ['fuel', 'Fuel'], ['papers', 'Papers'], ['trip', 'Trip'], ['garage', 'Garage']];
export const ACCENTS = [['lime', 'Lime', '#b6f23a'], ['amber', 'Amber', '#ffb020'], ['cyan', 'Gauge cyan', '#3ad6f2'], ['orange', 'Orange', '#ff7a1a'], ['red', 'Racing red', '#ff4b3e']];
export const DEFAULTS = {
  start: 'dash',
  tabs: { hidden: [], order: TABS.map(t => t[0]) },
  look: { accent: 'lime', density: 'comfy', fun: true, motion: true },
  car: { tank: 70, severe: true },
};
const arr = (v, ok) => Array.isArray(v) ? [...new Set(v.filter(x => ok.includes(x)))] : [];
const num = (v, lo, hi, d) => Number.isFinite(+v) && v !== '' && v !== null && v !== undefined ? Math.max(lo, Math.min(hi, Math.round(+v))) : d;
const ids = (l) => l.map(x => Array.isArray(x) ? x[0] : x);
/** Clean, complete settings — never trust what came from storage or another device. */
export function custom(s) {
  const c = s?.settings?.custom || {}, t = c.tabs || {}, l = c.look || {}, k = c.car || {};
  const order = [...arr(t.order, ids(TABS)), ...ids(TABS).filter(x => !(t.order || []).includes(x))];
  const hidden = arr(t.hidden, ids(TABS)).filter(x => x !== 'dash');
  return {
    start: ids(TABS).includes(c.start) && !hidden.includes(c.start) ? c.start : 'dash',
    tabs: { hidden, order },
    look: { accent: ids(ACCENTS).includes(l.accent) ? l.accent : 'lime', density: ['comfy', 'compact'].includes(l.density) ? l.density : 'comfy', fun: l.fun !== false, motion: l.motion !== false },
    car: { tank: num(k.tank, 30, 150, 70), severe: k.severe !== false },
  };
}
/** Change one part: returns the new state (patch is merged one level deep). */
export function setCustom(s, part, patch) { const cur = custom(s); return { ...s, settings: { ...s.settings, custom: { ...cur, [part]: typeof patch === 'object' && !Array.isArray(patch) ? { ...cur[part], ...patch } : patch } } }; }
export const toggleIn = (list, id) => list.includes(id) ? list.filter(x => x !== id) : [...list, id];
export function move(list, id, dir) { const i = list.indexOf(id), j = i + dir; if (i < 0 || j < 0 || j >= list.length) return list; const l = [...list]; [l[i], l[j]] = [l[j], l[i]]; return l; }
export const visibleTabs = (s) => { const c = custom(s); return c.tabs.order.filter(t => !c.tabs.hidden.includes(t)); };
