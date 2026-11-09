/**
 * Fit the logistic-regression weights in src/lib/coefficients.json.
 * For each cut-off date we hide the future, build features, and learn which
 * ones predicted "this item was on sale in this 14-day window".   Run: node scripts/train.ts
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { FEATURES, WINDOW, actualWindow, dateToDay, eachPair, hydrate } from '../src/lib/model.ts';

const cat = hydrate(JSON.parse(readFileSync(new URL('../public/data/catalog.json', import.meta.url), 'utf8')));
const K = FEATURES.length;
const cfg = { tolerance: 3, wide: 28 };
const cutoffs = process.argv.slice(2).length ? process.argv.slice(2) : ['2024-11-09', '2025-11-09'];

const X: number[] = [], Y: number[] = [];
for (const c of cutoffs) {
  const asOf = dateToDay(cat.epoch, new Date(c + 'T00:00:00Z'));
  const horizon = Math.min(365, cat.lastDay - asOf - WINDOW);
  // every 5th window across the year, plus each of the first twelve days (near-term behaviour differs)
  const starts = Int32Array.from(new Set([...Array.from({ length: 12 }, (_, k) => asOf + 1 + k), ...Array.from({ length: Math.floor(horizon / 5) }, (_, k) => asOf + 1 + k * 5)])).sort();
  const truth = Array.from(starts, s => new Set(actualWindow(cat, s).map(i => i.idx)));
  eachPair(cat, asOf, starts, cfg, (i, w, x) => { for (let k = 0; k < K; k++) X.push(x[k]); Y.push(truth[w].has(i) ? 1 : 0); });
}
const N = Y.length;
console.log('examples', N, 'positive rate', (Y.reduce((a, b) => a + b, 0) / N).toFixed(4));

// Newton's method (IRLS) with a touch of ridge.
const w = new Array(K).fill(0);
const solve = (A: number[][], b: number[]) => {
  const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let piv = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
    [M[c], M[piv]] = [M[piv], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
};
for (let iter = 0; iter < 25; iter++) {
  const g = new Array(K).fill(0), H = Array.from({ length: K }, () => new Array(K).fill(0));
  let ll = 0;
  for (let r = 0; r < N; r++) {
    let z = 0; const o = r * K;
    for (let k = 0; k < K; k++) z += w[k] * X[o + k];
    const p = 1 / (1 + Math.exp(-z)), e = Y[r] - p, s = p * (1 - p);
    ll += Y[r] ? Math.log(p + 1e-12) : Math.log(1 - p + 1e-12);
    for (let a = 0; a < K; a++) { const xa = X[o + a]; if (xa === 0) continue; g[a] += e * xa; for (let b = a; b < K; b++) H[a][b] += s * xa * X[o + b]; }
  }
  for (let a = 0; a < K; a++) { for (let b = 0; b < a; b++) H[a][b] = H[b][a]; H[a][a] += 1e-3; g[a] -= 1e-3 * w[a]; }
  const step = solve(H, g); let mx = 0;
  for (let k = 0; k < K; k++) { w[k] += step[k]; mx = Math.max(mx, Math.abs(step[k])); }
  if (iter % 3 === 0 || mx < 1e-6) console.log('iter', iter, 'logloss', (-ll / N).toFixed(5));
  if (mx < 1e-6) break;
}
FEATURES.forEach((f, k) => console.log(w[k].toFixed(3).padStart(8), f));
if (!process.env.DRY) writeFileSync(new URL('../src/lib/coefficients.json', import.meta.url), JSON.stringify({ ...cfg, weights: w.map(v => +v.toFixed(4)) }) + '\n');
