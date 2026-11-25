// Renewals: what to do, in order, for the istimara, the fahas, the insurance and the driving licence, and when to start.
// Ticks are kept per paper and per expiry date (car.renew["fahas:2027-04-15"]), so a renewed paper starts with a fresh list.
// Pure (no DOM). Autolime only reminds: nothing here contacts a government site.
import * as L from './car.js';

/** id → { label, icon, start (days before expiry to begin), steps: [[id, text, ar]] } */
export const RENEW = {
  fahas: { label: 'Fahas (inspection)', icon: '🔧', start: 30, where: 'MVPI centres (الفحص الدوري) — book a slot online first', steps: [
    ['book', 'Book a slot in the periodic-inspection (MVPI) booking site or app', 'حجز موعد الفحص الدوري'],
    ['prep', 'Before you go: all lights and indicators work, wipers and washer, no warning lights on the dash, tyres with tread', 'تأكد من الأنوار والمساحات والكفرات'],
    ['papers', 'Take the istimara and your ID; the insurance must be valid', 'الاستمارة والهوية والتأمين'],
    ['pass', 'Pass (green sticker) — or fix what failed and go back within the retest window', 'النجاح أو الإصلاح وإعادة الفحص'],
    ['date', 'Type the new fahas date in Autolime', 'سجل التاريخ الجديد'],
  ] },
  insurance: { label: 'Insurance', icon: '🛡️', start: 30, where: 'your insurer’s app, or an aggregator to compare', steps: [
    ['quotes', 'Get 2–3 quotes (your insurer and a comparison site) — compare third party and comprehensive', 'مقارنة عروض التأمين'],
    ['loyalty', 'Renewing with the same insurer before the end date often keeps a loyalty discount — ask for it', 'خصم الولاء عند التجديد المبكر'],
    ['noclaims', 'No claims last year? Ask for the no-claims discount (it shows on your Najm record)', 'خصم عدم وجود مطالبات'],
    ['buy', 'Buy it so it starts the day the old one ends (no gap: driving uninsured is fined)', 'شراء الوثيقة بدون انقطاع'],
    ['pdf', 'Read the new policy PDF into Autolime (Papers › Insurance)', 'أضف الوثيقة الجديدة'],
  ] },
  istimara: { label: 'Istimara (registration)', icon: '📄', start: 30, where: 'Absher › Vehicles', steps: [
    ['ins', 'Insurance valid', 'تأمين ساري'],
    ['fahas', 'Fahas valid', 'فحص دوري ساري'],
    ['fines', 'Traffic fines paid (Absher or Efaa)', 'سداد المخالفات'],
    ['fee', 'Pay the registration renewal fee (SADAD)', 'سداد رسوم التجديد'],
    ['renew', 'Renew in Absher › Vehicles › Renew registration', 'تجديد الاستمارة في أبشر'],
    ['date', 'Type the new istimara date in Autolime', 'سجل التاريخ الجديد'],
  ] },
  licence: { label: 'Driving licence', icon: '🪪', start: 60, where: 'Absher › Driving licence', steps: [
    ['medical', 'Medical check at an approved centre (it is sent to Absher electronically)', 'الفحص الطبي'],
    ['fines', 'Traffic fines paid', 'سداد المخالفات'],
    ['fee', 'Pay the licence renewal fee (SADAD)', 'سداد رسوم التجديد'],
    ['renew', 'Renew in Absher › Driving licence; the card comes by post or print the digital one', 'تجديد الرخصة في أبشر'],
    ['date', 'Type the new expiry date in Autolime', 'سجل التاريخ الجديد'],
  ] },
};
/** The renewals that are open now (inside their start window, or overdue), soonest first. */
export function openRenewals(s, car, now = new Date()) {
  const out = [], dr = L.driverOf(s);
  for (const id of ['fahas', 'insurance', 'istimara', 'licence']) {
    const date = id === 'licence' ? dr.licence : car?.[id]; const d = L.daysUntil(date, now);
    if (d === null || d > RENEW[id].start) continue;
    const ticks = car?.renew?.[`${id}:${date}`] || [];
    out.push({ id, ...RENEW[id], date, days: d, ticks, done: ticks.length, total: RENEW[id].steps.length });
  }
  return out.sort((a, b) => a.days - b.days);
}
/** Tick or untick a step. The licence's ticks live on the first car (one driver). */
export function tick(car, id, date, step) {
  const k = `${id}:${date}`, cur = new Set(car.renew?.[k] || []); cur.has(step) ? cur.delete(step) : cur.add(step);
  return { ...car, renew: { ...(car.renew || {}), [k]: [...cur] } };
}
/** When to book the fahas: 30 days before (the slots near the end fill up). */
export function fahasBookBy(car) { return car?.fahas ? L.addMonths(car.fahas, -1) : ''; }
