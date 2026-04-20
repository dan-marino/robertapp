---
title: Whole-Game Position Shuffle Algorithm with Cross-Inning Variety
date: 2026-04-20
category: docs/solutions/architecture-patterns
module: LineupGrid
problem_type: architecture_pattern
component: service_object
severity: medium
applies_when:
  - Shuffling player positions across a multi-inning game
  - Need to respect preferences, anti-positions, and pitcher block assignments
  - Want cross-inning variety so players don't repeat the same position every inning
tags:
  - shuffle
  - positions
  - lineup-grid
  - pitcher-rotation
  - cross-inning-variety
  - preferences
  - anti-positions
---

# Whole-Game Position Shuffle Algorithm with Cross-Inning Variety

## Context

The original `shufflePositions()` in `LineupGrid.tsx` shuffled each inning independently. Shuffling per inning meant:
- A player could be assigned the same position 6 innings in a row
- Pitcher assignments were random with no block-rotation logic
- No mechanism to ensure variety across the game

The fix replaces the per-inning approach with a two-phase whole-game algorithm that mirrors the server-side `PositionAssigner` logic.

## Guidance

The algorithm in `web/src/components/LineupGrid.tsx → shufflePositions()` has two phases:

### Phase 1 — Pitcher block assignments (before any other positions)

Find all players with a preferred pitcher group, shuffle the list, take up to 3, and assign consecutive inning blocks:

| Pitchers found | Block structure |
|---------------|----------------|
| 3 | `[0,1]`, `[2,3]`, `[4,5]` — 2 innings each |
| 2 | `[0,1,2]`, `[3,4,5]` — 3 innings each |
| 1 | `[0,1,2,3,4,5]` — all 6 innings |
| 0 | No pitcher pre-assignment |

Only non-bench innings are assigned. Track pre-assigned slots in a `pitcherSlots` Set and all covered innings in `inningsWithPitcher` Set — Phase 2 skips these.

```typescript
const selectedPitchers = shuffleArray(preferredPitcherIdxs).slice(0, 3);
const pitcherBlocks: number[][] =
  selectedPitchers.length >= 3 ? [[0,1],[2,3],[4,5]] :
  selectedPitchers.length === 2 ? [[0,1,2],[3,4,5]] :
  selectedPitchers.length === 1 ? [[0,1,2,3,4,5]] : [];

for (let p = 0; p < selectedPitchers.length; p++) {
  for (const inning of pitcherBlocks[p]) {
    if (updated[playerIdx].positions[inning] !== Position.BENCH) {
      updated[playerIdx].positions[inning] = Position.PITCHER;
      pitcherSlots.add(`${playerIdx}-${inning}`);
      inningsWithPitcher.add(inning);
    }
  }
}
```

### Phase 2 — Whole-game variety assignment

Maintain a `positionCounts` map (player index → position → count) seeded with Phase 1 pitcher assignments. For each inning, skip bench players and pre-assigned pitcher slots:

**Sort order (most-constrained picks first):**
1. Players with anti-positions, ordered by fewest available non-anti options
2. Players with a preferred position available
3. Everyone else

Within each priority tier, prefer the position the player has played **least often** (via `positionCounts`) to maximize cross-inning variety:

```typescript
// 1. Try each preferred group, sort options by ascending play count
for (const group of preferredGroups) {
  const opts = available.filter(p => group.includes(p));
  if (opts.length > 0) {
    opts.sort((a, b) => getCount(idx, a) - getCount(idx, b));
    position = opts[0]; break;
  }
}
// 2. Non-anti, non-preferred — sort by ascending play count
const nonAnti = available.filter(p => !anti.includes(p) && !allPreferred.includes(p));
nonAnti.sort((a, b) => getCount(idx, a) - getCount(idx, b));
// 3. Anti-position last resort — only when nothing else is available
```

After assigning, remove the position from `available` and call `recordAssignment(idx, position)` to update counts for future innings.

## Why This Matters

**Without cross-inning tracking:** A player assigned RF in inning 1 is equally likely to get RF again in inning 2 — nothing prevents it. The randomness acts per-inning and the game as a whole looks monotonous.

**With cross-inning tracking:** After RF is assigned once, it has count=1. When LF/LCF/RCF all have count=0, the algorithm naturally picks one of those instead. By inning 6, the player has touched most outfield positions. The same logic applies to infield variety.

**Pitcher blocks without this:** A different pitcher could be assigned every inning, with no one pitching long enough to develop rhythm. Shuffling candidates before block selection means repeated shuffles still produce different pitcher rotations.

## When to Apply

- Any time you build a UI-side shuffle that covers a multi-inning grid
- When mirroring server-side `PositionAssigner` logic in a client-side reshuffle button
- When the game has constraint positions (like Pitcher) that need block continuity

## Examples

**Before (per-inning shuffle, no variety):**
```
Inning:   1    2    3    4    5    6
Alice:   RF   RF   RF   LF   RF   RF   ← 5x RF, boring
```

**After (whole-game with positionCounts):**
```
Inning:   1    2    3    4    5    6
Alice:   RF   LF   RCF  LCF  RF   LF   ← varied outfield rotation
```

**Pitcher block example (2 preferred pitchers):**
```
Inning:   1    2    3    4    5    6
Bob:      P    P    P    SS   2B   3B   ← pitches innings 1-3
Carol:    CF   LF   RF   P    P    P    ← pitches innings 4-6
```

## Related

- `web/src/components/LineupGrid.tsx` — `shufflePositions()` implementation
- `src/models/PositionAssigner.ts` — server-side algorithm this mirrors (Phase 1 pitcher blocks, Phase 2 most-constrained-first sort)
- `docs/solutions/logic-errors/unified-mode-playing-time-discrepancy-2026-04-20.md` — related unified mode fix from same session
