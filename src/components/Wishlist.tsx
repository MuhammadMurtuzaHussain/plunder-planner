import { useMemo } from 'react';
import { fmtDay, imgUrl, itemOutlook } from '../lib/analysis.ts';
import type { Forecast } from '../lib/model.ts';
import type { Catalog, Item } from '../lib/types.ts';

interface Props { cat: Catalog; f: Forecast; want: number[]; selected: number; onSelect: (i: number) => void; onOpen: (it: Item) => void }

/** Each wanted item with its chance across the year, its best date, and its chance in the fortnight on screen. */
export function Wishlist({ cat, f, want, selected, onSelect, onOpen }: Props) {
  const rows = useMemo(() => want.map(i => ({ item: cat.items[i], o: itemOutlook(f, i) })), [cat, f, want]);
  if (!rows.length) return null;
  const expected = rows.reduce((a, r) => a + r.o.series[selected], 0);
  return (
    <div className="wishlist">
      <div className="wishlist-head">
        <h3>Your wishlist</h3>
        <p className="muted">In the fortnight on screen you should catch about {expected.toFixed(1)} of {rows.length}.</p>
      </div>
      <ul>
        {rows.map(({ item, o }) => {
          const W = o.series.length, top = Math.max(o.bestP, 0.05), src = imgUrl(cat, item);
          const path = Array.from(o.series, (p, w) => `${w ? 'L' : 'M'}${((w / (W - 1)) * 200).toFixed(1)},${(30 - (p / top) * 26).toFixed(1)}`).join('');
          return (
            <li key={item.a}>
              <button type="button" className={`tile-img r-${item.s ? 'series' : item.r ?? 'common'}`} onClick={() => onOpen(item)} aria-label={`Open ${item.n}`}>{src && <img src={src} alt="" loading="lazy" />}</button>
              <span className="wish-name"><b>{item.n}</b><span>{Math.round(o.series[selected] * 100)}% in this fortnight</span></span>
              <svg viewBox="0 0 200 32" preserveAspectRatio="none" aria-hidden="true">
                <path d={path} /><line x1={(selected / (W - 1)) * 200} x2={(selected / (W - 1)) * 200} y1="0" y2="32" />
              </svg>
              <button type="button" className="chip" aria-pressed="true" onClick={() => onSelect(o.best)}>Best {fmtDay(cat, f.starts[o.best], true)}, {Math.round(o.bestP * 100)}%</button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
