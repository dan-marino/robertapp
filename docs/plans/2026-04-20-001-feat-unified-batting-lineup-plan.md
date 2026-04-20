---
title: "feat: Unified Batting Lineup Mode"
type: feat
status: active
date: 2026-04-20
origin: docs/brainstorms/unified-lineup-requirements.md
---

# feat: Unified Batting Lineup Mode

## Overview

Add a per-game `lineupMode` toggle (`"split"` | `"unified"`) stored in the game config. In unified mode, guys and girls are merged into a single numbered batting order with girls interspersed according to priority-ordered placement rules. Split mode (existing behavior) is unchanged and remains the default when the field is absent.

## Problem Frame

The current lineup always produces two separate batting orders — guys first, girls second. This works well when guys heavily outnumber girls, but when the gender ratio is close, a single interleaved list is a more natural and fair representation. The feature is controlled per game via config, not auto-detected.

(see origin: `docs/brainstorms/unified-lineup-requirements.md`)

## Requirements Trace

- R1. `lineupMode: "unified"` in a game config produces a single batting order (1 through N) for that game
- R2. `lineupMode: "split"` or absent field produces the current two-list behavior unchanged
- R3. Unified order never places a girl first (position 1 = guy)
- R4. Unified order never has more than 3 consecutive guys
- R5. Unified order ends with a girl whenever mathematically possible given R3 + R4
- R6. Girls are distributed as evenly as possible within the above constraints
- R7. Female rows are visually distinguished by row background color in the web UI (no label)
- R8. All existing tests continue to pass
- R9. App changelog updated

## Scope Boundaries

- No auto-detection or auto-switching based on the guys/girls ratio — the config field is the only control
- No warning or suggestion UI when the ratio makes unified mode awkward
- Position assignment and co-ed rules (min 3 girls/inning, max 7 guys/inning) are unchanged in both modes
- Late arrival handling is unchanged — late arrivals still sit inning 1 and land in the bottom portion of the lineup within their gender group before interspersing
- No changes to `PositionAssigner` internals

## Context & Research

### Relevant Code and Patterns

- `src/types.ts` — `Game`, `GameLineup`, `PlayerLineup` interfaces; `Gender` enum
- `src/models/LineupBuilder.ts` — orchestrates lineup generation; `generate()` currently concatenates guys-then-girls
- `src/models/PlayerSorter.ts` — `organize()` splits by gender and sorts by arrival time; returns `{ guys, girls }`
- `src/generator.ts` — thin public wrapper: `generateLineup(rsvps, players)` → `GameLineup`
- `src/csv-writer.ts` — `CSVWriter.generate()` uses `lineup.guysCount` to split output into two sections
- `web/src/components/LineupGrid.tsx` — uses `lineup.guysCount` to split into two sections; `shuffleOrder()` shuffles within each gender independently
- `web/src/app/games/[id]/lineup/page.tsx` — reads `game` from `readSeason()`, calls `generateLineup(rsvps, players)` (does not currently pass `lineupMode`)
- `web/src/app/api/games/[id]/lineup/route.ts` — calls `generateLineup(rsvps, players)` without reading game config; needs to read game to get `lineupMode`
- `src/data/season.json` — game objects; `lineupMode` will be added as an optional field

### Institutional Learnings

- None found in `docs/solutions/`.

### External References

- No external research needed — the intersperse algorithm is self-contained domain logic with clear rules from the requirements doc.

## Key Technical Decisions

- **`lineupMode` lives on `GameLineup`** (not just in the config): Consumers (CSVWriter, LineupGrid) need to know the mode at render time without re-reading the config. Adding `lineupMode: LineupMode` to `GameLineup` carries it through the whole pipeline cleanly.
- **Intersperse algorithm is a pure utility function**: Isolated in `src/utils/intersperse.ts`, takes `guys: PlayerWithMetadata[]` and `girls: PlayerWithMetadata[]`, returns a single merged array in batting order. Easy to test independently.
- **`generateLineup()` gets an optional third parameter**: `lineupMode?: LineupMode`. Defaults to `'split'`. This is backwards-compatible — existing callers continue to work without changes, and both the page and API route can opt in by passing `game.lineupMode`.
- **`battingOrder` in unified mode is globally numbered 1–N**: The existing per-gender reset is only used in split mode. In unified mode, the intersperse function assigns positions 1 through total players in order.
- **`shuffleOrder` in unified mode re-runs intersperse**: Rather than disabling the Shuffle Order button, when in unified mode it shuffles each gender group independently then re-runs `intersperseBattingOrder`. This preserves all placement rules while allowing random order exploration.

