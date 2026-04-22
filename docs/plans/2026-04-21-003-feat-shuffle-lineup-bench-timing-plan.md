---
title: "feat: Add Shuffle Lineup with Bench Timing Fairness"
type: feat
status: active
date: 2026-04-21
origin: docs/brainstorms/shuffle-lineup-fairness-rules-requirements.md
---

# feat: Add Shuffle Lineup with Bench Timing Fairness

## Overview

Replace the independent "Shuffle Order" and "Shuffle Positions" buttons with a single "Shuffle Lineup" button that randomizes batting order and field positions simultaneously while enforcing bench-timing fairness: early batters sit early, late batters sit late. The same bench-timing rules are applied to the initial server-generated lineup, ensuring coherence from page load.

## Problem Frame

The lineup grid currently has two separate shuffle buttons that operate independently. More critically, there is no rule tying *when* a player sits on the bench to *where* they bat in the order — a core fairness expectation for co-ed recreational softball. If you bat early, you should sit early; if you bat late, you should stay on the field longer before sitting. Neither the client-side shuffle nor the server-side initial lineup enforces this relationship today.

*(see origin: docs/brainstorms/shuffle-lineup-fairness-rules-requirements.md)*

## Requirements Trace

- R1. Replace "Shuffle Order" and "Shuffle Positions" buttons with a single "Shuffle Lineup" button.
- R2. One press randomizes batting order and field positions simultaneously, applying all fairness rules.
- R2a. After each shuffle, a brief Undo action is available (8-second dismissible toast or button). One level of undo required.
- R2b. "Shuffle Lineup" button provides brief visual confirmation that the action completed (spin or press animation).
- R3. In unified mode: spot 1 is always a guy (unless no guys present — girls lead off).
- R4–R6. No more than 3 consecutive guys; last batter is a girl when mathematically possible; girls distributed as evenly as possible. These are existing behaviors implemented by `intersperseBattingOrder()` and are unchanged by this plan.
- R7. Late arrivals placed in bottom 20% of their gender group's batting order.
- R8. Each gender group's batting order divided into thirds. Degenerate case first: if n ≤ 3, assign one player per tier (n=1 → early only; n=2 → early + late; n=3 → one each). Otherwise: `earlyCount = ceil(n/3)`, `lateCount = ceil(n/3)`, `middleCount = n − earlyCount − lateCount`.
- R9. Early-third players bench in innings 1–2, preferring inning 1.
- R10. Late-third players bench in innings 5–6, preferring inning 6. Exception: late arrivals bench in inning 1 regardless.
- R11. Middle-third players have no bench-inning constraint.
- R12. When players have unequal target innings: above-base players sit early (prefer inning 1); base players sit late (prefer inning 6). R12 takes precedence over R9–R11 when they conflict.
- R12a. When a player sits multiple innings: thirds preference applies to first bench inning; final bench inning should be inning 6 or as late as possible.
- R13. Minimum 3 girls on the field per inning; maximum 7 guys. Hard constraint — never violated.
- R14. Every player's total innings played differs by at most 1 (fairness ±1). Hard constraint.
- R15. A player is never assigned an anti-position when a non-anti-position is available.
- R16. Preferred positions honored by priority group.
- R17. Preferred pitchers receive consecutive inning blocks (2+2+2 / 3+3 / 6). Pitcher-block innings take precedence over bench-timing preferences — pitcher's bench inning falls in their non-block innings.
- R18. Cross-inning position variety maximized via `positionCounts` tracking.

**Server-side scope** (from origin, Scope Boundaries): `assignBenchSlots()` logic applies to both client shuffle and server initial lineup. `isLate` hardcoding fix is in scope (R7 correctness is a prerequisite for bench timing).

## Scope Boundaries

- No new settings or toggles — fairness rules apply unconditionally.
- Bench-timing rules are soft preferences — relaxed gracefully when R13/R14 would be violated (middle-third first, then late-third, then early-third).
- Variable game length (non-6-inning games) is out of scope; always plan for 6 innings.
- Late arrival detection on the client reads `isLate` from the payload (not recomputed).
- The `isLate: false` hardcoding bug in `shuffleOrder()` (client-side, `LineupGrid.tsx` lines 71–72) is in scope — this is a prerequisite for R7 and bench-timing correctness on the client path.

