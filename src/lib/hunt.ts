/**
 * Figures for players who do not have Pirate Shop Access yet.
 * Odds and Treasure Hour times are as published by fortnite.bot/treasure (quoting Epic) on Nov 9, 2026.
 * They are plain constants so they are easy to update if Epic changes them.
 */
export const BASE_ODDS = 137_500;           // 1 in N per chest opened in a normal match
export const TREASURE_MULTIPLIER = 1.5;     // Pirate Shop Access boost during a Treasure Hour
export const TREASURE_HOUR_LENGTH_H = 2;
export const MATCHES_PER_TREASURE_HOUR = 6; // rough: a 2-hour window fits about six matches
export const HUNT_ENDS = Date.UTC(2026, 11, 5, 14, 0);
export const TREASURE_HOURS: number[] = [
  Date.UTC(2026, 10, 14, 19, 0), Date.UTC(2026, 10, 15, 2, 0),
  Date.UTC(2026, 10, 21, 19, 0), Date.UTC(2026, 10, 22, 2, 0),
  Date.UTC(2026, 10, 28, 19, 0), Date.UTC(2026, 10, 29, 2, 0),
];

export interface HuntPlan { chestsPerMatch: number; matchesPerDay: number; treasureHours: number }
export interface HuntOdds {
  daysLeft: number; normalChests: number; boostedChests: number;
  chance: number;          // probability of at least one drop before the hunt ends
  oneIn: number;
  chestsForEven: number;   // chests needed for a 50% chance at the base rate
}

export function upcomingTreasureHours(now: number) {
  return TREASURE_HOURS.filter(t => t + TREASURE_HOUR_LENGTH_H * 3600e3 > now);
}

export function huntOdds(plan: HuntPlan, now: number): HuntOdds {
  const daysLeft = Math.max(0, (HUNT_ENDS - now) / 86400e3);
  const normalChests = plan.chestsPerMatch * plan.matchesPerDay * daysLeft;
  const boostedChests = plan.treasureHours * MATCHES_PER_TREASURE_HOUR * plan.chestsPerMatch;
  const p = 1 / BASE_ODDS;
  const miss = Math.pow(1 - p, normalChests) * Math.pow(1 - p * TREASURE_MULTIPLIER, boostedChests);
  const chance = 1 - miss;
  return { daysLeft, normalChests, boostedChests, chance, oneIn: chance > 0 ? 1 / chance : Infinity, chestsForEven: Math.log(0.5) / Math.log(1 - p) };
}

export function countdown(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return `${d}:${two(h)}:${two(m)}:${two(sec)}`;
}
