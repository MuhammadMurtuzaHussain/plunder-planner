import { useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { TYPE_LABEL, est, fmtRange, type WindowDetail } from '../lib/analysis.ts';
import type { WindowScore } from '../lib/model.ts';
import type { Catalog, Item } from '../lib/types.ts';
import { ItemTile } from './ItemTile.tsx';

export function WindowPanel({ cat, score, detail, hasLocker, focusName, onOpen }: { cat: Catalog; score: WindowScore; detail: WindowDetail; hasLocker: boolean; focusName: string | null; onOpen: (it: Item) => void }) {
  const [tab, setTab] = useState<'likely' | 'yours'>('likely');
  const [more, setMore] = useState(false);
  const active = tab === 'yours' && hasLocker ? detail.yours : detail.likely;
  const list = active.slice(0, more ? 60 : 18);
  const top = detail.byType.filter(t => t.shop - t.owned > 0).slice(0, 5);
  return (
    <div className="window">
      <div className="window-head">
        <div>
          <h3>{fmtRange(cat, score.start)}</h3>
          <p className="muted">
            About {est(score.shop)} V-Bucks should pass through the shop{hasLocker ? `, of which you already own about ${est(score.owned)}` : ''}.
          </p>
        </div>
        <dl className="split">
          {top.map(t => (<div key={t.type}><dt>{TYPE_LABEL[t.type]}</dt><dd>{est(t.shop - t.owned)}</dd></div>))}
        </dl>
      </div>

      {hasLocker && (
        <div className="tabs" role="tablist" aria-label="Items in this fortnight">
          <button role="tab" type="button" aria-selected={tab === 'likely'} onClick={() => { setTab('likely'); setMore(false); }}>{focusName ? `Likely ${focusName} picks` : 'Most likely new for you'}</button>
          <button role="tab" type="button" aria-selected={tab === 'yours'} onClick={() => { setTab('yours'); setMore(false); }}>Already in your locker</button>
        </div>
      )}
      {!hasLocker && <h4 className="list-title">{focusName ? `Likely ${focusName} items on sale` : 'Most likely to be on sale'}</h4>}

      {list.length ? (
        <ul className="tiles"><AnimatePresence mode="popLayout" initial={false}>{list.map((r, k) => <ItemTile key={r.item.a} cat={cat} item={r.item} chance={r.p} onOpen={onOpen} order={k} />)}</AnimatePresence></ul>
      ) : (
        <p className="empty">{tab === 'yours' ? 'Nothing from your locker is likely to return in this fortnight.' : 'No returning items stand out for this fortnight with the current filters.'}</p>
      )}
      {active.length > 18 && (
        <button className="btn ghost" type="button" onClick={() => setMore(m => !m)}>{more ? 'Show fewer' : 'Show more'}</button>
      )}
      <p className="footnote">Chances cover items that have been sold before. Brand-new releases cannot be listed in advance, but their usual value is included in the totals.</p>
    </div>
  );
}
