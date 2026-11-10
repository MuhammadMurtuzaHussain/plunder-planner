import { useEffect, useState } from 'react';
import { TreasureChest } from '@phosphor-icons/react';
import { BASE_ODDS, DATA_CHECKED, HUNT_ENDS, MULTIPLIER_CHOICES, countdown, huntOdds, upcomingTreasureHours, type TreasureHour } from '../lib/hunt.ts';
import { est, fmt } from '../lib/analysis.ts';

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return now;
}
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const slot = (h: TreasureHour) => `${dayFmt.format(h.start)}, ${timeFmt.format(h.start)} to ${timeFmt.format(h.end)}`;
const checkedFmt = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(DATA_CHECKED + 'T12:00:00Z'));

function Slider({ id, label, value, min, max, onChange, help }: { id: string; label: string; value: number; min: number; max: number; onChange: (n: number) => void; help?: string }) {
  return (
    <div className="slider">
      <label htmlFor={id}><span>{label}</span><b>{value}</b></label>
      <input id={id} type="range" min={min} max={max} step={1} value={value} onChange={e => onChange(Number(e.target.value))} aria-describedby={help ? `${id}-help` : undefined} />
      {help && <p id={`${id}-help`} className="slider-help">{help}</p>}
    </div>
  );
}

/** For players still hunting: when odds are boosted, their chance, and whether the grind pays. */
export function Hunt({ passValue, hasLocker }: { passValue: number; hasLocker: boolean }) {
  const now = useNow();
  const hours = upcomingTreasureHours(now);
  const next = hours[0];
  const live = next !== undefined && next.start <= now;
  const [cpm, setCpm] = useState(6);
  const [mpd, setMpd] = useState(5);
  const [th, setTh] = useState(Math.min(2, hours.length));
  const [mult, setMult] = useState<number>(next?.multiplier ?? MULTIPLIER_CHOICES[0]);
  const odds = huntOdds({ chestsPerMatch: cpm, matchesPerDay: mpd, treasureHours: Math.min(th, hours.length), multiplier: mult }, now);
  const over = now >= HUNT_ENDS;
  const pct = odds.chance * 100;
  const pctText = pct >= 10 ? pct.toFixed(0) : pct >= 1 ? pct.toFixed(1) : pct.toFixed(2);

  return (
    <section className="wrap section" id="hunt">
      <h2>Still hunting for a token</h2>
      <p className="section-lede">Pirate Shop Access drops from chests in normal matches at 1 in {fmt(BASE_ODDS)}. Treasure Hours raise that. Boosts marked expected are not confirmed by Epic yet.</p>

      <div className="hunt-grid">
        <div className="hunt-col">
          <div className="card next-hour">
            <div className="coin" aria-hidden="true"><TreasureChest weight="fill" /></div>
            <div>
              <span className="badge gold">{over ? 'Hunt ended' : live ? 'Treasure Hour live' : 'Next Treasure Hour'}</span>
              {next !== undefined ? (
                <>
                  <p className="cap">{live ? 'Ends in' : 'Starts in'}</p>
                  <p className="clock" role="timer" aria-live="off">{countdown((live ? next.end : next.start) - now)}</p>
                  <p className="muted">{slot(next)}, your time</p>
                </>
              ) : <p className="muted next-none">No more Treasure Hours are announced.</p>}
            </div>
          </div>

          <div className="card">
            <header className="card-head"><h3>Treasure Hours</h3><p>In your timezone. Checked daily, last change {checkedFmt}.</p></header>
            {hours.length ? (
              <ul className="rows">
                {hours.map((h, k) => (
                  <li key={h.start}>
                    <span className="row-main">{slot(h)}</span>
                    <span className="row-side"><span className="up">{h.multiplier}x</span><span className="badge">{h.confirmed ? 'Confirmed' : 'Expected'}</span>{k === 0 && <span className="badge gold">{live ? 'Live' : 'Next'}</span>}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="card-empty">Nothing announced. The hunt runs until {dayFmt.format(HUNT_ENDS)}.</p>}
          </div>
        </div>

        <div className="card odds">
          <header className="card-head"><h3>Your odds of landing one</h3><p>Before the hunt ends on {dayFmt.format(HUNT_ENDS)} ({Math.ceil(odds.daysLeft)} days left)</p></header>
          <div className="odds-body">
            <div className="sliders">
              <Slider id="cpm" label="Chests you open per match" value={cpm} min={1} max={20} onChange={setCpm} />
              <Slider id="mpd" label="Matches per day" value={mpd} min={0} max={40} onChange={setMpd} />
              <Slider id="th" label="Treasure Hours you will play" value={Math.min(th, hours.length)} min={0} max={Math.max(hours.length, 0)} onChange={setTh}
                help="Counted as about six extra matches each, at boosted odds." />
              <div className="slider">
                <p className="slider-title" id="mult-label">Boost to assume</p>
                <div className="mode small" role="group" aria-labelledby="mult-label">
                  {MULTIPLIER_CHOICES.map(m => <button key={m} type="button" aria-pressed={mult === m} onClick={() => setMult(m)}>{m}x</button>)}
                </div>
                <p className="slider-help">Use the lower figure while upcoming boosts are only expected.</p>
              </div>
            </div>
            <div className="odds-result" aria-live="polite">
              <p className="cap">Chance of a token</p>
              <p className="odds-big">{pctText}%</p>
              <p className="muted">{odds.chance > 0 ? `About 1 in ${fmt(odds.oneIn)}, from ${fmt(odds.normalChests + odds.boostedChests)} chests.` : 'Open some chests to have a chance.'}</p>
              <dl className="odds-facts">
                <div><dt>A token is worth{hasLocker ? ' to you' : ''}</dt><dd>{est(passValue)} V-Bucks</dd></div>
                <div><dt>So this grind is worth about</dt><dd>{est(passValue * odds.chance)} V-Bucks</dd></div>
                <div><dt>Chests for a coin-flip chance</dt><dd>{fmt(odds.chestsForEven)}</dd></div>
              </dl>
            </div>
          </div>
          <p className="card-foot">Treat the token as a lucky bonus, not a goal: play the matches you would play anyway, and time them for Treasure Hours. Odds and times per fortnite.bot, quoting Epic.</p>
        </div>
      </div>
    </section>
  );
}
