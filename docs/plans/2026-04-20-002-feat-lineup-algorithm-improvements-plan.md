---
title: "feat: Lineup Algorithm Improvements (R1–R4)"
type: feat
status: active
date: 2026-04-20
origin: docs/brainstorms/lineup-algorithm-improvements-requirements.md
---

# feat: Lineup Algorithm Improvements (R1–R4)

## Overview

Four targeted improvements to the lineup generation algorithm: extra innings go to bottom-of-order players, bench time is served in early innings, anti-position avoidance takes priority over preferred-position satisfaction, and at most 3 preferred pitchers per game in consecutive inning blocks.

## Problem Frame

The current algorithm distributes playing time fairly but has four gaps noticed in practice:
1. Extra innings go to top-of-batting-order players rather than bottom.
2. Players who must sit once tend to sit in the last inning, which wastes the bench slot if the game is cut short.
3. Preferred-seeking players get first pick of positions before anti-position players, leaving anti-position players with no good options.
4. Any player can pitch any inning; a single player can pitch all 6 innings.

(see origin: `docs/brainstorms/lineup-algorithm-improvements-requirements.md`)

## Requirements Trace

- R1. Extra innings go to the last players in batting order (bottom-of-order), not the first.
- R2. A player with `slack > 0` sits in the earliest possible inning, not the latest.
- R3. Players with anti-positions pick their field position before preferred-seeking players.
- R4. At most 3 preferred pitchers per game; each pitcher plays a consecutive equal block (2+2+2, 3+3, or 6).
- R5. All existing test suites continue to pass.

## Scope Boundaries

- No change to co-ed field composition rules (`calculateFieldComposition`).
- No change to the overall fairness principle (everyone within ±1 innings).
- No change to batting order determination (`PlayerSorter`).
- No change to late arrival handling.
- No change to unified vs split mode.
- Pitcher selection order (round-robin by last game pitched) is deferred — use batting-order position as selection criterion for now.

## Context & Research

### Relevant Code and Patterns

- `src/models/PositionAssigner.ts` — core algorithm; all four changes land here or are triggered from here.
  - `calculateTargets()` (lines ~58-80): gives extras to indices 0..guysExtra-1 — needs reversal for R1.
  - `selectCandidates()` (lines ~208-246): deficit/gap sort — needs slack tier for R2.
  - candidate sort inside `assign()` (lines ~126-139): preferred-first sort — needs anti-position check prepended for R3.
- `src/utils/calculations.ts` — `assignTargetInnings()`: same extra-innings logic as `calculateTargets()`, not currently used by `PositionAssigner` but should stay consistent; update for R1.
- `src/models/LineupBuilder.ts` — orchestrates `PositionAssigner`; pitcher pre-pass will be a new private method called before `assignPositionsForBothGenders()`.
- `src/types.ts` — `Position.PITCHER = 'P'`; `Player.preferredPositions?: Position[][]`, `Player.antiPositions?: Position[]`.
- `__tests__/setup.ts` — `createPlayer()`, `createRoster()`, `createAllRSVPs()`, `assertFairPlayingTime()`, `getInningsPlayed()`.
- `__tests__/fairness.test.ts` — playing-time fairness tests; R1 and R2 test scenarios belong here.
- `__tests__/positions.test.ts` — position assignment tests; R3 and R4 test scenarios belong here.

### Institutional Learnings

- `docs/solutions/ui-bugs/react-usestate-stale-after-server-rerender-2026-04-20.md` — unrelated to algorithm but documents the pattern: state derived from props needs `key` for remount. Not applicable here.

## Key Technical Decisions

