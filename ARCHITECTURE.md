# Architecture

## Overview

CLI app written in TypeScript. Takes a roster and a list of RSVPs, generates a fair lineup for one game, and outputs a CSV.

```
src/
├── index.ts                  # CLI entry point
├── generator.ts              # Public API: generateLineup()
├── types.ts                  # Shared types and enums
├── rsvp.ts                   # Hardcoded sample RSVP data (temporary)
├── csv-writer.ts             # CSV formatting and file output
├── models/
│   ├── LineupBuilder.ts      # Orchestrates the full generation pipeline
│   ├── PlayerSorter.ts       # Splits and sorts players by gender/arrival
│   └── PositionAssigner.ts   # Core fairness + position algorithm
└── utils/
    └── calculations.ts       # Field composition math
```

## Data flow

```
RSVPs + Roster
      ↓
  PlayerSorter       → splits by gender, sorts (on-time first, late last)
      ↓
  calculations.ts    → figures out guys/girls per inning based on roster size
      ↓
  PositionAssigner   → assigns field positions for all 6 innings
      ↓
  LineupBuilder      → builds PlayerLineup objects with batting order
      ↓
  CSVWriter          → formats and writes output/game-*.csv
```

## Core algorithm (PositionAssigner)

The assigner runs once per inning across all 6 innings.

**Who plays each inning:**
1. Calculate each player's target innings: `totalSpots / rosterSize`, with leftover innings distributed to earlier batters.
2. Select candidates by priority: highest deficit first (innings behind target), then longest rest gap.
3. Late arrivals are excluded from inning 1.

**What position each player gets:**
1. Players with unmet preferred positions get first pick from the available pool.
2. For each player: try a preferred position → fall back to any non-anti position → last resort, assign from what's left.
3. Avoid repeating the same position as the previous inning when possible.

**Invariants:**
- Exactly 10 players on the field each inning (or fewer if not enough girls attend).
- Maximum 7 guys on the field per inning.
- Minimum 3 girls on the field per inning.
- All players play the same number of innings ±1.

## Types

```ts
Player {
  id, firstName, lastName, gender
  preferredPositions?: Position[]   // 1–3, algorithm honors these
  antiPositions?: Position[]        // 0–2, algorithm avoids these
}

RSVP { playerId, isLate }

PlayerLineup {
  player: Player
  battingOrder: number              // 1-indexed within gender group
  positions: Position[]             // length 6, one per inning
}

GameLineup {
  lineup: PlayerLineup[]            // guys first, then girls
  guysCount: number
  girlsCount: number
}
```

## CSV output format

Two batting lineups in one file, separated by a blank row.

```
Name,Inn1,Inn2,Inn3,Inn4,Inn5,Inn6
1. John Smith,P,-,SS,-,P,-
...
14. Paul Harris,-,C,-,P,-,C

1. Sarah Martin,SS,SS,LF,3B,LCF,-
...
```

Position codes: `P` `C` `1B` `2B` `3B` `SS` `LF` `LCF` `RCF` `RF` `-` (bench)

## Roadmap

The current data layer is temporary. Planned evolution:

| Phase | What |
|-------|------|
| Now | CLI + hardcoded JSON |
| Next | PostgreSQL + Prisma schema |
| After | Next.js web admin |
| Later | Deployment (Docker → AWS/GCP) |
