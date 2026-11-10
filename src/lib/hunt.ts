/**
 * Figures for players who do not have Pirate Shop Access yet.
 * The numbers live in hunt-data.json, refreshed daily from fortnite.bot/treasure by
 * scripts/update_hunt.ts. Hours marked `confirmed: false` are the site's expectation
 * (same slots and boost as before), not something Epic has announced.
 */
import data from './hunt-data.json' with { type: 'json' };

export interface TreasureHour { start: number; end: number; multiplier: number; confirmed: boolean }
export const BASE_ODDS: number = data.baseOdds;       // 1 in N per chest opened in a normal match
export const HUNT_ENDS = Date.parse(data.huntEnds);
export const DATA_CHECKED: string = data.checked;
export const TREASURE_HOURS: TreasureHour[] = data.hours.map(h => ({ start: Date.parse(h.start), end: Date.parse(h.end), multiplier: h.multiplier, confirmed: h.confirmed }));
export const MATCHES_PER_TREASURE_HOUR = 6;           // rough: a 2-hour window fits about six matches
/** Boosts to offer in the calculator: every value seen so far, plus the usual two. */
export const MULTIPLIER_CHOICES: number[] = [...new Set([1.5, 2, ...TREASURE_HOURS.map(h => h.multiplier)])].sort((a, b) => a - b);

export interface HuntPlan { chestsPerMatch: number; matchesPerDay: number; treasureHours: number; multiplier: number }
export interface HuntOdds {
  daysLeft: number; normalChests: number; boostedChests: number;
  chance: number;          // probability of at least one drop before the hunt ends
  oneIn: number;
  chestsForEven: number;   // chests needed for a 50% chance at the base rate
}

export const upcomingTreasureHours = (now: number) => TREASURE_HOURS.filter(h => h.end > now);

export function huntOdds(plan: HuntPlan, now: number): HuntOdds {
  const daysLeft = Math.max(0, (HUNT_ENDS - now) / 86400e3);
  const normalChests = plan.chestsPerMatch * plan.matchesPerDay * daysLeft;
  const boostedChests = plan.treasureHours * MATCHES_PER_TREASURE_HOUR * plan.chestsPerMatch;
  const p = 1 / BASE_ODDS;
  const miss = Math.pow(1 - p, normalChests) * Math.pow(1 - p * plan.multiplier, boostedChests);
  const chance = 1 - miss;
  return { daysLeft, normalChests, boostedChests, chance, oneIn: chance > 0 ? 1 / chance : Infinity, chestsForEven: Math.log(0.5) / Math.log(1 - p) };
}

export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d}:${two(h)}:${two(m)}:${two(sec)}`;
}
