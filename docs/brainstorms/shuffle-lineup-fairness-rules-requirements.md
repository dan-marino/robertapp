---
date: 2026-04-20
topic: shuffle-lineup-fairness-rules
---

# Shuffle Lineup — Unified Fairness Rules

## Problem Frame

The lineup grid currently has two separate buttons — "Shuffle Order" and "Shuffle Positions" — that operate independently. Shuffling one without the other can produce incoherent results (e.g., batting order and bench timing out of sync). More importantly, there is no rule tying *when* a player sits on the bench to *where* they bat in the order, which is a core fairness expectation for co-ed recreational softball: if you bat early, you sit early; if you bat late, you stay on the field longer before sitting.

This requirements doc captures the full set of fairness rules for both fielding and hitting, and defines a single "Shuffle Lineup" action that enforces all of them together.

## Requirements

**Shuffle UI**

- R1. The "Shuffle Order" and "Shuffle Positions" buttons are replaced by a single "Shuffle Lineup" button.
- R2. One press of "Shuffle Lineup" randomizes both the batting order and field position assignments simultaneously, applying all fairness rules below in one coherent pass.
- R2a. After each shuffle, a brief "Undo" action is available (e.g., an 8-second dismissible toast or button) that restores the previous lineup state. Only one level of undo is required.
- R2b. The "Shuffle Lineup" button provides a brief visual confirmation that the action completed (e.g., a momentary spin or press animation). This ensures users can distinguish a successful shuffle from a no-op even when the resulting lineup looks similar to the previous one.

**Batting Order Rules (existing, unchanged)**

- R3. In unified mode: spot 1 in the batting order is always a guy (no girl leadoff), unless no guys are present — in that case girls lead off.
- R4. In unified mode: no more than 3 consecutive guys appear between girls.
- R5. In unified mode: the last batter is a girl when mathematically possible (guys ≤ 3 × girls).
- R6. In unified mode: girls are distributed as evenly as possible within the above constraints.
- R7. Late arrivals are placed in the bottom 20% of their gender group's batting order.

**Bench Timing Rules (new)**

- R8. Each gender group's batting order is divided into thirds: early (top ~⅓), middle (~⅓), late (bottom ~⅓). In split mode, thirds are computed within each gender group independently. In unified mode, thirds are computed across the full combined order. Rounding rule: `earlyCount = ceil(n/3)`, `lateCount = ceil(n/3)`, `middleCount = n − earlyCount − lateCount`. Degenerate case: when a group has ≤ 3 players, assign one player per tier (early/middle/late = 1 each, or early/late only if n = 2).
- R9. Players in the **early third** of the batting order receive their bench inning in innings 1–2, preferring inning 1.
- R10. Players in the **late third** of the batting order receive their bench inning in innings 5–6, preferring inning 6. Exception: late arrivals are always benched in inning 1 (R7 + existing server behavior) regardless of their batting-order position — R10 does not apply to them.
- R11. Players in the **middle third** have no bench-inning constraint — they sit whenever best balances the field.
- R12. When players have unequal target innings (e.g., some play 5, some play 4): players with *more than base* innings sit early (prefer inning 1); players at *base* innings sit late (prefer their final bench inning being inning 6). When R12 and R9–R11 conflict (e.g., a late-third player who also has above-base innings), R12 takes precedence — innings-count fairness outranks batting-position symmetry because R14 is a near-hard constraint while bench-order symmetry is a soft preference.
- R12a. When a player must sit in more than one inning (roster size > 10, R14 ±1): the thirds preference (R9–R11) applies to the *first* bench inning; the player's *final* bench inning should be inning 6 (or as late as possible) as a soft preference, so that players sitting extra innings aren't penalized early in the game.

**Fielding Rules (existing, unchanged)**

- R13. Minimum 3 girls on the field per inning; maximum 7 guys. Never violated.
- R14. Every player's total innings played differs by at most 1 (fairness ±1).
- R15. A player is never assigned an anti-position when a non-anti-position is available. A player is benched before being forced into an anti-position.
- R16. Preferred positions are honored by priority group: the algorithm satisfies the highest-ranked group with an available position before falling back to lower-ranked groups.
- R17. Preferred pitchers receive consecutive inning blocks: with 3 pitchers, blocks are innings [1–2], [3–4], [5–6]; with 2, blocks are [1–3] and [4–6]; with 1, the pitcher covers all 6 innings. Pitcher-block innings take precedence over bench-timing preferences (R9–R11): a preferred pitcher's bench inning falls in their non-block inning, regardless of their batting-order third.
- R18. Cross-inning position variety is maximized: when multiple valid positions are available for a player, the algorithm prefers positions they have played least often across the game so far.