## Open Questions

### Resolved During Planning

- **Does `GameLineup.guysCount`/`girlsCount` stay valid in unified mode?** Yes — they remain accurate counts for the metadata display (`"9 guys · 4 girls"`). They are no longer safe to use as split indices in unified mode, which is why `lineupMode` is also carried through.
- **Does the API route need to read the game config?** Yes — it currently does not. It needs to fetch the game object by id to read `lineupMode` before calling `generateLineup`.

### Deferred to Implementation

- **Exact intersperse algorithm implementation**: The rules are clear (see High-Level Technical Design below), but exact tie-breaking when distributing unevenly (e.g. 10 guys / 3 girls) is left to the implementer within the stated priority order.
- **Changelog file location**: No changelog file was found in the repo. The implementer should locate or create it during implementation.

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Intersperse algorithm decision table

Given `G` guys and `R` girls, the algorithm places girls by first deciding whether to end with a girl:

| Condition | Ending strategy | Guy-slot distribution |
|---|---|---|
| G ≤ 3·R (can satisfy "end with girl") | Last slot = girl; distribute G guys across **R slots** (one before each girl), first slot ≥ 1, each ≤ 3 | Distribute as evenly as possible: `floor(G/R)` or `ceil(G/R)` per slot |
| G > 3·R (impossible to end with girl) | Last slot = guy; distribute G guys across **R+1 slots** (before each girl + after last girl), first slot ≥ 1, last slot ≥ 1, each ≤ 3 | Same even-distribution approach across R+1 slots |

Once slot sizes are determined, the output array is built by alternating: take N guys from the sorted guys array, then 1 girl, repeat for each slot.

### Mode flow through the pipeline

```
season.json { lineupMode }
    ↓
page.tsx / route.ts — reads game, passes lineupMode to generateLineup()
    ↓
generator.ts: generateLineup(rsvps, players, lineupMode)
    ↓
LineupBuilder(allPlayers, rsvps, lineupMode)
    ↓ [if unified] intersperseBattingOrder(guys, girls) → merged array
    ↓
GameLineup { lineup, guysCount, girlsCount, lineupMode }
    ↓
CSVWriter / LineupGrid — branch on lineupMode for display
```

## Implementation Units

- [ ] **Unit 1: Type extensions and config schema**

**Goal:** Add `LineupMode`, extend `Game` and `GameLineup` types, and add `lineupMode` to `season.json` for the game(s) that should use unified mode.

**Requirements:** R1, R2

**Dependencies:** None

**Files:**
- Modify: `src/types.ts`
- Modify: `src/data/season.json`

**Approach:**
- Add `export type LineupMode = 'split' | 'unified'` to `src/types.ts`
- Add `lineupMode?: LineupMode` to the `Game` interface
- Add `lineupMode: LineupMode` (non-optional, always set by the builder) to `GameLineup`
- Add `lineupMode: "unified"` to any game in `season.json` that should use the new mode; leave others absent (defaults to split)

**Patterns to follow:**
- Existing optional fields on `Game` (e.g. `homeScore?: number`)

**Test scenarios:**
- Test expectation: none — pure type/config change with no behavioral logic

**Verification:**
- TypeScript compiles without errors after the type changes
- `season.json` is valid JSON with the new field

---

- [ ] **Unit 2: Intersperse algorithm**

**Goal:** Implement the pure function that merges sorted guys and girls arrays into a single batting-order array following the four placement rules.

**Requirements:** R3, R4, R5, R6

**Dependencies:** Unit 1 (LineupMode type, PlayerWithMetadata)

**Files:**
- Create: `src/utils/intersperse.ts`
- Create: `__tests__/unified-lineup.test.ts`

**Approach:**
- Function signature: `intersperseBattingOrder(guys: PlayerWithMetadata[], girls: PlayerWithMetadata[]): PlayerWithMetadata[]`
- Determine slot sizes using the decision table in High-Level Technical Design
- Build the merged array by filling each slot with guys then appending one girl
- Return order matches the desired batting sequence; callers assign `battingOrder` 1–N

