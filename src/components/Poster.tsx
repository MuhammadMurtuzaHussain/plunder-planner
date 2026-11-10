import { useState } from 'react';
import { CalendarPlus, ShareNetwork } from '@phosphor-icons/react';
import { CLAIM_BY_2026, est, fmtDay, imgUrl, type Pick, type WindowDetail } from '../lib/analysis.ts';
import { WINDOW, dayToDate, type WindowScore } from '../lib/model.ts';
import { saveReminder, saveShareCard } from '../lib/share.ts';
import type { Catalog, Item } from '../lib/types.ts';

interface Props {
  cat: Catalog; score: WindowScore; index: number; detail: WindowDetail;
  pick26: Pick | null; pick27: Pick | null; in26: boolean; personal: boolean; hunting: boolean; focusName: string | null; relError: number;
  onSelect: (i: number) => void; onOpen: (it: Item) => void;
}

/** The answer, stated once: when to claim, why, and what you are likely to get. */
export function Poster({ cat, score, index, detail, pick26, pick27, in26: is26, personal, hunting, focusName, relError, onSelect, onOpen }: Props) {
  const [busy, setBusy] = useState(false);
  const pick = is26 ? pick26 : pick27;
  const isBest = pick?.index === index;
  const value = focusName ? score.focus : score.total;
  const top = detail.likely.slice(0, 6);
  const startDate = dayToDate(cat.epoch, score.start);
  const daysToDeadline = Math.ceil((CLAIM_BY_2026 - Date.now()) / 86400000);

  const why: string[] = [];
  if (pick && isBest) {
    if (focusName) why.push(pick.value >= 500 ? `The strongest fortnight for ${focusName} items: about ${est(pick.value)} V-Bucks of them against ${est(pick.median)} in a typical one.` : `Your ${focusName} items rarely return, so no fortnight is likely to have them. This is their best shot.`);
    else if (pick.edge >= relError * 0.5) why.push(`About ${Math.round(pick.edge * 100)}% more than a typical fortnight${personal ? ' for you' : ''}.`);
    else why.push('Only slightly ahead of any other fortnight. For the whole shop, timing matters little: pick a season or items you want to sharpen this.');
  } else if (pick) {
    const gap = pick.value - value;
    why.push(gap > 0 ? `About ${est(gap)} V-Bucks behind your best start, ${fmtDay(cat, pick.score.start)}.` : 'Level with your best start.');
  }
  if (personal && score.owned > 0) why.push(`You already own about ${est(score.owned)} of the ${est(score.shop)} V-Bucks expected on sale.`);
  if (top.length) why.push(`Most likely standouts: ${top.slice(0, 3).map(r => r.item.n).join(', ')}.`);
  if (is26 && daysToDeadline >= 0) why.push(`The 2026 pass must be claimed by Dec 15, ${daysToDeadline} day${daysToDeadline === 1 ? '' : 's'} from now.`);

  const dates = `${fmtDay(cat, score.start)} to ${fmtDay(cat, score.start + WINDOW - 1, true)}`;
  const valueLine = focusName ? `${est(value)} V-Bucks of ${focusName} items` : `${est(value)} V-Bucks ${personal ? 'you do not own' : 'on sale'}`;

  async function share() {
    setBusy(true);
    try {
      await saveShareCard({ dates, headline: hunting ? 'If I land Pirate Shop Access, I claim it' : 'I am claiming my Pirate Shop Access', detail: valueLine,
        images: top.map(r => imgUrl(cat, r.item)).filter((s): s is string => !!s), site: location.host + location.pathname.replace(/\/$/, '') });
    } finally { setBusy(false); }
  }

  return (
    <div className="poster">
      <svg className="poster-route" viewBox="0 0 600 220" aria-hidden="true" preserveAspectRatio="xMaxYMin meet">
        <path d="M40,190 C150,90 250,210 360,110 S520,70 548,48" />
        <g transform="translate(548 48)"><line x1="-11" y1="-11" x2="11" y2="11" /><line x1="11" y1="-11" x2="-11" y2="11" /></g>
      </svg>
      <div className="poster-copy">
        <div className="tabs" role="group" aria-label="Which pass">
          <button type="button" aria-pressed={is26} disabled={!pick26} onClick={() => pick26 && onSelect(pick26.index)}>2026 pass</button>
          <button type="button" aria-pressed={!is26} disabled={!pick27} onClick={() => pick27 && onSelect(pick27.index)}>2027 pass</button>
        </div>
        <p className="cap poster-label">{isBest ? (hunting ? 'If you land one, claim it on' : 'Claim it on') : 'You are looking at'}</p>
        <h2 className="poster-date">{fmtDay(cat, score.start)}<span> to {fmtDay(cat, score.start + WINDOW - 1, true)}</span></h2>
        <p className="poster-value"><b>{est(value)}</b> {valueLine.replace(/^[\d,]+ /, '')}</p>
        <ul className="poster-why">{why.map(w => <li key={w}>{w}</li>)}</ul>
        <div className="poster-actions">
          {!isBest && pick && <button type="button" className="btn primary" onClick={() => onSelect(pick.index)}>Back to best start</button>}
          <button type="button" className="btn ghost" onClick={share} disabled={busy}><ShareNetwork weight="bold" aria-hidden="true" />{busy ? 'Drawing' : 'Save share card'}</button>
          <button type="button" className="btn ghost" onClick={() => saveReminder(startDate, 'Claim Pirate Shop Access', `Plunder Planner pick: ${dates}. ${valueLine}.`)}><CalendarPlus weight="bold" aria-hidden="true" />Add reminder</button>
        </div>
      </div>
      {top.length > 0 && (
        <ul className="poster-fan" aria-label="Most likely items in this fortnight">
          {top.map(r => {
            const src = imgUrl(cat, r.item);
            return (
              <li key={r.item.a}><button type="button" className={`r-${r.item.s ? 'series' : r.item.r ?? 'common'}`} onClick={() => onOpen(r.item)} aria-label={`${r.item.n}, ${Math.round(r.p * 100)}% chance`}>
                {src && <img src={src} alt="" loading="lazy" />}<span>{Math.max(1, Math.round(r.p * 100))}%</span></button></li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
