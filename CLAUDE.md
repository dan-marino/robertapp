# CLAUDE.md

Guidelines for working with this codebase using Claude Code.

## Commands

```bash
npm start          # run the CLI and generate a lineup
npm test           # run the full test suite
npm run test:watch # watch mode
npm run build      # compile TypeScript
```

## Architecture

The app is a TypeScript CLI. Entry point is `src/index.ts`. The core logic lives in `src/models/`. See `ARCHITECTURE.md` for a full breakdown.

## Key constraints

- **Co-ed rules**: minimum 3 girls on the field each inning, maximum 7 guys. Never violate these.
- **Fairness mode**: everyone plays the same number of innings (±1). This is the only mode that exists right now.
- **Late arrivals**: always bench in inning 1, always in the bottom 20% of the batting order.
- **Anti-positions**: a player should never be assigned an anti-position when a non-anti position is available. Bench them before forcing an anti-position.

## Testing

Tests live in `__tests__/`. Shared factories and helpers are in `__tests__/setup.ts` — use those before writing new ones.

The test suite covers:
- Co-ed rule compliance (`coed-rules.test.ts`)
- Playing time fairness (`faireness.test.ts`)
- Position assignment and preferences (`positions.test.ts`)
- Late arrival handling (`late-arrivals.test.ts`)
- Basic structure (`basic.test.ts`)

Run tests before every commit. All 5 suites must pass.

## Data

Player roster lives in `src/data/roster.json`. RSVP data for the sample game is in `src/rsvp.ts`. These are test/sample data — the real data input will eventually come from a database.

Each player can have:
- `preferredPositions` — 1 to 3 positions they like. The algorithm tries to give them at least one per game.
- `antiPositions` — 0 to 2 positions they refuse. The algorithm avoids these and will bench a player rather than force one.

## What's coming next

1. **Database** — PostgreSQL + Prisma to replace the hardcoded JSON files
2. **Web UI** — Next.js admin for managing players, RSVPs, and viewing lineups
3. **Skill ratings** — per-position skill scores to inform "playoff mode" optimization
