import { useEffect, useMemo, useRef, useState } from 'react';
import { WINDOW, dayToDate, type WindowScore } from '../lib/model.ts';
import { est as fmt, fmtDay, fmtK, fmtRange } from '../lib/analysis.ts';
import type { Catalog } from '../lib/types.ts';

interface Props {
  cat: Catalog; scores: WindowScore[]; split: { i26: number; i27: number };
  picks: number[]; selected: number; onSelect: (i: number) => void; hasLocker: boolean; focusName: string | null;
}
const M = { top: 28, right: 16, bottom: 34, left: 48 };
const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function Timeline({ cat, scores: raw, split, picks, selected, onSelect, hasLocker, focusName }: Props) {
  // With a seasonal focus the chart plots just those items; the whole-shop line would dwarf them.
  const scores = useMemo(() => (focusName ? raw.map(s => ({ ...s, total: s.focus, sd: s.focusSd, shop: s.focus })) : raw), [raw, focusName]);
  const showShop = hasLocker && !focusName;
  const mainLabel = focusName ? `${focusName[0].toUpperCase()}${focusName.slice(1)} items${hasLocker ? ' new to you' : ''}` : hasLocker ? 'New to you' : 'Whole shop';
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(960);
  const [hover, setHover] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  const height = width < 560 ? 260 : 340;

  useEffect(() => {
    if (!box.current) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(320, Math.round(e.contentRect.width))));
    ro.observe(box.current);
    return () => ro.disconnect();
  }, []);

  const g = useMemo(() => {
    const n = scores.length, iw = width - M.left - M.right, ih = height - M.top - M.bottom;
    let lo = Infinity, hi = -Infinity;
    for (const s of scores) { lo = Math.min(lo, Math.max(0, s.total - s.sd)); hi = Math.max(hi, s.shop, s.total + s.sd); }
    const span = Math.max(hi - lo, 1000);
    const step = [100000, 50000, 25000, 10000, 5000, 2500, 1000, 500].find(v => span / v >= 3) ?? 250;
    lo = Math.floor(lo / step) * step; hi = Math.max(Math.ceil(hi / step) * step, lo + step);
    const x = (i: number) => M.left + (n > 1 ? (i / (n - 1)) * iw : 0);
    const y = (v: number) => M.top + ih - ((v - lo) / (hi - lo)) * ih;
    const line = (get: (s: WindowScore) => number) => scores.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(get(s)).toFixed(1)}`).join('');
    const band = scores.map((s, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(s.total + s.sd).toFixed(1)}`).join('')
      + scores.map((_, k) => { const i = n - 1 - k, s = scores[i]; return `L${x(i).toFixed(1)},${y(Math.max(lo, s.total - s.sd)).toFixed(1)}`; }).join('') + 'Z';
    const ticks: number[] = []; for (let v = lo; v <= hi; v += step) ticks.push(v);
    const months: { i: number; label: string }[] = [];
    const every = width < 560 ? 3 : width < 820 ? 2 : 1;
    scores.forEach((s, i) => {
      const d = dayToDate(cat.epoch, s.start);
      if (d.getUTCDate() === 1 && d.getUTCMonth() % every === 0) months.push({ i, label: d.getUTCMonth() === 0 ? `${d.getUTCFullYear()}` : MONTH[d.getUTCMonth()] });
    });
    return { n, iw, ih, x, y, ticks, months, total: line(s => s.total), shop: line(s => s.shop), band };
  }, [scores, width, height, cat]);

  const at = (clientX: number) => {
    const r = box.current!.getBoundingClientRect();
    return Math.max(0, Math.min(g.n - 1, Math.round(((clientX - r.left - M.left) / g.iw) * (g.n - 1))));
  };
  const focus = hover ?? selected;
  const s = scores[focus];
  const tipLeft = Math.min(Math.max(g.x(focus), 110), width - 110);

  return (
    <figure className="chart">
      <figcaption className="chart-head">
        <div>
          <h3>{focusName ? `${focusName} items on sale, by start date` : hasLocker ? 'V-Bucks you could unlock, by start date' : 'V-Bucks on sale, by start date'}</h3>
          <p className="muted">Each point is a 14-day pass starting that day. Click or use the arrow keys to inspect one.</p>
        </div>
        <ul className="legend">
          <li><span className="swatch line accent" aria-hidden="true" />{mainLabel}</li>
          {showShop && <li><span className="swatch line neutral" aria-hidden="true" />Whole shop</li>}
          <li><span className="swatch band" aria-hidden="true" />Likely range</li>
        </ul>
      </figcaption>

      <div className="chart-box" ref={box}>
        <svg width={width} height={height} role="img" tabIndex={0}
          aria-label={`Expected value of a 14-day pass for each start date. Selected: ${fmtRange(cat, scores[selected].start)}, ${fmt(scores[selected].total)} V-Bucks.`}
          onPointerMove={e => { const i = at(e.clientX); if (i !== hover) setHover(i); }}
          onPointerLeave={() => setHover(null)}
          onClick={e => onSelect(at(e.clientX))}
          onKeyDown={e => {
            const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : e.key === 'PageDown' ? 14 : e.key === 'PageUp' ? -14 : 0;
            if (d) { e.preventDefault(); onSelect(Math.max(0, Math.min(g.n - 1, selected + d))); }
          }}>
          {g.ticks.map(v => (
            <g key={v}><line className="grid" x1={M.left} x2={width - M.right} y1={g.y(v)} y2={g.y(v)} />
              <text className="axis" x={M.left - 8} y={g.y(v)} dy="0.32em" textAnchor="end">{fmtK(v)}</text></g>
          ))}
          {g.months.map(m => (<text key={m.i} className={`axis${/^\d/.test(m.label) ? ' strong' : ''}`} x={g.x(m.i)} y={height - 12} textAnchor="middle">{m.label}</text>))}
          {split.i26 >= 0 && split.i27 > 0 && (
            <g><rect className="gap" x={g.x(split.i26)} width={g.x(split.i27) - g.x(split.i26)} y={M.top} height={g.ih} />
              <text className="axis" x={(g.x(split.i26) + g.x(split.i27)) / 2} y={M.top - 10} textAnchor="middle">no pass can start here</text></g>
          )}
          <path className="band" d={g.band} />
          {showShop && <path className="series neutral" d={g.shop} />}
          <path className="series accent" d={g.total} />
          {picks.filter(i => i >= 0).map(i => (
            <g key={i}><circle className="pick" cx={g.x(i)} cy={g.y(scores[i].total)} r={5} />
              <text className="pick-label" x={Math.min(Math.max(g.x(i), M.left + 30), width - 40)} y={g.y(scores[i].total + scores[i].sd) - 8} textAnchor="middle">{fmtDay(cat, scores[i].start)}</text></g>
          ))}
          <line className="cursor" x1={g.x(selected)} x2={g.x(selected)} y1={M.top} y2={M.top + g.ih} />
          <rect className="span" x={g.x(selected)} width={Math.max(2, g.x(Math.min(g.n - 1, selected + WINDOW - 1)) - g.x(selected))} y={M.top + g.ih} height={4} rx={2} />
          {hover !== null && hover !== selected && <line className="cursor hover" x1={g.x(hover)} x2={g.x(hover)} y1={M.top} y2={M.top + g.ih} />}
          <circle className="dot" cx={g.x(focus)} cy={g.y(s.total)} r={4.5} />
        </svg>
        <div className="tip" style={{ left: tipLeft }} aria-hidden="true">
          <strong>{fmtRange(cat, s.start)}</strong>
          <span><i className="swatch line accent" />{mainLabel} <b>{fmt(s.total)}</b></span>
          {showShop && <span><i className="swatch line neutral" />Whole shop <b>{fmt(s.shop)}</b></span>}
          <span className="muted">Likely {fmtK(Math.max(0, s.total - s.sd))} to {fmtK(s.total + s.sd)}</span>
        </div>
      </div>

      <button className="btn ghost small" type="button" aria-expanded={table} onClick={() => setTable(t => !t)}>{table ? 'Hide the numbers' : 'Show as a table'}</button>
      {table && (
        <div className="table-scroll">
          <table>
            <thead><tr><th scope="col">Pass starts</th><th scope="col">{mainLabel}</th>{showShop && <th scope="col">Whole shop</th>}<th scope="col">Likely range</th></tr></thead>
            <tbody>{scores.filter((_, i) => i % 7 === 0).map(r => (
              <tr key={r.start}><th scope="row">{fmtDay(cat, r.start, true)}</th><td>{fmt(r.total)}</td>{showShop && <td>{fmt(r.shop)}</td>}<td>{fmtK(Math.max(0, r.total - r.sd))} to {fmtK(r.total + r.sd)}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </figure>
  );
}
