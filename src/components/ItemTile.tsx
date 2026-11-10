import { motion, useReducedMotion } from 'motion/react';
import { TYPE_SINGULAR, fmt, imgUrl } from '../lib/analysis.ts';
import type { Catalog, Item } from '../lib/types.ts';

export function ItemTile({ cat, item, chance, onOpen, order = 0 }: { cat: Catalog; item: Item; chance?: number; onOpen?: (it: Item) => void; order?: number }) {
  const src = imgUrl(cat, item);
  const reduce = useReducedMotion();
  return (
    <motion.li className="tile" layout={!reduce} initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
      transition={{ duration: 0.35, delay: reduce ? 0 : Math.min(order, 12) * 0.025, ease: [0.16, 1, 0.3, 1] }} whileHover={{ y: -3 }}><button type="button" className="tile-hit" onClick={() => onOpen?.(item)} aria-label={`When is ${item.n} coming back?`} />
      <div className={`tile-img r-${item.s ? 'series' : item.r ?? 'common'}`}>{src && <img src={src} alt="" loading="lazy" decoding="async" width={96} height={96} />}</div>
      <div className="tile-body">
        <span className="tile-name">{item.n}</span>
        <span className="tile-meta">{TYPE_SINGULAR[item.t]}{item.s ? `, ${item.s}` : ''}</span>
        <span className="tile-nums"><b>{fmt(item.p)}</b>{chance !== undefined && <span>{chance >= 0.995 ? 'on sale now' : `${Math.max(1, Math.round(chance * 100))}% chance`}</span>}</span>
      </div>
    </motion.li>
  );
}
