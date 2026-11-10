import { useMemo } from 'react';
import { est, fmtDay, fmtK, type Receipts as Data } from '../lib/analysis.ts';
import type { Catalog } from '../lib/types.ts';

/** Last year, forecast using only what was known before it, against what the shop really sold. */
export function Receipts({ cat, data }: { cat: Catalog; data: Data }) {
  const W = 900, H = 260, L = 44, B = 26, T = 10;
  const g = useMemo(() => {
    const all = [...data.predicted, ...data.actual];
    const lo = Math.floor(Math.min(...all) / 50000) * 50000, hi = Math.ceil(Math.max(...all) / 50000) * 50000;
    const x = (i: number) => L + (i / (data.actual.length - 1)) * (W - L - 8), y = (v: number) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const path = (a: number[]) => a.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    const ticks: number[] = []; for (let v = lo; v <= hi; v += (hi - lo) / 4) ticks.push(v);
    return { x, y, pred: path(data.predicted), act: path(data.actual), ticks };
  }, [data]);
  const bestActual = Math.max(...data.actual), pickIdx = data.predicted.indexOf(Math.max(...data.predicted));
  return (
    <article className="receipts">
      <h3>The receipts: last year, predicted against real</h3>
      <p>The gold line is what this model would have said a year ago, using only data from before then. The pale line is what the shop went on to sell.</p>
      <ul className="legend"><li><span className="swatch line accent" aria-hidden="true" />Predicted</li><li><span className="swatch line neutral" aria-hidden="true" />What happened</li></ul>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Predicted and actual 14-day shop value over the last year. Average miss ${Math.round(data.avgMiss * 100)}%.`}>
        {g.ticks.map(v => <g key={v}><line className="grid" x1={L} x2={W - 8} y1={g.y(v)} y2={g.y(v)} /><text className="axis" x={L - 6} y={g.y(v)} dy="0.32em" textAnchor="end">{fmtK(v)}</text></g>)}
        {[0, 91, 182, 273, 364].map(i => <text key={i} className="axis" x={g.x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === 364 ? 'end' : 'middle'}>{fmtDay(cat, data.starts[i], true)}</text>)}
        <path className="series neutral" d={g.act} /><path className="series accent" d={g.pred} />
      </svg>
      <dl className="receipt-facts">
        <div><dt>Average miss on a fortnight's value</dt><dd>{Math.round(data.avgMiss * 100)}%</dd></div>
        <div><dt>Its top pick would have delivered</dt><dd>{est(data.actual[pickIdx])}</dd></div>
        <div><dt>The true best fortnight was</dt><dd>{est(bestActual)}</dd></div>
      </dl>
    </article>
  );
}
