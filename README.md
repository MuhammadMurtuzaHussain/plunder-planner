# Plunder Planner

A Pirate Shop Access optimiser. Paste a fortnite.gg locker link and see which 14 days of free Item Shop access would unlock the most
cosmetics you do not already own. Everything runs in the browser: no account, no server, no tracking, and no AI model.

It also covers players who are still hunting for a token (drop odds, Treasure Hour countdown) and lets you
rank the calendar by a season you care about (winter, Halloween, summer, Valentine's, spring).

## Run it

```bash
npm install
npm run dev
```

## How it works

- `scripts/build_dataset.py` joins two public sources into `public/data/catalog.json`:
  shop history per item from fortnite-api.com (`/v2/cosmetics?responseFlags=7`) and V-Bucks prices plus
  locker ids from fortnite.gg's item list (`data/raw/fngg/all.en.js`).
- `src/lib/locker.ts` decodes a fortnite.gg "Copy link" URL (base64url + raw deflate + delta-encoded ids).
- `src/lib/model.ts` scores every 14-day window: expected shop total minus the expected value of what
  you already own. Per-item chances come from a logistic regression (`scripts/train.ts`).
- `scripts/backtest.ts` hides a year of data and checks the forecast against what really happened.

```bash
npm run data        # rebuild the catalogue from data/raw
node scripts/train.ts
npm run backtest    # optionally: npm run backtest -- path/to/file-with-locker-link.txt
```

## Refreshing the data

`data/raw/cosmetics_all.json` can be re-downloaded with curl at any time. fortnite.gg blocks scripted
downloads, so `data/raw/fngg/all.en.js` has to be saved from a normal browser session
(https://fortnite.gg/data/items/all.en.js). Ask fortnite.gg before redistributing their data at scale.

## Honest limits

Item-level chances are well calibrated and the expected value is typically within about 9%, but the
single best fortnight far ahead is only weakly predictable, because roughly a quarter of any
fortnight's value comes from items that did not exist a year earlier.

## Credits

Built by Muhammad Murtuza Hussain. Shop history from [fortnite-api.com](https://fortnite-api.com), prices and
locker link format from [fortnite.gg](https://fortnite.gg), drop odds and Treasure Hour times from
[fortnite.bot](https://fortnite.bot/treasure). Code is MIT licensed; the bundled item data belongs to its sources.

Not affiliated with or endorsed by Epic Games.
