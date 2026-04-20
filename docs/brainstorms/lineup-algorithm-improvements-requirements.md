# Lineup Algorithm Improvements — Requirements

**Date:** 2026-04-20
**Status:** Draft

---

## Problem Frame

The current lineup algorithm distributes playing time fairly and avoids anti-positions, but has four gaps the team has noticed in practice:

1. Extra innings go to top-of-batting-order players rather than bottom, which is backwards — bottom batters already bat less often if a game is shortened, so they should get field-time priority.
2. Players who must sit once (target < 6 innings) tend to sit in the last inning. If the game gets cut to 5 or 4 innings, they played their full target — but if the game were always played to completion this wouldn't matter. Sitting early guarantees the bench time is "served" and the player is available for the important late innings.
3. Anti-position violations can occur today because preferred-seeking players get first pick of positions, which can leave anti-position players with no good options remaining.
4. There is no pitcher rotation — any player can pitch any inning, and a single player can pitch all 6 innings. The team wants at most 3 pitchers per game, each pitching in a consecutive block.

---

## Requirements

### R1 — Extra innings go to bottom-of-order players

When total field spots aren't evenly divisible across players, the extra inning(s) go to the **last** players in the batting order, not the first.

*Current behavior:* `targets[0]` (first batter) gets the extra inning.
*New behavior:* `targets[N-1]` (last batter) gets the extra inning.

Applies independently to guys and girls within their respective groups.

### R2 — Bench time is scheduled in early innings

A player who must sit at least once should sit in the **earliest** inning where it won't prevent them from reaching their target — not the last.

*Mechanism:* For each inning, a player's `slack = (remaining innings) - (remaining target innings)`. Players with `slack > 0` can afford to sit this inning. When there are more eligible players than spots, deprioritize players with higher slack (they're the ones who can sit).

*Effect:* A player with target 5 of 6 has `slack = 1` in inning 1, so they sit inning 1 and play innings 2–6. If the game is cut to 5 innings, they played innings 2–5 = 4 innings. If the game completes, they play innings 2–6 = 5 innings.

### R3 — Anti-position avoidance takes precedence over preferred position satisfaction

When assigning positions for a given inning, the current logic sorts candidates so that players seeking their preferred positions pick first. This can leave anti-position players with no good options.

*New priority:*
1. Players who have anti-positions go **first** (to claim non-anti positions before they're taken)
2. Among players without anti-positions, preferred-seeking players go first (existing logic preserved)

Anti-position violations must remain a last resort (only when all remaining positions are anti-positions for a given player). R3 reduces how often that last resort is reached.

### R4 — At most 3 pitchers per game, consecutive innings

- Exactly 3 pitchers if 3+ preferred pitchers are available; 2 if only 2 are available; 1 if only 1 is available; 0 (no constraint) if no preferred pitchers.
- Innings divided equally: 3 pitchers → 2+2+2, 2 pitchers → 3+3, 1 pitcher → all 6.
- **Preferred pitchers only** — a player qualifies as a pitcher candidate if and only if they have `Position.PITCHER` in any of their `preferredPositions` groups.
- Pitcher selection: prefer players who have pitched fewer times recently (fair rotation across games — implementation detail for now).
- **Consecutive innings are locked in.** If pitcher 1 pitches innings 1–2, they play both innings 1 and 2, regardless of what the fairness algorithm would otherwise say about their bench schedule.
- Pitched innings count toward the player's playing time total (their `inningsPlayed` increments as normal).
- No preferred pitchers → pitcher position assigned normally by the existing general-purpose position assigner (no change).

### R5 — Existing tests continue to pass

All co-ed rules, fairness, positions, and late-arrival tests must still pass after these changes.

---

## Scope Boundaries

- **No change to co-ed field composition rules** (min 3 girls/inning, max 7 guys — enforced by `calculateFieldComposition`)
- **No change to the overall fairness principle** — everyone plays within ±1 innings of each other; only the distribution of "who gets the extra inning" and "when bench time is served" changes
- **No change to batting order** — order is still determined by `PlayerSorter` (on-time first, late arrivals last, bottom 20%)
- **No change to late arrival handling** — late arrivals still sit inning 1 and land in the bottom portion of the batting order
- **No change to unified vs split mode**

---

## Key Decisions

| Decision | Resolution |
|----------|-----------|
| Who gets extra innings? | Bottom-of-order players (reversed from current) |
| When does bench time happen? | Earliest possible inning (slack-based) |
| What takes precedence: anti-avoidance or preferred? | Anti-avoidance |
| Pitcher qualification | Must have Pitcher in `preferredPositions` |
| Innings split | Equal blocks; scales down gracefully (2+2+2 / 3+3 / 6) |
| Pitching vs fairness schedule | Pitching commitment wins; pitched innings count toward total |
| 0 preferred pitchers | No special pitcher logic; existing general assigner handles it |

---

## Open Questions

### Resolved
- Sit early or sit late? → **Early** (sit in low-numbered innings)
- Pitcher innings split → **Equal blocks** (2+2+2 / 3+3 / 6)
- Pitcher pool → **Preferred pitchers only**
- Fewer than 3 pitchers → **Scale down evenly**

### Deferred to Implementation
- **Pitcher selection order**: when 3+ preferred pitchers are available, which 3 pitch this game? (Round-robin by last game pitched is the obvious approach, but the data structure for tracking cross-game pitcher history doesn't exist yet — start with simple alphabetical or batting-order-based selection)
- **Pitching and fairness tension at game boundaries**: if pitcher 1's fairness target says they should sit inning 2, but they're locked in to pitch innings 1–2, their total innings will be at or above target. This is acceptable since pitching is a commitment — document the behavior.
- **Mid-inning scratch**: out of scope. If a pitcher can't finish their block, that's a game-day call; the algorithm assumes all assignments hold.

---

## Success Criteria

1. Players at the bottom of the batting order receive the extra inning when spots aren't evenly divisible.
2. A player with target 5 of 6 sits in inning 1 or 2 (not inning 5 or 6) in the general case.
3. In a game with at least 3 preferred pitchers, exactly 3 players pitch (2 innings each, consecutive).
4. Preferred pitchers pitch innings 1–2, 3–4, 5–6 in their assigned block without interruption.
5. Anti-position violations are less frequent than before (anti-position players pick earlier in the assignment loop).
6. All 6 test suites pass.
