import { useMemo, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { TYPE_SINGULAR, fmt, imgUrl } from '../lib/analysis.ts';
import type { Catalog, Item } from '../lib/types.ts';

interface Props { cat: Catalog; want: number[]; own: number[]; onWant: (idx: number) => void; onOwn: (idx: number) => void; onRemove: (idx: number) => void }

/** Find specific items by name and mark them as wanted or already owned. */
export function ItemSearch({ cat, want, own, onWant, onOwn, onRemove }: Props) {
  const [q, setQ] = useState('');
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (needle.length < 2) return [];
    const rank = (it: Item) => (it.n.toLowerCase().startsWith(needle) ? 0 : 1) * 10 + (it.t === 'outfit' ? 0 : 1);
    return cat.items.filter(it => it.n.toLowerCase().includes(needle) || (it.e ?? '').toLowerCase().includes(needle))
      .sort((a, b) => rank(a) - rank(b) || b.p - a.p).slice(0, 8);
  }, [cat, q]);
  const chosen = [...want.map(i => ({ i, kind: 'Want' })), ...own.map(i => ({ i, kind: 'Own' }))];

  return (
    <div className="search">
      <label htmlFor="item-search" className="cap">Specific items</label>
      <input id="item-search" type="search" autoComplete="off" spellCheck={false} placeholder="Search by item or set name, e.g. Renegade Raider"
        value={q} onChange={e => setQ(e.target.value)} aria-describedby="item-search-help" />
      <p id="item-search-help" className="field-help">Mark items you want to rank the calendar by them, or items you own so they are not counted.</p>
      {q.trim().length >= 2 && (
        results.length ? (
          <ul className="search-results">
            {results.map(it => {
              const src = imgUrl(cat, it), isWant = want.includes(it.idx), isOwn = own.includes(it.idx);
              return (
                <li key={it.a}>
                  <span className={`tile-img r-${it.s ? 'series' : it.r ?? 'common'}`}>{src && <img src={src} alt="" loading="lazy" width={40} height={40} />}</span>
                  <span className="search-name"><b>{it.n}</b><span>{TYPE_SINGULAR[it.t]}, {fmt(it.p)} V-Bucks</span></span>
                  <button type="button" className="chip pickable" aria-pressed={isWant} onClick={() => (isWant ? onRemove(it.idx) : onWant(it.idx))}>Want</button>
                  <button type="button" className="chip pickable" aria-pressed={isOwn} onClick={() => (isOwn ? onRemove(it.idx) : onOwn(it.idx))}>Own</button>
                </li>
              );
            })}
          </ul>
        ) : <p className="search-none">No shop item matches that. Battle Pass and promo items are not sold in the shop, so they are not listed.</p>
      )}
      {chosen.length > 0 && (
        <ul className="picked" aria-label="Items you marked">
          {chosen.map(({ i, kind }) => (
            <li key={`${kind}${i}`}><span className="badge gold">{kind}</span>{cat.items[i].n}
              <button type="button" aria-label={`Remove ${cat.items[i].n}`} onClick={() => onRemove(i)}><X weight="bold" aria-hidden="true" /></button></li>
          ))}
        </ul>
      )}
    </div>
  );
}
