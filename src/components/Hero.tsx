import { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle, WarningCircle } from '@phosphor-icons/react';
import { decodeLocker, type Locker } from '../lib/locker.ts';
import { TYPE_LABEL, fmt, fmtDay, imgUrl, type LockerStats } from '../lib/analysis.ts';
import type { Catalog } from '../lib/types.ts';

interface Props {
  mode: 'have' | 'hunt'; onMode: (m: 'have' | 'hunt') => void;
  cat: Catalog | null; loadError: string | null; locker: Locker | null; stats: LockerStats | null;
  onLocker: (l: Locker) => void; onSkip: () => void;
}

export function Hero({ mode, onMode, cat, loadError, locker, stats, onLocker, onSkip }: Props) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Real shelf: the priciest things on sale on the latest day of data.
  const shelf = useMemo(() => {
    if (!cat) return [];
    return cat.items.filter(i => i.i && i.t !== 'track' && i.days[i.days.length - 1] === cat.lastDay).sort((a, b) => b.p - a.p).slice(0, 10);
  }, [cat]);
  const goto = (id: string) => requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null);
    try { onLocker(await decodeLocker(text)); goto(mode === 'hunt' ? 'hunt' : 'plan'); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not read that link.'); }
    finally { setBusy(false); }
  }

  return (
    <section className="wrap hero">
      <h1>Spend your Pirate Shop Access on the right 14 days</h1>
      <p className="lede">Paste your fortnite.gg locker. We check nine years of Item Shop history against what you already own.</p>

      <div className="mode" role="group" aria-label="Do you have a token yet?">
        <button type="button" aria-pressed={mode === 'have'} onClick={() => onMode('have')}>I have a token</button>
        <button type="button" aria-pressed={mode === 'hunt'} onClick={() => { onMode('hunt'); goto('hunt'); }}>Still hunting</button>
      </div>

      <div className="hero-grid">
        <div className="card locker-card">
          <header className="card-head"><h2>Your locker</h2><p>Decoded in your browser, never uploaded</p></header>
          <form onSubmit={submit} className="locker-form" noValidate>
            <label htmlFor="locker">fortnite.gg locker link</label>
            <div className="field-row">
              <input id="locker" name="locker" type="text" inputMode="url" autoComplete="off" spellCheck={false}
                placeholder="https://fortnite.gg/my-locker?items=..." value={text} onChange={e => setText(e.target.value)}
                aria-describedby="locker-help" aria-invalid={!!error} />
              <button className="btn primary" type="submit" disabled={busy || !text.trim()}>{busy ? 'Reading' : 'Read my locker'}<ArrowRight weight="bold" aria-hidden="true" /></button>
            </div>
            {error
              ? <p className="field-error" role="alert"><WarningCircle weight="fill" aria-hidden="true" />{error}</p>
              : <p className="field-help" id="locker-help">On fortnite.gg open My Locker and press Copy link, then paste the long link here.</p>}
            {loadError && <p className="field-error" role="alert"><WarningCircle weight="fill" aria-hidden="true" />{loadError}</p>}
          </form>
          {locker && stats ? (
            <p className="locker-ok" role="status">
              <CheckCircle weight="fill" aria-hidden="true" />
              <span>Read {fmt(stats.read)} cosmetics. {fmt(stats.shopItems)} are Item Shop items worth {fmt(stats.shopValue)} V-Bucks
                {stats.byType[0] ? `, mostly ${TYPE_LABEL[stats.byType[0].type].toLowerCase()}` : ''}.</span>
            </p>
          ) : (
            <button className="btn ghost" type="button" onClick={() => { onSkip(); goto(mode === 'hunt' ? 'hunt' : 'plan'); }}>Try an empty locker</button>
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
