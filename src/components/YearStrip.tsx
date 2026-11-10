import { useEffect, useMemo, useRef } from 'react';
import { WINDOW, dayToDate, type WindowScore } from '../lib/model.ts';
import { est, fmtRange } from '../lib/analysis.ts';
import type { Catalog } from '../lib/types.ts';

interface Props {
  cat: Catalog; scores: WindowScore[]; split: { i26: number; i27: number }; picks: number[];
  selected: number; onSelect: (i: number) => void; focusName: string | null; personal: boolean;
}
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** The whole calendar as one strip: brighter means a better start date. Drag or use the arrow keys. */
export function YearStrip({ cat, scores, split, picks, selected, onSelect, focusName, personal }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const n = scores.length;
  const values = useMemo(() => scores.map(s => (focusName ? s.focus : s.total)), [scores, focusName]);

  useEffect(() => {
    const c = canvas.current; if (!c) return;
    c.width = n; c.height = 1;
    const g = c.getContext('2d')!;
    const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1;
    for (let i = 0; i < n; i++) {
      const t = Math.pow((values[i] - lo) / span, 1.4);                   // push contrast toward the peaks
      const mix = (a: number, b: number) => Math.round(a + (b - a) * t);
      g.fillStyle = `rgb(${mix(27, 244)},${mix(43, 197)},${mix(52, 49)})`;
      g.fillRect(i, 0, 1, 1);
    }
  }, [values, n]);

  const pct = (i: number) => `${(i / n) * 100}%`;
  const months = useMemo(() => {
    const out: { i: number; label: string }[] = [];
    scores.forEach((s, i) => { const d = dayToDate(cat.epoch, s.start); if (d.getUTCDate() === 1) out.push({ i, label: d.getUTCMonth() === 0 ? String(d.getUTCFullYear()) : MONTH[d.getUTCMonth()] }); });
    return out;
  }, [scores, cat]);
  const blocked = selected > split.i26 && selected < split.i27;

  return (
    <div className="strip-card">
      <div className="strip-head">
        <h3>Drag across the year</h3>
        <p className="muted">Brighter is better{focusName ? ` for ${focusName} items` : personal ? ' for you' : ''}. Marks show your best start for each pass.</p>
      </div>
      <div className="strip">
        <canvas ref={canvas} aria-hidden="true" />
        {split.i26 >= 0 && split.i27 > split.i26 + 1 && <div className="strip-gap" style={{ left: pct(split.i26 + 1), width: pct(split.i27 - split.i26 - 1) }} title="No pass can start between Dec 15 and Jan 1" />}
        {picks.filter(i => i >= 0).map(i => <span key={i} className="strip-pick" style={{ left: pct(i + 0.5) }} aria-hidden="true" />)}
        <div className="strip-win" style={{ left: pct(selected), width: `max(10px, ${pct(Math.min(WINDOW, n - selected))})` }} aria-hidden="true" />
        <input type="range" min={0} max={n - 1} step={1} value={selected} onChange={e => onSelect(Number(e.target.value))}
          aria-label="Pass start date" aria-valuetext={`${fmtRange(cat, scores[selected].start)}, about ${est(values[selected])} V-Bucks`} />
      </div>
      <div className="strip-months" aria-hidden="true">{months.map(m => <span key={m.i} className={/^\d/.test(m.label) ? 'yr' : ''} style={{ left: pct(m.i) }}>{m.label}</span>)}</div>
      {blocked && <p className="strip-note" role="status">No pass can start on this date: the 2026 one must be claimed by Dec 15 and the 2027 one starts in January.</p>}
    </div>
  );
}
