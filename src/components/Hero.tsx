import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { decodeLocker, importBookmarklet, type Locker } from '../lib/locker.ts';
import { KINDS, TYPE_LABEL, fmt, fmtDay, imgUrl, type LockerStats } from '../lib/analysis.ts';
import type { Catalog } from '../lib/types.ts';

interface Props {
  mode: 'have' | 'hunt'; onMode: (m: 'have' | 'hunt') => void;
  cat: Catalog | null; loadError: string | null; locker: Locker | null; stats: LockerStats | null;
  ownedKinds: Set<string>; onOwnedKinds: (s: Set<string>) => void;
  onLocker: (l: Locker) => void; onSkip: () => void;
}
type Tab = 'import' | 'link' | 'none';

export function Hero({ mode, onMode, cat, loadError, locker, stats, ownedKinds, onOwnedKinds, onLocker, onSkip }: Props) {
  const [tab, setTab] = useState<Tab>('import');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState(false);
  const importLink = useRef<HTMLAnchorElement>(null);

  // React refuses javascript: links written in JSX, so the import button gets its address after mounting.
  useEffect(() => {
    importLink.current?.setAttribute('href', importBookmarklet(location.origin + location.pathname));
  }, [tab]);

  // Real shelf: the priciest things on sale on the latest day of data.
  const shelf = useMemo(() => {
    if (!cat) return [];
    return cat.items.filter(i => i.i && i.t !== 'track' && i.days[i.days.length - 1] === cat.lastDay).sort((a, b) => b.p - a.p).slice(0, 10);
  }, [cat]);
  const goto = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  const next = () => goto(mode === 'hunt' ? 'hunt' : 'plan');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onLocker(await decodeLocker(text)); next(); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not read that.'); }
    finally { setBusy(false); }
  }
  const toggleKind = (key: string) => { const n = new Set(ownedKinds); if (n.has(key)) n.delete(key); else n.add(key); onOwnedKinds(n); };

  return (
    <section className="wrap hero">
      <h1>Spend your Pirate Shop Access on the right 14 days</h1>
      <p className="lede">Tell us what you own. We check nine years of Item Shop history against it and rank every fortnight.</p>

      <div className="mode" role="group" aria-label="Do you have a token yet?">
        <button type="button" aria-pressed={mode === 'have'} onClick={() => onMode('have')}>I have a token</button>
        <button type="button" aria-pressed={mode === 'hunt'} onClick={() => { onMode('hunt'); goto('hunt'); }}>Still hunting</button>
      </div>

      <div className="hero-grid">
        <div className="card locker-card">
          <header className="card-head"><h2>Your locker</h2><p>Stays in your browser. We never ask for your Epic login.</p></header>
          <div className="tabs locker-tabs" role="tablist" aria-label="How to share your locker">
            <button role="tab" type="button" aria-selected={tab === 'import'} onClick={() => setTab('import')}>One-click import</button>
            <button role="tab" type="button" aria-selected={tab === 'link'} onClick={() => setTab('link')}>Paste a link</button>
            <button role="tab" type="button" aria-selected={tab === 'none'} onClick={() => setTab('none')}>No locker</button>
          </div>

          {tab === 'import' && (
            <div className="locker-pane">
              <ol className="steps">
                <li>Drag this button to your bookmarks bar:
                  <a ref={importLink} className="btn primary drag" draggable onClick={e => { e.preventDefault(); setHint(true); }}>Send locker to Plunder Planner</a>
                  {hint && <span className="field-help" role="status">Drag it up to the bookmarks bar rather than clicking it here. Press Ctrl+Shift+B (Cmd+Shift+B on Mac) if the bar is hidden.</span>}
                </li>
                <li>Open your locker on fortnite.gg. The short link (fortnite.gg/locker?id=...) is fine.</li>
                <li>Click the bookmark. This site opens with your locker loaded.</li>
              </ol>
              <p className="field-help">It only reads the item list that page already shows and passes it here after the # in the address, which is never sent to a server. Desktop browsers only.</p>
            </div>
          )}

          {tab === 'link' && (
            <form onSubmit={submit} className="locker-form locker-pane" noValidate>
              <label htmlFor="locker">Long fortnite.gg link, or a list of item ids</label>
              <div className="field-row">
                <input id="locker" name="locker" type="text" inputMode="url" autoComplete="off" spellCheck={false}
                  placeholder="https://fortnite.gg/my-locker?items=..." value={text} onChange={e => setText(e.target.value)}
                  aria-describedby="locker-help" aria-invalid={!!error} />
                <button className="btn primary" type="submit" disabled={busy || !text.trim()}>{busy ? 'Reading' : 'Read my locker'}<ArrowRight weight="bold" aria-hidden="true" /></button>
              </div>
              {error
                ? <p className="field-error" role="alert"><WarningCircle weight="fill" aria-hidden="true" />{error}</p>
                : <p className="field-help" id="locker-help">For links that contain "my-locker?items=". Bots that create these need access to your Epic account, so only use one you already trust. The other two tabs need no login at all.</p>}
            </form>
          )}

          {tab === 'none' && (
            <div className="locker-pane">
              <p className="pane-label" id="own-label">Tick what you already own most of</p>
              <div className="chips" role="group" aria-labelledby="own-label">
                {KINDS.map(k => <button key={k.key} type="button" className="chip pickable" aria-pressed={ownedKinds.has(k.key)} onClick={() => toggleKind(k.key)}>{k.label}</button>)}
              </div>
              <p className="field-help">Those groups are left out of your totals. It is a rough sketch: you can add single items with the search further down.</p>
              <button className="btn primary" type="button" onClick={() => { onSkip(); next(); }}>Build my plan<ArrowRight weight="bold" aria-hidden="true" /></button>
            </div>
          )}

          {loadError && <p className="field-error locker-pane" role="alert"><WarningCircle weight="fill" aria-hidden="true" />{loadError}</p>}
          {stats && stats.shopItems > 0 && (
            <p className="locker-ok" role="status">
              <CheckCircle weight="fill" aria-hidden="true" />
              <span>{locker ? `Read ${fmt(stats.read)} cosmetics. ${fmt(stats.shopItems)} are Item Shop items` : `Counting ${fmt(stats.shopItems)} Item Shop items as owned`} worth {fmt(stats.shopValue)} V-Bucks
                {stats.byType[0] ? `, mostly ${TYPE_LABEL[stats.byType[0].type].toLowerCase()}` : ''}.</span>
            </p>
          )}
        </div>

        <figure className="card shelf" aria-label="Items on sale in the shop right now">
          <header className="card-head"><h2>On sale now</h2>{cat && <p>{fmtDay(cat, cat.lastDay, true)}. A token makes all of it free.</p>}</header>
          <ul className="shelf-grid">
            {shelf.length ? shelf.map((it, k) => (
              <li key={it.a} className={`r-${it.s ? 'series' : it.r ?? 'common'}`} style={{ '--i': k } as React.CSSProperties}><img src={imgUrl(cat!, it)!} alt={it.n} width={128} height={128} loading="eager" /></li>
            )) : Array.from({ length: 10 }, (_, k) => <li key={k} className="skeleton" />)}
          </ul>
        </figure>
      </div>
    </section>
  );
}