- **R1 — reversal mechanism**: Change `i < guysExtra` to `i >= numGuys - guysExtra` in `calculateTargets()`. Last N guys/girls get the extra inning. Same change in `assignTargetInnings()`.
- **R2 — slack sort tier**: In `selectCandidates()`, prepend a slack tier to the existing deficit/gap sort. `slack = (totalInnings - currentInning) - (targetInnings[idx] - inningsPlayed[idx])`. Players with `slack == 0` (cannot afford to sit) sort before players with `slack > 0`. Within each tier, existing deficit → gap logic applies. Result: when there are more eligible players than spots, high-slack players are left out and sit.
- **R3 — anti-position sort key**: In the `playersThisInning.sort()` inside `assign()`, prepend a check for `player.antiPositions?.length > 0`. Players with anti-positions sort first. Within the anti-group and within the non-anti group, existing preferred-position logic applies.
- **R4 — pitcher pre-pass location**: Implement as a new private method `assignPitchers()` in `PositionAssigner`, called at the top of `assign()`. It pre-populates `guysPositions`/`girlsPositions` for pitcher innings and increments `inningsPlayed` for those players, so the main loop treats those innings as already filled.
- **R4 — pitcher block sizes**: 3 pitchers → innings [0-1], [2-3], [4-5]; 2 pitchers → innings [0-2], [3-5]; 1 pitcher → innings [0-5]; 0 preferred pitchers → no-op.
- **R4 — pitcher selection**: Among preferred pitchers (PITCHER in any `preferredPositions` group), select up to 3 in batting-order position (the order they appear in the `guys` / `girls` arrays passed to `PositionAssigner`). Pitcher selection is across both genders independently — prefer guys first if there are more than 3 total (implementation detail; keep simple).
- **R4 — pitched innings count toward target**: Pitched innings increment `inningsPlayed` normally. If a pitcher's fairness target says they should sit an inning inside their block, they pitch anyway — pitching is a commitment. This may push them slightly above their base fairness target; that is acceptable and documented.
- **R4 — PITCHER excluded from general loop for pre-assigned innings**: After `assignPitchers()` runs, the main inning loop must not assign PITCHER again for innings where it was already filled. Track pre-assigned positions per inning.

## Open Questions

### Resolved During Planning

- **Sit early or sit late?** Early (requirements doc).
- **Pitcher block size?** Equal blocks: 2+2+2, 3+3, or all 6 (requirements doc).
- **Pitcher pool?** Preferred pitchers only — must have `Position.PITCHER` in any `preferredPositions` group (requirements doc).
- **Fewer than 3 pitchers?** Scale down evenly: 2 pitchers → 3+3, 1 pitcher → 6 (requirements doc).
- **0 preferred pitchers?** No-op; general position assigner handles it as before (requirements doc).

### Deferred to Implementation

- **Pitcher selection across genders**: If there are preferred pitchers in both genders, who pitches which block? Simplest: combine both gender arrays, take first 3 in order (guys before girls, following batting-order position). Adjust if the implementation makes a different ordering more natural.
- **Pitcher fairness tension**: A pitcher locked into innings 1-2 whose target says they should sit inning 2 will play more than their base target. Accept and document — pitching is a commitment.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
assign() [PositionAssigner]
  │
  ├─ calculateTargets()        ← R1: extras go to last indices
  │
  ├─ assignPitchers()          ← R4: NEW — pre-populate pitcher innings,
  │    │                              increment inningsPlayed for pitchers,
  │    │                              mark pitcher slot as filled per inning
  │    └─ returns: pitcherSchedule  (Map<inning, globalPlayerIdx>)
  │
  └─ for each inning (0..5):
       ├─ availablePositions = FIELD_POSITIONS minus pre-filled slots
       │
       ├─ selectCandidates() for guys  ← R2: slack tier prepended to sort
       ├─ selectCandidates() for girls ← R2: same
       │
       ├─ playersThisInning.sort()     ← R3: anti-position check prepended
       │
       └─ assignPositions()            (existing logic, unchanged)
