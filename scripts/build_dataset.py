#!/usr/bin/env python3
"""Build the compact catalogue the app ships with.

Inputs (data/raw):
  cosmetics_all.json   fortnite-api.com /v2/cosmetics?responseFlags=7  (shop history per item)
  fngg/all.en.js       fortnite.gg item list (ids used by locker links, V-Bucks prices)
Output:
  public/data/catalog.json
"""
import collections, datetime as dt, json, os, re, sys
sys.path.insert(0, os.path.dirname(__file__))
from fngg_parse import load

ROOT = os.path.join(os.path.dirname(__file__), '..')
EPOCH = dt.date(2017, 1, 1)
norm = lambda s: re.sub(r'[^a-z0-9]', '', (s or '').lower())
day = lambda iso: (dt.date.fromisoformat(iso[:10]) - EPOCH).days

# fortnite.gg type code -> our type key
FNGG_TYPES = {1: 'outfit', 2: 'backpack', 3: 'pickaxe', 4: 'glider', 5: 'contrail', 6: 'emote', 7: 'wrap',
              9: 'spray', 10: 'emoji', 11: 'toy', 12: 'loadingscreen', 13: 'music', 26: 'aura', 31: 'shoe',
              32: 'sidekick', 20: 'track', 21: 'instrument', 22: 'instrument', 23: 'instrument',
              24: 'instrument', 25: 'instrument', 17: 'car', 18: 'car', 19: 'car', 29: 'car', 30: 'car',
              27: 'lego', 28: 'lego'}

FNGG_COLLAB_TAG = 18
ORIGINAL_SERIES = {None, 'Slurp', 'Dark', 'Frozen', 'Shadow', 'Lava'}
# Brand-new licensed sets that fortnite.gg has not tagged yet. Add to this when a new crossover launches.
EXTRA_COLLAB_SETS = {'one piece', 'lil uzi vert', 'a$ap rocky'}

def api_items():
    d = json.load(open(os.path.join(ROOT, 'data/raw/cosmetics_all.json')))['data']
    for cat, rows in d.items():
        for x in rows:
            if cat == 'br':
                t = x['type']['value']
                t = {'pet': 'sidekick', 'petcarrier': 'sidekick'}.get(t, t)
                img = (x.get('images') or {}).get('smallIcon') or (x.get('images') or {}).get('icon')
            elif cat == 'tracks':
                t, img = 'track', x.get('albumArt')
            elif cat == 'instruments':
                t, img = 'instrument', (x.get('images') or {}).get('small')
            elif cat == 'cars':
                t, img = 'car', (x.get('images') or {}).get('small')
            elif cat == 'legoKits':
                t, img = 'lego', (x.get('images') or {}).get('small')
            else:
                continue
            yield {
                'id': x['id'], 'cat': cat, 'type': t, 'name': x.get('name') or x.get('title') or '',
                'rarity': (x.get('rarity') or {}).get('value'),
                'series': ((x.get('series') or {}).get('value') or '').replace(' SERIES', '').replace(' Series', '').title() or None,
                'set': (x.get('set') or {}).get('value'),
                'img': img, 'tags': x.get('gameplayTags') or [],
                'hist': sorted({day(h) for h in x.get('shopHistory') or []}),
                'added': x.get('added', '')[:10],
            }

def main():
    sets, fitems = load(os.path.join(ROOT, 'data/raw/fngg/all.en.js'))
    api = list(api_items())
    by_key = collections.defaultdict(list)
    for a in api:
        by_key[(a['type'], norm(a['name']))].append(a)

    def fdate(v):  # 261108 -> day index
        s = str(v); return (dt.date(2000 + int(s[:2]), int(s[2:4]), int(s[4:6])) - EPOCH).days

    # A set is a collab if most of its items are tagged as one: new additions to old crossovers are often untagged.
    tagged = collections.defaultdict(list)
    for f in fitems:
        if 'set' in f: tagged[f['set']].append(FNGG_COLLAB_TAG in f.get('t', []))
    collab_sets = {s for s, v in tagged.items() if sum(v) * 2 >= len(v)}
    collab_sets |= {i for i, name in enumerate(sets) if name in EXTRA_COLLAB_SETS}
    used, rows, unmatched_priced = set(), [], 0
    for f in fitems:
        t = FNGG_TYPES.get(f['type'])
        if not t:
            continue
        cands = [a for a in by_key.get((t, norm(f['name'])), []) if a['id'] not in used]
        if not cands:
            if 'p' in f and f.get('l'): unmatched_priced += 1
            continue
        if len(cands) > 1:
            last = fdate(f['l']) if f.get('l') else None
            cands.sort(key=lambda a: (0 if (a['hist'] and last is not None and abs(a['hist'][-1] - last) <= 1) else 1,
                                      0 if a['hist'] else 1, abs(fdate(f['added']) - day(a['added'] or '2017-01-01'))))
        a = cands[0]; used.add(a['id'])
        rows.append((f, a))

    out, stats = [], collections.Counter()
    matched_api = {a['id'] for _, a in rows}
    for f, a in rows:
        if not a['hist']:
            continue
        p = f.get('p')
        if not p:  # only ever sold inside a bundle or with an outfit: no standalone value
            stats['no_standalone_price'] += 1; continue
        deltas = [a['hist'][0]] + [b - c for b, c in zip(a['hist'][1:], a['hist'])]
        row = {'g': f['id'], 'a': a['id'], 'n': f['name'], 't': a['type'], 'r': a['rarity'],
               's': a['series'], 'e': a['set'], 'p': p, 'i': a['img'], 'h': deltas}
        # Collab = licensed crossover. fortnite.gg tags these (tag 18); branded series and jam tracks count too.
        if FNGG_COLLAB_TAG in f.get('t', []) or f.get('set') in collab_sets or a['series'] not in ORIGINAL_SERIES or a['type'] == 'track':
            row['c'] = 1
        out.append(row)
        stats['items'] += 1
    stats['api_hist_unmatched'] = sum(1 for a in api if a['hist'] and a['id'] not in matched_api)
    stats['fngg_priced_seen_unmatched'] = unmatched_priced

    # shorten image urls
    pre = 'https://fortnite-api.com/images/cosmetics/'
    for o in out:
        if o['i'] and o['i'].startswith(pre): o['i'] = '~' + o['i'][len(pre):]

    last_day = max(sum(o['h']) for o in out)
    cat = {'epoch': EPOCH.isoformat(), 'lastDay': last_day, 'built': dt.date.today().isoformat(),
           'imgPrefix': pre, 'fnggCount': len(fitems), 'items': out}
    os.makedirs(os.path.join(ROOT, 'public/data'), exist_ok=True)
    path = os.path.join(ROOT, 'public/data/catalog.json')
    json.dump(cat, open(path, 'w'), separators=(',', ':'), ensure_ascii=False)
    print(dict(stats), 'bytes', os.path.getsize(path), 'last', EPOCH + dt.timedelta(days=last_day))

    # sanity benchmark: value of distinct items on sale 4-17 Dec 2025
    lo, hi = day('2025-12-04'), day('2025-12-17')
    tot = collections.Counter()
    for o in out:
        d = 0; hit = False
        for x in o['h']:
            d += x
            if lo <= d <= hi: hit = True; break
        if hit: tot[o['t']] += o['p']
    print('Dec 4-17 2025 total', sum(tot.values()), dict(tot.most_common()))

if __name__ == '__main__':
    main()
