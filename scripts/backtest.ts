/**
 * Backtest: hide everything after a cut-off date, forecast the following year,
 * then compare with what the shop actually sold.   Run: npm run backtest [locker-link-file]
 */
import { readFileSync } from 'node:fs';
import { WINDOW, actualWindow, baseline, dateToDay, dayToDate, forecast, hydrate, scoreWindows } from '../src/lib/model.ts';
import { decodeLocker } from '../src/lib/locker.ts';
import type { ItemType } from '../src/lib/types.ts';

const cat = hydrate(JSON.parse(readFileSync(new URL('../public/data/catalog.json', import.meta.url), 'utf8')));
const ALL = { types: new Set(cat.items.map(i => i.t)) as Set<ItemType>, source: 'all' as const };
const lockerIds = process.argv[2] ? (await decodeLocker(readFileSync(process.argv[2], 'utf8'))).ids : new Set<number>();
const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
const pearson = (a: number[], b: number[]) => {
  const ma = mean(a), mb = mean(b); let sab = 0, sa = 0, sb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); sa += (a[i] - ma) ** 2; sb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(sa * sb);
};
const iso = (d: number) => dayToDate(cat.epoch, d).toISOString().slice(0, 10);

for (const cutoff of ['2024-11-09', '2025-11-09']) {
  const asOf = dateToDay(cat.epoch, new Date(cutoff + 'T00:00:00Z'));
  const horizon = Math.min(365, cat.lastDay - asOf - WINDOW);
  const starts = Int32Array.from({ length: horizon }, (_, k) => asOf + 1 + k);
  const f = forecast(cat, asOf, starts), base = baseline(cat, asOf, starts);
  // Only items the locker could have held at the cut-off count as owned.
  const owned = Uint8Array.from(cat.items, i => (lockerIds.has(i.g) && i.days[0] <= asOf ? 1 : 0));
  const pred = scoreWindows(cat, f, base, owned, ALL);

  const actShop: number[] = [], actOwned: number[] = [];
  const bins = Array.from({ length: 10 }, () => ({ n: 0, p: 0, hit: 0 }));
  for (let k = 0; k < starts.length; k++) {
    const on = actualWindow(cat, starts[k]); const onSet = new Set(on.map(i => i.idx));
    actShop.push(on.reduce((a, b) => a + b.p, 0)); actOwned.push(on.reduce((a, b) => a + (owned[b.idx] ? b.p : 0), 0));
    if (k % 7 === 0) for (let i = 0; i < cat.items.length; i++) {
      if (cat.items[i].days[0] > asOf) continue;
      const q = f.p[k * f.nItems + i], b = bins[Math.min(9, Math.floor(q * 10))]; b.n++; b.p += q; if (onSet.has(i)) b.hit++;
    }
  }
  const actTotal = actShop.map((s, i) => s - actOwned[i]);
  const P = pred.map(x => x.total), best = P.indexOf(Math.max(...P)), bestAct = actTotal.indexOf(Math.max(...actTotal));
  const sorted = [...actTotal].sort((a, b) => b - a);
  console.log({
    cutoff, windows: starts.length, ownedItems: owned.reduce((a, b) => a + b, 0),
    shopTotal: { r: +pearson(pred.map(x => x.shop), actShop).toFixed(2), meanAbsPctErr: +mean(actShop.map((a, i) => Math.abs(pred[i].shop - a) / a)).toFixed(3), bias: +(mean(pred.map(x => x.shop)) / mean(actShop)).toFixed(3) },
    ownedPart: lockerIds.size ? { r: +pearson(pred.map(x => x.owned), actOwned).toFixed(2), bias: +(mean(pred.map(x => x.owned)) / mean(actOwned)).toFixed(3) } : 'no locker given',
    forYou: { r: +pearson(P, actTotal).toFixed(2), meanAbsPctErr: +mean(actTotal.map((a, i) => Math.abs(P[i] - a) / a)).toFixed(3) },
    pick: { date: iso(starts[best]), actual: actTotal[best], vsBest: +(actTotal[best] / actTotal[bestAct]).toFixed(3), vsMedian: +(actTotal[best] / sorted[sorted.length >> 1]).toFixed(3), topPct: +((sorted.indexOf(actTotal[best]) + 1) / sorted.length).toFixed(3), bestDate: iso(starts[bestAct]) },
  });
  console.log('  item calibration (predicted -> observed):', bins.filter(b => b.n > 50).map(b => `${(b.p / b.n).toFixed(2)}->${(b.hit / b.n).toFixed(2)}`).join('  '));
}
