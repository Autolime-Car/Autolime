// The fixture with every toolbox tool on and some made-up tool data (for the smoke and layout tests).
import { state } from './fixture.mjs';
import * as EX from '../docs/js/extras.js';
const car = state.cars.car1;
const x = {
  tyreLog: [{ date: '2026-08-01', tread: { FL: 6.5, FR: 6.4, RL: 7, RR: 7 }, psi: { FL: 35, FR: 35, RL: 35, RR: 35 } }, { date: '2026-11-01', tread: { FL: 5.6, FR: 5.5, RL: 6.6, RR: 6.6 }, psi: { FL: 30, FR: 35, RL: 35, RR: 35 } }],
  battery: [{ date: '2026-06-01', v: 12.7 }, { date: '2026-09-01', v: 12.55 }, { date: '2026-11-20', v: 12.45 }],
  stock: [{ id: 's1', name: 'Test oil 4L', qty: 0, per: 1, unit: 'can', item: 'oil' }, { id: 's2', name: 'Washer fluid', qty: 2, per: 1, unit: 'L' }],
  insQuotes: [{ id: 'q1', company: 'Test Insurer A', premium: 980, kind: 'third' }, { id: 'q2', company: 'Test Insurer B', premium: 1350, kind: 'comp', towing: true }],
  fines: [{ date: '2026-11-03', sar: 150, what: 'parking' }], finesChecked: '2026-10-01',
  parked: { at: Date.parse('2026-11-25T17:30:00+03:00'), lat: 24.5, lon: 46.3, note: 'B2 · pillar 14' },
  values: [{ date: '2026-05-01', sar: 42000, src: 'test' }, { date: '2026-11-01', sar: 39500, src: 'test' }],
};
const fuel = (car.fuel || []).map((f, i) => ({ ...f, station: i % 2 ? 'Test Station A' : 'Test Station B' }));
export const toolsState = {
  ...state,
  cars: { ...state.cars, car1: { ...car, x, fuel } },
  settings: { ...state.settings, custom: { ...(state.settings?.custom || {}), tools: EX.presetMap('all'), car: { tank: 70, severe: true, commute: 45 } } },
};
