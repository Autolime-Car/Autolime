// Layout bar for big and small screens: every tab at 5 widths × 3 interfaces.
// No sideways scroll, no card wider than the screen, no two cards on top of each other,
// and on a 1440p screen the space is used (3-column dash, cards in columns, pairs side by side).
import { chromium, serve, page, sleep } from './helpers.mjs';
import { shifts, state } from './fixture.mjs';

const { server, url } = await serve(), browser = await chromium.launch();
const TABS = ['dash', 'service', 'fuel', 'papers', 'trip', 'garage'];
const WIDTHS = [[2560, 1440], [1920, 1080], [1440, 900], [1024, 768], [390, 844]];
let bad = 0, ok = 0;
const check = (cond, msg) => { if (cond) ok++; else { bad++; console.log('✗', msg); } };

const measure = () => {
  const v = document.querySelector('.view.active'), W = innerWidth;
  const cards = [...v.querySelectorAll(':scope > .card, :scope > details.card, :scope > .pair > *, .dash-grid > div > *')]
    .filter(e => e.offsetParent).map(e => { const r = e.getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height, n: (e.querySelector('.title')?.textContent || e.className).slice(0, 30) }; });
  const overlaps = [];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const a = cards[i], b = cards[j];
    if (a.h && b.h && a.l < b.r - 2 && b.l < a.r - 2 && a.t < b.b - 2 && b.t < a.b - 2) overlaps.push(`${a.n} / ${b.n}`);
  }
  const lefts = new Set(cards.map(c => Math.round(c.l / 20)));
  const grid = document.querySelector('.view.active .dash-grid');
  const pair = [...document.querySelectorAll('.view.active .pair > *')].map(e => e.getBoundingClientRect());
  const cl = document.querySelector('.view.active .cluster')?.getBoundingClientRect();
  return {
    scrollW: document.documentElement.scrollWidth, W,
    wide: cards.filter(c => c.r > W + 1 || c.l < -1).map(c => c.n),
    overlaps, columns: lefts.size, n: cards.length,
    gridCols: grid ? getComputedStyle(grid).gridTemplateColumns.split(' ').length : 0,
    pairSide: pair.length === 2 ? Math.abs(pair[0].top - pair[1].top) < 4 && pair[1].left > pair[0].right : null,
    used: Math.max(0, ...cards.map(c => c.r)) - Math.min(W, ...cards.map(c => c.l)),
    clusterH: cl ? cl.height : 0,
    clipped: [...document.querySelectorAll('.view.active .cluster *')].filter(e => { if (!e.offsetParent || !cl) return false; const r = e.getBoundingClientRect(); return r.width && (r.right > cl.right + 1 || r.left < cl.left - 1); }).map(e => e.className || e.tagName).slice(0, 3),
    truncated: [...document.querySelectorAll('.view.active .cl-name, .view.active .cl-act, .view.active .title')].filter(e => e.offsetParent && e.scrollWidth > e.clientWidth + 2).map(e => e.textContent.slice(0, 20)).slice(0, 3),
  };
};

for (const ui of ['clean', 'paper', 'arcade']) for (const [w, hgt] of WIDTHS) {
  const { p, errors } = await page(browser, { width: w, height: hgt, time: '2026-11-25T19:30:00+03:00', seed: state, shifts });
  await p.addInitScript((u) => localStorage.setItem('autolime.ui', JSON.stringify({ ui: u, size: 'normal' })), ui);
  await p.goto(url); await sleep(700);
  for (const t of TABS) {
    await p.click(`nav.tabs button[data-view=${t}]`);
    await sleep(350);
    const m = await p.evaluate(measure), at = `${ui} ${w}px ${t}`;
    check(m.scrollW <= m.W + 1, `${at}: scrolls sideways (${m.scrollW} > ${m.W})`);
    check(!m.wide.length, `${at}: wider than the screen: ${m.wide.join(', ')}`);
    check(!m.clipped.length, `${at}: cut off at the cluster edge: ${m.clipped.join(', ')}`);
    check(!m.truncated.length, `${at}: text cut short: ${m.truncated.join(', ')}`);
    check(!m.overlaps.length, `${at}: cards on top of each other: ${m.overlaps.slice(0, 3).join('; ')}`);
    if (w >= 1400) {
      check(m.used >= (m.W - 260) * 0.85, `${at}: uses only ${Math.round(m.used)} of ${m.W} px`);
      if (t !== 'fuel' || m.n > 2) check(m.columns >= 2, `${at}: cards in one column`);
      if (t === 'dash') { check(m.gridCols === (w >= 1800 ? 3 : 2), `${at}: dash grid has ${m.gridCols} columns`); check(m.clusterH < (w >= 1700 ? 420 : 640), `${at}: cluster too tall (${m.clusterH})`); }
      if (t === 'service' || t === 'garage') check(m.pairSide === true, `${at}: top pair not side by side`);
    }
    if (w === 1024 && t === 'dash') check(m.gridCols >= 2, `${at}: dash grid has ${m.gridCols} columns`);
    if (w < 600) check(m.columns === 1, `${at}: phone shows ${m.columns} columns`);
  }
  // A sheet opens at a readable width on big screens.
  if (w >= 1400) {
    await p.click('nav.tabs button[data-view=service]'); await sleep(300);
    await p.click('text=Log a service'); await sleep(300);
    const sw = await p.evaluate(() => document.querySelector('dialog[open], .sheet')?.getBoundingClientRect().width || 0);
    check(sw >= 600 && sw <= 1100, `${ui} ${w}px: service sheet is ${Math.round(sw)} px wide`);
  }
  check(!errors.length, `${ui} ${w}px: errors ${errors.slice(0, 2).join(' | ')}`);
  await p.close();
}
console.log(bad ? `✗ wide: ${bad} failed, ${ok} passed` : `✓ wide: ${ok} checks`);
await browser.close(); server.close();
process.exit(bad ? 1 : 0);