### Implementation Details Deferred to Unit 5

The undo feature (R2a) and animation (R2b) are **in scope and delivered in Unit 5**. Only the specific implementation approach is deferred to that unit's implementation phase:

- Undo state management (e.g., `useState` snapshot vs `useRef`) — approach resolved in Unit 5.
- Animation approach (e.g., CSS class toggle, Tailwind animate-spin) — approach resolved in Unit 5.

## Context & Research

### Relevant Code and Patterns

- `web/src/components/LineupGrid.tsx` — `shuffleOrder()` (isLate bug at lines 71–72), `shufflePositions()` (bench slots skipped entirely, two-phase pitcher-block + positionCounts logic to reuse)
- `src/utils/intersperse.ts` — `intersperseBattingOrder(guys, girls)` — remains unchanged, imported by LineupGrid via `@cli/utils/intersperse`
- `src/models/PositionAssigner.ts` — `calculateTargets(isUnified)` — computes `targetInnings` per player (not currently returned)
- `src/models/LineupBuilder.ts` — orchestration pipeline; Step 4 builds `PlayerLineup[]` without propagating `isLate` or `targetInnings`
- `src/types.ts` — `PlayerLineup` (missing `isLate`, `targetInnings`), `GameLineup`
- `src/generator.ts` — `generateLineup()` entry point
- `web/src/app/api/games/[id]/lineup/route.ts` — API route returning `GameLineup`

### Institutional Learnings

- `docs/solutions/architecture-patterns/whole-game-position-shuffle-algorithm-2026-04-20.md` — pitcher-block Phase 1 + positionCounts Phase 2 pattern; reuse this in `shuffleLineup()` Phase 2
- `docs/solutions/logic-errors/unified-mode-playing-time-discrepancy-2026-04-20.md` — uniform vs gender-specific target calculation; `calculateTargets()` already handles both modes correctly

### External References

- Intersperse batting order is already implemented and tested — no external reference needed.

## Key Technical Decisions

- **`assignBenchSlots()` as a shared pure utility** in `src/utils/benchTiming.ts`: takes `players` (with `battingOrder`, `targetInnings`, `isLate`, gender) and the inning count, returns a bench-inning assignment per player. Imported by both `LineupBuilder` (server) and `LineupGrid` (client) via `@cli/utils/benchTiming`. Same pattern as `intersperse.ts`.
- **Extend `PlayerLineup` with `isLate: boolean` and `targetInnings: number`**: the client must not recompute these values — they are surfaced from the server payload. `PositionAssigner.assign()` return type is extended to include `guysTargetInnings: number[]` and `girlsTargetInnings: number[]` (parallel to `guysPositions`/`girlsPositions`); `LineupBuilder` propagates both new fields into each `PlayerLineup`.
- **Four-phase `shuffleLineup()`**: Phase 0 randomizes batting order. Phase 1 assigns pitcher-block innings (existing logic from `shufflePositions()`). Phase 2 calls `assignBenchSlots()` — which receives the Phase 1 pitcher-block map so it avoids placing bench slots in pitcher-block innings — and determines which inning each player sits (this moves bench slots, not just positions). Phase 3 runs the positionCounts variety assignment from `shufflePositions()` for non-bench, non-pitcher innings only. `shufflePositions()` is kept as a private helper called from `shuffleLineup()` rather than removed.
- **R12 takes precedence over R9–R11**: innings-count fairness outranks batting-position symmetry. `assignBenchSlots()` checks above-base vs base innings first, then applies thirds-based preference within that.
- **Split mode tiebreak for bench slots**: when both genders' early-third players compete for the same inning, alternate by gender (one guy early-third in inning 1, one girl in inning 2, or vice versa). If still tied, higher-slack player (more innings remaining vs target) gets the earlier bench slot.
- **R17 pitcher block takes precedence**: pitcher-block innings are fixed before `assignBenchSlots()` runs; a preferred pitcher's bench inning falls in their non-block inning regardless of batting-third preference. `assignBenchSlots()` receives the already-applied pitcher assignments as a constraint.
- **Failure handling**: `assignBenchSlots()` always produces a result. When bench-timing preferences conflict with R13 (co-ed minimum), relax preferences in order: middle-third first, then late-third, then early-third. Hard constraints (R13, R14) are never relaxed.

