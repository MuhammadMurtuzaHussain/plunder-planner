import { est, fmt, fmtDay, type TodayCheck } from '../lib/analysis.ts';
import type { Catalog } from '../lib/types.ts';
import { ItemTile } from './ItemTile.tsx';

export function TodayPanel({ cat, today, hasLocker }: { cat: Catalog; today: TodayCheck; hasLocker: boolean }) {
  const pct = Math.round(today.percentile * 100);
  const verdict = pct >= 85 ? 'A strong day to start.' : pct >= 60 ? 'Better than most days.' : pct >= 35 ? 'An ordinary day.' : 'A thin day. Waiting costs you little.';
  return (
    <section className="wrap section today" id="today">
      <div className="today-copy">
        <h2>Should you start today?</h2>
        <p className="today-big"><b>{fmt(today.value)}</b> V-Bucks {hasLocker ? 'you do not own are' : 'are'} on sale right now.</p>
        <p className="today-verdict">{verdict}</p>
        <p className="muted">
          That beats {pct}% of days in the last year (a typical day shows {fmt(today.typical)}). Passes started on days like this ended up near {est(today.expectedPass)} V-Bucks, against {fmt(today.typicalPass)} for a typical start.
        </p>
        <p className="footnote">Shop data as of {fmtDay(cat, today.day, true)}. The shop resets daily at 00:00 UTC.</p>
      </div>
      <ul className="tiles compact">{today.onSale.slice(0, 8).map(it => <ItemTile key={it.a} cat={cat} item={it} />)}</ul>
    </section>
  );
}
