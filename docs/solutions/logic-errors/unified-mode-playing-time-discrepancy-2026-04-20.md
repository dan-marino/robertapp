---
title: Unified Mode Playing Time Discrepancy (Guys vs Girls 2-Inning Gap)
date: 2026-04-20
category: docs/solutions/logic-errors
module: LineupAlgorithm
problem_type: logic_error
component: service_object
symptoms:
  - In unified mode, guys played 4-5 innings while girls played only 2-4 innings from a 6-inning game
  - Fairness tests for unified mode failed with max-min spread of 2+ innings
  - A specific player (e.g. Guy11) was found playing only 2 innings despite others playing 4-5
root_cause: logic_error
resolution_type: code_fix
severity: high
tags:
  - unified-mode
  - playing-time
  - fairness
  - position-assigner
  - gender-targets
---

# Unified Mode Playing Time Discrepancy (Guys vs Girls 2-Inning Gap)

## Problem

In unified (interleaved) mode, `PositionAssigner.calculateTargets()` used gender-specific playing time targets for both split and unified modes. This gave guys 4–5 innings and girls only 3–4 innings per game — a structural 2-inning gap that violated the fairness guarantee.

## Symptoms

- Guys averaged 4–5 innings, girls 2–4 innings in a 6-inning unified mode game
- Fairness assertion `max - min > 1` failed in unified mode tests
- One player (Guy11 in a 10G/5g roster) was found playing only 2 innings

## What Didn't Work

- Adding a unified-specific fairness test with `assertFairPlayingTime` — this helper uses `slice(0, guysCount)` to separate guys from girls, which breaks for unified mode's interleaved lineup. The test passed incorrectly because it was measuring the wrong players.
- Attempting to use a 14G/4g test case with uniform targets — structurally infeasible: girls' uniform target total (16 innings) was less than the mandatory girl innings (18), making the feasibility check necessary.

## Solution

Two changes to `src/models/PositionAssigner.ts`:

**1. Uniform target calculation with feasibility check in `calculateTargets(isUnified)`:**

```typescript
private calculateTargets(isUnified: boolean = false): number[] {
  const totalPlayers = this.numGuys + this.numGirls;
  if (isUnified) {
    const totalSpots = (this.guysPerInning + this.girlsPerInning) * this.innings;
    const base = Math.floor(totalSpots / totalPlayers);
    const extra = totalSpots % totalPlayers;
    // Check feasibility: girls' collective uniform innings must meet mandatory floor
    let uniformGirlTotal = 0;
    for (let i = 0; i < this.numGirls; i++) {
      const idx = this.numGuys + i;
      uniformGirlTotal += base + (extra > 0 && idx >= totalPlayers - extra ? 1 : 0);
    }
    const mandatoryGirlInnings = this.girlsPerInning * this.innings;
    if (uniformGirlTotal >= mandatoryGirlInnings) {
      return this.allPlayers.map((_, idx) =>
        base + (extra > 0 && idx >= totalPlayers - extra ? 1 : 0)
      );
    }
    // Fall through to gender-specific targets when infeasible
  }
  // ... existing gender-specific code
}
```

**2. New `selectCandidatesUnified()` that picks all 10 players per inning from a combined pool:**

Phase 1 guarantees `≥ minGirls` girls; Phase 2 fills remaining slots from the combined pool up to `maxGuys`. Players are sorted by slack (target innings − innings played) ascending so those who most need to play are prioritized.

**3. Test helper for unified fairness** — avoids `slice(0, guysCount)` by filtering directly on `player.gender`:

```typescript
function assertUnifiedFairness(guysCount: number, girlsCount: number, maxDiff = 1) {
  const lineup = generateLineup(rsvps, roster, 'unified');
  const allInnings = lineup.lineup.map(p => getInningsPlayed(p.positions));
  const min = Math.min(...allInnings);
  const max = Math.max(...allInnings);
  if (max - min > maxDiff) throw new Error(`Playing time spread ${max - min} exceeds ${maxDiff}`);
}
```

## Why This Works

Gender-specific targets allocated spots per gender independently:
- 7 guys on field × 6 innings = 42 spots ÷ 10 guys = 4.2 → guys get 4–5 innings
- 3 girls on field × 6 innings = 18 spots ÷ 5 girls = 3.6 → girls get 3–4 innings

The 2-inning gap is structural and unavoidable with gender-specific targets when the field ratios differ from the roster ratios.

Uniform targets give every player the same base: 60 total spots ÷ 15 players = 4 innings each. The feasibility check prevents uniform targets when the girl collective falls below the mandatory floor (e.g. 14G/4g: 4 girls × 4 innings = 16 < 18 mandatory), falling back to gender-specific targets in those edge cases.

## Prevention

- Always add unified-mode fairness tests alongside split-mode tests when changing `PositionAssigner`
- Never use `assertFairPlayingTime` (which uses `slice(0, guysCount)`) on unified mode lineups — the interleaved order makes the slice wrong; filter by `player.gender` instead
- When adding a new roster configuration test for unified mode, verify feasibility first: `numGirls × uniformTarget ≥ girlsPerInning × innings`

## Related Issues

- `__tests__/faireness.test.ts` — unified mode test block added under `describe('Unified Mode Fairness', ...)`
- `src/models/PositionAssigner.ts` — `calculateTargets()`, `selectCandidatesUnified()`, `assign(isUnified)`
