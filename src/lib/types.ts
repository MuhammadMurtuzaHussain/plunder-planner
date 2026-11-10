export type ItemType =
  | 'outfit' | 'backpack' | 'pickaxe' | 'glider' | 'contrail' | 'emote' | 'wrap' | 'shoe' | 'sidekick'
  | 'music' | 'spray' | 'emoji' | 'loadingscreen' | 'aura' | 'toy' | 'track' | 'instrument' | 'car' | 'lego';

/** One row of public/data/catalog.json */
export interface RawItem {
  g: number;            // fortnite.gg id (what locker links contain)
  a: string;            // fortnite-api.com id
  n: string;            // name
  t: ItemType;
  r: string | null;     // rarity
  s: string | null;     // series (collab family)
  e: string | null;     // set
  c?: 1;                // collab (licensed crossover) rather than a Fortnite original
  p: number;            // V-Bucks price
  i: string | null;     // image url ("~" = imgPrefix)
  h: number[];          // delta-encoded day indices the item was in the shop
}

export interface RawCatalog {
  epoch: string;        // ISO date of day 0
  lastDay: number;      // last day index with data
  built: string;
  imgPrefix: string;
  fnggCount: number;
  items: RawItem[];
}

export interface Item extends Omit<RawItem, 'h'> {
  idx: number;
  days: Int32Array;     // absolute day indices, ascending
}

export interface Catalog {
  epoch: Date;
  lastDay: number;
  built: string;
  imgPrefix: string;
  items: Item[];
  byFngg: Map<number, Item>;
}
