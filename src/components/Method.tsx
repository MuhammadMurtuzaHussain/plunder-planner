import { fmt } from '../lib/analysis.ts';
import type { Catalog } from '../lib/types.ts';

export function Method({ cat }: { cat: Catalog | null }) {
  return (
    <section className="wrap section method" id="method">
      <h2>How the estimate works, and how far to trust it</h2>
      <div className="method-grid">
        <article className="method-wide">
          <h3>What a pass is worth</h3>
          <p>A 14-day pass is worth everything the shop sells in those 14 days, minus the part you already own. The shop total is steady: over the last two years it stayed within about 10% of its average in most fortnights. So the personal part matters more than the calendar. If you own most of the winter sets, December is worth less to you than to everyone else.</p>
        </article>
        <article>
          <h3>Per-item chances</h3>
          <p>For each of {cat ? fmt(cat.items.length) : 'thousands of'} shop items a logistic regression estimates the chance it is on sale in a given fortnight, from how often it returns, how long it has been away, and whether it favours these dates.</p>
        </article>
        <article>
          <h3>Tested on a hidden year</h3>
          <p>Trained on shop history up to November 2025, then checked against the following year, which it had never seen. When it said 13%, items turned up 12% of the time. When it said 34%, they turned up 33% of the time.</p>
        </article>
        <article>
          <h3>What it cannot know</h3>
          <p>Unannounced collabs. Around a quarter of a fortnight's value comes from items that did not exist a year earlier, so picking the single best fortnight far ahead is only slightly better than chance. Use the plan as a guide and the daily check to pull the trigger.</p>
        </article>
        <article>
          <h3>Stays on your device</h3>
          <p>A fortnite.gg locker link contains the whole locker in compressed form. It is unpacked in your browser. There is no account, no server and no tracking.</p>
        </article>
      </div>
    </section>
  );
}
