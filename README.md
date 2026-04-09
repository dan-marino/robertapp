# robertapp

Generates co-ed softball lineups. Give it a roster and who's showing up — it handles the rest.

## What it does

- Fair playing time for everyone (±1 inning)
- Honors position preferences and avoids refused positions
- Co-ed rules: 3 girls minimum, 7 guys maximum on the field
- Late arrivals sit inning 1 and land at the bottom of the batting order
- Outputs a CSV with two batting orders (guys + girls) ready for Google Sheets

## Setup

```bash
npm install
```

## Usage

Edit `src/data/roster.json` to set your team and their position preferences. Edit `src/rsvp.ts` to set who's coming to the game and who's arriving late.

```bash
npm start
```

Lineup prints to console and saves to `output/game-g1-lineup.csv`.

## Output format

Two batting orders in one CSV, separated by a blank row. Columns are innings 1–6. Position codes: `P` `C` `1B` `2B` `3B` `SS` `LF` `LCF` `RCF` `RF` `-` (bench).

```
Name,Inn1,Inn2,Inn3,Inn4,Inn5,Inn6
1. John Smith,P,-,SS,-,P,-
...

1. Sarah Martin,SS,-,LF,3B,LCF,-
...
```

## Development

```bash
npm test           # run all tests
npm run test:watch # watch mode
npm run build      # compile TypeScript
```

See `ARCHITECTURE.md` for how the code is organized and how the algorithm works.
