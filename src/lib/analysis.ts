/** Everything the screens need, derived from the catalogue + a locker. */
import { WINDOW, dateToDay, dayToDate, passes, type Filter, type Forecast, type WindowScore } from './model.ts';
import type { Catalog, Item, ItemType } from './types.ts';

export const TYPE_LABEL: Record<ItemType, string> = {
  outfit: 'Outfits', backpack: 'Back blings', pickaxe: 'Pickaxes', glider: 'Gliders', emote: 'Emotes',
  wrap: 'Wraps', shoe: 'Kicks', sidekick: 'Sidekicks', contrail: 'Contrails', music: 'Lobby music',
  spray: 'Sprays', emoji: 'Emoticons', loadingscreen: 'Loading screens', aura: 'Auras', toy: 'Toys',
  track: 'Jam tracks', instrument: 'Instruments', car: 'Cars', lego: 'LEGO kits',
};
export const TYPE_SINGULAR: Record<ItemType, string> = {
  outfit: 'Outfit', backpack: 'Back bling', pickaxe: 'Pickaxe', glider: 'Glider', emote: 'Emote',
  wrap: 'Wrap', shoe: 'Kicks', sidekick: 'Sidekick', contrail: 'Contrail', music: 'Lobby music',
  spray: 'Spray', emoji: 'Emoticon', loadingscreen: 'Loading screen', aura: 'Aura', toy: 'Toy',
  track: 'Jam track', instrument: 'Instrument', car: 'Car', lego: 'LEGO kit',
};
/** Filter chips, biggest spend first. Small categories share one chip. */
export const TYPE_GROUPS: { key: string; label: string; types: ItemType[] }[] = [
  { key: 'outfit', label: 'Outfits', types: ['outfit'] },
  { key: 'backpack', label: 'Back blings', types: ['backpack'] },
  { key: 'pickaxe', label: 'Pickaxes', types: ['pickaxe'] },
  { key: 'emote', label: 'Emotes', types: ['emote'] },
  { key: 'glider', label: 'Gliders', types: ['glider'] },
  { key: 'shoe', label: 'Kicks', types: ['shoe'] },
  { key: 'wrap', label: 'Wraps', types: ['wrap'] },
  { key: 'track', label: 'Jam tracks', types: ['track'] },
  { key: 'other', label: 'Everything else', types: ['instrument', 'car', 'sidekick', 'contrail', 'music', 'spray', 'emoji', 'loadingscreen', 'aura', 'toy', 'lego'] },
];

export const fmt = (n: number) => Math.round(n).toLocaleString('en-US');
/** Estimates are shown to the nearest hundred: finer digits would be false precision. */
export const est = (n: number) => (Math.round(n / 100) * 100).toLocaleString('en-US');
export const fmtK = (n: number) => (n >= 1000 ? `${Math.round(n / 1000)}k` : `${Math.round(n)}`);
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDay(cat: Catalog, day: number, withYear = false) {
  const d = dayToDate(cat.epoch, day);
  return `${MONTH[d.getUTCMonth()]} ${d.getUTCDate()}${withYear ? `, ${d.getUTCFullYear()}` : ''}`;
}
export const fmtRange = (cat: Catalog, start: number) => `${fmtDay(cat, start)} to ${fmtDay(cat, start + WINDOW - 1, true)}`;
export const imgUrl = (cat: Catalog, it: Item) => (it.i ? (it.i.startsWith('~') ? cat.imgPrefix + it.i.slice(1) : it.i) : null);

/** Every start date from tomorrow to the last one that still fits inside 2027. */
export function buildStarts(cat: Catalog): Int32Array {
  const last = dateToDay(cat.epoch, new Date(Date.UTC(2027, 11, 31))) - WINDOW + 1;
  return Int32Array.from({ length: last - cat.lastDay }, (_, k) => cat.lastDay + 1 + k);
}
/** The 2026 pass has to be claimed (started) by Dec 15, 2026; its 14 days then run on from there. */
export const CLAIM_BY_2026 = Date.UTC(2026, 11, 15);
export function yearBounds(cat: Catalog) {
  const end26 = dateToDay(cat.epoch, new Date(CLAIM_BY_2026));
  const start27 = dateToDay(cat.epoch, new Date(Date.UTC(2027, 0, 1)));
  return { end26, start27 };
}

export function ownedMask(cat: Catalog, ids: Set<number> | null): Uint8Array {
  const m = new Uint8Array(cat.items.length);
  if (ids) for (const it of cat.items) if (ids.has(it.g)) m[it.idx] = 1;
  return m;
}

export interface Pick { index: number; score: WindowScore; value: number; edge: number; median: number }
/** Best window among scores[lo..hi], plus how far it sits above the median of that span. */
export function pickBest(scores: WindowScore[], lo: number, hi: number, get: (s: WindowScore) => number = s => s.total): Pick | null {
  if (hi < lo || lo < 0) return null;
  let best = lo;
  for (let i = lo; i <= hi; i++) if (get(scores[i]) > get(scores[best])) best = i;
  const vals = scores.slice(lo, hi + 1).map(get).sort((a, b) => a - b);
  const median = vals[vals.length >> 1];
  return { index: best, score: scores[best], value: get(scores[best]), edge: median > 0 ? get(scores[best]) / median - 1 : 0, median };
}