## Failure Handling

The shuffle always produces a usable lineup — it never fails outright. If bench-timing preferences (R9–R12) cannot all be satisfied simultaneously (e.g., R13 would be violated), the algorithm relaxes soft preferences in this order: middle-third constraint first, then late-third, then early-third. Hard constraints (R13, R14) are never relaxed.

## Success Criteria

- One press of "Shuffle Lineup" produces a complete, valid lineup where batting order and bench timing are coherent (early batters sit early, late batters sit late).
- No lineup generated by shuffle violates R13 (co-ed rules) or R15 (anti-position avoidance).
- Randomness is genuine — different seeds produce different outcomes. Highly constrained rosters (few players, many preferred pitchers) may have limited variety; this is acceptable.
- The result looks and feels "fair" to players who understand that batting spot and bench spot are connected.

## Scope Boundaries

- The bench-timing rules (R8–R12) apply to both the initial server-generated lineup and the client-side shuffle. The server-side `PositionAssigner` will be extended to accept the batting order and apply thirds-based bench timing during initial lineup generation. This ensures the lineup is coherent from page load, not only after the first shuffle.
- No new settings or toggles are introduced — the fairness rules apply unconditionally on every shuffle.
- Late arrival handling (R7): the new `shuffleLineup()` must pass the real `isLate` flag for each player to `intersperseBattingOrder` (the existing `shuffleOrder()` hardcodes `isLate: false`, which silently breaks R7 — fixing this is in scope for this feature since R7 correctness is a prerequisite for bench timing to work). How late arrival status is detected on the client (from the lineup payload) is a planning-time question.

## Key Decisions

- **Thirds within each gender group (split mode)**: Rather than computing thirds across all players combined, each gender group defines its own thirds. This avoids a guy in the top third being treated differently based on how many girls happen to be on the roster.
- **Bench-timing as a soft preference, not a hard constraint**: R9–R12 express preferences ("prefer inning 1", "prefer inning 6") rather than absolute rules, because hard constraints can conflict when roster size, co-ed rules, and target innings interact. The algorithm should satisfy them when possible and fall back gracefully when not. In split mode, when both gender groups' early-third players compete for the same bench slot (e.g., both want inning 1), the tiebreak is: alternate by gender group (one guy early-third player in inning 1, one girl early-third player in inning 2, or vice versa). If still tied, higher-slack player (more innings remaining vs target) gets the earlier bench slot.
- **One button replaces two**: Combining is the right call because the two concerns are interdependent — bench timing can't be correctly determined without knowing the batting order, and the batting order shuffle is meaningless without position reassignment to match.
- **Base innings on client**: R12 requires knowing each player's target innings. The `GameLineup` type (and its per-player entries) will be extended to include `targetInnings` from the server — the same value computed by `calculateTargets()`. The client does not recompute it; it reads the value the server already has. Planning should add this field to the server-side lineup generation and the `GameLineup` type.

## Dependencies / Assumptions

- The intersperse batting order logic (`src/utils/intersperse.ts`) remains unchanged and is reused by the new shuffle function.
- The new `shuffleLineup()` function has two phases: (1) bench-slot assignment — determines which inning each player sits, applying R8–R12; (2) position assignment — runs the existing pitcher-block and `positionCounts` logic from `web/src/components/LineupGrid.tsx` for non-bench innings only. The existing `shufflePositions()` is reused only for phase 2. Phase 1 is new logic that must actively move bench slots (the current shuffle treats bench slots as fixed and cannot implement R9–R12 as-is).

## Outstanding Questions

### Deferred to Planning

- [Affects R9–R12][Partially resolved] R12 vs R9–R11 conflict: R12 takes precedence (resolved in doc). Remaining: when satisfying any bench-timing preference would leave fewer than the R13 minimum on the field, which preference is relaxed first? (Suggested: relax middle-third constraint first, then late-third, then early-third — but planning should confirm.)
- [Affects R8][Resolved in doc] Rounding rule committed: ceil/ceil/remainder. Degenerate case (≤3 players) defined in R8.

## Next Steps

-> `/ce-plan` for structured implementation planning
