import { useEffect, useMemo, useState } from 'react';
import { baseline, forecast, hydrate, scoreWindows, type Baseline, type Filter, type Forecast } from './lib/model.ts';
import { KINDS, TYPE_GROUPS, buildStarts, kindMasks, lockerStats, ownedMask, pickBest, receipts as buildReceipts, themeMask, todayCheck, unionMask, windowDetail, yearBounds, type Receipts } from './lib/analysis.ts';
import type { Catalog, Item, ItemType, RawCatalog } from './lib/types.ts';
import { decodeIdFragment, type Locker } from './lib/locker.ts';
import { Hero } from './components/Hero.tsx';
import { Poster } from './components/Poster.tsx';
import { YearStrip } from './components/YearStrip.tsx';
import { Wishlist } from './components/Wishlist.tsx';
import { ItemDialog } from './components/ItemDialog.tsx';
import { ItemSearch } from './components/ItemSearch.tsx';
import { Timeline } from './components/Timeline.tsx';
import { WindowPanel } from './components/WindowPanel.tsx';
import { TodayPanel } from './components/TodayPanel.tsx';
import { Method } from './components/Method.tsx';
import { Hunt } from './components/Hunt.tsx';
import { LockerCard } from './components/LockerCard.tsx';
import { Reveal } from './components/Motion.tsx';

// Shareable links: ?want=winter a season or collab family, ?source=collab only crossovers, ?item=Krampus an item page.
const query = new URLSearchParams(typeof location === 'undefined' ? '' : location.search);

interface Engine { cat: Catalog; f: Forecast; base: Baseline; kinds: Map<string, Uint8Array> }

