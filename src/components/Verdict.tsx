import { est, fmtRange, type Pick } from '../lib/analysis.ts';
import type { Catalog } from '../lib/types.ts';

interface Props { cat: Catalog; pick26: Pick | null; pick27: Pick | null; hasLocker: boolean; hunting: boolean; relError: number; focusName: string | null; selected: number; onSelect: (i: number) => void }

function Card({ cat, title, pick, relError, focusName, active, onSelect }: { cat: Catalog; title: string; pick: Pick | null; relError: number; focusName: string | null; active: boolean; onSelect: (i: number) => void }) {
  if (!pick) return (
    <div className="verdict-card"><h3><span className="badge gold">{title}</span></h3><p className="muted">The claim deadline for this pass has passed.</p></div>
  );
  const pct = Math.round(pick.edge * 100);
  if (focusName) return (
    <button type="button" className="verdict-card" aria-pressed={active} onClick={() => onSelect(pick.index)}>
      <h3><span className="badge gold">{title}</span></h3>
      <p className="verdict-date">{fmtRange(cat, pick.score.start)}</p>
      <p className="verdict-value"><b>{est(pick.value)}</b> V-Bucks of {focusName} items you do not own</p>
      <p className="muted">{pick.value < 500 ? `Your ${focusName} items rarely return, so no fortnight is likely to have them. This is their best shot. ` : `A typical fortnight has ${est(pick.median)}. `}The whole pass here is worth about {est(pick.score.total)}.</p>
    </button>
  );
  const strength = pick.edge >= relError * 1.5 ? 'A clear lead over a typical fortnight.' : pick.edge >= relError * 0.5 ? 'A modest lead. Nearby dates are close.' : 'Barely ahead. Any fortnight is about as good.';
  return (
    <button type="button" className="verdict-card" aria-pressed={active} onClick={() => onSelect(pick.index)}>
      <h3><span className="badge gold">{title}</span></h3>
      <p className="verdict-date">{fmtRange(cat, pick.score.start)}</p>
      <p className="verdict-value"><b>{est(pick.score.total)}</b> V-Bucks you do not own</p>
      <p className="muted">{pct > 0 ? `${pct}% above your typical fortnight (${est(pick.median)}). ` : ''}{strength}</p>
    </button>
  );
}

export function Verdict({ cat, pick26, pick27, hasLocker, hunting, relError, focusName, selected, onSelect }: Props) {
  return (
    <div className="verdict">
      <h2>{hunting ? 'If you land one, use it here' : hasLocker ? 'Your best 14 days' : 'Best 14 days if you own nothing'}</h2>
      <p className="section-lede">{focusName ? `Ranked by the ${focusName} items you do not own that are likely to be on sale. Seasonal items return on a reliable schedule, so this ranking is steadier than the overall one.` : `Expected value of everything on sale during the pass, minus what you already own. Give or take about ${Math.round(relError * 100)}%.`}</p>
      <div className="verdict-grid">
        <Card cat={cat} title="2026 pass, claim by Dec 15" pick={pick26} relError={relError} focusName={focusName} active={pick26?.index === selected} onSelect={onSelect} />
        <Card cat={cat} title="2027 pass" pick={pick27} relError={relError} focusName={focusName} active={pick27?.index === selected} onSelect={onSelect} />
      </div>
    </div>
  );
}
