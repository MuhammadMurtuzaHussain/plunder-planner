import { TYPE_SINGULAR, fmt, imgUrl } from '../lib/analysis.ts';
import type { Catalog, Item } from '../lib/types.ts';

export function ItemTile({ cat, item, chance }: { cat: Catalog; item: Item; chance?: number }) {
  const src = imgUrl(cat, item);
  return (
    <li className="tile">
      <div className={`tile-img r-${item.s ? 'series' : item.r ?? 'common'}`}>{src && <img src={src} alt="" loading="lazy" decoding="async" width={96} height={96} />}</div>
      <div className="tile-body">
        <span className="tile-name">{item.n}</span>
        <span className="tile-meta">{TYPE_SINGULAR[item.t]}{item.s ? `, ${item.s}` : ''}</span>
        <span className="tile-nums"><b>{fmt(item.p)}</b>{chance !== undefined && <span>{chance >= 0.995 ? 'on sale now' : `${Math.max(1, Math.round(chance * 100))}% chance`}</span>}</span>
      </div>
    </li>
  );
}
