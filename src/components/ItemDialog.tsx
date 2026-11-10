import { useEffect, useMemo, useRef } from 'react';
import { X } from '@phosphor-icons/react';
import { TYPE_SINGULAR, fmt, fmtDay, imgUrl, itemOutlook, monthlyChance, visits } from '../lib/analysis.ts';
import type { Forecast } from '../lib/model.ts';
import type { Catalog, Item } from '../lib/types.ts';

interface Props {
  cat: Catalog; f: Forecast; item: Item | null; wanted: boolean; owned: boolean;
  onClose: () => void; onWant: (i: number) => void; onOwn: (i: number) => void; onRemove: (i: number) => void; onSelect: (w: number) => void;
}

/** "When is it coming back?" for one item: every past visit, and the chance month by month. */
export function ItemDialog({ cat, f, item, wanted, owned, onClose, onWant, onOwn, onRemove, onSelect }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { const d = ref.current; if (!d) return; if (item && !d.open) d.showModal(); if (!item && d.open) d.close(); }, [item]);
  const data = useMemo(() => {
    if (!item) return null;
    const v = visits(cat, item), years = [...new Set(v.map(x => x.year))].sort();
    return { v, years, months: monthlyChance(cat, f, item.idx), o: itemOutlook(f, item.idx) };
  }, [cat, f, item]);
  const src = item ? imgUrl(cat, item) : null;
  const top = data ? Math.max(...data.months.map(m => m.p), 0.05) : 1;

  return (
    <dialog ref={ref} className="item-dialog" onClose={onClose} onClick={e => { if (e.target === ref.current) onClose(); }} aria-labelledby="item-title">
      {item && data && (
        <div className="item-body">
          <button type="button" className="item-close" onClick={onClose} aria-label="Close"><X weight="bold" aria-hidden="true" /></button>
          <div className="item-top">
            <div className={`item-art r-${item.s ? 'series' : item.r ?? 'common'}`}>{src && <img src={src} alt="" />}</div>
            <div>
              <h2 id="item-title">{item.n}</h2>
              <p className="muted">{TYPE_SINGULAR[item.t]}{item.s ? `, ${item.s}` : ''}{item.e ? `, ${item.e} set` : ''}. {fmt(item.p)} V-Bucks.</p>
              <p className="item-answer">Best chance: a pass starting <b>{fmtDay(cat, f.starts[data.o.best], true)}</b>, about <b>{Math.max(1, Math.round(data.o.bestP * 100))}%</b>.</p>
              <div className="item-actions">
                <button type="button" className="btn primary" onClick={() => { onSelect(data.o.best); onClose(); }}>Show that fortnight</button>
                <button type="button" className="chip pickable" aria-pressed={wanted} onClick={() => (wanted ? onRemove(item.idx) : onWant(item.idx))}>Want</button>
                <button type="button" className="chip pickable" aria-pressed={owned} onClick={() => (owned ? onRemove(item.idx) : onOwn(item.idx))}>Own</button>
              </div>
            </div>
          </div>

          <h3>Chance by month of claiming</h3>
          <div className="item-bars" role="img" aria-label={`Chance by month, highest ${Math.round(top * 100)}%`}>
            {data.months.map((m, k) => <div key={k}><span style={{ height: `${Math.max(3, (m.p / top) * 100)}%` }} className={m.p >= top * 0.6 ? 'hot' : ''} /><small>{m.label}</small></div>)}
          </div>

          <h3>Every time it has been on sale</h3>
          <p className="muted small">{data.v.length} visit{data.v.length === 1 ? '' : 's'} since {data.years[0]}. Last seen {fmtDay(cat, item.days[item.days.length - 1], true)}.</p>
          <div className="item-years">
            {data.years.map(y => (
              <div key={y}><span>{y}</span>
                <svg viewBox="0 0 366 10" preserveAspectRatio="none" aria-hidden="true">
                  <line x1="0" x2="366" y1="5" y2="5" />{data.v.filter(x => x.year === y).map((x, k) => <circle key={k} cx={x.doy} cy="5" r="3.2" />)}
                </svg></div>
            ))}
            <div className="item-axis" aria-hidden="true"><span /><p><i>Jan</i><i>Apr</i><i>Jul</i><i>Oct</i><i>Dec</i></p></div>
          </div>
        </div>
      )}
    </dialog>
  );
}