/**
 * Seasonal themes. An item belongs to a theme when its shop visits cluster in that season
 * (Epic brings festive items back at the same time each year) or its name or set says so.
 */
export interface Theme { key: string; label: string; noun: string; from: [number, number]; to: [number, number]; words: RegExp }
export const THEMES: Theme[] = [
  { key: 'winter', label: 'Winter', noun: 'winter', from: [12, 1], to: [1, 6], words: /snow|frost|winter|holiday|claus|ginger|jingle|yule|merry|blizzard|icicle|nutcracker|sleigh|festive|krampus|polar|arctic/i },
  { key: 'halloween', label: 'Halloween', noun: 'Halloween', from: [10, 1], to: [11, 3], words: /ghoul|skull|pumpkin|fright|nightmare|spook|witch|zombie|hallow|grave|haunt|vampire|bone|creep|scare|phantom|reaper|dusk/i },
  { key: 'summer', label: 'Summer', noun: 'summer', from: [6, 10], to: [8, 31], words: /summer|beach|surf|tropical|pool|sunny|island|sand|lifeguard|scuba|coast|tiki|wave/i },
  { key: 'valentine', label: "Valentine's", noun: "Valentine's", from: [1, 28], to: [2, 17], words: /love|heart|cupid|valentine|sweetheart|crush|romance/i },
  { key: 'spring', label: 'Spring', noun: 'spring', from: [3, 10], to: [4, 25], words: /bunny|egg|spring|easter|clover|lucky|rabbit|blossom|shamrock/i },
];
/** Things a player can say they own most of, or are after: the seasons above plus the big collab families. */
export interface Kind { key: string; label: string; noun: string; group: 'season' | 'family' }
const FAMILIES: { key: string; label: string; series: string }[] = [
  { key: 'marvel', label: 'Marvel', series: 'Marvel' }, { key: 'dc', label: 'DC', series: 'Dc' },
  { key: 'starwars', label: 'Star Wars', series: 'Star Wars' }, { key: 'icon', label: 'Icon Series', series: 'Icon' },
  { key: 'gaming', label: 'Gaming Legends', series: 'Gaming Legends' },
];
export const KINDS: Kind[] = [
  ...THEMES.map(t => ({ key: t.key, label: t.label, noun: t.noun, group: 'season' as const })),
  ...FAMILIES.map(f => ({ key: f.key, label: f.label, noun: f.label, group: 'family' as const })),
  { key: 'othercollab', label: 'Other collabs', noun: 'collab', group: 'family' },
  { key: 'og', label: 'Chapter 1 originals', noun: 'Chapter 1', group: 'family' },
];
/** One 0/1 mask per kind. `themes` is the output of themeMask. */
export function kindMasks(cat: Catalog, themes: Uint8Array): Map<string, Uint8Array> {
  const out = new Map<string, Uint8Array>();
  THEMES.forEach((t, i) => out.set(t.key, Uint8Array.from(themes, v => (v === i + 1 ? 1 : 0))));
  for (const f of FAMILIES) out.set(f.key, Uint8Array.from(cat.items, it => (it.s === f.series ? 1 : 0)));
  const named = new Set(FAMILIES.map(f => f.series));
  out.set('othercollab', Uint8Array.from(cat.items, it => (it.c && it.t !== 'track' && !(it.s && named.has(it.s)) ? 1 : 0)));
  const ch2 = dateToDay(cat.epoch, new Date(Date.UTC(2019, 9, 15)));   // Chapter 2 began mid October 2019
  out.set('og', Uint8Array.from(cat.items, it => (!it.c && it.days[0] < ch2 ? 1 : 0)));
  return out;
}
export function unionMask(n: number, masks: (Uint8Array | undefined)[], extra: number[] = []): Uint8Array | null {
  if (!masks.some(Boolean) && !extra.length) return null;
  const out = new Uint8Array(n);
  for (const m of masks) if (m) for (let i = 0; i < n; i++) if (m[i]) out[i] = 1;
  for (const i of extra) out[i] = 1;
  return out;
}

/** theme index + 1 per item (0 = not seasonal). */
export function themeMask(cat: Catalog): Uint8Array {
  const out = new Uint8Array(cat.items.length);
  const inSeason = (t: Theme, m: number, d: number) => {
    const v = m * 100 + d, a = t.from[0] * 100 + t.from[1], b = t.to[0] * 100 + t.to[1];
    return a <= b ? v >= a && v <= b : v >= a || v <= b;
  };
  for (const it of cat.items) {
    if (it.t === 'track' || it.t === 'car' || it.t === 'instrument') continue;
    const visits: [number, number][] = [];
    for (let k = 0; k < it.days.length; k++) if (k === 0 || it.days[k] - it.days[k - 1] > 3) {
      const d = dayToDate(cat.epoch, it.days[k]); visits.push([d.getUTCMonth() + 1, d.getUTCDate()]);
    }
    let best = 0, bestShare = 0;
    THEMES.forEach((t, ti) => {
      const share = visits.filter(([m, d]) => inSeason(t, m, d)).length / visits.length;
      const named = t.words.test(it.n) || (it.e ? t.words.test(it.e) : false);
      const ok = (visits.length >= 3 && share >= 0.6) || (named && (share >= 0.34 || visits.length < 3));
      if (ok && share >= bestShare) { best = ti + 1; bestShare = share; }
    });
    out[it.idx] = best;
  }
  return out;
}

