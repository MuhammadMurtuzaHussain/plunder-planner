import { useEffect, useState } from 'react';
import { TreasureChest } from '@phosphor-icons/react';
import { BASE_ODDS, HUNT_ENDS, TREASURE_HOUR_LENGTH_H, TREASURE_MULTIPLIER, countdown, huntOdds, upcomingTreasureHours } from '../lib/hunt.ts';
import { est, fmt } from '../lib/analysis.ts';

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const id = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(id); }, []);
  return now;
}
const dayFmt = new Intl.DateTimeFormat(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
const timeFmt = new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' });
const slot = (t: number) => `${dayFmt.format(t)}, ${timeFmt.format(t)} to ${timeFmt.format(t + TREASURE_HOUR_LENGTH_H * 3600e3)}`;

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
  const live = next !== undefined && next <= now;
  const [cpm, setCpm] = useState(6);
  const [mpd, setMpd] = useState(5);
  const [th, setTh] = useState(Math.min(2, hours.length));
  const odds = huntOdds({ chestsPerMatch: cpm, matchesPerDay: mpd, treasureHours: Math.min(th, hours.length) }, now);
  const over = now >= HUNT_ENDS;
  const pct = odds.chance * 100;
  const pctText = pct >= 10 ? pct.toFixed(0) : pct >= 1 ? pct.toFixed(1) : pct.toFixed(2);

  return (
    <section className="wrap section" id="hunt">
      <h2>Still hunting for a token</h2>
      <p className="section-lede">Pirate Shop Access drops from chests in normal matches at 1 in {fmt(BASE_ODDS)}. Treasure Hours raise that {TREASURE_MULTIPLIER}x.</p>

      <div className="hunt-grid">
        <div className="hunt-col">
          <div className="card next-hour">
            <div className="coin" aria-hidden="true"><TreasureChest weight="fill" /></div>
            <div>
              <span className="badge gold">{over ? 'Hunt ended' : live ? 'Treasure Hour live' : 'Next Treasure Hour'}</span>
              {next !== undefined ? (
                <>
                  <p className="cap">{live ? 'Ends in' : 'Starts in'}</p>
                  <p className="clock" role="timer" aria-live="off">{countdown((live ? next + TREASURE_HOUR_LENGTH_H * 3600e3 : next) - now)}</p>
                  <p className="muted">{slot(next)}, your time</p>
                </>
              ) : <p className="muted next-none">No more Treasure Hours are announced.</p>}
            </div>
          </div>

          <div className="card">
            <header className="card-head"><h3>Treasure Hours</h3><p>Announced boosts, in your timezone</p></header>
            {hours.length ? (
              <ul className="rows">
                {hours.map((t, k) => (
                  <li key={t}>
                    <span className="row-main">{slot(t)}</span>
                    <span className="row-side"><span className="up">{TREASURE_MULTIPLIER}x</span>{k === 0 && <span className="badge gold">{live ? 'Live' : 'Next'}</span>}</span>
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
          <p className="card-foot">Treat the token as a lucky bonus, not a goal: play the matches you would play anyway, and time them for Treasure Hours. Odds per fortnite.bot, quoting Epic, as of Nov 9, 2026.</p>
        </div>
      </div>
    </section>
  );
}