**Patterns to follow:**
- `src/utils/calculations.ts` — pure utility function style, no side effects
- `__tests__/setup.ts` factories (`createPlayer`, `createRSVP`, `createRoster`)

**Test scenarios:**
- Happy path: 9 guys / 3 girls → pattern `GGG♀ GGG♀ GGG♀`, ends with girl, no run > 3
- Happy path: 6 guys / 3 girls → pattern `GG♀ GG♀ GG♀`, ends with girl
- Happy path: 8 guys / 4 girls → `GG♀ GG♀ GG♀ GG♀`, ends with girl
- Happy path: 10 guys / 3 girls → cannot end with girl (10 > 3·3), ends with guy, all runs ≤ 3
- Edge case: 1 guy / 3 girls → `G♀♀♀`, first is guy ✓, ends with girl ✓ (consecutive girls allowed — the constraint is max 3 guys, not max 1 girl)
- Edge case: 3 guys / 1 girl → `GGG♀`, ends with girl ✓, run of 3 guys ✓
- Edge case: 4 guys / 1 girl → cannot end with girl (4 > 3·1), position 1 is guy ✓, girl somewhere in the middle
- Edge case: 0 girls → returns guys array unchanged (split mode should be used, but function should not crash)
- Error path: 0 guys → returns girls array unchanged (similar graceful behavior)

**Verification:**
- All test scenarios pass
- Function is a pure function with no external dependencies

---

- [ ] **Unit 3: LineupBuilder and generator wiring**

**Goal:** Thread `lineupMode` from the game config through `generateLineup()` and `LineupBuilder` so that unified mode produces a merged, globally-numbered batting order and the mode is reflected in the returned `GameLineup`.

**Requirements:** R1, R2

**Dependencies:** Unit 1, Unit 2

**Files:**
- Modify: `src/models/LineupBuilder.ts`
- Modify: `src/generator.ts`
- Modify: `web/src/app/games/[id]/lineup/page.tsx`
- Modify: `web/src/app/api/games/[id]/lineup/route.ts`

**Approach:**
- `LineupBuilder` constructor: add `lineupMode: LineupMode = 'split'`
- In `generate()`: after `buildPlayerLineups`, if `lineupMode === 'unified'`, call `intersperseBattingOrder(guys, girls)` with the `PlayerWithMetadata` arrays (before building `PlayerLineup` objects), then build a single `PlayerLineup` array with globally-incrementing `battingOrder` values
- Return `{ lineup, guysCount, girlsCount, lineupMode }` in all cases
- `generator.ts`: add optional `lineupMode?: LineupMode = 'split'` to `generateLineup()` and pass it to `LineupBuilder`
- `page.tsx`: already reads `game` from `readSeason()`; pass `game.lineupMode` as the third argument to `generateLineup()`
- `route.ts`: read the game object by id before calling `generateLineup()`; pass `game.lineupMode`

**Patterns to follow:**
- `LineupBuilder` constructor already accepts `innings: number = 6` as an optional param with default

**Test scenarios:**
- Integration: `generateLineup(rsvps, players, 'unified')` with 9 guys / 3 girls → returned `lineup` has 12 entries in interleaved order, `battingOrder` runs 1–12, `lineupMode === 'unified'`
- Integration: `generateLineup(rsvps, players, 'split')` → returned `lineup` has guys then girls, `battingOrder` resets for girls, `lineupMode === 'split'`
- Integration: `generateLineup(rsvps, players)` (no third arg) → defaults to split, existing behavior unchanged
- Integration: existing co-ed rules tests still pass (position assignment unchanged)

**Verification:**
- `npm test` passes (all 5 existing suites)
- New integration scenarios pass

---

- [ ] **Unit 4: CSV writer — unified mode output**

**Goal:** Update `CSVWriter` to output a single continuous section (no blank-row separator, global batting order) when `lineupMode === 'unified'`.

**Requirements:** R1, R2

**Dependencies:** Unit 3

**Files:**
- Modify: `src/csv-writer.ts`

**Approach:**
- In `CSVWriter.generate()`: branch on `this.lineup.lineupMode`
- Split mode: existing behavior unchanged (guys section, blank row, girls section)
- Unified mode: single pass over `this.lineup.lineup` in order, `battingOrder` already globally set — no separator

**Patterns to follow:**
- Existing `buildPlayerRows()` / `buildPlayerRow()` helpers work unchanged since `battingOrder` is already correct on each `PlayerLineup`