## Open Questions

### Resolved During Planning

- **R8 rounding rule**: `ceil(n/3)` for both early and late; middle gets the remainder. Degenerate case (≤3 players): one per tier.
- **R12 vs R9–R11 conflict**: R12 (innings-count fairness) takes precedence.
- **Pitcher block vs bench timing**: R17 takes precedence — bench timing preference is secondary.
- **Split mode tiebreak**: alternate by gender group; if tied, higher-slack player gets earlier slot.
- **`targetInnings` source on client**: read from `PlayerLineup.targetInnings` (server-computed); client does not recompute.
- **`isLate` source on client**: read from `PlayerLineup.isLate`; fixes the `isLate: false` hardcoding bug in `shuffleOrder()`.
- **Variable game length**: always plan for 6 innings; out of scope.
- **R12a (multi-bench players)**: thirds preference applies to first bench inning; final bench should be inning 6 or as late as possible (soft preference).
- **Phase ordering for `shuffleLineup()`**: Phase 0 (batting order) → Phase 1 (pitcher-block assignment) → Phase 2 (`assignBenchSlots()` receiving Phase 1 pitcher-block map) → Phase 3 (positionCounts field positions). Pitcher-block runs before bench-slot assignment so `assignBenchSlots()` can treat pitcher-block innings as fixed constraints.
- **R10 vs R17 priority for late arrivals who are also preferred pitchers**: R10 wins — late arrivals always bench inning 0 regardless of pitcher-block status. The pitcher block effectively starts at inning 1 for that player; R17 is satisfied by the remaining innings in the block.

### Deferred to Implementation

- Exact undo implementation (useState snapshot vs ref) — depends on how `setPlayers` and button state interact in the component.
- Exact CSS/animation approach for R2b visual confirmation — implementation detail, not architectural.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

```
Server path (initial lineup):
  LineupBuilder
    → PlayerSorter.organize()           (existing)
    → PositionAssigner.assign(isUnified) → returns { positions, targetInnings }
    → assignBenchSlots(players, ...)    ← NEW, from benchTiming.ts
                                           (passes PlayerWithMetadata-shaped objects, not PlayerLineup)
    → build PlayerLineup[] with isLate + targetInnings
    → intersperseBattingOrder()         (existing, unified only)

Client shuffle path:
  shuffleLineup()
    Phase 0: shuffleArray(guys), shuffleArray(girls)
             intersperseBattingOrder() [unified] OR concat [split]  ← fixes isLate bug
    Phase 1: pitcher-block assignment          ← existing from shufflePositions()
             → produces pitcherBlockMap: Map<playerId, Set<inningIndex>>
    Phase 2: assignBenchSlots(players, pitcherBlockMap)  ← NEW shared utility
             → clear old bench slots; apply new bench assignments to positions[]
    Phase 3: positionCounts variety assignment ← existing from shufflePositions()
             (non-bench, non-pitcher innings only)

assignBenchSlots(players, innings=6) → BenchAssignment[]
  Input: players with { battingOrder, targetInnings, isLate, gender, existingPositions }
  Step 1: Classify each player into thirds (per gender group)
  Step 2: Identify above-base vs base innings players (R12)
  Step 3: Assign bench slots by priority:
           a. R12 above-base → prefer inning 1
           b. R10 late-third → prefer inning 6 (unless isLate → inning 1)
           c. R9 early-third → prefer innings 1–2
           d. R11 middle-third → fill remaining slots
  Step 4: Validate R13 per inning; relax middle → late → early if needed
  Output: Map<playerId, inning[]>  (inning indices where player is benched)
```