```

## Implementation Units

- [x] **Unit 1: R1 — Extra innings to bottom-of-order players**

**Goal:** When total field spots aren't evenly divisible, the extra inning goes to the last players in batting order, not the first.

**Requirements:** R1

**Dependencies:** None

**Files:**
- Modify: `src/models/PositionAssigner.ts`
- Modify: `src/utils/calculations.ts`
- Test: `__tests__/fairness.test.ts`

**Approach:**
- In `calculateTargets()`, change `i < guysExtra` to `i >= numGuys - guysExtra` (and same for girls/girlsExtra). This gives the extra inning to the last N players in each gender group.
- Apply the same change to `assignTargetInnings()` in `calculations.ts` (change `idx < distribution.playersWithExtra` to `idx >= numPlayers - distribution.playersWithExtra`).
- The batting order of guys and girls arrays passed to `PositionAssigner` reflects the sorted order from `PlayerSorter`, so last index = last batter = gets the extra inning.

**Patterns to follow:**
- `calculateTargets()` in `src/models/PositionAssigner.ts` (existing loop structure to mirror with inverted condition)

**Test scenarios:**
- Happy path: 9 guys, 6 innings → 54 total spots, 9 base = 6 each. All guys get exactly 6 innings; no extra. Expect last guys have same target as first guys (no rounding needed here; test with 10 guys where one gets extra).
- Happy path (extra inning): 10 guys, 6 innings → 60 total spots, 10 guys → 6 each. Try 11 guys, 6 innings → 66 spots / 11 = 6 each. Try 8 guys, 6 innings → 48 spots / 8 = 6 each. Try 7 guys, 6 innings → 42 / 7 = 6. Try 9 guys, 6 innings → 54 / 9 = 6. Use 14 guys, 6 innings → 84 / 14 = 6. Use a count where extra exists: 10 guys, 7 spots/inning → 42 spots, 10 guys → base 4, extra 2. The **last** 2 guys should get 5 innings, not the first 2.
- Edge case: Only 1 guy — he gets all spots, no rounding needed.
- Edge case: `guysExtra == 0` and `girlsExtra == 0` — no change to targets; no player gets bumped.
- Regression: `assertFairPlayingTime()` still passes — max difference between any two players' innings is still ≤ 1.

**Verification:**
- In a test with an uneven-divisible roster, `targetInnings[lastGuyIndex] > targetInnings[firstGuyIndex]` (or equal if extras exceed 1).
- `assertFairPlayingTime()` still passes for all existing test scenarios.

---

- [x] **Unit 2: R2 — Slack-based early bench scheduling**

**Goal:** A player who must sit at least once sits in the earliest inning where it won't prevent them from reaching their target — not the last.

**Requirements:** R2

**Dependencies:** Unit 1 (targets must be correct before slack makes sense)

**Files:**
- Modify: `src/models/PositionAssigner.ts`
- Test: `__tests__/fairness.test.ts`

**Approach:**
- In `selectCandidates()`, compute `slack` before the sort: `const totalRemainingInnings = this.innings - currentInning; const slack = totalRemainingInnings - (targetInnings[idx] - inningsPlayed[idx]);`.
- Add `slack` to the sort comparator as the primary tier: `slack === 0` players sort before `slack > 0` players. Within each tier, existing deficit → gap logic applies.
- Store slack per candidate (compute once, use in sort) to avoid recomputing inside comparator.
- `currentInning` is 0-indexed in the implementation — verify whether `totalRemainingInnings` should be `this.innings - currentInning` (innings remaining including current) or `this.innings - currentInning - 1`. The requirement says slack=1 in inning 1 (0-indexed: inning 0) for a target-5-of-6 player: `remainingInnings=6, remainingTarget=5, slack=1`. So `totalRemainingInnings = this.innings - currentInning` (not subtracting 1 — includes the current inning as a play opportunity).

**Patterns to follow:**
- `selectCandidates()` sort in `src/models/PositionAssigner.ts` (extend existing sort; do not replace it)

**Test scenarios:**
- Happy path: Player with target 5 of 6 — in a 6-inning game, `slack=1` in inning 1 (0-indexed: 0). They should sit inning 1 and play innings 2-6.
- Happy path (game shortened): Same player sits inning 1; game ends after 5 innings. They played 4 innings (2-5). Verify they are NOT sitting in inning 5 or 6 — their bench slot is already served.
- Edge case: Player with target 6 of 6 (slack=0 every inning) — never sits. Verify they appear in every inning's field assignment.
- Edge case: Two players both with target 5 (only one bench slot possible if 10 players and 10 field spots) — verify the player with more slack in inning 1 sits inning 1, and the other player sits in inning 2 if they also have slack.
- Edge case: Player with target 4 of 6 (`slack=2` in inning 1) — should sit inning 1 and inning 2.
- Regression: `assertFairPlayingTime()` still passes — introducing slack-based priority doesn't violate fairness bounds.

**Verification:**
- A player with target < 6 sits in inning 1 or 2 (0-indexed: 0 or 1), not in inning 5 or 6.
- `assertFairPlayingTime()` passes for all existing test scenarios.

---

- [x] **Unit 3: R3 — Anti-position players pick before preferred-seeking players**

**Goal:** When assigning field positions for an inning, players with anti-positions get first pick, reducing the chance they are left with only anti-position options.

**Requirements:** R3

**Dependencies:** None (independent sort change)

**Files:**
- Modify: `src/models/PositionAssigner.ts`
- Test: `__tests__/positions.test.ts`

**Approach:**
- In the `playersThisInning.sort()` inside `assign()`, prepend an anti-position tier: if player A has `antiPositions?.length > 0` and player B doesn't, A sorts first (returns -1); if only B has anti-positions, B sorts first (returns 1).
- If both or neither have anti-positions, fall through to the existing preferred-position sort (unchanged).
- The `antiPositions` check is on `this.allPlayers[idx].player.antiPositions`.

**Patterns to follow:**
- Existing sort in `assign()` (lines ~126-139) — prepend new tier, preserve existing tiers

**Test scenarios:**
- Happy path: A guy with `antiPositions: [PITCHER]` and a guy with `preferredPositions: [[PITCHER]]` both in the same inning. Anti-position player picks first → they avoid PITCHER; preferred-position player then takes PITCHER. No anti-position violation occurs.
- Happy path: Multiple players with anti-positions — they all sort before any preferred-seeking player.
- Edge case: All players in an inning have anti-positions — they all pick early, but the last one may still get an anti-position if all remaining slots are anti. Verify this still works (the existing fallback is unchanged).
- Edge case: No players have anti-positions — the new sort tier is a no-op; existing preferred behavior is unchanged.
- Regression: Anti-position violation rate does not increase vs. the pre-change baseline (check that the existing anti-positions tests still pass).
- Regression: Players without anti-positions are not adversely affected — preferred positions are still honored when they're available.

**Verification:**
- Existing `__tests__/positions.test.ts` anti-position tests pass.
- In a scenario with an anti-position player and a preferred pitcher: the anti-position player never receives an anti-position when a non-anti position was available.

---

- [x] **Unit 4: R4 — Pitcher pre-pass (consecutive innings, preferred pitchers only)**

**Goal:** Select up to 3 preferred pitchers before general position assignment; each pitches a consecutive equal block of innings; pitched innings count toward their playing time total.

**Requirements:** R4

**Dependencies:** Units 1 and 2 (targets and slack must be correct for pitched innings to count properly toward totals)

**Files:**
- Modify: `src/models/PositionAssigner.ts`
- Test: `__tests__/positions.test.ts`

**Approach:**
- Add a private `assignPitchers()` method to `PositionAssigner`. Call it at the start of `assign()`, before the main inning loop.
- **Pitcher identification**: iterate `this.guys` and `this.girls` to find players whose `preferredPositions` contains `Position.PITCHER` in any group. Collect them with their `globalIdx`.
- **Pitcher selection**: take up to 3 preferred pitchers in order (guys first, in their batting-order position; then girls). If fewer than 3 preferred pitchers are available, scale down.
- **Block assignment**: compute blocks based on pitcher count: 3 → [0-1],[2-3],[4-5]; 2 → [0-2],[3-5]; 1 → [0-5]; 0 → return early (no-op).
- **Pre-populate positions**: for each pitcher's block, set `guysPositions[localIdx][inning] = Position.PITCHER` (or girls equivalent) for each inning in their block, and increment `inningsPlayed[globalIdx]` for each pre-assigned inning.
- **Track pre-filled pitcher slots**: return a `Set<number>` (or `Map<number, boolean>`) of inning indices where PITCHER is already filled. In the main inning loop, exclude `Position.PITCHER` from `availablePositions` for those innings.
- **No double-counting**: since `inningsPlayed` is incremented during `assignPitchers()`, `selectCandidates()` sees the correct remaining quota for pitchers. Pitchers may not be selected again by the general loop for their pre-assigned innings (their `inningsPlayed` will have incremented, keeping them within their target).
- **Edge case — pitcher targets**: A pitcher's fairness target is calculated before `assignPitchers()` runs. If pitching 2 innings would push them over their base target (e.g., they would naturally sit one inning but now pitch 2), accept the overage — pitching is a commitment.

**Patterns to follow:**
- `calculateTargets()` pattern for iterating guys and girls arrays with `globalIdx` offsets
- Position assignment in `assign()` for how `guysPositions` and `girlsPositions` are written

**Test scenarios:**
- Happy path (3 preferred pitchers): 3 players have PITCHER in `preferredPositions`. Expect exactly 3 unique pitchers across the 6 innings. Expect pitcher 1 pitches innings 1-2, pitcher 2 innings 3-4, pitcher 3 innings 5-6 (consecutive blocks, no breaks).
- Happy path (2 preferred pitchers): 2 players have PITCHER in `preferredPositions`. Expect exactly 2 unique pitchers: pitcher 1 pitches innings 1-3, pitcher 2 innings 4-6.
- Happy path (1 preferred pitcher): 1 player has PITCHER in `preferredPositions`. Expect that player pitches all 6 innings.
- Happy path (0 preferred pitchers): No players have PITCHER in `preferredPositions`. Pitcher position is assigned by the general algorithm — any player may pitch any inning (existing behavior).
- Edge case: 4+ preferred pitchers — only 3 pitch; the rest are assigned by the general algorithm to non-pitcher positions (or bench).
- Edge case: Pitched innings count toward playing time — a pitcher who pitches 2 innings has `inningsPlayed += 2` from the pre-pass. They still get fair remaining innings from the general loop.
- Regression: `assertCoedRules()` still passes — co-ed composition on the field is unchanged.
- Regression: `assertFairPlayingTime()` still passes — pitching commitment may cause ≤1 inning overage for a pitcher, within the ±1 fairness bound.
- Regression: all 5 existing test suites pass.

**Verification:**
- A lineup with 3+ preferred pitchers has exactly 3 pitchers, each in a strict consecutive 2-inning block.
- No inning has more than 1 pitcher.
- A pitcher's `positions` array shows `PITCHER` only in their consecutive block, not scattered.
- `assertFairPlayingTime()` passes (pitchers within ±1 of others' playing time).

## System-Wide Impact

- **Interaction graph:** `LineupBuilder.generate()` calls `assignPositionsForBothGenders()` which calls `PositionAssigner.assign()`. All four changes live inside `PositionAssigner.assign()` and its helpers — no external callers need updating.
- **Error propagation:** No new error surfaces; all changes are internal to the assignment loop.
- **State lifecycle risks:** R4's pitcher pre-pass mutates `inningsPlayed` before the main loop runs. The main loop must not overwrite pre-assigned positions. Ensure the pre-assigned pitcher positions are written to `guysPositions`/`girlsPositions` at the start and the main loop checks for already-filled slots before assigning.
- **API surface parity:** `PositionAssigner.assign()` returns the same `{ guysPositions, girlsPositions }` shape. No interface changes.
- **Integration coverage:** The web UI (`/games/[id]/lineup`) calls `generateLineup()` which runs `LineupBuilder`. A full generate call with preferred pitchers in the roster should produce pitcher-locked innings. Run the dev server or use integration tests to verify.
- **Unchanged invariants:** Co-ed composition rules (`calculateFieldComposition`), batting order (`PlayerSorter`), late-arrival bench logic (inning 0 skip in `selectCandidates()`), and the `generateLineup` public API are all unchanged.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Pitcher pre-pass pushes a pitcher above their fairness target | Accepted — pitching is a commitment. The overage is at most 1 inning (within ±1 bound). Document in code comment. |
| Slack calculation uses wrong remaining-innings formula (off-by-one) | Verify with a concrete example: target-5-of-6 player in inning 0 should have slack=1. Write the test first to catch the formula before broader changes land. |
| R4 pre-pass leaves pitcher slot un-excluded from main loop, causing double assignment | Cover with a test asserting only 1 pitcher per inning. The pre-filled slot tracking (Set of inning indices) must be checked in `availablePositions` construction. |
| Changing extra-innings distribution (R1) breaks fairness tests that assumed first-player advantage | Update or add fairness tests that assert last-player-gets-extra; existing `assertFairPlayingTime()` tests for ±1 bound should still pass. |

## Sources & References

- **Origin document:** [`docs/brainstorms/lineup-algorithm-improvements-requirements.md`](docs/brainstorms/lineup-algorithm-improvements-requirements.md)
- Related code: `src/models/PositionAssigner.ts`, `src/models/LineupBuilder.ts`, `src/utils/calculations.ts`
- Test helpers: `__tests__/setup.ts`
