/**
 * Forecast model.
 *
 * What a 14-day shop pass is worth to you = everything the shop sells in those 14 days
 * minus the part you already own. The two halves are estimated separately:
 *
 *   shop total   - nearly flat through the year (it moves about 10% either way), so we use
 *                  last year's average with a cautious seasonal nudge from the two previous years.
 *   owned part   - a logistic regression gives, per item, the probability it is on sale in a
 *                  given window (how often it returns, how long since last seen, whether it
 *                  tends to appear around these dates). Summed over the items in your locker.
 *
 * Everything here is pure and shared by the app and the scripts in scripts/.
 */
import type { Catalog, Item, ItemType, RawCatalog } from './types.ts';

export const WINDOW = 14;

/** Which items count: by type, and by collab versus Fortnite original. */
export interface Filter { types: Set<ItemType>; source: 'all' | 'collab' | 'original' }
export const passes = (it: Item, f: Filter) => f.types.has(it.t) && (f.source === 'all' || (f.source === 'collab') === !!it.c);
const kindKey = (it: Item) => `${it.t}|${it.c ? 'collab' : 'original'}`;
const kindPasses = (key: string, f: Filter) => { const [t, src] = key.split('|'); return f.types.has(t as ItemType) && (f.source === 'all' || f.source === src); };

import coef from './coefficients.json' with { type: 'json' };

/** Logistic-regression weights, fitted by scripts/train.ts on past seasons. */
export interface ModelParams {
  tolerance: number;   // days of slack either side when matching the same dates in past years
  wide: number;        // looser slack, catches events that moved by a few weeks
  weights: number[];   // one per feature, see FEATURES
}
export const FEATURES = [
  'bias', 'on sale same dates 1y ago', 'not on sale 1y ago', 'on sale 2y ago', 'not on sale 2y ago',
  'on sale 3y ago', 'on sale both 1y and 2y ago', 'on sale nearby dates 1y ago',
  'sqrt share of last 2 years on sale', 'sqrt share of last year on sale', 'years since last seen',
  'times on sale in last year (log)', 'share of all past visits that fell near these dates',
  'on sale today and the window starts soon',
] as const;
export const DEFAULT_PARAMS: ModelParams = coef as ModelParams;

export function hydrate(raw: RawCatalog): Catalog {
  const items: Item[] = raw.items.map((r, idx) => {
    const days = new Int32Array(r.h.length);
    let d = 0;
    for (let k = 0; k < r.h.length; k++) { d += r.h[k]; days[k] = d; }
    const { h: _h, ...rest } = r;
    return { ...rest, n: rest.n.trim(), idx, days };
  });
  const byFngg = new Map<number, Item>();
  for (const it of items) byFngg.set(it.g, it);
  return { epoch: new Date(raw.epoch + 'T00:00:00Z'), lastDay: raw.lastDay, built: raw.built, imgPrefix: raw.imgPrefix, items, byFngg };
}

export const dayToDate = (epoch: Date, day: number) => new Date(epoch.getTime() + day * 86400000);
export const dateToDay = (epoch: Date, date: Date) => Math.round((date.getTime() - epoch.getTime()) / 86400000);

/** Same calendar date `years` earlier (Feb 29 falls back to Feb 28). */
function shiftYears(epoch: Date, day: number, years: number): number {
  const d = dayToDate(epoch, day);
  const y = d.getUTCFullYear() - years, m = d.getUTCMonth();
  let dom = d.getUTCDate();
  if (m === 1 && dom === 29) dom = 28;
  return dateToDay(epoch, new Date(Date.UTC(y, m, dom)));
}

export interface Forecast {
  starts: Int32Array;            // day index of each candidate window start
  nItems: number;
  /** p[w * nItems + i] = P(item i on sale during window w) */
  p: Float32Array;
  asOf: number;
}

const K = FEATURES.length;
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

/**
 * Walk every (item, window) pair and hand its feature vector to `visit`.
 * Only data up to `asOf` is read, so the same code serves forecasting, training and backtests.
 */
