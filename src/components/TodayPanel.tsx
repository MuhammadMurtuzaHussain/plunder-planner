import { useCallback } from 'react';
import { CalendarPlus } from '@phosphor-icons/react';
import { motion, useReducedMotion } from 'motion/react';
import { CountUp } from './Motion.tsx';
import { CLAIM_BY_2026, est, fmt, fmtDay, type TodayCheck } from '../lib/analysis.ts';
import { saveReminder } from '../lib/share.ts';
import type { Catalog, Item } from '../lib/types.ts';
import { ItemTile } from './ItemTile.tsx';

/** The daily question: start the pass now, or wait? */
export function TodayPanel({ cat, today, hasLocker, onOpen }: { cat: Catalog; today: TodayCheck; hasLocker: boolean; onOpen: (it: Item) => void }) {
  const pct = Math.round(today.percentile * 100);
  const go = pct >= 85, fine = pct >= 60;
  const call = go ? 'Start today' : fine ? 'Good, not great' : 'Wait';
  const line = go ? 'Days this strong are rare. If you hold a token, today is a good day to claim it.'
    : fine ? 'Better than most days, but stronger shelves turn up a few times a month.' : 'An ordinary shelf. Waiting costs you little.';
  const daysLeft = Math.ceil((CLAIM_BY_2026 - Date.now()) / 86400000);
  const top = Math.max(...today.recent, 1);
  const reduce = useReducedMotion();
  const whole = useCallback((n: number) => fmt(n), []);
  return (
    <section className="wrap section today" id="today">
      <div className="today-copy">
        <p className="cap">Claim or wait, {fmtDay(cat, today.day, true)}</p>
        <h2 className={`today-call ${go ? 'go' : fine ? 'fine' : 'wait'}`}>{call}</h2>
        <p className="today-line">{line}</p>
        <div className="today-bars" role="img" aria-label={`V-Bucks on sale per day over the last 30 days. Today beats ${pct}% of the last year.`}>
          {today.recent.map((v, k) => <motion.span key={k} className={k === today.recent.length - 1 ? 'now' : ''} style={{ height: `${Math.max(4, (v / top) * 100)}%`, originY: 1 }}
            initial={reduce ? false : { scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true, amount: 0.6 }} transition={{ type: 'spring', stiffness: 140, damping: 18, delay: k * 0.018 }} />)}
        </div>
        <p className="muted small">Last 30 days of the shop{hasLocker ? ', counting only what you do not own' : ''}. Today is the gold bar.</p>
        <dl className="today-facts">
          <div><dt>On sale now{hasLocker ? ', new to you' : ''}</dt><dd><CountUp value={today.value} format={whole} /></dd></div>
          <div><dt>Beats this share of days</dt><dd>{pct}%</dd></div>
          <div><dt>Passes started on days like this</dt><dd>{est(today.expectedPass)}</dd></div>
          {daysLeft >= 0 && <div><dt>Days left to claim the 2026 pass</dt><dd>{daysLeft}</dd></div>}
        </dl>
        {daysLeft >= 0 && <button type="button" className="btn ghost" onClick={() => saveReminder(new Date(CLAIM_BY_2026), 'Last day to claim the 2026 Pirate Shop Access', 'The 2026 pass must be claimed by today. Check Plunder Planner for whether an earlier day is better.')}>
          <CalendarPlus weight="bold" aria-hidden="true" />Remind me of the deadline</button>}
      </div>
      <ul className="tiles compact">{today.onSale.slice(0, 8).map(it => <ItemTile key={it.a} cat={cat} item={it} onOpen={onOpen} />)}</ul>
    </section>
  );
}
