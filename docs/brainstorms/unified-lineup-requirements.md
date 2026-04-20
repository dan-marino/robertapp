# Unified Batting Lineup — Requirements

**Date:** 2026-04-20
**Status:** Ready for planning

---

## Overview

Add a per-game toggle that switches the batting lineup from two separate gender lists (current "split" mode) to a single unified batting order with girls interspersed (new "unified" mode).

Split mode remains the default and is best suited for games where guys heavily outnumber girls (roughly guys/girls > 3). Unified mode is preferred when the gender ratio is close enough that natural interspersing is possible.

---

## Config Change

Add a `lineupMode` field to each game object in `src/data/season.json`:

```json
{
  "id": "g1",
  "lineupMode": "unified"  // "split" (default) | "unified"
}
```

If the field is absent, default to `"split"` (backwards compatible).

---

## Split Mode (existing behavior)

No changes. Two separate batting orders — guys first, then girls — displayed as separate sections.

---

## Unified Mode — Batting Order Rules

A single batting order numbered 1 through N (all guys + all girls).

Girl placement must satisfy all of the following, in priority order:

1. **No girl leadoff** — position 1 must always be a guy.
2. **No more than 3 consecutive guys** — between any two girls, and before the first girl, there may be at most 3 guys.
3. **End with a girl (best effort)** — the last batter should be a girl when the math allows it. If satisfying rules 1 and 2 makes this impossible (e.g. too few girls for the guy count), drop this requirement gracefully rather than violating rule 2.
4. **Even distribution** — girls spread as evenly as possible across the lineup within the above constraints.

### Examples

| Guys | Girls | Example order | Notes |
|------|-------|---------------|-------|
| 9 | 3 | GGG♀ GGG♀ GGG♀ | Exactly 3:1, ends with girl ✓ |
| 6 | 3 | GG♀ GG♀ GG♀ | 2:1, ends with girl ✓ |
| 10 | 3 | GGG♀ GG♀ GGG♀ GG | Ends with guys (best effort satisfied) |
| 8 | 4 | GG♀ GG♀ GG♀ GG♀ | Ends with girl ✓ |

---

## Web UI Display

### Unified mode
- Single numbered list (1 through N)
- Female rows are highlighted by row background color (no gender text label)
- Male rows use the default/unstyled row color

### Split mode
- No change from current display

### Changelog
- Update the app changelog to document the new `lineupMode` field and unified lineup behavior.

---

## Out of Scope

- Auto-detecting or auto-switching mode based on ratio (the game config field is the only control)
- A warning or suggestion UI when the ratio makes unified mode awkward
- Any changes to position assignment logic (co-ed rules per inning are unchanged)
- Changes to late arrival handling

---

## Success Criteria

- [ ] `lineupMode: "unified"` in a game config produces a single batting order for that game
- [ ] `lineupMode: "split"` or absent field produces the current two-list behavior
- [ ] Unified order never places a girl first
- [ ] Unified order never has more than 3 consecutive guys
- [ ] Unified order ends with a girl whenever mathematically possible given the above constraints
- [ ] Female rows are visually distinguished by row color in the web UI
- [ ] All existing tests continue to pass
- [ ] Changelog updated