export interface Ranked { item: Item; p: number }
export interface WindowDetail {
  likely: Ranked[];      // not owned, ranked by chance x price
  yours: Ranked[];       // owned, ranked the same way
  byType: { type: ItemType; shop: number; owned: number }[];
}
export function windowDetail(cat: Catalog, f: Forecast, w: number, owned: Uint8Array, filter: Filter, levels: Map<string, number>, season: number, focus?: Uint8Array | null): WindowDetail {
  const likely: Ranked[] = [], yours: Ranked[] = [];
  const ownedBy = new Map<ItemType, number>();
  const off = w * f.nItems;
  for (const it of cat.items) {
    if (!passes(it, filter)) continue;
    const p = f.p[off + it.idx];
    if (p < 0.01) continue;
    if (owned[it.idx]) { yours.push({ item: it, p }); ownedBy.set(it.t, (ownedBy.get(it.t) ?? 0) + p * it.p); }
    else if (!focus || focus[it.idx]) likely.push({ item: it, p });
  }
  const rank = (a: Ranked, b: Ranked) => b.p * b.item.p - a.p * a.item.p;
  likely.sort(rank); yours.sort(rank);
  const shopBy = new Map<ItemType, number>();
  for (const [key, lvl] of levels) {
    const [t, src] = key.split('|') as [ItemType, string];
    if (filter.types.has(t) && (filter.source === 'all' || filter.source === src)) shopBy.set(t, (shopBy.get(t) ?? 0) + lvl * season);
  }
  const byType = [...shopBy].map(([type, shop]) => ({ type, shop, owned: ownedBy.get(type) ?? 0 }))
    .sort((a, b) => (b.shop - b.owned) - (a.shop - a.owned));
  return { likely, yours, byType };
}

export interface TodayCheck {
  day: number;
  onSale: Item[];          // not owned, on sale on the latest day of data
  value: number;           // their V-Bucks
  percentile: number;      // share of the last 365 days with a lower figure
  typical: number;         // median day
  expectedPass: number;    // what a pass started now tends to add up to, given today's shelf
  typicalPass: number;
}
/** How does the shop right now compare with the last year of days, for this locker? */
export function todayCheck(cat: Catalog, owned: Uint8Array, filter: Filter): TodayCheck {
  const N = cat.lastDay + 1, span = 365 + WINDOW;
  const from = N - span;
  const dayVal = new Float64Array(span), winVal = new Float64Array(span);
  const onSale: Item[] = [];
  for (const it of cat.items) {
    if (owned[it.idx] || !passes(it, filter)) continue;
    let prev = -1;
    for (const d of it.days) {
      if (d >= from) {
        dayVal[d - from] += it.p;
        for (let s = Math.max(d - WINDOW + 1, prev + 1, from); s <= d; s++) winVal[s - from] += it.p;
      }
      prev = d;
    }
    if (it.days[it.days.length - 1] === cat.lastDay) onSale.push(it);
  }
  onSale.sort((a, b) => b.p - a.p);
  const value = dayVal[span - 1];
  const xs: number[] = [], ys: number[] = [];
  for (let k = 0; k < 365; k++) { xs.push(dayVal[k]); ys.push(winVal[k]); }   // only windows that have fully played out
  const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const mx = mean(xs), my = mean(ys);
  let sxy = 0, sxx = 0;
  for (let i = 0; i < xs.length; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const slope = sxx > 0 ? sxy / sxx : 0;
  const recent = Array.from(dayVal.slice(WINDOW));
  const sorted = [...recent].sort((a, b) => a - b);
  return {
    day: cat.lastDay, onSale, value,
    percentile: recent.filter(v => v < value).length / recent.length,
    typical: sorted[sorted.length >> 1],
    expectedPass: my + slope * (value - mx),
    typicalPass: [...ys].sort((a, b) => a - b)[ys.length >> 1],
  };
}

export interface LockerStats { read: number; shopItems: number; shopValue: number; byType: { type: ItemType; n: number }[] }
export function lockerStats(cat: Catalog, ids: Set<number> | null, owned: Uint8Array): LockerStats {
  let shopItems = 0, shopValue = 0; const by = new Map<ItemType, number>();
  for (const it of cat.items) if (owned[it.idx]) { shopItems++; shopValue += it.p; by.set(it.t, (by.get(it.t) ?? 0) + 1); }
  return { read: ids?.size ?? 0, shopItems, shopValue, byType: [...by].map(([type, n]) => ({ type, n })).sort((a, b) => b.n - a.n) };
}