**Test scenarios:**
- Happy path unified: CSV output has exactly `1 + N+M` lines (header + one row per player), no blank rows
- Happy path split: CSV output unchanged from current behavior (blank row between sections)
- Edge case: `lineupMode` absent defaults to split (should not occur given Unit 1, but defensive check)

**Verification:**
- Unified mode CSV has no blank separator row
- Split mode CSV output is byte-for-byte identical to pre-change output

---

- [ ] **Unit 5: Web UI — LineupGrid unified mode**

**Goal:** Render a single unified table section with female rows distinguished by row background color when `lineupMode === 'unified'`. Update `shuffleOrder` to re-run the intersperse algorithm in unified mode.

**Requirements:** R7

**Dependencies:** Unit 3

**Files:**
- Modify: `web/src/components/LineupGrid.tsx`
- Modify: `web/src/app/games/[id]/lineup/page.tsx`

**Approach:**
- In `LineupGrid`: branch on `lineup.lineupMode`
  - **Split mode**: existing `SectionHeader` + two-group render unchanged
  - **Unified mode**: render a single `<tbody>` with no `SectionHeader` rows; `PlayerRow` receives an `isGirl` prop; female rows get a subtle pink background (e.g. `bg-pink-50`) on the `<tr>`, male rows use the default unstyled `<tr>`
- `shuffleOrder` in unified mode: filter players by gender (use `player.gender` instead of index-based slice), shuffle each gender group, re-run `intersperseBattingOrder` from `src/utils/intersperse.ts`, assign unified `battingOrder` 1–N, then `setPlayers`
- In `page.tsx`: the metadata line (`"9 guys · 4 girls"`) continues to use `guysCount`/`girlsCount` — no change needed there

**Patterns to follow:**
- Existing `SectionHeader` color pattern for `bg-pink-50` reference
- Existing `PlayerRow` for row-level className extension

**Test scenarios:**
- Test expectation: none — visual/rendering component; correct behavior verified manually in browser

**Verification:**
- In unified mode: table has no section header rows; female player rows have a pink background tint; male rows are unstyled
- In split mode: rendering is pixel-identical to pre-change behavior
- Shuffle Order button in unified mode produces a new valid interleaved order (no girl leadoff, max 3 consecutive guys)

---

- [ ] **Unit 6: Changelog**

**Goal:** Document the new `lineupMode` field and unified lineup behavior in the app changelog.

**Requirements:** R9

**Dependencies:** None (can be done in parallel with any unit)

**Files:**
- Modify or create: app changelog (locate during implementation)

**Approach:**
- Record: new optional `lineupMode` field on game objects in `season.json`; values `"unified"` | `"split"`; absent defaults to `"split"`
- Record: unified mode behavior — single batting order, girl placement rules, row color in UI

**Test scenarios:**
- Test expectation: none — documentation change

**Verification:**
- Changelog entry is present and accurate

---

## System-Wide Impact

- **Interaction graph:** `LineupGrid.shuffleOrder` currently slices by `guysCount` index — this is unsafe in unified mode and must be replaced with gender-based filtering (Unit 5)
- **API surface parity:** Both `page.tsx` (server render) and `route.ts` (JSON API) call `generateLineup` independently; both must be updated to pass `lineupMode` or they will diverge
- **State lifecycle risks:** `GameLineup.lineup` array order changes in unified mode — any consumer that assumes guys-then-girls ordering (by index) must branch on `lineupMode`
- **Unchanged invariants:** `PositionAssigner` internals are entirely unchanged; co-ed field composition rules (min 3 girls/inning, max 7 guys/inning) are unaffected by batting order mode

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| `guysCount` used as a split index in multiple places (LineupGrid, CSVWriter) | Each consumer is explicitly covered in its own unit; `lineupMode` field on `GameLineup` makes branching unambiguous |
| Intersperse edge cases (very few girls, very many guys) produce constraint violations | Unit 2 test scenarios cover the boundary cases; rules are priority-ordered so violations are caught by tests |
| API route diverges from page if only one caller is updated | Both callers are listed in Unit 3 files; plan is explicit about this risk |

## Sources & References

- **Origin document:** [`docs/brainstorms/unified-lineup-requirements.md`](../brainstorms/unified-lineup-requirements.md)
- Related code: `src/models/LineupBuilder.ts`, `src/utils/calculations.ts`, `web/src/components/LineupGrid.tsx`