> **Inning index convention:** All inning indices throughout implementation units are 0-based (0 = first inning, 5 = last inning). Requirements documents use 1-based names ("inning 1", "inning 6") for readability; implementation code uses 0-based indices.

**Data flow — new fields through the pipeline:**

```
PositionAssigner.assign()
  returns: { guysPositions: Position[][],
             girlsPositions: Position[][],
             guysTargetInnings: number[],   ← NEW (parallel to guysPositions)
             girlsTargetInnings: number[] } ← NEW (parallel to girlsPositions)

LineupBuilder.assignPositionsForBothGenders()
  destructures all four fields from assigner.assign()
  builds id-keyed maps: Map<playerId, targetInnings>

LineupBuilder.generate()
  playerLineup.isLate        = player.isLate  ← NEW propagation
  playerLineup.targetInnings = targetInningsMap.get(player.id) ← NEW propagation

GameLineup.lineup[].isLate        (client reads → fixes isLate bug)
GameLineup.lineup[].targetInnings (client reads → R12)
```

## Implementation Units

- [ ] **Unit 1: Extend type system and surface targetInnings from PositionAssigner**

**Goal:** Add `isLate: boolean` and `targetInnings: number` to `PlayerLineup`; extend `PositionAssigner.assign()` to return `targetInnings[]`; propagate both fields through `LineupBuilder`.

**Requirements:** R12 (targetInnings on client), R7 fix (isLate on client)

**Dependencies:** None — foundational unit, all others depend on it.

**Files:**
- Modify: `src/types.ts`
- Modify: `src/models/PositionAssigner.ts`
- Modify: `src/models/LineupBuilder.ts` — including `assignPositionsForBothGenders()` wrapper
- Test: `__tests__/basic.test.ts` (verify new fields present in output)

**Approach:**
- In `PlayerLineup`, add `isLate: boolean` and `targetInnings: number`.
- In `PositionAssigner.assign()`, return `guysTargetInnings: number[]` and `girlsTargetInnings: number[]` alongside existing position arrays (parallel structure to `guysPositions`/`girlsPositions`). `calculateTargets()` already computes this; just surface it in the return value.
- In `LineupBuilder.assignPositionsForBothGenders()` (the private wrapper that calls `assigner.assign()`), update the return type to include `guysTargetInnings` and `girlsTargetInnings` so `generate()` can destructure all four values from a single call and build an id-keyed `Map<playerId, targetInnings>` for the loop that constructs `PlayerLineup[]`.
- In `LineupBuilder.generate()`, read `targetInnings` from `assignPositionsForBothGenders()` and set both `isLate` and `targetInnings` on each `PlayerLineup` being built.
- The `isLate` value comes from the `PlayerWithMetadata` objects already in scope during lineup construction.

**Patterns to follow:**
- `src/models/PositionAssigner.ts` — `calculateTargets()` for the existing computation
- `src/models/LineupBuilder.ts` — Step 4 loop where `PlayerLineup[]` objects are built

**Test scenarios:**
- Happy path: `generateLineup()` output includes `isLate` and `targetInnings` on every `PlayerLineup`; values match the player's RSVP late status and the targets computed by `calculateTargets()`
- Edge case: late arrival player has `isLate: true`; on-time players have `isLate: false`
- Edge case: unified mode — uniform targets; split mode — gender-specific targets
- Edge case: `targetInnings` values sum to total field slots across all innings

**Verification:**
- All existing tests pass (no regressions in fairness, co-ed rules, positions, late arrivals).
- `generateLineup()` output has `isLate` and `targetInnings` on every lineup entry.
- A late arrival player's `isLate === true` in the output.

---

- [ ] **Unit 2: Implement `assignBenchSlots()` shared utility**

**Goal:** Create `src/utils/benchTiming.ts` with a pure `assignBenchSlots()` function implementing R8–R12a. No side effects — takes player data and returns bench inning assignments.

**Requirements:** R8, R9, R10, R11, R12, R12a, R17 (pitcher-block constraint awareness)

**Dependencies:** Unit 1 (types must be stable — `targetInnings`, `isLate` on `PlayerLineup`)

