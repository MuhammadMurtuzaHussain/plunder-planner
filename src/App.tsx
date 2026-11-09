import { useEffect, useMemo, useState } from 'react';
import { baseline, forecast, hydrate, scoreWindows, type Baseline, type Forecast } from './lib/model.ts';
import { THEMES, TYPE_GROUPS, buildStarts, lockerStats, ownedMask, pickBest, themeMask, todayCheck, windowDetail, yearBounds } from './lib/analysis.ts';
import type { Catalog, ItemType, RawCatalog } from './lib/types.ts';
import type { Locker } from './lib/locker.ts';
import { Hero } from './components/Hero.tsx';
import { Verdict } from './components/Verdict.tsx';
import { Timeline } from './components/Timeline.tsx';
import { WindowPanel } from './components/WindowPanel.tsx';
import { TodayPanel } from './components/TodayPanel.tsx';
import { Method } from './components/Method.tsx';
import { Hunt } from './components/Hunt.tsx';

interface Engine { cat: Catalog; f: Forecast; base: Baseline; themes: Uint8Array }

export default function App() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locker, setLocker] = useState<Locker | null>(null);
  const [started, setStarted] = useState(false);            // true once a locker is read or skipped
  const [off, setOff] = useState<Set<string>>(new Set());   // filter chips switched off
  const [selected, setSelected] = useState<number | null>(null);
  const [want, setWant] = useState<Set<string>>(new Set());  // seasonal themes the player is after
  const [mode, setMode] = useState<'have' | 'hunt'>('have');   // does the player hold a token yet?

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/catalog.json`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<RawCatalog>; })
      .then(raw => {
        if (!alive) return;
        const cat = hydrate(raw), starts = buildStarts(cat);
        // Let the page paint before the half-second of number crunching.
        setTimeout(() => alive && setEngine({ cat, f: forecast(cat, cat.lastDay, starts), base: baseline(cat, cat.lastDay, starts), themes: themeMask(cat) }), 30);
      })
      .catch(() => alive && setLoadError('The shop history could not be loaded. Check your connection and reload.'));
    return () => { alive = false; };
  }, []);

  const types = useMemo(() => {
    const s = new Set<ItemType>();
    for (const g of TYPE_GROUPS) if (!off.has(g.key)) for (const t of g.types) s.add(t);
    return s;
  }, [off]);

  const view = useMemo(() => {
    if (!engine) return null;
    const { cat, f, base } = engine;
    const owned = ownedMask(cat, locker?.ids ?? null);
    const wanted = THEMES.map((t, i) => (want.has(t.key) ? i + 1 : 0)).filter(Boolean);
    const focus = wanted.length ? Uint8Array.from(engine.themes, v => (wanted.includes(v) ? 1 : 0)) : null;
    const get = focus ? (s: { focus: number }) => s.focus : undefined;
    const scores = scoreWindows(cat, f, base, owned, types, focus);
    const { end26, start27 } = yearBounds(cat);
    const i26 = scores.findLastIndex(s => s.start <= end26), i27 = scores.findIndex(s => s.start >= start27);
    return {
      owned, scores, focus,
      pick26: i26 >= 0 ? pickBest(scores, 0, i26, get) : null,
      pick27: pickBest(scores, i27, scores.length - 1, get),
      split: { i26, i27 },
      stats: locker ? lockerStats(cat, locker.ids, owned) : null,
      today: todayCheck(cat, owned, types),
    };
  }, [engine, locker, types, want]);

  const sel = selected ?? view?.pick27?.index ?? 0;
  const detail = useMemo(() => {
    if (!engine || !view) return null;
    return windowDetail(engine.cat, engine.f, sel, view.owned, types, engine.base.level, engine.base.season[sel], view.focus);
  }, [engine, view, sel, types]);

  const names = THEMES.filter(t => want.has(t.key)).map(t => t.noun);
  const focusName = names.length ? (names.length > 2 ? 'seasonal' : names.join(' and ')) : null;
  const show = started && engine && view && detail;

  return (
    <>
      <header className="nav">
        <div className="wrap nav-row">
          <a className="brand" href="#top" aria-label="Plunder Planner, home">Plunder <span>Planner</span></a>
          <nav className="nav-links" aria-label="Sections">
            {mode === 'hunt' && <a href="#hunt">Odds</a>}
            {show && <a href="#plan">Plan</a>}
            {show && <a href="#today">Today</a>}
            <a href="#method">How it works</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <Hero
          mode={mode} onMode={setMode}
          cat={engine?.cat ?? null} loadError={loadError} locker={locker} stats={view?.stats ?? null}
          onLocker={l => { setLocker(l); setStarted(true); setSelected(null); }}
          onSkip={() => { setLocker(null); setStarted(true); setSelected(null); }}
        />

        {mode === 'hunt' && <Hunt passValue={Math.max(view?.pick26?.score.total ?? 0, view?.pick27?.score.total ?? 0)} hasLocker={!!locker} />}

        {started && !show && !loadError && (
          <section className="wrap section" aria-busy="true"><div className="skeleton tall" /><div className="skeleton" /></section>
        )}

        {show && (
          <>
            <section className="wrap section" id="plan">
              <Verdict cat={engine.cat} pick26={view.pick26} pick27={view.pick27} hasLocker={!!locker} hunting={mode === 'hunt'} relError={engine.base.relError} focusName={focusName}
                selected={sel} onSelect={setSelected} />
              <div className="want">
                <p className="cap" id="want-label">What are you after?</p>
                <div className="chips" role="group" aria-labelledby="want-label">
                  <button type="button" className="chip pickable" aria-pressed={want.size === 0} onClick={() => { setWant(new Set()); setSelected(null); }}>Everything</button>
                  {THEMES.map(t => (
                    <button key={t.key} type="button" className="chip pickable" aria-pressed={want.has(t.key)}
                      onClick={() => { setWant(prev => { const n = new Set(prev); if (n.has(t.key)) n.delete(t.key); else n.add(t.key); return n; }); setSelected(null); }}>
                      {t.label}
                    </button>
                  ))}
                </div>
                <p className="cap" id="types-label">Count these item types</p>
              </div>
              <div className="chips" role="group" aria-labelledby="types-label">
                {TYPE_GROUPS.map(g => {
                  const on = !off.has(g.key);
                  return (
                    <button key={g.key} type="button" className="chip" aria-pressed={on}
                      onClick={() => setOff(prev => { const n = new Set(prev); if (on) { if (n.size < TYPE_GROUPS.length - 1) n.add(g.key); } else n.delete(g.key); return n; })}>
                      {g.label}
                    </button>
                  );
                })}
              </div>
              <Timeline cat={engine.cat} scores={view.scores} split={view.split} picks={[view.pick26?.index ?? -1, view.pick27?.index ?? -1]}
                selected={sel} onSelect={setSelected} hasLocker={!!locker} focusName={focusName} />
              <WindowPanel cat={engine.cat} score={view.scores[sel]} detail={detail} hasLocker={!!locker} focusName={focusName} />
            </section>
            <TodayPanel cat={engine.cat} today={view.today} hasLocker={!!locker} />
          </>
        )}
        <Method cat={engine?.cat ?? null} />
      </main>

      <footer className="wrap footer">
        <p className="credit">Built by <a href="https://github.com/MuhammadMurtuzaHussain" target="_blank" rel="noreferrer">Muhammad Murtuza Hussain</a>. Open source under the MIT licence: <a href="https://github.com/MuhammadMurtuzaHussain/plunder-planner" target="_blank" rel="noreferrer">view the code on GitHub</a>.</p>
        <p>Credits: shop history from <a href="https://fortnite-api.com" target="_blank" rel="noreferrer">fortnite-api.com</a>, prices and locker format from <a href="https://fortnite.gg" target="_blank" rel="noreferrer">fortnite.gg</a>, drop odds and Treasure Hours from <a href="https://fortnite.bot/treasure" target="_blank" rel="noreferrer">fortnite.bot</a>. Not affiliated with or endorsed by Epic Games. Forecasts are estimates, not promises.</p>
      </footer>
    </>
  );
}
