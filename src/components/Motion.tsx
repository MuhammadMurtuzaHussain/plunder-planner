import { useEffect, useRef } from 'react';
import { animate, motion, useReducedMotion } from 'motion/react';

export const EASE = [0.16, 1, 0.3, 1] as const;

/** Fade and rise into place the first time the block scrolls into view. */
export function Reveal({ children, delay = 0, className }: { children: React.ReactNode; delay?: number; className?: string }) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} initial={reduce ? false : { opacity: 0, y: 32 }} whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }} transition={{ duration: 0.8, delay, ease: EASE }}>
      {children}
    </motion.div>
  );
}

/** A number that rolls from its previous value to the new one. Writes to the DOM directly, so no re-renders. */
export function CountUp({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null), from = useRef(value);
  const reduce = useReducedMotion();
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (reduce) { el.textContent = format(value); from.current = value; return; }
    const controls = animate(from.current, value, { duration: 0.7, ease: EASE, onUpdate: v => { el.textContent = format(v); } });
    from.current = value;
    return () => controls.stop();
  }, [value, format, reduce]);
  return <span ref={ref}>{format(value)}</span>;
}