export function eachPair(
  cat: Catalog, asOf: number, starts: Int32Array, params: Pick<ModelParams, 'tolerance' | 'wide'>,
  visit: (item: number, window: number, x: Float64Array) => void,
) {
  const { items, epoch } = cat;
  const W = starts.length, L = 3;
  // The same dates in the three most recent years we can already observe (-1 when there are fewer).
  // For a window more than a year away, "last year" therefore means the latest year on record.
  const ref = new Int32Array(W * L).fill(-1);
  for (let w = 0; w < W; w++) {
    let k = 0;
    for (let back = 1; k < L && back <= L + 2; back++) {
      const lo = shiftYears(epoch, starts[w], back);
      if (lo + WINDOW - 1 + params.tolerance <= asOf) ref[w * L + k++] = lo;
    }
  }
  const size = asOf + 2;
  const prefix = new Int32Array(size + 1);
  const x = new Float64Array(K);
  const dayOfYear = (day: number) => {
    const d = dayToDate(epoch, day);
    return Math.round((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000);
  };
  const doy = Int16Array.from({ length: size }, (_, d) => dayOfYear(d));
  const startDoy = Int16Array.from(starts, dayOfYear);

  for (let i = 0; i < items.length; i++) {
    const days = items[i].days;
    if (days.length === 0 || days[0] > asOf) continue;
    prefix.fill(0);
    let lastSeen = -1;
    for (let k = 0; k < days.length && days[k] <= asOf; k++) { prefix[days[k] + 1] = 1; lastSeen = days[k]; }
    for (let d = 1; d <= size; d++) prefix[d] += prefix[d - 1];
    const count = (lo: number, hi: number) => prefix[Math.min(hi, asOf) + 1] - prefix[Math.max(Math.min(lo, asOf + 1), 0)];
    const first = days[0];

    // Share of 14-day windows that contained the item, over the last two years and the last year.
    const share = (lookback: number) => {
      const from = Math.max(asOf - lookback, first);
      let hits = 0, total = 0;
      for (let s = from; s + WINDOW - 1 <= asOf; s++) { total++; if (count(s, s + WINDOW - 1) > 0) hits++; }
      return total > 0 ? hits / Math.max(total, 180) : 0; // pad: a launch run alone should not look "frequent"
    };
    const b2 = Math.sqrt(share(730)), b1 = Math.sqrt(share(365));
    // Separate visits to the shop in the last year (runs of consecutive days count once).
    let runs = 0;
    for (let k = 0; k < days.length && days[k] <= asOf; k++)
      if (days[k] > asOf - 365 && (k === 0 || days[k] - days[k - 1] > 3)) runs++;
    const gap = Math.min(asOf - lastSeen, 1460) / 365;
    // Day-of-year of every past visit, to measure how seasonal the item is.
    const visits: number[] = [];
    for (let k = 0; k < days.length && days[k] <= asOf; k++)
      if (k === 0 || days[k] - days[k - 1] > 3) visits.push(doy[days[k]]);

    for (let w = 0; w < W; w++) {
      x.fill(0); x[0] = 1;
      if (lastSeen === asOf) x[13] = Math.max(0, 1 - (starts[w] - asOf - 1) / 10);  // fades over ten days
      const hit = [0, 0, 0];
      for (let k = 0; k < L; k++) {
        const lo = ref[w * L + k];
        if (lo < 0 || first > lo + WINDOW - 1) continue;         // year unusable, or item did not exist yet
        hit[k] = count(lo - params.tolerance, lo + WINDOW - 1 + params.tolerance) > 0 ? 1 : -1;
      }
      if (hit[0] === 1) x[1] = 1; else if (hit[0] === -1) x[2] = 1;
      if (hit[1] === 1) x[3] = 1; else if (hit[1] === -1) x[4] = 1;
      if (hit[2] === 1) x[5] = 1;
      if (hit[0] === 1 && hit[1] === 1) x[6] = 1;
      if (hit[0] === -1 && count(ref[w * L] - params.wide, ref[w * L] + WINDOW - 1 + params.wide) > 0) x[7] = 1;
      x[8] = b2; x[9] = b1; x[10] = gap; x[11] = Math.log1p(runs);
      if (visits.length >= 3) {
        const c = startDoy[w] + WINDOW / 2; let near = 0;
        for (const v of visits) { const d = Math.abs(v - c); if (Math.min(d, 365 - d) <= 21) near++; }
        x[12] = near / visits.length;
      }
      visit(i, w, x);
    }
  }
}

/**
 * @param asOf    last day of data the model may look at
 * @param starts  window start days (> asOf)
 */
export function forecast(cat: Catalog, asOf: number, starts: Int32Array, params: ModelParams = DEFAULT_PARAMS): Forecast {
  const n = cat.items.length, W = starts.length;
  const p = new Float32Array(n * W);
  const wts = params.weights;
  eachPair(cat, asOf, starts, params, (i, w, x) => {
    let z = 0;
    for (let k = 0; k < K; k++) z += wts[k] * x[k];
    p[w * n + i] = sigmoid(z);
  });

  return { starts, nItems: n, p, asOf };
}

/** Total V-Bucks on sale in every 14-day window of recorded history, split by item type and collab/original. */
export function historicTotals(cat: Catalog, upTo: number): Map<string, Float64Array> {
  const N = upTo - WINDOW + 2, out = new Map<string, Float64Array>();
  for (const it of cat.items) {
    const key = kindKey(it);
    let arr = out.get(key); if (!arr) { arr = new Float64Array(N); out.set(key, arr); }
    let prev = -1;
    for (const d of it.days) {
      if (d > upTo) break;
      for (let s = Math.max(d - WINDOW + 1, prev + 1, 0); s <= d && s < N; s++) arr[s] += it.p;
      prev = d;
    }
  }
  return out;
}

export interface Baseline {
  /** Average V-Bucks per 14-day window over the last year, keyed "type|collab" or "type|original". */
  level: Map<string, number>;
  /** Seasonal multiplier per candidate window (around 1). */
  season: Float32Array;
  /** Typical relative error of the shop-total estimate, from backtests. */
  relError: number;
}

export const SEASON_SHRINK = 0.35;

export function baseline(cat: Catalog, asOf: number, starts: Int32Array): Baseline {
  const totals = historicTotals(cat, asOf);
  const N = asOf - WINDOW + 2;
  const all = new Float64Array(N);
  const level = new Map<string, number>();
  for (const [t, arr] of totals) {
    let s = 0; for (let d = N - 365; d < N; d++) s += arr[d];
    level.set(t, s / 365);
    for (let d = 0; d < N; d++) all[d] += arr[d];
  }
  const smooth = (d: number, r = 10) => { let s = 0, c = 0; for (let k = -r; k <= r; k++) if (d + k >= 0 && d + k < N) { s += all[d + k]; c++; } return c ? s / c : NaN; };
  const yearMean = (center: number) => { let s = 0, c = 0; for (let d = center - 182; d <= center + 182; d++) if (d >= 0 && d < N) { s += all[d]; c++; } return s / c; };
  const season = new Float32Array(starts.length);
  for (let w = 0; w < starts.length; w++) {
    let acc = 0, used = 0;
    for (let back = 1; back <= 5 && used < 2; back++) {
      const d = shiftYears(cat.epoch, starts[w], back);
      if (d + 10 >= N || d < 365) continue;
      acc += smooth(d) / yearMean(d); used++;
    }
    season[w] = used ? 1 + SEASON_SHRINK * (acc / used - 1) : 1;
  }
  // Beyond a year out the reference years step back by one; smooth so that seam is not a cliff.
  const smoothed = new Float32Array(season.length);
  for (let w = 0; w < season.length; w++) {
    let s = 0, c = 0;
    for (let k = -10; k <= 10; k++) if (w + k >= 0 && w + k < season.length) { s += season[w + k]; c++; }
    smoothed[w] = s / c;
  }
  return { level, season: smoothed, relError: 0.09 };
}

export interface WindowScore {
  start: number;
  shop: number;     // expected V-Bucks on sale in the window (enabled item types)
  owned: number;    // expected V-Bucks of that which you already own
  total: number;    // shop - owned: what the pass could unlock for you
  sd: number;       // rough one-sigma uncertainty of `total`
  focus: number;    // expected V-Bucks of unowned items in the focus set (0 when no focus)
  focusSd: number;
}

/** `owned[i]` is 1 when item i is in the locker. Only items passing `filter` are counted. */
export function scoreWindows(cat: Catalog, f: Forecast, base: Baseline, owned: Uint8Array, filter: Filter, focus?: Uint8Array | null): WindowScore[] {
  const n = f.nItems, out: WindowScore[] = [];
  const value = new Float32Array(n);
  for (let i = 0; i < n; i++) value[i] = owned[i] && passes(cat.items[i], filter) ? cat.items[i].p : 0;
  let level = 0;
  for (const [k, v] of base.level) if (kindPasses(k, filter)) level += v;
  for (let w = 0; w < f.starts.length; w++) {
    let ev = 0, vr = 0; const off = w * n;
    for (let i = 0; i < n; i++) {
      const v = value[i]; if (v === 0) continue;
      const q = f.p[off + i];
      ev += q * v; vr += q * (1 - q) * v * v;
    }
    let fv = 0, fr = 0;
    if (focus) for (let i = 0; i < n; i++) {
      if (!focus[i] || owned[i] || !passes(cat.items[i], filter)) continue;
      const q = f.p[off + i], v = cat.items[i].p;
      fv += q * v; fr += q * (1 - q) * v * v;
    }
    const shop = level * base.season[w];
    out.push({ start: f.starts[w], shop, owned: ev, total: Math.max(0, shop - ev), sd: Math.sqrt(vr + (shop * base.relError) ** 2), focus: fv, focusSd: Math.sqrt(fr) });
  }
  return out;
}

/** What was actually on sale in [start, start+13]: used for history views and backtests. */
export function actualWindow(cat: Catalog, start: number): Item[] {
  const end = start + WINDOW - 1, res: Item[] = [];
  for (const it of cat.items) {
    const d = it.days; let lo = 0, hi = d.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (d[m] < start) lo = m + 1; else hi = m; }
    if (lo < d.length && d[lo] <= end) res.push(it);
  }
  return res;
}