export default function App() {
  const [engine, setEngine] = useState<Engine | null>(null);
  const [receipts, setReceipts] = useState<Receipts | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [locker, setLocker] = useState<Locker | null>(null);
  const [off, setOff] = useState<Set<string>>(new Set());                   // item-type chips switched off
  const [selected, setSelected] = useState<number | null>(null);            // window on screen; null follows the best pick
  const [want, setWant] = useState<Set<string>>(() => new Set((query.get('want') ?? '').split(',').filter(k => KINDS.some(t => t.key === k))));
  const [ownedKinds, setOwnedKinds] = useState<Set<string>>(new Set());     // "I own most of these"
  const [pickWant, setPickWant] = useState<number[]>([]);                   // single items wanted (catalogue indexes)
  const [pickOwn, setPickOwn] = useState<number[]>([]);                     // single items owned
  const [source, setSource] = useState<Filter['source']>(() => (query.get('source') === 'collab' ? 'collab' : query.get('source') === 'original' ? 'original' : 'all'));
  const [open, setOpen] = useState<Item | null>(null);                      // item page on screen

  // The import button on fortnite.gg lands here with the locker after the #. Read it, then clean the address bar.
  useEffect(() => {
    const m = location.hash.match(/^#locker=([0-9a-z.]+)$/);
    if (!m) return;
    try { setLocker(decodeIdFragment(m[1])); } catch { /* damaged link: fall back to the normal start */ }
    history.replaceState(null, '', location.pathname + location.search);
  }, []);

  useEffect(() => {
    let alive = true;
    fetch(`${import.meta.env.BASE_URL}data/catalog.json`)
      .then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json() as Promise<RawCatalog>; })
      .then(raw => {
        if (!alive) return;
        const cat = hydrate(raw), starts = buildStarts(cat);
        // Let the page paint before the number crunching; the look-back forecast can wait a little longer still.
        setTimeout(() => alive && setEngine({ cat, f: forecast(cat, cat.lastDay, starts), base: baseline(cat, cat.lastDay, starts), kinds: kindMasks(cat, themeMask(cat)) }), 30);
        setTimeout(() => alive && setReceipts(buildReceipts(cat)), 1500);
      })
      .catch(() => alive && setLoadError('The shop history could not be loaded. Check your connection and reload.'));
    return () => { alive = false; };
  }, []);

  // ?item=Krampus opens that item's page, so "when is it coming back?" can be shared as a link.
  useEffect(() => {
    const name = query.get('item')?.trim().toLowerCase();
    if (!engine || !name) return;
    const hit = engine.cat.items.find(i => i.n.toLowerCase() === name) ?? engine.cat.items.find(i => i.n.toLowerCase().includes(name));
    if (hit) setOpen(hit);
  }, [engine]);

  const filter = useMemo<Filter>(() => {
    const s = new Set<ItemType>();
    for (const g of TYPE_GROUPS) if (!off.has(g.key)) for (const t of g.types) s.add(t);
    return { types: s, source };
  }, [off, source]);

  const view = useMemo(() => {
    if (!engine) return null;
    const { cat, f, base } = engine;
    const n = cat.items.length;
    const owned = unionMask(n, [ownedMask(cat, locker?.ids ?? null), ...[...ownedKinds].map(k => engine.kinds.get(k))], pickOwn)!;
    const focus = unionMask(n, [...want].map(k => engine.kinds.get(k)), pickWant);
    const get = focus ? (s: { focus: number }) => s.focus : undefined;
    const scores = scoreWindows(cat, f, base, owned, filter, focus);
    const { end26, start27 } = yearBounds(cat);
    const i26 = scores.findLastIndex(s => s.start <= end26), i27 = scores.findIndex(s => s.start >= start27);
    return {
      owned, scores, focus,
      pick26: i26 >= 0 ? pickBest(scores, 0, i26, get) : null,
      pick27: pickBest(scores, i27, scores.length - 1, get),
      split: { i26, i27 },
      stats: lockerStats(cat, locker?.ids ?? null, owned),
      today: todayCheck(cat, owned, filter),
    };
  }, [engine, locker, filter, want, ownedKinds, pickWant, pickOwn]);

  // Until the visitor picks a date, follow the best start: the 2026 pass while it can still be claimed, else 2027.
  const sel = selected ?? view?.pick26?.index ?? view?.pick27?.index ?? 0;
  const detail = useMemo(() => {
    if (!engine || !view) return null;
    return windowDetail(engine.cat, engine.f, sel, view.owned, filter, engine.base.level, engine.base.season[sel], view.focus);
  }, [engine, view, sel, filter]);

  const names = KINDS.filter(t => want.has(t.key)).map(t => t.noun);
  const focusName = pickWant.length ? (names.length ? 'chosen' : 'wishlist') : names.length ? (names.length > 2 ? 'chosen' : names.join(' and ')) : null;
  const personal = !!locker || ownedKinds.size > 0 || pickOwn.length > 0;   // do we know anything about what they own?
  const show = engine && view && detail;

  const markWant = (i: number) => { setPickOwn(p => p.filter(x => x !== i)); setPickWant(p => (p.includes(i) ? p : [...p, i])); setSelected(null); };
  const markOwn = (i: number) => { setPickWant(p => p.filter(x => x !== i)); setPickOwn(p => (p.includes(i) ? p : [...p, i])); setSelected(null); };
  const unmark = (i: number) => { setPickWant(p => p.filter(x => x !== i)); setPickOwn(p => p.filter(x => x !== i)); setSelected(null); };

  const wantChips = (
    <div className="chips" role="group" aria-label="What you are after">
      <button type="button" className="chip pickable" aria-pressed={want.size === 0 && pickWant.length === 0} onClick={() => { setWant(new Set()); setPickWant([]); setSelected(null); }}>Everything</button>
      {KINDS.map(t => (
        <button key={t.key} type="button" className="chip pickable" aria-pressed={want.has(t.key)}
          onClick={() => { setWant(prev => { const n = new Set(prev); if (n.has(t.key)) n.delete(t.key); else n.add(t.key); return n; }); setSelected(null); }}>{t.label}</button>
      ))}
    </div>
  );

  return (
    <>
      <header className="nav">
        <div className="nav-pill">
          <a className="brand" href="#top" aria-label="Plunder Planner, home">Plunder <span>Planner</span></a>
          <nav className="nav-links" aria-label="Sections">
            <a href="#plan">Plan</a>
            <a href="#yours">Your locker</a>
            <a href="#today">Today</a>
            <a href="#hunt">No token?</a>
            <a href="#method">Receipts</a>
          </nav>
        </div>
      </header>

      <main id="top">
        <Hero cat={engine?.cat ?? null} onOpen={setOpen} />

        <section className="wrap console-wrap" id="plan">
          {loadError && <p className="field-error" role="alert">{loadError}</p>}
          {!show && !loadError && <div className="console" aria-busy="true"><div className="skeleton tall" /><div className="skeleton" /></div>}
          {show && (
            <Reveal className="console">
              <div className="console-bar">
                <p className="cap" id="after-label">I am after</p>
                {wantChips}
              </div>
              <Poster cat={engine.cat} score={view.scores[sel]} index={sel} detail={detail} pick26={view.pick26} pick27={view.pick27} in26={sel <= view.split.i26}
                personal={personal} hunting={false} focusName={focusName} relError={engine.base.relError} onSelect={setSelected} onOpen={setOpen} />
              <YearStrip cat={engine.cat} scores={view.scores} split={view.split} picks={[view.pick26?.index ?? -1, view.pick27?.index ?? -1]}
                selected={sel} onSelect={setSelected} focusName={focusName} personal={personal} />
            </Reveal>
          )}
        </section>

        {show && (
          <>
            <section className="wrap section">
              <Reveal><h2 className="statement">What that fortnight should bring. <span>Click any item to see when it comes back.</span></h2></Reveal>
              <Reveal delay={0.05}><WindowPanel cat={engine.cat} score={view.scores[sel]} detail={detail} hasLocker={personal} focusName={focusName} onOpen={setOpen} /></Reveal>
            </section>

            <section className="wrap section" id="yours">
              <Reveal><h2 className="statement">Make it yours. <span>Tell it what you own and what you want, and the dates sharpen.</span></h2></Reveal>
              <div className="bento">
                <Reveal className="bento-a"><LockerCard locker={locker} stats={view.stats} ownedKinds={ownedKinds}
                  onOwnedKinds={s => { setOwnedKinds(s); setSelected(null); }} onLocker={l => { setLocker(l); setSelected(null); }} /></Reveal>
                <Reveal className="bento-b" delay={0.08}>
                  <div className="card want-card">
                    <header className="card-head"><h3>Hunting something specific?</h3><p>Search any shop item. Want ranks the calendar by it, Own stops counting it.</p></header>
                    <div className="locker-pane"><ItemSearch cat={engine.cat} want={pickWant} own={pickOwn} onWant={markWant} onOwn={markOwn} onRemove={unmark} /></div>
                  </div>
                </Reveal>
                <Reveal className="bento-c" delay={0.12}>
                  <div className="card refine-card">
                    <header className="card-head"><h3>What counts</h3><p>Leave out what you do not care about.</p></header>
                    <div className="locker-pane">
                      <p className="cap" id="source-label">Collabs or Fortnite originals?</p>
                      <div className="chips" role="group" aria-labelledby="source-label">
                        {([['all', 'Both'], ['collab', 'Collabs only'], ['original', 'Originals only']] as const).map(([k, label]) => (
                          <button key={k} type="button" className="chip pickable" aria-pressed={source === k} onClick={() => { setSource(k); setSelected(null); }}>{label}</button>
                        ))}
                      </div>
                      <p className="cap" id="types-label">Item types</p>
                      <div className="chips" role="group" aria-labelledby="types-label">
                        {TYPE_GROUPS.map(g => {
                          const on = !off.has(g.key);
                          return (
                            <button key={g.key} type="button" className="chip" aria-pressed={on}
                              onClick={() => setOff(prev => { const n = new Set(prev); if (on) { if (n.size < TYPE_GROUPS.length - 1) n.add(g.key); } else n.delete(g.key); return n; })}>{g.label}</button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </Reveal>
              </div>
              <Wishlist cat={engine.cat} f={engine.f} want={pickWant} selected={sel} onSelect={setSelected} onOpen={setOpen} />
              <details className="refine">
                <summary>Show the year as a line chart</summary>
                <Timeline cat={engine.cat} scores={view.scores} split={view.split} picks={[view.pick26?.index ?? -1, view.pick27?.index ?? -1]}
                  selected={sel} onSelect={setSelected} hasLocker={personal} focusName={focusName} />
              </details>
            </section>

            <Reveal><TodayPanel cat={engine.cat} today={view.today} hasLocker={personal} onOpen={setOpen} /></Reveal>
          </>
        )}

        <Reveal><Hunt passValue={Math.max(view?.pick26?.score.total ?? 0, view?.pick27?.score.total ?? 0)} hasLocker={personal} /></Reveal>
        <Reveal><Method cat={engine?.cat ?? null} receipts={receipts} /></Reveal>
      </main>

      {engine && (
        <ItemDialog cat={engine.cat} f={engine.f} item={open} wanted={!!open && pickWant.includes(open.idx)} owned={!!open && (pickOwn.includes(open.idx) || !!view?.owned[open.idx])}
          onClose={() => setOpen(null)} onWant={markWant} onOwn={markOwn} onRemove={unmark} onSelect={w => { setSelected(w); document.getElementById('plan')?.scrollIntoView({ behavior: 'smooth' }); }} />
      )}

      <footer className="wrap footer">
        <p className="credit">Built by <a href="https://github.com/MuhammadMurtuzaHussain" target="_blank" rel="noreferrer">Muhammad Murtuza Hussain</a>. Open source under the MIT licence: <a href="https://github.com/MuhammadMurtuzaHussain/plunder-planner" target="_blank" rel="noreferrer">view the code on GitHub</a>.</p>
        <p>Credits: shop history from <a href="https://fortnite-api.com" target="_blank" rel="noreferrer">fortnite-api.com</a>, prices and locker format from <a href="https://fortnite.gg" target="_blank" rel="noreferrer">fortnite.gg</a>, drop odds and Treasure Hours from <a href="https://fortnite.bot/treasure" target="_blank" rel="noreferrer">fortnite.bot</a>. Not affiliated with or endorsed by Epic Games. Forecasts are estimates, not promises.</p>
      </footer>
    </>
  );
}
