# Architecture

## Overview

TypeScript monorepo with two layers: a CLI that generates co-ed softball lineups and a Next.js web admin for managing players, RSVPs, and viewing lineups.

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

```
web/
├── src/
│   ├── app/
│   │   ├── layout.tsx                    # Root layout + nav
│   │   ├── page.tsx                      # Home page
│   │   ├── players/
│   │   │   └── page.tsx                  # Players list
│   │   └── games/[id]/
│   │       ├── rsvp/page.tsx             # RSVP form
│   │       └── lineup/page.tsx           # Lineup display
│   ├── api/
│   │   ├── games/route.ts                # GET season/games
│   │   ├── games/[id]/lineup/route.ts    # GET generated lineup
│   │   ├── games/[id]/rsvps/route.ts     # GET/PUT RSVPs
│   │   ├── players/route.ts              # GET/POST players
│   │   └── players/[id]/route.ts         # PUT/DELETE player
│   ├── components/
│   │   ├── PlayerList.tsx
│   │   ├── PlayerForm.tsx
│   │   ├── RsvpTable.tsx
│   │   ├── LineupGrid.tsx
│   │   └── DownloadCsvButton.tsx
│   └── lib/
│       ├── data.ts                       # JSON read/write helpers
│       ├── csv.ts                        # CSV formatting
│       └── utils.ts
└── __tests__/                            # API + data layer tests
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

## Web admin

**Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4.

**Data layer (`web/src/lib/data.ts`):** reads/writes JSON files in `src/data/`, shared with the CLI. Key functions: `readRoster()`, `writeRoster()`, `readSeason()`, `readRsvps(gameId)`, `writeRsvps(gameId)`.

**Pages:**
- `/players` — list, add, edit, and delete players
- `/games/[id]/rsvp` — per-game attending/late toggles for every player on the roster
- `/games/[id]/lineup` — generated lineup table, color-coded by position group, with CSV download

**Lineup generation:** `GET /api/games/[id]/lineup` calls `generateLineup()` from `src/generator.ts` directly, reusing all CLI logic without duplication.

## Roadmap

The current data layer is temporary. Planned evolution:

| Phase | What | Status |
|-------|------|--------|
| 1 | CLI + hardcoded JSON | Done |
| 2 | PostgreSQL + Prisma schema | Next |
| 3 | Next.js web admin | Done |
| 4 | Deployment (Docker → AWS/GCP) | Later |
