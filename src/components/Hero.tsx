import { useMemo } from 'react';
import { ArrowDown } from '@phosphor-icons/react';
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform, type MotionStyle, type MotionValue } from 'motion/react';
import { fmt, fmtDay, imgUrl } from '../lib/analysis.ts';
import type { Catalog, Item } from '../lib/types.ts';
import { EASE } from './Motion.tsx';

// Where each floating item sits (percent of the stage), how big it is, and how strongly it follows the pointer.
const SPOTS = [
  { x: 6, y: 8, s: 132, d: 26 }, { x: 44, y: 0, s: 96, d: 14 }, { x: 72, y: 12, s: 150, d: 34 }, { x: 24, y: 38, s: 168, d: 40 },
  { x: 60, y: 46, s: 112, d: 20 }, { x: 2, y: 66, s: 104, d: 16 }, { x: 40, y: 74, s: 124, d: 28 }, { x: 78, y: 70, s: 92, d: 12 },
];

function Floater({ cat, item, spot, k, mx, my, onOpen }: { cat: Catalog; item: Item; spot: typeof SPOTS[number]; k: number; mx: MotionValue<number>; my: MotionValue<number>; onOpen: (it: Item) => void }) {
  const x = useTransform(mx, v => v * spot.d), y = useTransform(my, v => v * spot.d);
  const reduce = useReducedMotion();
  return (
    <motion.button type="button" className={`floater r-${item.s ? 'series' : item.r ?? 'common'}`} aria-label={`${item.n}, ${fmt(item.p)} V-Bucks, on sale now`}
      style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: spot.s, x, y, '--bob': `${5 + (k % 3) * 1.5}s`, '--lag': `${k * -0.9}s` } as unknown as MotionStyle}
      initial={reduce ? false : { opacity: 0, scale: 0.6, rotate: k % 2 ? 8 : -8 }} animate={{ opacity: 1, scale: 1, rotate: k % 2 ? 3 : -3 }}
      transition={{ type: 'spring', stiffness: 120, damping: 14, delay: 0.25 + k * 0.07 }}
      whileHover={{ scale: 1.08, rotate: 0, zIndex: 2 }} whileTap={{ scale: 0.96 }} onClick={() => onOpen(item)}>
      <img src={imgUrl(cat, item)!} alt="" loading="eager" />
    </motion.button>
  );
}

/** One statement, and the shop itself as the picture: today's priciest items float beside it. */
export function Hero({ cat, onOpen }: { cat: Catalog | null; onOpen: (it: Item) => void }) {
  const reduce = useReducedMotion();
  const px = useMotionValue(0), py = useMotionValue(0);
  const mx = useSpring(px, { stiffness: 60, damping: 18 }), my = useSpring(py, { stiffness: 60, damping: 18 });
  const shelf = useMemo(() => {
    if (!cat) return [];
    return cat.items.filter(i => i.i && i.t === 'outfit' && i.days[i.days.length - 1] === cat.lastDay).sort((a, b) => b.p - a.p).slice(0, SPOTS.length);
  }, [cat]);
  const line = (delay: number) => ({ initial: reduce ? false : { opacity: 0, y: 24 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.8, delay, ease: EASE } }) as const;

  return (
    <section className="wrap hero" onPointerMove={e => { if (reduce) return; const r = e.currentTarget.getBoundingClientRect(); px.set((e.clientX - r.left) / r.width - 0.5); py.set((e.clientY - r.top) / r.height - 0.5); }}>
      <div className="hero-copy">
        <motion.h1 {...line(0)}>X marks your <em>best 14 days.</em></motion.h1>
        <motion.p className="lede" {...line(0.12)}>Pirate Shop Access makes the whole Item Shop free for two weeks. <span>Nine years of shop history show which two weeks to pick.</span></motion.p>
        <motion.div className="hero-actions" {...line(0.24)}>
          <a className="btn primary" href="#plan">See my best dates<ArrowDown weight="bold" aria-hidden="true" /></a>
          <a className="btn ghost" href="#hunt">No token yet?</a>
        </motion.div>
      </div>
      <div className="hero-stage" aria-label="Items on sale in the shop right now">
        {cat && shelf.map((it, k) => <Floater key={it.a} cat={cat} item={it} spot={SPOTS[k]} k={k} mx={mx} my={my} onOpen={onOpen} />)}
        {cat && <motion.p className="stage-note" {...line(1)}>On sale {fmtDay(cat, cat.lastDay, true)}. A token makes all of it free.</motion.p>}
      </div>
    </section>
  );
}
