// Made-up car data and a shifts.json shaped like Mandarin's, for the tests. Never a real plate, VIN, policy, name or number.
// The month: day shifts (D1 08:00–20:00) on weekdays, Fri/Sat off, nights 19–21/11, off 22/11, leave 25/11.
const d = (n) => `2026-11-${String(n).padStart(2, '0')}`;
const dd = (n) => `2026-12-${String(n).padStart(2, '0')}`;
const myDays = [];
for (let n = 9; n <= 30; n++) {
  const dow = new Date(2026, 10, n).getDay();
  if ([19, 20, 21].includes(n)) myDays.push({ date: d(n), kind: 'work', code: 'N1', type: 'N', site: 'Upper Village', start: '20:00', end: '08:00', overnight: true });
  else if (n === 25) myDays.push({ date: d(n), kind: 'leave', code: 'AL', label: 'Annual leave' });
  else if (dow === 5 || dow === 6 || n === 22) myDays.push({ date: d(n), kind: 'off', code: '' });
  else myDays.push({ date: d(n), kind: 'work', code: 'D1', type: 'D', site: 'Upper Village', start: '08:00', end: '20:00' });
}
for (let n = 1; n <= 20; n++) { const dow = new Date(2026, 11, n).getDay(); myDays.push(dow === 5 || dow === 6 ? { date: dd(n), kind: 'off', code: '' } : { date: dd(n), kind: 'work', code: 'D1', type: 'D', site: 'Upper Village', start: '08:00', end: '20:00' }); }
export const shifts = { app: 'mandarin', contract: 2, updatedAt: '2026-11-16T05:00:00Z', me: { name: 'Dr Test Me', key: 'id:1' }, days: myDays,
  roster: { 'id:1': { name: 'Dr Test Me', unit: 'gp', days: {} } },
  legend: { D1: { label: 'Day · Upper Village', site: 'Upper Village', type: 'D', start: '08:00', end: '20:00' }, N1: { label: 'Night · Upper Village', site: 'Upper Village', type: 'N', start: '20:00', end: '08:00' } } };

const at = Date.parse('2026-11-10T10:00:00Z');
export const car = { id: 'car1', name: 'Test Camry', icon: '🚗', model: 'camry-2016', severe: true, plate: 'ر س ط 4821', vin: '1M8GDM9AXKP042788', year: 2016, colour: 'ازرق فاتح', seats: 5, istimara: '2027-03-01', fahas: dd(10), insurance: '2026-12-20', odo: 49200, odoAt: d(10),
  odoLog: [{ date: '2026-09-01', km: 46100 }, { date: '2026-10-01', km: 47800 }, { date: d(10), km: 49200 }],
  care: { oil: { last: '2026-07-20', lastKm: 41500, count: 3 }, rotate: { last: '2026-07-20', lastKm: 41500 }, airFilter: { last: '2025-12-01', lastKm: 33000 }, battery: { last: '2025-11-01' }, wash: { last: d(10) }, brakes: { last: '2026-03-01', lastKm: 38000 }, cabinFilter: { last: '2026-03-01', lastKm: 38000 }, tyres: { last: '2026-06-12' }, balancing: { last: '2026-06-12' }, atf: { last: '2024-01-01', lastKm: 20000 } },
  fuel: [{ date: '2026-10-02', litres: 50, cost: 116.5, km: 47850, full: true }, { date: '2026-10-20', litres: 41, cost: 95.53, km: 48400, full: true }, { date: d(1), litres: 40, cost: 93.2, km: 48930, full: true }, { date: d(8), litres: 45, cost: 104.85, km: 49150, full: false }],
  log: [{ date: '2026-07-20', km: 41500, items: ['oil', 'rotate'], cost: 260, place: 'Test workshop', shop: 'w1', note: '', what: 'care', lines: [{ item: 'oil', price: 180, part: 'Test 0W-20' }, { item: 'rotate', price: 80, part: '' }] }],
  ins: { company: 'Test Takaful', policy: 'P0000-TEST-0001', kind: 'third', premium: 1200, deductible: 0, phone: '800 000 0000', start: '2025-12-21', perks: ['Towing up to 150 km', 'Loyalty discount if renewed before it ends'] },
  tyre: { brand: 'Test Tyre 2', size: '215/60R16 99V', dot: '2025', warranty: 5, fitted: '2026-06-12', qty: 4, cost: 1600, where: 'Test tyres' },
  plan: { date: dd(5), items: ['oil', 'brakes', 'rotors', 'airFilter', 'atf'], added: ['atf'], note: 'Before the trip', shop: 'w1' },
  trip: { name: 'Test loop', date: dd(15), end: dd(21), km: 0, price: 2.33, checks: ['oil', 'tyres'], legs: [{ from: 'Al Kharj', to: 'Riyadh', km: 85, hrs: 1, day: dd(15), done: false }, { from: 'Riyadh', to: 'Buraidah', km: 350, hrs: 3.5, day: dd(15), done: false }, { from: 'Buraidah', to: 'Madinah', km: 500, hrs: 4.8, day: dd(16), done: false }], log: [], daily: {} },
  at };
export const state = {
  app: 'autolime', version: 1, updatedAt: at,
  cars: { car1: car },
  workshops: { w1: { id: 'w1', name: 'Test workshop', kind: 'general', area: 'Test area', phone: '0500000000', map: '', rating: 4, note: '', at }, w2: { id: 'w2', name: 'Second test garage', kind: 'oil', area: 'Other area', phone: '', map: '', rating: 0, note: '', at } },
  quotes: { q1: { id: 'q1', car: 'car1', shop: 'w1', shopName: '', date: d(12), lines: [{ item: 'oil', price: 170, labour: 30, part: 'Test 0W-20' }, { item: 'brakes', price: 250, labour: 80, part: 'Test pads' }, { item: 'atf', price: 220, labour: 60, part: 'ATF WS' }], note: '', at },
    q2: { id: 'q2', car: 'car1', shop: 'w2', shopName: '', date: d(13), lines: [{ item: 'oil', price: 160, labour: 20, part: 'Other 0W-20' }, { item: 'brakes', price: 300, labour: 60, part: 'Other pads' }], note: '', at } },
  photos: { p1: { id: 'p1', car: 'car1', kind: 'istimara', file: '', name: 'istimara.jpg', date: d(10), note: '', visit: '', item: '', at } },
  deleted: {}, stamps: {}, migrated: { from: 'calamansi', at, counts: { cars: 1 } },
  settings: { driver: { licence: '2027-01-10', issued: '2016-09-04', type: 'Private', blood: 'O+', ice: 'Test contact' } },
};
/** A made-up Calamansi state with a car and the driver (the migration's source). */
export const calamansi = { app: 'calamansi', updatedAt: at, recipes: { r1: { title: 'Test' } }, chores: {}, cars: { cc1: { ...car, id: 'cc1', plan: null, trip: null, at: at - 1000 } }, settings: { driver: { licence: '2030-04-06', issued: '2016-09-04', type: 'Private', blood: 'O-', ice: '' } } };