**Files:**
- Create: `src/utils/benchTiming.ts`
- Create: `__tests__/benchTiming.test.ts`

**Approach:**
- Function signature accepts an array of players (each with `battingOrder`, `targetInnings`, `isLate`, `gender`, and the pre-resolved bench inning indices from existing positions — needed so pitcher-block bench slots are respected). The pitcher-block constraint is passed as a `Map<playerId, Set<inningIndex>>` derived from the pitcher-block assignment step; `assignBenchSlots()` treats these innings as fixed and will not assign bench slots that conflict with them. Deferred to implementation: whether this derives automatically from the positions array or is passed explicitly.
- Computes thirds per gender group independently using `ceil(n/3)` rounding (R8). Degenerate case: ≤3 players → one per tier.
- Classifies each player as above-base vs base innings (R12).
- Assigns bench innings by priority:
  1. Late arrivals → inning 0 regardless (R10 exception, R7).
  2. R12 above-base players → prefer inning 0 (first inning).
  3. R10 late-third players → prefer inning 5 (last inning).
  4. R9 early-third players → prefer innings 0–1.
  5. R11 middle-third → fill remaining bench slots.
- Validates R13 (min 3 girls on field) after each assignment; relaxes soft preferences in order: middle-third → late-third → early-third.
- R12a: for players who must sit multiple innings, apply thirds preference to the first bench inning; push the final bench inning as late as possible.
- Split mode tiebreak when both genders compete for the same slot: alternate by gender group; if still tied, higher-slack player (targetInnings − inningsPlayed) gets the earlier slot.
- Returns `Map<playerId, number[]>` (bench inning indices per player).

**Execution note:** Implement test-first for the core thirds-classification and bench-assignment logic before wiring into the server or client paths.

**Patterns to follow:**
- `src/utils/intersperse.ts` — pure utility function pattern, exported and tested independently
- `src/models/PositionAssigner.ts` — R13 enforcement logic

**Test scenarios:**
- Happy path (unified, 10G/5g, all on time): early-third players receive bench inning 0 or 1; late-third players receive bench inning 4 or 5; middle-third players fill remaining slots.
- Happy path (split mode): thirds computed independently within each gender group.
- Edge case (degenerate — 2 players per gender): early gets inning 0 or 1, late gets inning 4 or 5; no middle tier.
- Edge case (degenerate — 1 player per gender): that player gets exactly 1 bench inning.
- Edge case (late arrival): benched in inning 0 regardless of batting-order position.
- Edge case (above-base innings player in late third): R12 takes precedence — player benched early even though batting late.
- Edge case (preferred pitcher in early third): bench falls in non-block inning, not inning 0 or 1 if both are in the pitcher block.
- Edge case (R13 conflict): when assigning early-third bench slot to inning 0 would leave fewer than 3 girls on the field, relax to next preference without violating R13.
- Edge case (R12a, multi-bench): player sitting 2 innings — first bench follows thirds preference; second bench pushed to inning 5 or as late as possible.
- Edge case (split mode tiebreak): one guy early-third and one girl early-third both prefer inning 0 — alternate assignment so one gets inning 0 and the other gets inning 1.
- Edge case (R13 + late-third conflict): a late-third player prefers inning 5, but assigning them to inning 5 would leave fewer than 3 girls on the field — preference is relaxed to an earlier inning without violating R13.
- Edge case (R14 hard constraint protection): R14 is never relaxed regardless of R9–R11 conflicts; above-base players' extra bench inning is already baked into `targetInnings` from the server — `assignBenchSlots()` only remaps *when*, never *how many* innings a player benches.
- Edge case (gender-asymmetric degenerate — 1 guy, 5 girls): thirds computed within each gender group; guy group gets 1 player per tier (only tier 1 populated); girls get normal thirds; output is valid and no index-out-of-bounds.
- Edge case (late arrival + preferred pitcher conflict): R10 wins — late arrival always benches inning 0 regardless of pitcher-block status. The pitcher block effectively starts at inning 1 for that player. R17 is satisfied by the remaining block innings (e.g., a [0,1] block becomes a [1] block for a late arrival).
- Integration: returned `Map` contains an entry for every player with at least one bench inning; all inning indices are in [0, 5]; total field slots per inning ≥ 3 girls and ≤ 7 guys.

