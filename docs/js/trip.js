// Road-trip legs: city-to-city road distances and driving times across Saudi Arabia (approximate, main highways), the
// owner's East–West–Qassim loop as a ready route, and where to fill up on each leg. Pure (no DOM).
// Distances are rounded road distances on the main highways; the map app on the day wins.

export const CITIES = [
  ['kharj', 'Al Kharj', 'الخرج'], ['riyadh', 'Riyadh', 'الرياض'], ['muzahmiyah', 'Al Muzahmiyah', 'المزاحمية'], ['qiddiyah', 'Qiddiyah', 'القدية'],
  ['buraidah', 'Buraidah', 'بريدة'], ['unaizah', 'Unaizah', 'عنيزة'], ['hail', 'Hail', 'حائل'], ['madinah', 'Madinah', 'المدينة المنورة'],
  ['makkah', 'Makkah', 'مكة المكرمة'], ['jeddah', 'Jeddah', 'جدة'], ['taif', 'Taif', 'الطائف'], ['dammam', 'Dammam', 'الدمام'],
  ['khobar', 'Al Khobar', 'الخبر'], ['jubail', 'Jubail', 'الجبيل'], ['hofuf', 'Al Ahsa (Hofuf)', 'الأحساء'], ['abha', 'Abha', 'أبها'], ['tabuk', 'Tabuk', 'تبوك'], ['alula', 'AlUla', 'العلا'],
];
const NAME = Object.fromEntries(CITIES.map(([id, en]) => [id, en]));
export const cityName = (id) => NAME[id] || id;
/** [a, b, km, hours] — both directions. */
const ROADS = [
  ['kharj', 'riyadh', 85, 1], ['riyadh', 'muzahmiyah', 50, 0.6], ['muzahmiyah', 'qiddiyah', 25, 0.4], ['riyadh', 'qiddiyah', 45, 0.7],
  ['riyadh', 'buraidah', 350, 3.5], ['buraidah', 'unaizah', 30, 0.4], ['buraidah', 'hail', 300, 3], ['buraidah', 'madinah', 500, 4.8], ['hail', 'madinah', 450, 4.5],
  ['madinah', 'jeddah', 420, 4], ['madinah', 'makkah', 450, 4.3], ['madinah', 'alula', 330, 3.5], ['jeddah', 'makkah', 80, 1], ['makkah', 'taif', 90, 1.3],
  ['makkah', 'riyadh', 870, 8.5], ['jeddah', 'riyadh', 950, 9], ['taif', 'riyadh', 790, 7.5], ['riyadh', 'madinah', 850, 8],
  ['riyadh', 'dammam', 400, 4], ['dammam', 'khobar', 20, 0.4], ['dammam', 'jubail', 95, 1], ['dammam', 'hofuf', 150, 1.6], ['khobar', 'hofuf', 155, 1.7],
  ['riyadh', 'hofuf', 330, 3.3], ['kharj', 'hofuf', 340, 3.5], ['kharj', 'dammam', 440, 4.5], ['riyadh', 'hail', 650, 6.3], ['riyadh', 'abha', 1000, 10], ['riyadh', 'tabuk', 1300, 12.5], ['madinah', 'tabuk', 680, 6.5],
];
/** Road distance between two cities: { km, hrs } or null when not in the table. */
export function road(a, b) {
  if (a === b) return { km: 0, hrs: 0 };
  const r = ROADS.find(([x, y]) => (x === a && y === b) || (x === b && y === a));
  return r ? { km: r[2], hrs: r[3] } : null;
}
/** Ready routes: the owner's mid-December loop, and the two halves of it. */
export const ROUTES = [
  { id: 'loop', name: 'Qassim, West & East loop', stops: ['kharj', 'riyadh', 'buraidah', 'madinah', 'jeddah', 'makkah', 'riyadh', 'dammam', 'hofuf', 'kharj'] },
  { id: 'west', name: 'Madinah, Jeddah & Makkah', stops: ['riyadh', 'buraidah', 'madinah', 'jeddah', 'makkah', 'riyadh'] },
  { id: 'east', name: 'Dammam, Khobar & Al Ahsa', stops: ['riyadh', 'dammam', 'khobar', 'hofuf', 'riyadh'] },
];
/** Stops → legs with km and hours (legs not in the table come out with 0 km, for you to type). */
export function legsOf(stops) {
  const out = [];
  for (let i = 1; i < stops.length; i++) { const r = road(stops[i - 1], stops[i]); out.push({ from: cityName(stops[i - 1]), to: cityName(stops[i]), km: r?.km || 0, hrs: r?.hrs || 0, day: '', done: false }); }
  return out;
}
/**
 * Where to fill up on a leg: with a tank of `tank` litres at `l100`, refuel at half a tank (stations thin out between
 * cities). → { stops: number of fill-ups on the way, every: km between them, litres for the leg }
 */
export function fuelPlan(leg, l100 = 7.5, tank = 70) {
  const half = Math.floor(tank / 2 / (l100 / 100) / 10) * 10, litres = Math.round(leg.km * l100 / 100);
  return { every: half, stops: leg.km > half ? Math.ceil(leg.km / half) - 1 : 0, litres, fillBefore: leg.km > half * 0.6 };
}
/** Plain driving advice for a leg by its length. */
export function legTip(leg) {
  if (leg.km >= 700) return 'Long day: start early, rest every 2 hours, fill up at half a tank.';
  if (leg.km >= 400) return 'Fill up before you leave and once on the way; one proper rest stop.';
  if (leg.km >= 150) return 'Leave with at least half a tank.';
  return '';
}
