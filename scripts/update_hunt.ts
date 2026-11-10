/**
 * Refresh src/lib/hunt-data.json from fortnite.bot/treasure, which tracks Epic's announcements.
 * Run daily by .github/workflows/deploy.yml.   Manual run: node scripts/update_hunt.ts
 *
 * The page is a Next.js app: the numbers live in one of its script chunks as plain object
 * literals. We read them with regular expressions and refuse to write anything that fails a
 * sanity check, so a site redesign makes this script fail loudly instead of publishing nonsense.
 */
import { readFileSync, writeFileSync } from 'node:fs';

const SOURCE = 'https://fortnite.bot/treasure';
const OUT = new URL('../src/lib/hunt-data.json', import.meta.url);
const UA = 'plunder-planner-updater (+https://github.com/MuhammadMurtuzaHussain/plunder-planner)';
const get = async (url: string) => {
  const r = await fetch(url, { headers: { 'user-agent': UA } });
  if (!r.ok) throw new Error(`${url} answered ${r.status}`);
  return r.text();
};

export interface HuntHour { start: string; end: string; multiplier: number; confirmed: boolean }
export interface HuntData { source: string; checked: string; baseOdds: number; huntEnds: string; hours: HuntHour[] }

const ISO = String.raw`\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ`;

export function parse(js: string): Omit<HuntData, 'source' | 'checked'> {
  const odds = js.match(/key:"pirateShop",oneIn:(\d+)/);
  if (!odds) throw new Error('drop odds not found');
  const baseOdds = Number(odds[1]);

  // Confirmed hours are written out in full, with their own boosts.
  const hours: HuntHour[] = [];
  for (const m of js.matchAll(new RegExp(String.raw`\{start:"(${ISO})",end:"(${ISO})",boosts:\{([^{}]*)\}`, 'g'))) {
    const boost = m[3].match(/pirateShop:([\d.]+)/);
    if (boost) hours.push({ start: m[1], end: m[2], multiplier: Number(boost[1]), confirmed: true });
  }

  // Expected hours come from a helper: given a date it returns slots at fixed hour offsets
  // with default boosts, flagged `expected`. Rebuild those slots here.
  const helper = js.match(/(\w+)=\w+=>\{[^}]*?return\[((?:\{start:\w+\(\d+\),end:\w+\(\d+\),boosts:\w+,expected:!0\},?)+)\]\}/);
  const defaults = js.match(/[,;{ ]\w+=\{(?=[^{}]*goldOutfit:)[^{}]*pirateShop:([\d.]+)[^{}]*\}/);
  if (helper && defaults) {
    const offsets = [...helper[2].matchAll(/start:\w+\((\d+)\),end:\w+\((\d+)\)/g)].map(o => [Number(o[1]), Number(o[2])]);
    const name = helper[1].replace(/[$]/g, '\\$');
    for (const call of js.matchAll(new RegExp(String.raw`\.\.\.${name}\("(\d{4}-\d\d-\d\d)"\)`, 'g'))) {
      const day = Date.parse(call[1]);
      const iso = (h: number) => new Date(day + h * 3600e3).toISOString().replace('.000', '');
      for (const [a, b] of offsets) hours.push({ start: iso(a), end: iso(b), multiplier: Number(defaults[1]), confirmed: false });
    }
  }
  hours.sort((a, b) => a.start.localeCompare(b.start));

  // The hunt ends when its last week does.
  const weekEnds = [...js.matchAll(new RegExp(String.raw`\{number:\d+,name:"[^"]*"[^{}]*?start:"${ISO}",end:"(${ISO})"`, 'g'))].map(m => m[1]).sort();
  const huntEnds = weekEnds[weekEnds.length - 1];

  // Sanity checks: better to fail than to publish a misread.
  if (!(baseOdds >= 1000 && baseOdds <= 50_000_000)) throw new Error(`implausible odds: 1 in ${baseOdds}`);
  if (!hours.length) throw new Error('no Treasure Hours found');
  if (!huntEnds) throw new Error('hunt end date not found');
  for (const h of hours) {
    const len = (Date.parse(h.end) - Date.parse(h.start)) / 3600e3;
    if (!(h.multiplier >= 1 && h.multiplier <= 20) || !(len > 0 && len <= 12) || !/^202[67]/.test(h.start)) throw new Error(`implausible Treasure Hour: ${JSON.stringify(h)}`);
  }
  if (new Set(hours.map(h => h.start)).size !== hours.length) throw new Error('duplicate Treasure Hours');
  return { baseOdds, huntEnds, hours };
}

async function main() {
  const html = await get(SOURCE);
  const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[\w~.-]+\.js/g)].map(m => m[0]))];
  let js: string | undefined;
  for (const c of chunks) {
    const text = await get(new URL(c, SOURCE).href);
    if (text.includes('key:"pirateShop",oneIn:')) { js = text; break; }
  }
  if (!js) throw new Error(`treasure data not found in ${chunks.length} script files; the site layout probably changed`);
  const fresh = parse(js);

  let old: HuntData | null = null;
  try { old = JSON.parse(readFileSync(OUT, 'utf8')); } catch { /* first run */ }
  const same = old && JSON.stringify({ baseOdds: old.baseOdds, huntEnds: old.huntEnds, hours: old.hours }) === JSON.stringify(fresh);
  if (same) { console.log('No change:', fresh.hours.length, 'Treasure Hours, odds 1 in', fresh.baseOdds); return; }
  const data: HuntData = { source: SOURCE, checked: new Date().toISOString().slice(0, 10), ...fresh };
  writeFileSync(OUT, JSON.stringify(data, null, 2) + '\n');
  console.log('Updated hunt data:');
  for (const h of fresh.hours) console.log(' ', h.start, `${h.multiplier}x`, h.confirmed ? 'confirmed' : 'expected');
}

if (process.argv[1]?.endsWith('update_hunt.ts')) main().catch(e => { console.error('Update failed:', e.message); process.exit(1); });