**Verification:**
- All test scenarios pass.
- Existing tests unaffected (utility is purely additive).

---

- [ ] **Unit 3: Apply bench timing to server-side initial lineup**

**Goal:** Call `assignBenchSlots()` in `LineupBuilder` so the initial server-generated lineup has bench innings that satisfy R8–R12a — ensuring coherence from page load.

**Requirements:** R8, R9, R10, R11, R12, R12a, R17 (scope boundary: server path in scope per origin doc)

**Dependencies:** Unit 1 (types), Unit 2 (`assignBenchSlots()` utility)

**Files:**
- Modify: `src/models/LineupBuilder.ts`
- Test: `__tests__/faireness.test.ts` (extend with bench-timing assertions)

**Approach:**
- After `PositionAssigner.assign()` returns positions and target innings, and after bench slots are determined by the position assigner's existing fairness logic, call `assignBenchSlots()` to remap bench innings according to R8–R12a.
- `assignBenchSlots()` derives the bench-slot count for each player from the count of `Position.BENCH` entries in their `existingPositions[]` (treating PositionAssigner's count as authoritative — safer for R14 compliance; avoids recomputing from `targetInnings`). The utility only changes *when* players bench, not *how many* innings they bench.
- The position assigner determines *which* players bench each inning (satisfying R13/R14); `assignBenchSlots()` determines *which inning* each of those players benches.
- Pass the pre-assigned bench-slot count (derived from positions[]) and pitcher-block assignments to `assignBenchSlots()` as constraints.
- After `assignBenchSlots()` returns, rebuild the `positions[]` array for each player with the new bench inning applied.
- No change to total innings played per player — only *when* they bench changes.

**Patterns to follow:**
- `src/models/LineupBuilder.ts` — existing Step 3–4 loop structure
- `docs/solutions/logic-errors/unified-mode-playing-time-discrepancy-2026-04-20.md` — unified fairness test pattern (filter by `player.gender`, not `slice(0, guysCount)`)

**Test scenarios:**
- Happy path (12 players, standard roster): after `generateLineup()`, players in the early third of their batting order have bench inning in {0, 1}; players in the late third have bench inning in {4, 5}.
- Happy path (unified mode): thirds computed independently within each gender group (consistent with R8, not across the combined order); bench timing consistent.
- Edge case (late arrival): late arrival player has bench inning 0 in the generated lineup.
- Edge case (preferred pitcher): pitcher's bench inning falls outside their pitcher block.
- Edge case (above-base player): player with extra innings sits in an earlier inning than same-third peers.
- Integration: `generateLineup()` produces a lineup where `max − min` innings played is ≤ 1 (R14 unaffected).
- Integration: no inning in the lineup has fewer than 3 girls on the field (R13 unaffected).

**Verification:**
- All existing test suites pass (co-ed rules, fairness, positions, late arrivals).
- New bench-timing assertions pass for generated lineups.

---

- [ ] **Unit 4: Implement `shuffleLineup()` on the client**

**Goal:** Replace the two separate `shuffleOrder()` and `shufflePositions()` calls with a single `shuffleLineup()` function that: (1) shuffles batting order with correct `isLate` flags, (2) calls `assignBenchSlots()` to set bench innings, (3) runs pitcher-block and positionCounts position assignment for non-bench innings.

**Requirements:** R1 (single action), R2, R3, R7 (isLate fix), R8–R12a (bench timing), R15–R18 (position rules)

**Dependencies:** Unit 1 (types in payload), Unit 2 (`assignBenchSlots()` importable via `@cli/utils/benchTiming`)

**Files:**
- Modify: `web/src/components/LineupGrid.tsx`

**Approach:**
- Add `shuffleLineup()` function. Keep `shufflePositions()` as a private helper — it is called from `shuffleLineup()` as Phase 3 rather than removed.
- **Phase 0 (batting order)**: `shuffleArray(guys)`, `shuffleArray(girls)`. In unified mode, call `intersperseBattingOrder()` — which accepts `PlayerWithMetadata[]`, so construct adapter objects: `{ player: pl.player, isLate: pl.isLate, inningsPlayed: 0 }` for each player, using the real `pl.isLate` from the payload (fixes the `isLate: false` hardcoding bug). In split mode, concat with updated `battingOrder` indices. Requires Unit 1 to have landed first so `pl.isLate` exists on the payload.
- **Phase 1 (pitcher-block assignment)**: Run the pitcher-block pre-assignment logic from `shufflePositions()`. Track results in `pitcherSlots: Set<string>` and `inningsWithPitcher: Set<number>`. Additionally produce a `pitcherBlockMap: Map<playerId, Set<inningIndex>>` for Phase 2.
- **Phase 2 (bench slots)**: Before applying new bench assignments, reset all existing `Position.BENCH` entries in each player's `positions[]` to a non-BENCH field position placeholder (any field position; Phase 3 will overwrite it). This ensures old server bench slots don't persist. Then call `assignBenchSlots()` with the newly shuffled players (including `targetInnings`, `isLate`, gender, `battingOrder`, and the `pitcherBlockMap` from Phase 1). Apply the returned bench assignments: set each player's designated bench inning(s) to `Position.BENCH`.
- **Phase 3 (field positions)**: Run the positionCounts variety assignment from `shufflePositions()` for all innings where `positions[inning] !== Position.BENCH` and not in `pitcherSlots`. This is the existing Phase 2 of `shufflePositions()` unchanged.
- Call `setPlayers(updated)` with the complete result.

**Patterns to follow:**
- `web/src/components/LineupGrid.tsx` — existing `shufflePositions()` pitcher-block logic (new Phase 1) and positionCounts variety logic (new Phase 3)
- `docs/solutions/architecture-patterns/whole-game-position-shuffle-algorithm-2026-04-20.md` — whole-game variety assignment pattern

**Test scenarios (manual/visual — no automated test file for this unit):**
- Happy path: clicking "Shuffle Lineup" produces a complete lineup where no player is unassigned any inning.
- Happy path: early-third batters have bench in innings 1–2; late-third batters have bench in innings 5–6 (visually verifiable in the grid).
- Happy path: preferred pitchers appear in consecutive inning blocks.
- Edge case: late arrival player's bench inning is inning 1 regardless of batting position.
- Edge case: re-shuffling produces different results (randomness is genuine).
- Edge case: anti-position players are never forced into an anti-position when alternatives exist.
- Integration: the resulting lineup satisfies R13 (≥3 girls per inning) — verifiable by reading the grid.

**Verification:**
- Clicking "Shuffle Lineup" in the browser updates the grid coherently.
- No console errors.
- `isLate` fix confirmed: a late-arrival player's bench slot is inning 1 after shuffle.

---

- [ ] **Unit 5: Replace buttons with "Shuffle Lineup" + undo toast + animation**

**Goal:** Update the LineupGrid UI to show a single "Shuffle Lineup" button (R1), an 8-second dismissible undo action (R2a), and a brief visual confirmation animation (R2b).

**Requirements:** R1, R2a, R2b

**Dependencies:** Unit 4 (`shuffleLineup()` must exist before wiring up the button)

**Files:**
- Modify: `web/src/components/LineupGrid.tsx`

**Approach:**
- Remove the "Shuffle Order" and "Shuffle Positions" buttons.
- Add a single "Shuffle Lineup" button that calls `shuffleLineup()`.
- Before calling `shuffleLineup()`, snapshot the current `players` state into a `previousPlayers` ref or state variable for undo.
- After shuffle completes, show an 8-second dismissible undo toast/button. On dismiss or timeout, clear the snapshot. On undo click, call `setPlayers(previousPlayers)` and hide the toast.
- Button visual confirmation (R2b): apply a brief CSS animation class (e.g., a momentary spin or scale pulse) on click that auto-removes after the animation duration. Use a `useState` boolean or a CSS class toggled for the duration.
- Only one level of undo — if the user shuffles again before undoing, the previous snapshot is replaced.

**Patterns to follow:**
- Existing button styles in `LineupGrid.tsx` (border, text-xs, px-3 py-1.5, rounded)
- React `useState` / `useRef` pattern for undo snapshot

**Test scenarios:**
- Happy path: "Shuffle Lineup" button appears; "Shuffle Order" and "Shuffle Positions" buttons are gone.
- Happy path: clicking "Shuffle Lineup" triggers animation (visual), updates the grid, and shows undo option.
- Happy path: undo within 8 seconds restores previous grid state.
- Happy path: undo toast auto-dismisses after 8 seconds.
- Edge case: clicking "Shuffle Lineup" again before undoing replaces the undo snapshot (second undo would only undo to the second-to-last shuffle, not further back).
- Edge case: dismissing the undo toast manually removes it without restoring the lineup.

**Verification:**
- UI renders with one "Shuffle Lineup" button.
- Clicking it shows a brief animation and an undo option.
- Undo restores the exact previous lineup.
- Toast disappears within ~8 seconds if not dismissed.

---

## System-Wide Impact

- **Interaction graph:** `LineupBuilder` is the only server-side caller touched. `LineupGrid` is the only client-side caller. `assignBenchSlots()` has no external consumers yet.
- **Error propagation:** `assignBenchSlots()` is designed to always return a valid assignment — no throw paths. Hard constraints (R13/R14) violations inside the utility are architectural bugs, not runtime errors.
- **State lifecycle risks:** Unit 5's undo snapshot is held in component state — cleared on unmount. No persistence concerns.
- **API surface parity:** `GameLineup` type changes (`isLate`, `targetInnings` on `PlayerLineup`) flow through the existing API route automatically. No route signature changes required.
- **Integration coverage:** The bench-timing rules interact with both the position assigner (which innings are bench) and the batting order intersperse (which players are in which third). Unit 3's tests must verify these two subsystems produce coherent output together.
- **Unchanged invariants:** `intersperseBattingOrder()` is unchanged. `PositionAssigner`'s co-ed field-slot enforcement (R13/R14) is unchanged. All existing test suites must continue to pass after every unit.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `assignBenchSlots()` bench-slot remapping conflicts with `PositionAssigner`'s fairness distribution, changing total innings played | Verify in Unit 3 tests that `max − min ≤ 1` still holds; the utility only changes *when* players bench, not *how many* innings they bench |
| Split mode gender-group tiebreak produces non-obvious bench assignments that feel unfair | Document the tiebreak rule in code comments; the rule is deterministic and consistent |
| R17 pitcher-block constraint requires `assignBenchSlots()` to know which innings are pitcher-block innings | Pass pre-resolved pitcher assignments as a constraint parameter; unit tests cover the pitcher-precedence case explicitly |
| Client `isLate` and `targetInnings` are undefined for lineups generated before this deployment | Both fields default to safe values (`isLate: false`, `targetInnings: base`) on old payloads — handled by TypeScript optional with fallback in `shuffleLineup()` |
| Undo snapshot grows stale if player list changes server-side between shuffles | Undo only applies within one page session; on next page load the server lineup is fresh |

## Sources & References

- **Origin document:** [docs/brainstorms/shuffle-lineup-fairness-rules-requirements.md](docs/brainstorms/shuffle-lineup-fairness-rules-requirements.md)
- Related code: `web/src/components/LineupGrid.tsx` — `shuffleOrder()`, `shufflePositions()`
- Related code: `src/models/PositionAssigner.ts` — `calculateTargets()`, `assign()`
- Related code: `src/models/LineupBuilder.ts` — Step 3–4 pipeline
- Related code: `src/utils/intersperse.ts` — pattern for shared pure utility
- Related solutions: `docs/solutions/architecture-patterns/whole-game-position-shuffle-algorithm-2026-04-20.md`
- Related solutions: `docs/solutions/logic-errors/unified-mode-playing-time-discrepancy-2026-04-20.md`
- Prior plans: `docs/plans/2026-04-20-002-feat-lineup-algorithm-improvements-plan.md` (Units 1–4 complete — slack-based bench scheduling)
